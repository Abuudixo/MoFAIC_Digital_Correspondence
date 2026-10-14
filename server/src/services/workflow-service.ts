import {
  ConfidentialityLevel,
  CorrespondenceStatus,
  NotificationKind,
  Prisma,
  RetentionAction,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { getCorrespondence } from "./correspondence-service";
import { writeAudit } from "./audit-service";

type Actor = {
  id: string;
  permissions: string[];
  departmentId?: string | null;
  role?: string;
};

const transitionPermissions: Partial<Record<CorrespondenceStatus, string>> = {
  [CorrespondenceStatus.IN_PROGRESS]: "correspondence:action",
  [CorrespondenceStatus.PENDING_APPROVAL]: "correspondence:review",
  [CorrespondenceStatus.DISPATCHED]: "correspondence:dispatch",
  [CorrespondenceStatus.CLOSED]: "correspondence:close",
};

const transitions: Partial<Record<CorrespondenceStatus, CorrespondenceStatus[]>> = {
  [CorrespondenceStatus.OPEN]: [CorrespondenceStatus.IN_PROGRESS],
  [CorrespondenceStatus.IN_PROGRESS]: [CorrespondenceStatus.PENDING_APPROVAL],
  [CorrespondenceStatus.PENDING_APPROVAL]: [CorrespondenceStatus.IN_PROGRESS],
  [CorrespondenceStatus.APPROVED]: [CorrespondenceStatus.DISPATCHED],
  [CorrespondenceStatus.DISPATCHED]: [CorrespondenceStatus.CLOSED],
};

export function closureRequirementError(
  incompleteActionCount: number,
  evidenceCount: number,
  fileLocation: string | null,
) {
  if (incompleteActionCount > 0) {
    return "Complete all assigned actions before closing correspondence.";
  }
  if (!fileLocation?.trim() && evidenceCount === 0) {
    return "Record a file location or attach supporting evidence before closing.";
  }
  return null;
}

function ensureVisible(
  record: {
    confidentiality: ConfidentialityLevel;
    createdById: string;
    assignedToId: string | null;
    departmentId: string;
  },
  actor: Actor,
) {
  if (actor.permissions.includes("correspondence:read:any")) return;
  const classificationPermission: Partial<Record<ConfidentialityLevel, string>> = {
    CONFIDENTIAL: "correspondence:read:confidential",
    RESTRICTED: "correspondence:read:restricted",
    SECRET: "correspondence:read:secret",
  };
  const requiredPermission = classificationPermission[record.confidentiality];
  if (requiredPermission && !actor.permissions.includes(requiredPermission)) {
    throw new AppError(403, "You cannot access this correspondence.");
  }
  if (record.createdById === actor.id || record.assignedToId === actor.id) return;
  if (
    (record.confidentiality === ConfidentialityLevel.NORMAL &&
      actor.permissions.includes("correspondence:read:department") &&
      actor.departmentId === record.departmentId) ||
    (requiredPermission && actor.permissions.includes(requiredPermission))
  ) {
    return;
  }
  throw new AppError(403, "You cannot access this correspondence.");
}

async function notifyUser(
  tx: Prisma.TransactionClient,
  userId: string | null,
  correspondenceId: string,
  kind: NotificationKind,
) {
  if (!userId) return;
  await tx.notification.create({
    data: {
      userId,
      correspondenceId,
      kind,
      message: "A correspondence item requires your attention.",
    },
  });
}

export async function assignCorrespondence(
  input: {
    correspondenceId: string;
    departmentId: string;
    assignedToId?: string | null;
    comment?: string;
  },
  actorId: string,
  permissions: string[],
  actorDepartmentId?: string | null,
  ipAddress?: string,
) {
  if (!permissions.includes("correspondence:assign")) {
    throw new AppError(403, "You do not have permission to assign correspondence.");
  }
  const existing = await prisma.correspondence.findUnique({
    where: { id: input.correspondenceId },
  });
  if (!existing || existing.archivedAt) throw new AppError(404, "Correspondence was not found.");
  ensureVisible(existing, { id: actorId, permissions, departmentId: actorDepartmentId });

  return prisma.$transaction(async (tx) => {
    const department = await tx.department.findUnique({
      where: { id: input.departmentId },
      select: { id: true, isActive: true },
    });
    if (!department?.isActive) throw new AppError(400, "The selected department is unavailable.");

    if (input.assignedToId) {
      const assignee = await tx.user.findUnique({
        where: { id: input.assignedToId },
        select: { id: true, isActive: true, departmentId: true },
      });
      if (!assignee?.isActive || assignee.departmentId !== input.departmentId) {
        throw new AppError(400, "The assignee must be an active user in the selected department.");
      }
    }

    if (
      existing.status === CorrespondenceStatus.CLOSED ||
      existing.status === CorrespondenceStatus.ARCHIVED ||
      existing.status === CorrespondenceStatus.APPROVED ||
      existing.status === CorrespondenceStatus.DISPATCHED
    ) {
      throw new AppError(409, "This correspondence can no longer be assigned.");
    }

    const nextStatus = CorrespondenceStatus.IN_PROGRESS;
    const updated = await tx.correspondence.updateMany({
      where: { id: existing.id, status: existing.status, updatedAt: existing.updatedAt },
      data: {
        departmentId: input.departmentId,
        assignedToId: input.assignedToId ?? null,
        status: nextStatus,
      },
    });
    if (updated.count !== 1) {
      throw new AppError(409, "Correspondence changed while the assignment was being saved.");
    }

    await tx.assignment.create({
      data: {
        correspondenceId: existing.id,
        departmentId: input.departmentId,
        assignedToId: input.assignedToId ?? null,
        assignedById: actorId,
        comment: input.comment,
      },
    });
    await tx.workflowAction.create({
      data: {
        correspondenceId: existing.id,
        actorId,
        fromStatus: existing.status,
        toStatus: nextStatus,
        comment: input.comment,
        ipAddress,
      },
    });
    await writeAudit(tx, {
      actorId,
      action: "correspondence.assigned",
      entity: "Correspondence",
      entityId: existing.id,
      correspondenceId: existing.id,
      ipAddress,
      metadata: {
        before: { departmentId: existing.departmentId, assignedToId: existing.assignedToId },
        after: { departmentId: input.departmentId, assignedToId: input.assignedToId ?? null },
      },
    });
    await notifyUser(tx, input.assignedToId ?? null, existing.id, NotificationKind.ASSIGNMENT);

    return tx.correspondence.findUniqueOrThrow({
      where: { id: existing.id },
      include: { department: true, assignedTo: { select: { id: true, name: true, email: true } } },
    });
  });
}

async function recordTransition(
  correspondenceId: string,
  toStatus: CorrespondenceStatus,
  actor: Actor,
  comment: string | undefined,
  ipAddress: string | undefined,
  approvalDecision?: "APPROVED" | "REJECTED",
) {
  const { id: actorId, permissions } = actor;
  const requiredPermission = transitionPermissions[toStatus];
  if (requiredPermission && !permissions.includes(requiredPermission)) {
    throw new AppError(403, "You do not have permission to perform this workflow action.");
  }
  if (
    approvalDecision === "REJECTED" &&
    (!permissions.includes("correspondence:approve") || !comment?.trim())
  ) {
    throw new AppError(400, "Rejecting correspondence requires approval permission and a comment.");
  }
  if (
    toStatus === CorrespondenceStatus.APPROVED &&
    !permissions.includes("correspondence:approve")
  ) {
    throw new AppError(403, "You do not have permission to approve correspondence.");
  }
  if (
    (toStatus === CorrespondenceStatus.PENDING_APPROVAL ||
      toStatus === CorrespondenceStatus.APPROVED) &&
    !comment?.trim()
  ) {
    throw new AppError(400, "A comment is required for review and approval.");
  }
  if (
    toStatus !== CorrespondenceStatus.PENDING_APPROVAL &&
    toStatus !== CorrespondenceStatus.APPROVED
  ) {
    const configuredStep = await prisma.workflowStep.findFirst({
      where: {
        status: toStatus,
        definition: { isActive: true },
      },
      select: { requiresComment: true },
    });
    if (configuredStep?.requiresComment && !comment?.trim()) {
      throw new AppError(400, "A comment is required for this workflow step.");
    }
  }

  const existing = await prisma.correspondence.findUnique({ where: { id: correspondenceId } });
  if (!existing || existing.archivedAt) throw new AppError(404, "Correspondence was not found.");
  ensureVisible(existing, actor);

  let allowed =
    approvalDecision === "APPROVED"
      ? existing.status === CorrespondenceStatus.PENDING_APPROVAL
      : approvalDecision === "REJECTED"
        ? existing.status === CorrespondenceStatus.PENDING_APPROVAL
        : (transitions[existing.status] ?? []).includes(toStatus);
  const activeDefinition = await prisma.workflowDefinition.findFirst({
    where: { isActive: true },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (allowed && activeDefinition) {
    const fromStep = activeDefinition.steps.find((step) => step.status === existing.status);
    const toStep = activeDefinition.steps.find((step) => step.status === toStatus);
    allowed = Boolean(
      fromStep &&
      toStep &&
        fromStep.allowedNextStates.includes(toStatus) &&
        (!toStep.requiredRole || toStep.requiredRole === actor.role || actor.role === "ADMIN"),
    );
  }
  if (!allowed) {
    throw new AppError(409, `Cannot change correspondence from ${existing.status} to ${toStatus}.`);
  }

  return prisma.$transaction(async (tx) => {
    if (toStatus === CorrespondenceStatus.CLOSED) {
      const [incompleteActions, evidenceCount] = await Promise.all([
        tx.actionItem.count({
          where: { correspondenceId, status: { not: "COMPLETED" } },
        }),
        tx.document.count({ where: { correspondenceId } }),
      ]);
      const closureError = closureRequirementError(
        incompleteActions,
        evidenceCount,
        existing.fileLocation,
      );
      if (closureError) throw new AppError(409, closureError);
    }
    const changed = await tx.correspondence.updateMany({
      where: { id: existing.id, status: existing.status, updatedAt: existing.updatedAt },
      data: {
        status: toStatus,
        ...(toStatus === CorrespondenceStatus.CLOSED
          ? { dateClosed: new Date(new Date().toISOString().slice(0, 10)) }
          : {}),
      },
    });
    if (changed.count !== 1) {
      throw new AppError(409, "Correspondence changed while the workflow action was being saved.");
    }
    await tx.workflowAction.create({
      data: {
        correspondenceId,
        actorId,
        fromStatus: existing.status,
        toStatus,
        comment,
        ipAddress,
      },
    });
    if (approvalDecision) {
      await tx.approval.create({
        data: { correspondenceId, actorId, decision: approvalDecision, comment },
      });
    }
    await writeAudit(tx, {
      actorId,
      action: `correspondence.${toStatus.toLowerCase()}`,
      entity: "Correspondence",
      entityId: correspondenceId,
      correspondenceId,
      ipAddress,
      metadata: {
        before: { status: existing.status },
        after: { status: toStatus, comment },
      },
    });

    const notificationKind =
      toStatus === CorrespondenceStatus.PENDING_APPROVAL
        ? NotificationKind.APPROVAL_REQUEST
        : NotificationKind.WORKFLOW_UPDATE;
    await notifyUser(tx, existing.createdById, correspondenceId, notificationKind);
    return tx.correspondence.findUniqueOrThrow({ where: { id: correspondenceId } });
  });
}

export function transitionCorrespondence(
  id: string,
  toStatus: CorrespondenceStatus,
  actor: Actor,
  comment?: string,
  ipAddress?: string,
) {
  if (
    toStatus === CorrespondenceStatus.APPROVED ||
    toStatus === CorrespondenceStatus.ARCHIVED ||
    toStatus === CorrespondenceStatus.OPEN
  ) {
    throw new AppError(400, "Use the dedicated approval, rejection, assignment, or archive action.");
  }
  return recordTransition(id, toStatus, actor, comment, ipAddress);
}

export function decideApproval(
  id: string,
  decision: "APPROVED" | "REJECTED",
  actor: Actor,
  comment: string | undefined,
  ipAddress?: string,
) {
  return recordTransition(
    id,
    decision === "APPROVED"
      ? CorrespondenceStatus.APPROVED
      : CorrespondenceStatus.IN_PROGRESS,
    actor,
    comment,
    ipAddress,
    decision,
  );
}

export async function workflowHistory(
  correspondenceId: string,
  actor: Actor & { departmentId?: string | null },
) {
  const record = await prisma.correspondence.findUnique({ where: { id: correspondenceId } });
  if (!record) throw new AppError(404, "Correspondence was not found.");
  if (
    record.archivedAt &&
    !actor.permissions.includes("correspondence:read:archive")
  ) {
    throw new AppError(403, "You cannot access archived workflow history.");
  }
  ensureVisible(record, actor);

  const [actions, assignments, approvals, legacy] = await Promise.all([
    prisma.workflowAction.findMany({
      where: { correspondenceId },
      orderBy: { createdAt: "asc" },
      include: { actor: { select: { id: true, name: true } } },
    }),
    prisma.assignment.findMany({
      where: { correspondenceId },
      orderBy: { createdAt: "asc" },
      include: {
        assignedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    }),
    prisma.approval.findMany({
      where: { correspondenceId },
      orderBy: { createdAt: "asc" },
      include: { actor: { select: { id: true, name: true } } },
    }),
    prisma.workflow.findMany({
      where: { correspondenceId },
      orderBy: { createdAt: "asc" },
      include: { actor: { select: { id: true, name: true } } },
    }),
  ]);

  return [
    ...actions.map((event) => ({ ...event, kind: "WORKFLOW_ACTION" as const })),
    ...assignments.map((event) => ({ ...event, kind: "ASSIGNMENT" as const })),
    ...approvals.map((event) => ({ ...event, kind: "APPROVAL" as const })),
    ...legacy.map((event) => ({ ...event, kind: "STATUS_HISTORY" as const })),
  ].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
}

export async function createWorkflowDefinition(input: {
  name: string;
  description?: string;
  isActive: boolean;
  steps: {
    order: number;
    status: CorrespondenceStatus;
    requiredRole?: string;
    requiresComment: boolean;
    allowedNextStates: CorrespondenceStatus[];
  }[];
}, actorId: string, ipAddress?: string) {
  if (input.steps.length === 0) throw new AppError(400, "A workflow definition must have at least one step.");
  const uniqueStatuses = new Set(input.steps.map((step) => step.status));
  const uniqueOrders = new Set(input.steps.map((step) => step.order));
  if (uniqueStatuses.size !== input.steps.length || uniqueOrders.size !== input.steps.length) {
    throw new AppError(400, "Workflow step statuses and orders must be unique.");
  }
  return prisma.$transaction(async (tx) => {
    if (input.isActive) {
      await tx.workflowDefinition.updateMany({ data: { isActive: false } });
    }
    const definition = await tx.workflowDefinition.create({
      data: {
        name: input.name,
        description: input.description,
        isActive: input.isActive,
        steps: { create: input.steps },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    await writeAudit(tx, {
      actorId,
      action: "workflow_definition.created",
      entity: "WorkflowDefinition",
      entityId: definition.id,
      ipAddress,
      metadata: { name: definition.name, isActive: definition.isActive, stepCount: input.steps.length },
    });
    return definition;
  });
}

export async function listWorkflowDefinitions() {
  return prisma.workflowDefinition.findMany({
    orderBy: { createdAt: "asc" },
    include: { steps: { orderBy: { order: "asc" } } },
  });
}

export async function configureRetentionPolicy(
  input: {
    name: string;
    category: string;
    retentionDays?: number | null;
    action: RetentionAction;
    classification?: "NORMAL" | "CONFIDENTIAL" | "RESTRICTED" | "SECRET" | null;
    isActive: boolean;
  },
  actorId: string,
  ipAddress?: string,
) {
  if (input.retentionDays !== undefined && input.retentionDays !== null) {
    if (!Number.isSafeInteger(input.retentionDays) || input.retentionDays < 0) {
      throw new AppError(400, "Retention days must be a non-negative integer or null.");
    }

  }
  return prisma.$transaction(async (tx) => {
    const policy = await tx.retentionPolicy.upsert({
      where: { name: input.name },
      update: {
        category: input.category,
        retentionDays: input.retentionDays,
        action: input.action,
        classification: input.classification,
        isActive: input.isActive,
      },
      create: {
        name: input.name,
        category: input.category,
        retentionDays: input.retentionDays,
        action: input.action,
        classification: input.classification,
        isActive: input.isActive,
        createdById: actorId,
      },
    });
    await writeAudit(tx, {
      actorId,
      action: "retention_policy.configured",
      entity: "RetentionPolicy",
      entityId: policy.id,
      ipAddress,
      metadata: {
        category: policy.category,
        retentionDays: policy.retentionDays,
        action: policy.action,
        isActive: policy.isActive,
      },
    });
    return policy;
  });
}

export async function listRetentionPolicies() {
  return prisma.retentionPolicy.findMany({ orderBy: { name: "asc" } });
}

export async function listNotifications(actor: Actor & { role?: string }) {
  const where: Prisma.NotificationWhereInput =
    actor.role === "ADMIN"
      ? {}
      : actor.departmentId
        ? { correspondence: { departmentId: actor.departmentId } }
        : { userId: actor.id };
  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      correspondenceId: true,
      kind: true,
      message: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function markNotificationRead(id: string, userId: string) {
  const notification = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (notification.count === 0) {
    const exists = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) throw new AppError(404, "Notification was not found.");
  }
  return { id, read: true };
}

export async function requireVisibleCorrespondence(
  id: string,
  actor: Actor & { departmentId?: string | null },
) {
  return getCorrespondence(id, actor.id, actor.permissions, actor.departmentId);
}

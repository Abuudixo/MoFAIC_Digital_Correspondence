import { ActionStatus, CorrespondenceStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { readableWhere } from "./correspondence-service";
import { writeAudit } from "./audit-service";
import { requireVisibleCorrespondence } from "./workflow-service";

type Actor = {
  id: string;
  permissions: string[];
  departmentId?: string | null;
};

export async function listActionItems(actor: Actor, correspondenceId?: string) {
  return prisma.actionItem.findMany({
    where: {
      ...(correspondenceId ? { correspondenceId } : {}),
      correspondence: {
        archivedAt: null,
        AND: [readableWhere(actor.id, actor.permissions, actor.departmentId)],
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 500,
    include: {
      department: { select: { id: true, name: true, code: true } },
      assignedTo: { select: { id: true, name: true } },
      correspondence: {
        select: {
          id: true,
          referenceNumber: true,
          subject: true,
          status: true,
          departmentId: true,
        },
      },
      evidenceDocuments: {
        select: { id: true, originalFileName: true, version: true },
      },
    },
  });
}

export async function createActionItem(
  correspondenceId: string,
  input: {
    departmentId: string;
    assignedToId?: string | null;
    dueDate: Date;
    requiredAction: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    remarks?: string;
  },
  actor: Actor,
  ipAddress?: string,
) {
  const correspondence = await requireVisibleCorrespondence(
    correspondenceId,
    actor,
  );
  if (
    correspondence.status === CorrespondenceStatus.CLOSED ||
    correspondence.status === CorrespondenceStatus.ARCHIVED
  ) {
    throw new AppError(
      409,
      "Actions cannot be added to closed or archived correspondence.",
    );
  }
  return prisma.$transaction(async (tx) => {
    const department = await tx.department.findFirst({
      where: { id: input.departmentId, isActive: true },
      select: { id: true },
    });
    if (!department)
      throw new AppError(400, "The assigned unit is unavailable.");
    if (input.assignedToId) {
      const assignee = await tx.user.findFirst({
        where: {
          id: input.assignedToId,
          isActive: true,
          departmentId: input.departmentId,
        },
        select: { id: true },
      });
      if (!assignee) {
        throw new AppError(
          400,
          "The assigned person must be active and belong to the assigned unit.",
        );
      }
    }
    const action = await tx.actionItem.create({
      data: {
        correspondenceId,
        departmentId: input.departmentId,
        assignedToId: input.assignedToId,
        dueDate: input.dueDate,
        requiredAction: input.requiredAction,
        priority: input.priority,
        remarks: input.remarks,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "action.created",
      entity: "ActionItem",
      entityId: action.id,
      correspondenceId,
      ipAddress,
      metadata: {
        departmentId: action.departmentId,
        assignedToId: action.assignedToId,
        dueDate: action.dueDate.toISOString(),
        priority: action.priority,
      },
    });
    return action;
  });
}

export async function updateActionItem(
  actionId: string,
  input: {
    assignedToId?: string | null;
    dueDate?: Date;
    status?: ActionStatus;
    remarks?: string | null;
  },
  actor: Actor,
  ipAddress?: string,
) {
  const existing = await prisma.actionItem.findUnique({
    where: { id: actionId },
    include: { correspondence: true },
  });
  if (!existing || existing.correspondence.archivedAt) {
    throw new AppError(404, "Action item was not found.");
  }
  await requireVisibleCorrespondence(existing.correspondenceId, actor);
  if (
    existing.assignedToId !== actor.id &&
    existing.departmentId !== actor.departmentId &&
    !actor.permissions.includes("correspondence:assign")
  ) {
    throw new AppError(403, "You are not responsible for this action item.");
  }
  if (
    input.status &&
    input.status !== existing.status &&
    !actor.permissions.includes("correspondence:action")
  ) {
    throw new AppError(
      403,
      "You do not have permission to update action status.",
    );
  }
  if (input.assignedToId !== undefined) {
    if (!actor.permissions.includes("correspondence:assign")) {
      throw new AppError(
        403,
        "You do not have permission to reassign action items.",
      );
    }
    if (input.assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: input.assignedToId,
          isActive: true,
          departmentId: existing.departmentId,
        },
        select: { id: true },
      });
      if (!assignee) {
        throw new AppError(
          400,
          "The assigned person must be active and belong to the assigned unit.",
        );
      }
    }
  }

  const status = input.status ?? existing.status;
  const completionDate =
    status === ActionStatus.COMPLETED
      ? (existing.completionDate ??
        new Date(new Date().toISOString().slice(0, 10)))
      : null;
  return prisma.$transaction(async (tx) => {
    const action = await tx.actionItem.update({
      where: { id: actionId },
      data: {
        ...input,
        completionDate,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "action.updated",
      entity: "ActionItem",
      entityId: action.id,
      correspondenceId: action.correspondenceId,
      ipAddress,
      metadata: {
        before: {
          status: existing.status,
          assignedToId: existing.assignedToId,
          dueDate: existing.dueDate.toISOString(),
        },
        after: {
          status: action.status,
          assignedToId: action.assignedToId,
          dueDate: action.dueDate.toISOString(),
        },
        remarksChanged: input.remarks !== undefined,
      },
    });
    return action;
  });
}

export async function actionReport(actor: Actor, departmentId?: string) {
  const where: Prisma.ActionItemWhereInput = {
    correspondence: {
      archivedAt: null,
      AND: [
        readableWhere(actor.id, actor.permissions, actor.departmentId),
        ...(departmentId ? [{ departmentId }] : []),
      ],
    },
  };
  const now = new Date();
  const today = new Date(now.toISOString().slice(0, 10));
  const [total, grouped, overdue, byDepartment] = await Promise.all([
    prisma.actionItem.count({ where }),
    prisma.actionItem.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.actionItem.count({
      where: {
        ...where,
        dueDate: { lt: today },
        status: { not: ActionStatus.COMPLETED },
      },
    }),
    prisma.actionItem.groupBy({
      by: ["departmentId", "status"],
      where,
      _count: { _all: true },
    }),
  ]);
  return {
    total,
    overdue,
    byStatus: grouped.map(({ status, _count }) => ({
      status,
      count: _count._all,
    })),
    byDepartment: byDepartment.map(({ departmentId, status, _count }) => ({
      departmentId,
      status,
      count: _count._all,
    })),
  };
}

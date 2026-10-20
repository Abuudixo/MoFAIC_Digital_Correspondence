import {
  ConfidentialityLevel,
  CorrespondenceDirection,
  CorrespondenceStatus,
  CorrespondenceType,
  Priority,
  Prisma,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { writeAudit } from "./audit-service";

export function formatReferenceNumber(year: number, sequence: number): string {
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    !Number.isInteger(sequence) ||
    sequence < 1
  ) {
    throw new RangeError(
      "Reference year and sequence must be positive integers.",
    );
  }
  return `COR-${year}-${String(sequence).padStart(4, "0")}`;
}

export function dueStatus(
  record: { dueDate: Date | null; status: CorrespondenceStatus },
  now = new Date(),
) {
  if (
    record.status === CorrespondenceStatus.CLOSED ||
    record.status === CorrespondenceStatus.ARCHIVED
  ) {
    return "CLOSED";
  }
  if (!record.dueDate) return "NO DUE DATE";
  const today = new Date(now.toISOString().slice(0, 10));
  return record.dueDate < today ? "OVERDUE" : "ON TRACK";
}

export function readableWhere(
  userId: string,
  permissions: string[],
  departmentId?: string | null,
): Prisma.CorrespondenceWhereInput {
  const classification: Prisma.CorrespondenceWhereInput[] = [
    { confidentiality: ConfidentialityLevel.NORMAL },
  ];
  const visibility: Prisma.CorrespondenceWhereInput[] = [];
  if (permissions.includes("correspondence:read:confidential")) {
    const confidentialScope = {
      confidentiality: ConfidentialityLevel.CONFIDENTIAL,
    };
    classification.push(confidentialScope);
  }
  if (permissions.includes("correspondence:read:restricted")) {
    const restrictedScope = {
      confidentiality: ConfidentialityLevel.RESTRICTED,
    };
    classification.push(restrictedScope);
  }
  if (permissions.includes("correspondence:read:secret")) {
    const secretScope = { confidentiality: ConfidentialityLevel.SECRET };
    classification.push(secretScope);
  }
  if (permissions.includes("correspondence:read:any")) {
    return { OR: classification };
  }
  visibility.push({ createdById: userId }, { assignedToId: userId });
  if (departmentId && permissions.includes("correspondence:read:department")) {
    visibility.push({ departmentId, OR: classification });
  }
  return {
    AND: [{ OR: classification }, { OR: visibility }],
  };
}

export function canRead(
  record: {
    confidentiality: ConfidentialityLevel;
    createdById: string;
    assignedToId: string | null;
    departmentId: string;
  },
  userId: string,
  permissions: string[],
  actorDepartmentId?: string | null,
) {
  if (
    record.confidentiality === ConfidentialityLevel.CONFIDENTIAL &&
    !permissions.includes("correspondence:read:confidential")
  ) {
    return false;
  }
  if (
    record.confidentiality === ConfidentialityLevel.RESTRICTED &&
    !permissions.includes("correspondence:read:restricted")
  ) {
    return false;
  }
  if (
    record.confidentiality === ConfidentialityLevel.SECRET &&
    !permissions.includes("correspondence:read:secret")
  ) {
    return false;
  }
  if (record.createdById === userId || record.assignedToId === userId)
    return true;
  if (permissions.includes("correspondence:read:any")) return true;
  if (
    Boolean(actorDepartmentId) &&
    actorDepartmentId === record.departmentId &&
    permissions.includes("correspondence:read:department")
  ) {
    return true;
  }
  return false;
}

function detailInclude() {
  return {
    department: { select: { id: true, name: true, code: true } },
    createdBy: { select: { id: true, name: true, email: true } },
    assignedTo: { select: { id: true, name: true, email: true } },
    workflows: {
      orderBy: { createdAt: "desc" as const },
      include: { actor: { select: { id: true, name: true } } },
    },
    documents: {
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        checksum: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" as const },
    },
    actionItems: {
      orderBy: { dueDate: "asc" as const },
      include: {
        department: { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, name: true } },
        evidenceDocuments: {
          select: { id: true, originalFileName: true, version: true },
        },
      },
    },
  };
}

function serializeDocumentSizes<
  T extends { documents: { fileSize: bigint }[] },
>(record: T) {
  return {
    ...record,
    documents: record.documents.map((document) => ({
      ...document,
      fileSize: document.fileSize.toString(),
    })),
  };
}

export async function createCorrespondence(
  input: Omit<
    Prisma.CorrespondenceUncheckedCreateInput,
    "createdById" | "referenceNumber"
  >,
  actorId: string,
  permissions: string[],
  actorDepartmentId?: string | null,
  ipAddress?: string,
) {
  if (
    input.confidentiality === ConfidentialityLevel.CONFIDENTIAL &&
    !permissions.includes("correspondence:read:confidential")
  ) {
    throw new AppError(
      403,
      "You cannot register correspondence at this classification.",
    );
  }
  if (
    input.confidentiality === ConfidentialityLevel.RESTRICTED &&
    !permissions.includes("correspondence:read:restricted")
  ) {
    throw new AppError(
      403,
      "You cannot register correspondence at this classification.",
    );
  }
  if (
    input.confidentiality === ConfidentialityLevel.SECRET &&
    !permissions.includes("correspondence:read:secret")
  ) {
    throw new AppError(
      403,
      "You cannot register correspondence at this classification.",
    );
  }
  if (
    input.departmentId !== actorDepartmentId &&
    !permissions.includes("departments:manage")
  ) {
    throw new AppError(
      403,
      "You can only register correspondence for your own department.",
    );
  }
  const year = new Date().getUTCFullYear();
  return prisma.$transaction(async (tx) => {
    const department = await tx.department.findUnique({
      where: { id: input.departmentId },
      select: { id: true, isActive: true },
    });
    if (!department?.isActive)
      throw new AppError(400, "The selected department is unavailable.");

    if (input.assignedToId) {
      const assignee = await tx.user.findUnique({
        where: { id: input.assignedToId },
        select: { id: true, isActive: true },
      });
      if (!assignee?.isActive)
        throw new AppError(400, "The selected assignee is unavailable.");
    }

    const counter = await tx.referenceSequence.upsert({
      where: { year },
      create: { year, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true },
    });
    const referenceNumber = formatReferenceNumber(year, counter.lastValue);
    const correspondence = await tx.correspondence.create({
      data: {
        ...input,
        referenceNumber,
        createdById: actorId,
      },
      include: detailInclude(),
    });

    await tx.workflow.create({
      data: {
        correspondenceId: correspondence.id,
        actorId,
        toStatus: correspondence.status,
        note: "Correspondence registered",
      },
    });
    await writeAudit(tx, {
      actorId,
      action: "correspondence.registered",
      entity: "Correspondence",
      entityId: correspondence.id,
      correspondenceId: correspondence.id,
      ipAddress,
      metadata: { referenceNumber, status: correspondence.status },
    });
    const created = await tx.correspondence.findUniqueOrThrow({
      where: { id: correspondence.id },
      include: detailInclude(),
    });
    return serializeDocumentSizes(created);
  });
}

export async function listCorrespondence(
  input: {
    page: number;
    limit: number;
    sortBy:
      | "createdAt"
      | "updatedAt"
      | "referenceNumber"
      | "subject"
      | "dueDate"
      | "dateReceived";
    sortOrder: "asc" | "desc";
    referenceNumber?: string;
    subject?: string;
    sender?: string;
    recipient?: string;
    departmentId?: string;
    countryMission?: string;
    organization?: string;
    search?: string;
    direction?: CorrespondenceDirection;
    type?: CorrespondenceType;
    priority?: Priority;
    confidentiality?: ConfidentialityLevel;
    status?: CorrespondenceStatus;
    assignedToId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    includeArchived: boolean;
  },
  userId: string,
  permissions: string[],
  userDepartmentId?: string | null,
) {
  if (
    input.includeArchived &&
    !permissions.includes("correspondence:read:archive")
  ) {
    throw new AppError(
      403,
      "You do not have permission to search archived correspondence.",
    );
  }
  const matchingIds = input.search
    ? await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT "id" FROM "correspondence"
          WHERE to_tsvector(
            'simple',
            coalesce("reference_number", '') || ' ' ||
            coalesce("subject", '') || ' ' ||
            coalesce("sender", '') || ' ' ||
            coalesce("recipient", '') || ' ' ||
            coalesce("country_mission", '') || ' ' ||
            coalesce("organization", '') || ' ' ||
            coalesce("current_action_location", '')
          )
          @@ plainto_tsquery('simple', ${input.search})
          LIMIT 10000`,
      )
    : undefined;
  const filters: Prisma.CorrespondenceWhereInput = {
    archivedAt: input.includeArchived ? { not: null } : null,
    AND: [
      readableWhere(userId, permissions, userDepartmentId),
      ...(matchingIds ? [{ id: { in: matchingIds.map(({ id }) => id) } }] : []),
      ...(input.referenceNumber
        ? [
            {
              referenceNumber: {
                contains: input.referenceNumber,
                mode: "insensitive" as const,
              },
            },
          ]
        : []),
      ...(input.subject
        ? [
            {
              subject: {
                contains: input.subject,
                mode: "insensitive" as const,
              },
            },
          ]
        : []),
      ...(input.sender
        ? [{ sender: { contains: input.sender, mode: "insensitive" as const } }]
        : []),
      ...(input.recipient
        ? [
            {
              recipient: {
                contains: input.recipient,
                mode: "insensitive" as const,
              },
            },
          ]
        : []),
      ...(input.countryMission
        ? [
            {
              countryMission: {
                contains: input.countryMission,
                mode: "insensitive" as const,
              },
            },
          ]
        : []),
      ...(input.organization
        ? [
            {
              organization: {
                contains: input.organization,
                mode: "insensitive" as const,
              },
            },
          ]
        : []),
      ...(input.departmentId ? [{ departmentId: input.departmentId }] : []),
      ...(input.direction ? [{ direction: input.direction }] : []),
      ...(input.type ? [{ type: input.type }] : []),
      ...(input.priority ? [{ priority: input.priority }] : []),
      ...(input.confidentiality
        ? [{ confidentiality: input.confidentiality }]
        : []),
      ...(input.status ? [{ status: input.status }] : []),
      ...(input.assignedToId ? [{ assignedToId: input.assignedToId }] : []),
      ...(input.dateFrom || input.dateTo
        ? [
            {
              OR: [
                {
                  dateReceived: {
                    ...(input.dateFrom ? { gte: input.dateFrom } : {}),
                    ...(input.dateTo ? { lte: input.dateTo } : {}),
                  },
                },
                {
                  dateSent: {
                    ...(input.dateFrom ? { gte: input.dateFrom } : {}),
                    ...(input.dateTo ? { lte: input.dateTo } : {}),
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };

  const [items, total] = await prisma.$transaction([
    prisma.correspondence.findMany({
      where: filters,
      orderBy: { [input.sortBy]: input.sortOrder },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      include: {
        department: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.correspondence.count({ where: filters }),
  ]);

  return {
    items: items.map((item) => ({ ...item, dueStatus: dueStatus(item) })),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

export async function getCorrespondence(
  id: string,
  userId: string,
  permissions: string[],
  userDepartmentId?: string | null,
) {
  const record = await prisma.correspondence.findUnique({
    where: { id },
    include: detailInclude(),
  });
  if (!record || record.archivedAt)
    throw new AppError(404, "Correspondence was not found.");
  if (!canRead(record, userId, permissions, userDepartmentId))
    throw new AppError(403, "You cannot access this correspondence.");
  return serializeDocumentSizes(record);
}

export async function getArchivedCorrespondence(
  id: string,
  userId: string,
  permissions: string[],
  userDepartmentId?: string | null,
) {
  if (!permissions.includes("correspondence:read:archive")) {
    throw new AppError(
      403,
      "You do not have permission to retrieve archived correspondence.",
    );
  }
  const record = await prisma.correspondence.findUnique({
    where: { id },
    include: {
      ...detailInclude(),
      archivedBy: { select: { id: true, name: true } },
    },
  });
  if (!record || !record.archivedAt)
    throw new AppError(404, "Archived correspondence was not found.");
  if (!canRead(record, userId, permissions, userDepartmentId)) {
    throw new AppError(403, "You cannot access this correspondence.");
  }
  return serializeDocumentSizes(record);
}

export async function updateCorrespondence(
  id: string,
  data: Prisma.CorrespondenceUncheckedUpdateInput,
  userId: string,
  permissions: string[],
  actorDepartmentId?: string | null,
  ipAddress?: string,
) {
  if ("status" in data || "departmentId" in data || "assignedToId" in data) {
    throw new AppError(
      400,
      "Use the dedicated workflow and assignment actions to change status or assignment.",
    );
  }
  const existing = await prisma.correspondence.findUnique({ where: { id } });
  if (!existing || existing.archivedAt)
    throw new AppError(404, "Correspondence was not found.");
  if (!canRead(existing, userId, permissions, actorDepartmentId))
    throw new AppError(403, "You cannot access this correspondence.");
  if (
    data.confidentiality &&
    data.confidentiality !== existing.confidentiality &&
    !permissions.includes("correspondence:classify")
  ) {
    throw new AppError(
      403,
      "You do not have permission to change correspondence classification.",
    );
  }

  return prisma.$transaction(async (tx) => {
    if (typeof data.departmentId === "string") {
      const department = await tx.department.findUnique({
        where: { id: data.departmentId },
        select: { id: true, isActive: true },
      });
      if (!department?.isActive)
        throw new AppError(400, "The selected department is unavailable.");
    }

    if (typeof data.assignedToId === "string") {
      const assignee = await tx.user.findUnique({
        where: { id: data.assignedToId },
        select: { id: true, isActive: true },
      });
      if (!assignee?.isActive)
        throw new AppError(400, "The selected assignee is unavailable.");
    }

    const updated = await tx.correspondence.update({
      where: { id },
      data,
      include: detailInclude(),
    });
    await writeAudit(tx, {
      actorId: userId,
      action: "correspondence.updated",
      entity: "Correspondence",
      entityId: id,
      correspondenceId: id,
      ipAddress,
      metadata: { changedFields: Object.keys(data) },
    });
    return updated;
  });
}

export async function archiveCorrespondence(
  id: string,
  retentionCategory: string,
  userId: string,
  permissions: string[],
  userDepartmentId?: string | null,
  ipAddress?: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.correspondence.findUnique({ where: { id } });
    if (!existing || existing.archivedAt)
      throw new AppError(404, "Correspondence was not found.");
    if (!canRead(existing, userId, permissions, userDepartmentId)) {
      throw new AppError(403, "You cannot access this correspondence.");
    }
    if (existing.status !== CorrespondenceStatus.CLOSED) {
      throw new AppError(409, "Only closed correspondence can be archived.");
    }
    const policy = await tx.retentionPolicy.findFirst({
      where: { category: retentionCategory, isActive: true },
      orderBy: { retentionDays: "asc" },
    });
    if (!policy) {
      throw new AppError(
        400,
        "An authorized administrator must configure an active retention policy for this category before archiving.",
      );
    }
    const archived = await tx.correspondence.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archivedById: userId,
        retentionCategory: policy.category,
        status: CorrespondenceStatus.ARCHIVED,
      },
      select: {
        id: true,
        referenceNumber: true,
        archivedAt: true,
        status: true,
      },
    });
    await tx.workflowAction.create({
      data: {
        correspondenceId: id,
        actorId: userId,
        fromStatus: existing.status,
        toStatus: CorrespondenceStatus.ARCHIVED,
        comment: `Correspondence archived under the "${policy.category}" retention category`,
        ipAddress,
      },
    });
    await writeAudit(tx, {
      actorId: userId,
      action: "correspondence.archived",
      entity: "Correspondence",
      entityId: id,
      correspondenceId: id,
      ipAddress,
      metadata: {
        referenceNumber: existing.referenceNumber,
        retentionCategory: policy.category,
        retentionPolicy: policy.name,
        retentionDays: policy.retentionDays,
        retentionAction: policy.action,
      },
    });
    return archived;
  });
}

export async function getCorrespondenceAudit(
  id: string,
  userId: string,
  permissions: string[],
  userDepartmentId?: string | null,
) {
  const record = await prisma.correspondence.findUnique({
    where: { id },
    select: {
      id: true,
      createdById: true,
      assignedToId: true,
      confidentiality: true,
      departmentId: true,
      archivedAt: true,
    },
  });
  if (!record) throw new AppError(404, "Correspondence was not found.");
  if (
    record.archivedAt &&
    !permissions.includes("correspondence:read:archive")
  ) {
    throw new AppError(403, "You cannot access archived audit history.");
  }
  if (
    !permissions.includes("audit:read") ||
    !canRead(record, userId, permissions, userDepartmentId)
  ) {
    throw new AppError(403, "You cannot access this audit history.");
  }
  return prisma.auditLog.findMany({
    where: { correspondenceId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
    },
  });
}

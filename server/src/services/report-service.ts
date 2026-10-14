import {
  ActionStatus,
  CorrespondenceStatus,
  NotificationKind,
  Prisma,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { readableWhere } from "./correspondence-service";

export function isOverdue(
  record: { dueDate: Date | null; status: CorrespondenceStatus },
  now: Date,
) {
  const today = new Date(now.toISOString().slice(0, 10));
  return Boolean(
    record.dueDate &&
    record.dueDate.getTime() < today.getTime() &&
    record.status !== CorrespondenceStatus.CLOSED &&
    record.status !== CorrespondenceStatus.ARCHIVED,
  );
}

type ReportFilters = {
  departmentId?: string;
  departmentDashboard: boolean;
  countryMission?: string;
  organization?: string;
  direction?: "INCOMING" | "OUTGOING" | "INTERNAL" | "EXTERNAL_DRAFT";
  type?:
    | "LETTER"
    | "MEMORANDUM"
    | "NOTE_VERBALE"
    | "EMAIL"
    | "DIRECTIVE"
    | "REPORT"
    | "INVITATION"
    | "AGREEMENT"
    | "OTHER";
  dateFrom?: Date;
  dateTo?: Date;
  includeArchived: boolean;
};

function reportWhere(
  filters: ReportFilters,
  userId: string,
  permissions: string[],
  departmentId?: string | null,
): Prisma.CorrespondenceWhereInput {
  if (
    filters.includeArchived &&
    !permissions.includes("correspondence:read:archive")
  ) {
    throw new AppError(
      403,
      "You do not have permission to include archived records in reports.",
    );
  }
  return {
    archivedAt: filters.includeArchived ? undefined : null,
    AND: [
      readableWhere(userId, permissions, departmentId),
      ...(filters.departmentId ? [{ departmentId: filters.departmentId }] : []),
      ...(filters.countryMission
        ? [
            {
              countryMission: {
                contains: filters.countryMission,
                mode: "insensitive" as const,
              },
            },
          ]
        : []),
      ...(filters.organization
        ? [
            {
              organization: {
                contains: filters.organization,
                mode: "insensitive" as const,
              },
            },
          ]
        : []),
      ...(filters.direction ? [{ direction: filters.direction }] : []),
      ...(filters.type ? [{ type: filters.type }] : []),
      ...(filters.dateFrom || filters.dateTo
        ? [
            {
              createdAt: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            },
          ]
        : []),
    ],
  };
}

export async function getManagementReport(
  filters: ReportFilters,
  actor: { id: string; permissions: string[]; departmentId?: string | null },
) {
  const where = reportWhere(
    filters,
    actor.id,
    actor.permissions,
    actor.departmentId,
  );
  const now = new Date();
  const terminalStatuses = [
    CorrespondenceStatus.CLOSED,
    CorrespondenceStatus.ARCHIVED,
  ];
  const today = new Date(now.toISOString().slice(0, 10));
  const nextWeek = new Date(today);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const includeDepartmentDashboard =
    filters.departmentDashboard && Boolean(filters.departmentId);
  const [
    total,
    byStatus,
    overdue,
    byDepartment,
    byCountryMission,
    byDirection,
    byType,
    byDay,
    byClassification,
    openActions,
    overdueActions,
    dueThisWeek,
    closedThisMonth,
    byOfficer,
    ageBuckets,
  ] = await Promise.all([
    prisma.correspondence.count({ where }),
    prisma.correspondence.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.correspondence.count({
      where: {
        AND: [
          where,
          {
            dueDate: { lt: today },
            status: { notIn: terminalStatuses },
          },
        ],
      },
    }),
    prisma.correspondence.groupBy({
      by: ["departmentId"],
      where,
      _count: { _all: true },
    }),
    prisma.correspondence.groupBy({
      by: ["countryMission"],
      where,
      _count: { _all: true },
    }),
    prisma.correspondence.groupBy({
      by: ["direction"],
      where,
      _count: { _all: true },
    }),
    prisma.correspondence.groupBy({
      by: ["type"],
      where,
      _count: { _all: true },
    }),
    prisma.correspondence.groupBy({
      by: ["createdAt"],
      where,
      _count: { _all: true },
    }),
    prisma.correspondence.groupBy({
      by: ["confidentiality"],
      where,
      _count: { _all: true },
    }),
    prisma.actionItem.count({
      where: {
        status: { not: ActionStatus.COMPLETED },
        correspondence: { archivedAt: null, AND: [where] },
      },
    }),
    prisma.actionItem.count({
      where: {
        dueDate: { lt: today },
        status: { not: ActionStatus.COMPLETED },
        correspondence: { archivedAt: null, AND: [where] },
      },
    }),
    includeDepartmentDashboard
      ? prisma.correspondence.count({
          where: {
            AND: [
              where,
              {
                dueDate: { gte: today, lte: nextWeek },
                status: { notIn: terminalStatuses },
              },
            ],
          },
        })
      : Promise.resolve(0),
    includeDepartmentDashboard
      ? prisma.correspondence.count({
          where: {
            AND: [
              where,
              {
                status: CorrespondenceStatus.CLOSED,
                dateClosed: { gte: monthStart },
              },
            ],
          },
        })
      : Promise.resolve(0),
    includeDepartmentDashboard
      ? prisma.correspondence.groupBy({
          by: ["assignedToId"],
          where: {
            AND: [where, { status: { notIn: terminalStatuses } }],
          },
          _count: { _all: true },
        })
      : Promise.resolve(
          [] as {
            assignedToId: string | null;
            _count: { _all: number };
          }[],
        ),
    includeDepartmentDashboard
      ? Promise.all([
          prisma.correspondence.count({
            where: {
              AND: [
                where,
                {
                  status: { notIn: terminalStatuses },
                  createdAt: {
                    gte: new Date(today.getTime() - 7 * 86_400_000),
                  },
                },
              ],
            },
          }),
          prisma.correspondence.count({
            where: {
              AND: [
                where,
                {
                  status: { notIn: terminalStatuses },
                  createdAt: {
                    gte: new Date(today.getTime() - 14 * 86_400_000),
                    lt: new Date(today.getTime() - 7 * 86_400_000),
                  },
                },
              ],
            },
          }),
          prisma.correspondence.count({
            where: {
              AND: [
                where,
                {
                  status: { notIn: terminalStatuses },
                  createdAt: {
                    gte: new Date(today.getTime() - 30 * 86_400_000),
                    lt: new Date(today.getTime() - 14 * 86_400_000),
                  },
                },
              ],
            },
          }),
          prisma.correspondence.count({
            where: {
              AND: [
                where,
                {
                  status: { notIn: terminalStatuses },
                  createdAt: {
                    lt: new Date(today.getTime() - 30 * 86_400_000),
                  },
                },
              ],
            },
          }),
        ])
      : Promise.resolve([0, 0, 0, 0]),
  ]);

  const departmentIds = byDepartment.map(({ departmentId }) => departmentId);
  const departments = departmentIds.length
    ? await prisma.department.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const departmentNames = new Map(
    departments.map((department) => [department.id, department]),
  );
  const officerIds = byOfficer
    .map(({ assignedToId }) => assignedToId)
    .filter((id): id is string => id !== null);
  const officers =
    includeDepartmentDashboard && officerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: officerIds } },
          select: { id: true, name: true },
        })
      : [];
  const officerNames = new Map(
    officers.map((officer) => [officer.id, officer.name]),
  );
  const monthlyVolume = new Map<string, number>();
  for (const day of byDay) {
    const month = day.createdAt.toISOString().slice(0, 7);
    monthlyVolume.set(month, (monthlyVolume.get(month) ?? 0) + day._count._all);
  }
  const statusCounts = new Map(
    byStatus.map(({ status, _count }) => [status, _count._all]),
  );
  const count = (status: CorrespondenceStatus) => statusCounts.get(status) ?? 0;

  return {
    totals: {
      total,
      open: count(CorrespondenceStatus.OPEN),
      inProgress: count(CorrespondenceStatus.IN_PROGRESS),
      pendingApproval: count(CorrespondenceStatus.PENDING_APPROVAL),
      approved: count(CorrespondenceStatus.APPROVED),
      pending:
        total -
        count(CorrespondenceStatus.CLOSED) -
        count(CorrespondenceStatus.ARCHIVED),
      overdue,
      dueThisWeek,
      closedThisMonth,
      dispatched: count(CorrespondenceStatus.DISPATCHED),
      closed: count(CorrespondenceStatus.CLOSED),
      archived: count(CorrespondenceStatus.ARCHIVED),
      incoming:
        byDirection.find(({ direction }) => direction === "INCOMING")?._count
          ._all ?? 0,
      outgoing:
        byDirection.find(({ direction }) => direction === "OUTGOING")?._count
          ._all ?? 0,
      actions: openActions,
      overdueActions,
    },
    groups: {
      byDepartment: byDepartment.map(({ departmentId, _count }) => ({
        departmentId,
        department: departmentNames.get(departmentId),
        count: _count._all,
      })),
      byCountryMission: byCountryMission.map(({ countryMission, _count }) => ({
        countryMission,
        count: _count._all,
      })),
      byDirection: byDirection.map(({ direction, _count }) => ({
        direction,
        count: _count._all,
      })),
      byType: byType.map(({ type, _count }) => ({ type, count: _count._all })),
      byClassification: byClassification.map(({ confidentiality, _count }) => ({
        classification: confidentiality,
        count: _count._all,
      })),
      byMonth: [...monthlyVolume]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([month, volume]) => ({ month, volume })),
      byOfficer: byOfficer
        .map(({ assignedToId, _count }) => ({
          officerId: assignedToId,
          officerName: assignedToId
            ? (officerNames.get(assignedToId) ?? "Unassigned")
            : "Unassigned",
          count: _count._all,
        }))
        .sort((left, right) => right.count - left.count),
      byAge: ageBuckets.map((count, index) => ({
        range: ["0–7 days", "8–14 days", "15–30 days", "Over 30 days"][index],
        count,
      })),
    },
  };
}

export async function overdueReport(
  actor: { id: string; permissions: string[]; departmentId?: string | null },
  departmentId?: string,
) {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const where: Prisma.CorrespondenceWhereInput = {
    archivedAt: null,
    dueDate: { lt: today },
    status: {
      notIn: [CorrespondenceStatus.CLOSED, CorrespondenceStatus.ARCHIVED],
    },
    AND: [
      readableWhere(actor.id, actor.permissions, actor.departmentId),
      ...(departmentId ? [{ departmentId }] : []),
    ],
  };
  const items = await prisma.correspondence.findMany({
    where,
    orderBy: { dueDate: "asc" },
    take: 1000,
    select: {
      id: true,
      referenceNumber: true,
      dueDate: true,
      status: true,
      assignedToId: true,
      createdById: true,
    },
  });

  await prisma.$transaction(
    items.map((item) => {
      const userId = item.assignedToId ?? item.createdById;
      const dedupeKey = `overdue:${item.id}:${item.dueDate?.toISOString().slice(0, 10)}`;
      return prisma.notification.upsert({
        where: { dedupeKey },
        update: {},
        create: {
          userId,
          correspondenceId: item.id,
          kind: NotificationKind.OVERDUE,
          message: "A correspondence item is past its due date.",
          dedupeKey,
        },
      });
    }),
  );

  return items.map(({ id, referenceNumber, dueDate, status }) => ({
    id,
    referenceNumber,
    dueDate,
    status,
  }));
}

export async function retentionReviewCandidates(actor: {
  id: string;
  permissions: string[];
  departmentId?: string | null;
}) {
  if (!actor.permissions.includes("correspondence:read:archive")) {
    throw new AppError(
      403,
      "You do not have permission to review archived records.",
    );
  }
  const policies = await prisma.retentionPolicy.findMany({
    where: { isActive: true, retentionDays: { not: null } },
  });
  const now = new Date();
  const candidates = await Promise.all(
    policies.map(async (policy) => {
      const cutoff = new Date(
        now.getTime() - (policy.retentionDays ?? 0) * 86_400_000,
      );
      const where: Prisma.CorrespondenceWhereInput = {
        archivedAt: { lte: cutoff },
        retentionCategory: policy.category,
        ...(policy.classification
          ? { confidentiality: policy.classification }
          : {}),
        AND: [readableWhere(actor.id, actor.permissions, actor.departmentId)],
      };
      const records = await prisma.correspondence.findMany({
        where,
        orderBy: { archivedAt: "asc" },
        take: 500,
        select: {
          id: true,
          referenceNumber: true,
          archivedAt: true,
          retentionCategory: true,
          confidentiality: true,
        },
      });
      return records.map((record) => ({
        ...record,
        policy: policy.name,
        action: policy.action,
        retentionDays: policy.retentionDays,
      }));
    }),
  );
  return candidates.flat();
}

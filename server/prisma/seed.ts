import {
  CorrespondenceDirection,
  CorrespondenceStatus,
  CorrespondenceType,
  NotificationKind,
  Priority,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { env } from "../src/config/env";
import { prisma } from "../src/config/prisma";

const permissions = [
  "users:manage",
  "departments:manage",
  "correspondence:create",
  "correspondence:create:any",
  "correspondence:read:any",
  "correspondence:read:department",
  "correspondence:read:assigned",
  "correspondence:read:confidential",
  "correspondence:read:restricted",
  "correspondence:read:secret",
  "correspondence:update",
  "correspondence:classify",
  "correspondence:archive",
  "audit:read",
  "correspondence:assign",
  "correspondence:assign:any",
  "correspondence:action",
  "correspondence:review",
  "correspondence:approve",
  "correspondence:dispatch",
  "correspondence:close",
  "correspondence:read:archive",
  "documents:upload",
  "documents:read",
  "workflow:manage",
  "retention:manage",
  "reports:read",
];

async function main() {
  const permissionsByName = new Map<string, string>();
  for (const name of permissions) {
    const permission = await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name, description: `Allows ${name.replaceAll(":", " ")}` },
      select: { id: true, name: true },
    });
    permissionsByName.set(permission.name, permission.id);
  }

  const roles: Record<string, string[]> = {
    ADMIN: [
      "users:manage",
      "departments:manage",
      "correspondence:create",
      "audit:read",
      "workflow:manage",
      "retention:manage",
      "reports:read",
    ],
    PERMANENT_SECRETARY: [
      "correspondence:create",
      "correspondence:create:any",
      "correspondence:read:any",
      "correspondence:update",
      "correspondence:assign",
      "correspondence:assign:any",
      "correspondence:action",
      "correspondence:review",
      "audit:read",
      "documents:upload",
      "documents:read",
      "reports:read",
    ],
    DEPARTMENT_HEAD: [
      "correspondence:read:department",
      "correspondence:create",
      "correspondence:update",
      "correspondence:assign",
      "correspondence:action",
      "correspondence:review",
      "audit:read",
      "documents:upload",
      "documents:read",
      "reports:read",
    ],
    STAFF: [
      "correspondence:create",
      "correspondence:read:assigned",
      "correspondence:update",
      "correspondence:action",
      "correspondence:review",
      "documents:upload",
      "documents:read",
      "reports:read",
    ],
  };

  for (const [name, permissionNames] of Object.entries(roles)) {
    const connect = permissionNames.map((permission) => {
      const id = permissionsByName.get(permission);
      if (!id) throw new Error(`Missing permission seed: ${permission}`);
      return { id };
    });
    await prisma.role.upsert({
      where: { name },
      update: { permissions: { set: connect } },
      create: { name, description: `${name} role`, permissions: { connect } },
    });
  }

  const departments = [
    ["Office of the Permanent Secretary", "OPSPS"],
    ["Protocol", "PROTOCOL"],
    ["Political Affairs", "POLAFF"],
    ["International Cooperation", "INTCOOP"],
    ["Regional Cooperation", "REGCOOP"],
    ["EAC", "EAC"],
    ["Consular Affairs", "CONSULAR"],
    ["Diaspora Affairs", "DIASPORA"],
    ["Legal Affairs", "LEGAL"],
    ["Diplomatic Institute", "DIPINST"],
    ["Administration & HR", "ADMINHR"],
    ["Finance", "FINANCE"],
    ["ICT & Records", "ICTREC"],
    ["Planning & Policy", "PLANPOL"],
    ["Missions / Embassies", "MISSIONS"],
  ] as const;
  await prisma.department.updateMany({
    where: { code: { notIn: departments.map(([, code]) => code) } },
    data: { isActive: false },
  });
  for (const [name, code] of departments) {
    await prisma.department.upsert({
      where: { code },
      update: { name, isActive: true },
      create: {
        name,
        code,
        description: "Workbook-controlled development unit",
      },
    });
  }

  const defaultWorkflow = await prisma.workflowDefinition.upsert({
    where: { name: "Standard correspondence" },
    update: { isActive: true },
    create: {
      name: "Standard correspondence",
      description:
        "Default development workflow; configure steps to match approved policy.",
      isActive: true,
    },
    select: { id: true },
  });
  const workflowSteps: {
    status: CorrespondenceStatus;
    allowedNextStates: CorrespondenceStatus[];
    requiredRole?: string;
  }[] = [
    {
      status: CorrespondenceStatus.OPEN,
      allowedNextStates: [CorrespondenceStatus.IN_PROGRESS],
    },
    {
      status: CorrespondenceStatus.IN_PROGRESS,
      allowedNextStates: [CorrespondenceStatus.PENDING_APPROVAL],
    },
    {
      status: CorrespondenceStatus.PENDING_APPROVAL,
      allowedNextStates: [
        CorrespondenceStatus.APPROVED,
        CorrespondenceStatus.IN_PROGRESS,
      ],
    },
    {
      status: CorrespondenceStatus.APPROVED,
      allowedNextStates: [CorrespondenceStatus.DISPATCHED],
    },
    {
      status: CorrespondenceStatus.DISPATCHED,
      allowedNextStates: [CorrespondenceStatus.CLOSED],
    },
    {
      status: CorrespondenceStatus.CLOSED,
      allowedNextStates: [],
    },
    { status: CorrespondenceStatus.ARCHIVED, allowedNextStates: [] },
  ];
  const commentRequiredStatuses: CorrespondenceStatus[] = [
    CorrespondenceStatus.PENDING_APPROVAL,
    CorrespondenceStatus.APPROVED,
  ];
  for (const [order, step] of workflowSteps.entries()) {
    await prisma.workflowStep.upsert({
      where: {
        definitionId_status: {
          definitionId: defaultWorkflow.id,
          status: step.status,
        },
      },
      update: {
        order,
        requiredRole: step.requiredRole ?? null,
        allowedNextStates: step.allowedNextStates,
        requiresComment: commentRequiredStatuses.includes(step.status),
      },
      create: {
        definitionId: defaultWorkflow.id,
        order,
        status: step.status,
        requiredRole: step.requiredRole ?? null,
        allowedNextStates: step.allowedNextStates,
        requiresComment: commentRequiredStatuses.includes(step.status),
      },
    });
  }

  const bootstrapName = env.BOOTSTRAP_ADMIN_NAME;
  const bootstrapEmail = env.BOOTSTRAP_ADMIN_EMAIL;
  const bootstrapPassword = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (bootstrapName && bootstrapEmail && bootstrapPassword) {
    const existing = await prisma.user.findUnique({
      where: { email: bootstrapEmail },
      select: { id: true },
    });
    if (!existing) {
      const adminRole = await prisma.role.findUniqueOrThrow({
        where: { name: "ADMIN" },
        select: { id: true },
      });
      const passwordHash = await bcrypt.hash(
        bootstrapPassword,
        env.BCRYPT_ROUNDS,
      );
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: bootstrapName,
            email: bootstrapEmail,
            passwordHash,
            roleId: adminRole.id,
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "user.bootstrap_admin_created",
            entity: "User",
            entityId: user.id,
          },
        });
      });
      console.info("Bootstrap administrator created.");
    } else {
      console.info(
        "Bootstrap administrator already exists; credentials were not changed.",
      );
    }
  }

  if (env.NODE_ENV === "development") {
    const demoPasswordHash = await bcrypt.hash(
      "Demo-Only-2026!",
      env.BCRYPT_ROUNDS,
    );
    const demoUsers = [
      {
        key: "protocol-head",
        name: "Demo Protocol Department Head",
        email: "director.protocol@example.test",
        role: "DEPARTMENT_HEAD",
        departmentCode: "PROTOCOL",
      },
      {
        key: "protocol-officer",
        name: "Demo Protocol Officer",
        email: "officer.protocol@example.test",
        role: "STAFF",
        departmentCode: "PROTOCOL",
      },
      {
        key: "finance-head",
        name: "Demo Finance Department Head",
        email: "director.finance@example.test",
        role: "DEPARTMENT_HEAD",
        departmentCode: "FINANCE",
      },
      {
        key: "finance-officer",
        name: "Demo Finance Officer",
        email: "officer.finance@example.test",
        role: "STAFF",
        departmentCode: "FINANCE",
      },
    ] as const;
    const seededUsers = new Map<
      (typeof demoUsers)[number]["key"],
      { id: string; departmentId: string }
    >();

    for (const demoUser of demoUsers) {
      const [role, department] = await Promise.all([
        prisma.role.findUniqueOrThrow({
          where: { name: demoUser.role },
          select: { id: true },
        }),
        prisma.department.findUniqueOrThrow({
          where: { code: demoUser.departmentCode },
          select: { id: true },
        }),
      ]);
      const user = await prisma.user.upsert({
        where: { email: demoUser.email },
        update: {
          name: demoUser.name,
          passwordHash: demoPasswordHash,
          roleId: role.id,
          departmentId: department.id,
          isActive: true,
        },
        create: {
          name: demoUser.name,
          email: demoUser.email,
          passwordHash: demoPasswordHash,
          roleId: role.id,
          departmentId: department.id,
        },
        select: { id: true },
      });
      seededUsers.set(demoUser.key, { id: user.id, departmentId: department.id });
    }

    const demoCorrespondence = [
      {
        referenceNumber: "DEMO-2026-0001",
        subject: "Regional cooperation meeting invitation",
        sender: "Regional Cooperation Secretariat",
        recipient: "Ministry of Foreign Affairs",
        direction: CorrespondenceDirection.INCOMING,
        type: CorrespondenceType.INVITATION,
        status: CorrespondenceStatus.OPEN,
        priority: Priority.NORMAL,
        creator: "protocol-officer",
        assigned: "protocol-officer",
        notificationRecipient: "protocol-head",
        notificationKind: NotificationKind.ASSIGNMENT,
        notificationMessage:
          "A new meeting invitation is awaiting action in your department.",
        departmentCode: "PROTOCOL",
        daysUntilDue: 5,
      },
      {
        referenceNumber: "DEMO-2026-0002",
        subject: "Draft agenda for bilateral consultations",
        sender: "Protocol Directorate",
        recipient: "Office of the Permanent Secretary",
        direction: CorrespondenceDirection.INTERNAL,
        type: CorrespondenceType.MEMORANDUM,
        status: CorrespondenceStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        creator: "protocol-head",
        assigned: "protocol-officer",
        notificationRecipient: "protocol-officer",
        notificationKind: NotificationKind.WORKFLOW_UPDATE,
        notificationMessage:
          "A bilateral consultations agenda has been assigned for follow-up.",
        departmentCode: "PROTOCOL",
        daysUntilDue: -1,
      },
      {
        referenceNumber: "DEMO-2026-0003",
        subject: "Quarterly mission expenditure summary",
        sender: "Finance Directorate",
        recipient: "Office of the Permanent Secretary",
        direction: CorrespondenceDirection.INTERNAL,
        type: CorrespondenceType.REPORT,
        status: CorrespondenceStatus.PENDING_APPROVAL,
        priority: Priority.URGENT,
        creator: "finance-officer",
        assigned: "finance-head",
        notificationRecipient: "finance-head",
        notificationKind: NotificationKind.APPROVAL_REQUEST,
        notificationMessage:
          "A quarterly expenditure summary is waiting for Department Head review.",
        departmentCode: "FINANCE",
        daysUntilDue: 2,
      },
      {
        referenceNumber: "DEMO-2026-0004",
        subject: "Updated travel claim supporting schedule",
        sender: "Finance Directorate",
        recipient: "Protocol Directorate",
        direction: CorrespondenceDirection.OUTGOING,
        type: CorrespondenceType.LETTER,
        status: CorrespondenceStatus.APPROVED,
        priority: Priority.NORMAL,
        creator: "finance-head",
        assigned: "finance-officer",
        notificationRecipient: "finance-officer",
        notificationKind: NotificationKind.WORKFLOW_UPDATE,
        notificationMessage:
          "The travel claim schedule has been approved and is ready for dispatch.",
        departmentCode: "FINANCE",
        daysUntilDue: 7,
      },
    ] as const;

    for (const item of demoCorrespondence) {
      const department = await prisma.department.findUniqueOrThrow({
        where: { code: item.departmentCode },
        select: { id: true },
      });
      const creator = seededUsers.get(item.creator);
      const assigned = seededUsers.get(item.assigned);
      const notificationRecipient = seededUsers.get(item.notificationRecipient);
      if (!creator || !assigned || !notificationRecipient) {
        throw new Error(`Missing demo user for ${item.referenceNumber}.`);
      }

      const correspondence = await prisma.correspondence.upsert({
        where: { referenceNumber: item.referenceNumber },
        update: {
          subject: item.subject,
          sender: item.sender,
          recipient: item.recipient,
          direction: item.direction,
          type: item.type,
          status: item.status,
          priority: item.priority,
          departmentId: department.id,
          createdById: creator.id,
          assignedToId: assigned.id,
          dueDate: new Date(Date.now() + item.daysUntilDue * 24 * 60 * 60 * 1000),
        },
        create: {
          referenceNumber: item.referenceNumber,
          subject: item.subject,
          sender: item.sender,
          recipient: item.recipient,
          direction: item.direction,
          type: item.type,
          status: item.status,
          priority: item.priority,
          departmentId: department.id,
          createdById: creator.id,
          assignedToId: assigned.id,
          dateReceived: new Date(),
          dueDate: new Date(Date.now() + item.daysUntilDue * 24 * 60 * 60 * 1000),
          notes: "Fictional demonstration record; not official correspondence.",
        },
        select: { id: true },
      });

      await prisma.notification.upsert({
        where: { dedupeKey: `demo:${item.referenceNumber}` },
        update: {
          userId: notificationRecipient.id,
          correspondenceId: correspondence.id,
          kind: item.notificationKind,
          message: item.notificationMessage,
          readAt: null,
        },
        create: {
          userId: notificationRecipient.id,
          correspondenceId: correspondence.id,
          kind: item.notificationKind,
          message: item.notificationMessage,
          dedupeKey: `demo:${item.referenceNumber}`,
        },
      });
    }
    console.info("Fictional demo users, correspondence, and notifications are ready.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

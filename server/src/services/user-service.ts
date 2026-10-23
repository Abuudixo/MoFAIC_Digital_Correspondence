import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { safeUserSelect } from "../utils/safe-user";

type UserManager = {
  id: string;
  role: string;
  permissions: string[];
};

function requireUserManagement(actor: UserManager) {
  if (
    actor.role !== "ADMIN" ||
    !actor.permissions.includes("users:manage")
  ) {
    throw new AppError(403, "You do not have permission to manage users.");
  }
}

export async function createUser(
  input: {
    name: string;
    email: string;
    password: string;
    roleId: string;
    departmentId?: string | null;
  },
  actor: UserManager,
) {
  requireUserManagement(actor);
  const role = await prisma.role.findUnique({
    where: { id: input.roleId },
    select: { id: true, name: true },
  });
  if (!role) throw new AppError(400, "The selected role does not exist.");

  if (!["PERMANENT_SECRETARY", "DEPARTMENT_HEAD", "STAFF"].includes(role.name)) {
    throw new AppError(403, "You cannot create an account with the selected role.");
  }

  const departmentId = input.departmentId ?? null;
  if (role.name === "PERMANENT_SECRETARY") {
    if (departmentId) {
      throw new AppError(400, "Permanent Secretary accounts must not be assigned to a department.");
    }
  } else {
    if (!departmentId) throw new AppError(400, "Assign this account to a department.");
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, isActive: true },
    });
    if (!department || !department.isActive) {
      throw new AppError(400, "The selected department does not exist or is inactive.");
    }
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        roleId: input.roleId,
        departmentId,
      },
      select: safeUserSelect,
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "user.created",
        entity: "User",
        entityId: user.id,
      },
    });
    return user;
  });
}

export async function listUsers(actor: UserManager) {
  requireUserManagement(actor);
  return prisma.user.findMany({
    orderBy: { name: "asc" },
    select: safeUserSelect,
  });
}

export async function updateUser(
  id: string,
  input: {
    name: string;
    email: string;
    roleId: string;
    departmentId: string | null;
    isActive: boolean;
    password?: string;
  },
  actor: UserManager,
) {
  requireUserManagement(actor);
  if (id === actor.id && !input.isActive) {
    throw new AppError(400, "You cannot deactivate your own account.");
  }

  const [existingUser, role] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { id: true, role: { select: { name: true } } },
    }),
    prisma.role.findUnique({
      where: { id: input.roleId },
      select: { id: true, name: true },
    }),
  ]);
  if (!existingUser) throw new AppError(404, "The requested user was not found.");
  if (existingUser.role.name === "ADMIN") {
    throw new AppError(403, "Administrator accounts cannot be edited here.");
  }
  if (!role) throw new AppError(400, "The selected role does not exist.");
  if (!["PERMANENT_SECRETARY", "DEPARTMENT_HEAD", "STAFF"].includes(role.name)) {
    throw new AppError(403, "You cannot assign the selected role.");
  }

  const departmentId = input.departmentId;
  if (role.name === "PERMANENT_SECRETARY") {
    if (departmentId) {
      throw new AppError(400, "Permanent Secretary accounts must not be assigned to a department.");
    }
  } else {
    if (!departmentId) throw new AppError(400, "Assign this account to a department.");
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, isActive: true },
    });
    if (!department || !department.isActive) {
      throw new AppError(400, "The selected department does not exist or is inactive.");
    }
  }

  const passwordHash = input.password
    ? await bcrypt.hash(input.password, env.BCRYPT_ROUNDS)
    : undefined;
  const changedFields = [
    "name",
    "email",
    "roleId",
    "departmentId",
    "isActive",
    ...(passwordHash ? ["password"] : []),
  ];

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        roleId: role.id,
        departmentId,
        isActive: input.isActive,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: safeUserSelect,
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "user.updated",
        entity: "User",
        entityId: user.id,
        metadata: { changedFields },
      },
    });
    return user;
  });
}

export async function listRoles(actor: UserManager) {
  requireUserManagement(actor);
  return prisma.role.findMany({
    where: { name: { in: ["PERMANENT_SECRETARY", "DEPARTMENT_HEAD", "STAFF"] } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: { select: { name: true }, orderBy: { name: "asc" } },
    },
  });
}

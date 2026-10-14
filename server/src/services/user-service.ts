import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { safeUserSelect } from "../utils/safe-user";

type UserManager = {
  id: string;
  role: string;
  departmentId: string | null;
  permissions: string[];
};

function requireUserManagement(actor: UserManager) {
  const isAdmin = actor.role === "ADMIN" && actor.permissions.includes("users:manage");
  const isDirector =
    actor.role === "DIRECTOR" &&
    actor.permissions.includes("users:manage:department") &&
    Boolean(actor.departmentId);
  if (!isAdmin && !isDirector) {
    throw new AppError(403, "You do not have permission to manage users.");
  }
  return { isAdmin, isDirector };
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
  const { isAdmin, isDirector } = requireUserManagement(actor);
  const role = await prisma.role.findUnique({
    where: { id: input.roleId },
    select: { id: true, name: true },
  });
  if (!role) throw new AppError(400, "The selected role does not exist.");

  if (
    (isAdmin && role.name !== "DIRECTOR") ||
    (isDirector && ["ADMIN", "DIRECTOR"].includes(role.name))
  ) {
    throw new AppError(403, "You cannot create an account with the selected role.");
  }

  const departmentId = isDirector ? actor.departmentId : input.departmentId;
  if (!departmentId) throw new AppError(400, "Assign this account to a department.");
  if (isDirector && input.departmentId && input.departmentId !== actor.departmentId) {
    throw new AppError(403, "You can only create users in your own department.");
  }
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, isActive: true },
  });
  if (!department || !department.isActive) {
    throw new AppError(400, "The selected department does not exist or is inactive.");
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
  const { isAdmin } = requireUserManagement(actor);
  return prisma.user.findMany({
    where: isAdmin ? undefined : { departmentId: actor.departmentId },
    orderBy: { name: "asc" },
    select: safeUserSelect,
  });
}

export async function listRoles(actor: UserManager) {
  const { isAdmin } = requireUserManagement(actor);
  return prisma.role.findMany({
    where: isAdmin
      ? { name: "DIRECTOR" }
      : { name: { notIn: ["ADMIN", "DIRECTOR"] } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: { select: { name: true }, orderBy: { name: "asc" } },
    },
  });
}

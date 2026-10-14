import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export async function listDepartments() {
  return prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, description: true, createdAt: true, updatedAt: true },
  });
}

export async function listDepartmentAssignees(departmentId: string) {
  return prisma.user.findMany({
    where: { departmentId, isActive: true, department: { isActive: true } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function createDepartment(data: Prisma.DepartmentCreateInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const department = await tx.department.create({ data });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "department.created",
        entity: "Department",
        entityId: department.id,
      },
    });
    return department;
  });
}

export async function updateDepartment(
  id: string,
  data: Prisma.DepartmentUpdateInput,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const department = await tx.department.update({ where: { id }, data });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "department.updated",
        entity: "Department",
        entityId: department.id,
        metadata: { changedFields: Object.keys(data) },
      },
    });
    return department;
  });
}

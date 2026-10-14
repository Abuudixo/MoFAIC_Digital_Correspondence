import type { Prisma } from "@prisma/client";

export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  role: { select: { id: true, name: true } },
  department: { select: { id: true, name: true, code: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

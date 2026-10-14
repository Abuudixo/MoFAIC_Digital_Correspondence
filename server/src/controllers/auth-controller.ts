import type { RequestHandler } from "express";
import { prisma } from "../config/prisma";
import { login } from "../services/auth-service";
import { AppError } from "../utils/app-error";
import { safeUserSelect } from "../utils/safe-user";
import { loginSchema } from "../validators/schemas";

export const loginController: RequestHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);
  res.json(await login(input.email, input.password));
};

export const meController: RequestHandler = async (req, res) => {
  if (!req.user) throw new AppError(401, "Authentication required.");
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      ...safeUserSelect,
      role: {
        select: {
          id: true,
          name: true,
          permissions: { select: { name: true } },
        },
      },
    },
  });
  if (!user) throw new AppError(401, "Authentication required.");
  res.json({
    user: {
      ...user,
      permissions: user.role.permissions.map(({ name }) => name),
    },
  });
};

import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    next(new AppError(401, "Authentication required."));
    return;
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "mofaic-correspondence-api",
      audience: "mofaic-correspondence-client",
    });
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw new AppError(401, "Invalid or expired access token.");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        departmentId: true,
        role: { select: { name: true, permissions: { select: { name: true } } } },
      },
    });

    if (!user?.isActive) throw new AppError(401, "Invalid or expired access token.");

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      departmentId: user.departmentId,
      permissions: user.role.permissions.map(({ name }) => name),
    };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      next(new AppError(401, "Invalid or expired access token."));
      return;
    }
    next(error);
  }
};

export function requirePermissions(...required: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError(401, "Authentication required."));
      return;
    }
    if (!required.every((permission) => req.user?.permissions.includes(permission))) {
      next(new AppError(403, "You do not have permission to perform this action."));
      return;
    }
    next();
  };
}

export function requireAnyPermissions(...required: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError(401, "Authentication required."));
      return;
    }
    if (!required.some((permission) => req.user?.permissions.includes(permission))) {
      next(new AppError(403, "You do not have permission to perform this action."));
      return;
    }
    next();
  };
}

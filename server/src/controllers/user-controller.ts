import type { RequestHandler } from "express";
import {
  createUser,
  listRoles,
  listUsers,
  updateUser,
} from "../services/user-service";
import { AppError } from "../utils/app-error";
import { createUserSchema, idSchema, updateUserSchema } from "../validators/schemas";

export const listUsersController: RequestHandler = async (_req, res) => {
  if (!_req.user) throw new AppError(401, "Authentication required.");
  res.json({ items: await listUsers(_req.user) });
};

export const listRolesController: RequestHandler = async (_req, res) => {
  if (!_req.user) throw new AppError(401, "Authentication required.");
  res.json({ items: await listRoles(_req.user) });
};

export const createUserController: RequestHandler = async (req, res) => {
  if (!req.user) throw new AppError(401, "Authentication required.");
  const user = await createUser(createUserSchema.parse(req.body), req.user);
  res.status(201).json({ user });
};

export const updateUserController: RequestHandler = async (req, res) => {
  if (!req.user) throw new AppError(401, "Authentication required.");
  const user = await updateUser(
    idSchema.parse(req.params.id),
    updateUserSchema.parse(req.body),
    req.user,
  );
  res.json({ user });
};

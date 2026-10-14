import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";
import {
  createActionItem,
  listActionItems,
  updateActionItem,
} from "../services/action-service";
import {
  createActionItemSchema,
  idSchema,
  updateActionItemSchema,
} from "../validators/schemas";

function actorFrom(req: Parameters<RequestHandler>[0]) {
  if (!req.user) throw new AppError(401, "Authentication required.");
  return {
    id: req.user.id,
    permissions: req.user.permissions,
    departmentId: req.user.departmentId,
  };
}

export const listActionItemsController: RequestHandler = async (req, res) => {
  res.json({
    items: await listActionItems(
      actorFrom(req),
      req.params.id ? idSchema.parse(req.params.id) : undefined,
    ),
  });
};

export const createActionItemController: RequestHandler = async (req, res) => {
  const action = await createActionItem(
    idSchema.parse(req.params.id),
    createActionItemSchema.parse(req.body),
    actorFrom(req),
    req.ip,
  );
  res.status(201).json({ action });
};

export const updateActionItemController: RequestHandler = async (req, res) => {
  const action = await updateActionItem(
    idSchema.parse(req.params.actionId),
    updateActionItemSchema.parse(req.body),
    actorFrom(req),
    req.ip,
  );
  res.json({ action });
};

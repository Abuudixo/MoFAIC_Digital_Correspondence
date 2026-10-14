import type { RequestHandler } from "express";
import {
  createDepartment,
  listDepartmentAssignees,
  listDepartments,
  updateDepartment,
} from "../services/department-service";
import { AppError } from "../utils/app-error";
import { createDepartmentSchema, idSchema, updateDepartmentSchema } from "../validators/schemas";

export const listDepartmentsController: RequestHandler = async (_req, res) => {
  res.json({ items: await listDepartments() });
};

export const listDepartmentAssigneesController: RequestHandler = async (req, res) => {
  const departmentId = idSchema.parse(req.params.id);
  res.json({ items: await listDepartmentAssignees(departmentId) });
};

export const createDepartmentController: RequestHandler = async (req, res) => {
  if (!req.user) throw new AppError(401, "Authentication required.");
  const data = createDepartmentSchema.parse(req.body);
  const department = await createDepartment(data, req.user.id);
  res.status(201).json({ department });
};

export const updateDepartmentController: RequestHandler = async (req, res) => {
  if (!req.user) throw new AppError(401, "Authentication required.");
  const data = updateDepartmentSchema.parse(req.body);
  if (!Object.keys(data).length) throw new AppError(400, "Provide at least one field to update.");
  const id = idSchema.parse(req.params.id);
  const department = await updateDepartment(id, data, req.user.id);
  res.json({ department });
};

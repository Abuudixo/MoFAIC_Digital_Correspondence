import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";
import {
  archiveCorrespondence,
  createCorrespondence,
  getCorrespondence,
  getCorrespondenceAudit,
  listCorrespondence,
  updateCorrespondence,
} from "../services/correspondence-service";
import {
  createCorrespondenceSchema,
  idSchema,
  listCorrespondenceSchema,
  archiveSchema,
  updateCorrespondenceSchema,
} from "../validators/schemas";
import { getArchivedCorrespondence } from "../services/correspondence-service";

function currentUser(req: Parameters<RequestHandler>[0]) {
  if (!req.user) throw new AppError(401, "Authentication required.");
  return req.user;
}

export const createCorrespondenceController: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const input = createCorrespondenceSchema.parse(req.body);
  const record = await createCorrespondence(
    input,
    user.id,
    user.permissions,
    user.departmentId,
    req.ip,
  );
  res.status(201).json({ correspondence: record });
};

export const listCorrespondenceController: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({
    ...(await listCorrespondence(
      listCorrespondenceSchema.parse(req.query),
      user.id,
      user.permissions,
      user.departmentId,
    )),
  });
};

export const getCorrespondenceController: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({
    correspondence: await getCorrespondence(
      idSchema.parse(req.params.id),
      user.id,
      user.permissions,
      user.departmentId,
    ),
  });
};

export const getArchivedCorrespondenceController: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({
    correspondence: await getArchivedCorrespondence(
      idSchema.parse(req.params.id),
      user.id,
      user.permissions,
      user.departmentId,
    ),
  });
};

export const updateCorrespondenceController: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const input = updateCorrespondenceSchema.parse(req.body);
  const id = idSchema.parse(req.params.id);
  const record = await updateCorrespondence(
    id,
    input,
    user.id,
    user.permissions,
    user.departmentId,
    req.ip,
  );
  res.json({ correspondence: record });
};

export const archiveCorrespondenceController: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { retentionCategory } = archiveSchema.parse(req.body);
  res.json({
    correspondence: await archiveCorrespondence(
      idSchema.parse(req.params.id),
      retentionCategory,
      user.id,
      user.permissions,
      user.departmentId,
      req.ip,
    ),
  });
};

export const correspondenceAuditController: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({
    items: await getCorrespondenceAudit(
      idSchema.parse(req.params.id),
      user.id,
      user.permissions,
      user.departmentId,
    ),
  });
};

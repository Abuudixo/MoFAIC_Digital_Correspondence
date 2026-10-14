import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";
import { idSchema } from "../validators/schemas";
import {
  approvalSchema,
  assignmentSchema,
  documentUploadSchema,
  retentionPolicySchema,
  workflowActionSchema,
  workflowDefinitionSchema,
} from "../validators/schemas";
import {
  assignCorrespondence,
  configureRetentionPolicy,
  createWorkflowDefinition,
  decideApproval,
  listNotifications,
  listRetentionPolicies,
  listWorkflowDefinitions,
  markNotificationRead,
  transitionCorrespondence,
  workflowHistory,
} from "../services/workflow-service";
import {
  downloadDocument,
  listDocuments,
  uploadDocument,
} from "../services/document-service";

function requireUser(req: Parameters<RequestHandler>[0]) {
  if (!req.user) throw new AppError(401, "Authentication required.");
  return req.user;
}

export const assignController: RequestHandler = async (req, res) => {
  const actor = requireUser(req);
  const input = assignmentSchema.parse(req.body);
  const correspondence = await assignCorrespondence(
    { ...input, correspondenceId: idSchema.parse(req.params.id) },
    actor.id,
    actor.permissions,
    actor.departmentId,
    req.ip,
  );
  res.json({ correspondence });
};

export const transitionController: RequestHandler = async (req, res) => {
  const actor = requireUser(req);
  const input = workflowActionSchema.parse(req.body);
  const correspondence = await transitionCorrespondence(
    idSchema.parse(req.params.id),
    input.toStatus,
    {
      id: actor.id,
      permissions: actor.permissions,
      departmentId: actor.departmentId,
    },
    input.comment,
    req.ip,
  );
  res.json({ correspondence });
};

export function approvalController(decision: "APPROVED" | "REJECTED"): RequestHandler {
  return async (req, res) => {
    const actor = requireUser(req);
    const input = approvalSchema.parse(req.body);
    const correspondence = await decideApproval(
      idSchema.parse(req.params.id),
      decision,
      {
        id: actor.id,
        permissions: actor.permissions,
        departmentId: actor.departmentId,
        role: actor.role,
      },
      input.comment,
      req.ip,
    );
    res.json({ correspondence });
  };
}

export const workflowHistoryController: RequestHandler = async (req, res) => {
  const actor = requireUser(req);
  res.json({
    items: await workflowHistory(idSchema.parse(req.params.id), {
      id: actor.id,
      permissions: actor.permissions,
      departmentId: actor.departmentId,
      role: actor.role,
    }),
  });
};

export const workflowDefinitionsController: RequestHandler = async (_req, res) => {
  res.json({ items: await listWorkflowDefinitions() });
};

export const createWorkflowDefinitionController: RequestHandler = async (req, res) => {
  const actor = requireUser(req);
  const definition = await createWorkflowDefinition(
    workflowDefinitionSchema.parse(req.body),
    actor.id,
    req.ip,
  );
  res.status(201).json({ definition });
};

export const retentionPoliciesController: RequestHandler = async (_req, res) => {
  res.json({ items: await listRetentionPolicies() });
};

export const createRetentionPolicyController: RequestHandler = async (req, res) => {
  const actor = requireUser(req);
  const policy = await configureRetentionPolicy(
    retentionPolicySchema.parse(req.body),
    actor.id,
    req.ip,
  );
  res.status(201).json({ policy });
};

export const notificationsController: RequestHandler = async (req, res) => {
  res.json({ items: await listNotifications(requireUser(req)) });
};

export const markNotificationReadController: RequestHandler = async (req, res) => {
  const actor = requireUser(req);
  res.json({
    notification: await markNotificationRead(idSchema.parse(req.params.id), actor.id),
  });
};

export const listDocumentsController: RequestHandler = async (req, res) => {
  const actor = requireUser(req);
  res.json({
    items: await listDocuments(idSchema.parse(req.params.id), {
      id: actor.id,
      permissions: actor.permissions,
      departmentId: actor.departmentId,
    }),
  });
};

export const uploadDocumentController: RequestHandler = async (req, res) => {
  const actor = requireUser(req);
  if (!req.file) throw new AppError(400, "Attach one document to upload.");
  const input = documentUploadSchema.parse(req.body);
  const document = await uploadDocument(
    {
      correspondenceId: idSchema.parse(req.params.id),
      originalFileName: req.file.originalname,
      bytes: req.file.buffer,
      classification: input.classification,
      actionId: input.actionId,
    },
    { id: actor.id, permissions: actor.permissions, departmentId: actor.departmentId },
    req.ip,
  );
  res.status(201).json({ document });
};

export const downloadDocumentController: RequestHandler = async (req, res, next) => {
  const actor = requireUser(req);
  const download = await downloadDocument(
    idSchema.parse(req.params.documentId),
    {
      id: actor.id,
      permissions: actor.permissions,
      departmentId: actor.departmentId,
    },
    req.ip,
  );
  res.setHeader("Content-Type", download.mimeType);
  res.setHeader("Content-Length", download.contentLength);
  res.setHeader("Content-Disposition", download.contentDisposition);
  res.setHeader("Cache-Control", "no-store");
  download.stream.on("error", (error) => {
    if (res.headersSent) {
      res.destroy(error);
    } else {
      next(new AppError(404, "Document content is unavailable."));
    }
  });
  download.stream.pipe(res);
};

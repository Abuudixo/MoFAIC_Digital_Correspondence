import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { documentUpload } from "../middleware/document-upload";
import {
  createActionItemController,
  listActionItemsController,
  updateActionItemController,
} from "../controllers/action-controller";
import { workbookListsController } from "../controllers/list-controller";
import { prisma } from "../config/prisma";
import {
  authenticate,
  requirePermissions,
} from "../middleware/authenticate";
import {
  archiveCorrespondenceController,
  correspondenceAuditController,
  createCorrespondenceController,
  getArchivedCorrespondenceController,
  getCorrespondenceController,
  listCorrespondenceController,
  updateCorrespondenceController,
} from "../controllers/correspondence-controller";
import {
  approvalController,
  assignController,
  createRetentionPolicyController,
  createWorkflowDefinitionController,
  downloadDocumentController,
  listDocumentsController,
  markNotificationReadController,
  notificationsController,
  retentionPoliciesController,
  transitionController,
  uploadDocumentController,
  workflowDefinitionsController,
  workflowHistoryController,
} from "../controllers/workflow-controller";
import {
  managementReportController,
  actionReportController,
  overdueReportController,
  retentionReviewController,
} from "../controllers/report-controller";
import {
  createDepartmentController,
  listDepartmentAssigneesController,
  listDepartmentsController,
  updateDepartmentController,
} from "../controllers/department-controller";
import { loginController, meController } from "../controllers/auth-controller";
import {
  createUserController,
  listRolesController,
  listUsersController,
} from "../controllers/user-controller";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

apiRouter.get("/health/ready", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ready" });
});

apiRouter.post(
  "/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many login attempts. Try again later." },
  }),
  loginController,
);
apiRouter.get("/auth/me", authenticate, meController);
apiRouter.get("/lists", authenticate, workbookListsController);

apiRouter.get(
  "/users",
  authenticate,
  requirePermissions("users:manage"),
  listUsersController,
);
apiRouter.post(
  "/users",
  authenticate,
  requirePermissions("users:manage"),
  createUserController,
);
apiRouter.get(
  "/roles",
  authenticate,
  requirePermissions("users:manage"),
  listRolesController,
);

apiRouter.get("/departments", authenticate, listDepartmentsController);
apiRouter.get(
  "/departments/:id/assignees",
  authenticate,
  requirePermissions("correspondence:assign"),
  listDepartmentAssigneesController,
);
apiRouter.post(
  "/departments",
  authenticate,
  requirePermissions("departments:manage"),
  createDepartmentController,
);
apiRouter.patch(
  "/departments/:id",
  authenticate,
  requirePermissions("departments:manage"),
  updateDepartmentController,
);

apiRouter.post(
  "/correspondence",
  authenticate,
  requirePermissions("correspondence:create"),
  createCorrespondenceController,
);
apiRouter.get("/correspondence", authenticate, listCorrespondenceController);
apiRouter.get(
  "/correspondence/:id/action-items",
  authenticate,
  listActionItemsController,
);
apiRouter.post(
  "/correspondence/:id/action-items",
  authenticate,
  requirePermissions("correspondence:assign"),
  createActionItemController,
);
apiRouter.get(
  "/correspondence/archive/:id",
  authenticate,
  requirePermissions("correspondence:read:archive"),
  getArchivedCorrespondenceController,
);
apiRouter.get("/correspondence/:id/audit", authenticate, correspondenceAuditController);
apiRouter.get("/correspondence/:id/workflow", authenticate, workflowHistoryController);
apiRouter.post(
  "/correspondence/:id/assign",
  authenticate,
  requirePermissions("correspondence:assign"),
  assignController,
);
apiRouter.post("/correspondence/:id/actions", authenticate, transitionController);
apiRouter.post(
  "/correspondence/:id/approve",
  authenticate,
  requirePermissions("correspondence:approve"),
  approvalController("APPROVED"),
);
apiRouter.post(
  "/correspondence/:id/reject",
  authenticate,
  requirePermissions("correspondence:approve"),
  approvalController("REJECTED"),
);
apiRouter.get(
  "/correspondence/:id/documents",
  authenticate,
  requirePermissions("documents:read"),
  listDocumentsController,
);
apiRouter.post(
  "/correspondence/:id/documents",
  authenticate,
  requirePermissions("documents:upload"),
  rateLimit({ windowMs: 60 * 60 * 1000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false }),
  documentUpload,
  uploadDocumentController,
);
apiRouter.get(
  "/documents/:documentId/download",
  authenticate,
  requirePermissions("documents:read"),
  downloadDocumentController,
);
apiRouter.get("/correspondence/:id", authenticate, getCorrespondenceController);
apiRouter.patch(
  "/correspondence/:id",
  authenticate,
  requirePermissions("correspondence:update"),
  updateCorrespondenceController,
);
apiRouter.patch(
  "/correspondence/:id/archive",
  authenticate,
  requirePermissions("correspondence:archive"),
  archiveCorrespondenceController,
);

apiRouter.get(
  "/workflow-definitions",
  authenticate,
  requirePermissions("workflow:manage"),
  workflowDefinitionsController,
);
apiRouter.post(
  "/workflow-definitions",
  authenticate,
  requirePermissions("workflow:manage"),
  createWorkflowDefinitionController,
);
apiRouter.get(
  "/retention-policies",
  authenticate,
  requirePermissions("retention:manage"),
  retentionPoliciesController,
);
apiRouter.post(
  "/retention-policies",
  authenticate,
  requirePermissions("retention:manage"),
  createRetentionPolicyController,
);

apiRouter.get("/notifications", authenticate, notificationsController);
apiRouter.get("/actions", authenticate, listActionItemsController);
apiRouter.get(
  "/actions/report",
  authenticate,
  requirePermissions("reports:read"),
  actionReportController,
);
apiRouter.patch("/action-items/:actionId", authenticate, updateActionItemController);
apiRouter.patch(
  "/notifications/:id/read",
  authenticate,
  markNotificationReadController,
);

apiRouter.get(
  "/reports/summary",
  authenticate,
  requirePermissions("reports:read"),
  managementReportController,
);
apiRouter.get(
  "/reports/overdue",
  authenticate,
  requirePermissions("reports:read"),
  overdueReportController,
);
apiRouter.get(
  "/reports/retention-review",
  authenticate,
  requirePermissions("reports:read", "correspondence:read:archive"),
  retentionReviewController,
);

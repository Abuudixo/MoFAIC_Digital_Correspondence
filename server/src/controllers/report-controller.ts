import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";
import { idSchema, reportSchema } from "../validators/schemas";
import {
  getManagementReport,
  overdueReport,
  retentionReviewCandidates,
} from "../services/report-service";
import { actionReport } from "../services/action-service";

function reportActor(req: Parameters<RequestHandler>[0]) {
  if (!req.user) throw new AppError(401, "Authentication required.");
  return {
    id: req.user.id,
    permissions: req.user.permissions,
    departmentId: req.user.departmentId,
  };
}

export const managementReportController: RequestHandler = async (req, res) => {
  const actor = reportActor(req);
  const filters = reportSchema.parse(req.query);
  if (
    filters.departmentDashboard &&
    (req.user?.role !== "DEPARTMENT_HEAD" ||
      !actor.departmentId ||
      filters.departmentId !== actor.departmentId)
  ) {
    throw new AppError(
      403,
      "Department dashboard data is available only to the department head for their assigned department.",
    );
  }
  res.json({ report: await getManagementReport(filters, actor) });
};

export const overdueReportController: RequestHandler = async (req, res) => {
  const departmentId = req.query.departmentId
    ? idSchema.parse(req.query.departmentId)
    : undefined;
  res.json({ items: await overdueReport(reportActor(req), departmentId) });
};

export const retentionReviewController: RequestHandler = async (req, res) => {
  res.json({ items: await retentionReviewCandidates(reportActor(req)) });
};

export const actionReportController: RequestHandler = async (req, res) => {
  const departmentId = req.query.departmentId
    ? idSchema.parse(req.query.departmentId)
    : undefined;
  res.json({ report: await actionReport(reportActor(req), departmentId) });
};

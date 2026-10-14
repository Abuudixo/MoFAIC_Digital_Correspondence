import {
  ActionStatus,
  ConfidentialityLevel,
  CorrespondenceDirection,
  CorrespondenceStatus,
  CorrespondenceType,
  Priority,
  RetentionAction,
} from "@prisma/client";
import type { RequestHandler } from "express";
import { prisma } from "../config/prisma";

export const workbookListsController: RequestHandler = async (_req, res) => {
  const departments = await prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
  res.json({
    lists: {
      directions: Object.values(CorrespondenceDirection),
      documentTypes: Object.values(CorrespondenceType),
      classifications: Object.values(ConfidentialityLevel),
      statuses: Object.values(CorrespondenceStatus),
      priorities: Object.values(Priority),
      actionStatuses: Object.values(ActionStatus),
      retentionActions: Object.values(RetentionAction),
      departments,
    },
  });
};

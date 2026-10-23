import {
  ActionStatus,
  ConfidentialityLevel,
  CorrespondenceDirection,
  CorrespondenceStatus,
  CorrespondenceType,
  Priority,
  RetentionAction,
} from "@prisma/client";
import { z } from "zod";

export const idSchema = z.string().uuid();
const id = idSchema;
const date = z
  .string()
  .date()
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const dateTo = z
  .string()
  .date()
  .transform((value) => new Date(`${value}T23:59:59.999Z`));

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const assignmentSchema = z.object({
  departmentId: id,
  assignedToId: id.nullable().optional(),
  comment: z.string().trim().max(1000).optional(),
});

export const createActionItemSchema = z.object({
  departmentId: id,
  assignedToId: id.nullable().optional(),
  dueDate: date,
  requiredAction: z.string().trim().min(1).max(2000),
  priority: z.nativeEnum(Priority).default(Priority.NORMAL),
  remarks: z.string().trim().max(2000).optional(),
});

export const updateActionItemSchema = z
  .object({
    assignedToId: id.nullable().optional(),
    dueDate: date.optional(),
    status: z.nativeEnum(ActionStatus).optional(),
    remarks: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update.",
  );

export const workflowActionSchema = z.object({
  toStatus: z.nativeEnum(CorrespondenceStatus),
  comment: z.string().trim().max(2000).optional(),
});

export const approvalSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});

export const documentUploadSchema = z.object({
  classification: z
    .nativeEnum(ConfidentialityLevel)
    .default(ConfidentialityLevel.NORMAL),
  actionId: id.optional(),
});

export const workflowDefinitionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().default(false),
  steps: z
    .array(
      z.object({
        order: z.number().int().nonnegative(),
        status: z.nativeEnum(CorrespondenceStatus),
        requiredRole: z.string().trim().min(1).max(80).optional(),
        requiresComment: z.boolean().default(false),
        allowedNextStates: z
          .array(z.nativeEnum(CorrespondenceStatus))
          .max(7)
          .default([]),
      }),
    )
    .min(1)
    .max(20),
});

export const retentionPolicySchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  retentionDays: z.number().int().nonnegative().nullable().optional(),
  action: z.nativeEnum(RetentionAction),
  classification: z.nativeEnum(ConfidentialityLevel).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const archiveSchema = z.object({
  retentionCategory: z.string().trim().min(1).max(120),
});

export const reportSchema = z
  .object({
    departmentId: id.optional(),
    departmentDashboard: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
    countryMission: z.string().trim().max(200).optional(),
    organization: z.string().trim().max(300).optional(),
    direction: z.nativeEnum(CorrespondenceDirection).optional(),
    type: z.nativeEnum(CorrespondenceType).optional(),
    dateFrom: date.optional(),
    dateTo: dateTo.optional(),
    includeArchived: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
  })
  .refine(
    (value) =>
      !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    {
      message: "The start date must be on or before the end date.",
      path: ["dateTo"],
    },
  );

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  roleId: id,
  departmentId: id.nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  roleId: id,
  departmentId: id.nullable(),
  isActive: z.boolean(),
  password: z.string().min(12).max(128).optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/),
  description: z.string().trim().max(500).nullable().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createCorrespondenceSchema = z
  .object({
    documentNumber: z.string().trim().max(100).nullable().optional(),
    direction: z.nativeEnum(CorrespondenceDirection),
    type: z.nativeEnum(CorrespondenceType),
    subject: z.string().trim().min(1).max(500),
    sender: z.string().trim().min(1).max(300),
    recipient: z.string().trim().min(1).max(300),
    organization: z.string().trim().max(300).nullable().optional(),
    countryMission: z.string().trim().max(200).nullable().optional(),
    currentActionLocation: z.string().trim().max(500).nullable().optional(),
    fileLocation: z.string().trim().max(1000).nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    departmentId: id,
    priority: z.nativeEnum(Priority).default(Priority.NORMAL),
    confidentiality: z
      .nativeEnum(ConfidentialityLevel)
      .default(ConfidentialityLevel.NORMAL),
    dateReceived: date.nullable().optional(),
    dateSent: date.nullable().optional(),
    dueDate: date.nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      !(
        value.direction === CorrespondenceDirection.INCOMING &&
        value.dateSent &&
        !value.dateReceived
      ),
    {
      message:
        "Incoming correspondence with a sent date must also have a received date.",
    },
  );

export const updateCorrespondenceSchema = z
  .object({
    documentNumber: z.string().trim().max(100).nullable(),
    direction: z.nativeEnum(CorrespondenceDirection),
    type: z.nativeEnum(CorrespondenceType),
    subject: z.string().trim().min(1).max(500),
    sender: z.string().trim().min(1).max(300),
    recipient: z.string().trim().min(1).max(300),
    organization: z.string().trim().max(300).nullable(),
    countryMission: z.string().trim().max(200).nullable(),
    currentActionLocation: z.string().trim().max(500).nullable(),
    fileLocation: z.string().trim().max(1000).nullable(),
    notes: z.string().trim().max(4000).nullable(),
    priority: z.nativeEnum(Priority),
    confidentiality: z.nativeEnum(ConfidentialityLevel),
    dateReceived: date.nullable(),
    dateSent: date.nullable(),
    dueDate: date.nullable(),
  })
  .strict()
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update.",
  );

export const listCorrespondenceSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z
      .enum([
        "createdAt",
        "updatedAt",
        "referenceNumber",
        "subject",
        "dueDate",
        "dateReceived",
      ])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    referenceNumber: z.string().trim().max(40).optional(),
    subject: z.string().trim().max(500).optional(),
    sender: z.string().trim().max(300).optional(),
    recipient: z.string().trim().max(300).optional(),
    departmentId: id.optional(),
    countryMission: z.string().trim().max(200).optional(),
    organization: z.string().trim().max(300).optional(),
    search: z.string().trim().min(1).max(200).optional(),
    direction: z.nativeEnum(CorrespondenceDirection).optional(),
    type: z.nativeEnum(CorrespondenceType).optional(),
    priority: z.nativeEnum(Priority).optional(),
    confidentiality: z.nativeEnum(ConfidentialityLevel).optional(),
    status: z.nativeEnum(CorrespondenceStatus).optional(),
    assignedToId: id.optional(),
    dateFrom: date.optional(),
    dateTo: dateTo.optional(),
    includeArchived: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
  })
  .refine(
    (value) =>
      !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    {
      message: "The start date must be on or before the end date.",
      path: ["dateTo"],
    },
  );

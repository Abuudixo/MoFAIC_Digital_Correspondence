CREATE TYPE "CorrespondenceDirection_workbook" AS ENUM (
  'INCOMING',
  'OUTGOING',
  'INTERNAL',
  'EXTERNAL_DRAFT'
);

ALTER TABLE "correspondence"
  ALTER COLUMN "direction" TYPE "CorrespondenceDirection_workbook"
  USING "direction"::text::"CorrespondenceDirection_workbook";
DROP TYPE "CorrespondenceDirection";
ALTER TYPE "CorrespondenceDirection_workbook" RENAME TO "CorrespondenceDirection";

CREATE TYPE "CorrespondenceType_workbook" AS ENUM (
  'LETTER',
  'NOTE_VERBALE',
  'MEMORANDUM',
  'EMAIL',
  'DIRECTIVE',
  'REPORT',
  'INVITATION',
  'AGREEMENT',
  'OTHER'
);

ALTER TABLE "correspondence"
  ALTER COLUMN "type" TYPE "CorrespondenceType_workbook"
  USING CASE
    WHEN "type"::text = 'CIRCULAR' THEN 'OTHER'
    ELSE "type"::text
  END::"CorrespondenceType_workbook";
DROP TYPE "CorrespondenceType";
ALTER TYPE "CorrespondenceType_workbook" RENAME TO "CorrespondenceType";

CREATE TYPE "ConfidentialityLevel_workbook" AS ENUM (
  'NORMAL',
  'CONFIDENTIAL',
  'RESTRICTED',
  'SECRET'
);

CREATE FUNCTION map_workbook_classification(value TEXT)
RETURNS "ConfidentialityLevel_workbook"
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE value
    WHEN 'PUBLIC' THEN 'NORMAL'
    WHEN 'INTERNAL' THEN 'NORMAL'
    WHEN 'CONFIDENTIAL' THEN 'CONFIDENTIAL'
    WHEN 'SECRET' THEN 'SECRET'
    ELSE 'RESTRICTED'
  END::"ConfidentialityLevel_workbook"
$$;

ALTER TABLE "correspondence" ALTER COLUMN "confidentiality" DROP DEFAULT;
ALTER TABLE "documents" ALTER COLUMN "classification" DROP DEFAULT;
ALTER TABLE "correspondence"
  ALTER COLUMN "confidentiality" TYPE "ConfidentialityLevel_workbook"
  USING map_workbook_classification("confidentiality"::text);
ALTER TABLE "documents"
  ALTER COLUMN "classification" TYPE "ConfidentialityLevel_workbook"
  USING map_workbook_classification("classification"::text);
ALTER TABLE "retention_policies"
  ALTER COLUMN "classification" TYPE "ConfidentialityLevel_workbook"
  USING map_workbook_classification("classification"::text);
DROP TYPE "ConfidentialityLevel";
ALTER TYPE "ConfidentialityLevel_workbook" RENAME TO "ConfidentialityLevel";
ALTER TABLE "correspondence"
  ALTER COLUMN "confidentiality" SET DEFAULT 'NORMAL'::"ConfidentialityLevel";
ALTER TABLE "documents"
  ALTER COLUMN "classification" SET DEFAULT 'NORMAL'::"ConfidentialityLevel";
DROP FUNCTION map_workbook_classification(TEXT);

CREATE TYPE "CorrespondenceStatus_workbook" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'PENDING_APPROVAL',
  'APPROVED',
  'DISPATCHED',
  'CLOSED',
  'ARCHIVED'
);

CREATE FUNCTION map_workbook_status(value TEXT)
RETURNS "CorrespondenceStatus_workbook"
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE value
    WHEN 'DRAFT' THEN 'OPEN'
    WHEN 'REGISTERED' THEN 'OPEN'
    WHEN 'ASSIGNED' THEN 'IN_PROGRESS'
    WHEN 'UNDER_ACTION' THEN 'IN_PROGRESS'
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'
    WHEN 'REVIEWED' THEN 'PENDING_APPROVAL'
    WHEN 'REJECTED' THEN 'IN_PROGRESS'
    WHEN 'PENDING_REPLY' THEN 'IN_PROGRESS'
    WHEN 'APPROVED' THEN 'APPROVED'
    WHEN 'DISPATCHED' THEN 'DISPATCHED'
    WHEN 'CLOSED' THEN 'CLOSED'
    WHEN 'COMPLETED' THEN 'CLOSED'
    WHEN 'ARCHIVED' THEN 'ARCHIVED'
    ELSE 'OPEN'
  END::"CorrespondenceStatus_workbook"
$$;

CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE "_workbook_workflow_steps" AS
WITH mapped_steps AS (
  SELECT
    step.*,
    map_workbook_status(step."status"::text) AS mapped_status
  FROM "workflow_steps" step
),
step_groups AS (
  SELECT
    (ARRAY_AGG(step."id" ORDER BY step."order"))[1] AS "id",
    step."definition_id",
    MIN(step."order") AS "order",
    step.mapped_status AS "status",
    (ARRAY_AGG(step."required_role" ORDER BY step."order"))[1] AS "required_role",
    BOOL_OR(step."requires_comment") AS "requires_comment"
  FROM mapped_steps step
  GROUP BY step."definition_id", step.mapped_status
)
SELECT
  grouped."id",
  grouped."definition_id",
  grouped."order",
  grouped."status",
  grouped."required_role",
  grouped."requires_comment",
  COALESCE(
    ARRAY(
      SELECT DISTINCT map_workbook_status(next_status::text)
      FROM mapped_steps source
      CROSS JOIN LATERAL unnest(source."allowed_next_states") AS next_status
      WHERE source."definition_id" = grouped."definition_id"
        AND source.mapped_status = grouped."status"
        AND map_workbook_status(next_status::text) <> grouped."status"
      ORDER BY 1
    ),
    ARRAY[]::"CorrespondenceStatus_workbook"[]
  ) AS "allowed_next_states",
  NOW() AS "created_at",
  NOW() AS "updated_at"
FROM step_groups grouped;

DROP INDEX "workflow_steps_definition_id_status_key";
DELETE FROM "workflow_steps";

ALTER TABLE "correspondence" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "correspondence"
  ALTER COLUMN "status" TYPE "CorrespondenceStatus_workbook"
  USING map_workbook_status("status"::text);
ALTER TABLE "workflows"
  ALTER COLUMN "from_status" TYPE "CorrespondenceStatus_workbook"
  USING CASE WHEN "from_status" IS NULL THEN NULL ELSE map_workbook_status("from_status"::text) END;
ALTER TABLE "workflows"
  ALTER COLUMN "to_status" TYPE "CorrespondenceStatus_workbook"
  USING map_workbook_status("to_status"::text);
ALTER TABLE "workflow_actions"
  ALTER COLUMN "from_status" TYPE "CorrespondenceStatus_workbook"
  USING map_workbook_status("from_status"::text);
ALTER TABLE "workflow_actions"
  ALTER COLUMN "to_status" TYPE "CorrespondenceStatus_workbook"
  USING map_workbook_status("to_status"::text);
ALTER TABLE "workflow_steps"
  ALTER COLUMN "status" TYPE "CorrespondenceStatus_workbook"
  USING map_workbook_status("status"::text);
ALTER TABLE "workflow_steps" DROP COLUMN "allowed_next_states";
DROP TYPE "CorrespondenceStatus";
ALTER TYPE "CorrespondenceStatus_workbook" RENAME TO "CorrespondenceStatus";

ALTER TABLE "correspondence"
  ALTER COLUMN "status" SET DEFAULT 'OPEN'::"CorrespondenceStatus";
ALTER TABLE "workflow_steps"
  ADD COLUMN "allowed_next_states" "CorrespondenceStatus"[] NOT NULL
  DEFAULT ARRAY[]::"CorrespondenceStatus"[];
INSERT INTO "workflow_steps" (
  "id", "definition_id", "order", "status", "required_role",
  "requires_comment", "allowed_next_states", "created_at", "updated_at"
)
SELECT
  "id", "definition_id", "order", "status"::text::"CorrespondenceStatus",
  "required_role", "requires_comment",
  "allowed_next_states"::text::"CorrespondenceStatus"[],
  "created_at", "updated_at"
FROM "_workbook_workflow_steps";
DROP TABLE "_workbook_workflow_steps";
DROP FUNCTION map_workbook_status(TEXT);
CREATE UNIQUE INDEX "workflow_steps_definition_id_status_key"
  ON "workflow_steps"("definition_id", "status");

ALTER TABLE "correspondence"
  ADD COLUMN "organization" VARCHAR(300),
  ADD COLUMN "date_closed" DATE,
  ADD COLUMN "current_action_location" VARCHAR(500),
  ADD COLUMN "file_location" VARCHAR(1000),
  ADD COLUMN "notes" VARCHAR(4000);
ALTER TABLE "correspondence"
  ADD CONSTRAINT "correspondence_date_closed_requires_closed_status"
  CHECK ("date_closed" IS NULL OR "status" IN ('CLOSED', 'ARCHIVED'));

CREATE TABLE "action_items" (
  "id" UUID NOT NULL,
  "correspondence_id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "assigned_to_id" UUID,
  "date_assigned" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_date" DATE NOT NULL,
  "required_action" VARCHAR(2000) NOT NULL,
  "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
  "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
  "completion_date" DATE,
  "remarks" VARCHAR(2000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "action_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "action_items_completion_check"
    CHECK (("status" = 'COMPLETED' AND "completion_date" IS NOT NULL)
      OR ("status" <> 'COMPLETED' AND "completion_date" IS NULL))
);

CREATE INDEX "action_items_correspondence_id_status_idx"
  ON "action_items"("correspondence_id", "status");
CREATE INDEX "action_items_department_id_status_due_date_idx"
  ON "action_items"("department_id", "status", "due_date");
CREATE INDEX "action_items_assigned_to_id_status_due_date_idx"
  ON "action_items"("assigned_to_id", "status", "due_date");
CREATE INDEX "action_items_due_date_status_idx"
  ON "action_items"("due_date", "status");

ALTER TABLE "action_items"
  ADD CONSTRAINT "action_items_correspondence_id_fkey"
    FOREIGN KEY ("correspondence_id") REFERENCES "correspondence"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "action_items_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "action_items_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documents" ADD COLUMN "action_id" UUID;
CREATE INDEX "documents_action_id_idx" ON "documents"("action_id");
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_action_id_fkey"
  FOREIGN KEY ("action_id") REFERENCES "action_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "correspondence_search_vector_idx";
CREATE INDEX "correspondence_search_vector_idx" ON "correspondence" USING GIN (
  to_tsvector(
    'simple',
    coalesce("reference_number", '') || ' ' ||
    coalesce("document_number", '') || ' ' ||
    coalesce("subject", '') || ' ' ||
    coalesce("sender", '') || ' ' ||
    coalesce("recipient", '') || ' ' ||
    coalesce("organization", '') || ' ' ||
    coalesce("country_mission", '') || ' ' ||
    coalesce("current_action_location", '')
  )
);

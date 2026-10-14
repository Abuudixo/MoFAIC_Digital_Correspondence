CREATE TYPE "RetentionAction" AS ENUM ('REVIEW', 'DESTROY', 'TRANSFER', 'PERMANENT');
CREATE TYPE "NotificationKind" AS ENUM ('ASSIGNMENT', 'REVIEW_REQUEST', 'APPROVAL_REQUEST', 'OVERDUE', 'WORKFLOW_UPDATE');

ALTER TABLE "correspondence"
  ADD COLUMN "archived_by_id" UUID,
  ADD COLUMN "retention_category" VARCHAR(120);

ALTER TABLE "documents"
  ADD COLUMN "original_file_name" VARCHAR(255),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "classification" "ConfidentialityLevel" NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN "uploaded_by_id" UUID;
UPDATE "documents" SET "original_file_name" = "file_name";
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "documents_file_size_check" CHECK ("file_size" > 0);

ALTER TABLE "audit_logs" ADD COLUMN "ip_address" VARCHAR(45);

CREATE TABLE "workflow_definitions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_steps" (
    "id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "CorrespondenceStatus" NOT NULL,
    "required_role" VARCHAR(80),
    "requires_comment" BOOLEAN NOT NULL DEFAULT false,
    "allowed_next_states" "CorrespondenceStatus"[] NOT NULL DEFAULT ARRAY[]::"CorrespondenceStatus"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_actions" (
    "id" UUID NOT NULL,
    "correspondence_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "from_status" "CorrespondenceStatus" NOT NULL,
    "to_status" "CorrespondenceStatus" NOT NULL,
    "comment" VARCHAR(2000),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "correspondence_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "assigned_by_id" UUID NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "correspondence_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "decision" VARCHAR(20) NOT NULL,
    "comment" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_version_sequences" (
    "correspondence_id" UUID NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_version_sequences_pkey" PRIMARY KEY ("correspondence_id", "original_file_name")
);

CREATE TABLE "retention_policies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "retention_category" VARCHAR(120) NOT NULL,
    "retention_days" INTEGER,
    "action" "RetentionAction" NOT NULL DEFAULT 'REVIEW',
    "classification" "ConfidentialityLevel",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "retention_policies_retention_days_check" CHECK ("retention_days" IS NULL OR "retention_days" >= 0)
);

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "correspondence_id" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "dedupe_key" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflow_definitions_name_key" ON "workflow_definitions"("name");
CREATE UNIQUE INDEX "workflow_steps_definition_id_order_key" ON "workflow_steps"("definition_id", "order");
CREATE UNIQUE INDEX "workflow_steps_definition_id_status_key" ON "workflow_steps"("definition_id", "status");
CREATE UNIQUE INDEX "retention_policies_name_key" ON "retention_policies"("name");
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
CREATE INDEX "correspondence_archived_by_id_idx" ON "correspondence"("archived_by_id");
CREATE INDEX "correspondence_status_due_date_idx" ON "correspondence"("status", "due_date");
CREATE INDEX "documents_correspondence_id_original_file_name_version_idx" ON "documents"("correspondence_id", "original_file_name", "version");
CREATE INDEX "documents_classification_idx" ON "documents"("classification");
CREATE INDEX "documents_uploaded_by_id_idx" ON "documents"("uploaded_by_id");
CREATE INDEX "workflow_definitions_is_active_idx" ON "workflow_definitions"("is_active");
CREATE INDEX "workflow_steps_status_idx" ON "workflow_steps"("status");
CREATE INDEX "workflow_actions_correspondence_id_created_at_idx" ON "workflow_actions"("correspondence_id", "created_at");
CREATE INDEX "workflow_actions_actor_id_created_at_idx" ON "workflow_actions"("actor_id", "created_at");
CREATE INDEX "workflow_actions_to_status_created_at_idx" ON "workflow_actions"("to_status", "created_at");
CREATE INDEX "assignments_correspondence_id_created_at_idx" ON "assignments"("correspondence_id", "created_at");
CREATE INDEX "assignments_department_id_created_at_idx" ON "assignments"("department_id", "created_at");
CREATE INDEX "assignments_assigned_to_id_created_at_idx" ON "assignments"("assigned_to_id", "created_at");
CREATE INDEX "approvals_correspondence_id_created_at_idx" ON "approvals"("correspondence_id", "created_at");
CREATE INDEX "approvals_actor_id_created_at_idx" ON "approvals"("actor_id", "created_at");
CREATE INDEX "retention_policies_is_active_retention_category_idx" ON "retention_policies"("is_active", "retention_category");
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");
CREATE INDEX "notifications_correspondence_id_created_at_idx" ON "notifications"("correspondence_id", "created_at");
CREATE INDEX "notifications_kind_created_at_idx" ON "notifications"("kind", "created_at");
CREATE INDEX "correspondence_search_vector_idx" ON "correspondence" USING GIN (
  to_tsvector(
    'simple',
    coalesce("reference_number", '') || ' ' ||
    coalesce("subject", '') || ' ' ||
    coalesce("sender", '') || ' ' ||
    coalesce("recipient", '') || ' ' ||
    coalesce("country_mission", '')
  )
);

ALTER TABLE "correspondence" ADD CONSTRAINT "correspondence_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_correspondence_id_fkey" FOREIGN KEY ("correspondence_id") REFERENCES "correspondence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_correspondence_id_fkey" FOREIGN KEY ("correspondence_id") REFERENCES "correspondence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_correspondence_id_fkey" FOREIGN KEY ("correspondence_id") REFERENCES "correspondence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_correspondence_id_fkey" FOREIGN KEY ("correspondence_id") REFERENCES "correspondence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_are_immutable
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

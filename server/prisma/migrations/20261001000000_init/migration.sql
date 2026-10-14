CREATE TYPE "CorrespondenceDirection" AS ENUM ('INCOMING', 'OUTGOING');
CREATE TYPE "CorrespondenceType" AS ENUM ('LETTER', 'MEMORANDUM', 'NOTE_VERBALE', 'EMAIL', 'CIRCULAR', 'OTHER');
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "ConfidentialityLevel" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET');
CREATE TYPE "CorrespondenceStatus" AS ENUM ('DRAFT', 'REGISTERED', 'IN_PROGRESS', 'PENDING_REPLY', 'COMPLETED', 'ARCHIVED');

CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "role_id" UUID NOT NULL,
    "department_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_RolePermissions" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

CREATE TABLE "correspondence" (
    "id" UUID NOT NULL,
    "reference_number" VARCHAR(40) NOT NULL,
    "document_number" VARCHAR(100),
    "direction" "CorrespondenceDirection" NOT NULL,
    "type" "CorrespondenceType" NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "sender" VARCHAR(300) NOT NULL,
    "recipient" VARCHAR(300) NOT NULL,
    "country_mission" VARCHAR(200),
    "department_id" UUID NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "confidentiality" "ConfidentialityLevel" NOT NULL DEFAULT 'INTERNAL',
    "status" "CorrespondenceStatus" NOT NULL DEFAULT 'REGISTERED',
    "date_received" DATE,
    "date_sent" DATE,
    "due_date" DATE,
    "created_by_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "correspondence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "correspondence_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "checksum" VARCHAR(128),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "correspondence_id" UUID NOT NULL,
    "actor_id" UUID,
    "from_status" "CorrespondenceStatus",
    "to_status" "CorrespondenceStatus" NOT NULL,
    "note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100),
    "metadata" JSONB,
    "correspondence_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reference_sequences" (
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reference_sequences_pkey" PRIMARY KEY ("year")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "_RolePermissions_AB_unique" ON "_RolePermissions"("A", "B");
CREATE INDEX "_RolePermissions_B_index" ON "_RolePermissions"("B");
CREATE UNIQUE INDEX "correspondence_reference_number_key" ON "correspondence"("reference_number");
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

CREATE INDEX "users_department_id_idx" ON "users"("department_id");
CREATE INDEX "users_role_id_idx" ON "users"("role_id");
CREATE INDEX "departments_is_active_idx" ON "departments"("is_active");
CREATE INDEX "correspondence_subject_idx" ON "correspondence"("subject");
CREATE INDEX "correspondence_sender_idx" ON "correspondence"("sender");
CREATE INDEX "correspondence_recipient_idx" ON "correspondence"("recipient");
CREATE INDEX "correspondence_country_mission_idx" ON "correspondence"("country_mission");
CREATE INDEX "correspondence_department_id_status_idx" ON "correspondence"("department_id", "status");
CREATE INDEX "correspondence_direction_type_priority_idx" ON "correspondence"("direction", "type", "priority");
CREATE INDEX "correspondence_confidentiality_idx" ON "correspondence"("confidentiality");
CREATE INDEX "correspondence_assigned_to_id_status_idx" ON "correspondence"("assigned_to_id", "status");
CREATE INDEX "correspondence_created_by_id_idx" ON "correspondence"("created_by_id");
CREATE INDEX "correspondence_date_received_idx" ON "correspondence"("date_received");
CREATE INDEX "correspondence_date_sent_idx" ON "correspondence"("date_sent");
CREATE INDEX "correspondence_due_date_idx" ON "correspondence"("due_date");
CREATE INDEX "correspondence_archived_at_idx" ON "correspondence"("archived_at");
CREATE INDEX "documents_correspondence_id_idx" ON "documents"("correspondence_id");
CREATE INDEX "workflows_correspondence_id_created_at_idx" ON "workflows"("correspondence_id", "created_at");
CREATE INDEX "workflows_actor_id_idx" ON "workflows"("actor_id");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_entity_entity_id_created_at_idx" ON "audit_logs"("entity", "entity_id", "created_at");
CREATE INDEX "audit_logs_correspondence_id_created_at_idx" ON "audit_logs"("correspondence_id", "created_at");

ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_A_fkey" FOREIGN KEY ("A") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_B_fkey" FOREIGN KEY ("B") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "correspondence" ADD CONSTRAINT "correspondence_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "correspondence" ADD CONSTRAINT "correspondence_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "correspondence" ADD CONSTRAINT "correspondence_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_correspondence_id_fkey" FOREIGN KEY ("correspondence_id") REFERENCES "correspondence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_correspondence_id_fkey" FOREIGN KEY ("correspondence_id") REFERENCES "correspondence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_correspondence_id_fkey" FOREIGN KEY ("correspondence_id") REFERENCES "correspondence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

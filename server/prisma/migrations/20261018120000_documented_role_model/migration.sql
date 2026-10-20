INSERT INTO "roles" ("id", "name", "description", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'PERMANENT_SECRETARY', 'Permanent Secretary role', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'DEPARTMENT_HEAD', 'Department Head role', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'STAFF', 'Department Staff role', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

UPDATE "users" AS user_record
SET "role_id" = target_role."id"
FROM "roles" AS old_role
CROSS JOIN "roles" AS target_role
WHERE user_record."role_id" = old_role."id"
  AND target_role."name" = CASE
    WHEN old_role."name" = 'DIRECTOR' THEN 'DEPARTMENT_HEAD'
    ELSE 'STAFF'
  END
  AND old_role."name" IN (
    'DIRECTOR',
    'DEPARTMENT_USER',
    'REGISTRAR',
    'OFFICER',
    'USER',
    'REVIEWER'
  );

UPDATE "workflow_steps"
SET "required_role" = 'DEPARTMENT_HEAD'
WHERE "required_role" = 'DIRECTOR';

DELETE FROM "_RolePermissions"
WHERE "B" IN (
    SELECT "id"
    FROM "roles"
    WHERE "name" IN (
      'ADMIN',
      'PERMANENT_SECRETARY',
      'DEPARTMENT_HEAD',
      'STAFF',
      'DIRECTOR',
      'DEPARTMENT_USER',
      'REGISTRAR',
      'OFFICER',
      'USER',
      'REVIEWER'
    )
);

DELETE FROM "roles"
WHERE "name" IN (
    'DIRECTOR',
    'DEPARTMENT_USER',
    'REGISTRAR',
    'OFFICER',
    'USER',
    'REVIEWER'
);

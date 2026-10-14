INSERT INTO "permissions" (
    "id",
    "name",
    "description",
    "created_at",
    "updated_at"
)
VALUES (
    gen_random_uuid(),
    'users:manage:department',
    'Allows directors to manage users in their department',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "_RolePermissions" ("A", "B")
SELECT permission."id", role."id"
FROM "roles" AS role
JOIN "permissions" AS permission
  ON permission."name" = 'users:manage:department'
WHERE role."name" = 'DIRECTOR'
ON CONFLICT ("A", "B") DO NOTHING;

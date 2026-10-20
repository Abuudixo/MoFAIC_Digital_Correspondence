INSERT INTO "permissions" (
    "id",
    "name",
    "description",
    "created_at",
    "updated_at"
)
VALUES (
    gen_random_uuid(),
    'correspondence:create:any',
    'Allows correspondence creation across departments',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "_RolePermissions" ("A", "B")
SELECT permission."id", role."id"
FROM (
    VALUES
        ('ADMIN', 'correspondence:create'),
        ('PERMANENT_SECRETARY', 'correspondence:create'),
        ('PERMANENT_SECRETARY', 'correspondence:create:any')
) AS role_permissions(role_name, permission_name)
JOIN "roles" AS role
  ON role."name" = role_permissions.role_name
JOIN "permissions" AS permission
  ON permission."name" = role_permissions.permission_name
ON CONFLICT ("A", "B") DO NOTHING;

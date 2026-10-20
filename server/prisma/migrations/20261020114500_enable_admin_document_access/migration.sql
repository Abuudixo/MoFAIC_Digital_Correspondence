INSERT INTO "_RolePermissions" ("A", "B")
SELECT permission."id", role."id"
FROM (
    VALUES
        ('ADMIN', 'documents:upload'),
        ('ADMIN', 'documents:read')
) AS role_permissions(role_name, permission_name)
JOIN "roles" AS role
  ON role."name" = role_permissions.role_name
JOIN "permissions" AS permission
  ON permission."name" = role_permissions.permission_name
ON CONFLICT ("A", "B") DO NOTHING;

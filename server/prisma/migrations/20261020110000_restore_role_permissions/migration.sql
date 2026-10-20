INSERT INTO "permissions" (
    "id",
    "name",
    "description",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    permission_name,
    'Allows ' || replace(permission_name, ':', ' '),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    VALUES
        ('users:manage'),
        ('departments:manage'),
        ('correspondence:create'),
        ('correspondence:read:any'),
        ('correspondence:read:department'),
        ('correspondence:read:assigned'),
        ('correspondence:read:confidential'),
        ('correspondence:read:restricted'),
        ('correspondence:read:secret'),
        ('correspondence:update'),
        ('correspondence:classify'),
        ('correspondence:archive'),
        ('audit:read'),
        ('correspondence:assign'),
        ('correspondence:assign:any'),
        ('correspondence:action'),
        ('correspondence:review'),
        ('correspondence:approve'),
        ('correspondence:dispatch'),
        ('correspondence:close'),
        ('correspondence:read:archive'),
        ('documents:upload'),
        ('documents:read'),
        ('workflow:manage'),
        ('retention:manage'),
        ('reports:read')
) AS required_permissions(permission_name)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "_RolePermissions" ("A", "B")
SELECT permission."id", role."id"
FROM (
    VALUES
        ('ADMIN', 'users:manage'),
        ('ADMIN', 'departments:manage'),
        ('ADMIN', 'audit:read'),
        ('ADMIN', 'workflow:manage'),
        ('ADMIN', 'retention:manage'),
        ('ADMIN', 'reports:read'),
        ('PERMANENT_SECRETARY', 'correspondence:read:any'),
        ('PERMANENT_SECRETARY', 'correspondence:update'),
        ('PERMANENT_SECRETARY', 'correspondence:assign'),
        ('PERMANENT_SECRETARY', 'correspondence:assign:any'),
        ('PERMANENT_SECRETARY', 'correspondence:action'),
        ('PERMANENT_SECRETARY', 'correspondence:review'),
        ('PERMANENT_SECRETARY', 'audit:read'),
        ('PERMANENT_SECRETARY', 'documents:upload'),
        ('PERMANENT_SECRETARY', 'documents:read'),
        ('PERMANENT_SECRETARY', 'reports:read'),
        ('DEPARTMENT_HEAD', 'correspondence:read:department'),
        ('DEPARTMENT_HEAD', 'correspondence:create'),
        ('DEPARTMENT_HEAD', 'correspondence:update'),
        ('DEPARTMENT_HEAD', 'correspondence:assign'),
        ('DEPARTMENT_HEAD', 'correspondence:action'),
        ('DEPARTMENT_HEAD', 'correspondence:review'),
        ('DEPARTMENT_HEAD', 'audit:read'),
        ('DEPARTMENT_HEAD', 'documents:upload'),
        ('DEPARTMENT_HEAD', 'documents:read'),
        ('DEPARTMENT_HEAD', 'reports:read'),
        ('STAFF', 'correspondence:create'),
        ('STAFF', 'correspondence:read:assigned'),
        ('STAFF', 'correspondence:update'),
        ('STAFF', 'correspondence:action'),
        ('STAFF', 'correspondence:review'),
        ('STAFF', 'documents:upload'),
        ('STAFF', 'documents:read'),
        ('STAFF', 'reports:read')
) AS role_permissions(role_name, permission_name)
JOIN "roles" AS role
  ON role."name" = role_permissions.role_name
JOIN "permissions" AS permission
  ON permission."name" = role_permissions.permission_name
ON CONFLICT ("A", "B") DO NOTHING;

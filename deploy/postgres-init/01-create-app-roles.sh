#!/bin/sh
set -eu

: "${APP_DATABASE_USER:?Set APP_DATABASE_USER}"
: "${APP_DATABASE_PASSWORD:?Set APP_DATABASE_PASSWORD}"
: "${MIGRATION_DATABASE_USER:?Set MIGRATION_DATABASE_USER}"
: "${MIGRATION_DATABASE_PASSWORD:?Set MIGRATION_DATABASE_PASSWORD}"

psql --set=ON_ERROR_STOP=1 \
  --set="app_role=$APP_DATABASE_USER" \
  --set="app_password=$APP_DATABASE_PASSWORD" \
  --set="migration_role=$MIGRATION_DATABASE_USER" \
  --set="migration_password=$MIGRATION_DATABASE_PASSWORD" \
  --set="database_name=$POSTGRES_DB" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<'SQL'
CREATE ROLE :"app_role" LOGIN PASSWORD :'app_password';
CREATE ROLE :"migration_role" LOGIN PASSWORD :'migration_password';
GRANT CONNECT ON DATABASE :"database_name" TO :"app_role", :"migration_role";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO :"migration_role";
GRANT USAGE ON SCHEMA public TO :"app_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_role";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_role" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_role" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"app_role";
SQL

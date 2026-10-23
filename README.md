# MoFAIC Digital Correspondence Management

A TypeScript monorepo foundation for a React client and an Express API backed by
PostgreSQL and Prisma. It includes JWT authentication, role and permission
checks, department and user management, correspondence registration and
search, safe archiving, and audit logging.

> This is a development foundation, not a production authorization to process
> confidential Ministry records. Complete formal security review, threat
> modeling, infrastructure controls, access governance, records-retention
> planning, and Ministry authorization before production use. Use fictional
> data only during development.

## Prerequisites

- Node.js 20.19 or newer and npm
- PostgreSQL 14 or newer

## Getting started

1. Copy `.env.example` to `.env`, set a unique `JWT_SECRET` of at least 32
   characters, and never commit `.env`. Uploaded development documents are
   stored in the ignored `.private-documents/` directory by default. If you
   override `DOCUMENT_STORAGE_DIR`, use an absolute path for your operating
   system.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`. This starts the local embedded database,
   applies pending migrations, generates Prisma Client, seeds development data,
   and launches the API and client. The database persists in the ignored
   `.data/` folder. The API health check is at
   `http://127.0.0.1:3000/api/health`; the client is at
   `http://localhost:5173`.

To use an installed PostgreSQL database instead of the local embedded database,
configure `DATABASE_URL`, then generate Prisma Client and prepare the database:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
```

Then start the API and client with `npm run dev:postgres`. For remote
deployment, explicitly configure an appropriate `HOST` and `CLIENT_ORIGIN`; the
API binds to loopback by default. Run `npm test`, `npm run lint`, and
`npm run build` to verify the project.

`npm run dev:local-db` is an alias for `npm run dev`. The embedded database is
for local development only; use PostgreSQL for shared or production
environments.

In development, the seed includes fictional Protocol and Finance department
heads and staff, four sample correspondence records, and department notifications.
Demo accounts use `Demo-Only-2026!` with emails
`director.protocol@example.test`, `officer.protocol@example.test`,
`director.finance@example.test`, and `officer.finance@example.test`. These
accounts are not created outside development. If a demo password has been
changed or no longer works, run `npm run db:seed` to restore the demo account
credentials and sample data.

The embedded database uses a small local migration runner because Prisma's
migration engine is not compatible with the PGlite wire-protocol server.
Production and standard PostgreSQL environments should continue to use
`npm run db:deploy`.

## Days 4–7 API

- Workbook-aligned lists are available from `GET /api/lists`: directions,
  document types, classifications, correspondence statuses, priorities, action
  statuses, retention actions, and active units. New reference numbers use
  `COR-YYYY-####`; existing record identifiers are preserved.
- Department Heads see a department-scoped dashboard with approval and
  overdue queues, due dates, officer workload, open-file age, and department
  notifications. Administrators see notifications across all departments.
  The seeded departments follow the 15 units in the workbook's `Lists` sheet.
- Staff access is scoped to correspondence they registered or were assigned;
  Department Heads see their own department. Both roles are blocked from
  approving correspondence unless an explicitly delegated permission is added.
- Correspondence registration captures the workbook's organization, country or
  mission, dates, current action or location, file location, and notes. The
  workflow follows Open → In Progress → Pending Approval → Approved →
  Dispatched → Closed/Archived.
- `POST /api/correspondence/:id/action-items` and `GET
/api/correspondence/:id/action-items` manage multiple unit/person assignments
  per record. `GET /api/actions` and `GET /api/actions/report` provide the
  action tracker and status/overdue totals. Action statuses currently use
  Open, In Progress, and Completed because the workbook does not define this
  vocabulary; confirm it with the process owner.
- Users authorized to assign correspondence can query active unit members with
  `GET /api/departments/:id/assignees`; the response contains only user IDs and
  names, not account or role details.
- Closing correspondence is blocked until all assigned actions are completed
  and a file location or supporting document is present. Approval and review
  comments are required. A configured active retention policy is required
  before archiving; no retention period is invented or applied automatically.
- `POST /api/correspondence/:id/assign` changes department and assignee as an
  audited, transactional action.
- `POST /api/correspondence/:id/actions` records an allowed workflow transition.
  Approval, rejection, assignment, and archiving each have their own protected
  endpoints. Rejections require a comment; approvals require review permission,
  approval permission, and a comment.
- `GET /api/correspondence/:id/workflow` returns chronological assignment,
  approval, and workflow events.
- `POST /api/correspondence/:id/documents` accepts one PDF file as multipart
  field `document` (10 MiB maximum). Classification is
  accepted as an optional multipart text field. Uploaded bytes are validated,
  assigned a random private storage key, hashed, versioned, and never served
  from the public client directory. Optional multipart field `actionId` links
  evidence to an action on the same correspondence. `GET
/api/documents/:documentId/download`
  checks correspondence and document classification before streaming. Previous
  versions remain intact. The register form checks the PDF extension and size
  before creating a correspondence record; the API validates the PDF signature
  and enforces the same 10 MiB limit.
- `GET /api/correspondence?search=term&page=1` uses PostgreSQL full-text search
  and indexed, permission-filtered pagination. Set `includeArchived=true` to
  search archived records when authorized.
- `GET /api/reports/summary`, `/api/reports/overdue`, and
  `/api/reports/retention-review` provide scoped reports. Retention policies
  are configured by administrators: the application does not invent government
  retention periods or delete records automatically.
- `POST /api/workflow-definitions` and `POST /api/retention-policies` configure
  workflow and retention rules using authorized accounts. `GET /api/notifications`
  exposes department notifications to Department Heads and only the
  authenticated user's notifications to other roles.
  `PATCH /api/notifications/:id/read` marks the authenticated user's own
  notification as read.
- The four roles are ADMIN (technical administration), PERMANENT_SECRETARY
  (ministry-wide, classification-limited oversight), DEPARTMENT_HEAD
  (department-scoped operations), and STAFF (assigned correspondence and
  document handling). Administrators can create non-admin role accounts;
  Permanent Secretary accounts do not require a department assignment.
  Existing director and department-user accounts are migrated to Department
  Head and Staff roles respectively; run the database seed after applying
  migrations to install the corresponding permission sets.

Audit rows are append-only at both application and database levels. Search,
assignment, workflow decisions, archive operations, document uploads/downloads,
and policy changes record actor and IP address where available. Logs and
notification messages deliberately exclude correspondence content and document
bytes.

## Deployment, backup, and recovery

`deploy/Dockerfile` builds the API and frontend; `deploy/nginx.Dockerfile`
serves the static frontend and proxies the API over the private Docker network.
Configure the required production secrets in a secret manager and ensure the
reverse-proxy `server_name`, TLS certificate paths, and `CLIENT_ORIGIN` match
the approved deployment hostname before using `deploy/compose.yaml`. Expose
only the reverse proxy publicly. Keep document storage on an encrypted,
private, persistent volume; keep PostgreSQL and the application off the public
network. The application binds to loopback by default unless `HOST` is
explicitly configured for a private container network.

Run database migrations as a separate deployment step with a migration
account, then run the API as a database role limited to its required schema
operations and reads/writes; do not run the API as the PostgreSQL superuser.
The bootstrap seed's default ADMIN role is deliberately highly privileged.
Use a reviewed initial-account provisioning process, change seeded role
permissions to the formally approved access model, and restrict production
network access and credential rotation before deployment.

`deploy/backup-postgres.sh` creates encrypted PostgreSQL custom-format backups
for a configured GPG recipient. Configure an off-server copy through the
organization's approved backup platform, set a reviewed backup-retention
period, protect the encryption key separately from the database, and monitor
backup success. To test restoration in a non-production environment:

```sh
gpg --decrypt backup.dump.gpg |
  pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL"
```

Restore database backups and private document storage together. Test restoration
and integrity checks on isolated fictional data on a schedule approved by the
records owner. Document incident response, restoration targets, backup access,
and the appropriate retention/disposal process with authorized records and
security teams; deployment templates are not production approval.

For local deployment, create `.env` from `.env.example`. Keep that file
untracked. `DOCUMENT_STORAGE_DIR` must be an absolute, private filesystem path;
do not place it inside `client/public`, `client/dist`, or a web-served directory.

The seed never creates a default or known administrator. To provision the first
administrator, set `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and
`BOOTSTRAP_ADMIN_PASSWORD` to an individually chosen name, email, and password
of at least 12 characters in your untracked `.env`, and run `npm run db:seed`.
All three values are required together. Remove the bootstrap password from the
environment after provisioning. The user-creation API is administrator-only.

## API

All API responses use JSON. Register the first authorized user through the
provisioning process; administrators create Permanent Secretary, Department
Head, and Staff accounts.
Authenticate using `POST /api/auth/login` and send the access token as
`Authorization: Bearer <token>`.

- `GET /api/health` — liveness check.
- `GET /api/health/ready` — database readiness check.
- `POST /api/auth/login`, `GET /api/auth/me`.
- `/api/users` — administrator creation and listing of ministry user accounts;
  `PATCH /api/users/:id` updates a non-administrator account's name, email,
  role, department, and active status, and optionally resets its password.
- `GET /api/roles` — role options restricted to the authenticated user manager's
  allowed account types.
- `/api/departments` — department list and administrator CRUD.
- `/api/correspondence` — permission-checked registration, filtered pagination,
  details, updates, and controlled archival.
- `GET /api/correspondence/:id/audit` — permission-checked audit history.

New correspondence reference numbers use `COR-YYYY-####` format. A
database-backed, per-year counter is incremented atomically in the same
transaction that creates the correspondence, initial workflow event, and
registration audit record. Existing identifiers remain unchanged. The
workbook's Date Received/Drafted is mapped to `dateReceived`, while Date Sent
remains separate; confirm that mapping with the process owner. The workbook's
suggested folder and filename convention is not imposed on private document
storage: files continue to use random private storage keys, and the optional
file-location field is record metadata only.

## Project structure

```text
client/                 React + TypeScript + Vite
server/prisma/           Prisma schema and fictional seed data
server/src/config/       Environment and Prisma configuration
server/src/controllers/  HTTP handlers
server/src/middleware/   Authentication, authorization, errors
server/src/routes/       API routing
server/src/services/     Domain and database operations
server/src/validators/   Request validation
```

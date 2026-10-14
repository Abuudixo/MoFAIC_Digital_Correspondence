import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(root, ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be configured before applying local migrations.");
}

const migrationDirectory = resolve(root, "server", "prisma", "migrations");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) NOT NULL PRIMARY KEY,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);
  const applied = await client.query(
    'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at',
  );
  const appliedByName = new Map(
    applied.rows.map((migration) => [migration.migration_name, migration]),
  );
  const directories = (
    await readdir(migrationDirectory, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const name of directories) {
    const migrationPath = resolve(migrationDirectory, name, "migration.sql");
    const sql = await readFile(migrationPath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = appliedByName.get(name);
    if (existing && existing.rolled_back_at === null) {
      if (!existing.finished_at) {
        throw new Error(`Migration ${name} has an incomplete database record.`);
      }
      if (existing.checksum !== checksum) {
        throw new Error(`Applied migration ${name} has been modified.`);
      }
      continue;
    }

    console.info(`Applying local migration ${name}.`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES ($1, $2, NOW(), $3, NOW(), 1)',
        [randomUUID(), checksum, name],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.info("Local database migrations are up to date.");
} finally {
  await client.end();
}

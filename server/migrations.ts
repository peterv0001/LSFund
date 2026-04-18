import { pool } from "./db";
import { PoolClient } from "pg";

const ADVISORY_LOCK_KEY = 8_675_309;

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function hasRun(client: PoolClient, name: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = $1) AS exists`,
    [name]
  );
  return result.rows[0].exists;
}

async function markRun(client: PoolClient, name: string): Promise<void> {
  await client.query(
    `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
    [name]
  );
}

type Migration = {
  name: string;
  run: (client: PoolClient) => Promise<void>;
};

const migrations: Migration[] = [
  {
    name: "001_add_paused_at_column",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_at timestamp
      `);
      console.log("[migrations] Added paused_at column to subscriptions table");
    },
  },
  {
    name: "002_backfill_paused_at",
    async run(client) {
      const result = await client.query(`
        UPDATE subscriptions
        SET paused_at = updated_at
        WHERE status = 'paused' AND paused_at IS NULL
      `);
      const count = result.rowCount ?? 0;
      console.log(
        `[migrations] Backfilled paused_at for ${count} paused subscription(s)`
      );
    },
  },
  {
    name: "003_add_reactivated_columns",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reactivated_at timestamp
      `);
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reactivated_by_id integer
      `);
      console.log("[migrations] Added reactivated_at and reactivated_by_id columns to subscriptions table");
    },
  },
];

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [ADVISORY_LOCK_KEY]);
    try {
      await ensureMigrationsTable(client);

      for (const migration of migrations) {
        const alreadyRun = await hasRun(client, migration.name);
        if (alreadyRun) {
          console.log(`[migrations] Skipping ${migration.name} (already applied)`);
          continue;
        }

        console.log(`[migrations] Applying ${migration.name}…`);
        await client.query("BEGIN");
        try {
          await migration.run(client);
          await markRun(client, migration.name);
          await client.query("COMMIT");
          console.log(`[migrations] ${migration.name} applied`);
        } catch (err) {
          await client.query("ROLLBACK");
          console.error(
            `[migrations] ${migration.name} failed — transaction rolled back`,
            err
          );
          throw err;
        }
      }
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

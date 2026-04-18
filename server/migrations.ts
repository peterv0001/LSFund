import { pool as defaultPool } from "./db";
import { Pool, PoolClient } from "pg";

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

async function unmarkRun(client: PoolClient, name: string): Promise<void> {
  await client.query(`DELETE FROM schema_migrations WHERE name = $1`, [name]);
}

export type Migration = {
  name: string;
  run: (client: PoolClient) => Promise<void>;
  down?: (client: PoolClient) => Promise<void>;
};

export const migrations: Migration[] = [
  {
    name: "001_add_paused_at_column",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_at timestamp
      `);
      console.log("[migrations] Added paused_at column to subscriptions table");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS paused_at
      `);
      console.log("[migrations] Dropped paused_at column from subscriptions table");
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
    async down(client) {
      // NOTE: This clears paused_at for all currently-paused rows.
      // If the migration is reverted long after deploy, any paused_at values
      // that were legitimately set after the backfill will also be cleared.
      // This rollback is safest when applied shortly after the forward migration.
      const result = await client.query(`
        UPDATE subscriptions
        SET paused_at = NULL
        WHERE status = 'paused'
      `);
      const count = result.rowCount ?? 0;
      console.log(
        `[migrations] Cleared backfilled paused_at for ${count} paused subscription(s)`
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
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS reactivated_at
      `);
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS reactivated_by_id
      `);
      console.log("[migrations] Dropped reactivated_at and reactivated_by_id columns from subscriptions table");
    },
  },
  {
    name: "004_add_cancelled_and_paused_by_columns",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamp
      `);
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_by_id integer
      `);
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_by_id integer
      `);
      console.log("[migrations] Added cancelled_at, cancelled_by_id, paused_by_id columns to subscriptions table");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS cancelled_at
      `);
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS cancelled_by_id
      `);
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS paused_by_id
      `);
      console.log("[migrations] Dropped cancelled_at, cancelled_by_id, paused_by_id columns from subscriptions table");
    },
  },
  {
    name: "005_add_subscription_email_preferences",
    async run(client) {
      await client.query(`
        ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS subscription_email_preferences jsonb
        NOT NULL DEFAULT '{"emailOnPaused": true, "emailOnCancelled": true, "emailOnReactivated": true}'::jsonb
      `);
      console.log("[migrations] Added subscription_email_preferences column to agents table");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE agents DROP COLUMN IF EXISTS subscription_email_preferences
      `);
      console.log("[migrations] Dropped subscription_email_preferences column from agents table");
    },
  },
  {
    name: "006_add_subscription_end_date",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS end_date timestamp
      `);
      console.log("[migrations] Added end_date column to subscriptions table");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS end_date
      `);
      console.log("[migrations] Dropped end_date column from subscriptions table");
    },
  },
];

export async function runMigrations(options?: {
  pool?: Pool;
  migrations?: Migration[];
}): Promise<void> {
  const pool = options?.pool ?? defaultPool;
  const migrationList = options?.migrations ?? migrations;

  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [ADVISORY_LOCK_KEY]);
    try {
      await ensureMigrationsTable(client);

      for (const migration of migrationList) {
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

/**
 * Applies a single named migration that has not yet been applied. Runs its
 * `run` function inside a transaction. On success the row is inserted into
 * `schema_migrations`. On failure the transaction is rolled back.
 */
export async function applyMigration(
  name: string,
  options?: {
    pool?: Pool;
    migrations?: Migration[];
  }
): Promise<void> {
  const pool = options?.pool ?? defaultPool;
  const migrationList = options?.migrations ?? migrations;

  const migration = migrationList.find((m) => m.name === name);
  if (!migration) {
    throw new Error(`Migration "${name}" not found`);
  }

  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [ADVISORY_LOCK_KEY]);
    try {
      await ensureMigrationsTable(client);

      const alreadyApplied = await hasRun(client, name);
      if (alreadyApplied) {
        throw new Error(`Migration "${name}" has already been applied`);
      }

      console.log(`[migrations] Applying ${name}…`);
      await client.query("BEGIN");
      try {
        await migration.run(client);
        await markRun(client, name);
        await client.query("COMMIT");
        console.log(`[migrations] ${name} applied`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(
          `[migrations] ${name} failed — transaction rolled back`,
          err
        );
        throw err;
      }
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

/**
 * Reverts a previously applied migration by running its `down` function inside
 * a transaction. On success the row is removed from `schema_migrations`.
 * On failure the transaction is rolled back, leaving the database unchanged.
 *
 * Important: migrations should generally be reverted in reverse-application
 * order. Rolling back a migration that later migrations depend on can leave
 * the database in an inconsistent state.
 */
export async function revertMigration(
  name: string,
  options?: {
    pool?: Pool;
    migrations?: Migration[];
  }
): Promise<void> {
  const pool = options?.pool ?? defaultPool;
  const migrationList = options?.migrations ?? migrations;

  const migration = migrationList.find((m) => m.name === name);
  if (!migration) {
    throw new Error(`Migration "${name}" not found`);
  }
  if (!migration.down) {
    throw new Error(`Migration "${name}" does not have a down function`);
  }

  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [ADVISORY_LOCK_KEY]);
    try {
      await ensureMigrationsTable(client);

      const applied = await hasRun(client, name);
      if (!applied) {
        throw new Error(`Migration "${name}" has not been applied`);
      }

      console.log(`[migrations] Reverting ${name}…`);
      await client.query("BEGIN");
      try {
        await migration.down!(client);
        await unmarkRun(client, name);
        await client.query("COMMIT");
        console.log(`[migrations] ${name} reverted`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(
          `[migrations] ${name} revert failed — transaction rolled back`,
          err
        );
        throw err;
      }
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

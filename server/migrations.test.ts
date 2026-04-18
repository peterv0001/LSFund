import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { runMigrations, revertMigration, type Migration } from "./migrations.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run migration tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

const TEST_TABLE = "migration_test_sentinel_table";
const GOOD_MIGRATION_NAME = "test_good_migration_" + Date.now();
const BAD_MIGRATION_NAME = "test_bad_migration_" + Date.now();
const REVERT_MIGRATION_NAME = "test_revert_migration_" + Date.now();
const NO_DOWN_MIGRATION_NAME = "test_no_down_migration_" + Date.now();
const REVERT_TABLE = "migration_revert_test_table_" + Date.now();

async function tableExists(tableName: string): Promise<boolean> {
  const client = await testPool.connect();
  try {
    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists`,
      [tableName]
    );
    return result.rows[0].exists;
  } finally {
    client.release();
  }
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const client = await testPool.connect();
  try {
    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
      ) AS exists`,
      [tableName, columnName]
    );
    return result.rows[0].exists;
  } finally {
    client.release();
  }
}

async function migrationRecorded(name: string): Promise<boolean> {
  const client = await testPool.connect();
  try {
    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM schema_migrations WHERE name = $1
      ) AS exists`,
      [name]
    );
    return result.rows[0].exists;
  } finally {
    client.release();
  }
}

async function cleanup() {
  const client = await testPool.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
    await client.query(`DROP TABLE IF EXISTS ${REVERT_TABLE}`);
    const tableCheck = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'schema_migrations'
      ) AS exists`
    );
    if (tableCheck.rows[0].exists) {
      await client.query(
        `DELETE FROM schema_migrations WHERE name IN ($1, $2, $3, $4)`,
        [GOOD_MIGRATION_NAME, BAD_MIGRATION_NAME, REVERT_MIGRATION_NAME, NO_DOWN_MIGRATION_NAME]
      );
    }
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await testPool.end();
});

describe("runMigrations transaction safety", () => {
  it("rolls back schema changes when a migration throws", async () => {
    const badMigration: Migration = {
      name: BAD_MIGRATION_NAME,
      async run(client) {
        await client.query(`CREATE TABLE ${TEST_TABLE} (id serial primary key)`);
        throw new Error("Deliberate migration failure");
      },
    };

    await expect(
      runMigrations({ pool: testPool, migrations: [badMigration] })
    ).rejects.toThrow("Deliberate migration failure");

    const tableCreated = await tableExists(TEST_TABLE);
    expect(tableCreated).toBe(false);
  });

  it("does not record a failed migration in schema_migrations", async () => {
    const recorded = await migrationRecorded(BAD_MIGRATION_NAME);
    expect(recorded).toBe(false);
  });

  it("retries a previously failed migration on the next call to runMigrations", async () => {
    let runCount = 0;

    const retryMigration: Migration = {
      name: BAD_MIGRATION_NAME,
      async run(client) {
        runCount++;
        if (runCount === 1) {
          throw new Error("First attempt fails");
        }
        await client.query(`CREATE TABLE ${TEST_TABLE} (id serial primary key)`);
      },
    };

    await expect(
      runMigrations({ pool: testPool, migrations: [retryMigration] })
    ).rejects.toThrow("First attempt fails");

    expect(runCount).toBe(1);

    await runMigrations({ pool: testPool, migrations: [retryMigration] });

    expect(runCount).toBe(2);

    const recorded = await migrationRecorded(BAD_MIGRATION_NAME);
    expect(recorded).toBe(true);

    const tableCreated = await tableExists(TEST_TABLE);
    expect(tableCreated).toBe(true);
  });

  it("skips a migration that has already been recorded", async () => {
    let runCount = 0;

    const goodMigration: Migration = {
      name: GOOD_MIGRATION_NAME,
      async run() {
        runCount++;
      },
    };

    await runMigrations({ pool: testPool, migrations: [goodMigration] });
    expect(runCount).toBe(1);

    await runMigrations({ pool: testPool, migrations: [goodMigration] });
    expect(runCount).toBe(1);
  });
});

describe("revertMigration", () => {
  const revertMigration_fixture: Migration = {
    name: REVERT_MIGRATION_NAME,
    async run(client) {
      await client.query(`CREATE TABLE ${REVERT_TABLE} (id serial primary key)`);
    },
    async down(client) {
      await client.query(`DROP TABLE IF EXISTS ${REVERT_TABLE}`);
    },
  };

  it("runs the down function and removes the migration record", async () => {
    await runMigrations({ pool: testPool, migrations: [revertMigration_fixture] });

    expect(await tableExists(REVERT_TABLE)).toBe(true);
    expect(await migrationRecorded(REVERT_MIGRATION_NAME)).toBe(true);

    await revertMigration(REVERT_MIGRATION_NAME, {
      pool: testPool,
      migrations: [revertMigration_fixture],
    });

    expect(await tableExists(REVERT_TABLE)).toBe(false);
    expect(await migrationRecorded(REVERT_MIGRATION_NAME)).toBe(false);
  });

  it("rolls back and keeps the migration record when the down function throws", async () => {
    const SIDE_EFFECT_TABLE = "migration_side_effect_test_" + Date.now();
    const failingDownMigration: Migration = {
      name: REVERT_MIGRATION_NAME,
      async run(client) {
        await client.query(`CREATE TABLE ${REVERT_TABLE} (id serial primary key)`);
      },
      async down(client) {
        await client.query(`CREATE TABLE ${SIDE_EFFECT_TABLE} (id serial primary key)`);
        throw new Error("Deliberate down failure");
      },
    };

    await runMigrations({ pool: testPool, migrations: [failingDownMigration] });
    expect(await migrationRecorded(REVERT_MIGRATION_NAME)).toBe(true);
    expect(await tableExists(REVERT_TABLE)).toBe(true);

    await expect(
      revertMigration(REVERT_MIGRATION_NAME, {
        pool: testPool,
        migrations: [failingDownMigration],
      })
    ).rejects.toThrow("Deliberate down failure");

    expect(await migrationRecorded(REVERT_MIGRATION_NAME)).toBe(true);
    expect(await tableExists(SIDE_EFFECT_TABLE)).toBe(false);
  });

  it("throws when the migration name is not found in the list", async () => {
    await expect(
      revertMigration("nonexistent_migration", {
        pool: testPool,
        migrations: [revertMigration_fixture],
      })
    ).rejects.toThrow('Migration "nonexistent_migration" not found');
  });

  it("throws when the migration has no down function", async () => {
    const noDownMigration: Migration = {
      name: NO_DOWN_MIGRATION_NAME,
      async run() {},
    };

    await runMigrations({ pool: testPool, migrations: [noDownMigration] });

    await expect(
      revertMigration(NO_DOWN_MIGRATION_NAME, {
        pool: testPool,
        migrations: [noDownMigration],
      })
    ).rejects.toThrow(`Migration "${NO_DOWN_MIGRATION_NAME}" does not have a down function`);
  });

  it("throws when the migration has not been applied", async () => {
    const unappliedMigration: Migration = {
      name: "test_unapplied_" + Date.now(),
      async run() {},
      async down() {},
    };

    await expect(
      revertMigration(unappliedMigration.name, {
        pool: testPool,
        migrations: [unappliedMigration],
      })
    ).rejects.toThrow(`Migration "${unappliedMigration.name}" has not been applied`);
  });
});

describe("003_add_reactivated_columns rollback", () => {
  const MIGRATION_NAME = "003_add_reactivated_columns";
  const migration: Migration = {
    name: MIGRATION_NAME,
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reactivated_at timestamp
      `);
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reactivated_by_id integer
      `);
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS reactivated_at
      `);
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS reactivated_by_id
      `);
    },
  };

  afterAll(async () => {
    const client = await testPool.connect();
    try {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reactivated_at timestamp
      `);
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reactivated_by_id integer
      `);
      await client.query(
        `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [MIGRATION_NAME]
      );
    } finally {
      client.release();
    }
  });

  it("drops reactivated_at and reactivated_by_id columns and removes the migration record", async () => {
    await runMigrations({ pool: testPool, migrations: [migration] });

    expect(await columnExists("subscriptions", "reactivated_at")).toBe(true);
    expect(await columnExists("subscriptions", "reactivated_by_id")).toBe(true);
    expect(await migrationRecorded(MIGRATION_NAME)).toBe(true);

    await revertMigration(MIGRATION_NAME, { pool: testPool, migrations: [migration] });

    expect(await columnExists("subscriptions", "reactivated_at")).toBe(false);
    expect(await columnExists("subscriptions", "reactivated_by_id")).toBe(false);
    expect(await migrationRecorded(MIGRATION_NAME)).toBe(false);
  });
});

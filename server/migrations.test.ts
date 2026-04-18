import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import pg from "pg";
import { runMigrations, type Migration } from "./migrations.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run migration tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

const TEST_TABLE = "migration_test_sentinel_table";
const GOOD_MIGRATION_NAME = "test_good_migration_" + Date.now();
const BAD_MIGRATION_NAME = "test_bad_migration_" + Date.now();

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
    const tableCheck = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'schema_migrations'
      ) AS exists`
    );
    if (tableCheck.rows[0].exists) {
      await client.query(
        `DELETE FROM schema_migrations WHERE name IN ($1, $2)`,
        [GOOD_MIGRATION_NAME, BAD_MIGRATION_NAME]
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

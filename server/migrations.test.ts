import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import pg from "pg";
import {
  runMigrations,
  revertMigration,
  applyMigration,
  findDuplicatePlacements,
  formatDuplicatePlacementReport,
  MigrationDeferredError,
  DUPLICATE_PLACEMENT_ERROR_PREFIX,
  migrations,
  type Migration,
} from "./migrations.js";

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

describe("004_add_cancelled_and_paused_by_columns rollback", () => {
  const MIGRATION_NAME = "004_add_cancelled_and_paused_by_columns";
  const migration: Migration = {
    name: MIGRATION_NAME,
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
    },
  };

  afterAll(async () => {
    const client = await testPool.connect();
    try {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamp
      `);
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_by_id integer
      `);
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_by_id integer
      `);
      await client.query(
        `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [MIGRATION_NAME]
      );
    } finally {
      client.release();
    }
  });

  it("drops cancelled_at, cancelled_by_id, and paused_by_id columns and removes the migration record", async () => {
    await runMigrations({ pool: testPool, migrations: [migration] });

    expect(await columnExists("subscriptions", "cancelled_at")).toBe(true);
    expect(await columnExists("subscriptions", "cancelled_by_id")).toBe(true);
    expect(await columnExists("subscriptions", "paused_by_id")).toBe(true);
    expect(await migrationRecorded(MIGRATION_NAME)).toBe(true);

    await revertMigration(MIGRATION_NAME, { pool: testPool, migrations: [migration] });

    expect(await columnExists("subscriptions", "cancelled_at")).toBe(false);
    expect(await columnExists("subscriptions", "cancelled_by_id")).toBe(false);
    expect(await columnExists("subscriptions", "paused_by_id")).toBe(false);
    expect(await migrationRecorded(MIGRATION_NAME)).toBe(false);
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

describe("applyMigration – ordering check", () => {
  const ts = Date.now();
  const NAME_A = `test_ordering_a_${ts}`;
  const NAME_B = `test_ordering_b_${ts}`;
  const NAME_C = `test_ordering_c_${ts}`;

  const noopMigration = (name: string): Migration => ({
    name,
    async run(client) {
      // no schema change needed for ordering tests
    },
    async down(client) {
      // no-op
    },
  });

  const orderedMigrations: Migration[] = [
    noopMigration(NAME_A),
    noopMigration(NAME_B),
    noopMigration(NAME_C),
  ];

  async function removeRecord(name: string) {
    const client = await testPool.connect();
    try {
      await client.query(`DELETE FROM schema_migrations WHERE name = $1`, [name]);
    } finally {
      client.release();
    }
  }

  afterEach(async () => {
    // Clean up any records created during tests
    for (const name of [NAME_A, NAME_B, NAME_C]) {
      await removeRecord(name);
    }
  });

  it("applies successfully when all earlier migrations are already applied", async () => {
    // Mark A and B as applied first
    const client = await testPool.connect();
    try {
      await client.query(
        `INSERT INTO schema_migrations (name) VALUES ($1), ($2) ON CONFLICT DO NOTHING`,
        [NAME_A, NAME_B]
      );
    } finally {
      client.release();
    }

    await expect(
      applyMigration(NAME_C, { pool: testPool, migrations: orderedMigrations })
    ).resolves.toBeUndefined();

    expect(await migrationRecorded(NAME_C)).toBe(true);
  });

  it("throws when an earlier migration has not been applied", async () => {
    // Only A is applied; B is missing; try to apply C
    const client = await testPool.connect();
    try {
      await client.query(
        `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [NAME_A]
      );
    } finally {
      client.release();
    }

    await expect(
      applyMigration(NAME_C, { pool: testPool, migrations: orderedMigrations })
    ).rejects.toThrow(NAME_B);

    // C should not have been recorded
    expect(await migrationRecorded(NAME_C)).toBe(false);
  });

  it("includes all missing predecessor names in the error message", async () => {
    // Neither A nor B are applied; try to apply C
    await expect(
      applyMigration(NAME_C, { pool: testPool, migrations: orderedMigrations })
    ).rejects.toSatisfy((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      return msg.includes(NAME_A) && msg.includes(NAME_B);
    });
  });

  it("applies the first migration in the list without any ordering check", async () => {
    // A is first — no predecessors to check
    await expect(
      applyMigration(NAME_A, { pool: testPool, migrations: orderedMigrations })
    ).resolves.toBeUndefined();

    expect(await migrationRecorded(NAME_A)).toBe(true);
  });
});

describe("formatDuplicatePlacementReport", () => {
  it("starts with the recognizable prefix and lists each conflicting slot", () => {
    const report = formatDuplicatePlacementReport([
      { placementId: 42, leg: "left", agentIds: [7, 19] },
      { placementId: 99, leg: "right", agentIds: [3, 4, 5] },
    ]);

    expect(report.startsWith(DUPLICATE_PLACEMENT_ERROR_PREFIX)).toBe(true);
    // Both conflicting parent slots are named
    expect(report).toContain("Parent agent #42, left leg: agents #7, #19");
    expect(report).toContain("Parent agent #99, right leg: agents #3, #4, #5");
    // Counts: 2 slots, 5 agents total
    expect(report).toContain("2 placement slots");
    expect(report).toContain("5 agents in conflict");
  });

  it("uses singular wording for a single conflicting slot", () => {
    const report = formatDuplicatePlacementReport([
      { placementId: 1, leg: "left", agentIds: [10, 11] },
    ]);
    expect(report).toContain("1 placement slot is occupied");
  });
});

describe("runMigrations deferral (MigrationDeferredError)", () => {
  const ts = Date.now();
  const DEFER_NAME = `test_defer_${ts}`;
  const AFTER_NAME = `test_after_defer_${ts}`;

  afterEach(async () => {
    const client = await testPool.connect();
    try {
      await client.query(`DELETE FROM schema_migrations WHERE name IN ($1, $2)`, [
        DEFER_NAME,
        AFTER_NAME,
      ]);
    } finally {
      client.release();
    }
  });

  it("does not crash, leaves the migration pending, and continues to later migrations", async () => {
    let afterRan = false;
    const list: Migration[] = [
      {
        name: DEFER_NAME,
        async run() {
          throw new MigrationDeferredError("deferred for testing");
        },
      },
      {
        name: AFTER_NAME,
        async run() {
          afterRan = true;
        },
      },
    ];

    // Should resolve (not reject) despite the deferral
    await expect(
      runMigrations({ pool: testPool, migrations: list })
    ).resolves.toBeUndefined();

    // Deferred migration stays pending; the later one still applies
    expect(await migrationRecorded(DEFER_NAME)).toBe(false);
    expect(afterRan).toBe(true);
    expect(await migrationRecorded(AFTER_NAME)).toBe(true);
  });
});

describe("016 placement uniqueness guard", () => {
  const M016 = "016_add_agents_placement_leg_unique_index";
  const m016 = migrations.find((m) => m.name === M016)!;
  const ts = Date.now();
  const PARENT = 990000000 + (ts % 1000000); // arbitrary; agents.placement_id has no FK
  const emailA = `placement_dup_a_${ts}@test.local`;
  const emailB = `placement_dup_b_${ts}@test.local`;
  let agentBId: number | null = null;

  async function indexExists(): Promise<boolean> {
    const client = await testPool.connect();
    try {
      const res = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'agents_placement_leg_unique_idx'
        ) AS exists`
      );
      return res.rows[0].exists;
    } finally {
      client.release();
    }
  }

  async function insertAgent(email: string): Promise<number> {
    const client = await testPool.connect();
    try {
      const res = await client.query<{ id: number }>(
        `INSERT INTO agents (email, password, first_name, last_name, placement_id, leg)
         VALUES ($1, 'x', 'Test', 'Dup', $2, 'left') RETURNING id`,
        [email, PARENT]
      );
      return res.rows[0].id;
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    const client = await testPool.connect();
    try {
      // Drop the index so we can stage a duplicate, and un-record 016 so the
      // runner will attempt it again.
      await client.query(`DROP INDEX IF EXISTS agents_placement_leg_unique_idx`);
      await client.query(`DELETE FROM schema_migrations WHERE name = $1`, [M016]);
      await client.query(`DELETE FROM agents WHERE email IN ($1, $2)`, [emailA, emailB]);
    } finally {
      client.release();
    }
    await insertAgent(emailA);
    agentBId = await insertAgent(emailB);
  });

  afterAll(async () => {
    const client = await testPool.connect();
    try {
      await client.query(`DELETE FROM agents WHERE email IN ($1, $2)`, [emailA, emailB]);
    } finally {
      client.release();
    }
    // Restore the index + record so the rest of the suite/app sees normal state.
    await runMigrations({ pool: testPool, migrations: [m016] });
  });

  it("findDuplicatePlacements reports the staged conflict", async () => {
    const client = await testPool.connect();
    try {
      const dupes = await findDuplicatePlacements(client);
      const mine = dupes.find((d) => d.placementId === PARENT && d.leg === "left");
      expect(mine).toBeDefined();
      expect(mine!.agentIds.length).toBe(2);
    } finally {
      client.release();
    }
  });

  it("defers migration 016 (no crash, left pending, index not created) when duplicates exist", async () => {
    await expect(
      runMigrations({ pool: testPool, migrations: [m016] })
    ).resolves.toBeUndefined();

    expect(await migrationRecorded(M016)).toBe(false);
    expect(await indexExists()).toBe(false);
  });

  it("surfaces a clear, prefixed report when an admin tries to apply it directly", async () => {
    await expect(
      applyMigration(M016, { pool: testPool, migrations: [m016] })
    ).rejects.toSatisfy((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      return (
        err instanceof MigrationDeferredError &&
        msg.startsWith(DUPLICATE_PLACEMENT_ERROR_PREFIX) &&
        msg.includes(`#${PARENT}`)
      );
    });

    expect(await migrationRecorded(M016)).toBe(false);
  });

  it("applies cleanly once the duplicate is resolved", async () => {
    // Resolve the conflict by removing one of the two agents in the slot.
    const client = await testPool.connect();
    try {
      await client.query(`DELETE FROM agents WHERE id = $1`, [agentBId]);
    } finally {
      client.release();
    }

    await expect(
      applyMigration(M016, { pool: testPool, migrations: [m016] })
    ).resolves.toBeUndefined();

    expect(await migrationRecorded(M016)).toBe(true);
    expect(await indexExists()).toBe(true);
  });
});

/**
 * Tests the revert-chain 400 guard that fires when any migration in the
 * chain has no rollback (`down`) function defined.
 *
 * This lives in its own file because vi.mock is hoisted: we need a separate
 * module scope so the mock can expose a migration list where one entry is
 * intentionally missing its `down` function.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

// Unique names to avoid collisions with other tests.
const { MIG_A, MIG_B, MIG_C, revertMigrationMock } = vi.hoisted(() => {
  const ts = Date.now();
  return {
    MIG_A: `test_nodown_chain_a_${ts}`,
    MIG_B: `test_nodown_chain_b_${ts}`,
    MIG_C: `test_nodown_chain_c_${ts}`,
    revertMigrationMock: vi.fn(async (_name: string) => {}),
  };
});

// MIG_B deliberately has no `down` function so the 400 guard is triggered.
vi.mock("./migrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./migrations")>();
  const noop = async () => {};
  return {
    ...actual,
    migrations: [
      { name: MIG_A, run: noop, down: noop },
      { name: MIG_B, run: noop },          // ← no down intentionally
      { name: MIG_C, run: noop, down: noop },
    ],
    applyMigration: vi.fn(async () => {}),
    revertMigration: revertMigrationMock,
  };
});

import { registerRoutes } from "./routes.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run migration revert chain no-down tests");
}

const scryptAsync = promisify(scryptCallback);
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const ADMIN_EMAIL = `revert-chain-nodown-admin-${TS}@example.com`;
const ADMIN_PASSWORD = "RevertChainND1!";

let adminId: number;
let testApp: ReturnType<typeof express>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function loginAsAdmin(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

async function markApplied(name: string) {
  await testPool.query(
    `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
    [name]
  );
}

async function unmarkApplied(name: string) {
  await testPool.query(`DELETE FROM schema_migrations WHERE name = $1`, [name]);
}

beforeAll(async () => {
  const [admin] = await db
    .insert(schema.agents)
    .values({
      email: ADMIN_EMAIL,
      password: await hashPassword(ADMIN_PASSWORD),
      firstName: "NoDownChain",
      lastName: "Admin",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: true,
    })
    .returning();
  adminId = admin.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

beforeEach(async () => {
  revertMigrationMock.mockReset();
  revertMigrationMock.mockImplementation(async (_name: string) => {});
  await unmarkApplied(MIG_A);
  await unmarkApplied(MIG_B);
  await unmarkApplied(MIG_C);
});

afterAll(async () => {
  await unmarkApplied(MIG_A);
  await unmarkApplied(MIG_B);
  await unmarkApplied(MIG_C);
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
  await testPool.end();
});

describe("POST /api/admin/migrations/:name/revert-chain – missing rollback guard", () => {
  it("returns 400 and names the migration without a rollback when it is the target", async () => {
    // Only MIG_B applied; MIG_B has no down → 400 even for a single-step chain.
    await markApplied(MIG_B);
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_B}/revert-chain`)
      .set("Cookie", cookie)
      .expect(400);

    expect(res.body.message).toMatch(/no rollback defined/i);
    expect(res.body.message).toContain(MIG_B);
    // The guard fires before any DB work is attempted.
    expect(revertMigrationMock).not.toHaveBeenCalled();
  });

  it("returns 400 and names the migration without a rollback when it is a successor in the chain", async () => {
    // All three applied; MIG_B is a successor of MIG_A and has no down.
    // The guard must catch it before any revert runs.
    await markApplied(MIG_A);
    await markApplied(MIG_B);
    await markApplied(MIG_C);
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_A}/revert-chain`)
      .set("Cookie", cookie)
      .expect(400);

    expect(res.body.message).toMatch(/no rollback defined/i);
    expect(res.body.message).toContain(MIG_B);
    // No revert attempt should have been made at all.
    expect(revertMigrationMock).not.toHaveBeenCalled();
  });

  it("makes no DB changes when the guard fires for a missing rollback", async () => {
    await markApplied(MIG_A);
    await markApplied(MIG_B);
    const cookie = await loginAsAdmin();

    await request(testApp)
      .post(`/api/admin/migrations/${MIG_A}/revert-chain`)
      .set("Cookie", cookie)
      .expect(400);

    // Both migrations must still be recorded as applied (no DB changes).
    const { rows } = await testPool.query<{ name: string }>(
      `SELECT name FROM schema_migrations WHERE name = ANY($1::text[])`,
      [[MIG_A, MIG_B]]
    );
    const stillApplied = rows.map((r) => r.name);
    expect(stillApplied).toContain(MIG_A);
    expect(stillApplied).toContain(MIG_B);
  });

  it("succeeds for migrations that DO have a down function even in the same list", async () => {
    // Only MIG_A applied; MIG_B (no down) is not applied so it is not in the
    // chain. MIG_A has a down → chain of one should succeed.
    await markApplied(MIG_A);
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_A}/revert-chain`)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].name).toBe(MIG_A);
    expect(res.body.results[0].status).toBe("reverted");
    expect(revertMigrationMock).toHaveBeenCalledWith(MIG_A);
  });
});

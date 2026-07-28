import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, like, or } from "drizzle-orm";
import * as schema from "@shared/schema";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

// Unique migration names so the fake migration list never collides with the
// real schema or with other tests running against the same database.
const { MIG_A, MIG_B, MIG_C, revertMigrationMock } = vi.hoisted(() => {
  const ts = Date.now();
  return {
    MIG_A: `test_chain_a_${ts}`,
    MIG_B: `test_chain_b_${ts}`,
    MIG_C: `test_chain_c_${ts}`,
    revertMigrationMock: vi.fn(async (_name: string) => {}),
  };
});

// Replace the real migration list/runners so the admin revert-chain route
// operates on harmless fake migrations (ordered A → B → C) that never touch
// the real schema. Tests can swap out `down` definitions as needed.
vi.mock("./migrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./migrations")>();
  const noop = async () => {};
  return {
    ...actual,
    migrations: [
      { name: MIG_A, run: noop, down: noop },
      { name: MIG_B, run: noop, down: noop },
      { name: MIG_C, run: noop, down: noop },
    ],
    applyMigration: vi.fn(async () => {}),
    revertMigration: revertMigrationMock,
  };
});

import { registerRoutes } from "./routes.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run migration revert chain tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const ADMIN_EMAIL = `revert-chain-admin-${TS}@example.com`;
const ADMIN_PASSWORD = "RevertChain1!";

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
      firstName: "RevertChain",
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
  await db
    .delete(schema.activityLog)
    .where(
      or(
        like(schema.activityLog.description, `%${MIG_A}%`),
        like(schema.activityLog.description, `%${MIG_B}%`),
        like(schema.activityLog.description, `%${MIG_C}%`)
      )
    );
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
  await testPool.end();
});

describe("POST /api/admin/migrations/:name/revert-chain", () => {
  it("reverts the chain in descending order (latest successor first, target last)", async () => {
    // All three applied; reverting chain from A must hit C, B, A in that order.
    await markApplied(MIG_A);
    await markApplied(MIG_B);
    await markApplied(MIG_C);

    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_A}/revert-chain`)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.success).toBe(true);

    // Results array must be in descending order: C → B → A
    const names: string[] = res.body.results.map((r: { name: string }) => r.name);
    expect(names).toEqual([MIG_C, MIG_B, MIG_A]);

    // revertMigration must have been called in the same order
    const calls = revertMigrationMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toEqual([MIG_C, MIG_B, MIG_A]);

    // Every step must report "reverted"
    for (const step of res.body.results) {
      expect(step.status).toBe("reverted");
    }
  });

  it("reverts only the applied subset of the chain in descending order", async () => {
    // Only A and C applied (B skipped); chain for A should revert C then A,
    // leaving B untouched.
    await markApplied(MIG_A);
    await markApplied(MIG_C);

    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_A}/revert-chain`)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.success).toBe(true);

    const names: string[] = res.body.results.map((r: { name: string }) => r.name);
    expect(names).toEqual([MIG_C, MIG_A]);

    const calls = revertMigrationMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toEqual([MIG_C, MIG_A]);
  });

  it("returns 400 when the migration name is not found in the list", async () => {
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/nonexistent_migration/revert-chain`)
      .set("Cookie", cookie)
      .expect(400);

    expect(res.body.message).toMatch(/not found/i);
    expect(revertMigrationMock).not.toHaveBeenCalled();
  });

  it("when a step fails mid-chain: earlier steps stay reverted, the failing step is 'failed', remaining steps are 'skipped'", async () => {
    // Chain order: C (reverted first), B (fails), A (skipped)
    await markApplied(MIG_A);
    await markApplied(MIG_B);
    await markApplied(MIG_C);

    // Make revertMigration fail when called with MIG_B
    revertMigrationMock.mockImplementation(async (name: string) => {
      if (name === MIG_B) {
        throw new Error("Simulated revert failure");
      }
    });

    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_A}/revert-chain`)
      .set("Cookie", cookie)
      .expect(200);

    // Overall success is false because a step failed
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/failed to revert/i);

    const results: { name: string; status: string }[] = res.body.results;
    expect(results).toHaveLength(3);

    // C was processed first and succeeded before B failed
    const cResult = results.find((r) => r.name === MIG_C);
    expect(cResult?.status).toBe("reverted");

    // B is the failing step
    const bResult = results.find((r) => r.name === MIG_B);
    expect(bResult?.status).toBe("failed");

    // A comes after B in the chain (processed last) — must be skipped
    const aResult = results.find((r) => r.name === MIG_A);
    expect(aResult?.status).toBe("skipped");

    // revertMigration was called for C and B but NOT for A
    const calls = revertMigrationMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain(MIG_C);
    expect(calls).toContain(MIG_B);
    expect(calls).not.toContain(MIG_A);
  });

  it("returns 400 when the target migration has not been applied", async () => {
    // None of the test migrations are applied.
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_A}/revert-chain`)
      .set("Cookie", cookie)
      .expect(400);

    expect(res.body.message).toMatch(/has not been applied/i);
    expect(revertMigrationMock).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin users", async () => {
    const agentEmail = `revert-chain-agent-${TS}@example.com`;
    const agentPassword = "AgentPass1!";

    await db.insert(schema.agents).values({
      email: agentEmail,
      password: await hashPassword(agentPassword),
      firstName: "RegularAgent",
      lastName: "NoAdmin",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: false,
    });

    const loginRes = await request(testApp)
      .post("/api/login")
      .send({ username: agentEmail, password: agentPassword });
    const cookie = loginRes.headers["set-cookie"] as unknown as string[];

    await markApplied(MIG_A);

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_A}/revert-chain`)
      .set("Cookie", cookie)
      .expect(403);

    expect(res.body.message).toMatch(/admin/i);
    expect(revertMigrationMock).not.toHaveBeenCalled();
  });
});

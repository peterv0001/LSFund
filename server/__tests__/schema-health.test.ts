import { describe, it, expect, vi, afterEach } from "vitest";
import { getTableColumns, getTableName, isTable } from "drizzle-orm";
import type { PoolClient } from "pg";
import * as schema from "@shared/schema";
import { pool } from "../db.js";
import { checkSchemaHealth } from "../schema-health.js";

function makeMockPoolClient(
  rows: { table_name: string; column_name: string }[]
): PoolClient {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
    release: vi.fn(),
  } as unknown as PoolClient;
}

function getFirstTableAndColumn(): { table: string; column: string } {
  for (const value of Object.values(schema)) {
    if (isTable(value)) {
      const tableName = getTableName(value);
      const cols = getTableColumns(value);
      const colName = Object.values(cols)[0].name;
      return { table: tableName, column: colName };
    }
  }
  throw new Error("No tables found in schema");
}

function buildAllColumnsExceptOne(
  missingTable: string,
  missingColumn: string
): { table_name: string; column_name: string }[] {
  const rows: { table_name: string; column_name: string }[] = [];
  for (const value of Object.values(schema)) {
    if (isTable(value)) {
      const tableName = getTableName(value);
      const columns = getTableColumns(value);
      for (const col of Object.values(columns)) {
        if (tableName === missingTable && col.name === missingColumn) continue;
        rows.push({ table_name: tableName, column_name: col.name });
      }
    }
  }
  return rows;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkSchemaHealth() – healthy case", () => {
  it("returns healthy: true when all expected columns are present in the DB", async () => {
    const result = await checkSchemaHealth();

    expect(result.healthy).toBe(true);
    expect(result.drift).toHaveLength(0);
    expect(result.checkedAt).toBeTruthy();
  });
});

describe("checkSchemaHealth() – drift case", () => {
  it("returns healthy: false and lists the missing column when one column is absent", async () => {
    const { table: missingTable, column: missingColumn } =
      getFirstTableAndColumn();
    const rows = buildAllColumnsExceptOne(missingTable, missingColumn);

    vi.spyOn(pool, "connect").mockResolvedValueOnce(makeMockPoolClient(rows));

    const result = await checkSchemaHealth();

    expect(result.healthy).toBe(false);

    const driftEntry = result.drift.find((d) => d.table === missingTable);
    expect(driftEntry).toBeDefined();
    expect(driftEntry?.missingColumns).toContain(missingColumn);
  });

  it("reports every expected table as having missing columns when the DB returns no rows", async () => {
    vi.spyOn(pool, "connect").mockResolvedValueOnce(makeMockPoolClient([]));

    const result = await checkSchemaHealth();

    expect(result.healthy).toBe(false);
    expect(result.drift.length).toBeGreaterThan(0);
    for (const entry of result.drift) {
      expect(entry.missingColumns.length).toBeGreaterThan(0);
    }
  });
});

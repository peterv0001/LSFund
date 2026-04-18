import { getTableColumns, getTableName, isTable } from "drizzle-orm";
import * as schema from "@shared/schema";
import { pool } from "./db";

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [schema-health] ${message}`);
}

export type ColumnDrift = {
  table: string;
  missingColumns: string[];
};

export type SchemaHealthResult = {
  healthy: boolean;
  drift: ColumnDrift[];
  checkedAt: string;
};

function getExpectedSchema(): Map<string, Set<string>> {
  const expected = new Map<string, Set<string>>();

  for (const value of Object.values(schema)) {
    if (isTable(value)) {
      const tableName = getTableName(value);
      const columns = getTableColumns(value);
      const columnNames = new Set(
        Object.values(columns).map((col) => col.name)
      );
      expected.set(tableName, columnNames);
    }
  }

  return expected;
}

async function getActualSchema(
  tableNames: string[]
): Promise<Map<string, Set<string>>> {
  const actual = new Map<string, Set<string>>();

  if (tableNames.length === 0) return actual;

  const client = await pool.connect();
  try {
    const result = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [tableNames]
    );

    for (const row of result.rows) {
      if (!actual.has(row.table_name)) {
        actual.set(row.table_name, new Set());
      }
      actual.get(row.table_name)!.add(row.column_name);
    }
  } finally {
    client.release();
  }

  return actual;
}

export async function checkSchemaHealth(): Promise<SchemaHealthResult> {
  const expected = getExpectedSchema();
  const tableNames = Array.from(expected.keys());
  const actual = await getActualSchema(tableNames);

  const drift: ColumnDrift[] = [];

  for (const [tableName, expectedCols] of expected) {
    const actualCols = actual.get(tableName);

    if (!actualCols) {
      drift.push({ table: tableName, missingColumns: Array.from(expectedCols) });
      continue;
    }

    const missing = Array.from(expectedCols).filter((col) => !actualCols.has(col));
    if (missing.length > 0) {
      drift.push({ table: tableName, missingColumns: missing });
    }
  }

  return {
    healthy: drift.length === 0,
    drift,
    checkedAt: new Date().toISOString(),
  };
}

export async function logSchemaHealth(): Promise<void> {
  try {
    const result = await checkSchemaHealth();

    if (result.healthy) {
      log("Schema health check passed — all expected columns are present");
      return;
    }

    log(
      `Schema health check FAILED — ${result.drift.length} table(s) have missing columns. Run db:push to sync.`
    );

    for (const { table, missingColumns } of result.drift) {
      console.error(
        `[schema-health] Table "${table}" is missing column(s): ${missingColumns.join(", ")}`
      );
    }
  } catch (err) {
    console.error("[schema-health] Failed to run schema health check:", err);
  }
}

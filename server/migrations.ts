import { pool } from "./db";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    const columnCheck = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'paused_at'
      ) AS exists
    `);

    if (!columnCheck.rows[0].exists) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN paused_at timestamp
      `);
      console.log("[migrations] Added paused_at column to subscriptions table");
    }

    const result = await client.query(`
      UPDATE subscriptions
      SET paused_at = updated_at
      WHERE status = 'paused' AND paused_at IS NULL
    `);

    const count = result.rowCount ?? 0;
    if (count > 0) {
      console.log(`[migrations] Backfilled paused_at for ${count} paused subscription(s)`);
    }
  } finally {
    client.release();
  }
}

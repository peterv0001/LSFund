---
name: adding new tables
description: How to add a new table so both dev and production get it (drizzle push is interactive)
---

# Adding a new table to the schema

This project uses Drizzle (`shared/schema.ts`) **plus** a custom migration runner
(`server/migrations.ts`) that runs on server boot and is the source of truth for
production. A schema-health check (`server/schema-health.ts`) derives expected
columns dynamically from the Drizzle schema, so it auto-covers any new table — no
manual list to update.

**Rule:** every new table needs BOTH (a) the Drizzle table in `shared/schema.ts`
and (b) a numbered migration in `server/migrations.ts` (e.g. `019_create_...`)
using idempotent `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`.
Without the migration, production never gets the table on deploy.

**Why:** `npm run db:push` (drizzle-kit) is **interactive** for new tables — it
prompts "create table vs rename" via a TUI that needs a real TTY, so it hangs /
can't be answered from piped stdin in this environment.

**How to apply (dev):** since db:push can't complete here, create the dev table
directly with `executeSql` (CREATE TABLE IF NOT EXISTS + index) in code_execution,
then add migration 0NN. On the next workflow restart the migration runs (the
IF NOT EXISTS makes it a clean no-op) and records itself as applied. Verify via the
boot logs: `Applying 0NN_... → Created ... table → 0NN_... applied`.

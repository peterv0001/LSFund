---
name: Writing to a Replit production DB that differs from dev
description: How to make writes to the live production database when prod and dev are separate databases
---

# Writing to a production database separate from dev

**Context:** On this project, the live deployment runs on a *different* database
than the workspace (dev had seed data + 8 agents; prod had the 3 real signups).
See `prod-vs-dev-database.md` for why they diverge.

**Constraint 1 — production is read-only to the agent.** `executeSql({environment:"production"})`
hits a read replica; only SELECT works. INSERT/UPDATE/DDL fail there.

**Constraint 2 — the prod connection string is not retrievable.** `viewEnvVars`
shows only secret *existence*, not values; `getDeploymentInfo` returns the URL,
not the DB credentials. The global `DATABASE_URL` secret points at the *dev* DB.

**Constraint 3 — the code_execution sandbox hides `process.env`.** `process.env`
is `undefined` there, so you cannot read a secret value inside `code_execution`.
To use a secret value, run a Node script via the `bash` tool (full env is present
there), e.g. `node script.mjs` reading `process.env.PROD_DATABASE_URL`.

**Working recipe to write to prod:**
1. Ask the user for the production connection string via `requestEnvVar` (e.g.
   `PROD_DATABASE_URL`) — found in the Database tool's Production view.
2. Write a one-off Node script that connects with `pg`
   (`new pg.Client({ connectionString, ssl:{ rejectUnauthorized:false } })`),
   does the work in a `BEGIN/COMMIT` transaction, and self-verifies.
3. Run it with the `bash` tool, then delete the script.
4. Never print secrets, password plaintext, or password hashes to stdout.

**How to apply:** Any task that must mutate live production data (seed an admin,
backfill a column) when dev≠prod. Tell the user they can delete the
`PROD_DATABASE_URL` secret afterward (the agent cannot delete secrets itself).

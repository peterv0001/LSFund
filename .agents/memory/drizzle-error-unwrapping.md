---
name: Drizzle wraps pg errors — unwrap .cause for SQLSTATE checks
description: Newer drizzle-orm throws DrizzleQueryError; the pg fields (code/constraint/detail) live on err.cause, not the top-level error, so naive err.code checks silently fail.
---

# drizzle wraps the pg error — check err.cause, not err.code

Newer `drizzle-orm` (v4.x node-postgres) wraps the underlying `pg` error in a
`DrizzleQueryError`. The SQLSTATE fields you rely on — `code` (e.g. `"23505"`),
`constraint`, `detail` — are NOT on the thrown object; they live on `err.cause`.

**The trap:** a guard like `if (err.code === "23505")` reads `undefined` on the
wrapper and returns false, so unique-violation retry/branch logic silently never
fires. The query still throws; it just isn't recognized.

**Why this is sneaky:** retry-on-collision code (referral-code generation,
binary-tree placement slot retry) *looks* correct and passes most runs, because
the collision it guards against is itself probabilistic. It only fails when two
concurrent writes actually hit the same unique slot — i.e. it shows up as a
*flaky* concurrency test (`agents_placement_leg_unique_idx` 23505 propagating out
of `createAgentWithPlacement` instead of being retried), not a deterministic one.

**How to apply:** any helper that classifies a DB error by SQLSTATE/constraint
must walk the `.cause` chain, not just read top-level fields. See
`isUniqueViolation` in `server/storage.ts` (loops over `err` then `err.cause`).
When a "retry on unique violation" path mysteriously fails under concurrency,
suspect the error is wrapped before assuming the retry logic itself is wrong.

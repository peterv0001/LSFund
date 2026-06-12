---
name: Test DB FK constraints (commissions/subscriptions/agents)
description: Which real DB foreign keys actually exist among the financial tables, and what that means for test teardown ordering.
---

# Real FK constraints among financial tables

The ONLY enforced DB foreign key among agents / subscriptions / commissions /
activity_log is:

- `commissions.subscription_id REFERENCES subscriptions(id) ON DELETE SET NULL`

There are **no** DB FKs on: `agents`, `activity_log.actor_id`,
`commissions.agent_id`, or the subscription actor columns
(`paused_by_id` / `cancelled_by_id` / `reactivated_by_id`). Verify with a
`pg_constraint` query before assuming a constraint exists — table-level Drizzle
`relations()` do NOT create DB FKs.

**Why it matters:** Because the only FK is `ON DELETE SET NULL`, deleting
subscriptions or agents never blocks. The only way to hit a foreign-key
*violation* in the test suite is to **INSERT a commission whose `subscription_id`
no longer exists**. The global route
`POST /api/admin/subscriptions/calculate-commissions` reads ALL active
subscriptions (not scoped to one test/agent) and inserts a commission per sub,
so leftover active subscriptions from a crashed test in an earlier file can make
a later file's run create orphaned commission rows.

**How to apply (test isolation):** teardown must (1) scope cleanup of the global
calculate-commissions route to every active subscription it could have touched
(capture active sub IDs before the call, delete commissions by those
subscriptionIds after), and (2) guarantee each test file leaves no active
subscriptions or orphaned commissions behind — a file-level safety-net `afterAll`
registered LAST (runs first, since afterAll runs in reverse order) that purges
child rows before per-fixture agent/subscription deletes. `vitest.config.ts` has
`fileParallelism: false`, and the expiry scheduler is started only in
`server/index.ts` (NOT in `registerRoutes`), so tests have no background
concurrency — the pollution is purely leaked rows across sequential files.

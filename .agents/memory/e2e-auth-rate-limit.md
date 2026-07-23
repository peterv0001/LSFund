---
name: E2E auth rate limiter
description: Playwright e2e runs against the dev server hit the in-memory auth rate limiter; failures look like login flakes.
---
The dev server (NODE_ENV=development) enforces the auth rate limiter (~20 requests/window) on /api/register and /api/login. Each e2e test that self-registers consumes 2 auth calls, so running more than ~10 such tests in one window fails with `loginRes.ok()` false in setupAgent — it looks like a login flake but is throttling.

**Why:** limiter is skipped only when NODE_ENV=test; the always-running dev workflow is not test env, and the limiter is in-memory.

**How to apply:** restart the "Start application" workflow to reset the limiter, then run e2e specs in batches of ≤10 self-registering tests. A failed/killed playwright invocation may still have consumed the budget.

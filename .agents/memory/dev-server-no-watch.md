---
name: Dev server has no file watch
description: Why server-side route/logic changes don't take effect until the workflow restarts
---

The `Start application` workflow runs `tsx server/index.ts` (no watch/nodemon). Only the Vite client hot-reloads; the Node/Express process does NOT restart on server file edits.

**Why:** After editing `server/routes.ts`, new API routes returned the SPA catch-all HTML (and auth-gated routes returned 200 instead of 401) because the running process still had the old route table. The vitest `test` workflow imports `registerRoutes` fresh each run, so tests passed while the live dev server stayed stale — a misleading "works in tests, broken in preview" signal.

**How to apply:** After any change under `server/` (routes, storage, email, migrations), restart the `Start application` workflow before manually testing the live preview or curling endpoints. Don't trust the running dev server to reflect server-side edits on its own.

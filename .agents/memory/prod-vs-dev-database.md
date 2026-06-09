---
name: Production deployment uses a different database than the workspace
description: Symptom and diagnosis when prod login (or data) differs from dev despite a single DATABASE_URL secret
---

# Production deployment can run on a different database than the workspace

**Symptom:** A password (or any data) that works against the workspace/dev DB
fails on the live deployment — e.g. `POST /api/login` returns 401 in production
but 200 in dev with the same credentials.

**Why:** Replit deployments use the secret values captured at publish time, not
the workspace's current secret values. If `DATABASE_URL` was changed in the
workspace after the last successful publish, the running deployment keeps talking
to its *old* database. `viewEnvVars` only shows the current (global) secret, so
dev and prod can silently point at different databases.

**How to confirm (decisive test):** Change a row in the workspace DB (e.g. reset
an admin password via the app's scrypt hashing, format `hexhash.salt`) and then
hit the live URL's API. If the live site still doesn't reflect the change, prod
is on a different DB. Revert the diagnostic change afterward.

**How to apply / fix:** Republishing makes the deployment pick up the *current*
`DATABASE_URL`. Warn the user first: if the live site has real data in its old
DB, republishing onto a different DB swaps which data the site serves (old data
is not deleted, just disconnected).

**Other gotcha seen here:** the real production URL came from `getDeploymentInfo`
(`primaryUrl`), not from `REPLIT_DOMAINS`/guesswork. A custom domain that shows
"This app isn't live yet" simply isn't attached to the current deployment.

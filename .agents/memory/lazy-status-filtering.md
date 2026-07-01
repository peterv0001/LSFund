---
name: Filter on lazily-computed status, not the stored column
description: When a record's effective status is derived at read-time (pending-past-due => expired), a DB WHERE status=... filter misses the lazily-changed rows.
---

# Filter AFTER computing effective status, in memory

Agent invitations store `status='pending'` and an `expiresAt`. A pending invite
past its expiry is *rendered* as "expired" but the stored column is still
"pending" (expiry is reflected lazily at read time, not persisted on a cron).

**The trap:** `getAllAgentInvitations(status)` with a DB `WHERE status = $status`
returns the wrong set for status-based UI filters:
- `status=expired` misses pending-but-past-due invites (stored as pending).
- `status=pending` wrongly includes rows the UI shows as expired.

**Fix:** fetch ALL rows, compute `effectiveStatus` per row, then filter in memory
by both effective status and any date range. See the admin invitations list route
in `server/routes.ts`.

**Why:** the source of truth for "what the user sees / filters on" is the derived
status, not the raw column. Any filter must run on the same value the UI displays.

**How to apply:** whenever a status/state is computed at read time rather than
persisted, do filtering after the derivation step — never push that filter into
the DB query against the raw column.

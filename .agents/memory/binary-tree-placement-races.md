---
name: Binary tree placement race guard
description: Why agent placement (placement_id, leg) needs a DB unique index plus retry, not just app-level find-then-insert
---

# Binary tree placement race guard

App-level "find an open slot, then insert" (findPlacement → createAgent) cannot
prevent two concurrent signups under the same sponsor+leg from resolving the
**same** open slot and both inserting. The real guarantee is a DB partial unique
index on `agents (placement_id, leg) WHERE placement_id IS NOT NULL AND leg IS
NOT NULL`.

**Why:** Two parallel `/api/register` calls both run findPlacement, both see the
same empty slot, both try to insert. Without the unique index the tree silently
ends up with two agents on the same leg of the same parent.

**How to apply:**
- The insert path must catch the unique violation, re-resolve placement (which
  now traverses past the just-filled slot), and retry. This lives in
  `createAgentWithPlacement` in `server/storage.ts`.
- A new agent's referral code ALSO has a unique constraint, so two different
  23505 violations are possible on the same insert. Distinguish them by checking
  whether the error's constraint/detail mentions `placement` vs `referral`
  (see `isUniqueViolation(err, hint)` in storage). Retry referral collisions by
  regenerating the random code; retry placement collisions by re-resolving.
- The migration that adds this index will FAIL on a DB that already has
  duplicate (placement_id, leg) rows from the pre-fix bug. Check for dupes
  before deploying the index to a long-lived production DB.

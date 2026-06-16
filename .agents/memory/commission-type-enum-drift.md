---
name: commission_type enum drift
description: DB enum lagged schema.ts; only surfaced when a never-fired commission type was finally inserted
---

The `commission_type` pgEnum in `shared/schema.ts` declared values
('fast_start', 'leadership_pool') that the actual DB enum never contained.
The drift stayed invisible for a long time because no code path ever INSERTed
a commission of those types — until the v2026 accelerator started paying a
real `fast_start` commission, which then failed with
`invalid input value for enum commission_type`.

**Why:** Adding a value to a pgEnum in `schema.ts` does NOT alter the DB type
on its own — `db:push` is interactive (needs a TTY) and was never run, so the
ALTER never happened. A declared-but-never-inserted enum value is a latent
failure waiting for the first row that uses it.

**How to apply:** When you start inserting a commission/enum value that the
codebase declared but historically never wrote, first confirm the DB enum
actually contains it:
`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='commission_type'`.
If missing, add a numbered migration with
`ALTER TYPE <enum> ADD VALUE IF NOT EXISTS '<value>'` (transaction-safe in
PG12+ as long as the value isn't used in the same transaction), then apply it
to dev via executeSql and record it in schema_migrations so the runner skips it.

---
name: New blocking gate breaks existing test fixtures
description: Adding a precondition gate (e.g. email-verified) to deal/subscription routes silently 403s every test that POSTs through them with default-unverified fixtures.
---

# A new "must be verified" gate on write routes breaks existing fixtures

When you add a server-side precondition to a state-changing route (deal create,
subscription create) — e.g. "agent.emailVerifiedAt must be set or return 403" —
every existing test that creates an agent and POSTs through that route starts
failing with 403 instead of 201/400. The fixtures create agents in the default
(unverified) state because the column didn't exist when they were written.

**Why:** the gate is correct production behavior; the fixtures are stale, not the
gate. Don't weaken the gate to make tests pass.

**How to apply:** seed the precondition on the fixtures that exercise the gated
route. Here that means adding `emailVerifiedAt: new Date()` to the agent INSERTs
in `server/subscriptions.test.ts` and `server/stripe-subscription-billing.test.ts`.
Target only the agent inserts — agent inserts have a `password:` field on its own
line (`"not-a-real-hash"` or `await hashPasswordForTest(...)`); login request
bodies put `password:` inline after `username:` in `.send({...})`, so a regex
anchored to a line starting with `password:` and a literal hash value hits only
the inserts.

This is the same failure shape as the going-forward-model-flag note: a new
default silently routes old fixtures down a new path.

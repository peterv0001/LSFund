---
name: Public referral-code lookups
description: Why public/unauthenticated agent lookups must not resolve numeric ids
---

On any public, unauthenticated surface that resolves an agent referral code
(shared landing pages, the advisor banner lookup), use
`storage.getAgentByReferralCodeStrict(code)`, which matches ONLY on the
`referralCode` column.

**Why:** the original `getAgentByReferralCode` parses the input as an int first
and, if numeric, returns `getAgent(id)`. On a public endpoint that lets an
attacker enumerate agents by sequential numeric id (leaking names / attributing
leads to arbitrary agents). The threat model forbids cross-user direct object
references on public routes.

**How to apply:** keep the non-strict method for authenticated/internal flows
(e.g. signup sponsor resolution where an id is acceptable), but route any
public lookup through the strict variant. Matching is also exact-case at the DB
layer, so the routes additionally verify an uppercase-equality + status==="active"
guard before attributing or returning data.

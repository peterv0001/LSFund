---
name: Actor badges in agent subscription history
description: Why the blue "Agent" badge never shows in the live per-subscription history view
---

The per-subscription history endpoint (`GET /api/subscriptions/:id/history` in
`server/routes.ts`) only computes `actorName` for `system` and `admin` actor
types; for `agent`-actor rows it returns `actorName: null`.

`SubscriptionHistoryTimeline` in `client/src/pages/subscriptions.tsx` only
renders the actor badge inside a `{log.actorName && (...)}` guard. So even
though `getActorBadge('agent')` (in `client/src/lib/action-styles.ts`) returns
the blue "Agent" badge, a real agent action can NEVER show that badge in this
view, because its `actorName` is always null.

Quirk: `getActorBadge` returns the AGENT badge for any non-admin truthy
actorType, including `system` — so `system` rows (actorName "System") render a
blue "Agent" badge.

**Why:** matters for e2e/UI tests and any work touching the agent history badge.
A test that wants to see all three badge states deterministically must stub the
history response (e.g. Playwright `page.route`), not rely on real agent actions.

**How to apply:** if a task wants the Agent badge to appear for the agent's own
actions in the live view, the endpoint must be changed to populate agent
actorName (and the system→Agent mislabel likely fixed too).

---
name: Actor badges in agent subscription history
description: How the blue "Agent" badge is wired in the live per-subscription history view
---

The per-subscription history endpoint (`GET /api/subscriptions/:id/history` in
`server/routes.ts`) populates `actorName` for `system`, `admin`, AND `agent`
actor types (agent/admin names looked up via `storage.getAgent`). A real agent
action — e.g. logging a new subscription (`POST /api/subscriptions`) — writes an
`agent`-actor row, so the agent's own name now flows through.

`SubscriptionHistoryTimeline` in `client/src/pages/subscriptions.tsx` renders
the actor badge inside a `{log.actorName && (...)}` guard, then calls
`getActorBadge(log.actorType)` (in `client/src/lib/action-styles.ts`).

`getActorBadge` returns the purple "Admin" badge for `admin`, the blue "Agent"
badge for `agent`, and `null` otherwise — so `system` rows show "by System"
with NO badge (previously they mislabeled as "Agent").

**Why:** matters for any work touching the agent history badge. The badge for an
agent's own action is now reachable via a real action, so e2e tests can drive a
real subscription create instead of stubbing the history response.

**How to apply:** to assert the Agent badge in e2e, create a subscription as the
agent, GET the history to grab the agent-actor entry id, then check the badge.

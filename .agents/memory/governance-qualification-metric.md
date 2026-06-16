---
name: Governance qualification metric
description: Which subscription-revenue aggregate feeds distributor-tier qualification and why
---

Distributor-tier qualification (standard/enhanced/elite) must measure COLLECTED
subscription revenue, not raw active MRR.

The rule: use `storage.getCollectedSubscriptionRevenue(agentId)` — sums monthly
amount of subscriptions where status='active' AND (billingStatus IS NULL OR
billingStatus='active'). NULL = manually-logged/legacy (revenue realized on
logging); 'active' = Stripe invoice collected. Unpaid Stripe states (pending,
past_due, failed) and non-active statuses are excluded.

**Why:** the older `getActiveSubscriptionRevenue` summed all active-status subs
with no payment filter, so an active-but-unpaid Stripe subscription inflated
qualification. Persisted `distributorTier` is read by the commission engine, so
over-qualifying directly over-pays commissions. Code review blocked the task twice
on this.

**How to apply:** any path that computes a qualification/tier metric (the
governance recalc in governance.ts and the admin governance snapshot in routes.ts)
must use the collected aggregate, and both must stay in sync. The platform-fee
waiver route is a separate, pre-existing concern and still uses raw active MRR.
For a recurring monthly sub the monthly amount IS the trailing-month figure; there
is no per-invoice payment-history table to window over.

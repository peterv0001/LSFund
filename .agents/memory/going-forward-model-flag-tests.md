---
name: Going-forward model flag breaks existing fixtures
description: When a per-record behavior flag defaults to a NEW model, existing tests that build deal/subscription fixtures inherit the new default and break.
---

When introducing a per-record `commissionModel` ('legacy' | 'v2026') flag whose
column default is the NEW model for going-forward records, every existing test
that inserts a deal or subscription fixture (and then approves it / runs the
webhook / runs calculate-commissions) silently gets the new model and its
legacy amount/type assertions break.

**Why:** legacy suites lock byte-identical legacy money math; the new default
routes them through the new engine (e.g. tier_1 residual = 0% under v2026 fires
NO commission; independent agency override = 0 so no `mac_sponsor_l1` row;
override email label changes "L1 Sponsor Override" → "L1 Agency Override").

**How to apply:** pin the fixture to the old model — set `commissionModel: "legacy"`
in the shared deal/subscription insert helpers of every legacy suite. Pure-mock
tests (objects that never set the field) fall through to the legacy branch on
`undefined` and need no change; tests that call `storage.createCommission`
directly (no engine) also need no change.

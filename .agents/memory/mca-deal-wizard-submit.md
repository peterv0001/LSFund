---
name: MCA deal wizard submit/validation quirks
description: How the multi-step MCA deal dialog gates fields and why reaching the review step in e2e tests is racy.
---

# MCA deal wizard (deals.tsx) submit & validation behavior

The "Submit MCA Application" dialog is a 4-step wizard (Business / Owner / Funding / Review). Two non-obvious behaviors matter when testing or changing it:

## Every schema-required field is gated by a per-step "Next" validation
Each step's "Next" button runs `form.trigger(stepFields)` and only advances when valid. So pure forward navigation can NEVER reach a later step with an earlier field still invalid. The `onInvalid` safety net (jump-to-offending-step + "Please fix the highlighted fields" destructive toast) is therefore only reachable when a field is made invalid AND you move away without re-validating — the "Back" button (`prevStep`) does NOT re-validate.

**How to apply (e2e):** to exercise `onInvalid`, fill a step validly, corrupt one field, then click "Back" to land on an earlier step still holding the bad value, then submit the form. You do NOT need to reach step 4 — submitting from any step runs the same `handleSubmit(onSubmit, onInvalid)`.

## Entering Review (step 4) used to race a stray "Next" click into a real submit (now guarded)
On step 4 the `type="button"` Next button is replaced by the `type="submit"` button at the SAME position in the nav row. When the form was fully valid, clicking Next → `setStep(4)` re-renders and a click (esp. Playwright's auto-retry of an unstable click, worse when the deals table re-renders slowly) could land on the freshly-mounted submit button, firing a real `POST /api/deals` and showing "Application Submitted!" instead of the review step.

**Fix:** a `submitArmed` flag in `deals.tsx` keeps the submit button `disabled` for ~400ms after step 4 mounts, so a stray click can't trigger submission. A disabled button ignores the event entirely (intent-via-pointerdown does NOT help — a full click on the swapped button still arms+fires). Playwright's explicit `.click()` on submit just waits for `enabled`, so legit submits are unaffected.

**Why disable rather than guard onSubmit by time:** time-guarding `onSubmit` would also block the legit submit click that fires moments after the review heading appears. Disabling the button defers the click instead of dropping it.

**How to apply:** the "fully valid" e2e test can now reach step 4 via Next and submit normally. The `onInvalid`-safety-net test still submits via `document.querySelector('[role="dialog"] form').requestSubmit()` from step 2 with invalid data (routes to onInvalid, unaffected by submitArmed).

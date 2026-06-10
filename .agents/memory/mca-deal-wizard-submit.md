---
name: MCA deal wizard submit/validation quirks
description: How the multi-step MCA deal dialog gates fields and why reaching the review step in e2e tests is racy.
---

# MCA deal wizard (deals.tsx) submit & validation behavior

The "Submit MCA Application" dialog is a 4-step wizard (Business / Owner / Funding / Review). Two non-obvious behaviors matter when testing or changing it:

## Every schema-required field is gated by a per-step "Next" validation
Each step's "Next" button runs `form.trigger(stepFields)` and only advances when valid. So pure forward navigation can NEVER reach a later step with an earlier field still invalid. The `onInvalid` safety net (jump-to-offending-step + "Please fix the highlighted fields" destructive toast) is therefore only reachable when a field is made invalid AND you move away without re-validating — the "Back" button (`prevStep`) does NOT re-validate.

**How to apply (e2e):** to exercise `onInvalid`, fill a step validly, corrupt one field, then click "Back" to land on an earlier step still holding the bad value, then submit the form. You do NOT need to reach step 4 — submitting from any step runs the same `handleSubmit(onSubmit, onInvalid)`.

## Clicking "Next" from Funding (step 3) into Review (step 4) can race into a real submit
On step 4 the `type="button"` Next button is replaced by the `type="submit"` button at the SAME position in the nav row. When the form is fully valid, clicking Next → `setStep(4)` re-renders and a click can land on the freshly-mounted submit button, firing a real `POST /api/deals` and showing "Application Submitted!" instead of the review step. This is timing-sensitive (worsens when the deals table behind the dialog is slow to render, e.g. many existing deals) so it presents as a flaky/sometimes-deterministic failure of any test that reaches step 4 via Next (e.g. the "fully valid" e2e test).

**Why:** this looks like a genuine app UX bug (Next sometimes submits the application, skipping the review step), not just a test artifact — the deal really gets created.

**How to apply:** make robust e2e tests avoid the step-3→4 Next boundary; trigger submit via `document.querySelector('[role="dialog"] form').requestSubmit()` from step 2/3 instead.

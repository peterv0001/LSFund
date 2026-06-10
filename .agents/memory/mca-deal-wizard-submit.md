---
name: MCA deal wizard submit/validation quirks
description: How the multi-step MCA deal dialog gates fields and why reaching the review step in e2e tests is racy.
---

# MCA deal wizard (deals.tsx) submit & validation behavior

The "Submit MCA Application" dialog is a 4-step wizard (Business / Owner / Funding / Review). Two non-obvious behaviors matter when testing or changing it:

## Every schema-required field is gated by a per-step "Next" validation
Each step's "Next" button runs `form.trigger(stepFields)` and only advances when valid. So pure forward navigation can NEVER reach a later step with an earlier field still invalid. The `onInvalid` safety net (jump-to-offending-step + "Please fix the highlighted fields" destructive toast) is therefore only reachable when a field is made invalid AND you move away without re-validating — the "Back" button (`prevStep`) does NOT re-validate.

**How to apply (e2e):** to exercise `onInvalid`, fill a step validly, corrupt one field, then click "Back" to land on an earlier step still holding the bad value, then submit the form. You do NOT need to reach step 4 — submitting from any step runs the same `handleSubmit(onSubmit, onInvalid)`.

## A "Next"→"Submit" button swap at the same slot can fire an unintended submit
**Rule:** when one nav button is conditionally replaced by a `type="submit"` button at the same position, give them distinct `key`s so React mounts a fresh node instead of reusing one `<button>` and flipping its `type`. Don't rely on a timed disable.

**Why:** Next and Submit both render as `<Button>` (same type) → React reuses the DOM node. Since the step advance is `async` (`await form.trigger`), `setStep(4)` drains in a microtask BEFORE the click's default action, so the reused node is already `type="submit"` when the browser runs the click default action → real submit, skipping review. The earlier ~400ms `submitArmed` timer "fixed" this but was timing-fragile (risked flaky e2e where the button is disabled at click time).

**How to apply:** distinct keys (root fix) + `submitArmed` enabled in a `useEffect` keyed on the review step commit (no magic delay) + `onSubmit` gating creation to the review step. e2e: any test that leaves the wizard open must close it (Cancel) — serial-mode Radix dialog overlays otherwise leak and intercept pointer events in the next test.

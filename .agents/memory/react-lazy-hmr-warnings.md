---
name: React.lazy + wouter HMR warnings are false positives
description: "Invalid hook call" / "suspended on synchronous input" warnings appear only during Vite HMR after editing App.tsx routes; a clean reload is error-free.
---

When routes in `client/src/App.tsx` are `React.lazy(...)` wrapped in a `Suspense` boundary, editing the router during a live session can surface console errors like "Invalid hook call", "suspended while responding to synchronous input", and a Vite `/@react-refresh` ENOENT crash.

**Why:** These come from Vite HMR/react-refresh swapping a module that exports lazy components plus the runtime-error-modal plugin, not from the route code itself.

**How to apply:** Don't chase these by restructuring Suspense. Restart the `Start application` workflow and reload — verify the browser console is clean and route navigation works. If (and only if) errors persist after a *fresh* reload, then investigate Suspense placement / startTransition.

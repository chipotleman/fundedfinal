---
name: iOS haptics user-activation requirement
description: Why the iOS switch-haptic click in utils/haptics.js must fire synchronously inside the tap handler
---

# iOS haptics must fire synchronously within the user gesture

iOS Safari has no Vibration API. The app fakes haptics with a hidden
`<input type="checkbox" switch>` + `<label>` and calls `label.click()` to
toggle it, which triggers a system haptic.

**Rule:** that `label.click()` MUST run synchronously inside the originating
tap/click handler. Do NOT defer it with `requestAnimationFrame`, `setTimeout`,
`await`, or any async hop.

**Why:** iOS only fires the switch haptic while the page has *transient user
activation*. Any async boundary drops that activation, so the haptic silently
no-ops — taps on odds, the bet slip, and buttons stop buzzing with no error.
A rollback once reintroduced a `requestAnimationFrame(() => label.click())`
wrapper and silently killed all iOS haptics.

**How to apply:** `appendChild` is synchronous, so the element is in the DOM
and clickable on the same tick — append then click immediately, and only the
cleanup (`wrapper.remove()`) may be deferred. Multi-pulse patterns
(success/error/warning) schedule extra pulses via setTimeout; only the *first*
pulse is guaranteed to land on iOS — accept this as best-effort.

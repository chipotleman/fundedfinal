---
name: Messenger piks:message:new dual-source dedup
description: Why in-thread message dedup must String()-compare ids — the event fires from two sources with possibly-different id types
---

The `piks:message:new` window event that drives the messenger thread is dispatched from TWO independent sources:
1. The local `handleSend` (after POST succeeds) — id type from the API JSON response.
2. The SSE echo: `NotificationsContext` `notification:message` handler re-dispatches with `ev.message` — id type from the SSE payload.

These two payloads can carry the same message with a DIFFERENT id type (e.g. number `1` vs string `'1'`), so a strict `x.id === m.id` dedup in the thread listener silently fails and the sent message renders twice (a poll/refresh later normalizes it to one — masking the bug).

**Rule:** any dedup of message-like events that can arrive from both the local optimistic path and the SSE rebroadcast must compare ids with `String(a.id) === String(b.id)`, never `===`.

**Why:** the optimistic add + SSE echo race is invisible until id types diverge; it only shows as a transient double-render that "fixes itself" on refresh.

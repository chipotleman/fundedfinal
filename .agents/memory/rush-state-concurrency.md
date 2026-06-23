---
name: Rush state concurrency (CAS)
description: Why all Rush rushState writes must go through the optimistic-concurrency helper, and how it works.
---

# Rush rushState writes must use compare-and-swap

All reads/writes of `matchups.rushState` (the JSONB column holding the Rush battle
state machine) MUST go through `commitRushMutation(matchupId, mutate)` in
`lib/rushPersist.js`. Never do a bare `db.update(...).set({ rushState })`.

**Why:** The Neon HTTP driver has NO interactive transactions (no `SELECT ... FOR
UPDATE`). The accept/pick/continue POST endpoints and the `/state` poll tick all do
read → roll-forward → mutate → write. Two concurrent writers (e.g. a `pick` POST
landing while a `/state` poll is mid-flight) caused a lost-update that could change
the round outcome / winner / payout. A code review flagged this as severe.

**How it works:** state carries a monotonic `rev` counter. Writes only succeed when
the stored rev still matches what was read:
`COALESCE((rush_state->>'rev')::int, 0) = prevRev` (and a `rush_state IS NULL` branch
for the lazy-init / legacy rows). On a 0-row CAS miss it re-reads the fresh row and
re-runs the mutator (up to maxRetries), so no action is silently dropped.

**How to apply (mutate contract):** the mutate callback receives the freshly-read
matchup row and returns one of:
- `{ next }` — new state to persist (helper stamps `rev = prevRev + 1`).
- `{ changed: false }` — no write (read-only tick / idempotent no-op).
- `{ abort, status, body }` — surface an HTTP error/early-return.
- optional `{ extraSet }` — extra columns to set alongside rushState (e.g.
  `status:'cancelled'` for stale-accept auto-cancel).

To avoid bumping `rev` on every poll, compute
`changed = matchup.rushState == null || JSON.stringify(next) !== JSON.stringify(matchup.rushState)`
and return `{ changed:false }` when nothing actually advanced. Settlement
(`settleRushMatchup`) runs AFTER the commit when `phase==='completed'`; it is itself
CAS-guarded on `matchups.status != 'completed'`, so double-settle is impossible.

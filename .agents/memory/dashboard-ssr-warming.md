---
name: Dashboard SSR games warming
description: How to keep the dashboard games list instant (no skeleton flash) via SSR cache warming.
---

# Dashboard SSR games warming

The dashboard games list (`pages/index.js` `getServerSideProps`) renders from an
in-memory Goalserve cache (`getScheduledGamesForSSR()` + inplay `getEventsForSSR()`).
That cache is empty on every fresh server/process start until the pollers run.

**Rule:** SSR must (a) call `initializeGoalservePolling()` (idempotent) AND
(b) `await waitForScheduleCache(<bounded ms>)` before reading the cache. Otherwise
the first visitor after any start gets empty props → client skeletons → a slow
client `/api/games` fetch (~2s).

**Why `waitForScheduleCache` is safe to call every request:** it awaits the shared
`initialFetchPromise` and returns the moment that first fetch *settles* — success OR
failure. So warm servers, and even requests during an upstream outage (once the first
attempt is done), return instantly; it only truly blocks (bounded) on a genuine cold
start while the first fetch is still in flight.

**Do NOT block SSR on inplay/live events** (`waitForCache`): it busy-waits the FULL
timeout whenever live events are empty, which is the common case (no live games) and
during outages. Live events stream in over SSE within ~1s, so blocking on them adds
latency to every request for no benefit.

**How to apply:** any new page that SSRs games should follow the same warm-then-wait-
on-schedule-only pattern. Gate cold-start waits on the schedule cache (essentially
always non-empty once warm), never on live-event emptiness.

**Env note:** Goalserve returns HTTP 403 (inplay) / HTML error pages (odds) in the
Replit dev sandbox due to an IP/key allowlist, so the dashboard shows 0 games locally.
Production deploys where Goalserve is reachable render real games. Don't chase the
local 0-games as a code bug.

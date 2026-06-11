---
name: Odds source = SharpSports betPrices
description: Betting odds come from SharpSports, overlaid onto Goalserve games; Goalserve no longer provides odds.
---

Betting ODDS (moneyline/spread/total) come from **SharpSports betPrices**
(`lib/sharpsports.js`), not Goalserve. Goalserve still owns the schedule, game IDs,
live scores and possession.

**Why:** SharpSports betPrices is odds-only — it has **no scores/clock/status** (verified
against the live API: event objects carry no score fields; /scores and /games 404). So
odds moved to SharpSports while scores/schedule stayed on Goalserve.

**How to apply:**
- `/api/games` builds the game list from Goalserve, then `applySharpSportsOdds()` overlays
  SharpSports odds by fuzzy team-name + nearest-start-time match (orientation-aware). On a
  miss the game keeps Goalserve odds as fallback, so don't assume every game is SharpSports.
- SharpSports `/prices` has no team names — must join to `/events` (eventId→teams) first.
- Only full-game `Moneyline`/`Spread`/`Total` markets are used; props/quarter/half/futures
  are intentionally excluded. Prefer `main:true` prices (spread/total also return alt lines).
- Don't reintroduce Goalserve as the odds source. If odds look wrong, debug the SharpSports
  fetch/normalize/match path, not Goalserve.

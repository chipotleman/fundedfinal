---
name: /api/games game-object field shape
description: The /api/games game objects use camelCase fields, not Goalserve snake_case — matters for any code joining against them.
---

`convertGoalserveToDisplayFormat` (pages/api/games/index.js) reshapes raw Goalserve
games into the objects the frontend + overlays consume. Field names switch from
snake_case to camelCase: `commence_time → commenceTime`, `home_team → homeTeamFull`,
`away_team → awayTeamFull`, `home_team_abbr → homeTeam`, etc. `lines` +
`allBookmakerOdds` are the odds payload.

**Why:** A SharpSports odds-overlay matcher read `game.commence_time` on these objects;
the field is actually `commenceTime`, so the time value was silently `NaN` and
nearest-start-time disambiguation was dead — wrong-event odds risk for rematches/series.

**How to apply:** Any module that joins/matches against `/api/games` game objects (odds
overlays, snapshots, search, trackers) must use the camelCase names. If a helper might
also receive raw Goalserve games, accept both (`game.commenceTime || game.commence_time`).

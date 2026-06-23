---
name: SelectionLogos parlay auto-detection
description: SelectionLogos renders a split-circle parlay mark when bet.legs has >1 leg — callers spreading a full bet for a single-team logo must strip legs.
---

`SelectionLogos` (components/TeamLogo.js) auto-detects a parlay from `bet.legs`
and renders the combined split-circle `ParlayLogos` mark instead of a single
team logo. Detection: `legs.length > 1 && (!picked || selection includes ',')`.

**Why:** True parlay bets usually have NO top-level `awayTeam/homeTeam` (teams
live on each leg), so `getPickedTeamName` returns null and the parlay branch
fires. That's correct for the main pick row, but it bites any caller that wants
a SINGLE team logo yet spreads the whole bet object — the spread carries `legs`
along and silently turns one team's logo into the parlay mark.

**How to apply:** When calling `SelectionLogos` to render a single team
(e.g. the away/home logos in the My Piks "Battle Insights" rail), pass
`bet={{ ...bet, legs: undefined, awayTeam, homeTeam, awayTeamFull, homeTeamFull }}`
so `legs` is stripped and `picked` resolves deterministically. Never pass a raw
`{...bet}` when you only want one side's logo.

---
name: Light theme must never render team brand colors as white
description: How to keep team-colored lines/text/accents visible on the light theme when a team's brand color is white
---

Some teams' brand colors in `utils/teamColors.js` are white or near-white. On
the LIGHT theme a white brand color draws an invisible white line / legend
label / accent on the white panel.

**Rule:** any UI that colors something with a team's brand color and can render
on the light theme must pass it through `readableLineColor(hex, isLight)`
(`utils/teamColors.js`), which darkens a too-bright color to a visible shade of
the same hue on light theme and leaves dark theme untouched.

**Why:** user explicitly required "no white text in a light theme or white
lines even if the home team normally would be white colored — use a different
color in their logo." First applied to the live odds chart
(`components/game/OddsHistoryChart.js`: HOME_COLOR + legend).

**How to apply:** when adding team-colored lines/text/pills/accents, wrap the
`getTeamColor(...)` result in `readableLineColor(color, isLight)`. The game
page (`pages/game/[id].js`) still themes its LIVE pill / accents off raw
`homeColor` — if a white-brand team surfaces there on light theme, apply the
same guard (needs a `useTheme` hook added before any early return).

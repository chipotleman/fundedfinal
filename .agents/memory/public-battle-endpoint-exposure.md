---
name: Public battle endpoint exposure
description: Why /api/battles/public/[id] returns both sides' picks for non-completed battles, and what depends on it.
---

`GET /api/battles/public/[id]` is unauthenticated and returns BOTH players' full
pick lists (`myBets`/`opponentBets`) regardless of matchup status — including
`active`/`matched` in-progress battles.

**Why it's not gated to completed-only:** `pages/bet-history.js` consumes this
endpoint for in-progress battles too (it sets `isBattleEnded` from
`status !== 'active' && status !== 'matched'`), and the live-spectator showcase
model treats live battles as viewable. Hard-gating the endpoint to
`status === 'completed'` breaks bet-history's in-progress rendering.

**How to apply:** Treat this as a pre-existing, intentional contract. The public
`/battle/summary/[id]` page restricts *display* to completed battles at the page
level, NOT the API. If you ever need to hide in-progress opponent picks for
competitive integrity, do it without removing data bet-history relies on (e.g.
withhold only the *opponent* side while a battle is live, and verify bet-history
+ live showcase still work).

---
name: Rush rematch handshake
description: How "Rematch" must create a new matchup vs "New Opponent"
---
Rush "Rematch" (same opponent) must reuse the existing two-sided handshake, NOT
direct matchmaking: POST `/api/matchups/[id]/rematch` with `action:'accept'`; a
new matchup is created only once BOTH players accept. If the response already
carries `rematchMatchupId`, enter it immediately; otherwise wait for the
`matchup:rematch` SSE and navigate to `evt.rematchMatchupId`.

**Why:** direct matchmaking would pair the user with a random rival, not the same
opponent — the whole point of "Rematch". The handshake also blocks bots
(`/api/matchups/[id]/rematch` rejects `isFakeOpponent`).

**How to apply:** bots (`matchup.isFakeOpponent`) have no second party to accept,
so they MUST fall back to new-opponent matchmaking. "New Opponent" always uses
matchmaking. Both the routed page (`pages/battle/rush/[id].js`) and the in-popup
`QuickMatchModal` implement this. A `rematchWaiting` flag drives the waiting UI —
reset it on matchup-id change, since the dynamic rush page is reused across
`/battle/rush/[old] -> /[new]` and stale React state otherwise sticks.

---
name: Shared simulated team data
description: Single source of truth for demo/simulated team pools
---
Canonical simulated team pools live in `lib/sportsTeams.js` (CommonJS). Both
`lib/simulated-games.js` (ESM `import`) and `lib/rushSim.js` (CJS `require`)
consume it — one place to edit team data, and the seam to swap in real Goalserve
rosters later.

**Why:** package.json is `commonjs`, and the Rush engine chain (rush.js ->
rushSim.js) is required via plain `require` (runs under node for smoke tests), so
the shared data module must be CJS — an ESM file can't be `require`d under plain
node. ESM `simulated-games.js` importing a CJS module works everywhere (webpack +
node-via-Next).

**How to apply:** keep new shared sim data in CJS. Do NOT make rushSim reuse the
games feed's realistic per-sport SCORE ranges — Rush uses abstract "battle points"
so cross-sport picks stay comparable/fair; only the team NAMES are shared.

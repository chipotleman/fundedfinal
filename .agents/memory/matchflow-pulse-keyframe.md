---
name: MatchFlow pulse keyframe centering gotcha
description: Why .mf-pulse must not be applied to normal-flow elements
---

The shared `.mf-pulse` keyframe in `components/battle/matchflow/MatchFlowScreens.js`
(MatchFlowStyles) bakes `transform: translate(-50%,-50%) scale(...)` into the
animation. It is designed for absolutely-centered elements (paired with
`absolute left-1/2 top-1/2`), where the translate is what keeps them centered.

**Why:** Applying `.mf-pulse` to a normal-flow (non-absolute) element silently
shifts it up-left by 50% of its own size, causing it to overlap neighbours. This
caused the MatchConfirmed countdown circle to overlap its label.

**How to apply:** For a pulsing element that is NOT absolutely positioned, use
`.mf-pulse-scale` (pure scale, no translate) instead of `.mf-pulse`.

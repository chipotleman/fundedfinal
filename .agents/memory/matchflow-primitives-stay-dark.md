---
name: Match-flow primitives stay dark (opt-in light)
description: Why the shared match-flow card/button/avatar primitives must not read global theme, and how to light-theme one screen that uses them.
---

The shared match-flow primitives in `components/battle/matchflow/MatchFlowScreens.js`
(`FlowCard`, `FlowButton`, `Fighter`, `PiksMark`, `CoinChip`) are used by the
gameplay/search flow (Finding/Found/Confirmed/PlayAgain) AND by the result splash
(`MatchWin`, which is used ONLY by `MatchResult.js`).

Rule: these primitives must NOT call `useTheme()` / read the global theme. They stay
dark by default and accept an **opt-in `light` prop (default false)**. Only screens
that should go light (e.g. `MatchWin` → the result popup) pass `light`.

**Why:** the gameplay flow (searching, opponent-found, confirmed) is intentionally an
immersive DARK experience even when the app is in light mode. If a primitive read the
global theme it would flip those gameplay screens to light too — a regression. The
result/summary screen is the one place we want light to follow the app theme.

**How to apply:** to light-theme a single screen built on these primitives, thread a
`light` boolean down from that screen and branch styles on it. Don't make the shared
primitive globally theme-aware. For dark-on-light buttons use the `slate` FlowButton
palette (a plain `dark` FlowButton is invisible on a light card).

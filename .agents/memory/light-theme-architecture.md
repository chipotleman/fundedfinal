---
name: Light theme architecture (Piks)
description: How Piks light/dark theming works and the rules for flipping surfaces safely.
---

# Light theme architecture

Theme is toggled via `html.light` / `html.dark` classes, applied pre-paint by an
inline script (no FOUC). There is essentially **no light-mode markup** — all
light styling lives as `html.light ...` overrides in `styles/globals.css`, using
attribute selectors + `!important` to beat component inline styles.

## Original decision (now overridden)
The cartoon hero/modal surfaces (VS / PLAY NOW hero, featured battle cards) were
originally kept dark in BOTH themes on purpose. **Why it changed:** product owner
later asked for them to be light in light mode. So that "keep dark" decision is
superseded for featured cards, the desktop right rail, scroll-row fades, and the
`/game/[id]` page.

## Rules to apply when adding light overrides
- **New components:** expose colors as CSS variables (dark defaults on the
  component class; `html.light .cls { --var: ... }` flips them). FOUC-safe.
- **Existing dark components:** add a marker class, write scoped
  `html.light .marker ...` overrides. Lighten surfaces/text but KEEP colored
  accent chips (mode badges, win/loss, coins) — never blanket-override accents.
- **Inline-style matching is serialization-dependent.** React SSR emits the
  literal you wrote (`color:#fff`), but client-rendered nodes are normalized by
  the CSSOM to `color: rgb(255, 255, 255)`. An `[style*=...]` selector that lists
  only one form silently misses the other — always cover BOTH (and the
  spaced/unspaced colon variants).
- Protect intentional whites (e.g. cartoon stickers with a text-stroke outline)
  with `:not([style*="text-stroke"])` rather than editing them.

## Verification constraint
The dashboard is behind a beta-access gate, so screenshots of it aren't possible.
Verify via careful CSS reasoning + JS parse checks + dev-server log checks.

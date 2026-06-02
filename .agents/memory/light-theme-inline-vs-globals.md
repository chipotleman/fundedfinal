---
name: Light theme — inline styles vs globals.css !important overrides
description: Why theme-aware inline colors can silently fail in light mode, and where the conflicting rules live.
---

# Light theme: inline hex doesn't flip, and globals.css can override your fix

Two compounding traps when theming a component for light mode in this repo:

1. **Hardcoded hex inside `style={{}}` does NOT flip under `html.light`.** Tailwind
   `hover:`/color classes flip via CSS, but inline hex is static. To theme an
   inline-styled element, read theme via `useTheme()` (`contexts/ThemeContext`,
   returns `{ theme }`; `const isLight = theme === 'light'`) and branch the value.

2. **`styles/globals.css` carries `html.light .<card> { … !important }` rules that
   override your inline styles.** Notably `html.light .youvs-card` and
   `html.light .bc-surface` force `background`/`border-color`/text with
   `!important` and attribute-selectors like `[style*="background: #111"]`.
   Inline styles LOSE to a stylesheet `!important`. So even after you make an
   element's inline `background`/`border` theme-aware, a globals `!important`
   rule can keep forcing the old color.

**Why:** these globals rules were originally added precisely because inline hex
won't flip. Once you convert an element to `isLight`-aware inline styles, the
globals rule becomes redundant AND conflicting.

**How to apply:** when you make a component's inline styles theme-aware, grep
`styles/globals.css` for `html.light .<that-card-class>` and reconcile:
- Keep `!important` only for properties you are NOT setting inline (or that must
  match across all instances, e.g. a surface background wash).
- DROP the `!important` declaration for any property whose inline value now
  carries variants the CSS can't express (e.g. an expanded-vs-collapsed border),
  so the inline source-of-truth wins.
- `box-shadow` glow set only inline (not in globals) already wins — fine to leave.

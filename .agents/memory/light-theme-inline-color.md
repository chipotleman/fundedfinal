---
name: Light-theme inline color trap
description: Why hardcoded color hex breaks light theme on Piks and how to make components theme-aware
---

# Light-theme inline color trap

On Piks, light theme is `html.light` on documentElement (ThemeContext, default dark).
Light overrides in `styles/globals.css` are `html.light <selector> { ... }`.

**Rule:** A component's colors will NOT flip to light theme if they're written as
hardcoded hex in **inline `style={{}}`** — inline styles beat `html.light` CSS classes.
The component looks correct in dark and stays dark/invisible in light.

**Why:** Inline styles have higher specificity than class selectors (short of
`!important`). White (`#ffffff`) text/icons then vanish on light's white surfaces.

**How to apply — two working patterns in this repo:**
- CSS variables that flip per theme: define `--x` under the component's root class
  plus `html.light <root> { --x: ... }`, and reference `var(--x)` inline. Used by
  `.sf-root` (SocialFeedPage) and `.desktop-right-rail` (DesktopRightRail friend
  action icons: `--rail-battle-*`, `--rail-msg-*`).
- Theme-aware computed color: call `useTheme()` in the component and pick the color
  in JS (e.g. NavBalance swaps Clash Coins white `#ffffff` → `#0f172a` in light).

**Gotcha:** When matching a stacked label to its value (e.g. CROWNS label vs the
amount), `opacity` on the label changes its perceived hue — drop the opacity if the
two must read as the exact same color.

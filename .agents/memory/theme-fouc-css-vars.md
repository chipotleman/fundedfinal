---
name: Theme FOUC — use CSS vars for first-paint surfaces
description: Why always-visible surfaces must theme via CSS vars (html.light/.dark) instead of useTheme() inline styles
---

Always-visible surfaces (search bar, nav, leaderboard, anything rendered at
first paint) must get their theme colors from CSS variables scoped under
`html.light` / `html.dark`, NOT from JS inline styles derived from
`useTheme()`.

**Why:** ThemeContext defaults to `'dark'` during SSR (no localStorage on the
server), so any inline `style={{ background: isLight ? ... : ... }}` is rendered
dark in the SSR HTML and flashes black for ~0.1s before hydration corrects it —
on refresh and on client-side navigation. The `_document.js` inline script sets
the `html.light`/`html.dark` class synchronously *before paint*, so CSS vars
keyed off that class resolve correctly with zero flash.

**How to apply:** Define a paired var block like `.sf-root` / `html.light .sf-root`
or `.piks-global-search` / `html.light .piks-global-search` in `styles/globals.css`
(dark defaults + light overrides), add the class to the component root, and point
inline styles at `var(--...)`. It's fine to keep `useTheme()`/`isLight` for
content that only renders AFTER user interaction (e.g. dropdown panels, modals
opened on click) — those never appear at first paint so they can't flash.

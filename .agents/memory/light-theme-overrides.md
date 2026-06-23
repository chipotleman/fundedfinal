---
name: Light theme override strategy
description: How light mode is implemented and the classes of bugs it produces
---

Light theme is driven almost entirely by **class-based `html.light` overrides in `styles/globals.css`**, not by per-component theme props. The `light`/`dark` class is set on `<html>` pre-paint by the inline script in `pages/_document.js` (reads localStorage `piks-theme`, default dark) and kept in sync by `contexts/ThemeContext.js`.

**Why:** most components hardcode dark Tailwind utilities / inline styles; theming each one was avoided in favor of central CSS swaps.

**How to apply — the recurring bug pattern:** any surface that paints dark via something the globals.css selectors don't match will stay dark (or render dark-text-on-dark) in light mode. Specifically:
- globals.css covers class utilities `bg-[#0a0a0a]/#111111/#1a1a1a`, `text-gray-300/400/500`, and nav `.text-white`. It does NOT auto-cover other dark hex classes or inline `style={{...}}` colors.
- Active nav/menu rows use `bg-[#0f1d3a]` + `text-white`; the nav `.text-white` override forces the label dark, so without an explicit `html.light .bg-[#0f1d3a]` override the row is dark-on-dark (unreadable). Fixed with a soft-blue tint override.
- Inline-styled buttons (e.g. TopNavbar "My Piks"/"How it works" using `color:#d1d5db`) need `html.light nav button[style*="#d1d5db"]` matchers — the existing inline overrides only targeted links/min-h-screen roots.
- React serializes inline colors as both `#000000` and `rgb(0,0,0)`, so attribute selectors must match both forms.

`pages/my-picks.js` is the exception: it themes via its own `getPalette(isLight)` from `useTheme()`, so it has a one-frame dark flash before the context hydrates from localStorage.

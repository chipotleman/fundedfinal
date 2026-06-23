---
name: Desktop scroll-row edge fade
description: Why DesktopScrollRow fades content with a CSS mask instead of a gradient overlay
---

# DesktopScrollRow edge fade

`components/desktop/DesktopScrollRow.js` fades the horizontally-scrolled content
at whichever edge still has more to scroll, using a `mask-image` (with
`WebkitMaskImage`) applied directly to the scroll container — NOT an absolute
gradient overlay painted in the page background color.

**Why:** An overlay that paints the bg color only *reads* as a fade when it
happens to sit over card content at the edge. That made it data-dependent: wide
cards (Featured Battles, 380px) faded, but narrower cards (Close Games, 260px)
could land a card boundary at the edge and hard-cut. A content mask fades the
actual cards regardless of where the boundary falls, so every row fades
identically.

**How to apply:**
- Mask is gated to lg+ via `matchMedia('(min-width:1024px)')` (state `isDesktop`,
  starts `false` for SSR-safe hydration). Mobile/tablet get NO mask — keep it
  that way; those breakpoints must stay unchanged.
- Mask is conditioned on scroll position: fade left only when `!atStart`, right
  only when `!atEnd`, both in the middle, none when not overflowing.
- Edge risk (accepted, non-blocking): browsers with no CSS mask support lose the
  fade and revert to a hard cut. All modern Chrome/Safari/Firefox support it.

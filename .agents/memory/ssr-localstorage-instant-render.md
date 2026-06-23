---
name: SSR + localStorage instant render without hydration mismatch
description: How to render an instant client-cached state on an SSR'd page without a hydration mismatch or skeleton flash
---

The dashboard (`pages/index.js`) is SSR'd via `getServerSideProps`, so any
component that reads `localStorage` during render or `useState` lazy-init will
diverge from the server HTML and cause a hydration mismatch (server can't read
localStorage).

**Rule:** to paint a client-cached state instantly on an SSR page, keep the
initial state identical to what SSR renders, then flip it in an *isomorphic
layout effect* (`useLayoutEffect` on client, `useEffect` on server) reading
localStorage. The layout effect runs after the SSR-matching first render
commits but **before** the browser paints — so there's no mismatch and no
visible flash of the initial state.

**Why:** The `MatchupContext` `loading` skeleton on the YouVsCard was added to
stop in-battle users flashing "PLAY NOW", but it made every idle load wait on
the `/api/matchups/current` round-trip. Caching last matchup status in
localStorage (`piks:lastMatchupStatus`) + a pre-paint flip restores instant
PLAY NOW for idle users while keeping the skeleton for cached battle statuses.

**How to apply:** when you want an instant client-only optimization on an SSR
page, do NOT lazy-init `useState` from localStorage. Init to the SSR value,
then correct in `useIsomorphicLayoutEffect`. Also only write the cache *after*
the authoritative fetch resolves (gate on `loading===false`), or a transient
pre-fetch default will overwrite the real hint and cause a wrong-state flash on
the next load.

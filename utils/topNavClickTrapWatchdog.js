/**
 * Shared watchdog used by /messenger and /notifications to detect and
 * recover from two specific click-trap regressions that have surfaced
 * more than once on those pages:
 *
 *   1. **Stale body scroll-lock** — a modal crashed mid-teardown and
 *      left `body { position: fixed; overflow: hidden }` in place.
 *      Manifests as the page being un-scrollable; on iOS Safari it can
 *      also wedge the top-nav.
 *
 *   2. **Orphan full-viewport overlay** — a dropdown / dialog / backdrop
 *      that should have unmounted (route change, React batching across
 *      an SSE re-render, etc.) is left in the DOM as a fixed-position
 *      element covering ~the entire viewport. The visible UI looks
 *      fine, but the invisible overlay swallows every tap in the
 *      middle of the navbar — exactly the regression where the
 *      centered Battle / Social / Leaderboard links stop responding
 *      while the logo and right-side icons still work because they
 *      sit in their own absolute clusters that the overlay's
 *      hit-testing happens to miss.
 *
 *   3. **Orphan top-strip overlay** — same root cause as (2) but the
 *      offender is a narrow horizontal strip pinned to `top: 0` (e.g.
 *      a sticky/condensed header that failed to unmount, or a route-
 *      transition splash). It's only ~70-100px tall so the ≥90%×90%
 *      rule above doesn't see it, but it still occludes the entire
 *      navbar row. Detected by `findOrphanTopStripOverlays`: any
 *      `position:fixed` element pinned near the top, ≥90% wide,
 *      ≤200px tall, z-index ≥ 50, that is NOT the real navbar
 *      (`[data-topnavbar="true"]`) and not inside an open modal.
 *
 * The watchdog runs on a 1.5s interval while the page is mounted.
 * Every tick:
 *   - If `document.body` is scroll-locked AND no real modal is open
 *     (no `[role=dialog][aria-modal=true]` and no
 *     `[data-scroll-lock-owner="true"]`), the body styles are
 *     reset.
 *   - If a `position: fixed` element ≥90% of the viewport in both
 *     dimensions exists, is hit-testable (`pointer-events` not `none`,
 *     not `display:none`/`visibility:hidden`), and is NOT inside an
 *     open accessible modal, the element is neutralized by setting
 *     `pointer-events: none` and being detached from the DOM so the
 *     next tap reaches the navbar.
 *
 * In both cases a single `console.warn` is emitted per page-load with
 * the page tag (`[messenger]` / `[notifications]`) so we can find the
 * symptom in Sentry / browser logs without spamming. Repeated triggers
 * within the same mount stay silent because the warning has already
 * surfaced the issue.
 */

const OVERLAY_COVERAGE_THRESHOLD = 0.9;
// Maximum height (in px) for a top-strip overlay to still be considered
// a nav-trap candidate. The real TopNavbar tops out at ~70px (mobile) /
// ~48px+logo on desktop; condensed bar is ~48px. 200px gives generous
// headroom while excluding tall hero/banner sections.
const TOP_STRIP_MAX_HEIGHT = 200;
// How close to the top of the viewport the strip must sit to count.
// Captures elements pinned with `top: 0` or close to it; excludes
// floating widgets / toasts that happen to be narrow & wide.
const TOP_STRIP_MAX_OFFSET = 20;
// z-index floor — only worry about strips that could realistically
// occlude the navbar (which is z-50). Lower-z strips wouldn't trap.
const TOP_STRIP_MIN_Z = 50;

function isInsideOpenModal(el) {
  if (!el) return false;
  return !!el.closest(
    '[role="dialog"][aria-modal="true"], [data-scroll-lock-owner="true"], [data-allow-fixed-overlay="true"]'
  );
}

// True for the real top nav (or its condensed sibling), which we must
// never neutralize. Both render with `data-topnavbar="true"`.
function isRealTopNavbar(el) {
  if (!el) return false;
  return !!el.closest('[data-topnavbar="true"]');
}

function findOrphanFullscreenOverlays() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw <= 0 || vh <= 0) return [];
  const offenders = [];
  // Scoping the query to `body *` keeps us off of <html> itself and
  // matches the assertion used by the e2e click-trap suite.
  const nodes = document.querySelectorAll('body *');
  for (const el of nodes) {
    const cs = window.getComputedStyle(el);
    if (cs.position !== 'fixed') continue;
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw * OVERLAY_COVERAGE_THRESHOLD) continue;
    if (r.height < vh * OVERLAY_COVERAGE_THRESHOLD) continue;
    if (isInsideOpenModal(el)) continue;
    offenders.push(el);
  }
  return offenders;
}

// Detect strip-shaped overlays pinned to the top of the viewport that
// could occlude the navbar. This was added after the full-viewport
// watchdog above proved insufficient: on /messenger users reported the
// center nav links (Battle / Social / Leaderboard) becoming
// unresponsive while the logo (whose 230px-tall image extends well
// above the nav strip) and right-side icon cluster (which sit in
// absolute sub-clusters) kept working. That symptom matches an
// orphaned ~70px-tall full-width strip sitting on top of the navbar,
// which the ≥90%×90% rule above would miss entirely.
function findOrphanTopStripOverlays() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw <= 0 || vh <= 0) return [];
  const offenders = [];
  const nodes = document.querySelectorAll('body *');
  for (const el of nodes) {
    const cs = window.getComputedStyle(el);
    if (cs.position !== 'fixed') continue;
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.pointerEvents === 'none') continue;
    const z = parseInt(cs.zIndex, 10);
    if (!Number.isFinite(z) || z < TOP_STRIP_MIN_Z) continue;
    const r = el.getBoundingClientRect();
    if (r.top > TOP_STRIP_MAX_OFFSET) continue;
    if (r.top + r.height < 0) continue; // entirely above the viewport
    if (r.width < vw * OVERLAY_COVERAGE_THRESHOLD) continue;
    if (r.height <= 0 || r.height > TOP_STRIP_MAX_HEIGHT) continue;
    if (isRealTopNavbar(el)) continue;
    if (isInsideOpenModal(el)) continue;
    offenders.push(el);
  }
  return offenders;
}

function releaseBodyLock() {
  if (typeof document === 'undefined') return;
  const b = document.body.style;
  b.overflow = '';
  b.position = '';
  b.top = '';
  b.left = '';
  b.right = '';
  b.width = '';
  b.height = '';
  b.overscrollBehavior = '';
  document.documentElement.style.overflow = '';
  document.documentElement.style.overscrollBehavior = '';
}

function neutralizeOverlay(el) {
  try {
    el.style.pointerEvents = 'none';
    // Remove from the document so subsequent ticks don't keep finding
    // the same offender. If detachment throws (frozen tree, etc.), the
    // pointer-events:none above is enough to unblock taps.
    if (el.parentNode) el.parentNode.removeChild(el);
  } catch (_e) {}
}

/**
 * Install the click-trap watchdog. Returns a cleanup function suitable
 * for a React `useEffect` return value.
 *
 * @param {string} tag — page identifier used in the console.warn prefix
 *   (e.g. `messenger`, `notifications`).
 */
export function installTopNavClickTrapWatchdog(tag) {
  if (typeof document === 'undefined') return () => {};

  // One warning per install — we want a single, loud signal in logs
  // when the bug recurs, not a per-tick spam stream.
  let warned = false;
  const warn = (reason) => {
    if (warned) return;
    warned = true;
    try {
      // eslint-disable-next-line no-console
      console.warn(`[${tag}] top-nav click-trap watchdog triggered:`, reason);
    } catch (_e) {}
  };

  // Always clear any leftover body lock on mount — the very first
  // paint after a route change is the most common trigger.
  releaseBodyLock();

  const tick = () => {
    if (typeof document === 'undefined') return;
    const b = document.body.style;
    const isLocked = b.position === 'fixed' || b.overflow === 'hidden';
    const hasOpenModal = !!document.querySelector(
      '[role="dialog"][aria-modal="true"], [data-scroll-lock-owner="true"], [data-allow-fixed-overlay="true"]'
    );
    if (isLocked && !hasOpenModal) {
      releaseBodyLock();
      warn('orphan body scroll-lock');
    }
    const overlays = findOrphanFullscreenOverlays();
    if (overlays.length > 0) {
      for (const el of overlays) neutralizeOverlay(el);
      warn(`orphan fullscreen overlay (${overlays.length})`);
    }
    const strips = findOrphanTopStripOverlays();
    if (strips.length > 0) {
      for (const el of strips) neutralizeOverlay(el);
      warn(`orphan top-strip overlay (${strips.length})`);
    }
  };

  const interval = setInterval(tick, 1500);
  return () => clearInterval(interval);
}

// Exported for testing / sharing with the e2e helpers.
export const __test = {
  findOrphanFullscreenOverlays,
  findOrphanTopStripOverlays,
  OVERLAY_COVERAGE_THRESHOLD,
  TOP_STRIP_MAX_HEIGHT,
  TOP_STRIP_MAX_OFFSET,
  TOP_STRIP_MIN_Z,
};

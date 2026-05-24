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

function isInsideOpenModal(el) {
  if (!el) return false;
  return !!el.closest(
    '[role="dialog"][aria-modal="true"], [data-scroll-lock-owner="true"]'
  );
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
      '[role="dialog"][aria-modal="true"], [data-scroll-lock-owner="true"]'
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
  };

  const interval = setInterval(tick, 1500);
  return () => clearInterval(interval);
}

// Exported for testing / sharing with the e2e helpers.
export const __test = {
  findOrphanFullscreenOverlays,
  OVERLAY_COVERAGE_THRESHOLD,
};

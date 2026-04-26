import { useEffect } from 'react';

// Shared watchdog for the iOS Safari "click-trap" failure mode where a
// stale fixed-position overlay (e.g. an unmounted modal whose root was
// hidden via `visibility:hidden` rather than `display:none`) silently
// covers the top-nav strip and intercepts every tap on THE LAB / BATTLE /
// LEADERBOARD / balance / bell / chat / Bet Slip / avatar until the user
// hard-refreshes.
//
// Originally added to `pages/messenger.js` (task #324) after `/messenger`
// was the most reliable repro path. Task #345 ports the same defense to
// `pages/battle.js`, which historically suffered the same trap (task #322),
// by extracting the logic here so any page that needs symmetric defense
// can opt in with a single hook call.
//
// The watchdog probes the top-nav band with `document.elementFromPoint`
// every `intervalMs` (default 1500). If the topmost element above the nav
// strip is a fixed/sticky ancestor that isn't on the allow-list, it forces
// `pointer-events: none` on that ancestor and logs the offender so it can
// be identified next time the bug recurs. New always-mounted full-screen
// overlays must either fully unmount when closed, set `pointer-events:
// none`, or carry one of the allow-list data attributes.

const ALLOWED_FIXED_SELECTORS = [
  '[data-topnavbar="true"]',
  '[data-betslip="true"]',
  '[data-toast-stack="true"]',
  '[role="dialog"][aria-modal="true"]',
  '[data-scroll-lock-owner="true"]',
  '[data-allow-fixed-overlay="true"]',
];

function isAllowed(el) {
  for (const sel of ALLOWED_FIXED_SELECTORS) {
    if (el.matches?.(sel)) return true;
    if (el.closest?.(sel)) return true;
  }
  return false;
}

export default function useTopNavOrphanOverlayWatchdog({
  intervalMs = 1500,
  logPrefix = 'orphan-overlay',
} = {}) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const neutraliseOrphanOverlays = () => {
      // Probe the centre of the top-nav strip (assume ~70px tall) and the
      // typical top-nav button column on the right plus the left edge. If
      // the topmost element there is NOT inside TopNavbar / an allowed
      // overlay, walk up the tree to find the offending fixed ancestor and
      // force pointer-events:none on it so the nav becomes clickable
      // again. Logs loudly so we can see the offender in the browser
      // console next time the bug recurs.
      const probes = [
        { x: Math.max(8, Math.floor(window.innerWidth / 2)), y: 24 },
        { x: Math.max(8, window.innerWidth - 24), y: 24 },
        { x: 24, y: 24 },
      ];
      const seen = new Set();
      for (const { x, y } of probes) {
        const top = document.elementFromPoint(x, y);
        if (!top || top === document.body || top === document.documentElement) continue;
        if (isAllowed(top)) continue;
        let node = top;
        let offender = null;
        while (node && node !== document.body) {
          const pos = window.getComputedStyle(node).position;
          if (pos === 'fixed' || pos === 'sticky') {
            offender = node;
            break;
          }
          node = node.parentElement;
        }
        if (!offender || isAllowed(offender) || seen.has(offender)) continue;
        seen.add(offender);
        const cs = window.getComputedStyle(offender);
        if (cs.pointerEvents === 'none') continue;
        // Only neutralise overlays that actually cover the top-nav band
        // (top 70 px) to avoid false positives on incidental sticky/fixed
        // elements lower on the page.
        const rect = offender.getBoundingClientRect();
        const overlapsNavBand =
          rect.top < 70 && rect.bottom > 0 && rect.right > 0 && rect.left < window.innerWidth;
        if (!overlapsNavBand) continue;
        try {
          offender.style.pointerEvents = 'none';
          offender.setAttribute('data-orphan-overlay-neutralised', 'true');
          console.warn(
            `[${logPrefix}] neutralised orphan fixed overlay covering top-nav:`,
            offender,
          );
        } catch {}
      }
    };

    const interval = setInterval(() => {
      try { neutraliseOrphanOverlays(); } catch {}
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs, logPrefix]);
}

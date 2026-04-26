// Small shared helper for "leave / close this page" controls.
//
// The browser's `window.history.length` is a coarse signal: it counts every
// entry the tab has ever had, including pages the user visited *before* they
// opened our app via a deep link (push notification, link in iMessage /
// WhatsApp, an email link, etc.). Calling `router.back()` in that situation
// would take the user back to whatever unrelated page was previously open
// in the tab — confusing, and definitely not "back inside the app".
//
// Next.js (pages router) tracks its own monotonically increasing `idx` in
// `window.history.state` for each in-app navigation. When the tab loaded
// directly into our page (deep link / fresh tab / external referrer), that
// `idx` is `0` and there is no in-app entry to pop back to. When the user
// reached this page via a Next.js `<Link>` / `router.push`, `idx` is > 0
// and `router.back()` will land them back where they were inside the app.
//
// Usage:
//   import { hasInAppHistory, leavePage } from '../utils/leavePage';
//   leavePage({ router, fallbackHref: isAuthed ? '/dashboard' : '/' });
export function hasInAppHistory() {
  if (typeof window === 'undefined') return false;
  const idx = window.history && window.history.state && window.history.state.idx;
  return typeof idx === 'number' && idx > 0;
}

export function leavePage({ router, fallbackHref }) {
  if (!router) return;
  if (hasInAppHistory()) {
    router.back();
    return;
  }
  router.push(fallbackHref || '/');
}

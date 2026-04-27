import { _drainScrollLockStack } from './useModalScrollLock';

export function releaseBodyScrollLock(reason) {
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
  try {
    delete document.body.dataset.scrollLockCount;
    delete document.body.dataset.scrollLockOwner;
    delete document.documentElement.dataset.modalOpen;
  } catch (_e) {}
  // Also drain the in-memory lock stack maintained by `useModalScrollLock`
  // so that any still-mounted modal's eventual cleanup runs as a no-op
  // instead of trying to scroll-restore on top of the new page (task #576).
  // Without this, on a route change a modal whose React unmount fires
  // AFTER routeChangeStart would pop a single-entry stack, see "was
  // fixed before, not fixed now", and scrollTo to the previous page's
  // saved scroll position — visually jumping the new page.
  try { _drainScrollLockStack(); } catch (_e) {}
  if (reason && typeof console !== 'undefined') {
    try { console.warn('[scroll-lock] released stale body scroll lock:', reason); } catch (_e) {}
  }
}

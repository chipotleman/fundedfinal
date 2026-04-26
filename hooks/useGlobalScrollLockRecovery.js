import { useEffect } from 'react';

// Shared "click trap" recovery for the whole app.
//
// Several modals (BetSlip, ActiveBattleCard, OnboardingPopup, ChallengePopup,
// AuthPopup, BalanceModal, ShareableBetSlip, the mobile nav menu, etc.) lock
// the body via useModalScrollLock or direct style mutations. If a modal is
// torn down by a programmatic redirect, deep link, or service-worker
// navigation before its cleanup effect runs, the body can be left in
// position:fixed / overflow:hidden, which swallows every tap on the next
// page. Historically this manifested as the messenger and battle pages
// looking "frozen" — the bet slip's backdrop or the lingering body lock
// blocked the close button, top nav, and every other tap target until the
// user refreshed.
//
// This hook centralizes the recovery logic that previously only lived on
// /messenger so EVERY page automatically heals from a stale lock:
//   1. On mount, immediately clear any body/html lock styles.
//   2. While mounted, run a lightweight watchdog (default every 1500ms) that
//      checks whether the body still looks locked but no modal is actually
//      open in the DOM. If so, release the lock.
//
// The watchdog is intentionally idempotent and cheap — touching style
// properties to '' is a no-op when they were already empty. We never clear
// styles while a real modal is mounted, so legitimate scroll locks are
// preserved.

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
  // Forcibly clear the lock-ownership markers too. If a real modal is
  // still mounted (extremely rare on a forced release), its cleanup
  // effect will simply find the count already gone and harmlessly skip
  // the decrement. Leaving stale markers behind would trick the
  // watchdog into thinking a future legitimate stranded lock is owned.
  try {
    delete document.body.dataset.scrollLockCount;
    delete document.body.dataset.scrollLockOwner;
  } catch (_e) {}
  if (reason && typeof console !== 'undefined') {
    try { console.warn('[scroll-lock] released stale body scroll lock:', reason); } catch (_e) {}
  }
}

export default function useGlobalScrollLockRecovery({ intervalMs = 1500 } = {}) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    // Mount-time release — covers the case where the previous page's modal
    // failed to clean up before this page mounted.
    releaseBodyScrollLock(null);

    // Watchdog: detect the click-trap state where the body is locked but
    // no real modal currently owns the lock, and recover automatically.
    //
    // We rely on the deterministic ownership marker that
    // hooks/useModalScrollLock writes to document.body.dataset
    // (`scrollLockCount` / `scrollLockOwner`). If the body looks locked
    // but no owner is registered (or the count is 0), the lock is
    // stranded — most commonly because a modal was unmounted by a
    // route change before its cleanup effect ran — and is safe to
    // release. We also still match `[role="dialog"][aria-modal="true"]`
    // and `[data-scroll-lock-owner="true"]` selectors as a belt-and-
    // suspenders fallback for any modal that locks the body without
    // going through useModalScrollLock.
    const interval = setInterval(() => {
      if (typeof document === 'undefined') return;
      const b = document.body.style;
      const isLocked = b.position === 'fixed' || b.overflow === 'hidden';
      if (!isLocked) return;

      const ds = document.body.dataset || {};
      const lockCount = parseInt(ds.scrollLockCount || '0', 10) || 0;
      if (lockCount > 0 || ds.scrollLockOwner === 'true') return;

      const hasOpenModal = !!document.querySelector(
        '[role="dialog"][aria-modal="true"], [data-scroll-lock-owner="true"]'
      );
      if (!hasOpenModal) {
        releaseBodyScrollLock('no scroll-lock owner registered but body lock present');
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);
}

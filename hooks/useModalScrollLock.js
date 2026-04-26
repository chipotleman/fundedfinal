import { useEffect, useRef } from 'react';

export default function useModalScrollLock(
  isOpen,
  { restoreScroll = false, allowScrollRef = null } = {},
) {
  const savedScrollY = useRef(0);

  useEffect(() => {
    if (!isOpen) return undefined;

    const body = document.body;
    const html = document.documentElement;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    savedScrollY.current = scrollY;

    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
    };

    if (restoreScroll) {
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = 'hidden';
      window.scrollTo(0, 0);
    }

    const strict = !!allowScrollRef;
    if (strict) {
      html.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
      html.style.overscrollBehavior = 'none';
    }

    // Deterministic ownership marker so the global click-trap watchdog
    // (hooks/useGlobalScrollLockRecovery) can tell whether a real modal
    // currently owns the body lock vs. it being stranded by a torn-down
    // modal. We use a counter on body.dataset so stacked modals
    // (e.g. AuthPopup + BalanceModal) compose correctly: each lock
    // increments on mount and decrements on cleanup; the attribute is
    // removed when the count reaches 0.
    try {
      const current = parseInt(body.dataset.scrollLockCount || '0', 10) || 0;
      body.dataset.scrollLockCount = String(current + 1);
      body.dataset.scrollLockOwner = 'true';
    } catch (_e) {}

    const isInsideAllowed = (target) => {
      const el = allowScrollRef && allowScrollRef.current;
      if (!el || !target) return false;
      return el.contains(target);
    };

    const preventIfOutside = (e) => {
      if (e.touches && e.touches.length > 1) return;
      if (!isInsideAllowed(e.target)) {
        if (e.cancelable) e.preventDefault();
      }
    };

    const preventKeyScroll = (e) => {
      const keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'];
      if (!keys.includes(e.key)) return;
      const target = e.target;
      const tag = target && target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable)) return;
      if (!isInsideAllowed(target)) {
        if (e.cancelable) e.preventDefault();
      }
    };

    const hasGuard = !!allowScrollRef;
    if (hasGuard) {
      document.addEventListener('touchmove', preventIfOutside, { passive: false });
      document.addEventListener('wheel', preventIfOutside, { passive: false });
      document.addEventListener('keydown', preventKeyScroll, { passive: false });
    }

    return () => {
      if (hasGuard) {
        document.removeEventListener('touchmove', preventIfOutside);
        document.removeEventListener('wheel', preventIfOutside);
        document.removeEventListener('keydown', preventKeyScroll);
      }

      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.style.overscrollBehavior = prev.overscrollBehavior;
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscrollBehavior;

      // Mirror the increment on mount: decrement the lock counter and
      // clear the owner attribute when the last lock releases. The
      // global watchdog uses this to distinguish a legitimate active
      // modal lock from a stranded one.
      try {
        const next = (parseInt(body.dataset.scrollLockCount || '0', 10) || 0) - 1;
        if (next <= 0) {
          delete body.dataset.scrollLockCount;
          delete body.dataset.scrollLockOwner;
        } else {
          body.dataset.scrollLockCount = String(next);
        }
      } catch (_e) {}

      if (restoreScroll) {
        const prevHtmlBehavior = html.style.scrollBehavior;
        const prevBodyBehavior = body.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        body.style.scrollBehavior = 'auto';
        window.scrollTo(0, savedScrollY.current);
        html.style.scrollBehavior = prevHtmlBehavior;
        body.style.scrollBehavior = prevBodyBehavior;
      }
    };
  }, [isOpen, restoreScroll, allowScrollRef]);
}

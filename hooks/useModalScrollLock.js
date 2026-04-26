import { useEffect, useRef } from 'react';

export default function useModalScrollLock(
  isOpen,
  { restoreScroll = false } = {},
) {
  const savedScrollY = useRef(0);

  useEffect(() => {
    if (!isOpen) return undefined;

    const body = document.body;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    savedScrollY.current = scrollY;

    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
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
    }

    // Deterministic ownership marker so the route-change scroll-lock
    // release in pages/_app.js can tell whether a real modal currently
    // owns the body lock vs. it being stranded by a torn-down modal.
    // We use a counter on body.dataset so stacked modals (e.g. AuthPopup
    // + BalanceModal) compose correctly: each lock increments on mount
    // and decrements on cleanup; the attribute is removed when the
    // count reaches 0.
    try {
      const current = parseInt(body.dataset.scrollLockCount || '0', 10) || 0;
      body.dataset.scrollLockCount = String(current + 1);
      body.dataset.scrollLockOwner = 'true';
      // Mirror the lock state onto <html> so a CSS-only rule can apply
      // `overscroll-behavior: contain` to the root element. This blocks
      // iOS Safari rubber-band on touches that land on a modal backdrop
      // without installing any preventDefault listeners.
      document.documentElement.dataset.modalOpen = 'true';
    } catch (_e) {}

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;

      try {
        const next = (parseInt(body.dataset.scrollLockCount || '0', 10) || 0) - 1;
        if (next <= 0) {
          delete body.dataset.scrollLockCount;
          delete body.dataset.scrollLockOwner;
          delete document.documentElement.dataset.modalOpen;
        } else {
          body.dataset.scrollLockCount = String(next);
        }
      } catch (_e) {}

      if (restoreScroll) {
        const html = document.documentElement;
        const prevHtmlBehavior = html.style.scrollBehavior;
        const prevBodyBehavior = body.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        body.style.scrollBehavior = 'auto';
        window.scrollTo(0, savedScrollY.current);
        html.style.scrollBehavior = prevHtmlBehavior;
        body.style.scrollBehavior = prevBodyBehavior;
      }
    };
  }, [isOpen, restoreScroll]);
}

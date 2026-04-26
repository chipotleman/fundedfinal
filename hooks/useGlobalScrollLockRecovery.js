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
  if (reason && typeof console !== 'undefined') {
    try { console.warn('[scroll-lock] released stale body scroll lock:', reason); } catch (_e) {}
  }
}

import { useEffect, useRef } from 'react';

// Body inline-style keys that the lock manages. Listed in one place so
// the install path, the cleanup path, and the unit test stay in sync.
const LOCK_STYLE_KEYS = ['position', 'top', 'left', 'right', 'width', 'overflow'];

// Global stack of currently-installed locks, each represented by an
// entry the install path pushes and the release path removes by id.
// The body's inline styles always reflect the styles of the entry on
// top of this stack — when a lock is added or removed, the top entry's
// styles get re-applied. This makes the cleanup order-independent
// (task #576: closing an outer modal first while an inner is still
// open must not unlock the page).
//
// `originalScrollY` is captured when the stack transitions from empty
// to non-empty (the very first lock); it's used to restore the user's
// scroll position when the body leaves a `position: fixed` state
// (either because the stack drained or because the new top doesn't
// fix the body).
const lockState = {
  stack: /** @type {Array<{ id: number, restoreScroll: boolean, styles: Record<string, string>, savedScrollY: number }>} */ ([]),
  originalScrollY: 0,
  nextId: 1,
};

// Exposed for unit testing — reset module-level state between scenarios.
export function _resetScrollLockStateForTests() {
  lockState.stack.length = 0;
  lockState.originalScrollY = 0;
  lockState.nextId = 1;
}

// Drain the lock stack without touching the DOM. Called by the global
// route-change recovery in `useGlobalScrollLockRecovery.releaseBodyScrollLock`
// after it has manually cleared the body's inline styles, so that any
// still-mounted modal's eventual React-cleanup release runs as a no-op
// (no spurious scroll restore on top of the new page). The body has
// already been cleared by the caller, so we don't apply any styles
// here.
export function _drainScrollLockStack() {
  lockState.stack.length = 0;
  lockState.originalScrollY = 0;
}

function applyStyles(body, styles) {
  for (const key of LOCK_STYLE_KEYS) {
    body.style[key] = styles[key] || '';
  }
}

function clearStyles(body) {
  for (const key of LOCK_STYLE_KEYS) {
    body.style[key] = '';
  }
}

function topIsFixed() {
  if (lockState.stack.length === 0) return false;
  return lockState.stack[lockState.stack.length - 1].styles.position === 'fixed';
}

function syncDataAttrs(body, html) {
  try {
    if (lockState.stack.length === 0) {
      delete body.dataset.scrollLockCount;
      delete body.dataset.scrollLockOwner;
      delete html.dataset.modalOpen;
    } else {
      body.dataset.scrollLockCount = String(lockState.stack.length);
      body.dataset.scrollLockOwner = 'true';
      // Mirror lock state onto <html> so a CSS-only rule can apply
      // `overscroll-behavior: contain` to the root, blocking iOS
      // Safari rubber-band on backdrop touches without installing
      // any preventDefault listeners.
      html.dataset.modalOpen = 'true';
    }
  } catch (_e) {}
}

// Install a body scroll lock. Returns a token-and-scroll record the
// matching `releaseModalScrollLock` call needs. Exported for unit
// testing without React.
export function installModalScrollLock(restoreScroll) {
  if (typeof document === 'undefined') {
    return { id: 0, scrollY: 0 };
  }
  const body = document.body;
  const html = document.documentElement;
  const scrollY = (typeof window !== 'undefined'
    ? (window.scrollY || window.pageYOffset || 0)
    : 0);

  // Capture the user's pre-lock scroll position the first time the
  // stack goes from empty to non-empty. Subsequent locks see
  // `window.scrollY === 0` because the body is already fixed; we want
  // the eventual final restore to land back where the user actually was.
  if (lockState.stack.length === 0) {
    lockState.originalScrollY = scrollY;
  }

  const styles = restoreScroll
    ? {
        position: 'fixed',
        top: `-${scrollY}px`,
        left: '0',
        right: '0',
        width: '100%',
        overflow: 'hidden',
      }
    : {
        // overflow-only locks deliberately don't fix the body, so
        // sticky positioning on the underlying page keeps working.
        overflow: 'hidden',
      };

  const wasFixedBefore = topIsFixed();

  const id = lockState.nextId++;
  lockState.stack.push({ id, restoreScroll, styles, savedScrollY: scrollY });

  // Body always reflects the top of the stack. The new entry IS the
  // top, so apply its styles.
  applyStyles(body, styles);
  syncDataAttrs(body, html);

  // If installing this lock causes the body to leave a fixed state
  // (e.g. an overflow-only modal opens on top of a restoreScroll
  // modal), restore the user's scroll position so the page doesn't
  // appear to snap to the top while the new modal is open.
  const isFixedNow = topIsFixed();
  if (wasFixedBefore && !isFixedNow && typeof window !== 'undefined') {
    restoreScrollWithoutAnimation(html, body, lockState.originalScrollY);
  }

  return { id, scrollY };
}

function restoreScrollWithoutAnimation(html, body, y) {
  // Suppress smooth scrolling on this restore so the user doesn't
  // see the page animate — that animation would conflict with
  // reduced-motion preferences and looks like a glitch.
  const prevHtmlBehavior = html.style.scrollBehavior;
  const prevBodyBehavior = body.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  body.style.scrollBehavior = 'auto';
  window.scrollTo(0, y);
  html.style.scrollBehavior = prevHtmlBehavior;
  body.style.scrollBehavior = prevBodyBehavior;
}

// Release a body scroll lock by the id returned from
// `installModalScrollLock`. Order-independent: removes this lock from
// the stack wherever it sits, then re-applies the new top's styles
// (or fully clears the body if the stack is now empty).
//
// Scroll restoration: triggered whenever the body transitions from a
// `position: fixed` state to a non-fixed one (either the stack
// drained or the new top is an overflow-only lock). We restore to
// `lockState.originalScrollY` — the scroll position captured before
// any lock was active — so the user lands back where they were
// regardless of how many modals stacked on top.
export function releaseModalScrollLock(id) {
  if (typeof document === 'undefined') return;
  const body = document.body;
  const html = document.documentElement;

  const wasFixedBefore = topIsFixed();

  // Remove this lock from wherever it sits in the stack.
  const idx = lockState.stack.findIndex((e) => e.id === id);
  if (idx !== -1) {
    lockState.stack.splice(idx, 1);
  }

  if (lockState.stack.length === 0) {
    clearStyles(body);
  } else {
    const top = lockState.stack[lockState.stack.length - 1];
    applyStyles(body, top.styles);
  }
  syncDataAttrs(body, html);

  const isFixedNow = topIsFixed();
  const leftFixedState = wasFixedBefore && !isFixedNow;

  if (leftFixedState && typeof window !== 'undefined') {
    restoreScrollWithoutAnimation(html, body, lockState.originalScrollY);
  }
}

export default function useModalScrollLock(
  isOpen,
  { restoreScroll = false } = {},
) {
  // Hold the install token across the effect's lifecycle so cleanup
  // can release the exact lock this hook installed (vital for the
  // out-of-order close case — the token identifies WHICH lock to pop,
  // not "the most recent one").
  const tokenRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const token = installModalScrollLock(restoreScroll);
    tokenRef.current = token;

    return () => {
      if (tokenRef.current) {
        releaseModalScrollLock(tokenRef.current.id);
        tokenRef.current = null;
      }
    };
  }, [isOpen, restoreScroll]);
}

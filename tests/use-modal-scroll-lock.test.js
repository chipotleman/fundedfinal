#!/usr/bin/env node
/**
 * Runtime regression tests for `hooks/useModalScrollLock` (task #576).
 *
 * Background:
 *   The chat popup (`components/messages/MessagePopup.js`) and the
 *   forfeit modal (`components/battle/ForfeitModal.js`) both lock the
 *   body via the shared `useModalScrollLock` hook with
 *   `{ restoreScroll: true }`. Users reported that after opening and
 *   closing either popup the underlying page would no longer scroll.
 *
 *   The original implementation captured `prev` body styles per-lock
 *   and unconditionally restored them on cleanup. Two problems:
 *
 *     1. If `prev` was captured while another modal had already locked
 *        the body — or while a previous lock's cleanup left stale
 *        inline styles in place — the restore re-applied those styles
 *        even though no modal was actually open, leaving the page
 *        stuck.
 *
 *     2. With stacked modals closing OUT OF ORDER (outer first), the
 *        outer's `prev` (the unlocked-body state) would be restored
 *        while the inner was still open — releasing the lock too
 *        early.
 *
 *   The fix replaces the per-lock prev/restore design with a
 *   module-level stack of installed locks, each identified by a
 *   token. The body's inline styles always reflect the styles of the
 *   top entry on the stack. Releasing pops a specific token (not "the
 *   most recent") and re-applies the new top's styles, or fully
 *   clears the body if the stack is empty. Scroll position is
 *   restored to the user's original pre-lock scrollY whenever the
 *   body transitions from a `position: fixed` state to a non-fixed
 *   one.
 *
 * What this test covers:
 *   1. Single-modal open → close: body is fully unlocked, even when
 *      the body had a stale `overflow: hidden` inline style at install
 *      time (simulating a leftover from a torn-down modal).
 *   2. Stacked-modal close-in-order: outer's lock state remains in
 *      effect when the inner closes; body fully released only on
 *      outer close.
 *   3. Stacked-modal close-OUT-of-order (outer first): the body
 *      stays locked until the inner also closes — the page is NOT
 *      released early.
 *   4. Mixed locks (overflow-only outer + restoreScroll inner) close
 *      out-of-order: same invariant — body stays locked until last
 *      release.
 *   5. The `data-modal-open` attribute on `<html>` is cleared exactly
 *      when the last lock is released.
 *   6. Scroll position is restored to the pre-lock value when the
 *      body leaves a fixed state.
 *   7. Non-restoreScroll (overflow-only) locks install/release cleanly.
 *
 * How to run:
 *   node tests/use-modal-scroll-lock.test.js
 */

'use strict';

// Minimal DOM mock — just enough surface area for installModalScrollLock
// and releaseModalScrollLock. We don't need a full jsdom because the
// hook only touches body.style, html.style, body.dataset, html.dataset,
// and window.scrollY/scrollTo.
function makeDom() {
  const styleProxy = () => new Proxy({}, {
    get(target, prop) { return target[prop] === undefined ? '' : target[prop]; },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  const datasetProxy = () => new Proxy({}, {
    get(target, prop) { return target[prop]; },
    set(target, prop, value) { target[prop] = value; return true; },
    deleteProperty(target, prop) { delete target[prop]; return true; },
  });
  const dom = {
    body: { style: styleProxy(), dataset: datasetProxy() },
    documentElement: { style: styleProxy(), dataset: datasetProxy() },
  };
  const win = {
    scrollY: 0,
    pageYOffset: 0,
    scrollTo(_x, y) { win.scrollY = y; win.pageYOffset = y; },
  };
  return { dom, win };
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error(`  ✗ ${msg}`);
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

function withMockedGlobals(scrollY, fn) {
  const { dom, win } = makeDom();
  win.scrollY = scrollY;
  win.pageYOffset = scrollY;
  const prevDoc = global.document;
  const prevWin = global.window;
  global.document = dom;
  global.window = win;
  try {
    fn(dom, win);
  } finally {
    global.document = prevDoc;
    global.window = prevWin;
  }
}

// The hook is authored as ESM and imports from 'react'. We run this
// test under plain Node, which can't natively load that. Use esbuild
// to transform the source to CJS on the fly, stub the 'react' import
// (we never invoke the React hook itself, only the pure helpers), and
// evaluate the result with `vm`. Module is loaded ONCE so the
// module-level lock stack is shared across helper calls within a test;
// we reset it via the exposed `_resetScrollLockStateForTests` between
// tests.
let cachedHook = null;
function loadHook() {
  if (cachedHook) return cachedHook;
  const path = require('path');
  const fs = require('fs');
  const vm = require('vm');
  const esbuild = require('esbuild');

  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'hooks', 'useModalScrollLock.js'),
    'utf8',
  );
  const { code } = esbuild.transformSync(src, {
    loader: 'js',
    format: 'cjs',
    target: 'node18',
  });

  const fakeReact = { useEffect: () => {}, useRef: () => ({ current: null }) };
  const fakeRequire = (mod) => {
    if (mod === 'react') return fakeReact;
    return require(mod);
  };
  const moduleObj = { exports: {} };
  const script = new vm.Script(code, { filename: 'useModalScrollLock.cjs.js' });
  // The vm context references `global.document` / `global.window`
  // dynamically at call time (each helper invocation reads them via
  // `typeof document` etc.), so we proxy them through getters that
  // resolve against the real `global` at access time. Without this,
  // the snapshot taken at context creation would freeze them to
  // undefined.
  const ctx = {
    module: moduleObj,
    exports: moduleObj.exports,
    require: fakeRequire,
    console,
    process,
    get document() { return global.document; },
    get window() { return global.window; },
  };
  vm.createContext(ctx);
  script.runInContext(ctx);
  cachedHook = moduleObj.exports;
  return cachedHook;
}

function bodyIsFullyUnlocked(body) {
  return (
    body.style.position === '' &&
    body.style.top === '' &&
    body.style.left === '' &&
    body.style.right === '' &&
    body.style.width === '' &&
    body.style.overflow === '' &&
    body.dataset.scrollLockCount === undefined &&
    body.dataset.scrollLockOwner === undefined
  );
}

function bodyIsFixedLocked(body) {
  return (
    body.style.position === 'fixed' &&
    body.style.overflow === 'hidden'
  );
}

function freshHook() {
  const hook = loadHook();
  hook._resetScrollLockStateForTests();
  return hook;
}

function test1_singleModalCloseUnlocks() {
  console.log('test1: single restoreScroll modal — open then close fully unlocks body');
  withMockedGlobals(120, (dom, win) => {
    const { installModalScrollLock, releaseModalScrollLock } = freshHook();
    const token = installModalScrollLock(true);
    assert(token.scrollY === 120, 'install captures current scrollY');
    assert(dom.body.style.position === 'fixed', 'install sets position:fixed');
    assert(dom.body.style.overflow === 'hidden', 'install sets overflow:hidden');
    assert(dom.body.style.top === '-120px', 'install sets top to negative scrollY');
    assert(dom.body.dataset.scrollLockCount === '1', 'install bumps counter to 1');
    assert(dom.documentElement.dataset.modalOpen === 'true', 'install sets html data-modal-open');

    // Simulate the user being scrolled to 0 because body went fixed.
    win.scrollY = 0; win.pageYOffset = 0;
    releaseModalScrollLock(token.id);
    assert(bodyIsFullyUnlocked(dom.body), 'release fully clears body lock styles + counter');
    assert(dom.documentElement.dataset.modalOpen === undefined, 'release clears html data-modal-open');
    assert(win.scrollY === 120, 'release restores user scroll position');
  });
}

function test2_stalePrevDoesNotReLockBody() {
  console.log('test2: stale leftover overflow:hidden does NOT re-lock body on close');
  withMockedGlobals(0, (dom) => {
    const { installModalScrollLock, releaseModalScrollLock } = freshHook();
    // Simulate a stale leftover from a torn-down sibling modal: body
    // has overflow:hidden inline but the lock stack is empty. The new
    // stack-based design ignores any pre-existing inline body styles
    // on cleanup — it always re-applies the top of its OWN stack (or
    // clears) — so the stale leftover can't strand the body.
    dom.body.style.overflow = 'hidden';
    const token = installModalScrollLock(true);
    releaseModalScrollLock(token.id);
    assert(bodyIsFullyUnlocked(dom.body), 'last-modal release fully clears body even if stale styles existed');
  });
}

function test3_stackedCloseInOrder() {
  console.log('test3: stacked modals — outer lock survives inner close, fully released on outer close');
  withMockedGlobals(50, (dom, win) => {
    const { installModalScrollLock, releaseModalScrollLock } = freshHook();
    const a = installModalScrollLock(true);
    assert(dom.body.dataset.scrollLockCount === '1', 'after outer install: counter=1');
    assert(dom.body.style.top === '-50px', 'outer install: top = -50');
    win.scrollY = 0; win.pageYOffset = 0; // body went fixed

    const b = installModalScrollLock(true);
    assert(dom.body.dataset.scrollLockCount === '2', 'after inner install: counter=2');
    assert(dom.body.style.top === '-0px', 'inner install: top reflects current (locked) scrollY=0');

    // Inner closes first (in order).
    releaseModalScrollLock(b.id);
    assert(dom.body.dataset.scrollLockCount === '1', 'after inner close: counter back to 1');
    assert(bodyIsFixedLocked(dom.body), 'body still fixed-locked (outer still active)');
    assert(dom.body.style.top === '-50px', 'outer\'s top:-50 re-applied');
    assert(dom.documentElement.dataset.modalOpen === 'true', 'html data-modal-open still set');
    assert(win.scrollY === 0, 'no scroll restore yet (still inside fixed state)');

    // Outer closes.
    releaseModalScrollLock(a.id);
    assert(bodyIsFullyUnlocked(dom.body), 'after outer close: body fully unlocked');
    assert(dom.documentElement.dataset.modalOpen === undefined, 'html data-modal-open cleared');
    assert(win.scrollY === 50, 'scroll restored to original pre-lock position');
  });
}

function test4_stackedCloseOutOfOrder() {
  console.log('test4: stacked modals — closing OUTER FIRST does not strand or release prematurely');
  withMockedGlobals(75, (dom, win) => {
    const { installModalScrollLock, releaseModalScrollLock } = freshHook();
    const a = installModalScrollLock(true);
    assert(dom.body.style.top === '-75px', 'outer install: top = -75');
    win.scrollY = 0; win.pageYOffset = 0;
    const b = installModalScrollLock(true);
    assert(dom.body.dataset.scrollLockCount === '2', 'two modals installed');

    // Out-of-order: outer closes FIRST while inner is still open.
    releaseModalScrollLock(a.id);
    assert(dom.body.dataset.scrollLockCount === '1', 'after outer close: counter=1');
    // CRITICAL: body must remain locked because inner is still open.
    assert(bodyIsFixedLocked(dom.body), 'body STILL fixed-locked (inner still active)');
    assert(dom.body.style.top === '-0px', 'inner\'s top:-0 re-applied (was top of stack)');
    assert(dom.documentElement.dataset.modalOpen === 'true', 'html data-modal-open still set');
    assert(win.scrollY === 0, 'NO scroll restore while inner is still open');

    // Inner closes — last one out.
    releaseModalScrollLock(b.id);
    assert(bodyIsFullyUnlocked(dom.body), 'after both closed: body fully unlocked');
    assert(dom.documentElement.dataset.modalOpen === undefined, 'html data-modal-open cleared');
    assert(win.scrollY === 75, 'scroll restored to original pre-lock position');
  });
}

function test5_mixedLocksOutOfOrder() {
  console.log('test5: overflow-only outer + restoreScroll inner, closing OUTER FIRST stays locked');
  withMockedGlobals(40, (dom, win) => {
    const { installModalScrollLock, releaseModalScrollLock } = freshHook();
    // A: overflow-only (e.g. AuthPopup-style). Doesn't fix body.
    const a = installModalScrollLock(false);
    assert(dom.body.style.overflow === 'hidden', 'outer overflow-only: overflow:hidden');
    assert(dom.body.style.position === '', 'outer overflow-only: NO position:fixed');

    // B: restoreScroll (e.g. MessagePopup). Fixes body.
    const b = installModalScrollLock(true);
    assert(bodyIsFixedLocked(dom.body), 'inner restoreScroll: body now fixed-locked');
    assert(dom.body.style.top === '-40px', 'inner: top = -40');
    win.scrollY = 0; win.pageYOffset = 0;

    // Outer closes first (out of order).
    releaseModalScrollLock(a.id);
    // Inner B is still on top — body stays fixed-locked.
    assert(bodyIsFixedLocked(dom.body), 'after outer close: body STILL fixed-locked');
    assert(dom.body.style.top === '-40px', 'inner\'s lock styles still applied');
    assert(win.scrollY === 0, 'no scroll restore (still in fixed state)');

    // Inner closes.
    releaseModalScrollLock(b.id);
    assert(bodyIsFullyUnlocked(dom.body), 'after inner close: body fully unlocked');
    assert(win.scrollY === 40, 'scroll restored to original');
  });
}

function test6_innerClosesFirstMixedTriggersScrollRestore() {
  console.log('test6: restoreScroll inner closing while overflow-only outer remains restores scroll');
  withMockedGlobals(80, (dom, win) => {
    const { installModalScrollLock, releaseModalScrollLock } = freshHook();
    // A: overflow-only first.
    const a = installModalScrollLock(false);
    assert(dom.body.style.overflow === 'hidden', 'outer: overflow:hidden, no fix');
    // window.scrollY stays 80 — body is not fixed.

    // B: restoreScroll inner.
    const b = installModalScrollLock(true);
    assert(bodyIsFixedLocked(dom.body), 'inner: body fixed-locked');
    assert(dom.body.style.top === '-80px', 'inner: top = -80');
    win.scrollY = 0; win.pageYOffset = 0;

    // Inner closes (in order). Body transitions from fixed to
    // overflow-only — must restore scroll so user doesn't jump to top.
    releaseModalScrollLock(b.id);
    assert(dom.body.style.position === '', 'after inner close: no longer fixed');
    assert(dom.body.style.overflow === 'hidden', 'outer\'s overflow:hidden still in effect');
    assert(win.scrollY === 80, 'scroll restored to original on leaving fixed state');

    // Outer closes — already non-fixed, no further scroll change.
    releaseModalScrollLock(a.id);
    assert(bodyIsFullyUnlocked(dom.body), 'after outer close: body fully unlocked');
    assert(win.scrollY === 80, 'scroll position unchanged on overflow-only release');
  });
}

function test6b_outerRestoreScrollInnerOverflowOnly() {
  console.log('test6b: outer restoreScroll + inner overflow-only — both close orders');

  // Sub-case A: close in order (inner overflow-only first).
  withMockedGlobals(90, (dom, win) => {
    const { installModalScrollLock, releaseModalScrollLock } = freshHook();
    // A: restoreScroll outer first.
    const a = installModalScrollLock(true);
    assert(bodyIsFixedLocked(dom.body), 'A install: body fixed-locked');
    assert(dom.body.style.top === '-90px', 'A install: top = -90');
    win.scrollY = 0; win.pageYOffset = 0;

    // B: overflow-only inner. Top-of-stack style swap means the body
    // becomes overflow-only (NOT fixed) while B is on top — this is
    // the documented "top wins" semantic. Even so, the page is still
    // scroll-locked because overflow:hidden is in effect.
    const b = installModalScrollLock(false);
    assert(dom.body.style.position === '', 'B install: body no longer fixed (top of stack is overflow-only)');
    assert(dom.body.style.overflow === 'hidden', 'B install: overflow:hidden in effect');
    // CRITICAL: leaving fixed state must restore scroll so the user
    // doesn't snap to the top of the page while B is open.
    assert(win.scrollY === 90, 'B install: scroll restored on leaving fixed state');

    // B closes (in order).
    releaseModalScrollLock(b.id);
    // Body returns to A's fixed state. Re-fixing pulls window scrollY
    // back to 0; a real browser does this automatically when
    // position:fixed is re-applied. Our DOM mock doesn't, so we
    // simulate it.
    win.scrollY = 0; win.pageYOffset = 0;
    assert(bodyIsFixedLocked(dom.body), 'after B close: body re-fixed (A back on top)');
    assert(dom.body.style.top === '-90px', 'A\'s top:-90 re-applied');

    // A closes — last out.
    releaseModalScrollLock(a.id);
    assert(bodyIsFullyUnlocked(dom.body), 'after A close: body fully unlocked');
    assert(win.scrollY === 90, 'final scroll restore to original');
  });

  // Sub-case B: close OUT OF ORDER (outer restoreScroll first).
  withMockedGlobals(45, (dom, win) => {
    const { installModalScrollLock, releaseModalScrollLock } = freshHook();
    const a = installModalScrollLock(true);
    win.scrollY = 0; win.pageYOffset = 0;
    const b = installModalScrollLock(false);
    // After B install: body is overflow-only (top wins), scroll
    // restored to 45.
    assert(dom.body.style.overflow === 'hidden' && dom.body.style.position === '',
      'B on top: overflow-only in effect');
    assert(win.scrollY === 45, 'scroll restored on leaving fixed state via B install');

    // Outer A closes first (out of order). B is still on top.
    releaseModalScrollLock(a.id);
    assert(dom.body.style.overflow === 'hidden', 'after A close: B still on top, overflow:hidden remains');
    assert(dom.body.style.position === '', 'after A close: body still NOT fixed (B doesn\'t fix)');
    assert(dom.body.dataset.scrollLockCount === '1', 'counter=1 (B still active)');
    assert(win.scrollY === 45, 'no scroll change (was already non-fixed)');

    // B closes — last out.
    releaseModalScrollLock(b.id);
    assert(bodyIsFullyUnlocked(dom.body), 'after B close: body fully unlocked');
    assert(win.scrollY === 45, 'scroll position preserved (was already there)');
  });
}

function test7_drainOnRouteChangeNoSpuriousScrollRestore() {
  console.log('test7: route-change drain — modal cleanup after drain is a no-op (no scroll jump)');
  withMockedGlobals(60, (dom, win) => {
    const { installModalScrollLock, releaseModalScrollLock, _drainScrollLockStack } = freshHook();
    const token = installModalScrollLock(true);
    assert(bodyIsFixedLocked(dom.body), 'install: body fixed-locked');
    win.scrollY = 0; win.pageYOffset = 0;

    // Simulate routeChangeStart: global recovery clears body styles
    // and drains the stack.
    dom.body.style.position = '';
    dom.body.style.top = '';
    dom.body.style.left = '';
    dom.body.style.right = '';
    dom.body.style.width = '';
    dom.body.style.overflow = '';
    delete dom.body.dataset.scrollLockCount;
    delete dom.body.dataset.scrollLockOwner;
    delete dom.documentElement.dataset.modalOpen;
    _drainScrollLockStack();

    // Simulate the new page loading and the user scrolling on it.
    win.scrollY = 30; win.pageYOffset = 30;

    // Now the old modal finally unmounts (React cleanup runs after
    // the new page is rendered).
    releaseModalScrollLock(token.id);
    assert(win.scrollY === 30, 'no spurious scrollTo after drain — new page scroll preserved');
    assert(bodyIsFullyUnlocked(dom.body), 'body remains unlocked');
  });
}

function test8_overflowOnlyModalRelease() {
  console.log('test7: non-restoreScroll modal (overflow-only) cleanly releases body');
  withMockedGlobals(0, (dom) => {
    const { installModalScrollLock, releaseModalScrollLock } = freshHook();
    const token = installModalScrollLock(false);
    assert(dom.body.style.overflow === 'hidden', 'install sets overflow:hidden');
    assert(dom.body.style.position === '', 'overflow-only install does NOT set position:fixed');
    releaseModalScrollLock(token.id);
    assert(bodyIsFullyUnlocked(dom.body), 'release fully clears body');
  });
}

function main() {
  console.log('[useModalScrollLock] runtime regression tests');
  console.log('');
  test1_singleModalCloseUnlocks();
  console.log('');
  test2_stalePrevDoesNotReLockBody();
  console.log('');
  test3_stackedCloseInOrder();
  console.log('');
  test4_stackedCloseOutOfOrder();
  console.log('');
  test5_mixedLocksOutOfOrder();
  console.log('');
  test6_innerClosesFirstMixedTriggersScrollRestore();
  console.log('');
  test6b_outerRestoreScrollInnerOverflowOnly();
  console.log('');
  test7_drainOnRouteChangeNoSpuriousScrollRestore();
  console.log('');
  test8_overflowOnlyModalRelease();
  console.log('');
  if (failures > 0) {
    console.error(`[useModalScrollLock] FAIL — ${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log('[useModalScrollLock] OK — all assertions passed');
  process.exit(0);
}

main();

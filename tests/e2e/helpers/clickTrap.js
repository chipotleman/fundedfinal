/**
 * Shared helpers for the messenger / notifications click-trap smoke tests.
 *
 * The TopNavbar treats the visitor as logged-in when a `current_user`
 * entry exists in `localStorage`, even without a NextAuth session. We use
 * that hook plus broad API stubs so the tests can run against a freshly
 * started dev server with no real user, no DB rows, and no live SSE.
 */
const { expect } = require('@playwright/test');

const FAKE_USER = {
  id: 'e2e-user-1',
  email: 'e2e@example.com',
  username: 'e2etester',
  name: 'E2E Tester',
};

const EMPTY_NOTIFICATIONS = {
  counts: {
    battleInvites: 0,
    friendRequests: 0,
    gameResults: 0,
    unreadMessages: 0,
  },
  battleInvites: [],
  friendRequests: [],
  gameResults: [],
  pendingRematches: [],
  unreadMessages: [],
};

async function setupStubs(page) {
  await page.addInitScript((user) => {
    try {
      window.localStorage.setItem('current_user', JSON.stringify(user));
    } catch (e) {}
  }, FAKE_USER);

  const json = (body, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/api/notifications', (route) => route.fulfill(json(EMPTY_NOTIFICATIONS)));
  await page.route('**/api/notifications/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/messages/conversations', (route) => route.fulfill(json([])));
  await page.route('**/api/messages/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/profiles/**', (route) =>
    route.fulfill(
      json({
        id: FAKE_USER.id,
        username: FAKE_USER.username,
        bankroll: 0,
        status: 'inactive',
        total_bets: 0,
        wins: 0,
        losses: 0,
      }),
    ),
  );
  await page.route('**/api/auth/session', (route) => route.fulfill(json({})));
  await page.route('**/api/friends/**', (route) => route.fulfill(json([])));
  await page.route('**/api/battles/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/matchups/**', (route) => route.fulfill(json({ ok: true })));
}

async function getBodyLockStyles(page) {
  return page.evaluate(() => {
    const s = document.body.style;
    return {
      position: s.position || '',
      overflow: s.overflow || '',
      top: s.top || '',
      left: s.left || '',
      right: s.right || '',
      width: s.width || '',
      height: s.height || '',
    };
  });
}

async function expectBodyUnlocked(page) {
  const styles = await getBodyLockStyles(page);
  expect(
    styles,
    'body should have no leftover scroll-lock styles after dismissing dropdowns / menus',
  ).toEqual({
    position: '',
    overflow: '',
    top: '',
    left: '',
    right: '',
    width: '',
    height: '',
  });
}

/**
 * Asserts that no leftover full-screen overlay (fixed-position element
 * covering ~the entire viewport) is hit-testable in the DOM. This catches
 * the regression where a dropdown's invisible backdrop / portal node is
 * left behind after dismissal and silently swallows the next tap.
 */
async function expectNoFullscreenOverlay(page) {
  const offenders = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return Array.from(document.querySelectorAll('body *'))
      .filter((el) => {
        const cs = window.getComputedStyle(el);
        if (cs.position !== 'fixed') return false;
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (cs.pointerEvents === 'none') return false;
        const r = el.getBoundingClientRect();
        // Covers >=90% of the viewport in both dimensions => full-screen overlay
        return r.width >= vw * 0.9 && r.height >= vh * 0.9;
      })
      .map((el) => ({
        tag: el.tagName,
        class: typeof el.className === 'string' ? el.className : '',
        role: el.getAttribute('role') || '',
      }));
  });
  expect(
    offenders,
    'no full-screen fixed overlay should remain hit-testable after dismissing dropdowns / menus',
  ).toEqual([]);
}

/**
 * Adds enough vertical content to the page to make it scrollable and then
 * scrolls down a chunk, so subsequent dropdown open/dismiss checks run in
 * a scrolled state (the bug often only surfaces once the page has
 * actually scrolled).
 */
async function scrollPage(page, distance = 600) {
  await page.evaluate((d) => {
    if (document.body.scrollHeight <= window.innerHeight + d) {
      const spacer = document.createElement('div');
      spacer.setAttribute('data-e2e-spacer', '1');
      spacer.style.height = `${window.innerHeight + d + 200}px`;
      spacer.style.width = '1px';
      document.body.appendChild(spacer);
    }
    window.scrollTo(0, d);
  }, distance);
}

const TARGET_PAGES = ['/messenger', '/notifications'];

module.exports = {
  FAKE_USER,
  EMPTY_NOTIFICATIONS,
  setupStubs,
  getBodyLockStyles,
  expectBodyUnlocked,
  expectNoFullscreenOverlay,
  scrollPage,
  TARGET_PAGES,
};

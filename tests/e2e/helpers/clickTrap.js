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

const TARGET_PAGES = ['/messenger', '/notifications'];

module.exports = {
  FAKE_USER,
  EMPTY_NOTIFICATIONS,
  setupStubs,
  getBodyLockStyles,
  expectBodyUnlocked,
  TARGET_PAGES,
};

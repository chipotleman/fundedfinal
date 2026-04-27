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

/**
 * Superset of `setupStubs` for the broader page-smoke suite. The
 * messenger / notifications click-trap suite only needs a logged-in
 * shell with empty notifications, so it can leave `/api/auth/session`
 * returning `{}`. The page-smoke suite, on the other hand, mounts
 * routes like `/withdrawal` that gate their entire render on
 * `useSession()`'s `session` being non-null — without a real session
 * payload they redirect straight back to `/` and the smoke check
 * silently degrades. We also pre-stub the additional GET endpoints
 * those pages fetch on mount (games, promo slots, payment methods,
 * withdrawals, has-deposited, …) so the production build has nothing
 * left to log a network error about.
 */
async function setupSmokeStubs(page) {
  await setupStubs(page);

  const json = (body, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  // Re-stub the session endpoint with a real-looking NextAuth payload so
  // pages that read `useSession()` (e.g. /withdrawal, /battle) treat the
  // visitor as authenticated and render their authenticated content
  // instead of redirecting to `/`.
  await page.unroute('**/api/auth/session');
  await page.route('**/api/auth/session', (route) =>
    route.fulfill(
      json({
        user: {
          id: FAKE_USER.id,
          email: FAKE_USER.email,
          name: FAKE_USER.name,
          image: null,
        },
        expires: '2099-12-31T23:59:59.999Z',
      }),
    ),
  );

  // Home page reads /api/games via GamesContext and /api/promo-slots
  // for its rotating promo carousel.
  await page.route('**/api/games', (route) =>
    route.fulfill(json({ games: [], inplayEvents: [], lastUpdated: null })),
  );
  await page.route('**/api/promo-slots', (route) => route.fulfill(json({ slots: [] })));

  // Withdrawal page reads these on mount.
  await page.route('**/api/payment-methods', (route) => route.fulfill(json([])));
  await page.route('**/api/withdrawals', (route) => route.fulfill(json([])));
  await page.route('**/api/withdrawals/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/user/has-deposited', (route) =>
    route.fulfill(json({ hasDeposited: false, matchGranted: false })),
  );
  await page.route('**/api/user/**', (route) => route.fulfill(json({ ok: true })));

  // Live-battles section + admin avatar lookups + pools the dashboard
  // touches. These already partially overlap with `setupStubs` but we
  // pin them explicitly so a future GET that's added doesn't slip
  // through with an unhandled 500.
  await page.route('**/api/admin/battle-avatars', (route) => route.fulfill(json([])));
  await page.route('**/api/pools/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/promos/**', (route) => route.fulfill(json({ ok: true })));
}

/**
 * Sibling of `setupSmokeStubs` for the signed-out marketing pages
 * (`/login`, `/pricing`, `/pikking-101`, `/auth`).
 *
 * Deliberately does NOT seed `current_user` in `localStorage` and
 * does NOT pretend `/api/auth/session` returned a populated NextAuth
 * payload — those pages need to render in their genuine signed-out
 * shell, which is what brand-new visitors actually hit before they
 * click "Sign Up" / "Sign In". If we accidentally smoke-tested them
 * with a fake session, a regression that only shows up for
 * unauthenticated visitors (e.g. a navbar branch that crashes when
 * `useSession()` returns `null`) would slip straight through.
 *
 * We still stub the broad set of GET endpoints that contexts mounted
 * by `_app.js` (NotificationsContext, GamesContext, …) might fire on
 * mount even in the signed-out shell, so the production build has
 * nothing left to log a 5xx / network error about.
 */
async function setupSignedOutStubs(page) {
  // Bypass the private-beta access gate that wraps every page in
  // `_app.js` — without this, `_app.js` short-circuits straight to
  // `<BetaLanding />` and we'd be smoke-testing the access-code
  // prompt instead of the actual marketing page. This is the same
  // bypass the messenger-voice-note suite uses; we deliberately
  // do NOT seed `current_user` so the visitor still arrives at the
  // marketing page in its true signed-out state.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('beta_access', 'true');
    } catch (_e) {}
  });

  const json = (body, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  // Genuine signed-out NextAuth response. Returning `{}` is what the
  // real `/api/auth/session` endpoint serves for an anonymous visitor,
  // and what `useSession()` reads as "no session". Critically we do
  // NOT seed `current_user` in localStorage either.
  await page.route('**/api/auth/session', (route) => route.fulfill(json({})));

  // Any context that DOES still fire a fetch on mount even when
  // signed out (or that races the auth-gate check) gets a benign
  // empty response so the smoke build sees zero 5xx noise.
  await page.route('**/api/notifications', (route) => route.fulfill(json(EMPTY_NOTIFICATIONS)));
  await page.route('**/api/notifications/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/messages/conversations', (route) => route.fulfill(json([])));
  await page.route('**/api/messages/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/profiles/**', (route) => route.fulfill(json({})));
  await page.route('**/api/friends/**', (route) => route.fulfill(json([])));
  await page.route('**/api/games', (route) =>
    route.fulfill(json({ games: [], inplayEvents: [], lastUpdated: null })),
  );
  await page.route('**/api/promo-slots', (route) => route.fulfill(json({ slots: [] })));
  await page.route('**/api/promos/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/user/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/me/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/battles/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/matchups/**', (route) => route.fulfill(json({ ok: true })));
}

/**
 * Attaches console-error / pageerror / response-failure listeners to
 * `page` and returns:
 *   - `errors`  — accumulating list of console.error messages
 *   - `pageErrors` — accumulating list of uncaught JS errors
 *   - `failedRequests` — accumulating list of 5xx HTTP responses
 *
 * `console.warn` is intentionally NOT captured — Next.js production
 * builds are noisy with hydration warnings that are out of scope for a
 * page-loads-without-crashing smoke check.
 *
 * Some console messages are part of normal operation under the smoke
 * stubs (e.g. an unauthenticated `/api/auth/session` 401 on the very
 * first frame before our stub takes effect); pass them via
 * `ignorePatterns` to suppress.
 */
function attachConsoleErrorWatcher(page, { ignorePatterns = [] } = {}) {
  const isIgnored = (text) =>
    ignorePatterns.some((p) => (p instanceof RegExp ? p.test(text) : text.includes(p)));

  const errors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (isIgnored(text)) return;
    errors.push(text);
  });

  page.on('pageerror', (err) => {
    const text = err && err.message ? err.message : String(err);
    if (isIgnored(text)) return;
    pageErrors.push(text);
  });

  page.on('response', (resp) => {
    const status = resp.status();
    if (status < 500) return;
    const url = resp.url();
    // Ignore 5xx from the document's own asset fetches off the test
    // origin (e.g. external image CDNs the page links to) — we only
    // care about app-served endpoints.
    if (isIgnored(url)) return;
    failedRequests.push(`${status} ${url}`);
  });

  return { errors, pageErrors, failedRequests };
}

/**
 * Asserts the watcher has captured no console errors, no uncaught
 * page errors, and no 5xx responses since it was attached.
 */
function expectNoConsoleErrors({ errors, pageErrors, failedRequests }) {
  expect(pageErrors, 'page should not throw any uncaught JS errors').toEqual([]);
  expect(errors, 'page should not log any console.error messages').toEqual([]);
  expect(failedRequests, 'page should not produce any 5xx HTTP responses').toEqual([]);
}

module.exports = {
  FAKE_USER,
  EMPTY_NOTIFICATIONS,
  setupStubs,
  setupSmokeStubs,
  setupSignedOutStubs,
  attachConsoleErrorWatcher,
  expectNoConsoleErrors,
  getBodyLockStyles,
  expectBodyUnlocked,
  expectNoFullscreenOverlay,
  scrollPage,
  TARGET_PAGES,
};

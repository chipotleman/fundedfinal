/**
 * Build-time smoke test for the highest-traffic authenticated routes
 * AND the public-facing marketing pages a brand-new visitor lands on
 * before signing in.
 *
 * The messenger / notifications click-trap suite already runs against
 * the same prebuilt `.next/` artifact in CI, so adding a few more
 * page mounts here costs almost nothing in wall-clock time but gives
 * us a hard fail signal whenever a build-time regression silently
 * breaks `/`, `/battle`, the balance / withdrawal flow, OR the public
 * pages a fresh visitor hits before they have a session
 * (`/login`, `/pricing`).
 *
 * Each path is mounted in a desktop and a mobile Playwright project.
 * Authenticated routes get `setupSmokeStubs` (fake `current_user` +
 * NextAuth session); signed-out routes get `setupSignedOutStubs`
 * (deliberately NO fake user / session) so a regression that only
 * crashes when `useSession()` returns `null` still blocks the PR.
 *
 * We assert that:
 *   1. The page reaches a stable rendered state (a page-specific
 *      text marker — and, for the authed routes, also the shared
 *      TopNavbar logo).
 *   2. No uncaught JS errors fired during mount.
 *   3. No console.error messages were logged.
 *   4. No app-served endpoint returned a 5xx.
 *
 * If any of those fail, the PR is blocked the same way the
 * messenger click-trap regressions are.
 */
const { test, expect } = require('@playwright/test');
const {
  setupSmokeStubs,
  setupSignedOutStubs,
  attachConsoleErrorWatcher,
  expectNoConsoleErrors,
} = require('./helpers/clickTrap');

// Patterns we deliberately ignore. NextAuth's /api/auth/session can
// briefly 401 before the routed stub takes over on the very first
// frame; that's harmless noise. The "ResizeObserver loop limit
// exceeded" warning is a known browser-engine quirk that surfaces
// across React + Tailwind apps and isn't an app-level regression.
const IGNORED_CONSOLE = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed',
  // Next.js dev-mode hot-reload diagnostics, only present if someone
  // runs the suite against `next dev` locally.
  '[HMR]',
];

const SMOKE_PAGES = [
  {
    path: '/',
    name: 'home',
    // The dashboard always renders the sport selector with at least the
    // "Live" tab; that's a stable, non-data-dependent marker that the
    // page got past its initial mount.
    marker: { role: 'button', name: /^Live(\s|$)/ },
  },
  {
    path: '/battle',
    name: 'battle',
    // The battle page's right-hand "1v1 Battle" CTA card renders
    // unconditionally for authed users without an active matchup.
    marker: { text: '1v1 Battle' },
  },
  {
    path: '/withdrawal',
    name: 'balance (withdrawal)',
    // The balance / withdrawal page renders an h1 "Withdraw Funds"
    // immediately after `loading` flips false, which our session +
    // payment-methods + withdrawals stubs make happen on mount.
    marker: { role: 'heading', name: 'Withdraw Funds' },
  },
];

for (const target of SMOKE_PAGES) {
  test(`smoke: ${target.name} (${target.path}) renders cleanly`, async ({ page }) => {
    await setupSmokeStubs(page);
    const watcher = attachConsoleErrorWatcher(page, { ignorePatterns: IGNORED_CONSOLE });

    const response = await page.goto(target.path, { waitUntil: 'domcontentloaded' });
    expect(response, `navigation to ${target.path} should produce a response`).not.toBeNull();
    expect(
      response.status(),
      `${target.path} should not return a 4xx/5xx HTTP status`,
    ).toBeLessThan(400);

    // Every page mounts the shared TopNavbar with the Piks logo. If
    // that's missing we know the React tree never rendered.
    await expect(page.getByAltText('Piks').first()).toBeVisible();

    // Page-specific marker — the equivalent of the page's "main
    // heading" for smoke purposes.
    if (target.marker.role) {
      await expect(
        page.getByRole(target.marker.role, { name: target.marker.name }).first(),
      ).toBeVisible();
    } else {
      await expect(page.getByText(target.marker.text).first()).toBeVisible();
    }

    // Give post-mount effects (GamesContext fetch, MatchupContext
    // fetch, withdrawal data fetch) a beat to settle so any deferred
    // `console.error` from a failed handler still gets captured before
    // we assert.
    await page.waitForLoadState('networkidle').catch(() => {});

    expectNoConsoleErrors(watcher);
  });
}

// ---------------------------------------------------------------------------
// Signed-out marketing pages.
//
// First-time visitors hit these BEFORE they have a session, so we
// have to mount them with no fake `current_user` and no fake
// NextAuth session. A regression that crashes only when
// `useSession()` returns `null` (or only when `localStorage`'s
// `current_user` slot is empty) would otherwise slip through the
// signed-in suite above. Same no-error contract — uncaught JS,
// `console.error`, and 5xx responses all fail the PR.
// ---------------------------------------------------------------------------
const SIGNED_OUT_PAGES = [
  {
    path: '/login',
    name: 'login (signed-out redirect to /auth)',
    // /login is a thin client-side redirect shim: it mounts a
    // "Redirecting to Login..." h1 and immediately calls
    // `router.push('/auth')`. After the push lands, the auth page
    // doesn't expose a stable h1 in its default (non-"challenge")
    // step — the form is identified by its "Sign In" / "Sign Up"
    // toggle buttons. We use the "Sign In" toggle as the
    // page-specific render marker because it's rendered
    // unconditionally on every mount of the form view and is the
    // natural "the sign-in UI is up" signal.
    marker: { role: 'button', name: 'Sign In', exact: true },
  },
  {
    path: '/pricing',
    name: 'pricing (signed-out)',
    // The pricing page is a small standalone shell with a single h1.
    marker: { role: 'heading', name: 'Get Your Funded Pass' },
  },
];

for (const target of SIGNED_OUT_PAGES) {
  test(`smoke: ${target.name} (${target.path}) renders cleanly`, async ({ page }) => {
    await setupSignedOutStubs(page);
    const watcher = attachConsoleErrorWatcher(page, { ignorePatterns: IGNORED_CONSOLE });

    const response = await page.goto(target.path, { waitUntil: 'domcontentloaded' });
    expect(response, `navigation to ${target.path} should produce a response`).not.toBeNull();
    expect(
      response.status(),
      `${target.path} should not return a 4xx/5xx HTTP status`,
    ).toBeLessThan(400);

    // Page-specific main-heading marker. Deliberately no Piks-logo
    // assertion here — `/login` and `/pricing` don't mount TopNavbar
    // at all, so the heading is the right "did the React tree
    // actually render" signal for the signed-out shell.
    const markerOpts = { name: target.marker.name };
    if (target.marker.exact) markerOpts.exact = true;
    await expect(
      page.getByRole(target.marker.role, markerOpts).first(),
    ).toBeVisible();

    // Let mount-time effects (auth-redirect from /login,
    // contexts that race the auth gate, …) settle so any deferred
    // `console.error` is captured before we assert.
    await page.waitForLoadState('networkidle').catch(() => {});

    expectNoConsoleErrors(watcher);
  });
}

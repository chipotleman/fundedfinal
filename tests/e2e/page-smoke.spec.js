/**
 * Build-time smoke test for the highest-traffic authenticated routes.
 *
 * The messenger / notifications click-trap suite already runs against
 * the same prebuilt `.next/` artifact in CI, so adding a couple more
 * page mounts here costs almost nothing in wall-clock time but gives
 * us a hard fail signal whenever a build-time regression silently
 * breaks `/`, `/battle`, or the balance / withdrawal flow.
 *
 * Each path is mounted in a desktop and a mobile Playwright project,
 * with API GETs stubbed via `setupSmokeStubs`. We assert that:
 *   1. The page reaches a stable rendered state (TopNavbar logo + a
 *      page-specific text marker).
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

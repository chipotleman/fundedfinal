const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.E2E_PORT || 3100);
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
// Opt into running the suite against a real production build
// (`next start`) instead of the dev server. CI uses this so the
// smoke test reflects what actually ships, and so that warm runs
// don't pay the per-request `next dev` compile cost. Locally,
// `npm run test:e2e:ci` flips this on after running `next build`.
const USE_PROD_BUILD = process.env.E2E_PROD_BUILD === '1'
  || process.env.E2E_PROD_BUILD === 'true';

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Note: the messenger-click-trap (desktop + mobile) and page-smoke
    // suites are intentionally NOT registered here. Task #524 stripped
    // the click-trap defense layer (orphan-overlay watchdog, scroll-lock
    // recovery watchdog, custom touch interceptors, global click
    // delegate) that those specs were written to validate, so they no
    // longer reflect the app's behavior. The spec files remain on disk
    // (tests/e2e/messenger-click-trap*.spec.js, tests/e2e/page-smoke.spec.js)
    // so they can be re-enabled later by re-adding their project entries.
    {
      // Voice-note pipeline runs on a single desktop browser — the
      // branching being tested is in MessagesPanel.js (mime selection,
      // Content-Type matching, POST shape) and is browser-agnostic once
      // MediaRecorder + getUserMedia are stubbed.
      name: 'chromium-voice-note',
      testMatch: /messenger-voice-note\.spec\.js$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      // Regression suite for task #393 — proves a signed-in regular
      // user can't reset their own bankroll / pnl / win rate / etc by
      // PATCHing /api/profiles/{me}. Carries a primary behavioural
      // suite (mints a real NextAuth JWT cookie, PATCHes the live
      // endpoint, then reads the row back from Postgres directly to
      // assert each financial field is unchanged) plus supplemental
      // source-level guardrails on the owner-vs-admin allow-list
      // split in pages/api/profiles/[id].ts. The behavioural tests
      // skip when DATABASE_URL or NEXTAUTH_SECRET is missing
      // (e.g. the messenger-click-trap CI matrix), so the source-
      // level guardrails remain useful coverage there.
      name: 'profile-bankroll-owner-lockout',
      testMatch: /profile-bankroll-owner-lockout\.spec\.js$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // `next start` boots the prebuilt `.next/` output and serves it
        // immediately — no per-request compile pass like `next dev`.
        // It also requires `npm run build` to have already produced a
        // matching `.next/` directory; CI does that in a separate
        // build job, and `npm run test:e2e:ci` does it locally.
        command: USE_PROD_BUILD
          ? `npm run start -- -p ${PORT}`
          : `npm run dev -- -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        // `next start` is essentially instant once the build is in
        // place; only the dev server needs the long warm-up window.
        timeout: USE_PROD_BUILD ? 60_000 : 180_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});

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
    {
      name: 'webkit-desktop',
      testMatch: /messenger-click-trap\.spec\.js$/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'chromium-desktop',
      testMatch: /messenger-click-trap\.spec\.js$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'firefox-desktop',
      testMatch: /messenger-click-trap\.spec\.js$/,
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } },
    },
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
      name: 'webkit-mobile',
      testMatch: /messenger-click-trap\.mobile\.spec\.js$/,
      use: { ...devices['iPhone 14 Pro'] },
    },
    {
      name: 'chromium-mobile',
      testMatch: /messenger-click-trap\.mobile\.spec\.js$/,
      use: { ...devices['Pixel 7'] },
    },
    {
      // Playwright's Firefox does not support `isMobile` device emulation,
      // so we run the mobile spec at a phone-sized viewport instead.
      name: 'firefox-mobile',
      testMatch: /messenger-click-trap\.mobile\.spec\.js$/,
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 390, height: 844 },
      },
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

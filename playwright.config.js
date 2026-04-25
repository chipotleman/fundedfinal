const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.E2E_PORT || 3100);
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;

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
        command: `npm run dev -- -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});

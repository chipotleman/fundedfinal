/**
 * Smoke test for the "messenger / notifications click-trap" regression
 * (desktop / WebKit @ >= 1024px wide).
 *
 * Background: opening and dismissing the bell dropdown or the messages
 * dropdown on /messenger and /notifications has twice regressed into a
 * state where subsequent taps on the top-bar icons stop registering, or a
 * leftover scroll-lock leaves the page unscrollable.
 *
 * This test runs the desktop portion of the manual checklist in
 * `docs/messenger-click-trap-checklist.md`. The mobile-width portion lives
 * in `messenger-click-trap.mobile.spec.js`. Real iOS Safari still needs
 * to be tested manually, but this catches the regressions seen so far.
 */
const { test, expect } = require('@playwright/test');
const { setupStubs, getBodyLockStyles, expectBodyUnlocked, TARGET_PAGES } = require('./helpers/clickTrap');

for (const path of TARGET_PAGES) {
  test(`desktop: top-bar icons keep responding on ${path}`, async ({ page }) => {
    await setupStubs(page);
    await page.goto(path);

    const bell = page.getByRole('button', { name: 'Notifications' });
    const messages = page.getByRole('button', { name: 'Messages' });
    const notifDialog = page.getByRole('dialog', { name: 'Notifications' });
    const msgDialog = page.getByRole('dialog', { name: 'Messages' });

    await expect(bell).toBeVisible();
    await expect(messages).toBeVisible();

    // 1. Open bell, dismiss by clicking outside (in the page body).
    await bell.click();
    await expect(notifDialog).toBeVisible();
    await page.mouse.click(10, 400);
    await expect(notifDialog).toHaveCount(0);

    // 2. The next icon tap (messages) must register on the FIRST try.
    await messages.click();
    await expect(msgDialog).toBeVisible();

    // 3. Dismiss the messages dropdown by tapping its own icon again.
    await messages.click();
    await expect(msgDialog).toHaveCount(0);

    // 4. Reopen the bell on the first try after the previous dismiss.
    await bell.click();
    await expect(notifDialog).toBeVisible();
    await bell.click();
    await expect(notifDialog).toHaveCount(0);

    // 5. After all dropdowns are closed, the body must not be scroll-locked.
    await expectBodyUnlocked(page);

    // 6. Escape must also dismiss the dropdown cleanly.
    await bell.click();
    await expect(notifDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(notifDialog).toHaveCount(0);
    await expectBodyUnlocked(page);

    // 7. Sanity: getBodyLockStyles directly returns clean styles.
    expect(await getBodyLockStyles(page)).toEqual({
      position: '', overflow: '', top: '', left: '', right: '', width: '', height: '',
    });
  });
}

/**
 * Smoke test for the "messenger / notifications click-trap" regression
 * (mobile-width WebKit, ~iPhone viewport).
 *
 * The desktop bell / messages dropdowns are hidden below the lg breakpoint,
 * so the mobile-width regression surface is the hamburger drawer
 * (`MobileNavMenu` + `useModalScrollLock`). This test opens that drawer,
 * dismisses it via the X button and via the backdrop, and asserts that
 * the body has no leftover scroll-lock styles and that the hamburger
 * still responds on the first tap afterwards.
 */
const { test, expect } = require('@playwright/test');
const { setupStubs, getBodyLockStyles, expectBodyUnlocked, TARGET_PAGES } = require('./helpers/clickTrap');

for (const path of TARGET_PAGES) {
  test(`mobile: hamburger drawer releases the body on ${path}`, async ({ page }) => {
    await setupStubs(page);
    await page.goto(path);

    const hamburger = page.getByRole('button', { name: /Open menu/i });
    await expect(hamburger).toBeVisible();

    // Open the drawer.
    await hamburger.click();
    const drawer = page.locator('.mobile-menu-drawer');
    await expect(drawer).toBeVisible();

    // While open, useModalScrollLock should have locked the body.
    const lockedStyles = await getBodyLockStyles(page);
    expect(
      lockedStyles.position === 'fixed' || lockedStyles.overflow === 'hidden',
      'body should be scroll-locked while the mobile drawer is open',
    ).toBeTruthy();

    const closeBtn = page.getByRole('button', { name: 'Close menu' });

    // Dismiss by tapping the in-drawer close (X) button.
    await closeBtn.click();
    await expect(drawer).toHaveCount(0);
    await expectBodyUnlocked(page);

    // Reopen and dismiss by tapping the backdrop (outside the right-side
    // 256px drawer).
    await hamburger.click();
    await expect(drawer).toBeVisible();
    const viewport = page.viewportSize();
    await page.mouse.click(10, Math.floor((viewport?.height || 600) / 2));
    await expect(drawer).toHaveCount(0);
    await expectBodyUnlocked(page);

    // The hamburger must still register on the first tap after dismissal.
    await hamburger.click();
    await expect(drawer).toBeVisible();
    await closeBtn.click();
    await expect(drawer).toHaveCount(0);
    await expectBodyUnlocked(page);
  });
}

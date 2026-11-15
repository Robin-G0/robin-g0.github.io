import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**', route => route.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs', route => route.fulfill({
        path: fileURLToPath(new URL('./fixtures/camera-session.mjs', import.meta.url)), contentType: 'text/javascript'
    }));
    await page.goto('/?theme=construction#arcade');
    await page.locator('[data-game=construction-popups]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera', 'live');
    await page.evaluate(() => window.motionTest.observe());
    await page.clock.runFor(32);
});

test('trigger guides mirror the selected game profile, show native activation and never latch wrist acknowledgement', async ({ page }) => {
    await page.locator('#arcade-begin').click();
    const zones = page.locator('#arcade-trigger-zones');
    await expect(zones).toBeVisible();
    await expect(zones.locator('[data-trigger]')).toHaveCount(6);
    const corner = await zones.locator('[data-trigger=left_left] polygon').evaluate(p => p.getAttribute('points').split(' ')[0].split(',').map(Number));
    // Pop-up Panic's side targets now start two cells above the original band.
    expect(corner[0]).toBeCloseTo(350, 2); expect(corner[1]).toBeCloseTo(230, 2);
    const size = await page.locator('[data-wrist=right].camera-wrist').boundingBox();
    await page.evaluate(() => window.motionTest.raw('right_up'));
    await page.clock.runFor(32);
    await expect(page.locator('#arcade-score')).toHaveText('10');
    await expect(zones.locator('[data-trigger=right_up]')).toHaveAttribute('data-active', 'true');
    await expect(page.locator('[data-wrist-controls=right]')).toHaveAttribute('data-pulse', 'true');
    await expect(page.locator('[data-wrist-controls=left]')).toHaveAttribute('data-pulse', 'false');
    const labeled = await page.locator('[data-wrist=right].camera-wrist').boundingBox();
    expect(labeled.width).toBe(size.width); expect(labeled.height).toBe(size.height);
    await page.clock.runFor(400);
    await expect(page.locator('[data-wrist-controls=right]')).toHaveAttribute('data-pulse', 'false');
    await page.locator('#arcade-close').click();
    await page.locator('[data-game=construction-popups]').click();
    await expect(zones.locator('[data-trigger]')).toHaveCount(6);
});

test('marker motion eases observations on display frames and clears immediately on tracking loss', async ({ page }) => {
    const marker = page.locator('[data-wrist=left].camera-wrist');
    const x = () => marker.evaluate(m => parseFloat(m.style.left));
    expect(await x()).toBeCloseTo(30, 2);
    await page.evaluate(() => window.motionTest.move('left', .8, .65));
    await page.clock.runFor(16);
    expect(await x()).toBeGreaterThan(20); expect(await x()).toBeLessThan(30);
    await page.clock.runFor(220);
    expect(await x()).toBeGreaterThan(19.9); expect(await x()).toBeLessThan(22);
    await page.evaluate(() => window.motionTest.observe(false));
    await expect(marker).not.toBeVisible();
    await expect(page.locator('#arcade-trigger-zones')).not.toBeVisible();
});

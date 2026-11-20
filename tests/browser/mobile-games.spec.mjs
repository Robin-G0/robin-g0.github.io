import { test, expect } from '@playwright/test';

// Small screens get the full-screen player: the board fills what is left, touch
// controls stay on screen (below the board, or beside it in landscape), nothing
// scrolls, and the camera strip opens a setup sheet over the board.
for (const engine of ['maze', 'popups', 'juggle']) {
    test(`${engine}: phone touch targets, board and camera stay usable through rotation`, async ({ page }) => {
        test.setTimeout(90000);
        await page.clock.install();
        await page.route('https://raw.githubusercontent.com/**', r => r.abort());
        await page.route('**/vendor/motion-input-grid/src/index.mjs', r => r.abort());
        await page.setViewportSize({ width: 320, height: 640 });
        await page.goto('/?theme=construction#arcade');
        await page.locator(`[data-game=construction-${engine}]`).click();
        await page.locator('#arcade-no-camera').click();
        for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 740, height: 360 }]) {
            await page.setViewportSize(viewport); await page.clock.runFor(64);
            const landscape = viewport.width > viewport.height;
            const dialog = page.locator('#arcade-player');
            expect(await dialog.evaluate(d => d.scrollWidth <= d.clientWidth + 1 && d.scrollHeight <= d.clientHeight + 1)).toBe(true);
            const field = await page.locator('.arcade-stage').boundingBox();
            expect(field.height).toBeGreaterThan(landscape ? 180 : 300);
            const buttons = page.locator('[data-arcade-input]');
            await expect(buttons).toHaveCount(engine === 'popups' ? 6 : 2);
            for (const button of await buttons.all()) {
                const box = await button.boundingBox();
                expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
                expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
                expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
                if (landscape) expect(box.x + box.width <= field.x + 1 || box.x >= field.x + field.width - 1).toBe(true);
                else expect(box.y).toBeGreaterThanOrEqual(field.y + field.height);
                await button.click();
                await expect(dialog).toHaveAttribute('data-phase', 'playing');
            }
            const strip = await page.locator('#arcade-camera-dock').boundingBox();
            expect(strip.y + strip.height).toBeLessThanOrEqual(viewport.height + 1);
            await page.locator('#arcade-camera-more').click();
            const preview = await page.locator('.camera-view').boundingBox();
            expect(preview.width).toBeGreaterThan(150);
            expect(preview.y).toBeGreaterThanOrEqual(0);
            await page.locator('#arcade-camera-more').click();
            await expect(dialog).not.toHaveAttribute('data-camera-sheet', '');
        }
    });
}

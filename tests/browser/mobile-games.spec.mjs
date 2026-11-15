import { test, expect } from '@playwright/test';

for (const engine of ['maze', 'popups']) {
    test(`${engine}: phone touch targets, board and camera stay usable through rotation`, async ({ page }) => {
        await page.clock.install();
        await page.route('https://raw.githubusercontent.com/**', r => r.abort());
        await page.route('**/vendor/motion-input-grid/src/index.mjs', r => r.abort());
        await page.setViewportSize({ width: 320, height: 640 });
        await page.goto('/?theme=construction#arcade');
        await page.locator(`[data-game=construction-${engine}]`).click();
        await page.locator('#arcade-no-camera').click();
        for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 740, height: 360 }]) {
            await page.setViewportSize(viewport); await page.clock.runFor(64);
            const dialog = page.locator('#arcade-player');
            expect(await dialog.evaluate(d => d.scrollWidth <= d.clientWidth + 1)).toBe(true);
            const stage = await page.locator('.arcade-stage').boundingBox();
            if (viewport.width < 640) expect(stage.height).toBeLessThanOrEqual(500);
            const buttons = page.locator('[data-arcade-input]');
            await expect(buttons).toHaveCount(engine === 'popups' ? 6 : 2);
            for (const button of await buttons.all()) {
                const box = await button.boundingBox();
                expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
                await button.click();
                await expect(dialog).toHaveAttribute('data-phase', 'playing');
            }
            const camera = await page.locator('#arcade-camera-dock').boundingBox();
            const controls = await page.locator('.arcade-inputs').boundingBox();
            const field = await page.locator('.arcade-stage').boundingBox();
            expect(controls.y).toBeGreaterThanOrEqual(field.y + field.height);
            expect(camera.y).toBeGreaterThanOrEqual(controls.y + controls.height);
            if (viewport.width < 640) {
                const preview = await page.locator('.camera-view').boundingBox();
                expect(preview.width).toBeGreaterThan(240);
            }
        }
    });
}

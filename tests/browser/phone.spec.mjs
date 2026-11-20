import { test, expect, devices } from '@playwright/test';

// Phones get a full-screen player: no page scroll, every control on screen,
// camera setup as a sheet over the board, both orientations.
const cases = [['portrait', devices['iPhone 13']], ['landscape', devices['iPhone 13 landscape']]];
for (const [orientation, device] of cases) {
    test(`the ${orientation} phone player fits the screen with controls in reach`, async ({ browser, baseURL }) => {
        test.setTimeout(120000);
        const { defaultBrowserType, ...options } = device;
        const context = await browser.newContext({ ...options, storageState: { cookies: [], origins: [{ origin: baseURL,
            localStorage: [{ name: 'robin-g0-precision', value: JSON.stringify({ version: 1, preset: 'low' }) }] }] } });
        const page = await context.newPage();
        await page.route('https://raw.githubusercontent.com/**', route => route.abort());
        await page.route('**/vendor/motion-input-grid/src/index.mjs', route => route.abort());
        for (const id of ['construction-popups', 'construction-juggle']) {
            await page.goto(`/?theme=construction&g=${id}#arcade`);
            await page.locator(`.arcade-play[data-game=${id}]`).click();
            const player = page.locator('#arcade-player');
            await expect(player).toBeVisible();
            const fit = async () => page.evaluate(() => {
                const dialog = document.querySelector('#arcade-player'), out = [];
                for (const element of dialog.querySelectorAll('.arcade-room-header, .arcade-hud, .arcade-stage, .arcade-inputs .arcade-action, .arcade-toolbar, #arcade-camera-dock')) {
                    if (!element.checkVisibility()) continue;
                    const box = element.getBoundingClientRect();
                    if (box.top < -1 || box.bottom > innerHeight + 1 || box.left < -1 || box.right > innerWidth + 1) out.push(element.className || element.id);
                }
                return { scroll: dialog.scrollHeight - dialog.clientHeight, out, stage: dialog.querySelector('.arcade-stage').getBoundingClientRect().height };
            });
            for (let i = 0; i < 4 && await page.locator('#arcade-walkthrough').isVisible(); i++) {
                await expect(page.locator('[data-guide-next]')).toBeInViewport();
                await page.locator('[data-guide-next]').click();
            }
            let result = await fit();
            expect(result.scroll).toBeLessThanOrEqual(0);
            expect(result.out).toEqual([]);
            expect(result.stage).toBeGreaterThan(orientation === 'portrait' ? 330 : 200);
            await page.locator('#arcade-camera-more').click();
            await expect(player).toHaveAttribute('data-camera-sheet', '');
            await expect(page.locator('#arcade-camera-more')).toHaveText('Done');
            await expect(page.locator('.camera-phone-tip')).toBeVisible();
            await page.locator('#arcade-camera-more').click();
            await expect(player).not.toHaveAttribute('data-camera-sheet', '');
            await page.locator('#arcade-begin').click();
            await expect(player).toHaveAttribute('data-phase', 'playing');
            result = await fit();
            expect(result.out).toEqual([]);
            await page.locator('#arcade-close').click();
        }
        await context.close();
    });
}

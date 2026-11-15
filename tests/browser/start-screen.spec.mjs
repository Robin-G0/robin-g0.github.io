import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'
    }));
    await page.goto('/?theme=construction#arcade');
});

test('either visible wrist starts the shared greeting countdown without a game gesture',async({page})=>{
    for(const [engine,missing] of [['popups',16],['maze',15]]){
        await page.locator(`[data-game=construction-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await expect(page.locator('#arcade-controls-status')).toHaveText('Say hi (with hand) to start');
        await expect(page.locator('#arcade-tutorial .gesture-lesson')).not.toBeVisible();
        await expect(page.locator('#arcade-lesson-goal')).not.toBeVisible();
        expect(await page.locator('#arcade-controls-status').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(30);
        await page.evaluate(missing=>window.motionTest.observe(true,missing),missing);
        await page.clock.runFor(3300);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        await expect(page.locator('#arcade-score')).toHaveText('0');
        await page.locator('#arcade-close').click();
    }
});

test('countdowns cancel on hand loss and Controls never auto-dismisses while being read',async({page})=>{
    await page.locator('[data-game=construction-popups]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    await page.evaluate(()=>window.motionTest.observe());await page.clock.runFor(1000);
    await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(900);
    await expect(page.locator('#arcade-controls-status')).toHaveText('Say hi (with hand) to start');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','tutorial');
    await page.locator('#arcade-help').click();
    await page.evaluate(()=>window.motionTest.observe());await page.clock.runFor(3300);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','tutorial');
    await expect(page.locator('#arcade-tutorial .gesture-lesson')).toBeVisible();
    await page.locator('#arcade-begin').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
});

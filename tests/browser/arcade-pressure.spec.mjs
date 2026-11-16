import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'
    }));
});

test('Aero keeps playing and its survival clock advances when both wrists disappear',async({page})=>{
    await page.goto('/?theme=aero#arcade');
    await page.locator('[data-game=aero-school]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    await page.evaluate(()=>window.motionTest.observe());await page.locator('#arcade-begin').click();
    await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(1600);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-tracking','missing');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
    expect(parseInt(await page.locator('#arcade-time').textContent())).toBeGreaterThanOrEqual(1);
    await expect(page.locator('#arcade-paused')).not.toBeVisible();
});

test('puzzle score clocks keep running on missing hands and cost a life on expiry',async({page})=>{
    await page.goto('/?theme=aqua#arcade');
    await page.locator('[data-game=aqua-gel]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    await page.evaluate(()=>window.motionTest.observe());await page.locator('#arcade-begin').click();
    await expect(page.locator('.arcade-hud > div:nth-child(2) dt')).toHaveText('Next score');
    await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(5000);
    const before=parseInt(await page.locator('#arcade-time').textContent());
    await page.locator('[data-arcade-input=left]').click();await page.clock.runFor(1000);
    expect(parseInt(await page.locator('#arcade-time').textContent())).toBeLessThan(before);
    await page.clock.runFor(18000);
    await expect(page.locator('#arcade-lives')).toHaveText('2');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
    await page.locator('#arcade-pause').click();const paused=await page.locator('#arcade-time').textContent();
    await page.clock.runFor(2000);await expect(page.locator('#arcade-time')).toHaveText(paused);
});

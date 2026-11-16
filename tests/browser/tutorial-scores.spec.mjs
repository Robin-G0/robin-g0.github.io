import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test.use({storageState:{cookies:[],origins:[]}});
test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',route=>route.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'
    }));
    await page.goto('/?theme=construction#arcade');
});
async function ready(page){for(let i=0;i<3;i++)await page.locator('[data-guide-next]').click();}

test('first-visit cards teach all three construction games without gestures starting play under them',async({page})=>{
    for(const engine of ['popups','maze','juggle']){
        await page.locator(`[data-game=construction-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await expect(page.locator('#arcade-walkthrough')).toBeVisible();
        await expect(page.locator('#arcade-best')).toBeVisible();
        await expect(page.locator('[data-guide-skip]')).not.toBeVisible();
        await page.evaluate(()=>window.motionTest.observe());await page.clock.runFor(3300);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','tutorial');
        await expect(page.locator('#arcade-countdown')).toBeEmpty();
        for(let step=1;step<=3;step++){
            await expect(page.locator('#arcade-walkthrough')).toHaveAttribute('data-step',String(step));
            await expect(page.locator('.guide-art')).toBeVisible();
            await page.locator('[data-guide-next]').click();
        }
        await expect(page.locator('#arcade-walkthrough')).not.toBeVisible();
        await page.clock.runFor(64);
        await expect(page.locator('#arcade-controls-status')).not.toContainText('(with hand)');
        await page.locator('#arcade-close').click();
    }
});

test('scores persist with a five-letter name, enable quick start and tutorials can be replayed without resetting play',async({page})=>{
    await page.locator('[data-game=construction-juggle]').click();await ready(page);
    await page.locator('#arcade-no-camera').click();
    await page.clock.runFor(1600);await page.keyboard.press('ArrowRight');
    await page.clock.runFor(16000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    const score=await page.locator('#arcade-final-score').textContent();expect(Number(score)).toBeGreaterThan(0);
    await page.locator('#arcade-name').fill('ALICE');await page.locator('#arcade-save-score').click();
    await expect(page.locator('#arcade-scoreboard b')).toHaveText('ALICE');
    await page.reload();await page.locator('[data-game=construction-juggle]').click();
    await expect(page.locator('#arcade-walkthrough')).not.toBeVisible();
    await expect(page.locator('#arcade-best')).toHaveText(score.padStart(5,'0'));
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(100);
    await page.locator('#arcade-guide').click();
    await expect(page.locator('[data-guide-skip]')).toBeVisible();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','paused');
    const time=await page.locator('#arcade-time').textContent();
    await page.clock.runFor(3000);await expect(page.locator('#arcade-time')).toHaveText(time);
    await page.locator('[data-guide-skip]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
});

test('tutorial cards fit a small phone and release GIF images on close',async({page})=>{
    await page.setViewportSize({width:320,height:640});
    await page.locator('[data-game=construction-juggle]').click();
    for(let i=0;i<3;i++){
        const box=await page.locator('#arcade-walkthrough').boundingBox();
        const next=await page.locator('[data-guide-next]').boundingBox();
        expect(next.width).toBeGreaterThanOrEqual(44);expect(next.height).toBeGreaterThanOrEqual(44);
        expect(next.y+next.height).toBeLessThanOrEqual(box.y+box.height+1);
        expect(await page.locator('#arcade-walkthrough').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
        await page.locator('[data-guide-next]').click();
    }
    await expect(page.locator('#arcade-walkthrough image')).toHaveCount(0);
});

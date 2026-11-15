import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'
    }));
    await page.goto('/?theme=construction#arcade');
    await page.locator('[data-game=construction-popups]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    await page.evaluate(()=>window.motionTest.observe());
    await page.locator('#arcade-begin').click();
});
const batch=(page,actions)=>page.evaluate(actions=>window.motionTest.batch(actions),actions);

test('different simultaneous wrist directions clear both stacks and keep both result animations',async({page})=>{
    await page.locator('#arcade-canvas').evaluate(canvas=>{
        const context=canvas.getContext('2d'),text=context.fillText.bind(context);window.resultLabels=[];
        context.fillText=(value,...args)=>{window.resultLabels.push(value);return text(value,...args);};
    });
    await batch(page,['left_left','right_up']);await page.clock.runFor(32);
    await expect(page.locator('#arcade-score')).toHaveText('23');
    for(const wrist of ['left','right'])await expect(page.locator(`[data-wrist-controls=${wrist}]`)).toHaveAttribute('data-pulse','true');
    const labels=await page.evaluate(()=>window.resultLabels);
    expect(labels).toContain('← 1×');expect(labels).toContain('↑ 1×');
    await batch(page,['left_up','right_right']);
    await expect(page.locator('#arcade-score')).toHaveText('23');
    await page.clock.runFor(200);
    // Waiting alone never replays a rejected command.
    await expect(page.locator('#arcade-score')).toHaveText('23');
    await batch(page,['left_up','right_right']);
    await expect(page.locator('#arcade-score')).toHaveText('56');
});

test('one cooling wrist never blocks the other and direction changes share a wrist cooldown',async({page})=>{
    await batch(page,['left_left']);await page.clock.runFor(100);
    await batch(page,['left_up','right_up']);
    await expect(page.locator('#arcade-score')).toHaveText('23');
    await page.clock.runFor(110);
    await batch(page,['left_up','right_right']);
    await expect(page.locator('#arcade-score')).toHaveText('38');
    await page.clock.runFor(100);await batch(page,['right_right']);
    await expect(page.locator('#arcade-score')).toHaveText('56');
});

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
    await expect(page.locator('#arcade-score')).toHaveText('56');
    await page.clock.runFor(200);
    // Holding or waiting alone never delivers additional commands.
    await expect(page.locator('#arcade-score')).toHaveText('56');
    await batch(page,['left_up','right_right']);
    await expect(page.locator('#arcade-score')).toHaveText('56');
});

test('direction changes are immediate while repeating that same wrist/direction remains throttled',async({page})=>{
    await batch(page,['left_left']);await page.clock.runFor(100);
    await batch(page,['left_up']);
    await expect(page.locator('#arcade-score')).toHaveText('23');
    await expect(page.locator('#arcade-recognition')).toHaveText('L \u2191');
    await batch(page,['left_left']);
    await expect(page.locator('#arcade-recognition')).toHaveText('L \u2191');
    await batch(page,['right_left']);await batch(page,['right_up']);
    await expect(page.locator('#arcade-score')).toHaveText('56');
    await expect(page.locator('#arcade-recognition')).toHaveText('R \u2191');
    await page.clock.runFor(101);await batch(page,['left_left']);
    await expect(page.locator('#arcade-recognition')).toHaveText('L \u2190');
    await batch(page,['right_up']);
    await expect(page.locator('#arcade-recognition')).toHaveText('L \u2190');
});

test('survival time counts beyond sixty seconds and only overflowing stacks finish the game',async({page})=>{
    test.setTimeout(90000); // Exercise 85+ seconds of camera/display callbacks on the virtual clock.
    await expect(page.locator('.arcade-hud > div:nth-child(2) dt')).toHaveText('Survived');
    await expect(page.locator('#arcade-time')).toHaveText('0s');
    await page.evaluate(()=>{
        let move=0;
        window.autoClear=setInterval(()=>{
            const direction=['left','up','right'][move++%3];
            window.motionTest.batch([`left_${direction}`,`right_${direction}`]);
        },600);
    });
    await page.clock.runFor(65000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
    expect(parseInt(await page.locator('#arcade-time').textContent())).toBeGreaterThanOrEqual(64);
    await page.locator('#arcade-pause').click();
    const survived=await page.locator('#arcade-time').textContent();
    await page.clock.runFor(2000);await expect(page.locator('#arcade-time')).toHaveText(survived);
    await page.evaluate(()=>clearInterval(window.autoClear));
    await page.locator('#arcade-resume').click();await page.clock.runFor(20000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await page.locator('#arcade-again').click();await expect(page.locator('#arcade-time')).toHaveText('0s');
});

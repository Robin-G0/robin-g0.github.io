import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto('/?theme=desktop95#arcade');
});

test('desktop95 games teach their real rules and use two native raises with local feedback',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const engine of ['sort','stack','ski']){
        await page.locator(`[data-game=desktop95-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await page.locator('#arcade-guide').click();
        for(let step=1;step<=3;step++){
            await expect(page.locator('#arcade-walkthrough')).toHaveAttribute('data-step',String(step));
            await expect(page.locator('.desktop95-diagram')).toBeVisible();
            await page.locator('[data-guide-next]').click();
        }
        await page.evaluate(()=>window.motionTest.observe());
        await page.locator('#arcade-begin').click();
        expect(await page.evaluate(()=>window.motionTest.profile.inputs.map(i=>i.action))).toEqual(['left_up','right_up']);
        await page.evaluate(()=>window.motionTest.raw('left_up'));await page.clock.runFor(64);
        await expect(page.locator('[data-arcade-input=left]')).toHaveAttribute('data-pulse','true');
        await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
        await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(1200);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        await page.screenshot({path:`../arcade-review/desktop95-${engine}-desktop.png`});
        await page.locator('#arcade-pause').click();const time=await page.locator('#arcade-time').textContent();
        await page.clock.runFor(1500);await expect(page.locator('#arcade-time')).toHaveText(time);
        await page.locator('#arcade-close').click();
    }
    expect(errors).toEqual([]);
});

test('desktop95 boards and cards fit phones and landscape without stretching game rules',async({page})=>{
    for(const engine of ['sort','stack','ski']){
        await page.setViewportSize({width:320,height:640});
        await page.locator(`[data-game=desktop95-${engine}]`).click();
        await page.locator('#arcade-guide').click();
        await page.screenshot({path:`../arcade-review/desktop95-${engine}-tutorial-mobile.png`});
        await page.locator('[data-guide-skip]').click();await page.locator('#arcade-no-camera').click();
        for(const size of [{width:320,height:640},{width:390,height:844},{width:740,height:360}]){
            await page.setViewportSize(size);await page.clock.runFor(64);
            expect(await page.locator('#arcade-player').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
            if(size.width<400)expect(await page.locator('#arcade-canvas').evaluate(c=>c.height)).toBeGreaterThan(840);
        }
        await page.setViewportSize({width:390,height:844});await page.clock.runFor(64);
        await page.screenshot({path:`../arcade-review/desktop95-${engine}-mobile.png`});
        await page.locator('#arcade-close').click();
    }
});

test('Folder Sort finishes into versioned scores, sharing and replay',async({page})=>{
    await page.locator('[data-game=desktop95-sort]').click();
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(22000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await page.locator('#arcade-name').fill('DESK5');await page.locator('#arcade-save-score').click();
    await page.locator('#arcade-challenge-friend').click();
    const link=await page.locator('#arcade-challenge-link').inputValue();
    const target=JSON.parse(new URLSearchParams(new URL(link).hash.split('?')[1]).get('challenge'));
    expect(target.game).toBe('desktop95-sort');expect(target.rules).toBe(2);
    await page.locator('#arcade-again').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
});

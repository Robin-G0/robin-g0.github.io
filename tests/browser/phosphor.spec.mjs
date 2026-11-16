import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',route=>route.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto('/?theme=phosphor#arcade');
});

test('each Phosphor game has three specific cards, native two-raise controls and local feedback',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const engine of ['invaders','lander','snake']){
        await page.locator(`[data-game=phosphor-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await page.evaluate(()=>window.motionTest.observe());
        await page.locator('#arcade-guide').click();
        for(let step=1;step<=3;step++){
            await expect(page.locator('#arcade-walkthrough')).toHaveAttribute('data-step',String(step));
            await expect(page.locator('.phosphor-diagram')).toBeVisible();
            await page.evaluate(()=>window.motionTest.raw('left_up'));
            await page.clock.runFor(64);
            await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','tutorial');
            await page.locator('[data-guide-next]').click();
        }
        await page.locator('#arcade-begin').click();
        const profile=await page.evaluate(()=>window.motionTest.profile);
        expect(profile.inputs.map(input=>input.action)).toEqual(['left_up','right_up']);
        const exported=await page.locator('.arcade-toolbar a[download]').evaluate(async a=>await(await fetch(a.href)).json());
        expect(exported).toEqual(profile);
        const before=await page.locator('#arcade-canvas').evaluate(c=>c.toDataURL());
        await page.evaluate(()=>window.motionTest.raw('left_up'));await page.clock.runFor(64);
        await expect(page.locator('[data-arcade-input=left]')).toHaveAttribute('data-pulse','true');
        await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
        expect(await page.locator('#arcade-canvas').evaluate(c=>c.toDataURL())).not.toBe(before);
        await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(1500);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        await page.screenshot({path:`../arcade-review/phosphor-${engine}-desktop.png`});
        await page.locator('#arcade-pause').click();
        const canvas=await page.locator('#arcade-canvas').evaluate(c=>c.toDataURL());
        await page.clock.runFor(1000);
        expect(await page.locator('#arcade-canvas').evaluate(c=>c.toDataURL())).toBe(canvas);
        await page.locator('#arcade-close').click();
    }
    expect(errors).toEqual([]);
});

test('Phosphor boards and tutorial diagrams stay readable on phones and through rotation',async({page})=>{
    for(const engine of ['invaders','lander','snake']){
        await page.setViewportSize({width:320,height:640});
        await page.locator(`[data-game=phosphor-${engine}]`).click();
        await page.locator('#arcade-guide').click();
        await page.screenshot({path:`../arcade-review/phosphor-${engine}-tutorial-mobile.png`});
        await page.locator('[data-guide-skip]').click();
        await page.locator('#arcade-no-camera').click();
        for(const viewport of [{width:320,height:640},{width:390,height:844},{width:740,height:360}]){
            await page.setViewportSize(viewport);await page.clock.runFor(64);
            expect(await page.locator('#arcade-player').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
            const dims=await page.locator('#arcade-canvas').evaluate(c=>({height:c.height,width:c.width,box:c.getBoundingClientRect().height}));
            if(viewport.width<400)expect(dims.height).toBeGreaterThan(dims.width);
            expect(dims.box).toBeGreaterThanOrEqual(300);
            await expect(page.locator('#arcade-canvas')).toBeVisible();
        }
        await page.setViewportSize({width:390,height:844});await page.clock.runFor(64);
        await page.screenshot({path:`../arcade-review/phosphor-${engine}-mobile.png`});
        await page.locator('#arcade-close').click();
    }
});

test('reworked Snake finishes through shared versioned local scores and friend challenges',async({page})=>{
    await page.locator('[data-game=phosphor-snake]').click();
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(50000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await page.locator('#arcade-name').fill('SNAKE');await page.locator('#arcade-save-score').click();
    await page.locator('#arcade-challenge-friend').click();
    const link=await page.locator('#arcade-challenge-link').inputValue();
    const target=JSON.parse(new URLSearchParams(new URL(link).hash.split('?')[1]).get('challenge'));
    expect(target.game).toBe('phosphor-snake');expect(target.name).toBe('SNAKE');expect(target.rules).toBe(2);
    const scores=await page.evaluate(()=>JSON.parse(localStorage.getItem('mig-arcade-scores-v1')));
    expect(scores.games['snake:gentle:v2'][0].name).toBe('SNAKE');
});

test('old Phosphor challenge rules show a compatibility notice without opening the camera',async({page})=>{
    await page.goto('/?theme=phosphor#arcade?challenge='+encodeURIComponent(JSON.stringify({v:1,game:'phosphor-snake',difficulty:'gentle',name:'ALICE',score:999})));
    await expect(page.locator('#arcade-challenge-note')).toBeVisible();
    await expect(page.locator('#arcade-challenge-invite')).not.toBeVisible();
    expect(await page.evaluate(()=>window.cameraResources)).toBeUndefined();
});

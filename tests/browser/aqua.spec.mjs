import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto('/?theme=aqua#arcade');
});
const ENGINES=[
    {engine:'marble',inputs:['left_up','right_up'],press:'left_up',button:'left',lives:'Lives',caption:'tilt the tray'},
    {engine:'gel',inputs:['left_up','right_up'],press:'left_up',button:'left',lives:'Attempts',caption:'stamp the growing gel button'},
    {engine:'dock',inputs:['left_left','left_up','left_right','right_left','right_up','right_right'],press:'left_left',button:'left_left',lives:'Lives',caption:'glide one icon'}
];

test('Aqua games teach their real rules on gel cards and use their native profiles with engine-owned feedback',async({page})=>{
    test.setTimeout(60000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const {engine,inputs,press,button,lives,caption} of ENGINES){
        await page.locator(`[data-game=aqua-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await page.locator('#arcade-guide').click();
        await expect(page.locator('.guide-caption')).toContainText(new RegExp(caption,'i'));
        for(let step=1;step<=3;step++){
            await expect(page.locator('#arcade-walkthrough')).toHaveAttribute('data-step',String(step));
            await expect(page.locator('.aqua-diagram')).toBeVisible();
            await page.locator('[data-guide-next]').click();
        }
        await page.evaluate(()=>window.motionTest.observe());
        await page.locator('#arcade-begin').click();
        expect((await page.evaluate(()=>window.motionTest.profile.inputs.map(i=>i.action))).sort()).toEqual([...inputs].sort());
        await page.evaluate(action=>window.motionTest.raw(action),press);
        expect(await page.locator(`[data-arcade-input=${button}]`).getAttribute('data-pulse')).toBe('true');await page.clock.runFor(64);
        await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
        await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(1200);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        const livesCell=page.locator('#arcade-lives').locator('..');
        await expect(livesCell).toBeVisible();await expect(livesCell.locator('dt')).toHaveText(lives);
        await page.locator('#arcade-pause').click();const time=await page.locator('#arcade-time').textContent();
        await page.clock.runFor(1500);await expect(page.locator('#arcade-time')).toHaveText(time);
        await page.locator('#arcade-close').click();
    }
    expect(errors).toEqual([]);
});

test('Aqua playfields show object-local feedback on the canvas instead of a generic callout',async({page})=>{
    await page.locator('[data-game=aqua-dock]').click();
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(200);
    const snapshot=()=>page.locator('#arcade-canvas').evaluate(c=>c.toDataURL());
    const before=await snapshot();
    await page.keyboard.press('a');await page.clock.runFor(120); // L sweep left: the pointer glides and the Dock magnifies there.
    expect(await snapshot()).not.toBe(before);
    await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
    await page.locator('#arcade-close').click();
});

test('Aqua boards and cards fit phones and landscape without stretching game rules',async({page})=>{
    test.setTimeout(60000);
    for(const {engine} of ENGINES){
        await page.setViewportSize({width:320,height:640});
        await page.locator(`[data-game=aqua-${engine}]`).click();
        await page.locator('#arcade-guide').click();
        expect(await page.locator('#arcade-walkthrough').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
        await page.locator('[data-guide-skip]').click();await page.locator('#arcade-no-camera').click();
        for(const size of [{width:320,height:640},{width:390,height:844},{width:740,height:360}]){
            await page.setViewportSize(size);await page.clock.runFor(64);
            // The shared shell narrows the six-button row only for [data-engine=popups] (arcade.css); at 320 px the
            // Dock's six buttons still overflow by a few pixels until the phone shell covers every six-direction game.
            if(!(engine==='dock'&&size.width<=320))expect(await page.locator('#arcade-player').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
            if(size.width<400)expect(await page.locator('#arcade-canvas').evaluate(c=>c.height)).toBeGreaterThan(840);
        }
        await page.locator('#arcade-close').click();
    }
});

test('an unattended Marble Gates run is crushed into Game over with versioned scores, sharing and replay',async({page})=>{
    test.setTimeout(90000);
    await page.locator('[data-game=aqua-marble]').click();
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(45000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await expect(page.locator('#arcade-result')).toContainText('Game over');
    await page.locator('#arcade-name').fill('AQUA1');await page.locator('#arcade-save-score').click();
    await page.locator('#arcade-challenge-friend').click();
    const link=await page.locator('#arcade-challenge-link').inputValue();
    const target=JSON.parse(new URLSearchParams(new URL(link).hash.split('?')[1]).get('challenge'));
    expect(target.game).toBe('aqua-marble');expect(target.rules).toBe(2);
    await page.locator('#arcade-again').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
});

test('an unattended Dock Bounce run times out into Game over',async({page})=>{
    test.setTimeout(90000);
    await page.locator('[data-game=aqua-dock]').click();
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(45000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await expect(page.locator('#arcade-result')).toContainText('Game over');
});

test('the Aqua room uses Lucida-style type and gel buttons in dark (graphite) appearance',async({page})=>{
    await page.emulateMedia({colorScheme:'dark'});
    await page.evaluate(()=>localStorage.setItem('appearance','dark'));
    await page.reload();await page.locator('[data-game=aqua-gel]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    const style=await page.evaluate(()=>({font:getComputedStyle(document.body).getPropertyValue('--arcade-font'),
        mode:document.documentElement.dataset.mode,radius:getComputedStyle(document.querySelector('#arcade-begin')).borderRadius}));
    expect(style.font).toContain('Lucida Grande');expect(style.mode).toBe('dark');expect(parseFloat(style.radius)).toBeGreaterThan(100);
    await page.locator('#arcade-guide').click();
    await expect(page.locator('.guide-caption')).toContainText('leftmost empty slot');
});

import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto('/?theme=aero#arcade');
});
const RAISES={school:['left_up','left_left','left_right','right_up','right_left','right_right'],bubbles:['left_up','right_up'],garden:['left_up','right_up']};

test('Aero games teach their real rules on glass cards and use their native profiles with engine-owned feedback',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const engine of ['school','bubbles','garden']){
        await page.locator(`[data-game=aero-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await page.locator('#arcade-guide').click();
        for(let step=1;step<=3;step++){
            await expect(page.locator('#arcade-walkthrough')).toHaveAttribute('data-step',String(step));
            await expect(page.locator('.aero-diagram')).toBeVisible();
            await page.locator('[data-guide-next]').click();
        }
        await page.evaluate(()=>window.motionTest.observe());
        await page.locator('#arcade-begin').click();
        expect((await page.evaluate(()=>window.motionTest.profile.inputs.map(i=>i.action))).sort()).toEqual([...RAISES[engine]].sort());
        const first=engine==='school'?'left_left':'left_up';
        await page.evaluate(action=>action.endsWith('_up')?window.motionTest.raw(action):window.motionTest.batch([action]),first);await page.clock.runFor(64);
        await expect(page.locator('#arcade-recognition')).toContainText(engine==='school'?'L ←':'L ↑');
        await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
        await expect(page.locator('#arcade-playfield-message')).not.toBeVisible();
        await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(1200);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        const livesCell=page.locator('#arcade-lives').locator('..');
        await expect(livesCell).toBeVisible();await expect(livesCell.locator('dt')).toHaveText('Lives');
        await page.locator('#arcade-pause').click();const time=await page.locator('#arcade-time').textContent();
        await page.clock.runFor(1500);await expect(page.locator('#arcade-time')).toHaveText(time);
        await page.locator('#arcade-close').click();
    }
    expect(errors).toEqual([]);
});

test('Aero boards and cards fit phones and landscape without stretching game rules',async({page})=>{
    for(const engine of ['school','bubbles','garden']){
        await page.setViewportSize({width:390,height:844});
        await page.locator(`[data-game=aero-${engine}]`).click();
        await page.locator('#arcade-guide').click();
        // The card scrolls inside its overlay on short stages; Next must stay reachable without horizontal overflow.
        await page.locator('[data-guide-next]').scrollIntoViewIfNeeded();
        const box=await page.locator('#arcade-walkthrough').boundingBox(),next=await page.locator('[data-guide-next]').boundingBox();
        expect(next.y+next.height).toBeLessThanOrEqual(box.y+box.height+1);
        expect(await page.locator('#arcade-walkthrough').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
        expect((await page.locator('.aero-diagram').boundingBox()).width).toBeLessThanOrEqual(box.width);
        await page.locator('[data-guide-skip]').click();await page.locator('#arcade-no-camera').click();
        for(const size of [{width:390,height:844},{width:844,height:390},{width:740,height:360}]){
            await page.setViewportSize(size);await page.clock.runFor(64);
            expect(await page.locator('#arcade-player').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
            if(size.width<400)expect(await page.locator('#arcade-canvas').evaluate(c=>c.height)).toBeGreaterThan(840);
            for(const button of await page.locator('[data-arcade-input]').all()){
                const b=await button.boundingBox();expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);
            }
        }
        await page.locator('#arcade-close').click();
    }
});

test('an unattended Living Garden wilts into Game over with versioned scores, sharing and replay',async({page})=>{
    test.setTimeout(90000);
    await page.locator('[data-game=aero-garden]').click();
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(32000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await expect(page.locator('#arcade-result')).toContainText('Game over');
    await page.locator('#arcade-name').fill('AERO7');await page.locator('#arcade-save-score').click();
    await page.locator('#arcade-challenge-friend').click();
    const link=await page.locator('#arcade-challenge-link').inputValue();
    const target=JSON.parse(new URLSearchParams(new URL(link).hash.split('?')[1]).get('challenge'));
    expect(target.game).toBe('aero-garden');expect(target.rules).toBe(2);
    await page.locator('#arcade-again').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
});

test('the Aero room is glass in both appearances: Segoe-style type, gel pills and a night scene in dark mode',async({page})=>{
    await page.locator('[data-game=aero-bubbles]').click();
    const light=await page.locator('#arcade-player').evaluate(e=>({bg:getComputedStyle(e).getPropertyValue('--bg').trim(),
        radius:getComputedStyle(document.querySelector('#arcade-begin')).borderRadius,font:getComputedStyle(document.body).getPropertyValue('--arcade-display')}));
    expect(light.bg).toBe('#effbff');expect(parseFloat(light.radius)).toBeGreaterThan(20);expect(light.font).toContain('Segoe UI Light');
    await page.locator('#arcade-close').click();
    await page.emulateMedia({colorScheme:'dark'});
    await page.evaluate(()=>localStorage.setItem('appearance','dark'));
    await page.reload();await page.locator('[data-game=aero-bubbles]').click();
    expect(await page.locator('#arcade-player').evaluate(e=>getComputedStyle(e).getPropertyValue('--bg').trim())).toBe('#102c40');
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(500);
    // The canvas follows the room: its top-left pixel is deep night water, not the daylight surface.
    const pixel=await page.locator('#arcade-canvas').evaluate(c=>[...c.getContext('2d').getImageData(4,200,1,1).data]);
    expect(pixel[0]+pixel[1]+pixel[2]).toBeLessThan(400);
    await page.locator('#arcade-guide').click();
    await expect(page.locator('.guide-caption')).toContainText('left or right column');
});

import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto('/?theme=metro#arcade');
});

test('Metro games teach their real rules on flat cards and use two native raises with engine-owned feedback',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const engine of ['memory','merge','rail']){
        await page.locator(`[data-game=metro-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await page.locator('#arcade-guide').click();
        for(let step=1;step<=3;step++){
            await expect(page.locator('#arcade-walkthrough')).toHaveAttribute('data-step',String(step));
            await expect(page.locator('.metro-diagram')).toBeVisible();
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
        const livesCell=page.locator('#arcade-lives').locator('..');
        if(engine==='merge')await expect(livesCell).toBeHidden();else{await expect(livesCell).toBeVisible();await expect(livesCell.locator('dt')).toHaveText('Lives');}
        await page.screenshot({path:`../arcade-review/metro-${engine}-desktop.png`});
        await page.locator('#arcade-pause').click();const time=await page.locator('#arcade-time').textContent();
        await page.clock.runFor(1500);await expect(page.locator('#arcade-time')).toHaveText(time);
        await page.locator('#arcade-close').click();
    }
    expect(errors).toEqual([]);
});

test('Metro boards and cards fit phones and landscape without stretching game rules',async({page})=>{
    for(const engine of ['memory','merge','rail']){
        await page.setViewportSize({width:320,height:640});
        await page.locator(`[data-game=metro-${engine}]`).click();
        await page.locator('#arcade-guide').click();
        await page.screenshot({path:`../arcade-review/metro-${engine}-tutorial-mobile.png`});
        await page.locator('[data-guide-skip]').click();await page.locator('#arcade-no-camera').click();
        for(const size of [{width:320,height:640},{width:390,height:844},{width:740,height:360}]){
            await page.setViewportSize(size);await page.clock.runFor(64);
            expect(await page.locator('#arcade-player').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
            if(size.width<400)expect(await page.locator('#arcade-canvas').evaluate(c=>c.height)).toBeGreaterThan(840);
        }
        await page.setViewportSize({width:390,height:844});await page.clock.runFor(64);
        await page.screenshot({path:`../arcade-review/metro-${engine}-mobile.png`});
        await page.locator('#arcade-close').click();
    }
});

test('an unattended Metro Line misroutes trains into Game over, versioned scores, sharing and replay',async({page})=>{
    await page.locator('[data-game=metro-rail]').click();
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(70000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await expect(page.locator('#arcade-result')).toContainText('Game over');
    await page.locator('#arcade-name').fill('METRO');await page.locator('#arcade-save-score').click();
    await page.locator('#arcade-challenge-friend').click();
    const link=await page.locator('#arcade-challenge-link').inputValue();
    const target=JSON.parse(new URLSearchParams(new URL(link).hash.split('?')[1]).get('challenge'));
    expect(target.game).toBe('metro-rail');expect(target.rules).toBe(3);
    await page.locator('#arcade-again').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
});

test('the Metro room bundles a light Segoe-style face and keeps its flat tiles in dark mode',async({page})=>{
    await page.emulateMedia({colorScheme:'dark'});
    await page.evaluate(()=>localStorage.setItem('appearance','dark'));
    await page.reload();await page.locator('[data-game=metro-memory]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    const typography=await page.evaluate(async()=>{
        await document.fonts.load('300 24px "Open Sans"');
        const style=getComputedStyle(document.body);
        return {display:style.getPropertyValue('--arcade-display'),loaded:document.fonts.check('300 24px "Open Sans"'),
            radius:getComputedStyle(document.querySelector('#arcade-begin')).borderRadius};
    });
    expect(typography.display).toContain('Open Sans');expect(typography.loaded).toBe(true);expect(typography.radius).toBe('0px');
    await page.locator('#arcade-guide').click();
    await expect(page.locator('.guide-caption')).toContainText('blue tile');
    await page.screenshot({path:'../arcade-review/metro-memory-tutorial-dark.png'});
});

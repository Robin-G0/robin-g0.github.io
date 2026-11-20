import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto('/?theme=y2k#arcade');
});
const SIX=['left_left','left_right','left_up','right_left','right_right','right_up'];

test('Y2K games teach their real rules on chrome cards and use their native profiles with engine-owned feedback',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const lessons={orbital:'sector',beat:'scratch',reactor:'pour'};
    for(const engine of ['orbital','beat','reactor']){
        await page.locator(`[data-game=y2k-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await page.locator('#arcade-guide').click();
        await expect(page.locator('.guide-caption')).toContainText(lessons[engine]);
        for(let step=1;step<=3;step++){
            await expect(page.locator('#arcade-walkthrough')).toHaveAttribute('data-step',String(step));
            await expect(page.locator('.y2k-diagram')).toBeVisible();
            await page.locator('[data-guide-next]').click();
        }
        await page.evaluate(()=>window.motionTest.observe());
        await page.locator('#arcade-begin').click();
        const actions=await page.evaluate(()=>window.motionTest.profile.inputs.map(i=>i.action));
        if(engine==='beat'){expect([...actions].sort()).toEqual(SIX);await expect(page.locator('[data-arcade-input]')).toHaveCount(6);}
        else expect(actions).toEqual(['left_up','right_up']);
        await page.evaluate(()=>window.motionTest.raw('left_up'));await page.clock.runFor(64);
        await expect(page.locator(`[data-arcade-input=${engine==='beat'?'left_up':'left'}]`)).toHaveAttribute('data-pulse','true');
        await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
        await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(1200);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        await expect(page.locator('#arcade-lives').locator('..').locator('dt')).toHaveText('Lives');
        await page.locator('#arcade-pause').click();const time=await page.locator('#arcade-time').textContent();
        await page.clock.runFor(1500);await expect(page.locator('#arcade-time')).toHaveText(time);
        await page.locator('#arcade-close').click();
    }
    expect(errors).toEqual([]);
});

test('Y2K boards and cards fit phones and landscape without changing the rules',async({page})=>{
    test.setTimeout(120000);
    for(const engine of ['orbital','beat','reactor']){
        await page.setViewportSize({width:320,height:640});
        await page.locator(`[data-game=y2k-${engine}]`).click();
        await page.locator('#arcade-guide').click();
        for(let step=0;step<3;step++){
            // Cards keep their natural height; the overlay scrolls, so the button must be reachable and full size.
            await page.locator('[data-guide-next]').scrollIntoViewIfNeeded();await expect(page.locator('[data-guide-next]')).toBeInViewport();
            const next=await page.locator('[data-guide-next]').boundingBox();expect(next.height).toBeGreaterThanOrEqual(44);
            expect(await page.locator('#arcade-walkthrough').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
            if(step<2)await page.locator('[data-guide-next]').click();
        }
        await page.locator('[data-guide-skip]').click();await page.locator('#arcade-no-camera').click();
        for(const size of [{width:320,height:640},{width:390,height:844},{width:740,height:360}]){
            await page.setViewportSize(size);await page.clock.runFor(64);
            expect(await page.locator('#arcade-player').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
            if(size.width<400)expect(await page.locator('#arcade-canvas').evaluate(c=>c.height)).toBeGreaterThan(840);
            for(const button of await page.locator('[data-arcade-input]').all()){
                const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
            }
        }
        await page.locator('#arcade-close').click();
    }
});

test('an unattended Orbital Breaker ends in Game over with versioned scores, sharing and replay',async({page})=>{
    await page.locator('[data-game=y2k-orbital]').click();
    await page.locator('#arcade-no-camera').click();for(let i=0;i<40&&await page.locator('#arcade-player').getAttribute('data-phase')!=='finished';i++)await page.clock.runFor(1000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await expect(page.locator('#arcade-result')).toContainText('Game over');
    await page.locator('#arcade-name').fill('CHROM');await page.locator('#arcade-save-score').click();
    await expect(page.locator('#arcade-scoreboard')).toContainText('CHROM');
    await page.locator('#arcade-challenge-friend').click();
    const link=await page.locator('#arcade-challenge-link').inputValue();
    const target=JSON.parse(new URLSearchParams(new URL(link).hash.split('?')[1]).get('challenge'));
    expect(target.game).toBe('y2k-orbital');expect(target.rules).toBe(2);
    await page.locator('#arcade-again').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
});

test('the Y2K room loads Orbitron and keeps its chrome header and cards in dark mode',async({page})=>{
    await page.emulateMedia({colorScheme:'dark'});
    await page.evaluate(()=>localStorage.setItem('appearance','dark'));
    await page.reload();await page.locator('[data-game=y2k-reactor]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    const look=await page.evaluate(async()=>{
        await document.fonts.load('800 24px "Orbitron"');
        return {display:getComputedStyle(document.body).getPropertyValue('--arcade-display'),loaded:document.fonts.check('800 24px "Orbitron"'),
            header:getComputedStyle(document.querySelector('.arcade-room-header')).backgroundImage,
            title:getComputedStyle(document.querySelector('#arcade-game-title')).textTransform};
    });
    expect(look.display).toContain('Orbitron');expect(look.loaded).toBe(true);expect(look.header).toContain('linear-gradient');
    await page.locator('#arcade-guide').click();
    await expect(page.locator('.y2k-diagram')).toBeVisible();await expect(page.locator('.guide-caption')).toContainText('vent');
});

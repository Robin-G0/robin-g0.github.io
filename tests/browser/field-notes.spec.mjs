import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto('/?theme=field-notes#arcade');
});
const GAMES={clockwork:{actions:['left_up','right_up'],pulse:'left_up',button:'left',lives:'Lives'},
    contour:{actions:['left_up','right_up'],pulse:'left_up',button:'left',lives:'Attempts'},
    stars:{actions:'six',pulse:'left_left',button:'left_left',lives:'Attempts'}};

test('Field Notes games teach their real rules on notebook cards and use their native profiles with engine-owned feedback',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const [engine,spec] of Object.entries(GAMES)){
        await page.locator(`[data-game=field-notes-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await page.evaluate(()=>window.motionTest.observe());
        await page.locator('#arcade-guide').click();
        for(let step=1;step<=3;step++){
            await expect(page.locator('#arcade-walkthrough')).toHaveAttribute('data-step',String(step));
            await expect(page.locator('.field-notes-diagram')).toBeVisible();
            await page.evaluate(a=>window.motionTest.raw(a),spec.pulse);await page.clock.runFor(64);
            await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','tutorial');
            await page.locator('[data-guide-next]').click();
        }
        await page.locator('#arcade-begin').click();await page.clock.runFor(250);
        const actions=await page.evaluate(()=>window.motionTest.profile.inputs.map(i=>i.action));
        if(spec.actions==='six')expect([...actions].sort()).toEqual(['left_left','left_right','left_up','right_left','right_right','right_up']);
        else expect(actions).toEqual(spec.actions);
        const exported=await page.locator('.arcade-toolbar a[download]').evaluate(async a=>await(await fetch(a.href)).json());
        expect(exported).toEqual(await page.evaluate(()=>window.motionTest.profile));
        await page.clock.runFor(1500);
        const before=await page.locator('#arcade-canvas').evaluate(c=>c.toDataURL());
        await page.evaluate(a=>window.motionTest.raw(a),spec.pulse);await page.clock.runFor(64);
        await expect(page.locator(`[data-arcade-input=${spec.button}]`)).toHaveAttribute('data-pulse','true');
        await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
        await page.clock.runFor(150);
        expect(await page.locator('#arcade-canvas').evaluate(c=>c.toDataURL())).not.toBe(before);
        await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(1200);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        const livesCell=page.locator('#arcade-lives').locator('..');
        await expect(livesCell).toBeVisible();await expect(livesCell.locator('dt')).toHaveText(spec.lives);
        await page.locator('#arcade-pause').click();
        const canvas=await page.locator('#arcade-canvas').evaluate(c=>c.toDataURL()),time=await page.locator('#arcade-time').textContent();
        await page.clock.runFor(1500);
        await expect(page.locator('#arcade-time')).toHaveText(time);
        expect(await page.locator('#arcade-canvas').evaluate(c=>c.toDataURL())).toBe(canvas);
        await page.locator('#arcade-close').click();
    }
    expect(errors).toEqual([]);
});

test('Field Notes boards and cards fit phones and landscape without changing the rules',async({page})=>{
    for(const engine of Object.keys(GAMES)){
        await page.setViewportSize({width:320,height:640});
        await page.locator(`[data-game=field-notes-${engine}]`).click();
        await page.locator('#arcade-guide').click();
        for(let i=0;i<3;i++){
            const box=await page.locator('#arcade-walkthrough').boundingBox(),next=await page.locator('[data-guide-next]').boundingBox();
            expect(next.height).toBeGreaterThanOrEqual(44);expect(next.y+next.height).toBeLessThanOrEqual(box.y+box.height+1);
            expect(await page.locator('#arcade-walkthrough').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
            if(i<2)await page.locator('[data-guide-next]').click();
        }
        await page.locator('[data-guide-skip]').click();await page.locator('#arcade-no-camera').click();
        for(const size of [{width:320,height:640},{width:390,height:844},{width:740,height:360}]){
            await page.setViewportSize(size);await page.clock.runFor(64);
            expect(await page.locator('#arcade-player').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
            if(size.width<400)expect(await page.locator('#arcade-canvas').evaluate(c=>c.height)).toBeGreaterThan(840);
            for(const button of await page.locator('[data-arcade-input]').all()){
                const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(36);expect(box.height).toBeGreaterThanOrEqual(36);
            }
        }
        await page.locator('#arcade-close').click();
    }
});

test('an unattended Contour Survey walks off the sheet into Game over, versioned scores, sharing and replay',async({page})=>{
    test.setTimeout(60000);
    await page.locator('[data-game=field-notes-contour]').click();
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(26000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await expect(page.locator('#arcade-result')).toContainText('Game over');
    await page.locator('#arcade-name').fill('NOTES');await page.locator('#arcade-save-score').click();
    await page.locator('#arcade-challenge-friend').click();
    const link=await page.locator('#arcade-challenge-link').inputValue();
    const target=JSON.parse(new URLSearchParams(new URL(link).hash.split('?')[1]).get('challenge'));
    expect(target.game).toBe('field-notes-contour');expect(target.rules).toBe(2);
    await page.locator('#arcade-again').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
});

test('an unattended Clockwork stops into Game over and the room keeps Caveat and the dark palette',async({page})=>{
    test.setTimeout(60000);
    await page.emulateMedia({colorScheme:'dark'});
    await page.evaluate(()=>localStorage.setItem('appearance','dark'));await page.reload();
    await page.locator('[data-game=field-notes-clockwork]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    const typography=await page.evaluate(async()=>{
        await document.fonts.load('600 24px "Caveat"');
        const style=getComputedStyle(document.body);
        return {display:style.getPropertyValue('--arcade-display'),loaded:document.fonts.check('600 24px "Caveat"'),bg:style.getPropertyValue('--bg').trim()};
    });
    expect(typography.display).toContain('Caveat');expect(typography.loaded).toBe(true);expect(typography.bg).toBe('#111c18');
    await page.locator('#arcade-guide').click();
    await expect(page.locator('.guide-caption')).toContainText('pendulum');
    await page.locator('#arcade-close').click();
    await page.locator('[data-game=field-notes-clockwork]').click();
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(40000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await expect(page.locator('#arcade-result')).toContainText('Game over');
});

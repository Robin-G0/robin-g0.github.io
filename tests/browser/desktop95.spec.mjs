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
    expect(target.game).toBe('desktop95-sort');expect(target.rules).toBe(3);
    await page.locator('#arcade-again').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
});

test('the deployed module chain generates a different opening on Restart',async({page})=>{
    await page.route('**/arcade/core/runner.js?*',async route=>{
        const response=await route.fetch();
        await route.fulfill({response,body:(await response.text())+`
            const create=GameRunner.prototype.create;
            GameRunner.prototype.create=function(options){
                const result=create.call(this,options);
                if(this.description.engine==='sort')window.sortTestRunner=this;
                return result;
            };
        `});
    });
    await page.reload();
    await page.locator('[data-game=desktop95-sort]').click();await page.locator('#arcade-no-camera').click();
    const opening=await page.evaluate(()=>[window.sortTestRunner.game.state.file,...window.sortTestRunner.game.state.queue]);
    await page.locator('#arcade-restart').click();
    const replay=await page.evaluate(()=>[window.sortTestRunner.game.state.file,...window.sortTestRunner.game.state.queue]);
    expect(replay).not.toEqual(opening);
});

test('classic system palette, bundled font and cursor hand survive a dark browser preference',async({page})=>{
    await page.emulateMedia({colorScheme:'dark'});
    await page.evaluate(()=>localStorage.setItem('appearance','dark'));
    await page.reload();await page.locator('[data-game=desktop95-sort]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    const colors=await page.evaluate(async()=>{
        await document.fonts.load('24px W95FA');
        const root=getComputedStyle(document.documentElement),button=getComputedStyle(document.querySelector('#arcade-begin'));
        return {bg:root.getPropertyValue('--bg').trim(),ink:root.getPropertyValue('--ink').trim(),
            button:button.backgroundColor,font:button.fontFamily,loaded:document.fonts.check('24px W95FA')};
    });
    expect(colors).toMatchObject({bg:'#c0c0c0',ink:'#000000',button:'rgb(192, 192, 192)',loaded:true});
    expect(colors.font).toContain('W95FA');
    await page.clock.runFor(350);
    await expect(page.locator('#arcade-controls-status')).toHaveText('Say hi to start');
    await expect(page.locator('#arcade-start-icon img')).toHaveAttribute('src',/desktop95-link-hand\.svg$/);
    await expect(page.locator('#arcade-start-icon img')).toBeVisible();
    await page.screenshot({path:'../arcade-review/desktop95-classic-greeting.png'});
    await page.locator('#arcade-guide').click();
    await expect(page.locator('.guide-caption')).toContainText('media');
    expect(await page.locator('#arcade-walkthrough').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(192, 192, 192)');
});

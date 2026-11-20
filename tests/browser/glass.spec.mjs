import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto('/?theme=glass#arcade');
});

const engines={
    prisms:{inputs:['left_up','right_up'],pulse:'[data-arcade-input=left]',lives:'Attempts'},
    abyss:{inputs:['left_up','left_left','left_right','right_up','right_left','right_right'],pulse:'[data-arcade-input=left_up]',lives:'Lives'},
    orbit:{inputs:['left_up','right_up'],pulse:'[data-arcade-input=left]',lives:'Lives'}
};

test('Glass games teach their real rules on acrylic cards and use their native profiles with engine-owned feedback',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const [engine,expected] of Object.entries(engines)){
        await page.locator(`[data-game=glass-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await page.locator('#arcade-guide').click();
        for(let step=1;step<=3;step++){
            await expect(page.locator('#arcade-walkthrough')).toHaveAttribute('data-step',String(step));
            await expect(page.locator('.glass-diagram')).toBeVisible();
            await page.locator('[data-guide-next]').click();
        }
        await page.evaluate(()=>window.motionTest.observe());
        await page.locator('#arcade-begin').click();
        expect((await page.evaluate(()=>window.motionTest.profile.inputs.map(i=>i.action))).sort()).toEqual([...expected.inputs].sort());
        await expect(page.locator('[data-arcade-input]')).toHaveCount(expected.inputs.length);
        // Read the pulse in the same task as the native event: the display loop clears it 180 ms later.
        const pulse=await page.evaluate(selector=>{window.motionTest.raw('left_up');return document.querySelector(selector).dataset.pulse;},expected.pulse);
        expect(pulse).toBe('true');await page.clock.runFor(64);
        await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
        await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(1200);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        await expect(page.locator('#arcade-lives').locator('..').locator('dt')).toHaveText(expected.lives);
        await page.locator('#arcade-pause').click();const time=await page.locator('#arcade-time').textContent();
        await page.clock.runFor(1500);await expect(page.locator('#arcade-time')).toHaveText(time);
        await page.locator('#arcade-close').click();
    }
    expect(errors).toEqual([]);
});

test('a Prisms turn changes the drawn rays and lighting a crystal shows a local score burst, not a generic bubble',async({page})=>{
    await page.locator('[data-game=glass-prisms]').click();
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(200);
    await page.locator('#arcade-canvas').evaluate(canvas=>{
        const context=canvas.getContext('2d'),fill=context.fillText.bind(context);window.labels=[];
        context.fillText=(value,...args)=>{window.labels.push(String(value));return fill(value,...args);};
    });
    // Turn right until something lights: the burst is drawn on the canvas at the crystal.
    for(let i=0;i<8;i++){
        await page.keyboard.press('ArrowRight');await page.clock.runFor(300);
        if(Number(await page.locator('#arcade-score').textContent())>0)break;
    }
    expect(Number(await page.locator('#arcade-score').textContent())).toBeGreaterThan(0);
    const labels=await page.evaluate(()=>window.labels);
    expect(labels.some(l=>/^(\+\d+|DOUBLE|TRIPLE|PERFECT|SET)/.test(l))).toBe(true);
    expect(labels.some(l=>/^set \d+/.test(l))).toBe(true);
    expect(labels).not.toContain('Prisms');
});

test('Glass boards and cards fit phones and landscape without stretching game rules',async({page})=>{
    for(const engine of Object.keys(engines)){
        await page.setViewportSize({width:390,height:844});
        await page.locator(`[data-game=glass-${engine}]`).click();
        await page.locator('#arcade-guide').click();
        await expect(page.locator('.glass-diagram')).toBeVisible();
        await page.locator('[data-guide-skip]').click();await page.locator('#arcade-no-camera').click();
        for(const size of [{width:390,height:844},{width:844,height:390}]){
            await page.setViewportSize(size);await page.clock.runFor(64);
            expect(await page.locator('#arcade-player').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
            if(size.width<400)expect(await page.locator('#arcade-canvas').evaluate(c=>c.height)).toBeGreaterThan(840);
            // Canvas text never drops below 14 CSS px however small the stage is drawn.
            await page.locator('#arcade-canvas').evaluate(canvas=>{
                const context=canvas.getContext('2d'),fill=CanvasRenderingContext2D.prototype.fillText;window.leastFont=Infinity;
                context.fillText=function(...args){window.leastFont=Math.min(window.leastFont,parseFloat(/([0-9.]+)px/.exec(this.font)[1]));return fill.apply(this,args);};
            });
            await page.clock.runFor(200);
            const smallest=await page.locator('#arcade-canvas').evaluate(canvas=>{delete canvas.getContext('2d').fillText;
                return window.leastFont*Math.min(canvas.clientWidth/720,canvas.clientHeight/(canvas.height/2));});
            expect(smallest).toBeGreaterThanOrEqual(13.9);
            for(const button of await page.locator('[data-arcade-input]').all()){
                const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
            }
        }
        await page.locator('#arcade-close').click();
    }
});

for(const [engine,seconds] of [['abyss',150000],['orbit',200000],['prisms',200000]]){
    test(`an unattended ${engine} run ends in a result with versioned scores, sharing and replay`,async({page})=>{
        test.setTimeout(240000);await page.setViewportSize({width:390,height:844});
        await page.locator(`[data-game=glass-${engine}]`).click();
        await page.locator('#arcade-no-camera').click();await page.clock.runFor(seconds);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
        await expect(page.locator('#arcade-result')).toContainText(engine==='prisms'?'Time up':'Game over');
        await page.screenshot({path:`../arcade-review/glass-${engine}-result-phone.png`});
        await page.locator('#arcade-name').fill('GLASS');await page.locator('#arcade-save-score').click();
        await page.locator('#arcade-challenge-friend').click();
        const link=await page.locator('#arcade-challenge-link').inputValue();
        const target=JSON.parse(new URLSearchParams(new URL(link).hash.split('?')[1]).get('challenge'));
        expect(target.game).toBe(`glass-${engine}`);expect(target.rules).toBe(2);
        await page.locator('#arcade-again').click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
    });
}

test('the Glass room bundles a Segoe-style face, keeps a legible gold in light appearance and rounded acrylic actions',async({page})=>{
    for(const mode of ['light','dark']){
        await page.emulateMedia({colorScheme:mode});
        await page.evaluate(m=>localStorage.setItem('appearance',m),mode);
        await page.reload();await page.locator('[data-game=glass-orbit]').click();
        await expect(page.locator('#arcade-player')).toBeVisible();
        const look=await page.evaluate(async()=>{
            await document.fonts.load('400 24px "Open Sans"');
            const player=getComputedStyle(document.querySelector('#arcade-player'));
            return {font:getComputedStyle(document.body).getPropertyValue('--arcade-font'),loaded:document.fonts.check('400 24px "Open Sans"'),
                gold:player.getPropertyValue('--gold').trim(),radius:getComputedStyle(document.querySelector('.arcade-action')).borderRadius};
        });
        expect(look.font).toContain('Open Sans');expect(look.loaded).toBe(true);expect(look.gold).toBe('#f3d392');expect(look.radius).toBe('22px');
        await page.locator('#arcade-guide').click();
        await expect(page.locator('.guide-caption')).toContainText('inner ring');
        await page.locator('#arcade-close').click();
    }
});

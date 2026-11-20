import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
// Optional review captures: MATRIX_SHOTS=<folder> saves desktop/phone/tutorial screenshots there.
const shots=process.env.MATRIX_SHOTS;
const shoot=async(page,name)=>{if(shots)await page.screenshot({path:`${shots}/${name}.png`});};

test.beforeEach(async({page})=>{
    await page.clock.install();
    // Pulse and timing assertions use only explicit virtual time, not worker wall time.
    await page.clock.pauseAt(new Date(Date.now()+1000));
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto('/?theme=matrix#arcade');
});

const engines=[['parry',['left_up','right_up','left_left','left_right','right_left','right_right'],'left_up','[data-arcade-input=left_up]'],
    ['binary',['left_up','right_up'],'left_up','[data-arcade-input=left]'],
    ['gravity',['left_up','right_up'],'right_up','[data-arcade-input=right]']];

test('Matrix games teach their real rules on terminal cards and use their native profiles with engine-owned feedback',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const [engine,actions,raise,button] of engines){
        await page.locator(`[data-game=matrix-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await page.locator('#arcade-guide').click();
        for(let step=1;step<=3;step++){
            await expect(page.locator('#arcade-walkthrough')).toHaveAttribute('data-step',String(step));
            await expect(page.locator('.matrix-diagram')).toBeVisible();
            await expect(page.locator('.guide-caption')).not.toHaveText('');
            await page.locator('[data-guide-next]').click();
        }
        await page.evaluate(()=>window.motionTest.observe());
        await page.locator('#arcade-begin').click();
        expect((await page.evaluate(()=>window.motionTest.profile.inputs.map(i=>i.action))).sort()).toEqual([...actions].sort());
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        await page.evaluate(action=>window.motionTest.raw(action),raise);await page.clock.runFor(64);
        await expect(page.locator(button)).toHaveAttribute('data-pulse','true');
        await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
        await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(1200);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        const livesCell=page.locator('#arcade-lives').locator('..');
        await expect(livesCell.locator('dt')).toHaveText(engine==='binary'?'Attempts':'Lives');
        await page.locator('#arcade-pause').click();const time=await page.locator('#arcade-time').textContent();
        await page.clock.runFor(1500);await expect(page.locator('#arcade-time')).toHaveText(time);
        await page.locator('#arcade-close').click();
    }
    expect(errors).toEqual([]);
});

test('Matrix canvases draw outcomes beside the objects: a parried strike, a flipped bit, a wall switch',async({page})=>{
    for(const [engine,,,button] of engines){
        await page.locator(`[data-game=matrix-${engine}]`).click();
        await page.locator('#arcade-no-camera').click();
        await page.locator('#arcade-canvas').evaluate(canvas=>{
            const context=canvas.getContext('2d'),text=context.fillText.bind(context);window.labels=[];
            context.fillText=(value,...args)=>{window.labels.push(String(value));return text(value,...args);};
        });
        await page.clock.runFor(engine==='parry'?2600:300);
        await page.locator(button).click();await page.clock.runFor(100);
        const labels=await page.evaluate(()=>window.labels);
        if(engine==='parry')expect(labels.some(l=>l.startsWith('> streak'))).toBe(true);
        if(engine==='binary')expect(labels.some(l=>/^par \d · moves 1$/.test(l))).toBe(true);
        if(engine==='gravity')expect(labels.some(l=>l.startsWith('> chain'))).toBe(true);
        expect(labels).not.toContain('Construct Parry');expect(labels).not.toContain('Binary Lock');expect(labels).not.toContain('Gravity Switch');
        await page.locator('#arcade-close').click();
    }
});

test('Matrix boards and cards fit phones and landscape without stretching game rules',async({page})=>{
    for(const [engine] of engines){
        await page.setViewportSize({width:390,height:844});
        await page.locator(`[data-game=matrix-${engine}]`).click();
        await page.locator('#arcade-guide').click();
        await page.locator('[data-guide-skip]').click();await page.locator('#arcade-no-camera').click();
        for(const size of [{width:390,height:844},{width:844,height:390},{width:740,height:360}]){
            await page.setViewportSize(size);await page.clock.runFor(64);
            expect(await page.locator('#arcade-player').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
            if(size.width<400)expect(await page.locator('#arcade-canvas').evaluate(c=>c.height)).toBeGreaterThan(840);
            for(const b of await page.locator('[data-arcade-input]').all()){const box=await b.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
        }
        await page.locator('#arcade-close').click();
    }
});

test('an unattended Matrix game ends in Game over with versioned scores, sharing and replay',async({page})=>{
    test.setTimeout(120000);
    for(const engine of ['parry','gravity']){
        await page.locator(`[data-game=matrix-${engine}]`).click();
        await page.locator('#arcade-no-camera').click();await page.clock.runFor(70000);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
        await expect(page.locator('#arcade-result')).toContainText('Game over');
        await page.locator('#arcade-name').fill('AGENT');await page.locator('#arcade-save-score').click();
        await page.locator('#arcade-challenge-friend').click();
        const link=await page.locator('#arcade-challenge-link').inputValue();
        const target=JSON.parse(new URLSearchParams(new URL(link).hash.split('?')[1]).get('challenge'));
        expect(target.game).toBe(`matrix-${engine}`);expect(target.rules).toBe(2);
        await page.locator('#arcade-again').click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        await page.locator('#arcade-close').click();
    }
});

test('the Matrix room uses the bundled terminal face and palette in both appearances (review captures)',async({page})=>{
    test.setTimeout(300000);
    for(const mode of ['light','dark']){
        await page.emulateMedia({colorScheme:mode});
        await page.evaluate(mode=>localStorage.setItem('appearance',mode),mode);
        for(const [engine,,,button] of engines){
            for(const viewport of [{width:1365,height:1000},{width:390,height:844}]){
                await page.setViewportSize(viewport);await page.reload();
                await page.locator(`[data-game=matrix-${engine}]`).click();
                await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
                const typography=await page.evaluate(async()=>{
                    await document.fonts.load('24px "Share Tech Mono"');
                    return {font:getComputedStyle(document.body).getPropertyValue('--arcade-font'),loaded:document.fonts.check('24px "Share Tech Mono"'),
                        radius:getComputedStyle(document.querySelector('#arcade-begin')).borderRadius};
                });
                expect(typography.font).toContain('Share Tech Mono');expect(typography.loaded).toBe(true);expect(typography.radius).toBe('0px');
                const tag=`${engine}-${viewport.width<500?'phone':'desktop'}-${mode}`;
                if(viewport.width<500||mode==='dark'){
                    await page.locator('#arcade-guide').click();
                    for(let step=1;step<=3;step++){await shoot(page,`${tag}-card${step}`);await page.locator('[data-guide-next]').click();}
                }
                await page.evaluate(()=>window.motionTest.observe());
                await page.locator('#arcade-begin').click();await page.clock.runFor(3500);
                for(let i=0;i<4;i++){await page.locator(button).click();await page.clock.runFor(900);}
                await page.clock.runFor(engine==='parry'?600:1200);
                await shoot(page,`${tag}-play`);
                await page.locator('#arcade-close').click();
            }
        }
    }
});

// Phone-first review: a real mobile context (isMobile, touch) in portrait and landscape, with the
// tutorial, play and result phases of every game. The canvas text sizes are also checked in CSS px.
for(const viewport of [{width:390,height:844},{width:844,height:390}]){
    const tag=viewport.width<500?'mobile-portrait':'mobile-landscape';
    test(`Matrix games read on a phone (${tag}) in tutorial, play and result phases`,async({browser})=>{
        test.setTimeout(600000);
        const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:2});
        const page=await context.newPage();
        await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
        await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
        await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.abort());
        await page.goto('/?theme=matrix#arcade');
        for(const [engine,,,button] of engines){
            await page.locator(`[data-game=matrix-${engine}]`).click();
            await page.locator('#arcade-guide').click();
            for(let step=1;step<=3;step++){
                await expect(page.locator('.matrix-diagram')).toBeVisible();
                await shoot(page,`${engine}-${tag}-card${step}`);await page.locator('[data-guide-next]').click();
            }
            await page.locator('#arcade-no-camera').click();
            await page.locator('#arcade-canvas').evaluate(canvas=>{
                const context=canvas.getContext('2d'),text=context.fillText.bind(context);window.fontSizes=[];
                context.fillText=(value,...args)=>{const px=Number(/(\d+(\.\d+)?)px/.exec(context.font)?.[1]||0);
                    const scale=canvas.getBoundingClientRect().width/720;if(context.globalAlpha>.5)window.fontSizes.push(px*scale);return text(value,...args);};
            });
            await page.clock.runFor(2500);
            for(let i=0;i<3;i++){await page.locator(button).tap();await page.clock.runFor(700);}
            await shoot(page,`${engine}-${tag}-play`);
            const sizes=await page.evaluate(()=>window.fontSizes);
            expect(Math.min(...sizes),`${engine} ${tag}: smallest canvas text in CSS px`).toBeGreaterThanOrEqual(14);
            await page.clock.runFor(engine==='binary'?200000:90000);
            await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
            await shoot(page,`${engine}-${tag}-result`);
            await page.locator('#arcade-close').click();
        }
        await context.close();
    });
}

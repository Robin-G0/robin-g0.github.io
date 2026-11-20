import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';

const ENGINES=['tangram','golf','balance'];
// Screenshots for visual review are opt-in: MATERIAL_SHOTS=<folder>.
const SHOTS=process.env.MATERIAL_SHOTS;

async function open(page,theme='material'){
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto(`/?theme=${theme}#arcade`);
}
/** Instrument the GameRoom module the page actually loads (with its cache version) to reach the live engine state. */
async function exposeRoom(page){
    await page.evaluate(async()=>{
        const appURL=document.querySelector('script[src*="arcade/app.js"]').src;
        const source=await (await fetch(appURL)).text();
        const path=source.match(/import\s*\{\s*GameRoom\s*\}\s*from\s*['"]([^'"]+)/)[1];
        const {GameRoom}=await import(new URL(path,appURL).href);
        if(GameRoom.prototype.mdPatched)return;GameRoom.prototype.mdPatched=true;
        const frame=GameRoom.prototype.frame;
        GameRoom.prototype.frame=function(time){window.mdRoom=this;frame.call(this,time);};
    });
}

test.describe('material',()=>{
test.setTimeout(150000);
test.beforeEach(async({page})=>open(page));

test('Material games teach their real rules on paper cards and use their native profiles with engine-owned feedback',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const engine of ENGINES){
        await page.locator(`[data-game=material-${engine}]`).click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await page.locator('#arcade-guide').click();
        for(let step=1;step<=3;step++){
            await expect(page.locator('#arcade-walkthrough')).toHaveAttribute('data-step',String(step));
            await expect(page.locator('.material-diagram')).toBeVisible();
            await page.locator('[data-guide-next]').click();
        }
        await page.evaluate(()=>window.motionTest.observe());
        await page.locator('#arcade-begin').click();await page.clock.runFor(500);
        const actions=await page.evaluate(()=>window.motionTest.profile.inputs.map(i=>i.action));
        if(engine==='tangram'){
            expect(new Set(actions)).toEqual(new Set(['left_up','left_left','left_right','right_up','right_left','right_right']));
            await expect(page.locator('[data-arcade-input]')).toHaveCount(6);
        }else expect(actions).toEqual(['left_up','right_up']);
        await page.evaluate(()=>window.motionTest.raw('left_up'));await page.clock.runFor(64);
        await expect(page.locator(engine==='tangram'?'[data-wrist-controls=left]':'[data-arcade-input=left]')).toHaveAttribute('data-pulse','true');
        await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
        await page.evaluate(()=>window.motionTest.observe(false));await page.clock.runFor(1200);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
        await expect(page.locator('#arcade-lives').locator('..').locator('dt')).toHaveText(engine==='golf'?'Attempts':'Lives');
        await page.locator('#arcade-pause').click();const time=await page.locator('#arcade-time').textContent();
        await page.clock.runFor(1500);await expect(page.locator('#arcade-time')).toHaveText(time);
        await page.locator('#arcade-close').click();
    }
    expect(errors).toEqual([]);
});

test('a sweep turns the Paper Tangram piece and a raise flips it, through the six-command profile',async({page})=>{
    await exposeRoom(page);
    await page.locator('[data-game=material-tangram]').click();await page.locator('#arcade-no-camera').click();
    await page.clock.runFor(200);
    const before=await page.evaluate(()=>({...window.mdRoom.runner.game.state.pieces[0]}));
    await page.keyboard.press('d');await page.clock.runFor(100); // Left wrist, sweep right: clockwise.
    const turned=await page.evaluate(()=>({...window.mdRoom.runner.game.state.pieces[0]}));
    if(turned.id===before.id){expect(turned.turn).toBe(before.turn+1);expect(turned.moves).toBe(1);}
    else expect(await page.evaluate(()=>window.mdRoom.runner.game.state.fitted)).toBe(1);
    await page.clock.runFor(800);
    const piece=await page.evaluate(()=>({...window.mdRoom.runner.game.state.pieces[0]}));
    await page.keyboard.press('i');await page.clock.runFor(100); // Right wrist, raise: flip over.
    const flipped=await page.evaluate(()=>({...window.mdRoom.runner.game.state.pieces[0]}));
    if(flipped.id===piece.id){expect(flipped.mirror).toBe(!piece.mirror);expect(flipped.turn).toBe(-piece.turn);}
});

test('Material boards and cards fit phones and landscape without stretching game rules',async({page})=>{
    for(const engine of ENGINES){
        await page.setViewportSize({width:320,height:640});
        await page.locator(`[data-game=material-${engine}]`).click();
        await page.locator('#arcade-guide').click();
        const figure=await page.locator('.guide-figure').boundingBox(),nav=await page.locator('.guide-nav').boundingBox();
        expect(figure.y+figure.height).toBeLessThanOrEqual(nav.y+1);
        await page.locator('[data-guide-skip]').click();await page.locator('#arcade-no-camera').click();
        for(const size of [{width:320,height:640},{width:390,height:844},{width:740,height:360}]){
            await page.setViewportSize(size);await page.clock.runFor(64);
            expect(await page.locator('#arcade-player').evaluate(e=>[e.scrollWidth,e.clientWidth+1]).then(([a,b])=>a<=b?true:`${a}>${b} at ${size.width}`)).toBe(true);
            if(size.width<400)expect(await page.locator('#arcade-canvas').evaluate(c=>c.height)).toBeGreaterThan(840);
            for(const button of await page.locator('[data-arcade-input]').all()){
                const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
            }
        }
        await page.locator('#arcade-close').click();
    }
});

for(const [engine,result] of [['tangram','Game over'],['golf','Time up'],['balance','Game over']]){
    test(`an unattended ${engine} run ends with ${result}, versioned scores, a challenge link and replay`,async({page})=>{
        await page.locator(`[data-game=material-${engine}]`).click();
        await page.locator('#arcade-no-camera').click();
        for(let i=0;i<20&&await page.locator('#arcade-player').getAttribute('data-phase')!=='finished';i++)await page.clock.runFor(10000);
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
        await expect(page.locator('#arcade-result')).toContainText(result);
        await page.locator('#arcade-name').fill('PAPER');await page.locator('#arcade-save-score').click();
        await page.locator('#arcade-challenge-friend').click();
        const link=await page.locator('#arcade-challenge-link').inputValue();
        const target=JSON.parse(new URLSearchParams(new URL(link).hash.split('?')[1]).get('challenge'));
        expect(target.game).toBe(`material-${engine}`);expect(target.rules).toBe(2);
        await page.locator('#arcade-again').click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
    });
}

test('the Material room bundles Roboto and keeps its paper materials in dark mode',async({page})=>{
    await page.emulateMedia({colorScheme:'dark'});
    await page.evaluate(()=>localStorage.setItem('appearance','dark'));
    await page.reload();await page.locator('[data-game=material-balance]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    const typography=await page.evaluate(async()=>{
        await document.fonts.load('500 24px "Roboto"');
        const style=getComputedStyle(document.body);
        return {display:style.getPropertyValue('--arcade-display'),loaded:document.fonts.check('500 24px "Roboto"'),
            header:getComputedStyle(document.querySelector('.arcade-room-header')).backgroundColor,
            accent:style.getPropertyValue('--accent').trim()};
    });
    expect(typography.display).toContain('Roboto');expect(typography.loaded).toBe(true);
    expect(typography.accent).toBe('#c6b4ff');expect(typography.header).toBe('rgb(198, 180, 255)');
    await page.locator('#arcade-guide').click();
    await expect(page.locator('.guide-caption')).toContainText('left tray');
});
});

// Visual review pass: each game in play at desktop and phone size, light and dark, plus every tutorial card.
test.describe('material screenshots',()=>{
    test.skip(!SHOTS,'Set MATERIAL_SHOTS to a folder to capture review screenshots');
    test.setTimeout(240000);
    const play={
        tangram:async page=>{
            for(const key of ['d','a','d']){await page.keyboard.press(key);await page.clock.runFor(1100);}
            await page.evaluate(()=>{const s=window.mdRoom.runner.game.state;s.fitted=13;s.stage=2;s.combo=2;s.pieces=[];});
            await page.clock.runFor(400);await page.keyboard.press('a');await page.clock.runFor(1500);
        },
        golf:async page=>{
            await page.evaluate(()=>{const s=window.mdRoom.runner.game.state;s.holes=6;s.stage=2;s.hole={cells:['grass','grass','pad','grass','water','grass','grass','water','grass','grass'],par:4};s.ball=0;});
            await page.keyboard.press('ArrowLeft');await page.clock.runFor(1500);
        },
        balance:async page=>{
            await page.keyboard.press('ArrowLeft');await page.clock.runFor(1200);await page.keyboard.press('ArrowRight');await page.clock.runFor(1200);
            await page.keyboard.press('ArrowLeft');await page.clock.runFor(1400);
        }
    };
    const layouts=[['desktop',{viewport:{width:1365,height:1000}}],['phone',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],
        ['landscape',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]];
    for(const [label,options] of layouts)test.describe(label,()=>{
        test.use(options);
        for(const mode of ['light','dark'])test(`${mode} ${label}`,async({page})=>{
            await page.emulateMedia({colorScheme:mode});
            await open(page);await page.evaluate(m=>localStorage.setItem('appearance',m),mode);await page.reload();
            await exposeRoom(page);
            for(const engine of ENGINES){
                await page.locator(`[data-game=material-${engine}]`).click();
                await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
                await page.locator('#arcade-guide').click();
                for(let step=1;step<=3;step++){
                    await page.clock.runFor(1400);
                    await page.screenshot({path:`${SHOTS}/${engine}-card${step}-${mode}-${label}.png`});
                    await page.locator('[data-guide-next]').click();
                }
                await page.locator('#arcade-no-camera').click();await page.clock.runFor(600);
                await play[engine](page);
                await page.screenshot({path:`${SHOTS}/${engine}-play-${mode}-${label}.png`});
                await page.locator('#arcade-canvas').screenshot({path:`${SHOTS}/${engine}-canvas-${mode}-${label}.png`});
                await page.evaluate(()=>window.mdRoom.runner.finish('Game over'));await page.clock.runFor(300);
                await page.screenshot({path:`${SHOTS}/${engine}-result-${mode}-${label}.png`});
                await page.locator('#arcade-close').click();
            }
        });
    });
});

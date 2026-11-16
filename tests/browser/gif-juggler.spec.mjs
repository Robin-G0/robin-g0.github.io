import { test, expect } from '@playwright/test';

test.beforeEach(async ({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',route=>route.abort());
    await page.goto('/?theme=construction#arcade');
});

test('original GIF companions and simulation-clock sprites animate and respect reduced motion',async ({page})=>{
    const result=await page.evaluate(async()=>{
        const {Painter,loadArtwork}=await import('/arcade/core/painter.js?v=juggler-27');
        const {drawJugglerSprite}=await import('/arcade/games/gif-juggler-art.js?v=juggler-27');
        const images=await loadArtwork('construction');
        const canvas=document.createElement('canvas');canvas.width=canvas.height=112;
        const p=new Painter(canvas.getContext('2d'),{font:'Arial'},images);
        const frames=[];
        for(const name of ['floppy','globe','mail','ball','slow','net']){
            const draw=(time,reduced)=>{
                p.c.clearRect(0,0,112,112);drawJugglerSprite(p,name,56,56,96,time,reduced);
                return canvas.toDataURL();
            };
            const response=await fetch(`/assets/art/juggler-${name}.gif`);
            const bytes=new Uint8Array(await response.arrayBuffer());
            frames.push({name,loaded:images.has(`juggler-${name}`),gif:String.fromCharCode(...bytes.slice(0,6)),
                animated:draw(0,false)!==draw(.24,false),still:draw(0,true)===draw(.24,true)});
        }
        return frames;
    });
    for(const item of result){
        expect(item.loaded,item.name).toBe(true);expect(item.gif).toBe('GIF89a');
        expect(item.animated,item.name).toBe(true);expect(item.still,item.name).toBe(true);
    }
});

test('Juggler runs with L/R lifts, local feedback and freezes its painted board on pause',async ({page})=>{
    await page.locator('[data-game=construction-juggle]').click();
    await page.locator('#arcade-no-camera').click();
    await expect(page.locator('[data-arcade-input=left] .action-key')).toHaveText('L');
    await expect(page.locator('[data-arcade-input=right] .action-key')).toHaveText('R');
    await page.clock.runFor(1100);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#arcade-score')).toHaveText('0');
    await page.clock.runFor(500);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#arcade-score')).not.toHaveText('0');
    await expect(page.locator('#arcade-playfield-input')).toBeEmpty();
    await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
    await page.locator('#arcade-pause').click();
    await page.clock.runFor(64);
    const frozen=await page.locator('#arcade-canvas').evaluate(canvas=>canvas.toDataURL());
    await page.clock.runFor(1000);
    expect(await page.locator('#arcade-canvas').evaluate(canvas=>canvas.toDataURL())).toBe(frozen);
    await page.locator('#arcade-resume').click();
    await page.clock.runFor(250);
    expect(await page.locator('#arcade-canvas').evaluate(canvas=>canvas.toDataURL())).not.toBe(frozen);
    await page.locator('#arcade-help').click();
    await expect(page.locator('#arcade-lesson-tip')).toHaveText(/x2/);
});

test('running out of lives reports Game over rather than a connection failure',async ({page})=>{
    await page.locator('[data-game=construction-juggle]').click();
    await page.locator('#arcade-no-camera').click();
    await page.clock.runFor(16000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await expect(page.locator('#arcade-result h3')).toHaveText('Game over');
});

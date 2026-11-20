import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.addInitScript(()=>{
        window.gamePaints=0;window.mapLabels=0;
        const clear=CanvasRenderingContext2D.prototype.clearRect,text=CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='arcade-canvas')window.gamePaints++;return clear.apply(this,args);};
        CanvasRenderingContext2D.prototype.fillText=function(...args){if(this.canvas.id!=='arcade-canvas'&&['START','END'].includes(args[0]))window.mapLabels++;return text.apply(this,args);};
    });
});
async function open(page,game='popups'){
    await page.goto('/?theme=construction#arcade');await page.locator('[data-game=construction-'+game+']').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    await page.evaluate(()=>window.motionTest.observe());
    await page.evaluate(async()=>{const{loadArtwork}=await import('./arcade/core/painter.js?v=pressure-19');await loadArtwork('construction');});
    await page.clock.runFor(64);
}
test('idle canvases stop repainting while hands-free resume and active-rate inference remain available',async({page})=>{
    await open(page);expect(await page.evaluate(()=>window.motionTest.fps)).toBe(10);
    await page.evaluate(()=>window.gamePaints=0);await page.clock.runFor(1000);expect(await page.evaluate(()=>window.gamePaints)).toBe(0);
    await page.locator('#arcade-begin').click();expect(await page.evaluate(()=>window.motionTest.fps)).toBe(20);
    const start=await page.evaluate(()=>{window.gamePaints=0;return performance.now();});await page.clock.runFor(1000);
    const sample=await page.evaluate(start=>({paints:window.gamePaints,elapsed:performance.now()-start}),start);
    expect(sample.paints).toBeGreaterThan(45);expect(sample.paints).toBeLessThanOrEqual(Math.ceil(sample.elapsed*60/1000)+1);
    await page.locator('#arcade-pause').click();await page.clock.runFor(32);
    expect(await page.evaluate(()=>window.motionTest.fps)).toBe(10);
    await page.evaluate(()=>window.gamePaints=0);await page.clock.runFor(1000);expect(await page.evaluate(()=>window.gamePaints)).toBe(0);
    await page.evaluate(()=>window.motionTest.gesture('left'));await page.clock.runFor(3300);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');expect(await page.evaluate(()=>window.motionTest.fps)).toBe(20);
});
test('the memorisation tree is cached while its sprites animate and inference stays at the idle rate',async({page})=>{
    await open(page,'maze');await page.locator('#arcade-begin').click();await page.clock.runFor(64);
    expect(await page.evaluate(()=>window.motionTest.fps)).toBe(10);
    await page.evaluate(()=>window.mapLabels=0);await page.clock.runFor(1000);
    expect(await page.evaluate(()=>window.mapLabels)).toBe(0);
    await page.clock.runFor(8500);await expect(page.locator('#arcade-player')).toHaveAttribute('data-maze-stage','navigate');
    expect(await page.evaluate(()=>window.motionTest.fps)).toBe(20);
});
test('covered Glass effects stop during play and restore when the game closes',async({page})=>{
    await page.emulateMedia({colorScheme:'dark'});await page.addInitScript(()=>localStorage.setItem('appearance','dark')); // the ocean loop is the night Glass portfolio
    await page.goto('/?theme=glass#arcade');
    const background=()=>page.locator('.about').evaluate(e=>getComputedStyle(e).backgroundImage);
    const before=await background();expect(before).toContain('glass-ocean-water-loop');
    await page.locator('.arcade-play').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-arcade-open','true');expect(await background()).toBe('none');
    expect(await page.locator('.aurora-layer').first().evaluate(e=>getComputedStyle(e).animationPlayState)).toBe('paused');
    await page.locator('#arcade-close').click();await expect(page.locator('html')).not.toHaveAttribute('data-arcade-open','true');
    expect(await background()).toBe(before);
});

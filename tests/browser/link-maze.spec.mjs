import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { generateMaze, LINK_EFFECTS } from '../../arcade/games/link-maze-map.js';
import { seededRandom } from '../../arcade/core/random.js';
const seed=1700000000123;
const firstMap=()=>generateMaze(seededRandom(seed>>>0),1);

test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
});
async function open(page,camera=false){
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>camera?r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'
    }):r.abort());
    await page.goto('/?theme=construction#arcade');
    await page.evaluate(value=>Date.now=()=>value,seed);
    await page.locator('[data-game=construction-maze]').click();
    if(camera){await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');await page.evaluate(()=>window.motionTest.observe());}
    await page.locator('#arcade-begin').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-maze-stage','preview');
}

test('memory preview, link highlights, time reward and fresh next map form one continuous round',async({page})=>{
    await open(page);
    await expect(page.locator('#arcade-time')).toHaveText('45s');
    await page.keyboard.press('ArrowLeft');await page.clock.runFor(1500);
    await expect(page.locator('#arcade-score')).toHaveText('0');await expect(page.locator('#arcade-time')).toHaveText('45s');
    await page.clock.runFor(8000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-maze-stage','navigate');
    await page.locator('#arcade-canvas').evaluate(canvas=>{
        const c=canvas.getContext('2d'),arc=c.arc.bind(c);window.mazeRings=0;
        c.arc=(...args)=>{window.mazeRings++;return arc(...args);};
    });
    const map=firstMap(),first=map.shortRoute[0];
    await page.keyboard.press(first?'ArrowRight':'ArrowLeft');await page.clock.runFor(100);
    const pixel=await page.locator('#arcade-canvas').evaluate((canvas,side)=>{
        const c=canvas.getContext('2d'),h=canvas.height/2;
        return [...c.getImageData((side?390:50)*2,(Math.max(132,Math.round(h*.28))+10)*2,1,1).data].slice(0,3);
    },first);
    const hex=LINK_EFFECTS[map.nodes[map.route[1]].effect].color;
    expect(pixel).toEqual([1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
    expect(await page.evaluate(()=>window.mazeRings)).toBe(0);
    await expect(page.locator('#arcade-playfield-input')).not.toBeVisible();
    for(const side of map.shortRoute.slice(1)){await page.keyboard.press(side?'ArrowRight':'ArrowLeft');await page.clock.runFor(100);}
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-maze-stage','arrival');
    expect(Number((await page.locator('#arcade-time').textContent()).replace('s',''))).toBeGreaterThan(45);
    await page.clock.runFor(1500);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-maze-stage','preview');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-maze-level','2');
    const time=await page.locator('#arcade-time').textContent();
    await page.locator('#arcade-pause').click();await page.clock.runFor(5000);
    await expect(page.locator('#arcade-time')).toHaveText(time);
});

test('mobile maze fits, remains legible and does not move when a link changes colour',async({page})=>{
    await page.setViewportSize({width:320,height:740});await open(page);
    await page.clock.runFor(9600);
    await page.locator('#arcade-player').evaluate(d=>d.scrollTop=0);
    const before=await page.locator('.arcade-stage').boundingBox();
    expect(before.height).toBeGreaterThanOrEqual(340);
    expect(before.height).toBeLessThanOrEqual(500);
    await expect(page.locator('[data-arcade-input=left] .action-key')).toHaveText('L');
    await expect(page.locator('[data-arcade-input=right] .action-key')).toHaveText('R');
    await expect(page.locator('[data-arcade-input=left] .action-name')).toHaveText('Raise left wrist');
    await page.keyboard.press('ArrowLeft');await page.clock.runFor(100);
    const after=await page.locator('.arcade-stage').boundingBox();expect(after).toEqual(before);
    const size=await page.locator('#arcade-player').evaluate(d=>({width:d.clientWidth,content:d.scrollWidth}));
    expect(size.content).toBeLessThanOrEqual(size.width+1);
    const button=await page.locator('[data-arcade-input=left]').boundingBox();expect(button.height).toBeGreaterThanOrEqual(44);
    const camera=await page.locator('#arcade-camera-dock').boundingBox();expect(camera.y).toBeGreaterThanOrEqual(after.y+after.height);
});

test('desktop maze has a portrait board and explains wrist raises in Controls',async({page})=>{
    await open(page);
    const board=await page.locator('.arcade-stage').boundingBox();
    expect(board.width).toBeLessThanOrEqual(620);
    expect(board.height).toBeLessThanOrEqual(560);
    await page.locator('#arcade-help').click();
    await expect(page.locator('[data-tutorial-action=left]')).toHaveText('Raise left wrist');
    await expect(page.locator('[data-tutorial-action=right]')).toHaveText('Raise right wrist');
});

test('native MIG wrist events navigate the remembered route without another camera recognizer',async({page})=>{
    await open(page,true);await page.clock.runFor(9600);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-maze-stage','navigate');
    for(const side of firstMap().shortRoute){
        await page.evaluate(action=>window.motionTest.gesture(action),side?'right':'left');
        await page.clock.runFor(250);
    }
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-maze-stage','arrival');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
});

test('original powerup art animates in the map and freezes visually for reduced motion',async({page})=>{
    await open(page);
    await page.evaluate(async()=>{const {loadArtwork}=await import('./arcade/core/painter.js?v=power-11');await loadArtwork('construction');});
    await page.clock.runFor(32);
    const checksum=()=>page.locator('#arcade-canvas').evaluate(canvas=>{
        const data=canvas.getContext('2d').getImageData(0,180,canvas.width,canvas.height-180).data;
        let hash=2166136261;for(const value of data)hash=Math.imul(hash^value,16777619);return hash>>>0;
    });
    const before=await checksum();await page.clock.runFor(250);expect(await checksum()).not.toBe(before);
    await expect(page.locator('#arcade-time')).toHaveText('45s');
    await page.locator('#arcade-close').click();await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('[data-game=construction-maze]').click();await page.locator('#arcade-begin').click();await page.clock.runFor(32);
    const still=await checksum();await page.clock.runFor(250);expect(await checksum()).toBe(still);
});

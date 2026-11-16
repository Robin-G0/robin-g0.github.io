import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
test.beforeEach(async({page})=>{
    await page.clock.install();
    await page.addInitScript(()=>{
        const Original=window.AudioContext;window.openedAudio=[];
        if(Original)window.AudioContext=new Proxy(Original,{construct(Target,args){
            const context=new Target(...args);window.openedAudio.push(context);return context;
        }});
    });
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto('/?theme=construction#arcade');
});
test('repeated room exits stop tracks, audio contexts, camera callbacks and release the canvas backing store',async({page})=>{
    for(let i=0;i<5;i++){
        await page.locator('[data-game=construction-popups]').click();
        await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
        await page.locator('#arcade-begin').click();await page.clock.runFor(100);
        await page.locator('#arcade-close').click();
    }
    const frames=await page.evaluate(()=>window.cameraResources.frames);
    await page.clock.runFor(1500);
    expect(await page.evaluate(()=>({created:cameraResources.created,disposed:cameraResources.disposed,
        ended:cameraResources.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended')),
        frames:cameraResources.frames,source:document.querySelector('#arcade-video').srcObject,
        canvas:document.querySelector('#arcade-canvas').width}))).toEqual({created:5,disposed:5,ended:true,frames,source:null,canvas:1});
    await expect.poll(()=>page.evaluate(()=>window.openedAudio.every(context=>context.state==='closed'))).toBe(true);
});
test('results stop camera work and a hidden tab releases capture without resuming play on return',async({page})=>{
    await page.locator('[data-game=construction-juggle]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    await page.locator('#arcade-begin').click();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','paused');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','off');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','live');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','paused');
    await page.locator('#arcade-resume').click();await page.clock.runFor(16000);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','finished');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera','off');
    const frames=await page.evaluate(()=>cameraResources.frames);await page.clock.runFor(1000);
    expect(await page.evaluate(()=>cameraResources.frames)).toBe(frames);
});

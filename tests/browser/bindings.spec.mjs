import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {constructionLiftProfile} from '../../arcade/mig/profile.js';

const profile=structuredClone(constructionLiftProfile);
profile.inputs[0].id='raise-a';profile.inputs[0].name='Custom raise A';profile.inputs[0].action='anything';
profile.inputs[1].id='raise-b';profile.inputs[1].name='Custom raise B';
const file={name:'my-bindings.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(profile))};
test.beforeEach(async({page})=>{
    await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',route=>route.fulfill({
        path:fileURLToPath(new URL('./fixtures/camera-session.mjs',import.meta.url)),contentType:'text/javascript'}));
    await page.goto('/?theme=construction#arcade');
});

test('native-validated configuration imports without starting camera, maps controls and persists',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.evaluate(()=>{
        const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
        window.bindingURLs=new Set();
        URL.createObjectURL=blob=>{const url=create(blob);window.bindingURLs.add(url);return url;};
        URL.revokeObjectURL=url=>{window.bindingURLs.delete(url);revoke(url);};
    });
    await page.locator('#arcade-import-file').setInputFiles(file);
    await expect(page.locator('#arcade-import-status')).toContainText('2 bindings loaded');
    expect(await page.evaluate(()=>window.cameraResources)).toBeUndefined();
    await expect(page.locator('#arcade-games .arcade-card')).toHaveCount(3);
    await page.locator('[data-game=construction-popups]').click();
    await page.locator('#arcade-bindings').click();
    await expect(page.locator('[data-bind-control]')).toHaveCount(6);
    await page.locator('[data-bind-control=left_up]').selectOption('raise-b');
    await page.locator('#arcade-binding-apply').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-bindings','custom');
    expect(await page.evaluate(()=>window.motionTest.profile.inputs.find(i=>i.action==='left_up').steps[0].constraints[0].landmark)).toBe('right_wrist');
    await page.locator('#arcade-begin').click();
    await page.evaluate(()=>window.motionTest.raw('left_up'));
    await expect(page.locator('#arcade-score')).toHaveText('10');
    await page.locator('#arcade-bindings').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','paused');
    await page.locator('#arcade-pause').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','paused');
    await page.locator('#arcade-binding-cancel').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase','playing');
    await page.locator('#arcade-close').click();
    expect(await page.evaluate(()=>window.bindingURLs.size)).toBe(0);
    await page.reload();
    await page.locator('[data-game=construction-popups]').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-bindings','custom');
    await page.locator('#arcade-bindings').click();
    await expect(page.locator('[data-bind-control=left_up]')).toHaveValue('raise-b');
    await page.locator('#arcade-binding-defaults').click();
    await page.locator('#arcade-binding-apply').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-bindings','default');
    expect(errors).toEqual([]);
});

test('mobile mapping editor fits, invalid import preserves choices and tutorial explains custom bindings',async({page})=>{
    await page.setViewportSize({width:320,height:740});
    await page.locator('[data-game=construction-maze]').click();
    await page.locator('#arcade-bindings').click();
    await page.locator('#arcade-binding-file').setInputFiles(file);
    await expect(page.locator('#arcade-binding-source')).toHaveText('my-bindings.json');
    await page.locator('[data-bind-control=left]').selectOption('raise-b');
    await page.locator('#arcade-binding-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    await expect(page.locator('#arcade-binding-status')).toContainText('MIG configuration');
    await expect(page.locator('[data-bind-control=left]')).toHaveValue('raise-b');
    const sizes=await page.locator('#arcade-binding-panel').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.client+1);
    await page.screenshot({path:'../arcade-review/binding-editor-mobile.png'});
    await page.locator('#arcade-binding-apply').click();
    await page.locator('#arcade-guide').click();
    await expect(page.locator('.guide-figure')).toContainText('Custom raise B');
    await expect(page.locator('.guide-caption')).toContainText('assigned bindings');
    await page.screenshot({path:'../arcade-review/bindings-mobile.png'});
});

test('closing the editor does not leak into another game and calibrated bindings get an honest preview notice',async({page})=>{
    await page.locator('[data-game=construction-maze]').click();
    await page.locator('#arcade-bindings').click();
    await page.locator('#arcade-close').click();
    await page.locator('[data-game=construction-juggle]').click();
    await expect(page.locator('#arcade-binding-panel')).not.toBeVisible();
    await page.locator('#arcade-bindings').click();
    const calibrated=structuredClone(profile);calibrated.inputs[0].space='calibrated';
    await page.locator('#arcade-binding-file').setInputFiles({...file,buffer:Buffer.from(JSON.stringify(calibrated))});
    await expect(page.locator('#arcade-binding-source')).toHaveText('my-bindings.json');
    await page.locator('[data-bind-control=left]').selectOption('raise-a');
    await page.locator('#arcade-binding-apply').click();
    await expect(page.locator('.camera-positioning')).toContainText('no body preview');
    await page.evaluate(()=>window.motionTest.observe());
    await expect(page.locator('#arcade-trigger-zones [data-trigger=left]')).toHaveCount(0);
    await expect(page.locator('#arcade-trigger-zones [data-trigger=right]')).toHaveCount(1);
});

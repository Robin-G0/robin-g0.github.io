import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// These tests run the real package and models with synthetic media. They do not
// measure real-world pose accuracy, lighting tolerance or physical comfort.
test.beforeEach(async ({ page }) => {
    await page.route('https://raw.githubusercontent.com/**', route => route.abort());
    await page.goto('/?theme=aero#arcade');
});

test('camera refusal leaves keyboard play available', async ({ page }) => {
    test.setTimeout(90000);
    await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = async () => {
            throw new DOMException('Permission denied', 'NotAllowedError');
        };
    });
    await page.locator('.arcade-play').first().click();
    await expect(page.locator('#arcade-camera-status')).toContainText('Camera unavailable', { timeout: 60000 });
    await page.locator('#arcade-begin').click();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing');
});

test('blank camera keeps play running without a pause menu and releases the stream on exit', async ({ page }) => {
    test.setTimeout(90000);
    await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 640; canvas.height = 480;
            const context = canvas.getContext('2d');
            context.fillStyle = '#888'; context.fillRect(0, 0, 640, 480);
            const stream = canvas.captureStream(30);
            window.testCameraTrack = stream.getVideoTracks()[0];
            window.testCameraCanvas = canvas;
            return stream;
        };
    });
    await page.locator('.arcade-play').first().click();
    await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('#arcade-video').srcObject)),
        { timeout: 60000 }).toBe(true);
    await page.locator('#arcade-begin').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-tracking', 'missing', { timeout: 10000 });
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing');
    await expect(page.locator('#arcade-paused')).not.toBeVisible();
    const time = await page.locator('#arcade-time').textContent();
    await page.waitForTimeout(1200);
    expect(parseInt(await page.locator('#arcade-time').textContent())).toBeGreaterThan(parseInt(time));
    await page.locator('#arcade-close').click();
    expect(await page.evaluate(() => window.testCameraTrack.readyState)).toBe('ended');
    expect(await page.locator('#arcade-video').evaluate(video => video.srcObject)).toBe(null);
});

test('closing while package loading cannot reopen the camera', async ({ page }) => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/vendor/motion-input-grid/src/index.mjs', async route => {
        await gate; await route.continue();
    });
    await page.evaluate(() => {
        window.cameraAttempts = 0;
        navigator.mediaDevices.getUserMedia = async () => { window.cameraAttempts++; throw new Error('Unexpected request'); };
    });
    await page.locator('.arcade-play').first().click();
    await page.locator('#arcade-close').click();
    release();
    await expect(page.locator('#arcade-player')).not.toBeVisible();
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.cameraAttempts)).toBe(0);
});

test('rapid start-stop-start keeps only the latest camera request', async ({ page }) => {
    test.setTimeout(90000);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/vendor/motion-input-grid/src/index.mjs', async route => {
        await gate; await route.continue();
    });
    await page.evaluate(() => {
        window.cameraAttempts = 0;
        navigator.mediaDevices.getUserMedia = async () => {
            window.cameraAttempts++;
            throw new DOMException('Permission denied', 'NotAllowedError');
        };
    });
    const button = page.locator('#arcade-camera');
    await page.locator('.arcade-play').first().click();
    await button.click(); await button.click();
    release();
    await expect(page.locator('#arcade-camera-status')).toContainText('Camera unavailable', { timeout: 60000 });
    await expect(button).toHaveText('Retry camera');
    expect(await page.evaluate(() => window.cameraAttempts)).toBe(1);
});

async function openObservedCamera(page) {
    await page.route('**/vendor/motion-input-grid/src/index.mjs', route => route.fulfill({
        path: fileURLToPath(new URL('./fixtures/camera-session.mjs', import.meta.url)), contentType: 'text/javascript'
    }));
    await page.locator('.arcade-play').first().click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera', 'live');
}

test('popup controls accept six directions without a home gate and lights acknowledge moves', async ({ page }) => {
    await page.goto('/?theme=construction#arcade');
    await openObservedCamera(page);
    await page.evaluate(() => window.motionTest.observe());
    await page.locator('#arcade-begin').click();
    await expect(page.locator('[data-arcade-input]')).toHaveCount(6);
    await page.evaluate(() => window.motionTest.raw('left_up'));
    await expect(page.locator('#arcade-score')).toHaveText('10');
    await expect(page.locator('[data-wrist-controls=left]')).toHaveAttribute('data-pulse', 'true');
    await expect(page.locator('#arcade-recognition')).toHaveText('L ↑');
    await page.waitForTimeout(220); // A new move by the same wrist clears its short cooldown.
    await page.evaluate(() => window.motionTest.raw('left_right'));
    await expect(page.locator('#arcade-score')).toHaveText('23');
    // The identical arrow in the other stack still exists.
    await page.evaluate(() => window.motionTest.gesture('right_up'));
    await expect(page.locator('#arcade-score')).toHaveText('38');
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-wrist-controls=left]')).toHaveAttribute('data-pulse', 'false');
    for (const [key, label] of [['a', 'L ←'], ['d', 'L →'], ['j', 'R ←'], ['l', 'R →']]) {
        await page.keyboard.press(key);
        await expect(page.locator('#arcade-recognition')).toHaveText(label);
    }
    expect(Number(await page.locator('#arcade-score').textContent())).toBeGreaterThan(100);
});

test('popup camera guides and downloaded profile use the higher Up and side bands', async ({ page }) => {
    await page.goto('/?theme=construction#arcade');
    await openObservedCamera(page);
    await page.evaluate(() => window.motionTest.observe());
    const profile = await page.locator('#arcade-player a[download]').getAttribute('href');
    expect(profile).toContain('popup-directions.json');
    const response = await page.request.get(profile);
    const inputs = (await response.json()).inputs;
    expect(await page.evaluate(() => window.motionTest.profile.inputs)).toEqual(inputs);
    const sideCells={left_left:[9,1,9,17],left_right:[-9,1,14,17],
        right_left:[4,1,14,17],right_right:[-9,1,9,17]};
    for(const [action,cell] of Object.entries(sideCells)) {
        const constraints=inputs.find(input=>input.action===action).steps[0].constraints;
        expect(constraints.every(constraint=>JSON.stringify(constraint.cell)===JSON.stringify(cell))).toBe(true);
    }
    // The mock's active state is indexed by the profile actually imported into MIG.
    await page.evaluate(() => window.motionTest.raw('right_left'));
    await expect(page.locator('[data-trigger=right_left]')).toHaveAttribute('data-active','true');
    const polygons = await page.locator('#arcade-trigger-zones [data-trigger]').evaluateAll(groups =>
        Object.fromEntries(groups.map(g => [g.dataset.trigger, Array.from(g.querySelector('polygon').points,p=>({x:p.x,y:p.y}))])));
    for(const wrist of ['left','right']){
        const up=polygons[`${wrist}_up`],side=polygons[`${wrist}_left`];
        const upBottom=Math.max(...up.map(p=>p.y)),sideTop=Math.min(...side.map(p=>p.y));
        expect(upBottom).toBeCloseTo(sideTop, 6);
        expect(upBottom).toBeCloseTo(150,0); // shoulders y=.35, scale=.06, Up ends at cell 1
        expect(sideTop).toBeCloseTo(150,0); // side band touches Up at cell 1
        expect(inputs.find(i=>i.action===`${wrist}_up`).steps[0].constraints[0].cell).toEqual([-9,-9,27,10]);
    }
    await page.locator('#arcade-close').click();
    await page.locator('[data-game=construction-maze]').click();
    expect(await page.locator('#arcade-player a[download]').getAttribute('href')).toContain('construction-lifts.json');
    for(const engine of ['maze','juggle']) {
        if(engine==='juggle') {
            await page.locator('#arcade-close').click();
            await page.locator('[data-game=construction-juggle]').click();
        }
        await page.evaluate(()=>window.motionTest.observe());
        const download=await page.request.get(await page.locator('#arcade-player a[download]').getAttribute('href'));
        const profile=await download.json();
        expect(await page.evaluate(()=>window.motionTest.profile)).toEqual(profile);
        expect(profile.inputs.map(input=>input.action)).toEqual(['left_up','right_up']);
        for(const input of profile.inputs) expect(input.steps[0].constraints[0].cell).toEqual([-9,-9,27,12]);
        await expect(page.locator('#arcade-trigger-zones [data-trigger]')).toHaveCount(2);
    }
});

test('preview and individual wrist feedback are visible before starting', async ({ page }) => {
    await openObservedCamera(page);
    const field = await page.locator('.arcade-stage').boundingBox();
    const camera = await page.locator('#arcade-camera-dock').boundingBox();
    expect(camera.y).toBeGreaterThanOrEqual(field.y + field.height);
    await page.locator('#arcade-camera-dock').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.motionTest.observe(true, 16));
    await expect(page.locator('[data-tracking=left]')).toHaveAttribute('data-visible', 'true');
    await expect(page.locator('[data-tracking=right]')).toHaveAttribute('data-visible', 'false');
    await expect(page.locator('[data-wrist=left]')).toBeVisible();
    await expect(page.locator('[data-wrist=right]')).not.toBeVisible();
    await expect(page.locator('#arcade-trigger-zones [data-trigger]')).toHaveCount(6); // School Rescue is a six-command game: three boxes per wrist.
    expect(await page.locator('[data-wrist=left]').evaluate(marker => marker.style.left)).toBe('30%');
    await page.evaluate(() => window.motionTest.stop());
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera', 'unavailable');
    await expect(page.locator('[data-tracking=left]')).toHaveAttribute('data-visible', 'false');
    await page.locator('#arcade-camera').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera', 'live');
});

test('torso-only tracking starts with either wrist and recovers without a menu', async ({ page }) => {
    await openObservedCamera(page);
    await expect(page.locator('#arcade-controls-status')).toHaveText('Say hi to start');
    await expect(page.locator('#arcade-practise, #arcade-ready')).toHaveCount(0);
    await page.evaluate(() => window.motionTest.observe(true, 16));
    await expect(page.locator('#arcade-controls-status')).toHaveText(/^[123]$/);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
    await expect(page.locator('#arcade-score')).toHaveText('0');
    await page.evaluate(() => window.motionTest.observe(false));
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-tracking', 'missing');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing');
    await expect(page.locator('#arcade-paused')).not.toBeVisible();
    await page.evaluate(() => window.motionTest.observe(true, 15));
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-tracking', 'ready');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing');
    await page.locator('#arcade-pause').click();
    await page.evaluate(() => window.motionTest.gesture('right'));
    await expect(page.locator('#arcade-countdown')).toHaveText(/^[123]$/);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
    await page.locator('#arcade-help').click();
    await page.evaluate(() => window.motionTest.gesture('right'));
    await expect(page.locator('#arcade-controls-status')).toHaveText(/^[123]$/);
    await page.evaluate(() => window.motionTest.observe(false));
    await expect(page.locator('#arcade-countdown')).toBeEmpty();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'tutorial');
});

test('keyboard-only mode starts immediately and stops the camera', async ({ page }) => {
    await openObservedCamera(page);
    await page.locator('#arcade-no-camera').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera', 'off');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing');
    expect(await page.locator('#arcade-video').evaluate(video => video.srcObject)).toBe(null);
});

test('keyboard input takes over during missing tracking and sound can be muted', async ({ page }) => {
    await openObservedCamera(page);
    await page.locator('#arcade-begin').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-tracking', 'missing');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-tracking', 'ready');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing');
    await page.locator('#arcade-sound').click();
    await expect(page.locator('#arcade-sound')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#arcade-sound').click();
    await expect(page.locator('#arcade-sound')).toHaveAttribute('aria-pressed', 'true');
});

test('Controls can be reopened without resetting score or consuming the resume gesture', async ({ page }) => {
    await page.goto('/?theme=construction#arcade');
    await openObservedCamera(page);
    await page.evaluate(() => window.motionTest.observe());
    await page.locator('#arcade-begin').click();
    await page.evaluate(() => window.motionTest.gesture('left'));
    await expect(page.locator('#arcade-score')).toHaveText('10');
    await expect(page.locator('#arcade-playfield-input')).toHaveText('L \u2191 +10');
    await page.locator('#arcade-help').click();
    await expect(page.locator('#arcade-tutorial')).toBeVisible();
    await expect(page.locator('#arcade-begin')).toHaveText('Resume');
    const time = await page.locator('#arcade-time').textContent();
    await page.waitForTimeout(200);
    await expect(page.locator('#arcade-time')).toHaveText(time);
    await page.evaluate(() => window.motionTest.gesture('right'));
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
    await expect(page.locator('#arcade-score')).toHaveText('10');
    await page.evaluate(() => window.motionTest.gesture('right'));
    await expect(page.locator('#arcade-score')).toHaveText('23');
});

test('playfield stays above camera and keeps its position as detection feedback changes', async ({ page }) => {
    for (const viewport of [{ width: 1365, height: 1000 }, { width: 320, height: 740 }]) {
        await page.setViewportSize(viewport);
        await page.goto('/?theme=construction#arcade');
        await openObservedCamera(page);
        await page.evaluate(() => window.motionTest.observe());
        await expect(page.locator('#arcade-begin')).toBeInViewport();
        await page.locator('#arcade-begin').click();
        await page.locator('#arcade-player').evaluate(dialog => dialog.scrollTop = 0);
        const field = page.locator('.arcade-stage');
        const before = await field.boundingBox();
        await page.evaluate(() => window.motionTest.gesture('left'));
        await expect(page.locator('#arcade-playfield-input')).toHaveText('L \u2191 +10');
        const detected = await field.boundingBox();
        expect(detected.y).toBeCloseTo(before.y, 1);
        expect(detected.height).toBeCloseTo(before.height, 1);
        await page.waitForTimeout(1900);
        await expect(page.locator('#arcade-recognition')).toBeEmpty();
        const cleared = await field.boundingBox();
        expect(cleared.y).toBeCloseTo(before.y, 1);
        const camera = await page.locator('#arcade-camera-dock').boundingBox();
        expect(camera.y).toBeGreaterThanOrEqual(cleared.y + cleared.height);
        await page.locator('#arcade-close').click();
    }
});

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
    await expect(page.locator('[data-arcade-input=left]')).toHaveAttribute('data-pulse', 'true');
});

test('blank camera pauses for tracking loss and releases the stream on exit', async ({ page }) => {
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
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'paused', { timeout: 10000 });
    await expect(page.locator('#arcade-camera-status')).toContainText('back into view');
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

test('preview and individual wrist feedback are visible before starting', async ({ page }) => {
    await openObservedCamera(page);
    const field = await page.locator('.arcade-stage').boundingBox();
    const camera = await page.locator('#arcade-camera-dock').boundingBox();
    expect(camera.y).toBeGreaterThanOrEqual(field.y + field.height);
    await page.locator('#arcade-camera-dock').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.motionTest.observe(true, 16));
    await expect(page.locator('[data-tracking=left] span')).toHaveText('Detected');
    await expect(page.locator('[data-tracking=right] span')).toHaveText('Not in view');
    await expect(page.locator('[data-wrist=left]')).toBeVisible();
    await expect(page.locator('[data-wrist=right]')).not.toBeVisible();
    expect(await page.locator('[data-wrist=left]').evaluate(marker => marker.style.left)).toBe('30%');
    await page.evaluate(() => window.motionTest.stop());
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera', 'unavailable');
    await expect(page.locator('[data-tracking=left] span')).toHaveText('Not in view');
    await page.locator('#arcade-camera').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera', 'live');
});

test('the controls window starts directly with a right-wrist gesture and resumes hands-free', async ({ page }) => {
    await openObservedCamera(page);
    await expect(page.locator('#arcade-tutorial')).toBeVisible();
    await expect(page.locator('#arcade-controls-status')).toContainText('RIGHT wrist');
    await expect(page.locator('#arcade-practise')).toHaveCount(0);
    await expect(page.locator('#arcade-ready')).toHaveCount(0);
    await page.evaluate(() => { window.motionTest.observe(); window.motionTest.gesture('left'); });
    await expect(page.locator('#arcade-countdown')).toBeEmpty();
    await page.evaluate(() => window.motionTest.gesture('right'));
    await expect(page.locator('#arcade-controls-status')).toContainText('Starting in');
    await expect(page.locator('#arcade-begin')).toHaveText('Cancel countdown');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
    await expect(page.locator('#arcade-tutorial')).not.toBeVisible();
    await expect(page.locator('#arcade-score')).toHaveText('0');
    await page.evaluate(() => window.motionTest.observe(false));
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'paused');
    await page.evaluate(() => { window.motionTest.observe(); window.motionTest.gesture('right'); });
    await expect(page.locator('#arcade-countdown')).toContainText('Resuming in');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
    await page.locator('#arcade-help').click();
    await page.evaluate(() => window.motionTest.gesture('right'));
    await expect(page.locator('#arcade-controls-status')).toContainText('Resuming in');
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

test('Controls can be reopened without resetting score or consuming the resume gesture', async ({ page }) => {
    await page.goto('/?theme=construction#arcade');
    await openObservedCamera(page);
    await page.evaluate(() => window.motionTest.observe());
    await page.locator('#arcade-begin').click();
    await page.evaluate(() => window.motionTest.gesture('left'));
    await expect(page.locator('#arcade-score')).toHaveText('10');
    await expect(page.locator('#arcade-playfield-input')).toHaveText('Close left +10');
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
    await expect(page.locator('#arcade-score')).toHaveText('20');
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
        await expect(page.locator('#arcade-playfield-input')).toHaveText('Close left +10');
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

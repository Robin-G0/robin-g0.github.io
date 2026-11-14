import { test, expect } from '@playwright/test';

// These tests run the real package and models with synthetic media. They do not
// measure real-world pose accuracy, lighting tolerance or physical comfort.
test.beforeEach(async ({ page }) => {
    await page.route('https://raw.githubusercontent.com/**', route => route.abort());
    await page.goto('/?theme=aero#arcade');
    await page.locator('.arcade-play').first().click();
});

test('camera refusal leaves keyboard play available', async ({ page }) => {
    test.setTimeout(90000);
    await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = async () => {
            throw new DOMException('Permission denied', 'NotAllowedError');
        };
    });
    await page.locator('#arcade-camera').click();
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
    await page.locator('#arcade-camera').click();
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
    await page.locator('#arcade-camera').click();
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
    await button.click(); await button.click(); await button.click();
    release();
    await expect(page.locator('#arcade-camera-status')).toContainText('Camera unavailable', { timeout: 60000 });
    await expect(button).toHaveText('Use camera');
    expect(await page.evaluate(() => window.cameraAttempts)).toBe(1);
});

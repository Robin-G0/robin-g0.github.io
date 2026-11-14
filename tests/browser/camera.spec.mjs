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
    await expect(page.locator('#arcade-video')).toBeInViewport();
    await expect(page.locator('#arcade-camera')).toBeInViewport();
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

test('MIG gestures start and resume with a countdown without becoming game moves', async ({ page }) => {
    await openObservedCamera(page);
    await page.evaluate(() => { window.motionTest.observe(); window.motionTest.gesture('left'); });
    await expect(page.locator('#arcade-countdown')).toContainText('Starting in');
    await expect(page.locator('#arcade-recognition')).toContainText('Left wrist recognised');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
    await expect(page.locator('#arcade-score')).toHaveText('0');
    await page.evaluate(() => window.motionTest.observe(false));
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'paused');
    await page.evaluate(() => { window.motionTest.observe(); window.motionTest.gesture('right'); });
    await expect(page.locator('#arcade-countdown')).toContainText('Resuming in');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
    await page.locator('#arcade-pause').click();
    await page.evaluate(() => window.motionTest.gesture('left'));
    await expect(page.locator('#arcade-countdown')).toContainText('Resuming in');
    await page.evaluate(() => window.motionTest.observe(false));
    await expect(page.locator('#arcade-countdown')).toBeEmpty();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'paused');
});

test('keyboard-only mode cancels camera startup and keeps a playable fallback', async ({ page }) => {
    await openObservedCamera(page);
    await page.locator('#arcade-no-camera').click();
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-camera', 'off');
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing');
    expect(await page.locator('#arcade-video').evaluate(video => video.srcObject)).toBe(null);
});

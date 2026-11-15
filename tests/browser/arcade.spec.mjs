import { test, expect } from '@playwright/test';
import { games } from '../../arcade/catalog.js';

async function startRound(page) {
    await page.locator('#arcade-begin').click();
}

test.beforeEach(async ({ page }) => {
    // A fixed local snapshot keeps external profile refreshes out of game tests.
    await page.route('https://raw.githubusercontent.com/**', route => route.abort());
    // Camera startup has its own real-package and synthetic-observation tests.
    await page.route('**/vendor/motion-input-grid/src/index.mjs', route => route.abort());
});

for (const theme of new Set(games.map(game => game.theme))) {
    test(`${theme}: all three games open, respond, pause and clean up`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`/?theme=${theme}#arcade`);
        await expect(page.locator('#arcade-games .arcade-card')).toHaveCount(3);
        for (const game of games.filter(game => game.theme === theme)) {
            await page.locator(`[data-game="${game.id}"]`).click();
            await expect(page.locator('#arcade-player')).toBeVisible();
            await expect(page.locator('#arcade-game-title')).toHaveText(game.title);
            await expect(page.locator('#arcade-tutorial')).toBeVisible();
            await startRound(page);
            await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight');
            await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing');
            await page.locator('#arcade-pause').click();
            const pausedTime = await page.locator('#arcade-time').textContent();
            await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(150);
            await expect(page.locator('#arcade-time')).toHaveText(pausedTime);
            await page.locator('#arcade-resume').click();
            await page.locator('#arcade-restart').click();
            await expect(page.locator('#arcade-score')).toHaveText('0');
            await page.locator('#arcade-help').click();
            await expect(page.locator('#arcade-tutorial')).toBeVisible();
            await page.locator('#arcade-close').click();
            await expect(page.locator('#arcade-player')).not.toBeVisible();
        }
        expect(errors).toEqual([]);
    });
}

test('mobile touch controls fit at 320 px and survive orientation changes', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    for (const theme of new Set(games.map(game => game.theme))) {
        await page.goto(`/?theme=${theme}#arcade`);
        await page.locator('.arcade-play').first().click();
        const lesson = await page.locator('#arcade-controls-status').boundingBox();
        const stage = await page.locator('.arcade-stage').boundingBox();
        expect(lesson.x + lesson.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
        await startRound(page);
        const left = page.locator('[data-arcade-input]').first();
        const box = await left.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        await left.click();
        const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth,
            viewport: document.documentElement.clientWidth,
            dialog: document.querySelector('#arcade-player').scrollWidth,
            dialogClient: document.querySelector('#arcade-player').clientWidth }));
        expect(width.content).toBeLessThanOrEqual(width.viewport + 1);
        expect(width.dialog).toBeLessThanOrEqual(width.dialogClient + 1);
        await page.locator('#arcade-close').click();
    }
    await page.setViewportSize({ width: 740, height: 320 });
    await page.locator('.arcade-play').first().click();
    await startRound(page);
    await expect(page.locator('#arcade-player')).toHaveAttribute('data-phase', 'playing');
});

test('imports open declarative games and reject executable fields', async ({ page }) => {
    await page.goto('/?theme=glass#arcade');
    const input = page.locator('#arcade-import-file');
    const description = { schema_version: 1, id: 'test-snake', engine: 'snake',
        title: 'Imported Snake', goal: 'Collect signals.', seed: 7 };
    await input.setInputFiles({ name: 'snake.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(description)) });
    await expect(page.locator('#arcade-game-title')).toHaveText('Imported Snake');
    await page.locator('#arcade-close').click();
    await input.setInputFiles({ name: 'unsafe.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...description, script: 'alert(1)' })) });
    await expect(page.locator('#arcade-import-status')).toContainText('unsupported fields');
    await expect(page.locator('#arcade-player')).not.toBeVisible();
});

test('ordinary browsing does not download camera models or WASM', async ({ page }) => {
    const cameraRequests = [];
    page.on('request', request => { if (request.url().includes('/vendor/')) cameraRequests.push(request.url()); });
    await page.goto('/?theme=aero#arcade');
    await page.waitForTimeout(100);
    expect(cameraRequests).toEqual([]);
});

test('changing the theme closes the active game without breaking the theme picker', async ({ page }) => {
    await page.goto('/?theme=glass#arcade');
    await page.locator('.arcade-play').first().click();
    await startRound(page);
    await page.evaluate(() => document.documentElement.dataset.theme = 'aero');
    await expect(page.locator('#arcade-player')).not.toBeVisible();
    await expect(page.locator('[data-game="aero-school"]')).toBeVisible();
    await page.locator('#open-themes').click();
    await expect(page.locator('#theme-picker')).toBeVisible();
});

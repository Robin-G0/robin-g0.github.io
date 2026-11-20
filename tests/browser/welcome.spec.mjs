import { test, expect } from '@playwright/test';

// First visits: no stored precision, scores or theme.
test.use({ storageState: { cookies: [], origins: [] } });
test.beforeEach(async ({ page }) => {
    await page.route('https://raw.githubusercontent.com/**', route => route.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs', route => route.abort());
});

test('a first visit chooses precision, then the gallery, and every era is one click away', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const dialog = page.locator('#experience');
    await expect(dialog).toHaveAttribute('open', '');
    await expect(dialog.locator('[data-preset]')).toHaveCount(5);
    await expect(dialog.locator('.precision-badge')).toHaveCount(1);
    const recommended = await dialog.locator('[aria-checked=true]').getAttribute('data-preset');
    expect(['medium', 'full-fast']).toContain(recommended);
    await dialog.locator('[aria-checked=true]').press('ArrowDown');
    await expect(dialog.locator('[aria-checked=true]')).not.toHaveAttribute('data-preset', recommended);
    await dialog.locator('[data-preset=low]').click();
    await dialog.locator('[data-experience-next=precision]').click();
    await expect(dialog.locator('[data-step=start]')).toBeVisible();
    await dialog.locator('[data-start=games]').click();
    await expect(dialog).not.toHaveAttribute('open', '');
    await expect(page).toHaveURL(/view=games/);
    await expect(page.locator('#games')).toBeVisible();
    await expect(page.locator('.game-tile')).toHaveCount(33);
    await expect(page.locator('#gallery-precision-label')).toHaveText('Low');
    await expect(page.locator('#projects')).toBeHidden();
    await page.locator('#gallery-filters [data-filter=metro]').click();
    await expect(page.locator('.gallery-era:visible')).toHaveCount(1);
    await expect(page.locator('.gallery-era:visible')).toHaveAttribute('data-era', 'metro');
    await page.locator('.game-tile[data-era=metro] .game-tile-play').first().click();
    await expect(page.locator('#arcade-player')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'metro');
    await expect(page.locator('#arcade-precision-label')).toContainText('Low precision');
    await page.locator('#arcade-close').click();
    await expect(page.locator('#arcade-player')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'construction');
    await page.reload();
    await expect(page.locator('#experience')).not.toHaveAttribute('open', '');
    expect(errors).toEqual([]);
});

test('choosing a theme dresses the portfolio and is remembered; Escape keeps the recommendation', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('#experience');
    await dialog.locator('[data-experience-next=precision]').click();
    await dialog.locator('[data-start=theme]').click();
    await expect(dialog.locator('[data-experience-theme]')).toHaveCount(11);
    await dialog.locator('[data-experience-theme=aero]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'aero');
    await expect(page.locator('#projects')).toBeVisible();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'aero');
    await expect(page.locator('#experience')).not.toHaveAttribute('open', '');

    const fresh = await page.context().browser().newContext({ storageState: { cookies: [], origins: [] } });
    const other = await fresh.newPage();
    await other.route('https://raw.githubusercontent.com/**', route => route.abort());
    await other.goto('/');
    await expect(other.locator('#experience')).toHaveAttribute('open', '');
    await other.keyboard.press('Escape');
    await expect(other.locator('#experience')).not.toHaveAttribute('open', '');
    expect(await other.evaluate(() => JSON.parse(localStorage.getItem('robin-g0-precision')).preset)).toMatch(/^(medium|full-fast)$/);
    await fresh.close();
});

test('arriving on the gallery asks only for precision, and phones get three levels', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 },
        isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' });
    const page = await context.newPage();
    await page.route('https://raw.githubusercontent.com/**', route => route.abort());
    await page.goto('/?view=games');
    const dialog = page.locator('#experience');
    await expect(dialog.locator('[data-preset]')).toHaveCount(3);
    await expect(dialog.locator('[aria-checked=true]')).toHaveAttribute('data-preset', 'medium');
    await expect(dialog.locator('[data-experience-next=precision]')).toBeInViewport();
    await expect(dialog.locator('[data-step-dot=start]')).toBeHidden();
    await dialog.locator('[data-experience-next=precision]').click();
    await expect(dialog).not.toHaveAttribute('open', '');
    await expect(page.locator('.game-tile')).toHaveCount(33);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await context.close();
});

test('precision can be changed from a game; the label and camera plan follow', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('robin-g0-precision', JSON.stringify({ version: 1, preset: 'low' })));
    await page.goto('/?theme=construction#arcade');
    await page.locator('[data-game=construction-popups]').click();
    await expect(page.locator('#arcade-precision-label')).toHaveText('Low precision · processor · this game recommends Full');
    await page.locator('#arcade-precision-change').click();
    const dialog = page.locator('#experience');
    await expect(dialog).toHaveAttribute('open', '');
    await expect(dialog.locator('[data-experience-next=precision]')).toHaveText('Save');
    await expect(dialog.locator('[data-experience-skip]')).toBeHidden();
    await dialog.locator('[data-preset=full-fast]').click();
    await dialog.locator('[data-experience-next=precision]').click();
    await expect(page.locator('#arcade-precision-label')).toHaveText('Full fast precision · graphics card');
    await expect(page.locator('#arcade-player')).toBeVisible();
});

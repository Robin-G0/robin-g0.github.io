import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const snapshot=JSON.parse(await readFile(new URL('../../assets/profile.json',import.meta.url),'utf8'));
const refreshedStats={...snapshot.stats,commits:snapshot.stats.commits+100};

test.beforeEach(async ({page})=>{
    await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:refreshedStats}));
});

test('Construction stays default after public stats refresh and can be restored from the picker',async ({page})=>{
    await page.goto('/');
    await expect(page.locator('#stat-commits')).toHaveText(new Intl.NumberFormat('en').format(refreshedStats.commits));
    await expect(page.locator('html')).toHaveAttribute('data-theme','construction');
    await expect(page.locator('#theme-mode')).toHaveText('Default theme');
    await expect(page.locator('[data-game=construction-popups]')).toBeVisible();
    await page.locator('#open-themes').click();
    await page.locator('[data-theme-choice=aqua]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','aqua');
    await page.locator('#daily-shortcut').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','construction');
    expect(new URL(page.url()).searchParams.has('theme')).toBe(false);
});

test('shared theme links remain available and unknown themes fall back to Construction',async ({page})=>{
    await page.goto('/?theme=aqua');
    await expect(page.locator('#stat-commits')).toHaveText(new Intl.NumberFormat('en').format(refreshedStats.commits));
    await expect(page.locator('html')).toHaveAttribute('data-theme','aqua');
    await page.locator('#open-themes').click();
    await page.locator('#choose-daily').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','construction');
    await page.goto('/?theme=unknown');
    await expect(page.locator('html')).toHaveAttribute('data-ready','true');
    await expect(page.locator('html')).toHaveAttribute('data-theme','construction');
});

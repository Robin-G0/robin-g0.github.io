import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = process.env.MIG_BROWSER || (existsSync(edge) ? edge : undefined);
export default defineConfig({
    testDir: './tests/browser', timeout: 30000, workers: 2,
    use: { baseURL: 'http://127.0.0.1:8765', viewport: { width: 1365, height: 1000 },
        launchOptions: { executablePath }, trace: 'retain-on-failure' },
    webServer: { command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:8765',
        reuseExistingServer: true, timeout: 15000 }
});

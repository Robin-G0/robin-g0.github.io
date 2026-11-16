import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { games } from './arcade/catalog.js';
import { SCORE_KEY, scoreKey } from './arcade/core/scores.js';

// Existing gameplay suites exercise returning players. Fresh-visitor tutorial
// and score tests explicitly use empty storage, so first-play onboarding is tested.
const returningPlayer = { version: 1, name: 'TESTS', games: Object.fromEntries(games.map(game =>
    [scoreKey(game), [{id:'fixture',name:'TESTS',score:1,at:0}]])) };

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = process.env.MIG_BROWSER || (existsSync(edge) ? edge : undefined);
export default defineConfig({
    testDir: './tests/browser', timeout: 30000, workers: 2,
    use: { baseURL: 'http://127.0.0.1:8765', viewport: { width: 1365, height: 1000 },
        storageState: { cookies: [], origins: [{ origin:'http://127.0.0.1:8765',
            localStorage:[{name:SCORE_KEY,value:JSON.stringify(returningPlayer)}] }] },
        launchOptions: { executablePath }, trace: 'retain-on-failure' },
    webServer: { command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:8765',
        reuseExistingServer: true, timeout: 15000 }
});

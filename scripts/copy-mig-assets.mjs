import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { arcadeProfile, popupProfile, constructionLiftProfile, wristRaiseProfile } from '../arcade/mig/profile.js';

// Serve the installed npm package locally. No CDN and no fork of its tracker.
const root = fileURLToPath(new URL('../', import.meta.url));
const installed = join(root, 'node_modules/motion-input-grid');
const published = join(root, 'vendor/motion-input-grid');
const metadata = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
// Replace the whole runtime so files from a previous release cannot linger.
await rm(join(published, 'runtime'), { recursive: true, force: true });
await mkdir(join(published, 'src'), { recursive: true });
await cp(join(installed, 'runtime'), join(published, 'runtime'), { recursive: true });
await cp(join(installed, 'src/index.mjs'), join(published, 'src/index.mjs'));
await cp(join(installed, 'LICENSE'), join(published, 'LICENSE'));
await mkdir(join(root, 'arcade/profiles'), { recursive: true });
await writeFile(join(root, 'arcade/profiles/wrist-raises.json'), JSON.stringify(arcadeProfile, null, 2) + '\n');
await writeFile(join(root, 'arcade/profiles/popup-directions.json'), JSON.stringify(popupProfile, null, 2) + '\n');
await writeFile(join(root, 'arcade/profiles/construction-lifts.json'), JSON.stringify(constructionLiftProfile, null, 2) + '\n');
await writeFile(join(root, 'arcade/profiles/wrist-up-only.json'), JSON.stringify(wristRaiseProfile, null, 2) + '\n');
await writeFile(join(published, 'package.json'), JSON.stringify({
    name: metadata.name, version: metadata.version, type: 'module', license: metadata.license
}, null, 2) + '\n');
console.log(`Prepared ${metadata.name}@${metadata.version} assets.`);

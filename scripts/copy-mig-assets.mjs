import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { arcadeProfile } from '../arcade/mig/profile.js';

// Serve the installed npm package locally. No CDN and no fork of its tracker.
const root = fileURLToPath(new URL('../', import.meta.url));
const installed = join(root, 'node_modules/motion-input-grid');
const published = join(root, 'vendor/motion-input-grid');
const metadata = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
await mkdir(join(published, 'src'), { recursive: true });
await cp(join(installed, 'runtime'), join(published, 'runtime'), { recursive: true });
await cp(join(installed, 'src/index.mjs'), join(published, 'src/index.mjs'));
await cp(join(installed, 'LICENSE'), join(published, 'LICENSE'));
await mkdir(join(root, 'arcade/profiles'), { recursive: true });
await writeFile(join(root, 'arcade/profiles/wrist-raises.json'), JSON.stringify(arcadeProfile, null, 2) + '\n');
await writeFile(join(published, 'package.json'), JSON.stringify({
    name: metadata.name, version: metadata.version, type: 'module', license: metadata.license
}, null, 2) + '\n');
console.log(`Prepared ${metadata.name}@${metadata.version} with its runtime and licenses.`);

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { arcadeProfile, popupProfile, constructionLiftProfile, wristRaiseProfile } from '../arcade/mig/profile.js';

// Serve the installed npm package locally. No CDN and no fork of its tracker.
const root = fileURLToPath(new URL('../', import.meta.url));
const installed = join(root, 'node_modules/motion-input-grid');
const published = join(root, 'vendor/motion-input-grid');
const metadata = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
// Until the next registry release, consume the exact tested upstream JS revision.
// This is canonical MIG source with pinned hashes, not a private gesture/runtime fork.
const source = JSON.parse(await readFile(join(root, 'arcade/mig/runtime-source.json'), 'utf8'));
if (!/^[a-f0-9]{40}$/.test(source.commit) || source.repository !== 'Robin-G0/Motion-Input-Grid') throw new Error('Invalid MIG source pin');
const overrides = new Map();
for (const [name, expected] of Object.entries(source.files)) {
    if (!['session.mjs', 'models.mjs'].includes(name)) throw new Error('Unexpected source override');
    let bytes;
    try { bytes = await readFile(join(published, 'runtime', name)); } catch { /* First build fetches upstream. */ }
    const digest = data => createHash('sha256').update(data).digest('hex');
    if (!bytes || digest(bytes) !== expected) {
        const url = `https://raw.githubusercontent.com/${source.repository}/${source.commit}/examples/web/${name}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`MIG source HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
    }
    if (digest(bytes) !== expected) throw new Error(`MIG source hash mismatch: ${name}`);
    overrides.set(name, bytes);
}
await mkdir(join(published, 'src'), { recursive: true });
await cp(join(installed, 'runtime'), join(published, 'runtime'), { recursive: true });
for (const [name, bytes] of overrides) await writeFile(join(published, 'runtime', name), bytes);
await cp(join(installed, 'src/index.mjs'), join(published, 'src/index.mjs'));
await cp(join(installed, 'LICENSE'), join(published, 'LICENSE'));
await mkdir(join(root, 'arcade/profiles'), { recursive: true });
await writeFile(join(root, 'arcade/profiles/wrist-raises.json'), JSON.stringify(arcadeProfile, null, 2) + '\n');
await writeFile(join(root, 'arcade/profiles/popup-directions.json'), JSON.stringify(popupProfile, null, 2) + '\n');
await writeFile(join(root, 'arcade/profiles/construction-lifts.json'), JSON.stringify(constructionLiftProfile, null, 2) + '\n');
await writeFile(join(root, 'arcade/profiles/wrist-up-only.json'), JSON.stringify(wristRaiseProfile, null, 2) + '\n');
await writeFile(join(published, 'package.json'), JSON.stringify({
    name: metadata.name, version: metadata.version, type: 'module', license: metadata.license,
    runtimeSource: { repository: source.repository, commit: source.commit, files: source.files }
}, null, 2) + '\n');
console.log(`Prepared ${metadata.name}@${metadata.version} assets with upstream runtime ${source.commit.slice(0,12)}.`);

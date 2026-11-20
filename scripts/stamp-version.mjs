// Stamps one cache version on every relative module import and asset link, so a
// returning visitor never mixes modules from two deployments (Pages caches 10 min).
// Usage: node scripts/stamp-version.mjs <version>   (run before each deployment)
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!/^[A-Za-z0-9._-]+$/.test(version ?? '')) throw new Error('Usage: node scripts/stamp-version.mjs <version>');
const root = fileURLToPath(new URL('../', import.meta.url));

async function files(dir) {
    const out = [];
    for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await files(path));
        else if (entry.name.endsWith('.js')) out.push(path);
    }
    return out;
}

// Relative specifiers in static imports, re-exports and dynamic imports.
const moduleSpecifier = /((?:\bfrom|\bimport)\s*\(?\s*)(['"])(\.{1,2}\/[^'"?]+\.js)(?:\?v=[A-Za-z0-9._-]+)?\2/g;
let changed = 0;
for (const path of [...await files('arcade'), ...await files('assets')]) {
    const source = await readFile(join(root, path), 'utf8');
    const stamped = source.replace(moduleSpecifier, (_, lead, quote, spec) => `${lead}${quote}${spec}?v=${version}${quote}`);
    if (stamped !== source) { await writeFile(join(root, path), stamped); changed++; }
}
const page = await readFile(join(root, 'index.html'), 'utf8');
const stampedPage = page.replace(/((?:href|src)=")(\.\/[^"?]+\.(?:css|js))(?:\?v=[A-Za-z0-9._-]+)?"/g,
    (_, lead, spec) => `${lead}${spec}?v=${version}"`);
if (stampedPage !== page) { await writeFile(join(root, 'index.html'), stampedPage); changed++; }
console.log(`Stamped ?v=${version} in ${changed} files.`);

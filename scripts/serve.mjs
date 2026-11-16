import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('.');
const port = Number(process.env.PORT || 8765);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
    try {
        let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        let file = resolve(root, '.' + pathname);
        if (file !== root && !file.startsWith(root + sep)) throw new Error('Outside root');
        if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
        const bytes = await readFile(file);
        response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream',
            'Cache-Control': 'no-cache' });
        response.end(bytes);
    } catch {
        response.writeHead(404); response.end('Not found');
    }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));

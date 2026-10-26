// e2e/server.mjs: dist klasörünü üretimdeki başlıklarla sunan küçük statik sunucu (yalnız test için).
// Başlıklar apps/web/deploy/security-headers.conf dosyasından okunur: test ile üretim aynı politikayı kullanır.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const conf = readFileSync(join(here, '../apps/web/deploy/security-headers.conf'), 'utf8');
export const HEADERS = Object.fromEntries([...conf.matchAll(/^add_header\s+(\S+)\s+"([^"]*)"\s+always;/gm)].map((m) => [m[1], m[2]]));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

export function serve(root, port = 0) {
  const srv = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
    if (!file.startsWith(root) || !existsSync(file)) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() })));
}

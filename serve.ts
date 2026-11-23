// SOLMARA — a tiny static file server for local play (Node 22, stdlib only).
// Serves this directory so game/index.html loads its ES modules over HTTP:
//
//   node serve.ts        then open http://localhost:8080
//
// The game itself needs no server: opening game/index.html from disk works
// too. This file is a developer convenience, not part of the game.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 8080);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  let path = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!path.startsWith(resolve(root))) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  if (path.endsWith('/')) path = join(path, 'index.html');
  if (!existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  createReadStream(path).pipe(res);
}).listen(port, () => {
  console.log(`SOLMARA at http://localhost:${port} (game at /game/index.html)`);
});

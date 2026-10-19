import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(projectRoot, 'web', 'dist');
const prefix = '/1014_codex_project/008-specreel/';
const port = Number(process.env.PORT || 4188);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.gif': 'image/gif', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.py':'text/plain; charset=utf-8', '.txt':'text/plain; charset=utf-8' };

const server = http.createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); response.end(); return; }
  if (pathname === '/' || pathname === prefix.slice(0, -1)) { response.writeHead(302, { Location: prefix }); response.end(); return; }
  let file;
  if (pathname === `${prefix}preview.png`) file = path.join(projectRoot, 'assets', 'preview.png');
  else {
    if (!pathname.startsWith(prefix)) { response.writeHead(404); response.end(); return; }
    file = path.resolve(root, pathname.slice(prefix.length) || 'index.html');
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403); response.end(); return; }
  }
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = path.join(file, 'index.html');
    const actual = await stat(file);
    const range = request.headers.range;
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    if (range && path.extname(file) === '.mp4') {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      const start = Number(match?.[1]);
      const end = match?.[2] ? Math.min(Number(match[2]), actual.size - 1) : actual.size - 1;
      if (!match || start > end || start >= actual.size) { response.writeHead(416, { 'Content-Range': `bytes */${actual.size}` }); response.end(); return; }
      response.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${actual.size}`, 'Content-Length': end - start + 1 });
      if (request.method === 'HEAD') response.end();
      else createReadStream(file, { start, end }).pipe(response);
    } else {
      response.writeHead(200, { ...headers, 'Content-Length': actual.size });
      response.end(request.method === 'HEAD' ? undefined : await readFile(file));
    }
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`008 演示：http://127.0.0.1:${port}${prefix}`));

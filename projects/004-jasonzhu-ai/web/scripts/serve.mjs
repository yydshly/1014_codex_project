import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createResearchService } from '../server/research.mjs';
import { createAutoResearchService } from '../server/auto-research.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const prefix = '/1014_codex_project/004-jasonzhu-ai/';
const port = Number(process.env.PORT || 4176);
const research = await createResearchService();
const autoResearch = await createAutoResearchService();
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT 需要在 1024–65535 之间');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8', '.png': 'image/png' };
const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400); response.end('Bad request'); return; }
  if (pathname.startsWith(`${prefix}api/reddit/`) || pathname.startsWith(`${prefix}api/research/`)) {
    if (!['127.0.0.1', 'localhost'].some((host) => request.headers.host === `${host}:${port}`)) { response.writeHead(403); response.end('Forbidden host'); return; }
    try { const automatic = pathname.startsWith(`${prefix}api/research/`); await (automatic ? autoResearch : research).handle(request, response, pathname.slice(`${prefix}api/${automatic ? 'research' : 'reddit'}/`.length)); }
    catch { if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify({ error: '本地服务处理失败，上次结果保留。' })); }
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end('Method not allowed'); return; }
  if (pathname === '/' || pathname === prefix.slice(0, -1)) {
    response.writeHead(302, { Location: prefix });
    response.end();
    return;
  }
  if (!pathname.startsWith(prefix)) { response.writeHead(404); response.end('Not found'); return; }
  const file = path.resolve(root, pathname.slice(prefix.length) || 'index.html');
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403); response.end('Forbidden'); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});
server.on('error', (error) => { console.error(`本地预览启动失败：${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`004 本地预览：http://127.0.0.1:${port}${prefix}`));
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, async () => { await autoResearch.close();server.close();process.exit(0); });

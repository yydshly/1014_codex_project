import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDiscoveryService } from '../server/service.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const prefix = '/1014_codex_project/009-demand-discovery/';
const port = Number(process.env.PORT || 4182);
const discovery = await createDiscoveryService();
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT 需要为 1024–65535 的整数');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  let routePath;
  try { routePath=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname); }
  catch { res.writeHead(400);res.end('Bad request');return; }
  if(routePath.startsWith(`${prefix}api/discovery/`)){
    if(!['127.0.0.1','localhost'].some(host=>req.headers.host===`${host}:${port}`)){res.writeHead(403);res.end('Forbidden host');return;}
    if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end('Forbidden origin');return;}
    try{await discovery.handle(req,res,routePath.slice(`${prefix}api/discovery/`.length));}
    catch{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'本地探索服务暂时无法处理请求。'}));}
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  if (pathname === '/' || pathname === prefix.slice(0, -1)) { res.writeHead(302, { Location: prefix }); res.end(); return; }
  if (!pathname.startsWith(prefix)) { res.writeHead(404); res.end('Not found'); return; }
  const target = path.resolve(root, pathname.slice(prefix.length) || 'index.html');
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', err => { console.error(`009 预览启动失败：${err.message}`); process.exitCode = 1; });
let closing=false;
async function shutdown(){if(closing)return;closing=true;await discovery.close();server.close(()=>process.exit(0));}
process.once('SIGINT',()=>{void shutdown();});
process.once('SIGTERM',()=>{void shutdown();});
server.listen(port, '127.0.0.1', () => console.log(`009 本地预览：http://127.0.0.1:${port}${prefix}`));

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const project = fileURLToPath(new URL('./', import.meta.url));
const repository = resolve(project, '../../..');
const prefix = '/1014_codex_project/';
const name = '012-edgechat';
const port = Number(process.env.PORT || 4182);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.md': 'text/plain; charset=utf-8' };
function inside(file, folder) { return file.startsWith(folder + sep); }
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const catalog = JSON.parse(await readFile(resolve(repository, 'projects.json'), 'utf8'));
    let file;
    let folder;
    if (path === '/' || path === prefix.slice(0, -1)) {
      response.writeHead(302, { Location: path === '/' ? prefix + name + '/' : prefix }).end(); return;
    }
    if (path === prefix || path === prefix + 'index.html') {
      folder = resolve(repository, 'web'); file = resolve(folder, 'index.html');
    } else if (path === prefix + 'projects.json') {
      folder = repository; file = resolve(folder, 'projects.json');
    } else if (path.startsWith(prefix + 'projects/')) {
      const parts = path.slice(prefix.length).split('/');
      const item = catalog.projects.find((entry) => `${entry.id}-${entry.slug}` === parts[1]);
      const record = parts.slice(2).join('/');
      if (!item || !['README.md', 'RESEARCH.md', item.preview].filter(Boolean).includes(record)) throw new Error('not found');
      folder = resolve(repository, 'projects', parts[1]); file = resolve(folder, record);
    } else if (path.startsWith(prefix)) {
      const parts = path.slice(prefix.length).split('/');
      const item = catalog.projects.find((entry) => `${entry.id}-${entry.slug}` === parts[0]);
      if (!item) throw new Error('not found');
      if (parts.length === 1) { response.writeHead(302, { Location: path + '/' }).end(); return; }
      folder = resolve(repository, 'projects', parts[0], 'web/dist');
      file = resolve(folder, parts.slice(1).join('/') || 'index.html');
    } else {
      folder = resolve(project, 'dist'); file = resolve(folder, path.slice(1));
    }
    if (!inside(file, folder) || !(await stat(file)).isFile()) throw new Error('not found');
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('页面或文件不存在。');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`EdgeChat 研究页：http://127.0.0.1:${port}${prefix}${name}/`));

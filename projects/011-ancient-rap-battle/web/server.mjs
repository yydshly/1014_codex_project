import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
export const basePath = '/1014_codex_project/011-ancient-rap-battle';
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function byteRange(header, size) {
  if (header === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return false;
  const first = match[1] === '' ? null : Number(match[1]);
  const last = match[2] === '' ? null : Number(match[2]);
  if ([first, last].some(value => value !== null && !Number.isSafeInteger(value))) return false;
  if (first === null) {
    if (last <= 0) return false;
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  if (first >= size || (last !== null && last < first)) return false;
  return { start: first, end: last === null ? size - 1 : Math.min(last, size - 1) };
}

/** Create a loopback-only static server. Calling this function does not listen. */
export function createServer({ root = path.join(webRoot, 'dist') } = {}) {
  const directory = path.resolve(root);
  return http.createServer(async (request, response) => {
    const headers = {
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    };
    const send = (status, body, extra = {}) => {
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
      response.writeHead(status, {
        ...headers,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': bytes.length,
        ...extra,
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    };

    try {
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(request.headers.host || '')) {
        return send(403, '此预览仅允许本机访问。');
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        return send(405, '仅支持 GET 和 HEAD。', { Allow: 'GET, HEAD' });
      }
      const raw = request.url || '/';
      if (!raw.startsWith('/') || raw.startsWith('//')) return send(400, '无效请求路径。');
      const rawPath = raw.split(/[?#]/, 1)[0];
      let pathname;
      try {
        pathname = decodeURIComponent(rawPath);
      } catch {
        return send(400, '路径编码无效。');
      }
      if (/[\\\0]/.test(pathname) || pathname.split('/').some(part => part === '..' || part === '.')) {
        return send(403, '禁止访问此路径。');
      }
      if (pathname === basePath) {
        const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
        return send(308, '请使用以 / 结尾的项目地址。', { Location: `${basePath}/${query}` });
      }
      if (pathname.startsWith(`${basePath}/`)) pathname = pathname.slice(basePath.length);
      if (pathname === '/') pathname = '/index.html';
      const target = path.resolve(directory, `.${pathname}`);
      if (!isWithin(directory, target)) return send(403, '禁止访问此路径。');

      // Check real paths as well, so a symlink cannot escape the static directory.
      const [actualRoot, actualTarget] = await Promise.all([realpath(directory), realpath(target)]);
      if (!isWithin(actualRoot, actualTarget)) return send(403, '禁止访问此路径。');
      const info = await stat(actualTarget);
      if (!info.isFile()) return send(404, '资源不存在。');
      // Range applies to GET. HEAD reports the complete representation without reading it.
      const range = byteRange(request.method === 'GET' ? request.headers.range : undefined, info.size);
      if (range === false) {
        return send(416, '无效的字节范围。', {
          'Content-Range': `bytes */${info.size}`,
          'Accept-Ranges': 'bytes',
        });
      }
      response.writeHead(range ? 206 : 200, {
        ...headers,
        'Content-Type': mimeTypes[path.extname(actualTarget).toLowerCase()] || 'application/octet-stream',
        'Content-Length': range ? range.end - range.start + 1 : info.size,
        'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${info.size}` } : {}),
      });
      if (request.method === 'HEAD' || info.size === 0) return response.end();
      const stream = createReadStream(actualTarget, range || undefined);
      response.on('close', () => stream.destroy());
      stream.on('error', error => {
        if (response.destroyed) return;
        console.error('静态资源传输失败：', error.message);
        response.destroy(error);
      });
      stream.pipe(response);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EINVAL'].includes(error.code)) return send(404, '资源不存在。');
      console.error('静态资源读取失败：', error.message);
      return send(500, '静态资源读取失败。');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.ANCIENT_RAP_PORT || 4184);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('ANCIENT_RAP_PORT 必须是 1 到 65535 的整数。');
  }
  await access(path.join(webRoot, 'dist', 'index.html')).catch(() => {
    throw new Error('尚无静态产物，请先运行 npm run build。');
  });
  const server = createServer();
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，可设置 ANCIENT_RAP_PORT 后重试。` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`古人说唱 Battle 研究网页：http://127.0.0.1:${port}/`);
    console.log(`编号子路径：http://127.0.0.1:${port}${basePath}/`);
  });
}

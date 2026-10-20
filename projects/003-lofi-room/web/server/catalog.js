import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const prefix = "/1014_codex_project/";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};
function byteRange(header, size) {
  if (header === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return false;
  const first = match[1] === "" ? null : Number(match[1]);
  const last = match[2] === "" ? null : Number(match[2]);
  if ([first, last].some((value) => value !== null && !Number.isSafeInteger(value))) return false;
  if (first === null) {
    if (last <= 0) return false;
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  if (first >= size || (last !== null && last < first)) return false;
  return { start: first, end: last === null ? size - 1 : Math.min(last, size - 1) };
}
export function createCatalogGateway(repository = root) {
  return async (req, res, next) => {
    try {
      const host = new URL(`http://${req.headers.host || ""}`).hostname;
      if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (path === "/" || path === prefix.slice(0, -1)) {
        res.writeHead(302, { Location: prefix });
        res.end();
        return;
      }
      if (!path.startsWith(prefix) || !["GET", "HEAD"].includes(req.method))
        return next();
      const relative = path.slice(prefix.length),
        catalog = JSON.parse(
          await readFile(resolve(repository, "projects.json"), "utf8"),
        );
      let file;
      if (!relative || relative === "index.html")
        file = resolve(repository, "web/index.html");
      else if (relative === "projects.json")
        file = resolve(repository, "projects.json");
      else if (relative === "entries.json")
        file = resolve(repository, "web/entries.json");
      else if (relative.startsWith("projects/")) {
        const parts = relative.split("/"),
          project = catalog.projects.find(
            (p) => `${p.id}-${p.slug}` === parts[1],
          );
        const record = parts.slice(2).join("/");
        if (
          !project ||
          (!["README.md", "RESEARCH.md"].includes(record) &&
            !(
              record === project.preview &&
              [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(
                extname(record).toLowerCase(),
              )
            ))
        )
          return next();
        file = resolve(repository, relative);
        if (!file.startsWith(resolve(repository, "projects", parts[1]) + sep)) {
          res.writeHead(403);
          res.end();
          return;
        }
      } else {
        const project = catalog.projects.find(
          (p) => relative.split("/")[0] === `${p.id}-${p.slug}`,
        );
        if (!project || project.id === "003") return next();
        const folder = resolve(
            repository,
            `projects/${project.id}-${project.slug}/web/dist`,
          ),
          asset = relative.split("/").slice(1).join("/") || "index.html";
        file = resolve(folder, asset);
        if (!file.startsWith(folder + sep)) {
          res.writeHead(403);
          res.end();
          return;
        }
      }
      if (!file.startsWith(resolve(repository) + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const info = await stat(file);
      if (!info.isFile()) return next();
      if (extname(file).toLowerCase() === ".mp4") {
        const range = byteRange(req.method === "GET" ? req.headers.range : undefined, info.size);
        const headers = {
          "Content-Type": "video/mp4",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Accept-Ranges": "bytes",
        };
        if (range === false) {
          res.writeHead(416, { ...headers, "Content-Range": `bytes */${info.size}`, "Content-Length": 0 });
          res.end();
          return;
        }
        res.writeHead(range ? 206 : 200, {
          ...headers,
          "Content-Length": range ? range.end - range.start + 1 : info.size,
          ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${info.size}` } : {}),
        });
        if (req.method === "HEAD" || info.size === 0) {
          res.end();
          return;
        }
        const stream = createReadStream(file, range || undefined);
        res.on("close", () => stream.destroy());
        stream.on("error", (error) => res.destroy(error));
        stream.pipe(res);
        return;
      }
      let body = await readFile(file);
      if (
        extname(file) === ".html" &&
        relative &&
        !relative.startsWith("projects/")
      )
        body = Buffer.from(
          body
            .toString()
            .replace(
              "<body>",
              `<body><a href="${prefix}" style="position:fixed;right:12px;bottom:12px;z-index:9999;padding:9px 14px;background:#17232eee;color:#d8e3cf;border-radius:8px;text-decoration:none;font:12px sans-serif">← 项目首页</a>`,
            ),
        );
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      next();
    }
  };
}
export function catalogGateway() {
  const api = createCatalogGateway();
  return {
    name: "repository-project-home",
    configureServer(s) {
      s.middlewares.use(api);
    },
    configurePreviewServer(s) {
      s.middlewares.use(api);
    },
  };
}

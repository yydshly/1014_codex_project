import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

export function parseRepository(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("请输入完整的 https://github.com/作者/项目 地址。");
  }
  const match = url.pathname.match(/^\/([\w-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !match ||
    [".", ".."].includes(match[2])
  )
    throw new Error(
      "首版接受公开 GitHub 仓库首页地址，例如 https://github.com/developit/mitt。",
    );
  return {
    owner: match[1],
    repo: match[2],
    url: `https://github.com/${match[1]}/${match[2]}`,
  };
}

async function limitedResponse(url, signal, fetcher, limit) {
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted();
    try {
      response = await fetcher(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
        redirect: "error",
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "lofi-room-research",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (![500, 502, 503, 504].includes(response.status) || attempt === 2)
        break;
      await response.body?.cancel();
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (attempt === 2)
        throw new Error(
          "GitHub 网络读取失败，已尝试三次。请检查网络后重新开始，已有产物会保留。",
        );
    }
    await delay(350 * (attempt + 1), undefined, { signal });
  }
  if (!response.ok)
    throw new Error(
      response.status === 403 || response.status === 429
        ? "GitHub 请求额度暂时不足，请稍后重试。"
        : `GitHub 读取失败（HTTP ${response.status}），请确认仓库公开且地址正确。`,
    );
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error("仓库响应超过本轮读取上限。");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function openRepository(
  value,
  { signal = new AbortController().signal, fetcher = fetch } = {},
) {
  const reference = parseRepository(value);
  const api = `https://api.github.com/repos/${reference.owner}/${reference.repo}`;
  const json = async (suffix, limit = 4_000_000) =>
    JSON.parse(await limitedResponse(api + suffix, signal, fetcher, limit));
  const metadata = await json("");
  const commit = await json(
    `/commits/${encodeURIComponent(metadata.default_branch)}`,
    1_000_000,
  );
  if (!/^[a-f0-9]{40}$/.test(commit.sha))
    throw new Error("GitHub 未返回有效的固定版本。");
  const tree = await json(`/git/trees/${commit.sha}?recursive=1`, 12_000_000);
  if (tree.truncated)
    throw new Error("仓库目录过大，首版暂不支持被 GitHub 截断的目录树。");
  const files = tree.tree.filter(
    (file) =>
      file.type === "blob" &&
      file.mode !== "120000" &&
      file.size <= 180000 &&
      (/\.(?:md|rst|txt|json|[cm]?[jt]sx?|py|html|css|go|rs|ya?ml)$/i.test(
        file.path,
      ) ||
        /^readme(?:[._-][^/]*)?$/i.test(file.path) ||
        /(?:^|\/)(?:LICENSE|COPYING)(?:\.\w+)?$/i.test(file.path)),
  );
  const cache = new Map();
  let bytes = 0;
  const read = async (path) => {
    if (cache.has(path)) return cache.get(path);
    const file = files.find((f) => f.path === path);
    if (
      !file ||
      path.split("/").some((s) => s === "." || s === ".." || s.includes("\\"))
    )
      throw new Error("只能读取目录树中的小型文本文件。");
    if (cache.size >= 18) throw new Error("本轮已达到 18 份源文件读取上限。");
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const content = await limitedResponse(
      `https://raw.githubusercontent.com/${reference.owner}/${reference.repo}/${commit.sha}/${encoded}`,
      signal,
      fetcher,
      180000,
    );
    bytes += Buffer.byteLength(content);
    if (bytes > 1_200_000) throw new Error("本轮源文件总量超过上限。");
    cache.set(path, content);
    return content;
  };
  const readmePath = files.find((file) =>
    /^readme(?:[._-][^/]*)?$/i.test(file.path),
  )?.path;
  const readme = readmePath
    ? { path: readmePath, content: (await read(readmePath)).slice(0, 18000) }
    : null;
  return {
    ...reference,
    commit: commit.sha,
    description: metadata.description || "",
    language: metadata.language,
    license: metadata.license?.spdx_id || "待确认",
    files: files.map(({ path, size }) => ({ path, size })),
    read,
    cache,
    readme,
  };
}

export const DEMO_FILES = [
  "index.html",
  "style.css",
  "core.js",
  "app.js",
  "tests.json",
];
export const RUN_FILES = [
  ...DEMO_FILES,
  "README.md",
  "provenance.json",
  "tests.log",
  "test-history.json",
  "delivery.json",
  "UPSTREAM-LICENSE.txt",
];
export class RepositoryRun {
  constructor(directory, id = randomUUID()) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("任务编号无效。");
    this.id = id;
    this.root = join(directory, ".cache", "task-runs", id);
  }
  async init() {
    await mkdir(this.root, { recursive: true });
  }
  async write(name, content) {
    if (
      !RUN_FILES.includes(name) ||
      typeof content !== "string" ||
      Buffer.byteLength(content) > 160000
    )
      throw new Error("文件名或文件大小不符合 Demo 工作区约定。");
    await writeFile(join(this.root, name), content, "utf8");
  }
  async read(name) {
    if (!RUN_FILES.includes(name)) throw new Error("文件不在交付清单内。");
    return readFile(join(this.root, name), "utf8");
  }
  async files() {
    const entries = await Promise.all(
      RUN_FILES.map(async (name) => {
        try {
          return [name, await this.read(name)];
        } catch {
          return null;
        }
      }),
    );
    return Object.fromEntries(entries.filter(Boolean));
  }
  async digest() {
    const files = await this.files();
    return createHash("sha256")
      .update(
        DEMO_FILES.map((name) => `${name}\0${files[name] || ""}`).join("\0"),
      )
      .digest("hex");
  }
}

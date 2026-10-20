import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";

// Reproduce legacy esm 3 projects without changing the app's Node installation.
// Pinned against https://nodejs.org/dist/v20.18.3/SHASUMS256.txt.
export const LEGACY_NODE = Object.freeze({ version: "20.18.3", archive: "node-v20.18.3-win-x64.zip",
  sha256: "11d483dfba711bc7c9bcb513e80a2941be0c2e7cbf62753755785b9a6e80a731" });
export function needsLegacyNode(pkg, host = process.versions.node) {
  const [major, minor] = host.split(".").map(Number);
  const version = pkg.devDependencies?.esm || pkg.dependencies?.esm;
  return Boolean(version) && !String(version).includes("@httptoolkit/esm") && (major > 22 || (major === 22 && minor >= 10));
}
export async function legacyNode(directory, { signal = new AbortController().signal, onProgress = () => {} } = {}) {
  if (process.platform !== "win32" || process.arch !== "x64") throw new Error("自动兼容版Node目前支持Windows x64；其他平台请配置匹配的本机运行时。");
  const root = resolve(directory, ".cache", "node-runtimes"), prefix = `node-v${LEGACY_NODE.version}-win-x64`;
  const target = resolve(root, prefix), manifestPath = resolve(target, "lofi-runtime.json");
  try {
    const saved = JSON.parse(await readFile(manifestPath, "utf8"));
    if (saved.archiveSha256 === LEGACY_NODE.sha256 && saved.executableSha256 === createHash("sha256").update(await readFile(resolve(target, "node.exe"))).digest("hex"))
      return { ...saved, node: resolve(target, "node.exe"), npm: resolve(target, "node_modules/npm/bin/npm-cli.js") };
  } catch { /* An incomplete runtime is never marked ready. */ }
  onProgress(`下载兼容运行时 Node ${LEGACY_NODE.version} · 仅写入项目缓存`);
  const response = await fetch(`https://nodejs.org/dist/v${LEGACY_NODE.version}/${LEGACY_NODE.archive}`, {
    redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
  });
  if (!response.ok) throw new Error(`官方Node下载失败（HTTP ${response.status}）。`);
  let size = 0; const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length; if (size > 100_000_000) throw new Error("Node压缩包超过上限。"); chunks.push(chunk);
  }
  const zip = Buffer.concat(chunks);
  if (createHash("sha256").update(zip).digest("hex") !== LEGACY_NODE.sha256) throw new Error("Node官方包SHA256校验失败，未执行该运行时。");
  onProgress(`SHA256通过 · 准备 Node ${LEGACY_NODE.version}`);
  const files = unzipSync(zip);
  for (const [name, bytes] of Object.entries(files)) {
    if (!name.startsWith(prefix + "/") || name.includes("\\") || name.split("/").includes("..")) throw new Error("Node压缩包路径无效。");
    const file = resolve(root, name), rel = relative(target, file);
    if (isAbsolute(rel) || rel === ".." || rel.startsWith("..")) throw new Error("Node解压路径越界。");
    if (name.endsWith("/")) await mkdir(file, { recursive: true });
    else { await mkdir(resolve(file, ".."), { recursive: true }); await writeFile(file, bytes); }
  }
  const manifest = { version: LEGACY_NODE.version, source: `https://nodejs.org/dist/v${LEGACY_NODE.version}/${LEGACY_NODE.archive}`,
    archiveSha256: LEGACY_NODE.sha256, executableSha256: createHash("sha256").update(await readFile(resolve(target, "node.exe"))).digest("hex"),
    reason: "esm 3 调用旧版Node内部模块加载API，在Node22.10及以后版本不兼容", preparedAt: new Date().toISOString() };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return { ...manifest, node: resolve(target, "node.exe"), npm: resolve(target, "node_modules/npm/bin/npm-cli.js") };
}

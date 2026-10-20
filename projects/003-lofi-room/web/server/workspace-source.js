import { readFile, writeFile, mkdir, readdir, lstat } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { randomUUID } from "node:crypto";
import { localCommand, localEnvironment, inDirectory } from "./local-runner.js";
import { parseRepository } from "./repository.js";

const projectDirectory = "projects/003-lofi-room/web";
export async function checkpointSnapshotId(directory, runId) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(runId)) throw new Error("草稿运行编号无效。");
  const state = JSON.parse(await readFile(resolve(directory, ".cache/source-runs", runId, "state.json"), "utf8"));
  if (!["error", "cancelled"].includes(state.status)) throw new Error("只能续接已中断的工作区草稿。");
  try {
    const source = JSON.parse(await readFile(resolve(directory, ".cache/source-workspaces", runId, "repo/.lofi-workspace-source.json"), "utf8"));
    await readFile(resolve(directory, ".cache/source-runs", runId, "checkpoint.zip"));
    return source.snapshotId;
  } catch (error) {
    // A model can fail in planning, before a working directory or draft exists.
    // Retry that goal from a fresh snapshot instead of inheriting a missing file.
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
async function git(cwd, args, signal) {
  const result = await localCommand("git", args, { cwd, signal, env: localEnvironment(cwd, 0), timeout: 60000 });
  if (result.exitCode) throw new Error(`工作区快照 Git 操作失败：${result.stderr.slice(-800)}`);
  return result.stdout.trim();
}
export async function workspaceInfo(directory, signal) {
  const root = resolve(directory, "../../..");
  if (resolve(root, projectDirectory) !== resolve(directory)) throw new Error("当前服务不是003工程目录。");
  const repository = parseRepository(await git(root, ["remote", "get-url", "origin"], signal));
  const baseCommit = await git(root, ["rev-parse", "HEAD"], signal);
  return { available: true, ...repository, baseCommit, projectDirectory };
}
export async function openWorkspaceSource(directory, url, { signal, snapshotId } = {}) {
  const info = await workspaceInfo(directory, signal);
  if (parseRepository(url).url !== info.url) throw new Error("当前工作区方式只能执行本仓库，不能指定其他本机路径。");
  const parent = resolve(directory, ".cache/workspace-snapshots");
  const id = snapshotId || randomUUID();
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id)) throw new Error("快照编号无效。");
  const snapshot = resolve(parent, id), copy = join(snapshot, "repo");
  if (!inDirectory(parent, copy)) throw new Error("快照位置异常。");
  let metadata;
  if (snapshotId) {
    metadata = JSON.parse(await readFile(join(snapshot, "snapshot.json"), "utf8"));
    if (metadata.url !== info.url) throw new Error("快照仓库不匹配。");
  } else {
    await mkdir(copy, { recursive: true });
    const root = resolve(directory, "../../..");
    const files = [], skipped = /^(?:node_modules|dist|build|coverage|\.cache|\.git|\.env(?:\..*)?|\.npmrc|\.yarnrc|\.idea|\.vscode)$/i;
    let size = 0;
    const put = async (name) => {
      const source = resolve(root, name), target = resolve(copy, name);
      if (!inDirectory(root, source) || !inDirectory(copy, target)) throw new Error("快照路径异常。");
      let stat;
      try { stat = await lstat(source); } catch (e) { if (e.code === "ENOENT") return; throw e; }
      if (!stat.isFile() || stat.isSymbolicLink()) return;
      size += stat.size;
      if (size > 20_000_000 || files.length >= 2900) throw new Error("工作区研究范围超过源码快照上限。");
      await mkdir(resolve(target, ".."), { recursive: true });
      await writeFile(target, await readFile(source)); files.push(name.replaceAll("\\", "/"));
    };
    const walk = async (folder) => {
      for (const entry of await readdir(resolve(root, folder), { withFileTypes: true })) {
        if (entry.isSymbolicLink() || skipped.test(entry.name)) continue;
        const name = folder + "/" + entry.name;
        if (entry.isDirectory()) await walk(name); else await put(name);
      }
    };
    await walk(projectDirectory);
    for (const name of ["AGENTS.md", ".gitignore", "README.md", "LICENSE", "projects.json", "web/index.html", "web/entries.json", "docs/DEPLOYMENT.md", "projects/001-archify/web/dist/index.html"]) await put(name);
    metadata = { snapshotId: id, url: info.url, baseCommit: info.baseCommit, projectDirectory,
      capturedAt: new Date().toISOString(), files, bytes: size,
      scope: "003当前源码、公开资产与既有目录网关集成测试所需原文件；排除密钥、依赖、缓存和其他项目运行源码" };
    await writeFile(join(copy, ".lofi-workspace-source.json"), JSON.stringify(metadata, null, 2));
    await git(copy, ["init", "--quiet"], signal);
    await git(copy, ["add", "--all"], signal);
    if (files.includes("projects/001-archify/web/dist/index.html")) await git(copy, ["add", "--force", "projects/001-archify/web/dist/index.html"], signal);
    await git(copy, ["-c", "user.name=Local Task Snapshot", "-c", "user.email=snapshot@localhost", "commit", "--quiet", "-m", "Capture current 003 workspace for an independent task"], signal);
    metadata.commit = await git(copy, ["rev-parse", "HEAD"], signal);
    await writeFile(join(snapshot, "snapshot.json"), JSON.stringify(metadata, null, 2));
  }
  const readme = await readFile(join(copy, projectDirectory, "README.md"), "utf8");
  return { ...info, commit: metadata.commit, workspaceSnapshotDirectory: copy, workspaceSource: metadata,
    license: "保留仓库与003依赖的原许可证，未声明统一仓库许可", readme: readme.slice(0, 12000),
    files: metadata.files.map((path) => ({ path })) };
}

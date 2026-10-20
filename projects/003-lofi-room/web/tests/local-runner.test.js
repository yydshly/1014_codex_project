import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { LocalGuest, inDirectory, localCommand, localEnvironment } from "../server/local-runner.js";
import { GUEST_HELPERS } from "../server/source-project.js";
import { needsLegacyNode, LEGACY_NODE } from "../server/node-runtime.js";
import { openWorkspaceSource, checkpointSnapshotId } from "../server/workspace-source.js";

test("分工模型失败尚无源码草稿时，同一工作区任务可以重新创建副本", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-empty-draft-")), id = randomUUID();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const record = join(directory, ".cache/source-runs", id); await mkdir(record, { recursive: true });
  await writeFile(join(record, "state.json"), JSON.stringify({ status: "error" }));
  assert.equal(await checkpointSnapshotId(directory, id), null);
});

test("当前工作区快照固定实际源码，排除密钥缓存并保留集成测试所需原文件", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "lofi-workspace-source-")), web = join(root, "projects/003-lofi-room/web");
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(web, ".cache"), { recursive: true });
  await mkdir(join(root, "projects/001-archify/web/dist"), { recursive: true });
  await writeFile(join(web, "README.md"), "本地工作室源码");
  await writeFile(join(web, "package.json"), '{"scripts":{"build":"node -e 1","test":"node -e 1"}}');
  await writeFile(join(web, ".env.local"), "PRIVATE_KEY=must-not-copy");
  await writeFile(join(web, ".cache/secret.txt"), "must-not-copy");
  await writeFile(join(root, "projects/001-archify/web/dist/index.html"), "original integration asset");
  const git = async (args) => { const r = await localCommand("git", args, { cwd: root, env: localEnvironment(root, 0) }); assert.equal(r.exitCode, 0, r.stderr); };
  await git(["init", "--quiet"]); await git(["remote", "add", "origin", "https://github.com/example/workspace.git"]);
  await git(["add", "projects/003-lofi-room/web/README.md"]);
  await git(["-c", "user.name=Test", "-c", "user.email=test@localhost", "commit", "--quiet", "-m", "fixture"]);
  const repo = await openWorkspaceSource(web, "https://github.com/example/workspace", { signal: new AbortController().signal });
  assert.match(repo.commit, /^[a-f0-9]{40}$/);
  assert.ok(repo.workspaceSource.files.includes("projects/003-lofi-room/web/package.json"));
  assert.ok(repo.workspaceSource.files.includes("projects/001-archify/web/dist/index.html"));
  assert.ok(!repo.workspaceSource.files.some((p) => /\.env|\.cache/.test(p)));
  assert.equal(await readFile(join(repo.workspaceSnapshotDirectory, "projects/003-lofi-room/web/README.md"), "utf8"), "本地工作室源码");
  await assert.rejects(openWorkspaceSource(web, "https://github.com/another/repo"), /只能执行本仓库/);
});

test("仅旧esm加载器使用兼容运行时，官方版本和SHA固定", () => {
  assert.equal(needsLegacyNode({ devDependencies: { esm: "^3.2.25" } }, "22.15.0"), true);
  assert.equal(needsLegacyNode({ devDependencies: { esm: "^3.2.25" } }, "20.18.3"), false);
  assert.equal(needsLegacyNode({ devDependencies: { vite: "8.3.4" } }, "22.15.0"), false);
  assert.equal(needsLegacyNode({ devDependencies: { esm: "npm:@httptoolkit/esm@3" } }, "22.15.0"), false);
  assert.equal(LEGACY_NODE.version, "20.18.3"); assert.match(LEGACY_NODE.sha256, /^[a-f0-9]{64}$/);
});

test("目录执行：真实文件读写、过滤环境、独立服务端口与停止清理", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-local-"));
  const guest = new LocalGuest(directory, randomUUID());
  const signal = new AbortController().signal;
  await guest.init(signal);
  t.after(async () => { await guest.stop(); await rm(directory, { recursive: true, force: true }); });
  assert.equal(guest.isolated, false);
  assert.equal(inDirectory(guest.root, join(guest.root, "repo")), true);
  assert.equal(inDirectory(guest.root, directory), false);
  await assert.rejects(guest.run("node", ["--version"], { cwd: directory }), /工作目录/);
  const root = join(guest.root, "repo"); await mkdir(root);
  await mkdir(join(root, "node_modules", "broken"), { recursive: true });
  await assert.rejects(guest.resetDependencies(directory), /仅可重装/);
  await guest.resetDependencies(root);
  const html = '<!doctype html><html><body><button>本地真实服务</button></body></html>';
  const write = await guest.run("node", ["-e", GUEST_HELPERS.files, root, "index.html", "write", "-"], {
    cwd: root, signal, input: Buffer.from(html).toString("base64"),
  });
  assert.equal(write.exitCode, 0, write.stderr);
  const read = await guest.run("node", ["-e", GUEST_HELPERS.files, root, "index.html", "read"], { cwd: root, signal });
  assert.equal(read.stdout, html);
  const dist = await guest.run("node", ["-e", GUEST_HELPERS.files, root, "dist/index.js", "write", "-"], { cwd: root, input: Buffer.from("export default 1").toString("base64") });
  assert.equal(dist.exitCode, 0);
  const listing = await guest.run("node", ["-e", GUEST_HELPERS.list], { cwd: root });
  assert.deepEqual(JSON.parse(listing.stdout), ["dist/index.js", "index.html"]);
  const env = await guest.run("node", ["-e", "console.log(JSON.stringify({key:!!process.env.MINIMAX_API_KEY,home:process.env.HOME,port:process.env.PORT}))"], { cwd: root });
  const data = JSON.parse(env.stdout); assert.equal(data.key, false); assert.equal(data.port, String(guest.port));
  assert.ok(inDirectory(guest.root, data.home));
  await guest.startService("node", ["-e", GUEST_HELPERS.server, root, String(guest.port), "127.0.0.1"], { cwd: root, ttl: 60000 });
  let response;
  for (let i = 0; i < 30; i++) {
    try { response = await fetch(await guest.domain()); break; } catch { await new Promise((done) => setTimeout(done, 50)); }
  }
  assert.equal(response?.status, 200, await guest.serviceLog());
  assert.equal(await response.text(), html);
  await guest.stop();
  await assert.rejects(fetch(await guest.domain(), { signal: AbortSignal.timeout(1000) }));
});

test("目录命令超时会结束本轮进程，不依赖 Docker", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-local-timeout-"));
  const guest = new LocalGuest(directory, randomUUID()); await guest.init(new AbortController().signal);
  t.after(async () => { await guest.stop(); await rm(directory, { recursive: true, force: true }); });
  await assert.rejects(guest.run("node", ["-e", "setInterval(()=>{},1000)"], { timeout: 150 }), /超时/);
});

import { mkdir, readFile, writeFile, appendFile, rename } from "node:fs/promises";
import { join, posix } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { zipSync, unzipSync, strToU8 } from "fflate";
import { setTimeout as delay } from "node:timers/promises";
import { changedExcerpt } from "../shared/workbench.js";
import { createSandbox, SANDBOX_TTL } from "./sandbox.js";

export function sourcePath(path, { directory = false } = {}) {
  if (directory && (path === "." || path === "")) return ".";
  if (typeof path !== "string" || path.length > 240 || path.startsWith("/") ||
    path.split("/").some((p) => !p || p === "." || p === ".." || /[\\:\x00-\x1f]/.test(p)) ||
    path.split("/").some((p) => /^(?:\.git|node_modules|\.env(?:\..*)?)$/i.test(p)))
    throw new Error("只允许项目内的相对路径，不可访问 .git、依赖目录或环境文件。");
  return path;
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
export class SourceRun {
  constructor(directory, id = randomUUID()) {
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id)) throw new Error("运行编号无效。");
    this.id = id; this.root = join(directory, ".cache", "source-runs", id); this.queue = Promise.resolve();
  }
  async init() { await mkdir(this.root, { recursive: true }); }
  async write(name, value) {
    if (!["state.json", "delivery.json", "commands.json", "source.zip", "checkpoint.zip", "browser.json", "browser-plan.json"].includes(name)) throw new Error("记录名无效。");
    const bytes = Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2);
    this.queue = this.queue.then(async () => {
      const temporary = join(this.root, name + ".tmp");
      await writeFile(temporary, bytes);
      await rename(temporary, join(this.root, name));
    });
    await this.queue;
  }
  async read(name) {
    if (!["state.json", "delivery.json", "commands.json", "source.zip", "checkpoint.zip", "events.ndjson", "browser.json", "browser-plan.json"].includes(name)) throw new Error("记录名无效。");
    return readFile(join(this.root, name));
  }
  event(event) { this.queue = this.queue.then(() => appendFile(join(this.root, "events.ndjson"), JSON.stringify(event) + "\n")); }
  async writeBrowserFile(name, bytes) {
    if (!/^[a-f0-9-]{36}\.jpg$/.test(name)) throw new Error("浏览器截图名无效。");
    await mkdir(join(this.root, "browser"), { recursive: true });
    await writeFile(join(this.root, "browser", name), bytes);
  }
  async readBrowserFile(name) {
    if (!/^[a-f0-9-]{36}\.jpg$/.test(name)) throw new Error("浏览器截图名无效。");
    return readFile(join(this.root, "browser", name));
  }
}

// Runner helper supports both local directories and Linux guests. Path checks
// protect the file tools; local directory mode is not an OS security boundary.
const FILE_HELPER = String.raw`
const fs=require('node:fs'),p=require('node:path');const [root,name,action,data]=process.argv.slice(1);
const base=p.resolve(root),full=p.resolve(base,name),rel=p.relative(base,full);if(p.isAbsolute(rel)||rel==='..'||rel.startsWith('..'+p.sep))throw Error('outside repository');
let walk=base;for(const part of rel.split(p.sep).filter(Boolean)){walk=p.join(walk,part);let s;try{s=fs.lstatSync(walk)}catch(e){if(e.code!=='ENOENT')throw e}if(s&&s.isSymbolicLink())throw Error('symlink denied')}
if(action==='read'){const s=fs.statSync(full);if(!s.isFile()||s.size>180000)throw Error('file too large');process.stdout.write(fs.readFileSync(full,'utf8'))}
if(action==='write'){fs.mkdirSync(p.dirname(full),{recursive:true});fs.writeFileSync(full,Buffer.from(data==='-'?fs.readFileSync(0,'utf8'):data,'base64'))}
`;
const SNAPSHOT_HELPER = String.raw`
const cp=require('node:child_process'),fs=require('node:fs'),p=require('node:path'),c=require('node:crypto');
const paths=[...new Set(cp.execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{maxBuffer:3000000}).toString().split('\0').filter(Boolean))].sort();
for(const dir of ['.',process.argv[1]||'.'])for(const name of ['package-lock.json','pnpm-lock.yaml','yarn.lock']){const file=p.join(dir,name).split(p.sep).join('/');if(fs.existsSync(file)&&!paths.includes(file))paths.push(file)}paths.sort();
if(paths.length>3000)throw Error('repository exceeds 3000 source files');
const files={};let size=0;for(const name of paths){if(name.split('/').some(x=>/^\.env(?:\.|$)|^node_modules$|^\.git$/.test(x)))continue;const s=fs.lstatSync(name);if(!s.isFile())continue;size+=s.size;if(size>20000000)throw Error('source export >20MB');files[name]=fs.readFileSync(name).toString('base64')}
console.log(JSON.stringify(files));`;
const LIST_HELPER = String.raw`
const fs=require('node:fs'),p=require('node:path'),out=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.isSymbolicLink()||/^(?:node_modules|\.git|\.env(?:\..*)?)$/.test(entry.name))continue;const f=p.join(dir,entry.name);if(entry.isDirectory())walk(f);else if(entry.isFile())out.push(p.relative('.',f).split(p.sep).join('/'));if(out.length>5000)throw Error('file list exceeds limit')}}
walk('.');console.log(JSON.stringify(out.sort()));`;
export function protectedSource(path) {
  return /(?:^|\/)(?:tests?|__tests__|\.github)(?:\/|$)|(?:^|[.\/-])(?:test|spec)(?:[.\/-]|$)|(?:jest|vitest|ava|mocha|nyc|c8)[.-]config/i.test(path);
}
export function verifyProtected(baseline, current, initialPackage) {
  const issues = [];
  for (const [path, bytes] of Object.entries(baseline))
    if (protectedSource(path) && current[path] !== bytes) issues.push(`原有测试或配置被修改：${path}`);
  try {
    const pkg = JSON.parse(Buffer.from(current[initialPackage.path] || "", "base64").toString());
    for (const key of ["build", "test"])
      if (pkg.scripts?.[key] !== initialPackage.scripts[key]) issues.push(`禁止替换原项目 scripts.${key}`);
  } catch { issues.push("原项目 package.json 无效或被删除"); }
  return issues;
}

// Trusted static server uses a separate origin and a filtered child environment.
const STATIC_SERVER = String.raw`
const http=require('node:http'),fs=require('node:fs'),p=require('node:path');const root=p.resolve(process.argv[1]);const within=f=>{const r=p.relative(root,f);return !p.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+p.sep)};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
http.createServer((req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.split('/').some(x=>x.startsWith('.')||x==='node_modules'))throw Error();let f=p.resolve(root,'.'+path);if(!within(f))throw Error();if(fs.statSync(f).isDirectory())f=p.join(f,'index.html');f=fs.realpathSync(f);if(!within(f))throw Error();if(fs.statSync(f).size>10000000)throw Error();res.writeHead(200,{'Content-Type':types[p.extname(f)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors http://127.0.0.1:* http://localhost:*; form-action 'none'"});fs.createReadStream(f).pipe(res)}catch{res.writeHead(404);res.end('Not found')}}).listen(Number(process.argv[2]||3000),process.argv[3]||'0.0.0.0');`;

export const GUEST_HELPERS = Object.freeze({ files: FILE_HELPER, snapshot: SNAPSHOT_HELPER, list: LIST_HELPER, server: STATIC_SERVER });

export class SourceProject {
  constructor(directory, repo, run, { guestFactory = createSandbox, fetcher = fetch, browserRequired = true } = {}) {
    this.directory = directory; this.repo = repo; this.run = run; this.factory = guestFactory; this.fetcher = fetcher;
    this.commands = []; this.projectDirectory = "."; this.demo = null; this.lastTests = null;
    this.createdAt = Date.now(); this.installed = null;
    this.progress = new AsyncLocalStorage();
    this.fileContents = new Map();
    this.browserRequired = browserRequired; this.browserHistory = [];
  }
  async command(label, cmd, args, { signal, cwd, timeout = 180000, detached = false, input, activity = {} } = {}) {
    const release = await this.control?.enter({ actor: this.progress.getStore()?.actor, label, kind: activity.kind || "command",
      command: cmd === "node" && args[0] === "-e" ? undefined : [cmd, ...args].join(" ").slice(0, 1500), path: activity.path }, signal);
    try { return await this.executeCommand(label, cmd, args, { signal, cwd, timeout, detached, input, activity }); }
    finally { await release?.(); }
  }
  async executeCommand(label, cmd, args, { signal, cwd, timeout, detached, input, activity }) {
    this.progress.getStore()?.(label);
    const notify = this.progress.getStore();
    const helper = cmd === "node" && args[0] === "-e";
    const visibleOutput = !helper || ["read", "write"].includes(activity.kind);
    const step = { id: randomUUID(), kind: helper ? "inspect" : "command", label,
      command: helper ? undefined : [cmd, ...args].map((arg) => /\s/.test(arg) ? JSON.stringify(arg) : arg).join(" ").slice(0, 1500),
      startedAt: new Date().toISOString(), ...activity };
    notify?.(label, { ...step, status: "running" });
    let output = "", lastOutput = 0;
    const onOutput = visibleOutput && !helper ? (chunk) => {
      output = (output + chunk).slice(-6000);
      if (Date.now() - lastOutput < 200) return;
      lastOutput = Date.now(); notify?.(label, { ...step, status: "running", output });
    } : undefined;
    const record = { label, command: [cmd, ...args], cwd: cwd || this.root, startedAt: new Date().toISOString() };
    let result;
    try { result = await this.guest.run(cmd, args, { cwd: cwd || this.root, signal, timeout, detached, input, onOutput, limit: 32_000_000 }); }
    catch (error) { result = { exitCode: 124, stdout: "", stderr: signal?.aborted ? "任务已停止。" : error.message }; }
    Object.assign(record, result, { endedAt: new Date().toISOString() });
    if (label === "记录工作树文件") record.stdout = "[工作树快照已读取；完整源码见交付包]";
    // Logs, including failures, are recorded before their results are returned.
    this.commands.push(record); await this.run.write("commands.json", this.commands);
    notify?.(label, { ...step, status: result.exitCode === 0 ? "completed" : "failed", exitCode: result.exitCode,
      output: visibleOutput ? (result.stdout + result.stderr).slice(activity.kind === "read" ? 0 : -6000, activity.kind === "read" ? 6000 : undefined) : "辅助操作已完成；完整记录保存在执行日志。",
      endedAt: record.endedAt });
    signal?.throwIfAborted();
    return result;
  }
  async checked(label, cmd, args, opts) {
    const result = await this.command(label, cmd, args, opts);
    if (result.exitCode !== 0) throw new Error(`${label}失败（退出码 ${result.exitCode}）：${result.stderr.slice(-2000) || result.stdout.slice(-2000)}`);
    return result;
  }
  async init(signal) {
    this.guest = await this.factory(this.directory, this.run.id, signal); this.root = `${this.guest.root}/repo`;
    try {
      await this.guest.networkAccess(true);
      if (this.repo.workspaceSnapshotDirectory && this.guest.provider !== "local") throw new Error("当前工作区副本需使用本机目录方式。");
      await this.checked(this.repo.workspaceSnapshotDirectory ? "克隆本仓库当前源码的固定快照" : "克隆原始 GitHub 仓库", "git", ["-c", "core.hooksPath=/dev/null", "clone", "--no-checkout", "--no-hardlinks", "--depth", "1", this.repo.workspaceSnapshotDirectory || `${this.repo.url}.git`, this.root], { signal, cwd: this.guest.root });
      await this.checked("获取固定 commit", "git", ["fetch", "--depth", "1", "origin", this.repo.commit], { signal });
      await this.checked("检出原始源码", "git", ["-c", "core.hooksPath=/dev/null", "checkout", "--detach", this.repo.commit], { signal });
      const head = await this.checked("核对上游版本", "git", ["rev-parse", "HEAD"], { signal });
      if (head.stdout.trim() !== this.repo.commit) throw new Error("克隆版本与固定 commit 不一致。");
      const nodeVersion = await this.checked("记录 Node 运行时版本", "node", ["--version"], { signal });
      this.runtime = { node: nodeVersion.stdout.trim(), image: this.guest.provider === "local" ? null : this.guest.provider === "docker" ? "node:22-bookworm" : "vercel/sandbox/node:22",
        directory: this.guest.provider === "local" ? this.root : undefined, isolated: this.guest.provider !== "local" };
      this.baseline = await this.snapshot(signal);
    } finally { await this.guest.networkAccess(false); }
    if (this.previousSourceRunId) await this.restoreDelivery(this.previousSourceRunId, signal);
    else if (this.repo.workspaceSource) await this.selectProject(this.repo.workspaceSource.projectDirectory, signal);
    if (this.previousCheckpointRunId) await this.restoreCheckpoint(this.previousCheckpointRunId, signal);
    if (this.repo.workspaceSource && !this.demo && this.initialPackage?.scripts.preview)
      this.configureDemo({ script: "preview", path: "/1014_codex_project/003-lofi-room/?view=workspace", args: ["--host", "0.0.0.0", "--port", "3000", "--strictPort"] });
    await this.run.write("state.json", { id: this.run.id, repository: this.repo.url, commit: this.repo.commit,
      provider: this.guest.provider, sandboxId: this.guest.id, status: "running", expiresAt: new Date(this.createdAt + SANDBOX_TTL).toISOString() });
  }
  async snapshot(signal) {
    const r = await this.checked("记录工作树文件", "node", ["-e", SNAPSHOT_HELPER, this.projectDirectory], { signal });
    return JSON.parse(r.stdout);
  }
  async restoreDelivery(id, signal) {
    const previous = new SourceRun(this.directory, id);
    const delivery = JSON.parse(await previous.read("delivery.json"));
    if (!delivery.tests?.passed || delivery.repository !== this.repo.url || delivery.commit !== this.repo.commit)
      throw new Error("上一轮交付与当前仓库固定版本不一致，不可继承。");
    const archive = unzipSync(await previous.read("source.zip"));
    const files = Object.fromEntries(Object.entries(archive).filter(([path]) => path.startsWith("source/")).map(([path, bytes]) => [sourcePath(path.slice(7)), Buffer.from(bytes).toString("base64")]));
    if (hash(JSON.stringify(files)) !== delivery.tests.digest) throw new Error("上一轮源码归档与验证摘要不一致。");
    await this.selectProject(delivery.projectDirectory, signal);
    // Replay only verified source changes through the same original-test guard.
    for (const [path, content] of Object.entries(files)) {
      if (content !== this.baseline[path]) await this.write(path, Buffer.from(content, "base64").toString("utf8"), signal);
    }
    this.package = JSON.parse(await this.read(this.initialPackage.path, signal));
    this.configureDemo(delivery.demo);
    this.previousSourceRunId = id;
    this.progress.getStore()?.("已继承上一轮通过验证的源码与 Demo，按新的体验反馈修改");
  }
  async restoreCheckpoint(id, signal) {
    if (!this.repo.workspaceSource) throw new Error("草稿续接仅适用于当前工作区的固定快照。");
    const previous = new SourceRun(this.directory, id);
    const archive = unzipSync(await previous.read("checkpoint.zip"));
    const metadata = JSON.parse(Buffer.from(archive[".lofi-workspace-source.json"] || []).toString());
    if (metadata.snapshotId !== this.repo.workspaceSource.snapshotId || metadata.url !== this.repo.url) throw new Error("草稿与本轮固定快照不匹配。");
    const files = Object.fromEntries(Object.entries(archive).map(([path, content]) => [sourcePath(path), Buffer.from(content).toString("base64")]));
    const issues = verifyProtected(this.baseline, files, this.initialPackage);
    if (issues.length) throw new Error(issues.join("；"));
    for (const [path, content] of Object.entries(files)) if (content !== this.baseline[path]) await this.write(path, Buffer.from(content, "base64").toString("utf8"), signal);
    this.package = JSON.parse(await this.read(this.initialPackage.path, signal));
    this.progress.getStore()?.("恢复上一轮未验证草稿，继续审阅、测试和修复");
  }
  async listFiles(signal) {
    const result = await this.checked("查看当前工作目录文件（含新增文件和构建产物）", "node", ["-e", LIST_HELPER], { signal });
    return JSON.parse(result.stdout);
  }
  async read(path, signal) {
    sourcePath(path);
    const result = await this.checked(`阅读原仓库 · ${path}`, "node", ["-e", FILE_HELPER, this.root, path, "read"], { signal, activity: { kind: "read", path } });
    this.fileContents.set(path, result.stdout);
    return result.stdout;
  }
  async selectProject(directory, signal) {
    if (this.initialPackage) {
      if (sourcePath(directory, { directory: true }) === this.projectDirectory) return { directory: this.projectDirectory, scripts: this.package.scripts };
      throw new Error("本轮已经固定项目目录，不可更换。");
    }
    this.projectDirectory = sourcePath(directory, { directory: true });
    const path = this.projectDirectory === "." ? "package.json" : `${this.projectDirectory}/package.json`;
    if (!this.baseline[path]) throw new Error("该目录没有原有 package.json；当前执行器支持 Node.js 项目，请选择真实子项目目录。");
    const pkg = JSON.parse(await this.read(path, signal));
    if (!pkg.scripts?.build || !pkg.scripts?.test) throw new Error("该原项目需同时具有 build、test 脚本。不会用生成的假测试替代原项目测试。");
    this.initialPackage = { path, scripts: { ...pkg.scripts } };
    this.package = pkg;
    if (this.guest.configureProjectRuntime) {
      const compatible = await this.guest.configureProjectRuntime(pkg, { signal, onProgress: (label) => this.progress.getStore()?.(label) });
      if (compatible) {
        const checked = await this.checked("记录项目兼容Node运行时", "node", ["--version"], { signal });
        this.runtime = { ...this.runtime, node: checked.stdout.trim(), compatibility: compatible };
      }
    }
    return { directory: this.projectDirectory, scripts: pkg.scripts, packageManager: pkg.packageManager || "从锁文件识别" };
  }
  get cwd() { return posix.join(this.root, this.projectDirectory); }
  manager() {
    const prefix = this.projectDirectory === "." ? "" : `${this.projectDirectory}/`;
    return this.baseline[prefix + "pnpm-lock.yaml"] ? "pnpm" : this.baseline[prefix + "yarn.lock"] ? "yarn" : "npm";
  }
  async dependenciesKey(signal) {
    const files = await this.snapshot(signal), prefix = this.projectDirectory === "." ? "" : `${this.projectDirectory}/`;
    return hash(["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", ".yarnrc.yml"]
      .map((name) => `${name}\0${files[prefix + name] || ""}`).join("\0"));
  }
  async install(signal, { force = false } = {}) {
    if (!this.initialPackage) await this.selectProject(".", signal);
    const pkg = await this.read(this.initialPackage.path, signal);
    const key = await this.dependenciesKey(signal);
    if (!force && !this.lastInstallFailed && this.installed === key) return { exitCode: 0, stdout: "依赖已安装（配置未变化）", stderr: "" };
    const manager = this.manager(), prefix = this.projectDirectory === "." ? "" : `${this.projectDirectory}/`;
    await this.guest.networkAccess(true);
    try {
      if ((force || this.lastInstallFailed) && this.guest.resetDependencies) {
        this.progress.getStore()?.("清理中断安装的依赖目录，保留源码与下载缓存");
        await this.guest.resetDependencies(this.cwd);
      }
      const cmd = manager === "npm" ? "npm" : "corepack";
      const changedPackage = Buffer.from(pkg).toString("base64") !== this.baseline[this.initialPackage.path];
      const modernYarn = /^yarn@[2-9]/.test(this.package.packageManager || "") || Boolean(this.baseline[prefix + ".yarnrc.yml"]);
      const args = manager === "npm" ? [this.baseline[prefix + "package-lock.json"] && !changedPackage ? "ci" : "install", "--no-audit", "--no-fund", "--prefer-offline"] :
        [manager, "install", ...(manager === "pnpm" ? [changedPackage ? "--no-frozen-lockfile" : "--frozen-lockfile"] : modernYarn ? ["--immutable"] : ["--frozen-lockfile", "--non-interactive"])];
      const result = await this.command(this.guest.provider === "local" ? "在本轮独立目录安装原项目依赖" : "在隔离环境安装原项目依赖", cmd, args, { signal, cwd: this.cwd, timeout: this.guest.provider === "local" ? 900000 : 300000 });
      this.lastInstallFailed = result.exitCode !== 0;
      if (result.exitCode === 0) this.installed = await this.dependenciesKey(signal);
      else this.installed = null;
      return result;
    } finally { await this.guest.networkAccess(false); }
  }
  async write(path, content, signal) {
    sourcePath(path);
    if (Buffer.byteLength(content) > 120000) throw new Error("单文件最多 120KB。");
    if (this.baseline[path] && protectedSource(path)) throw new Error("原有测试及测试配置受保护，请修复源码；可新增回归测试。");
    if (this.initialPackage?.path === path) {
      const candidate = JSON.parse(content);
      for (const key of ["build", "test"])
        if (candidate.scripts?.[key] !== this.initialPackage.scripts[key]) throw new Error(`不可替换原有 ${key} 脚本。`);
    }
    const before = this.fileContents.get(path) ?? Buffer.from(this.baseline[path] || "", "base64").toString("utf8");
    await this.checked(`修改原项目 · ${path}`, "node", ["-e", FILE_HELPER, this.root, path, "write", "-"], { signal, input: Buffer.from(content).toString("base64"),
      activity: { kind: "write", path, ...changedExcerpt(before, content) } });
    this.fileContents.set(path, content);
    this.lastTests = null;
  }
  configureDemo({ script, path, staticRoot = ".", args = [] }) {
    if (this.browserPlan?.entryPath) {
      if (path !== undefined && path !== this.browserPlan.entryPath) throw new Error(`本轮已冻结的浏览器验收入口为${this.browserPlan.entryPath}，不能丢失子路径或查询参数；省略path保留同一入口。`);
      path = this.browserPlan.entryPath;
    }
    path ??= this.demo?.script === (script || null) ? this.demo.path : "/";
    if (!path.startsWith("/") || path.startsWith("//") || /[#\\\x00-\x20]/.test(path)) throw new Error("Demo 地址路径无效。");
    if (script && !Object.hasOwn(this.initialPackage.scripts, script)) throw new Error("只可启动原有 npm 脚本；新增 Demo 使用静态模式。");
    this.demo = { script: script || null, path, staticRoot: sourcePath(staticRoot, { directory: true }), args };
    this.lastTests = null;
    return this.demo;
  }
  async build(signal) {
    const manager = this.manager();
    return this.command("运行原项目 build", manager === "npm" ? "npm" : "corepack",
      [...(manager === "npm" ? [] : [manager]), "run", "build"], { signal, cwd: this.cwd, timeout: 240000 });
  }
  async verify(signal) {
    const current = await this.snapshot(signal), checks = [];
    const add = (name, passed, detail = "") => checks.push({ name, passed, detail });
    const guard = verifyProtected(this.baseline, current, this.initialPackage);
    add("原有构建命令、测试命令及测试文件保持完整", guard.length === 0, guard.join("\n"));
    const install = await this.install(signal);
    add("原项目依赖安装", install.exitCode === 0, (install.stderr || install.stdout).slice(-4000));
    if (!guard.length && install.exitCode === 0) {
      for (const script of ["build", "test"]) {
        const manager = this.manager();
        const result = await this.command(`运行原项目 ${script}`, manager === "npm" ? "npm" : "corepack",
          [...(manager === "npm" ? [] : [manager]), "run", script], { signal, cwd: this.cwd, timeout: 240000 });
        add(`原项目 ${script}（退出码 ${result.exitCode}）`, result.exitCode === 0, (result.stdout + result.stderr).slice(-10000));
        if (result.exitCode !== 0 && /Cannot find module|MODULE_NOT_FOUND|ELSPROBLEMS/.test(result.stdout + result.stderr)) {
          this.installed = null; this.lastInstallFailed = true;
        }
      }
      const prefix = this.projectDirectory === "." ? "" : this.projectDirectory + "/";
      const addedTests = Object.keys(current).filter((path) => path.startsWith(prefix) && !this.baseline[path] && /\.(?:test|spec)\.[cm]?js$/.test(path)).slice(0, 30);
      if (addedTests.length) {
        const result = await this.command("运行本轮新增回归测试", "node", ["--test", ...addedTests.map((path) => path.slice(prefix.length))], { signal, cwd: this.cwd, timeout: 240000 });
        add(`新增回归测试（退出码 ${result.exitCode}）`, result.exitCode === 0, (result.stdout + result.stderr).slice(-10000));
      }
    }
    add("开发员已配置可打开的 Demo", Boolean(this.demo));
    if (checks.every((c) => c.passed)) {
      try { const url = await this.startDemo(signal); add("Demo HTTP 健康检查", true, url); }
      catch (error) { add("Demo HTTP 健康检查", false, error.message); }
    }
    const after = await this.snapshot(signal);
    // Lifecycle scripts must not rewrite the protected tests either.
    const postGuard = verifyProtected(this.baseline, after, this.initialPackage);
    add("构建测试后再次核对测试完整性", postGuard.length === 0, postGuard.join("\n"));
    this.lastTests = { passed: checks.every((c) => c.passed), passedCount: checks.filter((c) => c.passed).length,
      total: checks.length, checks, digest: hash(JSON.stringify(after)), testedAt: new Date().toISOString(),
      scope: "原仓库依赖安装、原有 build/test 退出码及 Demo HTTP 可达性；不代表已完成全部浏览器交互验收" };
    return this.lastTests;
  }
  async startDemo(signal) {
    const manager = this.manager();
    const spec = this.demo.script ? [manager === "npm" ? "npm" : "corepack", [
      ...(manager === "npm" ? [] : [manager]), "run", this.demo.script, "--", ...this.demo.args,
    ]] : ["node", ["-e", STATIC_SERVER, posix.join(this.cwd, this.demo.staticRoot),
      String(this.guest.port || 3000), this.guest.provider === "local" ? "127.0.0.1" : "0.0.0.0"]];
    if (this.guest.startService) {
      this.progress.getStore()?.("启动原项目本机 Demo 服务");
      const result = await this.guest.startService(spec[0], spec[1], { cwd: this.cwd,
        ttl: Math.max(1000, this.createdAt + SANDBOX_TTL - Date.now()) });
      this.commands.push({ label: "启动原项目本机 Demo 服务", command: [spec[0], ...spec[1]], cwd: this.cwd,
        ...result, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() });
      await this.run.write("commands.json", this.commands);
    } else {
      await this.command("关闭上一轮 Demo 服务", "bash", ["-c", "if test -f /tmp/lofi-demo.pid; then kill -- -$(cat /tmp/lofi-demo.pid) 2>/dev/null || true; fi"], { signal });
      await this.checked("启动原项目 Demo 服务", "bash", ["-c",
        'setsid "$@" >/tmp/lofi-demo.log 2>&1 & echo $! >/tmp/lofi-demo.pid', "lofi", ...[spec[0], ...spec[1]]], { signal, cwd: this.cwd });
    }
    const origin = await this.guest.domain();
    const url = new URL(this.demo.path, origin).href;
    let last = "服务未就绪";
    for (let i = 0; i < 25; i++) {
      signal.throwIfAborted();
      try {
        const response = await this.fetcher(url, { redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) });
        const type = response.headers.get("content-type") || "";
        if (response.ok && /text\/html/.test(type) && (await response.text()).length > 30) { this.demoUrl = url; return url; }
        await response.body?.cancel(); last = `HTTP ${response.status}（${type}）`;
      } catch (error) { last = error.message; }
      await delay(700, undefined, { signal });
    }
    const log = this.guest.serviceLog ? await this.guest.serviceLog() :
      JSON.stringify(await this.command("读取服务启动错误", "tail", ["-c", "4000", "/tmp/lofi-demo.log"], { signal }));
    throw new Error(`${last}\n${log}`);
  }
  acceptBrowser(report) {
    if (!this.lastTests) throw new Error("先完成原构建与测试，再进行浏览器验收。");
    const detail = report.error || report.cases.map((c) => `${c.passed ? "PASS" : "FAIL"} 验收${c.criterion} ${c.title}${c.passed ? "" : "\n" + c.steps?.filter((s) => !s.passed).map((s) => s.error || s.output).join("\n")}`).join("\n");
    const checks = [...this.lastTests.checks, { name: "浏览器按原需求操作与断言", passed: report.passed === true, detail }];
    this.lastTests = { ...this.lastTests, checks, passed: checks.every((c) => c.passed), total: checks.length,
      passedCount: checks.filter((c) => c.passed).length, browser: report,
      scope: "原依赖安装、build/test退出码、测试保护、HTTP可达性，以及所列原始需求的浏览器操作与断言；保留人工体验验收" };
    return this.lastTests;
  }
  async deliver(signal, { acceptance } = {}) {
    await this.control?.checkpoint(signal);
    if (this.control && this.lastTests?.controlVersion !== this.control.version) throw Object.assign(new Error("修改意见尚未重新验证。"), { intervention: true });
    if (this.browserRequired && !this.lastTests?.browser?.passed) throw new Error("浏览器功能验收未通过，禁止交付。");
    if (!this.lastTests?.passed || this.lastTests.digest !== hash(JSON.stringify(await this.snapshot(signal))))
      throw new Error("源码与通过验证的工作树不同，禁止交付。");
    // Recheck the live URL at delivery time, rather than relying on an old ping.
    const ping = await this.fetcher(this.demoUrl, { redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
    await ping.body?.cancel(); if (!ping.ok) throw new Error("交付前 Demo 已停止响应。");
    const files = await this.snapshot(signal);
    const delivery = { kind: "upstream", runId: this.run.id, repository: this.repo.url, commit: this.repo.commit,
      license: this.repo.license, provider: this.guest.provider, tests: this.lastTests, demoUrl: this.demoUrl,
      ...(this.task ? { task: this.task } : {}),
      ...(this.control ? { interventions: this.control.snapshot().notes } : {}),
      ...(this.repo.workspaceSource ? { workspaceSource: this.repo.workspaceSource } : {}),
      projectDirectory: this.projectDirectory, demo: this.demo,
      runtime: this.runtime,
      changes: Object.keys(files).filter((path) => files[path] !== this.baseline[path]),
      ...(this.previousSourceRunId ? { previousSourceRunId: this.previousSourceRunId } : {}),
      ...(this.previousCheckpointRunId ? { previousCheckpointRunId: this.previousCheckpointRunId } : {}),
      expiresAt: new Date(this.createdAt + SANDBOX_TTL).toISOString(), generatedAt: new Date().toISOString(),
      adaptation: this.guest.provider === "local" ? "本机独立目录克隆并修改原仓库，运行原有构建与测试后启动 Demo；当前用户权限，无系统隔离" : "隔离环境克隆并修改原仓库，运行原有构建与测试后启动 Demo",
      ...(acceptance ? { acceptance } : {}),
      downloadUrl: `api/source/runs/${this.run.id}/download`, manifestUrl: `api/source/runs/${this.run.id}/manifest` };
    const archive = Object.fromEntries(Object.entries(files).map(([path, content]) => [`source/${path}`, Buffer.from(content, "base64")]));
    archive["evidence/delivery.json"] = strToU8(JSON.stringify(delivery, null, 2));
    archive["evidence/commands.json"] = strToU8(JSON.stringify(this.commands, null, 2));
    if (this.browserHistory.length) {
      archive["evidence/browser.json"] = strToU8(JSON.stringify({ plan: this.browserPlan, attempts: this.browserHistory }, null, 2));
      for (const attempt of this.browserHistory) for (const scenario of attempt.cases) for (const step of scenario.steps || []) {
        if (step.screenshotFile) archive[`evidence/browser/${step.screenshotFile}`] = await this.run.readBrowserFile(step.screenshotFile);
      }
    }
    archive["README-交付.md"] = strToU8(`# 原仓库交付\n\n来源：${this.repo.url}\n固定版本：${this.repo.commit}\n许可证：${this.repo.license}\n\n${delivery.adaptation}\n\n打开：${delivery.demoUrl}\n有效期至：${delivery.expiresAt}\n\n源码位于 source/；依赖未打包。运行时：Node ${this.runtime.node}。请使用交付清单runtime记录的版本，在source下对应子项目目录执行 npm ci、npm run build、npm test。库项目静态Demo可在解压目录执行 python -m http.server 8080 --directory source，再打开对应Demo路径。实际命令和完整stdout/stderr位于evidence/commands.json；构建、测试、原测试文件完整性及HTTP验证结果均来自执行器。\n\n验证范围：${this.lastTests.scope}\n`);
    await this.control?.checkpoint(signal);
    if (this.control && this.lastTests?.controlVersion !== this.control.version) throw Object.assign(new Error("交付前收到新的修改意见，需要回到开发与验证。"), { intervention: true });
    this.control?.seal(this.lastTests?.controlVersion);
    await this.run.write("source.zip", Buffer.from(zipSync(archive)));
    await this.run.write("delivery.json", delivery); this.delivered = true;
    await this.run.write("state.json", { ...delivery, status: "complete" });
    return delivery;
  }
  async stop() { if (this.guest) await this.guest.stop(); }
  async checkpoint() {
    if (!this.baseline) return;
    const files = await this.snapshot(AbortSignal.timeout(15000));
    await this.run.write("checkpoint.zip", Buffer.from(zipSync(Object.fromEntries(
      Object.entries(files).map(([name, value]) => [name, Buffer.from(value, "base64")]),
    ))));
  }
}

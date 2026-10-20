// Directory execution is explicitly selected by the user. It separates work
// files and dependency caches, and does not provide OS or network isolation.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rm, lstat } from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute, join, delimiter } from "node:path";
import { legacyNode, needsLegacyNode } from "./node-runtime.js";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { StringDecoder } from "node:string_decoder";

const npmCli = resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const corepackCli = resolve(dirname(process.execPath), "node_modules/corepack/dist/corepack.js");
const launcher = fileURLToPath(new URL("./local-service.mjs", import.meta.url));
export function inDirectory(root, target) {
  const rel = relative(resolve(root), resolve(target));
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + (process.platform === "win32" ? "\\" : "/"));
}
export function localEnvironment(root, port, cache = join(root, "npm-cache")) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(?:PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key)));
  const home = join(root, "home");
  return { ...env, HOME: home, USERPROFILE: home, APPDATA: join(home, "AppData/Roaming"),
    LOCALAPPDATA: join(home, "AppData/Local"), TEMP: join(root, "tmp"), TMP: join(root, "tmp"),
    CI: "1", PORT: String(port), COREPACK_ENABLE_DOWNLOAD_PROMPT: "0", NO_COLOR: "1",
    NPM_CONFIG_CACHE: cache, NPM_CONFIG_USERCONFIG: join(home, ".npmrc"),
    NPM_CONFIG_GLOBALCONFIG: join(home, "global.npmrc"),
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: "core.longpaths", GIT_CONFIG_VALUE_0: "true",
    GIT_CONFIG_KEY_1: "core.hooksPath", GIT_CONFIG_VALUE_1: join(root, "hooks"),
  };
}
export async function killOwned(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((done) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      killer.on("error", done); killer.on("close", done);
    });
  } else {
    try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
  }
}
export function localCommand(binary, args, { cwd, env, signal, input, onOutput, timeout = 180000, limit = 32_000_000 } = {}) {
  return new Promise((done, fail) => {
    const child = spawn(binary, args, { cwd, env, shell: false, windowsHide: true,
      detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"] });
    let size = 0, error, settled = false;
    const out = [], err = [];
    const stop = (reason) => { if (error) return; error = reason; void killOwned(child); };
    const timer = setTimeout(() => stop(new Error("目录任务命令超时。")), timeout);
    const abort = () => stop(signal.reason || new Error("任务已停止。"));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const finish = (reason, code) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", abort);
      reason ? fail(reason) : done({ exitCode: code ?? 1, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") });
    };
    for (const [stream, chunks, channel] of [[child.stdout, out, "stdout"], [child.stderr, err, "stderr"]]) {
      const decoder = new StringDecoder("utf8");
      stream.on("data", (data) => {
      size += data.length;
      if (size > limit) stop(new Error("命令输出超过上限。"));
      else { chunks.push(data); onOutput?.(decoder.write(data), channel); }
      });
      stream.on("end", () => { const tail = decoder.end(); if (tail) onOutput?.(tail, channel); });
    }
    child.on("error", (reason) => finish(reason));
    child.on("close", (code) => finish(error, code));
    child.stdin.on("error", () => {}); child.stdin.end(input);
  });
}
function commandLine(command, args, runtime = {}) {
  if (command === "node") return [runtime.node || process.execPath, args];
  if (command === "npm") return [runtime.node || process.execPath, [runtime.npm || npmCli, ...args]];
  if (command === "corepack") {
    if (!existsSync(corepackCli)) throw new Error("当前 Node 安装没有 Corepack；请选择 npm 项目或安装项目需要的包管理器。");
    return [process.execPath, [corepackCli, ...args]];
  }
  if (command === "git") return ["git", args];
  throw new Error(`目录执行器未提供此命令：${command}`);
}
export async function probeLocal(directory) {
  if (!existsSync(npmCli)) return { available: false, provider: "local", reason: "当前 Node 安装中未找到 npm CLI。" };
  try {
    const result = await localCommand("git", ["--version"], { cwd: directory, env: localEnvironment(directory, 3000), timeout: 5000 });
    if (result.exitCode !== 0) throw new Error("git unavailable");
    return { available: true, provider: "local", isolated: false,
      reason: "独立目录已就绪 · 使用本机 Node/npm/Git，脚本以当前用户权限执行" };
  } catch { return { available: false, provider: "local", reason: "目录执行需要本机安装 Git 与 Node/npm。" }; }
}
export class LocalGuest {
  constructor(directory, id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("任务编号无效。");
    this.root = resolve(directory, ".cache", "source-workspaces", id).replaceAll("\\", "/");
    this.cache = resolve(directory, ".cache", "source-npm-cache");
    this.directory = directory; this.runtime = {};
    this.id = id; this.provider = "local"; this.isolated = false;
  }
  async init(signal) {
    signal.throwIfAborted();
    for (const name of ["home/AppData/Roaming", "home/AppData/Local", "tmp", "hooks"])
      await mkdir(join(this.root, name), { recursive: true });
    await writeFile(join(this.root, "home/.npmrc"), "");
    await writeFile(join(this.root, "home/global.npmrc"), "");
    await mkdir(this.cache, { recursive: true });
    const taskTemp = resolve(this.directory, ".cache", "task-tmp", this.id.slice(0, 16));
    await mkdir(taskTemp, { recursive: true });
    const server = createServer();
    await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
    this.port = server.address().port;
    await new Promise((done) => server.close(done));
    this.env = { ...localEnvironment(this.root, this.port, this.cache), TEMP: taskTemp, TMP: taskTemp };
  }
  async networkAccess() { /* Directory mode does not enforce network restrictions. */ }
  async configureProjectRuntime(pkg, options) {
    if (!needsLegacyNode(pkg)) return null;
    this.runtime = await legacyNode(this.directory, options);
    const key = Object.keys(this.env).find((key) => key.toUpperCase() === "PATH") || "PATH";
    this.env[key] = dirname(this.runtime.node) + delimiter + this.env[key];
    return this.runtime;
  }
  async resetDependencies(cwd) {
    const target = resolve(cwd, "node_modules");
    if (!inDirectory(this.root, cwd) || !inDirectory(this.root, target)) throw new Error("仅可重装本轮项目目录里的依赖。");
    try {
      const stat = await lstat(target);
      if (stat.isSymbolicLink()) throw new Error("依赖目录不能是符号链接。");
      await rm(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 500 });
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  async run(command, args = [], options = {}) {
    const cwd = options.cwd || this.root;
    if (!inDirectory(this.root, cwd)) throw new Error("命令工作目录必须位于本轮任务目录。");
    const [binary, parameters] = commandLine(command, args, this.runtime);
    return localCommand(binary, parameters, { ...options, cwd, env: this.env });
  }
  async startService(command, args, { cwd, ttl }) {
    await this.stopService();
    const parameters = args.map((arg) => arg === "0.0.0.0" ? "127.0.0.1" : arg === "3000" ? String(this.port) : arg);
    const [binary, actualArgs] = commandLine(command, parameters, this.runtime);
    const spec = join(this.root, "service.json");
    this.logPath = join(this.root, "service.log");
    await writeFile(spec, JSON.stringify({ binary, args: actualArgs, cwd, env: this.env, logPath: this.logPath, ttl }));
    this.service = spawn(process.execPath, [launcher, spec], { cwd: this.root, env: this.env,
      windowsHide: true, detached: true, stdio: "ignore" });
    await new Promise((done, fail) => { this.service.once("spawn", done); this.service.once("error", fail); });
    this.service.unref();
    return { exitCode: 0, stdout: `本机服务进程已启动 · PID ${this.service.pid}，等待 HTTP 验证`, stderr: "" };
  }
  async serviceLog() { try { return (await readFile(this.logPath, "utf8")).slice(-6000); } catch { return "服务尚无日志"; } }
  async stopService() { if (this.service) await killOwned(this.service); this.service = null; }
  async domain() { return `http://127.0.0.1:${this.port}`; }
  async stop() { await this.stopService(); }
}

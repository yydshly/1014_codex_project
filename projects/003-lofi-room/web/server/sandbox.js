// Local directory mode is explicitly authorized; Docker/cloud remain optional.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { Readable, Writable } from "node:stream";
import { Sandbox } from "@vercel/sandbox";
import { LocalGuest, probeLocal } from "./local-runner.js";

export const SANDBOX_TTL = 40 * 60 * 1000;
const DOWNLOAD_POLICY = { allow: Object.fromEntries([
  "github.com", "api.github.com", "raw.githubusercontent.com", "codeload.github.com",
  "objects.githubusercontent.com", "registry.npmjs.org", "registry.yarnpkg.com",
  "nodejs.org", "*.npmjs.org", "repo.yarnpkg.com",
].map((domain) => [domain, []])) };
const envAt = (path) => existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
export function sandboxConfig(directory) {
  const local = { ...envAt(resolve(directory, ".env")), ...envAt(resolve(directory, ".env.local")) };
  const pointer = process.env.LOFI_SANDBOX_ENV_FILE || local.LOFI_SANDBOX_ENV_FILE;
  const env = { ...(pointer ? envAt(resolve(directory, pointer)) : {}), ...local, ...process.env };
  let credentials = null;
  if (env.VERCEL_OIDC_TOKEN) {
    try {
      const claims = JSON.parse(Buffer.from(env.VERCEL_OIDC_TOKEN.split(".")[1], "base64url").toString());
      if (claims.owner_id && claims.project_id && (!claims.exp || claims.exp * 1000 > Date.now()))
        credentials = { token: env.VERCEL_OIDC_TOKEN, teamId: claims.owner_id, projectId: claims.project_id };
    } catch { /* Invalid/expired tokens cannot enable the runner. */ }
  } else if (env.VERCEL_TOKEN && env.VERCEL_TEAM_ID && env.VERCEL_PROJECT_ID)
    credentials = { token: env.VERCEL_TOKEN, teamId: env.VERCEL_TEAM_ID, projectId: env.VERCEL_PROJECT_ID };
  return {
    provider: env.LOFI_SANDBOX_PROVIDER || "local",
    docker: env.LOFI_DOCKER_PATH || (existsSync("C:/Program Files/Docker/Docker/resources/bin/docker.exe")
      ? "C:/Program Files/Docker/Docker/resources/bin/docker.exe" : "docker"),
    credentials,
  };
}

// No shell, no inherited API keys, bounded output, and a timeout for every host call.
export function dockerCall(binary, args, { input, signal, timeout = 30000, limit = 2_000_000 } = {}) {
  return new Promise((done, fail) => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
      /^(?:PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|DOCKER_HOST|DOCKER_CONTEXT|DOCKER_CONFIG)$/i.test(name)));
    const child = spawn(binary, args, { shell: false, windowsHide: true, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", size = 0, finished = false;
    const timed = setTimeout(() => { child.kill(); finish(new Error("隔离环境命令超时。")); }, timeout);
    const abort = () => { child.kill(); finish(signal.reason || new Error("任务已停止。")); };
    const finish = (error, exitCode) => {
      if (finished) return;
      finished = true; clearTimeout(timed); signal?.removeEventListener("abort", abort);
      error ? fail(error) : done({ exitCode, stdout, stderr });
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    for (const [stream, kind] of [[child.stdout, "out"], [child.stderr, "err"]]) stream.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) { child.kill(); return finish(new Error("命令输出超过上限。")); }
      if (kind === "out") stdout += chunk.toString(); else stderr += chunk.toString();
    });
    child.on("error", (error) => finish(error));
    child.on("close", (code) => finish(null, code ?? 1));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

export async function probeSandbox(directory) {
  const config = sandboxConfig(directory);
  if (config.provider === "local") return probeLocal(directory);
  if (["auto", "docker"].includes(config.provider)) {
    try {
      const info = await dockerCall(config.docker, ["info", "--format", "{{.OSType}}"], { timeout: 6000 });
      if (info.exitCode === 0 && info.stdout.trim() === "linux")
        return { available: true, provider: "docker", reason: "Docker Linux 引擎已就绪" };
    } catch { /* Missing CLI/daemon is an expected setup state. */ }
  }
  if (["auto", "vercel"].includes(config.provider) && config.credentials)
    return { available: true, provider: "vercel", reason: "已配置 Vercel Sandbox 凭据，创建时验证有效性" };
  return { available: false, provider: config.provider, reason:
    "需要启动 Docker Desktop（Linux 容器），或配置 Vercel Sandbox 凭据。原仓库命令不会在宿主机执行。" };
}

class DockerGuest {
  constructor(config, id) { this.binary = config.docker; this.id = `lofi-${id}`; this.network = `${this.id}-net`; this.root = "/workspace"; this.external = false; }
  async call(args, options) {
    const result = await dockerCall(this.binary, args, options);
    if (result.exitCode !== 0) throw new Error(`Docker 操作失败：${result.stderr.slice(-1000) || result.stdout.slice(-1000)}`);
    return result;
  }
  async init(signal) {
    await this.call(["network", "create", "--internal", "--label", "lofi.source-run", this.network], { signal });
    await this.call(["run", "--detach", "--rm", "--name", this.id, "--label", "lofi.source-run",
      "--init", "--user", "1000:1000", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges",
      "--memory=2g", "--cpus=2", "--pids-limit=256", "--network", this.network,
      "--publish", "127.0.0.1::3000", "--tmpfs", "/workspace:rw,exec,nosuid,size=4g,uid=1000,gid=1000",
      "--tmpfs", "/tmp:rw,exec,nosuid,size=512m,uid=1000,gid=1000", "--workdir", this.root,
      "--env", "HOME=/tmp/home", "--env", "CI=1", "--env", "PORT=3000", "--env", "COREPACK_ENABLE_DOWNLOAD_PROMPT=0",
      "node:22-bookworm", "node", "-e", `setTimeout(()=>process.exit(0),${SANDBOX_TTL})`], { signal, timeout: 300000 });
    const timer = setTimeout(() => this.stop().catch(() => {}), SANDBOX_TTL); timer.unref(); this.timer = timer;
  }
  async networkAccess(enabled) {
    if (this.external === enabled) return;
    await this.call(["network", enabled ? "connect" : "disconnect", "bridge", this.id]);
    this.external = enabled;
  }
  async run(cmd, args = [], { cwd = this.root, signal, timeout = 180000, input, limit, detached = false } = {}) {
    const options = ["exec", ...(detached ? ["--detach"] : ["--interactive"]), "--workdir", cwd, this.id,
      ...(detached ? [] : ["timeout", "--signal=KILL", `${Math.ceil(timeout / 1000)}s`]), cmd, ...args];
    return dockerCall(this.binary, options, { input, signal, timeout: timeout + 5000, limit });
  }
  async domain() {
    const { stdout } = await this.call(["port", this.id, "3000/tcp"]);
    const match = stdout.trim().match(/^127\.0\.0\.1:(\d+)$/);
    if (!match) throw new Error("未取得受限于本机的 Demo 端口。");
    return `http://127.0.0.1:${match[1]}`;
  }
  async stop() {
    clearTimeout(this.timer);
    await dockerCall(this.binary, ["rm", "--force", this.id]).catch(() => {});
    await dockerCall(this.binary, ["network", "rm", this.network]).catch(() => {});
  }
}

class VercelGuest {
  constructor(config) { this.credentials = config.credentials; this.root = "/vercel/sandbox"; }
  async init(signal) {
    this.vm = await Sandbox.create({ ...this.credentials, image: "vercel/sandbox/node:22", persistent: false,
      timeout: SANDBOX_TTL, ports: [3000], resources: { vcpus: 2 }, networkPolicy: "deny-all", signal });
    this.id = this.vm.name;
  }
  async networkAccess(enabled) { await this.vm.update({ networkPolicy: enabled ? DOWNLOAD_POLICY : "deny-all" }); }
  async run(cmd, args = [], { cwd = this.root, signal, timeout = 180000, input, limit = 2_000_000, detached = false } = {}) {
    let size = 0, running, exceeded = false;
    const output = { stdout: [], stderr: [] };
    const sink = (kind) => {
      const stream = new Writable({ write(chunk, encoding, done) {
        size += chunk.length;
        if (size > limit) {
          exceeded = true; running?.kill("SIGKILL").catch(() => {});
          return done(new Error("命令输出超过上限。"));
        }
        output[kind].push(Buffer.from(chunk)); done();
      } });
      stream.on("error", () => {}); return stream;
    };
    const result = await this.vm.runCommand({ cmd: detached ? cmd : "timeout",
      args: detached ? args : ["--signal=KILL", `${Math.ceil(timeout / 1000)}s`, cmd, ...args],
      cwd, env: { CI: "1", PORT: "3000", COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" }, detached,
      ...(input ? { stdin: Readable.from([input]) } : {}),
      ...(!detached ? { stdout: sink("stdout"), stderr: sink("stderr"), onStart: (command) => { running = command; } } : {}),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout + 10000)]) : AbortSignal.timeout(timeout + 10000) });
    if (detached) return { exitCode: 0, stdout: "服务进程已创建，等待健康检查", stderr: "" };
    if (exceeded) throw new Error("命令输出超过上限。");
    const stdout = Buffer.concat(output.stdout).toString("utf8"), stderr = Buffer.concat(output.stderr).toString("utf8");
    return { exitCode: result.exitCode, stdout, stderr };
  }
  async domain() { return this.vm.domain(3000); }
  async stop() { if (this.vm) await this.vm.stop(); }
}

export async function createSandbox(directory, id, signal) {
  const status = await probeSandbox(directory);
  if (!status.available) throw new Error(status.reason);
  const config = sandboxConfig(directory);
  const guest = status.provider === "local" ? new LocalGuest(directory, id) : status.provider === "docker" ? new DockerGuest(config, id) : new VercelGuest(config);
  guest.provider = status.provider;
  try { await guest.init(signal); return guest; }
  catch (error) { await guest.stop(); throw new Error(`无法创建隔离环境：${error.message}`); }
}

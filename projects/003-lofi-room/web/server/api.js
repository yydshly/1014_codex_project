import { loadConfig, publicConfig } from "./config.js";
import { SpeechService } from "./speech.js";
import { createLiveExecutor } from "./agents.js";
import { runCollaboration } from "../shared/workflow.js";
import { runRepositoryTask } from "./repository-agent.js";
import { RepositoryRun, parseRepository } from "./repository.js";
import { zipSync, strToU8 } from "fflate";
import { randomUUID } from "node:crypto";
import { runSourceTask } from "./source-agent.js";
import { SourceRun } from "./source-project.js";
import { probeSandbox } from "./sandbox.js";
import { restartDelivery } from "./delivery-service.js";
import { workspaceInfo } from "./workspace-source.js";
import { BackgroundTasks } from "./background-tasks.js";
import { createTakeoverResponder } from "./takeover-discussion.js";
import {
  contextSchema,
  discussionSchema,
  createDialogueExecutor,
} from "./discussion.js";

export const BASE = "/1014_codex_project/003-lofi-room/";
export async function readJSON(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64000)
      throw Object.assign(new Error("请求内容过长。"), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("请求内容不是有效 JSON。"), { status: 400 });
  }
}
function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

export function createApi({
  directory = process.cwd(),
  speech = new SpeechService(),
  getConfig = () => loadConfig(directory),
  dialogueFactory = createDialogueExecutor,
  repositoryTask = runRepositoryTask,
  sourceTask = runSourceTask,
  sandboxProbe = () => probeSandbox(directory),
  liveExecutor = createLiveExecutor,
  takeoverFactory = createTakeoverResponder,
} = {}) {
  let runs = 0;
  let discussions = 0;
  let execution = null;
  let maintenance = false;
  let background;
  let backgroundSubmissions = 0;
  const tasks = () => background ||= new BackgroundTasks(directory);
  const busy = () => runs > 0 || backgroundSubmissions > 0 || Boolean(background?.active);
  const acknowledgements = new Map();
  return async function api(req, res, next) {
    const path = new URL(req.url, "http://localhost").pathname.replace(
      BASE,
      "/",
    );
    if (!path.startsWith("/api/")) return next();
    try {
      const host = new URL(`http://${req.headers.host || ""}`);
      if (!["localhost", "127.0.0.1", "[::1]"].includes(host.hostname))
        return json(res, 403, { error: "实时接口仅接受本机访问。" });
      if (req.headers.origin && req.headers.origin !== host.origin)
        return json(res, 403, { error: "不允许跨站调用本地接口。" });
      if (req.method === "GET" && path === "/api/execution-status")
        return json(res, 200, { task: background?.execution() || execution, maintenance, checkedAt: new Date().toISOString() });
      if (req.method === "GET" && path === "/api/tasks") return json(res, 200, await tasks().list());
      const taskRoute = path.match(/^\/api\/tasks\/([a-f0-9-]{36})(?:\/(cancel|pause|feedback|resume|discuss))?$/);
      if (req.method === "GET" && taskRoute && !taskRoute[2]) {
        const query = new URL(req.url, "http://localhost").searchParams;
        const after = Number(query.get("after") || 0), limit = Number(query.get("limit") || 100);
        if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200)
          return json(res, 400, { error: "事件游标无效。" });
        return json(res, 200, await tasks().get(taskRoute[1], after, limit));
      }
      if (req.method === "GET" && path === "/api/workspace-source") {
        try { return json(res, 200, await workspaceInfo(directory)); }
        catch { return json(res, 200, { available: false, reason: "当前服务未找到本仓库工作区来源。" }); }
      }
      const restartRoute = path.match(/^\/api\/source\/runs\/([a-f0-9-]{36})\/restart$/);
      if (req.method === "POST" && restartRoute) {
        if (busy()) return json(res, 409, { error: "请先结束正在执行的任务，再启动已有成果。" });
        runs++;
        maintenance = true;
        try { return json(res, 200, await restartDelivery(directory, restartRoute[1])); }
        catch (error) { return json(res, 409, { error: error.message }); }
        finally { runs--; maintenance = false; }
      }
      if (req.method === "GET" && path === "/api/status")
        return json(res, 200, {
          ...publicConfig(getConfig()),
          repository: {
            enabled: Boolean(getConfig().apiKey),
            scope: "offline-demo-or-original-repository",
            sandbox: await sandboxProbe(),
          },
        });
      const browserImage = path.match(/^\/api\/source\/runs\/([a-f0-9-]{36})\/browser\/([a-f0-9-]{36}\.jpg)$/);
      if (req.method === "GET" && browserImage) {
        let bytes;
        try { bytes = await new SourceRun(directory, browserImage[1]).readBrowserFile(browserImage[2]); }
        catch { return json(res, 404, { error: "浏览器截图不存在。" }); }
        res.writeHead(200, { "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
        return res.end(bytes);
      }
      if (req.method === "GET" && /\/api\/source\/runs\/[^/]+\/browser\//.test(path)) return json(res, 404, { error: "浏览器截图名无效。" });
      const sourceRoute = path.match(/^\/api\/source\/runs\/([a-f0-9-]{36})\/(download|snapshot|manifest|logs|events|status|browser)$/);
      if (req.method === "GET" && sourceRoute) {
        const run = new SourceRun(directory, sourceRoute[1]);
        const name = { download: "source.zip", snapshot: "checkpoint.zip", manifest: "delivery.json", logs: "commands.json", events: "events.ndjson", status: "state.json", browser: "browser.json" }[sourceRoute[2]];
        let bytes;
        try { bytes = await run.read(name); } catch { return json(res, 404, { error: "该执行记录或交付尚不存在。" }); }
        const archive = ["download", "snapshot"].includes(sourceRoute[2]);
        res.writeHead(200, { "Content-Type": archive ? "application/zip" : sourceRoute[2] === "events" ? "application/x-ndjson" : "application/json; charset=utf-8",
          ...(archive ? { "Content-Disposition": `attachment; filename="source-${run.id.slice(0, 8)}.zip"` } : {}),
          "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        return res.end(bytes);
      }
      const deliveryRoute = path.match(
        /^\/api\/repository\/runs\/([a-f0-9-]{36})\/(demo|download|manifest)$/,
      );
      if (req.method === "GET" && deliveryRoute) {
        const run = new RepositoryRun(directory, deliveryRoute[1]);
        let delivery;
        try {
          delivery = JSON.parse(await run.read("delivery.json"));
        } catch {
          return json(res, 404, { error: "该任务尚无通过验证的交付。" });
        }
        if (
          !delivery.tests?.passed ||
          delivery.tests.digest !== (await run.digest())
        )
          return json(res, 409, { error: "交付文件发生变化，需要重新验证。" });
        if (deliveryRoute[2] === "manifest") return json(res, 200, delivery);
        const files = await run.files();
        if (deliveryRoute[2] === "download") {
          res.writeHead(200, {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="lofi-demo-${run.id.slice(0, 8)}.zip"`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          });
          return res.end(
            Buffer.from(
              zipSync(
                Object.fromEntries(
                  Object.entries(files).map(([name, content]) => [
                    name,
                    strToU8(content),
                  ]),
                ),
              ),
            ),
          );
        }
        const script = (code) => code.replace(/<\/script/gi, "<\\/script");
        const html = files["index.html"]
          .replace(
            /<link\b[^>]*href=["'](?:\.\/)?style\.css["'][^>]*>/gi,
            () =>
              `<style>${files["style.css"].replace(/<\/style/gi, "<\\/style")}</style>`,
          )
          .replace(
            /<script\b[^>]*src=["'](?:\.\/)?(core|app)\.js["'][^>]*>\s*<\/script>/gi,
            (_, name) => `<script>${script(files[`${name}.js`])}</script>`,
          );
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy":
            "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(html);
      }
      if (req.method !== "POST")
        return json(res, 405, { error: "该接口需要 POST 请求。" });
      const body = await readJSON(req);
      if (taskRoute?.[2]) return json(res, 200, { task: taskRoute[2] === "cancel" ? await tasks().cancel(taskRoute[1]) : await tasks().control(taskRoute[1], taskRoute[2], body) });
      if (path === "/api/tasks") {
        if (!["live", "repository"].includes(body.mode) || typeof body.goal !== "string" || !body.goal.trim() || body.goal.length > 400)
          return json(res, 400, { error: "请填写有效的真实任务与目标。" });
        if (!/^[a-f0-9-]{36}$/.test(body.requestId || "")) return json(res, 400, { error: "任务提交编号无效。" });
        const checked = contextSchema.safeParse(body.context || {});
        const client = body.client;
        if (!checked.success || !client || typeof client.goalId !== "string" || client.goalId.length > 80 ||
          client.runId !== body.requestId || typeof client.title !== "string" || !client.title.trim() || client.title.length > 80)
          return json(res, 400, { error: "任务关联或验收内容格式不正确。" });
        if (body.mode === "repository") {
          try { parseRepository(body.url); } catch (error) { return json(res, 400, { error: error.message }); }
          if (!["offline", "upstream"].includes(body.execution)) return json(res, 400, { error: "项目执行类型无效。" });
        }
        const config = getConfig();
        if (!config.apiKey) return json(res, 503, { error: "后台真实任务需要配置 MiniMax。" });
        if (body.mode === "repository" && body.execution === "upstream") {
          const sandbox = await sandboxProbe();
          if (!sandbox.available) return json(res, 503, { error: sandbox.reason, code: "SANDBOX_UNAVAILABLE" });
        }
        if (runs) return json(res, 429, { error: "已有真实任务或成果服务正在启动。" });
        const input = { requestId: body.requestId, mode: body.mode, goal: body.goal.trim(),
          ...(body.mode === "repository" ? { url: body.url, execution: body.execution } : {}),
          context: checked.data, client: { goalId: client.goalId, runId: client.runId, title: client.title.trim() } };
        backgroundSubmissions++;
        try {
          const task = await tasks().create(input, ({ signal, emit, control }) => body.mode === "repository"
            ? (body.execution === "upstream" ? sourceTask : repositoryTask)({ url: input.url, goal: input.goal,
              context: input.context, directory, config, signal, emit, control })
            : runCollaboration({ goal: input.goal, context: input.context, mode: "live", execute: liveExecutor(config), signal, emit }), [config.apiKey],
          { respondToFeedback: body.execution === "upstream" ? takeoverFactory(config) : undefined });
          return json(res, 202, { task });
        } finally { backgroundSubmissions--; }
      }
      if (path === "/api/repository/ack") {
        const pending = acknowledgements.get(body.ackId);
        if (!pending) return json(res, 404, { error: "阶段已结束或不存在。" });
        pending();
        acknowledgements.delete(body.ackId);
        return json(res, 200, { accepted: true });
      }
      if (path === "/api/repository/run") {
        if (body.execution !== undefined && !["offline", "upstream"].includes(body.execution))
          return json(res, 400, { error: "项目执行类型无效。" });
        try {
          parseRepository(body.url);
        } catch (error) {
          return json(res, 400, { error: error.message });
        }
        if (
          typeof body.goal !== "string" ||
          !body.goal.trim() ||
          body.goal.length > 400
        )
          return json(res, 400, { error: "请填写 1 至 400 字的 Demo 目标。" });
        const checked = contextSchema.safeParse(body.context || {});
        if (!checked.success)
          return json(res, 400, { error: "目标验收内容格式不正确。" });
        if (!getConfig().apiKey)
          return json(res, 503, { error: "真实项目任务需要配置 MiniMax。" });
        if (body.execution === "upstream") {
          const sandbox = await sandboxProbe();
          if (!sandbox.available) return json(res, 503, { error: sandbox.reason, code: "SANDBOX_UNAVAILABLE" });
        }
        if (busy())
          return json(res, 429, {
            error: "已有真实任务运行中，请先结束当前任务。",
          });
        const controller = new AbortController(),
          gates = new Map(),
          keys = new Set();
        runs++;
        execution = { mode: "repository", execution: body.execution || "offline", goal: body.goal.trim(), repository: body.url, startedAt: new Date().toISOString() };
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        res.on("close", () => {
          if (!res.writableEnded) controller.abort();
        });
        const heartbeat = setInterval(() => {
          if (!res.destroyed) res.write("\n");
        }, 12000);
        try {
          await (body.execution === "upstream" ? sourceTask : repositoryTask)({
            url: body.url,
            goal: body.goal.trim(),
            context: checked.data,
            directory,
            config: getConfig(),
            signal: controller.signal,
            emit: (event) => {
              if (
                body.sceneSync === true &&
                event.type === "agent.state" &&
                ["working", "reviewing", "testing"].includes(event.status)
              ) {
                const ackId = randomUUID();
                let resolve;
                const promise = new Promise((done) => {
                  resolve = done;
                });
                keys.add(ackId);
                acknowledgements.set(ackId, resolve);
                gates.set(event.actor, promise);
                event = { ...event, ackId };
              }
              if (!res.destroyed) res.write(JSON.stringify(event) + "\n");
            },
            waitForActor: async (actor, signal) => {
              if (!gates.has(actor)) return;
              const gateSignal = AbortSignal.any([
                signal,
                AbortSignal.timeout(600000),
              ]);
              await new Promise((resolve, reject) => {
                const abort = () =>
                  reject(
                    new Error(
                      signal.aborted
                        ? "任务已停止。"
                        : "等待场景确认超时，请重新开始。",
                    ),
                  );
                if (gateSignal.aborted) return abort();
                gateSignal.addEventListener("abort", abort, { once: true });
                gates.get(actor).then(() => {
                  gateSignal.removeEventListener("abort", abort);
                  resolve();
                });
              });
              signal.throwIfAborted();
            },
          });
        } catch {
          /* Repository workflow emits sanitized errors. */
        } finally {
          clearInterval(heartbeat);
          for (const key of keys) acknowledgements.delete(key);
          runs--;
          execution = null;
          res.end();
        }
        return;
      }
      if (path === "/api/discuss") {
        const checked = discussionSchema.safeParse(body);
        if (!checked.success)
          return json(res, 400, {
            error: "请检查目标、问题与讨论人物，内容不能超过规定长度。",
          });
        if (discussions)
          return json(res, 429, { error: "已有对话进行中，请结束后再试。" });
        const input = checked.data,
          execute = dialogueFactory(getConfig()),
          controller = new AbortController();
        discussions++;
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.flushHeaders();
        res.on("close", () => {
          if (!res.writableEnded) controller.abort();
        });
        const actors = [
            input.actor,
            ...(input.partner && input.partner !== input.actor
              ? [input.partner]
              : []),
          ],
          previous = [];
        try {
          for (const actor of actors) {
            const reply = await execute({
              ...input,
              actor,
              to: actors.find((a) => a !== actor) || null,
              previous,
              signal: controller.signal,
            });
            previous.push(reply);
            if (!controller.signal.aborted)
              res.write(JSON.stringify(reply) + "\n");
          }
          if (!controller.signal.aborted)
            res.write(JSON.stringify({ type: "discussion.complete" }) + "\n");
        } catch (error) {
          if (!controller.signal.aborted)
            res.write(
              JSON.stringify({
                type: "discussion.error",
                message: error.message,
              }) + "\n",
            );
        } finally {
          discussions--;
          res.end();
        }
        return;
      }
      if (path === "/api/speech") {
        const result = await speech.synthesize(body, getConfig());
        res.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
          "Content-Length": result.audio.length,
          "X-Voice-Provider": "MiniMax",
          "X-Voice-ID": encodeURIComponent(result.voiceId),
          "X-Audio-Duration": String(result.duration),
          "X-Voice-Cache": result.cached ? "hit" : "miss",
        });
        res.end(result.audio);
        return;
      }
      if (path === "/api/run") {
        if (
          typeof body.goal !== "string" ||
          !body.goal.trim() ||
          body.goal.length > 400
        )
          return json(res, 400, { error: "协作目标需为 1 至 400 字。" });
        if (body.mode !== "live")
          return json(res, 400, { error: "实时接口仅用于真实 Agent 模式。" });
        const context = contextSchema.safeParse(body.context);
        if (!context.success)
          return json(res, 400, { error: "验收要求或白板意见格式不正确。" });
        if (busy())
          return json(res, 429, {
            error: "已有真实协作正在执行，请等待或停止后重试。",
          });
        const execute = liveExecutor(getConfig()),
          controller = new AbortController();
        runs++;
        execution = { mode: "live", goal: body.goal.trim(), startedAt: new Date().toISOString() };
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        res.on("close", () => {
          if (!res.writableEnded) controller.abort();
        });
        try {
          await runCollaboration({
            goal: body.goal,
            mode: "live",
            execute,
            context: context.data,
            signal: controller.signal,
            emit: (event) => {
              if (!controller.signal.aborted)
                res.write(JSON.stringify(event) + "\n");
            },
          });
        } catch {
          /* workflow emits sanitized failure events */
        } finally {
          runs--;
          execution = null;
          res.end();
        }
        return;
      }
      return json(res, 404, { error: "接口不存在。" });
    } catch (error) {
      if (!res.headersSent)
        json(res, error.status || 503, { error: error.message });
      else res.end();
    }
  };
}
export function collaborationApi() {
  const middleware = createApi();
  return {
    name: "lofi-collaboration-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

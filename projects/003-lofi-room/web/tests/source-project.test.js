import test from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { Script } from "node:vm";
import { unzipSync, strFromU8 } from "fflate";
import { SourceRun, SourceProject, sourcePath, verifyProtected, GUEST_HELPERS } from "../server/source-project.js";
import { runSourceTask, createSourceExecutor, sourceCallCanRetry, createRepairDiscussion, inheritBrowserEvidence } from "../server/source-agent.js";
import { createApi, BASE } from "../server/api.js";
import { TEAM_BY_ID } from "../shared/team.js";
import { dockerCall } from "../server/sandbox.js";
import { restartDelivery } from "../server/delivery-service.js";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import { ExecutionControl } from "../server/execution-control.js";

const commit = "a".repeat(40), signal = new AbortController().signal;
const repo = { url: "https://github.com/example/original", owner: "example", repo: "original", commit, license: "MIT" };

test("模型生成旧操作期间接管，旧工具不会提交，下一步读取最新意见后交接", async (t) => {
  const { project } = await fixture(t); project.control = new ExecutionControl({ signal });
  let calls = 0;
  const model = new MockLanguageModelV4({ doStream: async (options) => {
    if (!calls++) {
      await project.control.pause({ actor: "mori", version: 0 });
      await project.control.feedback({ actor: "mori", version: 0, text: "保留源码，先检查边界条件" });
      await project.control.resume({ actor: "mori", version: 1 });
    } else assert.match(JSON.stringify(options.prompt), /保留源码，先检查边界条件/);
    return { stream: simulateReadableStream({ initialDelayInMs: 0, chunkDelayInMs: 0, chunks: [
      { type: "tool-call", toolCallId: randomUUID(), toolName: "publish_result", input: JSON.stringify({ title: calls === 1 ? "旧计划" : "新计划", summary: "交接", content: "实际公开计划", verdict: "approve" }) },
      { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage: { inputTokens: { total: 10 }, outputTokens: { total: 10 } } },
    ] }) };
  } });
  const output = await createSourceExecutor({ apiKey: "fixture", baseURL: "https://api.minimax.cn", textModel: "mock" }, { ...repo, readme: "fixture", files: [] }, project, { model })({
    role: TEAM_BY_ID.mori, stage: "plan", goal: "规划任务", context: {}, inputs: [], revision: 0, signal, onTool() {} });
  assert.equal(output.title, "新计划"); assert.equal(output.controlVersion, 1); assert.equal(calls, 2);
});

test("重新配置同一Demo脚本不丢失既有子路径，切换静态模式仍使用独立入口", () => {
  const project = Object.create(SourceProject.prototype);
  project.initialPackage = { scripts: { preview: "vite preview" } };
  project.demo = { script: "preview", path: "/1014_codex_project/003-lofi-room/?view=workspace" };
  const configured = project.configureDemo({ script: "preview", args: ["--port", "3000"] });
  assert.equal(configured.path, "/1014_codex_project/003-lofi-room/?view=workspace");
  assert.deepEqual(configured.args, ["--port", "3000"]);
  assert.equal(project.configureDemo({ staticRoot: "." }).path, "/");
  assert.equal(project.configureDemo({ script: "preview", path: "/chosen/" }).path, "/chosen/");
  project.browserPlan = { entryPath: "/1014_codex_project/003-lofi-room/?view=workspace" };
  assert.throws(() => project.configureDemo({ script: "preview", path: "/1014_codex_project/003-lofi-room/" }), /不能丢失/);
  assert.equal(project.configureDemo({ script: "preview" }).path, project.browserPlan.entryPath);
});

test("先验收现有版本只准备依赖，不调用模型写源码或假称验证通过", async () => {
  const calls = [];
  const project = { demo: { script: "preview", path: "/app/" }, async install() { calls.push("install"); return { exitCode: 0 }; } };
  const execute = createSourceExecutor({ apiKey: "test", baseURL: "https://api.minimax.cn", textModel: "test" }, repo, project);
  const result = await execute({ role: TEAM_BY_ID.indigo, stage: "develop", revision: 0, context: { verifyCurrentFirst: true }, signal: new AbortController().signal, onTool: (text) => calls.push(text) });
  assert.equal(result.data.baseline, true); assert.match(result.summary, /源码保持不变/);
  assert.equal(calls[0], "install"); assert.match(result.content, /没有写入源码/);
});

test("自动返工对话传递实际浏览器失败，开发员读取验证员的前序发言", async () => {
  const calls = [], speeches = [];
  const discuss = createRepairDiscussion({}, async (input) => {
    calls.push(input); return { type: "speech", actor: input.actor, to: input.to, text: input.actor === "momo" ? "预期禁用，实际仍启用，请修复" : "我会检查新建草稿状态与归档按钮", content: "模型替身的公开对话" };
  });
  const artifact = { title: "原版", summary: "未修改", content: "真实源码等待验收" };
  const testResult = { ...artifact, data: { tests: { browser: { passed: false, cases: [{ criterion: 1, passed: false, title: "草稿不得归档旧目标", steps: [{ passed: false, action: "assertEnabled", expected: false, actual: true, screenshot: "actual.jpg" }] }] } } } };
  const replies = await discuss({ goal: "修复草稿归档", context: { criteria: ["新建草稿禁用归档"], notes: [] }, draft: artifact, review: artifact, test: testResult, revision: 1, signal: new AbortController().signal, onSpeech: (reply) => speeches.push(reply) });
  assert.deepEqual(calls.map((c) => c.actor), ["momo", "indigo"]);
  assert.equal(calls[1].previous[0].actor, "momo");
  assert.match(calls[0].artifacts[0].content, /"expected":false,"actual":true/);
  assert.equal(speeches.length, 2); assert.equal(replies.length, 2);
});

test("检查点续跑保留同一原需求的冻结用例与截图，但旧通过记录不直接放行新交付", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-browser-resume-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const previous = new SourceRun(directory), current = new SourceRun(directory); await previous.init(); await current.init();
  const image = "00000000-0000-4000-8000-000000000001.jpg";
  const criteria = ["新建草稿禁用归档"], cases = [{ criterion: 1, title: "归档状态", kind: "browser", steps: [
    { action: "click", target: { selector: "#new" }, description: "新建草稿" },
    { action: "assertEnabled", target: { selector: "#archive" }, checked: false, description: "归档禁用" },
  ] }];
  await previous.writeBrowserFile(image, Buffer.from("actual recorded bytes"));
  await previous.write("browser.json", { plan: { goal: "修复草稿", criteria, cases }, attempts: [{ round: 1, passed: false, cases: [{ criterion: 1, steps: [{ screenshotFile: image, screenshot: "original-url" }] }] }] });
  const project = { directory, previousCheckpointRunId: previous.id, run: current, progress: new AsyncLocalStorage() };
  await inheritBrowserEvidence(project, "其它目标", criteria); assert.equal(project.browserPlan, undefined);
  await inheritBrowserEvidence(project, "修复草稿", criteria);
  assert.equal(project.browserHistory[0].originalRunId, previous.id);
  assert.equal(project.browserPlan.cases[0].steps[1].checked, false);
  assert.equal(project.lastTests, undefined, "历史记录不能变成当前验证结果");
  const step = project.browserHistory[0].cases[0].steps[0]; assert.equal(step.originalScreenshot, "original-url"); assert.match(step.screenshot, new RegExp(current.id));
  assert.equal((await current.readBrowserFile(image)).toString(), "actual recorded bytes");
});
const encode = (text) => Buffer.from(text).toString("base64");
const initial = { "package.json": encode(JSON.stringify({ scripts: { build: "original-build", test: "original-test" } })),
  "src/index.js": encode("export const add=(a,b)=>a+b"), "test/original.test.js": encode("original assertions"), "README.md": encode("Original project") };
test("成功HTTP响应的解析中断可重试，鉴权与参数错误不循环重试", () => {
  for (const statusCode of [undefined, 200, 429, 503]) assert.equal(sourceCallCanRetry({ statusCode }), true);
  for (const statusCode of [400, 401, 403]) assert.equal(sourceCallCanRetry({ statusCode }), false);
});
test("并行命令与事件保存串行写入完整记录", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-source-journal-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const run = new SourceRun(directory); await run.init();
  await Promise.all(Array.from({ length: 30 }, (_, index) => {
    run.event({ type: "tool", seq: index });
    return run.write("commands.json", Array.from({ length: index + 1 }, (_, id) => ({ id, stdout: "output".repeat(100) })));
  }));
  await run.queue;
  assert.equal(JSON.parse(await run.read("commands.json")).length, 30);
  assert.equal((await run.read("events.ndjson")).toString().trim().split("\n").map(JSON.parse).length, 30);
});

test("送入沙箱的可信辅助脚本可被 Node 编译；不在宿主机执行仓库源码", () => {
  for (const code of Object.values(GUEST_HELPERS)) assert.doesNotThrow(() => new Script(code));
});

test("宿主 Docker CLI 调用不继承 API 密钥或任务秘密", async () => {
  process.env.LOFI_TEST_SECRET = "not-for-child";
  try {
    const result = await dockerCall(process.execPath, ["-e", "console.log(process.env.LOFI_TEST_SECRET||'absent')"]);
    assert.equal(result.exitCode, 0); assert.equal(result.stdout.trim(), "absent");
  } finally { delete process.env.LOFI_TEST_SECRET; }
});

// Guest protocol simulator only: these tests do not claim to have run Docker,
// npm lifecycle scripts or a real upstream project on this machine.
class FakeGuest {
  constructor() { this.root = "/guest"; this.provider = "test-guest"; this.id = "test-vm"; this.files = { ...initial }; this.calls = []; this.failTest = true; }
  async networkAccess(enabled) { this.calls.push({ network: enabled }); }
  async run(cmd, args, opts) {
    this.calls.push({ cmd, args, opts });
    if (cmd === "node" && args[0] === "--version") return { exitCode: 0, stdout: "v22.0.0-test-guest", stderr: "" };
    if (cmd === "git" && args[0] === "rev-parse") return { exitCode: 0, stdout: commit, stderr: "" };
    if (cmd === "node" && args[1].includes("const [root,name,action,data]")) {
      const [, , , path, action, data] = args;
      if (action === "read") return { exitCode: 0, stdout: Buffer.from(this.files[path], "base64").toString(), stderr: "" };
      this.files[path] = data === "-" ? opts.input : data;
    }
    if (cmd === "node" && args[1].includes("git',['ls-files'")) return { exitCode: 0, stdout: JSON.stringify(this.files), stderr: "" };
    if (cmd === "npm" && args[1] === "test" && this.failTest) return { exitCode: 1, stdout: "FAIL original assertion at test/original.test.js:4", stderr: "Expected 3, got 2" };
    return { exitCode: 0, stdout: "actual simulated command result", stderr: "" };
  }
  async domain() { return "https://guest.example.test"; }
  async stop() { this.stopped = true; }
}
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "lofi-source-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const run = new SourceRun(directory); await run.init(); const guest = new FakeGuest();
  const project = new SourceProject(directory, repo, run, { guestFactory: async () => guest, browserRequired: false,
    fetcher: async () => new Response("<!doctype html><h1>Real guest response</h1>", { headers: { "content-type": "text/html" } }) });
  await project.init(signal); await project.selectProject(".", signal);
  return { directory, run, guest, project };
}

test("原仓库路径与原有测试保护，拒绝替换构建测试脚本", async (t) => {
  for (const value of ["../x", "/x", "x/../../y", "C:/x", ".git/config", "a/.env.local", "node_modules/x", "x\\y"])
    assert.throws(() => sourcePath(value));
  const { project, guest } = await fixture(t);
  await assert.rejects(project.write("test/original.test.js", "always pass", signal), /受保护/);
  await assert.rejects(project.write("package.json", '{"scripts":{"build":"true","test":"true"}}', signal), /不可替换/);
  const changed = { ...guest.files, "test/original.test.js": encode("fake pass") };
  assert.equal(verifyProtected(initial, changed, project.initialPackage).length, 1);
  guest.files = changed; guest.failTest = false;
  const result = await project.verify(signal);
  assert.equal(result.passed, false);
  assert.ok(!guest.calls.some((c) => c.cmd === "npm" && c.args[0] === "run"));
});
test("体验反馈的新一轮继承已验证源码和入口，同时保留原测试保护", async (t) => {
  const { directory, project, guest, run } = await fixture(t);
  await project.write("demo/index.html", "<!doctype html><html>上一轮成果</html>", signal);
  await project.write("src/index.js", "export const add=(a,b)=>Number(a)+Number(b)", signal);
  project.configureDemo({ path: "/demo/" }); guest.failTest = false;
  await project.verify(signal); await project.deliver(signal);
  const nextRun = new SourceRun(directory); await nextRun.init();
  const nextGuest = new FakeGuest();
  const next = new SourceProject(directory, repo, nextRun, { guestFactory: async () => nextGuest });
  next.previousSourceRunId = run.id;
  await next.init(signal);
  assert.equal(await next.read("demo/index.html", signal), "<!doctype html><html>上一轮成果</html>");
  assert.match(await next.read("src/index.js", signal), /Number/);
  assert.equal(next.demo.path, "/demo/");
  assert.equal(next.baseline["src/index.js"], initial["src/index.js"]);
  await assert.rejects(next.write("test/original.test.js", "fake", signal), /受保护/);
  const metadata = JSON.parse(await run.read("delivery.json"));
  await run.write("delivery.json", { ...metadata, repository: "https://github.com/another/repo" });
  await assert.rejects(next.restoreDelivery(run.id, signal), /不一致/);
});

test("克隆固定版本、依赖安装、真实退出码退回、修复重测与可达地址才交付", async (t) => {
  const { project, run, guest } = await fixture(t);
  assert.ok(guest.calls.some((c) => c.cmd === "git" && c.args.includes("clone") && c.args.includes(repo.url + ".git")));
  assert.ok(guest.calls.some((c) => c.cmd === "git" && c.args.includes("checkout") && c.args.includes(commit)));
  await project.write("demo/index.html", '<html><body><script type="module" src="../dist/index.js"></script></body></html>', signal);
  project.configureDemo({ path: "/demo/" });
  const failed = await project.verify(signal);
  assert.equal(failed.passed, false);
  assert.match(JSON.stringify(failed), /Expected 3/);
  await assert.rejects(project.deliver(signal), /禁止交付/);
  await project.write("src/index.js", "export const add=(a,b)=>Number(a)+Number(b)", signal);
  guest.failTest = false;
  const passed = await project.verify(signal);
  assert.equal(passed.passed, true);
  const delivery = await project.deliver(signal);
  assert.equal(delivery.kind, "upstream");
  assert.equal(delivery.demoUrl, "https://guest.example.test/demo/");
  assert.ok(delivery.changes.includes("src/index.js"));
  const archive = unzipSync(await run.read("source.zip"));
  assert.match(strFromU8(archive["source/src/index.js"]), /Number/);
  const logs = JSON.parse(strFromU8(archive["evidence/commands.json"]));
  assert.ok(logs.some((c) => c.exitCode === 1 && /Expected 3/.test(c.stderr)));
  assert.equal(logs.filter((c) => c.command[0] === "npm" && c.command[1] === "run" && c.command[2] === "test").length, 2);
  guest.files["src/index.js"] = encode("tampered after tests");
  await assert.rejects(project.deliver(signal), /源码与通过验证/);
  await project.checkpoint(); assert.ok(await run.read("checkpoint.zip"));
});

test("重启已有成果核对摘要、不重跑模型或原测试，交付包地址同步", async (t) => {
  const { project, guest, run, directory } = await fixture(t);
  guest.provider = "local"; guest.failTest = false;
  await project.write("demo/index.html", "<!doctype html><html>成果</html>", signal);
  project.configureDemo({ path: "/demo/" });
  await project.verify(signal); const original = await project.deliver(signal);
  guest.init = async () => {}; guest.configureProjectRuntime = async () => {};
  const refreshed = await restartDelivery(directory, run.id, { guestFactory: () => guest,
    fetcher: async () => new Response("<!doctype html><h1>existing result</h1>", { headers: { "content-type": "text/html" } }) });
  assert.equal(refreshed.tests.testedAt, original.tests.testedAt);
  assert.equal(refreshed.tests.digest, original.tests.digest);
  assert.ok(refreshed.serviceRestartedAt);
  const archive = unzipSync(await run.read("source.zip"));
  assert.equal(JSON.parse(strFromU8(archive["evidence/delivery.json"])).demoUrl, refreshed.demoUrl);
  const logs = JSON.parse(await run.read("commands.json"));
  assert.equal(logs.filter((c) => c.command[0] === "npm" && c.command.includes("test")).length, 1);
  guest.files["src/index.js"] = encode("unverified change");
  await assert.rejects(restartDelivery(directory, run.id, { guestFactory: () => guest }), /源码发生变化/);
});

test("原项目测试角色只使用执行器事实，不能由模型声称通过", async (t) => {
  const { project } = await fixture(t);
  const execute = createSourceExecutor({ apiKey: "not-a-real-key", baseURL: "https://api.minimax.cn", textModel: "MiniMax-M3" }, repo, project);
  const result = await execute({ role: TEAM_BY_ID.momo, stage: "test", signal, onTool: () => {} });
  assert.equal(result.verdict, "revise"); assert.equal(result.data.tests.passed, false);
  assert.match(result.content, /原项目 test/);
});

test("研究已读文件但模型未提交时，仅收束事实交接，不重复读写或假称测试通过", async (t) => {
  const { project, guest } = await fixture(t);
  const chunks = (toolName, input) => ({ stream: simulateReadableStream({ initialDelayInMs: 0, chunkDelayInMs: 0, chunks: [
    { type: "stream-start", warnings: [] }, ...(toolName ? [{ type: "tool-call", toolCallId: toolName + JSON.stringify(input), toolName, input: JSON.stringify(input) }] : []),
    { type: "finish", finishReason: { unified: toolName ? "tool-calls" : "stop", raw: undefined }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } },
  ] }) });
  const model = new MockLanguageModelV4({ doStream: [chunks("read_file", { path: "README.md" }), chunks("read_file", { path: "src/index.js" }), chunks(null),
    chunks("publish_result", { title: "研究交接", summary: "配置和核心文件已读取，交给开发员修改", content: "原build/test待验证员运行，目前未运行测试。", verdict: "approve" })] });
  const execute = createSourceExecutor({ apiKey: "fixture", baseURL: "https://api.minimax.cn", textModel: "mock" }, { ...repo, readme: "fixture", files: [] }, project, { model });
  const start = guest.calls.length;
  const result = await execute({ role: TEAM_BY_ID.amber, stage: "research", goal: "增加问候", context: { criteria: ["实际可操作"] }, inputs: [], revision: 0, signal, onTool() {} });
  assert.equal(result.title, "研究交接"); assert.match(result.content, /未运行测试/);
  assert.equal(model.doStreamCalls.length, 4);
  assert.equal(guest.calls.slice(start).filter((c) => c.args?.includes("read")).length, 2);
  assert.ok(!guest.calls.slice(start).some((c) => c.args?.includes("write") || c.cmd === "npm"));
});

test("续接已有固定项目先核对配置和说明，直接交接而不重新搜索全仓库", async (t) => {
  const { project, guest } = await fixture(t); project.previousCheckpointRunId = "existing-draft";
  const value = { title: "续接研究交接", summary: "已核对实际目录与原命令，交给开发员", content: "原build/test和已选目录保持不变，测试结果待验证员执行。", verdict: "approve" };
  const model = new MockLanguageModelV4({ doStream: [{ stream: simulateReadableStream({ initialDelayInMs: 0, chunkDelayInMs: 0, chunks: [
    { type: "stream-start", warnings: [] }, { type: "tool-call", toolCallId: "publish-recovered", toolName: "publish_result", input: JSON.stringify(value) },
    { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } },
  ] }) }] });
  const start = guest.calls.length;
  const result = await createSourceExecutor({ apiKey: "fixture", baseURL: "https://api.minimax.cn", textModel: "mock" }, { ...repo, readme: "fixture", files: [] }, project, { model })({ role: TEAM_BY_ID.amber, stage: "research", goal: "续接目标", context: { criteria: [] }, inputs: [], revision: 0, signal, onTool() {} });
  assert.equal(result.title, value.title); assert.equal(model.doStreamCalls.length, 1);
  assert.equal(guest.calls.slice(start).filter((c) => c.args?.includes("read")).length, 2);
  assert.ok(!guest.calls.slice(start).some((c) => c.cmd === "npm" || c.args?.includes("write")));
});

for (const stage of ["develop", "review"]) test(`${stage}工具事实完成但模型未交接时保留事实，审阅结论不能被自动改成通过`, async (t) => {
  const { project } = await fixture(t); project.configureDemo({ path: "/demo/" }); project.previousCheckpointRunId = "saved-draft";
  const chunk = (toolName, input) => ({ stream: simulateReadableStream({ initialDelayInMs: 0, chunkDelayInMs: 0, chunks: [
    { type: "stream-start", warnings: [] }, ...(toolName ? [{ type: "tool-call", toolCallId: toolName + JSON.stringify(input), toolName, input: JSON.stringify(input) }] : []),
    { type: "finish", finishReason: { unified: toolName ? "tool-calls" : "stop", raw: undefined }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } },
  ] }) });
  const value = { title: stage + "交接", summary: stage === "review" ? "目标功能未实现，需要继续修改" : "已有草稿待独立验证", content: "仅根据实际工具事实交接，未运行浏览器验收，不宣称交付。", verdict: stage === "review" ? "revise" : "approve" };
  const streams = [chunk("read_file", { path: "src/index.js" }), ...(stage === "review" ? [chunk("inspect_changes", {})] : []), chunk(null), chunk("publish_result", value)];
  const model = new MockLanguageModelV4({ doStream: streams });
  const result = await createSourceExecutor({ apiKey: "fixture", baseURL: "https://api.minimax.cn", textModel: "mock" }, { ...repo, readme: "fixture", files: [] }, project, { model })({ role: TEAM_BY_ID[stage === "develop" ? "indigo" : "luna"], stage, goal: "实现问候", context: { criteria: ["问候可操作"] }, inputs: [], revision: 1, signal, onTool() {} });
  assert.equal(result.verdict, value.verdict); assert.equal(result.title, value.title);
  assert.equal(project.lastTests, null, "角色交接不能生成假的测试通过记录");
});

test("角色失败保留证据并关闭沙箱，错误不泄露密钥", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-source-cleanup-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const events = [], project = { progress: new AsyncLocalStorage(), async stop() { this.closed = true; }, async checkpoint() { this.saved = true; } };
  await assert.rejects(runSourceTask({ directory, url: repo.url, goal: "test", config: { apiKey: "secret-sentinel" }, signal,
    emit: (e) => events.push(e), openRepo: async () => repo, projectFactory: () => project,
    executorFactory: () => async () => { throw new Error("failure secret-sentinel"); } }), /redacted/);
  assert.equal(project.closed, true); assert.equal(project.saved, true);
  assert.ok(!JSON.stringify(events).includes("secret-sentinel"));
  assert.ok(events.some((e) => e.type === "run.error")); assert.ok(!events.some((e) => e.type === "run.complete"));
});

test("停止原项目任务时保存快照、关闭沙箱并发送取消事件", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-source-cancel-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const controller = new AbortController(), events = [];
  const project = { progress: new AsyncLocalStorage(), async checkpoint() { this.saved = true; }, async stop() { this.closed = true; } };
  await assert.rejects(runSourceTask({ directory, url: repo.url, goal: "cancel", config: { apiKey: "test" }, signal: controller.signal,
    emit: (e) => events.push(e), openRepo: async () => repo, projectFactory: () => project,
    executorFactory: () => async () => { controller.abort(); controller.signal.throwIfAborted(); } }));
  assert.equal(project.closed, true); assert.equal(project.saved, true);
  assert.ok(events.some((e) => e.type === "run.cancelled"));
  assert.ok(!events.some((e) => e.type === "run.complete"));
});

test("API在无沙箱时明确503且不启动仓库命令，有沙箱时路由到原项目执行器", async (t) => {
  let available = false, started = 0;
  const api = createApi({ getConfig: () => ({ apiKey: "test", voices: {} }), sandboxProbe: async () => ({ available, reason: "沙箱未就绪" }),
    sourceTask: async ({ emit }) => { started++; emit({ type: "run.complete", execution: "upstream" }); } });
  const server = createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((done) => server.listen(0, "127.0.0.1", done)); t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}${BASE}api/repository/run`;
  const request = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: repo.url, goal: "run original", execution: "upstream" }) });
  let response = await request(); assert.equal(response.status, 503); assert.equal(started, 0);
  assert.equal((await response.json()).code, "SANDBOX_UNAVAILABLE");
  available = true; response = await request(); assert.equal(response.status, 200);
  assert.match(await response.text(), /run.complete/); assert.equal(started, 1);
});

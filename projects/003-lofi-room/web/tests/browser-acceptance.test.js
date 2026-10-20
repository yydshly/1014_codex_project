import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AsyncLocalStorage } from "node:async_hooks";
import { DemoBrowser, validateAcceptancePlan, demoAddress, normalizeBrowserAction } from "../server/browser-session.js";
import { verifyBrowserAcceptance } from "../server/browser-agent.js";
import { SourceRun, SourceProject } from "../server/source-project.js";
import { runCollaboration } from "../shared/workflow.js";
import { workstationState } from "../shared/workstation.js";
import { createApi, BASE } from "../server/api.js";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";

const criteria = ["输入姓名后点击问候，显示你好，小蓝；清除后输入为空"];
const plan = { cases: [{ criterion: 1, kind: "browser", title: "问候和清除", steps: [
  { action: "fill", target: { selector: "#name" }, value: "小蓝", description: "输入小蓝" },
  { action: "click", target: { role: "button", name: "问候" }, description: "点击问候" },
  { action: "assertText", target: { selector: "#result" }, value: "你好，小蓝", description: "核对原需求的问候结果" },
  { action: "click", target: { role: "button", name: "清除" }, description: "点击清除" },
  { action: "assertValue", target: { selector: "#name" }, value: "", description: "核对清除结果" },
] }] };
// Empty strings are valid expectations for clearing fields.
const html = (fixed) => `<!doctype html><html lang="zh"><meta charset="utf-8"><title>浏览器验收夹具</title><label>姓名<input id="name"></label><select id="source"><option value="github">GitHub</option><option value="workspace">当前工作区</option></select><button id="greet">问候</button><button id="clear">清除</button><p id="result"></p><script>
document.querySelector('#greet').onclick=()=>document.querySelector('#result').textContent=${fixed ? "'你好，'+document.querySelector('#name').value" : "'页面能打开，但问候没实现'"};
document.querySelector('#clear').onclick=()=>document.querySelector('#name').value='';</script></html>`;
const technical = () => ({ passed: true, checks: [{ name: "原项目 build（退出码 0）", passed: true }, { name: "原项目 test（退出码 0）", passed: true },
  { name: "原有构建命令、测试命令及测试文件保持完整", passed: true }, { name: "Demo HTTP 健康检查", passed: true }], digest: "fixture", total: 4, passedCount: 4 });
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "lofi-browser-"));
  let fixed = false;
  const server = createServer((req, res) => { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(html(fixed)); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const run = new SourceRun(directory); await run.init();
  const project = { directory, run, browserHistory: [], browserPlan: plan, progress: new AsyncLocalStorage(),
    demoUrl: `http://127.0.0.1:${server.address().port}/`, lastTests: technical(), acceptBrowser: SourceProject.prototype.acceptBrowser };
  return { project, fix: () => { fixed = true; } };
}

test("验收用例逐条覆盖、包含交互与断言，HTTP不能替代功能，禁止越源", () => {
  assert.equal(validateAcceptancePlan(plan, criteria).cases.length, 1);
  assert.throws(() => validateAcceptancePlan(plan, [...criteria, "第二条未覆盖"]), /漏项/);
  assert.throws(() => validateAcceptancePlan({ cases: [{ ...plan.cases[0], steps: [plan.cases[0].steps[0]] }] }, criteria), /断言/);
  assert.throws(() => validateAcceptancePlan({ cases: [{ criterion: 1, title: "冒充验收", kind: "project", check: "http" }] }, criteria), /不能只用/);
  assert.throws(() => validateAcceptancePlan({ cases: [plan.cases[0], plan.cases[0]] }, criteria), /额外验收/);
  assert.throws(() => validateAcceptancePlan({ cases: [{ ...plan.cases[0], path: "projects/003-lofi-room/web" }] }, criteria), /浏览器URL/);
  assert.throws(() => validateAcceptancePlan({ cases: [{ ...plan.cases[0], steps: [...plan.cases[0].steps.slice(0, 2), { action: "assertValue", target: { selector: "#name", exact: false }, value: "蓝", description: "含糊的部分匹配" }] }] }, criteria), /comparison/);
  assert.throws(() => demoAddress("http://127.0.0.1:4000/", "http://127.0.0.1:4175/"), /本轮Demo/);
  assert.throws(() => demoAddress("https://demo.test/", "javascript:alert(1)"), /本轮Demo/);
});

test("真实浏览器发现功能缺失并保存实际截图，固定用例返工后重测通过才交付", async (t) => {
  const { project, fix } = await fixture(t), controller = new AbortController(), activities = [], events = [];
  project.browserPlan = validateAcceptancePlan(plan, criteria);
  const fixedPlan = JSON.stringify(project.browserPlan);
  const config = { apiKey: "fixture-not-a-real-key", textModel: "test" };
  const result = await runCollaboration({ goal: criteria[0], context: { criteria }, mode: "repository", signal: controller.signal,
    maxRevisions: 1, emit: (e) => events.push(e), execute: async ({ stage, revision, role }) => {
      if (stage === "develop" && revision) fix();
      if (stage === "test") {
        project.lastTests = technical();
        const tests = await project.progress.run((label, activity) => { if (activity) activities.push({ type: "work.activity", actor: "momo", stage, activity }); },
          () => verifyBrowserAcceptance(project, { config, signal: controller.signal, goal: criteria[0], criteria }));
        return { title: "真实浏览器夹具结果", summary: tests.passed ? "功能操作通过" : "问候结果不符，请修复", content: JSON.stringify(tests), verdict: tests.passed ? "approve" : "revise", data: { tests } };
      }
      if (stage === "record") assert.equal(project.lastTests.browser.passed, true, "未通过浏览器验收不得进入交付");
      return { title: stage, summary: `${role.name}提交夹具阶段`, content: "测试夹具，仅浏览器操作真实执行；不表示本次运行了MiniMax或原项目构建。", verdict: "approve" };
    } });
  assert.ok(result.reportId);
  assert.deepEqual(project.browserHistory.map((a) => a.passed), [false, true]);
  assert.equal(JSON.stringify(project.browserPlan), fixedPlan, "返工不得改变测试预期");
  const failure = activities.find((e) => e.activity.status === "failed").activity;
  assert.equal(failure.expected, "你好，小蓝"); assert.match(failure.actual, /没实现/);
  assert.ok((await project.run.readBrowserFile(failure.screenshotFile)).length > 1000);
  assert.ok(events.some((e) => e.type === "revision"));
  assert.ok(events.findIndex((e) => e.type === "revision") < events.findIndex((e) => e.type === "run.complete"));
  const state = workstationState({ live: true, events: activities }, "momo");
  assert.equal(state.browser.kind, "browser"); assert.match(state.output, /PASS/);
  const journal = JSON.parse(await project.run.read("browser.json"));
  assert.equal(journal.attempts.length, 2); assert.equal(journal.attempts[0].cases[0].passed, false);
  if (process.env.LOFI_BROWSER_EVIDENCE_DIR) {
    const output = process.env.LOFI_BROWSER_EVIDENCE_DIR; await mkdir(output, { recursive: true });
    await writeFile(join(output, "fixture-flow.json"), JSON.stringify({ scope: "确定性回归夹具：真实浏览器操作，角色结果由测试驱动；未调用MiniMax，未运行原仓库构建测试。", plan: project.browserPlan, attempts: journal.attempts, events }, null, 2));
    await writeFile(join(output, "fixture-failed.jpg"), await project.run.readBrowserFile(failure.screenshotFile));
    const last = activities.findLast((e) => e.activity.screenshotFile).activity;
    await writeFile(join(output, "fixture-passed.jpg"), await project.run.readBrowserFile(last.screenshotFile));
  }
});

test("浏览器环境失败不能伪装成验收通过，取消会关闭执行器且禁止交付", async (t) => {
  const { project } = await fixture(t); let closed = false;
  const controller = new AbortController();
  const tests = await verifyBrowserAcceptance(project, { config: { apiKey: "secret" }, signal: controller.signal, goal: criteria[0], criteria,
    browserFactory: () => ({ async open() { throw new Error("Chromium unavailable secret"); }, async close() { closed = true; } }) });
  assert.equal(tests.passed, false); assert.equal(closed, true); assert.match(tests.browser.error, /redacted/);
  assert.ok(!JSON.stringify(tests).includes("secret"));
  const guard = { browserRequired: true, lastTests: technical() };
  await assert.rejects(SourceProject.prototype.deliver.call(guard, controller.signal), /浏览器功能验收未通过/);
  const browser = new DemoBrowser(project); await browser.open(controller.signal); controller.abort();
  await assert.rejects(browser.step(plan.cases[0].steps[0], 1)); await browser.close(); assert.equal(browser.browser, null);
});

test("模型观察后未提交计划时，只收束同一需求计划，仍须真实浏览器操作通过", async (t) => {
  const { project, fix } = await fixture(t); fix(); project.browserPlan = null;
  const finish = (content, reason) => ({ stream: simulateReadableStream({ initialDelayInMs: 0, chunkDelayInMs: 0, chunks: [
    { type: "stream-start", warnings: [] }, ...content, { type: "finish", finishReason: { unified: reason, raw: undefined }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } },
  ] }) });
  const model = new MockLanguageModelV4({ doStream: [finish([], "stop"), finish([{ type: "tool-call", toolCallId: "submit-final-plan", toolName: "submit_plan", input: JSON.stringify(plan) }], "tool-calls")] });
  const tests = await verifyBrowserAcceptance(project, { model, config: { apiKey: "fixture", textModel: "mock" }, signal: new AbortController().signal, goal: criteria[0], criteria });
  assert.equal(tests.passed, true); assert.equal(model.doStreamCalls.length, 2);
  assert.ok(tests.browser.cases[0].steps.some((s) => s.action === "assertText" && s.actual === "你好，小蓝"));
});

test("规划前校验真实控件类型和选项值，无效用例不能冻结后驱动开发员改错源码", async (t) => {
  const { project } = await fixture(t), browser = new DemoBrowser(project), controller = new AbortController();
  try {
    const observation = await browser.open(controller.signal);
    assert.deepEqual(observation.controls.find((c) => c.id === "source").options.map((o) => o.value), ["github", "workspace"]);
    await assert.rejects(browser.validateTargets({ cases: [{ path: "/unvisited/", steps: [] }] }), /已实际访问/);
    await assert.rejects(browser.validateTargets({ cases: [{ steps: [{ action: "assertValue", target: { selector: "#greet" }, value: "disabled", description: "按钮状态" }] }] }), /不能读取.*输入值/);
    await assert.rejects(browser.validateTargets({ cases: [{ steps: [{ action: "select", target: { selector: "#source" }, value: "current-workspace", description: "错误的选项" }] }] }), /真实选项/);
    const status = await browser.step({ action: "assertEnabled", target: { selector: "#greet" }, checked: true, description: "读取真实按钮状态" }, 1);
    assert.equal(status.passed, true); assert.equal(status.actual, true);
    await browser.step({ action: "fill", target: { selector: "#name" }, value: "为…增加新功能", description: "填入既有模板名称" }, 0);
    const contains = await browser.step({ action: "assertValue", target: { selector: "#name" }, value: "功能", comparison: "contains", description: "明确按包含匹配核对名称" }, 1);
    assert.equal(contains.passed, true); assert.equal(contains.actual, "为…增加新功能");
  } finally { await browser.close(); }
});

test("模型并行发出浏览器工具时仍按顺序填写、点击和读取，避免操作互相抢占", async (t) => {
  const { project, fix } = await fixture(t); fix();
  const browser = new DemoBrowser(project), controller = new AbortController();
  try {
    await browser.open(controller.signal);
    const results = await Promise.all([
      browser.enqueue(() => browser.step(plan.cases[0].steps[0], 0)),
      browser.enqueue(() => browser.step(plan.cases[0].steps[1], 0)),
      browser.enqueue(() => browser.step(plan.cases[0].steps[2], 0)),
    ]);
    assert.ok(results.every((r) => r.passed)); assert.equal(results[2].actual, "你好，小蓝");
    assert.ok(Date.parse(results[1].startedAt) >= Date.parse(results[0].endedAt));
  } finally { await browser.close(); }
});

test("模型给布尔字符串false时实际核对禁用状态，不能按默认启用制造假通过", async (t) => {
  const { project } = await fixture(t), browser = new DemoBrowser(project);
  const spec = { action: "assertEnabled", target: { selector: "#greet" }, value: "false", description: "必须禁用" };
  assert.equal(normalizeBrowserAction(spec).checked, false);
  assert.throws(() => normalizeBrowserAction({ ...spec, checked: true }), /矛盾/);
  assert.throws(() => normalizeBrowserAction({ ...spec, value: "disabled" }), /布尔操作/);
  const validated = validateAcceptancePlan({ cases: [{ criterion: 1, kind: "browser", title: "禁用要求", steps: [plan.cases[0].steps[0], spec] }] }, criteria);
  assert.equal(validated.cases[0].steps[1].checked, false);
  assert.equal(validated.cases[0].steps[1].value, undefined);
  try {
    await browser.open(new AbortController().signal);
    const result = await browser.step(spec, 1);
    assert.equal(result.expected, false); assert.equal(result.actual, true); assert.equal(result.passed, false);
  } finally { await browser.close(); }
});

test("独立用例不能继承初探打开的弹窗，漏掉入口点击应在冻结前报计划错误", async (t) => {
  const { project } = await fixture(t), browser = new DemoBrowser(project);
  try {
    await browser.open(new AbortController().signal);
    await browser.page.setContent('<button id="open" onclick="document.querySelector(\'dialog\').showModal()">打开表单</button><dialog><input id="draft"></dialog>');
    browser.initialObservation = await browser.observe();
    assert.equal(browser.initialObservation.controls.find((c) => c.id === "draft").visible, false);
    await browser.step({ action: "click", target: { selector: "#open" }, description: "初探打开表单" }, 0);
    const fill = { action: "fill", target: { selector: "#draft" }, value: "草稿", description: "输入草稿" };
    await assert.rejects(browser.validateTargets({ cases: [{ title: "漏掉入口", steps: [fill] }] }), /前置点击/);
    await browser.validateTargets({ cases: [{ title: "包含完整入口", steps: [{ action: "click", target: { selector: "#open" } }, fill] }] });
  } finally { await browser.close(); }
});

test("浏览器截图与验收日志通过本机只读接口访问，不能越界读取", async (t) => {
  const { project } = await fixture(t);
  const name = "00000000-0000-4000-8000-000000000000.jpg";
  await project.run.writeBrowserFile(name, Buffer.from([255, 216, 255, 217]));
  await project.run.write("browser.json", { attempts: [] });
  const api = createApi({ directory: project.directory, getConfig: () => ({ apiKey: "test", voices: {} }) });
  const server = createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}${BASE}api/source/runs/${project.run.id}`;
  assert.equal((await fetch(`${base}/browser`)).status, 200);
  const image = await fetch(`${base}/browser/${name}`); assert.equal(image.status, 200); assert.equal(image.headers.get("content-type"), "image/jpeg");
  assert.equal((await fetch(`${base}/browser/not-a-file.jpg`)).status, 404);
  await assert.rejects(project.run.readBrowserFile("../commands.json"), /无效/);
});

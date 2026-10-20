import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const target = z.object({
  selector: z.string().min(1).max(240).optional(),
  role: z.string().max(50).optional(), name: z.string().max(180).optional(),
  text: z.string().max(180).optional(), exact: z.boolean().default(true),
}).refine((v) => [v.selector, v.role, v.text].filter(Boolean).length === 1, "使用selector、role或text中的一种定位方式");
export const browserActionSchema = z.object({
  action: z.enum(["click", "fill", "select", "check", "press", "assertText", "assertValue", "assertVisible", "assertEnabled", "assertCount", "assertURL"]),
  target: target.optional(), value: z.string().max(4000).optional().describe("文本、选项值或按键；布尔状态请使用checked字段"),
  count: z.number().int().min(0).max(1000).optional(), checked: z.boolean().optional().describe("check/assertVisible/assertEnabled的预期布尔状态。禁用或不可见必须checked:false，启用或可见checked:true"),
  comparison: z.enum(["equals", "contains"]).default("equals"),
  description: z.string().min(1).max(200),
});
export const acceptancePlanSchema = z.object({
  cases: z.array(z.object({
    criterion: z.number().int().min(1).max(12), title: z.string().min(1).max(180),
    kind: z.enum(["browser", "project"]),
    check: z.enum(["build", "test", "protected", "http"]).optional(),
    path: z.string().max(240).refine((value) => value.startsWith("/") || /^https?:\/\//.test(value), "path是浏览器URL，不是源码目录；通常省略以使用真实Demo入口").optional(), steps: z.array(browserActionSchema).max(24).default([]),
  })).min(1).max(16),
});
const projectCriteria = {
  build: /(?:build|构建|编译)/i, test: /(?:npm\s*(?:run\s*)?test|原.*测试|原.*test|测试.*通过)/i,
  protected: /(?:原.*(?:脚本|测试)|package.*脚本|测试.*不变|测试.*保护)/i,
  http: /(?:HTTP|可达|可打开.*(?:地址|Demo)|启动.*Demo)/i,
};
export function normalizeBrowserAction(spec) {
  if (!["check", "assertVisible", "assertEnabled"].includes(spec.action)) return spec;
  if (spec.value !== undefined && !["true", "false"].includes(spec.value)) throw new Error("布尔操作仅接受checked=true/false，或明确的字符串true/false；不能把disabled等文本当作输入值。");
  const value = spec.value === undefined ? undefined : spec.value === "true";
  if (value !== undefined && spec.checked !== undefined && value !== spec.checked) throw new Error("布尔操作的checked与value互相矛盾，请明确预期状态。");
  const { value: ignored, ...rest } = spec;
  return { ...rest, checked: spec.checked ?? value ?? true };
}
export function validateAcceptancePlan(value, criteria) {
  const plan = acceptancePlanSchema.parse(value);
  const covered = new Set(); let interactive = false;
  for (const item of plan.cases) {
    if (!criteria[item.criterion - 1]) throw new Error("验收编号必须对应原始需求。");
    if (covered.has(item.criterion)) throw new Error("每条原始验收只提交一个完整场景，相关边界步骤放在同一场景内，不增加额外验收项。");
    covered.add(item.criterion);
    if (item.kind === "project") {
      if (!projectCriteria[item.check]?.test(criteria[item.criterion - 1])) throw new Error("此需求不能只用构建/HTTP检查替代页面操作。");
      if (item.steps.length) throw new Error("项目检查不接受页面步骤。");
      continue;
    }
    item.steps = item.steps.map(normalizeBrowserAction);
    if (!item.steps.some((s) => s.action.startsWith("assert"))) throw new Error("每个浏览器用例必须包含实际结果断言。");
    const firstAction = item.steps.findIndex((s) => ["click", "fill", "select", "check", "press"].includes(s.action));
    if (firstAction < 0 || !item.steps.slice(firstAction + 1).some((s) => s.action.startsWith("assert"))) throw new Error("每个浏览器用例都须操作后断言实际结果。");
    interactive = true;
    for (const step of item.steps) {
      if (step.action !== "assertURL" && !step.target) throw new Error("页面步骤缺少定位方式。");
      if (["fill", "select", "press", "assertText", "assertValue", "assertURL"].includes(step.action) && step.value === undefined) throw new Error("操作或断言缺少预期值。");
      if (step.action === "assertCount" && step.count === undefined) throw new Error("数量断言缺少预期数量。");
      if (step.comparison === "contains" && !step.value) throw new Error("包含断言必须有非空预期；清空字段必须使用equals完全相等。");
      if (["assertValue", "assertText"].includes(step.action) && step.target?.selector && step.target.exact === false) throw new Error("target.exact仅控制语义定位，不能表示部分匹配；请使用comparison=contains或equals明确断言方式。");
      if (step.action === "press" && !/^(?:Enter|Escape|Tab|Space|Arrow(?:Up|Down|Left|Right)|Backspace|Delete)$/.test(step.value)) throw new Error("仅提供常用页面按键。");
    }
  }
  if (covered.size !== criteria.length) throw new Error("必须逐条覆盖原始验收要求，不允许漏项。");
  if (!interactive) throw new Error("至少一个浏览器用例必须实际操作控件，不能只检查标题或HTTP。");
  return plan;
}

export function demoAddress(base, path) {
  const url = new URL(path || base, base);
  if (url.origin !== new URL(base).origin || url.username || url.password || !["http:", "https:"].includes(url.protocol)) throw new Error("浏览器只能访问本轮Demo所在源。");
  return url.href;
}

// This browser belongs to the product's verifier, with a fresh context and no
// user profile. The model receives structured actions, never JavaScript access.
export class DemoBrowser {
  constructor(project, { launch = () => chromium.launch({ headless: true }) } = {}) {
    this.project = project; this.launch = launch; this.logs = []; this.steps = []; this.round = (project.browserHistory?.length || 0) + 1;
    this.operations = Promise.resolve();
    this.visited = new Set();
  }
  enqueue(operation) {
    const next = this.operations.then(() => { this.signal?.throwIfAborted(); return operation(); });
    this.operations = next.catch(() => {}); return next;
  }
  async open(signal) {
    await this.project.control?.checkpoint(signal);
    signal.throwIfAborted();
    this.browser = await this.launch();
    this.onAbort = () => { void this.close(); };
    signal.addEventListener("abort", this.onAbort, { once: true }); this.signal = signal;
    try {
      signal.throwIfAborted();
      this.context = await this.browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: "block", acceptDownloads: false });
      const origin = new URL(this.project.demoUrl).origin;
      await this.context.route("**/*", (route) => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin) return route.abort("blockedbyclient");
        if (/\/api\/(?:tasks|run|repository\/run|speech|discuss)(?:\/|$)/.test(url.pathname) && request.method() !== "GET") {
          this.logs.push({ type: "blocked-action", message: `页面操作尝试触发受限执行：${request.method()} ${url.pathname}` });
          return route.abort("blockedbyclient");
        }
        return route.continue();
      });
      await this.context.routeWebSocket(/.*/, (ws) => ws.close());
      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(5000); this.page.setDefaultNavigationTimeout(15000);
      this.page.on("pageerror", (e) => this.logs.push({ type: "pageerror", message: e.message.slice(0, 1500) }));
      this.page.on("console", (m) => { if (m.type() === "error") this.logs.push({ type: "console", message: m.text().slice(0, 1500) }); });
      this.page.on("dialog", (dialog) => dialog.dismiss());
      this.page.on("popup", (popup) => { void popup.close(); });
      await this.goto(this.project.demoUrl);
      const initial = await this.capture({ id: randomUUID(), kind: "browser", label: "桃桃打开本轮实际 Demo", action: "open", round: this.round, criterion: 0, status: "done", output: "真实浏览器已打开，正在准备原需求验收用例。此步骤不代表功能通过。" });
      this.notify(initial);
      this.initialObservation = await this.observe();
      return this.initialObservation;
    } catch (error) { await this.close(); throw error; }
  }
  async goto(path) {
    const release = await this.project.control?.enter({ actor: "momo", kind: "browser", label: "浏览器打开验收入口" }, this.signal);
    try { return await this.navigate(path); }
    finally { await release?.(); }
  }
  async navigate(path) {
    this.signal.throwIfAborted();
    await this.page.goto(demoAddress(this.project.demoUrl, path), { waitUntil: "domcontentloaded" });
    demoAddress(this.project.demoUrl, this.page.url());
    this.visited.add(this.page.url());
  }
  async observe() {
    await this.project.control?.checkpoint(this.signal);
    return { url: this.page.url(), title: await this.page.title(), accessibility: (await this.page.locator("body").ariaSnapshot()).slice(0, 18000),
      // IDs and labels help locate applications whose accessible name is incomplete.
      controls: await this.page.locator("button,input,textarea,select,[role=button]").evaluateAll((elements) => elements.slice(0, 120).map((e) => ({ tag: e.tagName, id: e.id, visible: Boolean(e.getClientRects().length) && getComputedStyle(e).visibility !== "hidden", text: e.textContent?.trim().slice(0, 100), label: e.getAttribute("aria-label"), placeholder: e.getAttribute("placeholder"), value: e.value, disabled: e.disabled, readOnly: e.readOnly,
        options: e.tagName === "SELECT" ? [...e.options].map((o) => ({ value: o.value, text: o.text, disabled: o.disabled })) : undefined }))) };
  }
  async validateTargets(plan) {
    for (const scenario of plan.cases) {
      if (scenario.path && !this.visited.has(demoAddress(this.project.demoUrl, scenario.path))) throw new Error("path不是已实际访问的浏览器URL。请省略path，使用本轮真实Demo入口；不能填源码目录或猜测页面地址。");
      const first = scenario.steps.find((step) => ["click", "fill", "select", "check", "press"].includes(step.action));
      if ((!scenario.path || demoAddress(this.project.demoUrl, scenario.path) === this.project.demoUrl) && first?.target) {
        const start = this.locator(first.target);
        if (await start.count() === 1) {
          const id = await start.getAttribute("id");
          const initial = this.initialObservation?.controls.find((control) => control.id && control.id === id);
          if (initial?.visible === false && await start.isVisible()) throw new Error(`${scenario.title}：首个操作目标在全新入口中隐藏，只有初探打开后才可见。每个用例必须自行包含打开弹窗/切换页面的前置点击；不能继承初探或其它用例的页面状态。`);
        }
      }
      for (const spec of scenario.steps) {
      if (!spec.target) continue;
      const locator = this.locator(spec.target);
      if (await locator.count() !== 1) continue; // Missing requested UI is a functional failure when executed.
      const info = await locator.evaluate((e) => ({ tag: e.tagName, options: e.tagName === "SELECT" ? [...e.options].map((o) => o.value) : null }));
      if (["fill", "assertValue"].includes(spec.action) && !["INPUT", "SELECT", "TEXTAREA"].includes(info.tag)) throw new Error(`${spec.description}：${info.tag}不能读取/填写输入值。按钮状态用assertEnabled，页面文字用assertText。`);
      if (spec.action === "select" && (!info.options || !info.options.includes(spec.value))) throw new Error(`${spec.description}：选项值${spec.value}不存在，真实选项为${JSON.stringify(info.options)}。请修正用例中的控件值，不要要求开发员改坏原有选项。`);
      }
    }
  }
  locator(spec) {
    if (spec.selector) return this.page.locator(spec.selector);
    if (spec.role) return this.page.getByRole(spec.role, { name: spec.name, exact: spec.exact });
    return this.page.getByText(spec.text, { exact: spec.exact });
  }
  async capture(record) {
    try {
      const name = `${randomUUID()}.jpg`;
      await this.project.run.writeBrowserFile(name, await this.page.screenshot({ type: "jpeg", quality: 65, timeout: 5000 }));
      record.screenshot = `api/source/runs/${this.project.run.id}/browser/${name}`;
      record.screenshotFile = name;
    } catch (error) { record.captureError = error.message.slice(0, 250); }
    record.url = this.page.url();
    try { demoAddress(this.project.demoUrl, record.url); this.visited.add(record.url); } catch { /* Outside pages are not admissible test starts. */ }
    return record;
  }
  notify(record) { this.project.progress.getStore()?.(record.label, record); }
  async step(spec, criterion) {
    const release = await this.project.control?.enter({ actor: "momo", kind: "browser", label: spec.description }, this.signal);
    try { return await this.executeStep(spec, criterion); }
    finally { await release?.(); }
  }
  async executeStep(spec, criterion) {
    this.signal.throwIfAborted();
    spec = normalizeBrowserAction(spec);
    const record = { id: randomUUID(), kind: "browser", label: spec.description, action: spec.action, criterion, round: this.round,
      target: spec.target, comparison: spec.comparison || "equals", expected: spec.value ?? spec.count ?? spec.checked, status: "running", startedAt: new Date().toISOString() };
    this.notify(record);
    try {
      const element = spec.target && this.locator(spec.target);
      switch (spec.action) {
        case "click": await element.click(); break;
        case "fill": await element.fill(spec.value); break;
        case "select": await element.selectOption(spec.value); break;
        case "check": await element.setChecked(spec.checked ?? true); break;
        case "press": await element.press(spec.value); break;
        default: {
          const deadline = Date.now() + 5000;
          do {
            this.signal.throwIfAborted();
            if (spec.action === "assertText") { record.actual = (await element.innerText({ timeout: 1000 })).slice(0, 6000); record.passed = spec.comparison === "contains" ? record.actual.includes(spec.value) : record.actual.trim() === spec.value.trim(); }
            else if (spec.action === "assertValue") { record.actual = await element.inputValue({ timeout: 1000 }); record.passed = spec.comparison === "contains" ? record.actual.includes(spec.value) : record.actual === spec.value; }
            else if (spec.action === "assertVisible") { record.actual = await element.isVisible(); record.passed = record.actual === (spec.checked ?? true); }
            else if (spec.action === "assertEnabled") { record.actual = await element.isEnabled(); record.passed = record.actual === (spec.checked ?? true); }
            else if (spec.action === "assertCount") { record.actual = await element.count(); record.passed = record.actual === spec.count; }
            else if (spec.action === "assertURL") { record.actual = this.page.url(); record.passed = record.actual === demoAddress(this.project.demoUrl, spec.value); }
            if (record.passed) break;
            await new Promise((resolve) => setTimeout(resolve, 120));
          } while (Date.now() < deadline);
          if (!record.passed) throw new Error(`预期 ${JSON.stringify(record.expected ?? spec.checked ?? true)}，实际 ${JSON.stringify(record.actual)}`);
        }
      }
      demoAddress(this.project.demoUrl, this.page.url());
      record.status = "done"; record.passed = true;
    } catch (error) {
      this.signal.throwIfAborted(); record.status = "failed"; record.passed = false; record.error = error.message.replace(/\x1b\[[0-9;]*m/g, "").slice(0, 1600);
    }
    await this.capture(record);
    record.output = `${spec.action} · 验收${criterion}\n${spec.description}\n${record.passed ? "PASS" : "FAIL"}${["assertText", "assertValue"].includes(spec.action) ? ` · ${record.comparison === "contains" ? "包含匹配" : "完全相等"}` : ""}${record.expected !== undefined ? `\n预期：${JSON.stringify(record.expected)}` : ""}${record.actual !== undefined ? `\n实际：${JSON.stringify(record.actual)}` : ""}${record.error ? `\n${record.error}` : ""}`;
    record.endedAt = new Date().toISOString(); this.steps.push(record); this.notify(record);
    return record;
  }
  async run(plan, technical) {
    const cases = [];
    for (const item of plan.cases) {
      await this.project.control?.checkpoint(this.signal);
      this.signal.throwIfAborted();
      if (item.kind === "project") {
        const names = { build: /原项目 build/, test: /原项目 test/, protected: /测试文件保持完整/, http: /HTTP 健康/ };
        const check = technical.checks.find((c) => names[item.check].test(c.name));
        cases.push({ ...item, passed: Boolean(check?.passed), evidence: check }); continue;
      }
      await this.context.clearCookies();
      // Each scenario has a fresh page and fresh browser storage.
      await this.page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await this.page.goto("about:blank");
      await this.context.clearPermissions();
      await this.context.clearCookies();
      await this.goto(item.path || this.project.demoUrl);
      const records = [];
      for (const spec of item.steps) {
        const record = await this.step(spec, item.criterion); records.push(record);
        if (!record.passed) break;
      }
      cases.push({ ...item, steps: records, passed: records.length === item.steps.length && records.every((r) => r.passed) });
    }
    const pageErrors = this.logs.filter((l) => ["pageerror", "blocked-action"].includes(l.type));
    return { round: this.round, passed: cases.every((c) => c.passed) && !pageErrors.length, cases, logs: this.logs,
      ...(pageErrors.length ? { error: pageErrors.map((e) => e.message).join("\n").slice(0, 2000) } : {}), completedAt: new Date().toISOString() };
  }
  async close() {
    this.signal?.removeEventListener("abort", this.onAbort);
    await this.browser?.close().catch(() => {}); this.browser = null;
  }
}

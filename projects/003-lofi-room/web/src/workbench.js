import { TEAM } from "../shared/team.js";
import { workbenchView, takeoverView } from "../shared/workbench.js";
import { takeoverBoard } from "../shared/takeover.js";
import "./workbench.css";

const node = (tag, text, className) => {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
};
const status = { running: "执行中", completed: "完成", done: "完成", failed: "失败" };
export class Workbench {
  constructor({ onFocus = () => {}, onAsk = () => {}, onScreen = () => {}, onPersonal = () => {}, onReplay = () => {}, onControl = async () => {}, onBoard = () => {} } = {}) {
    this.onFocus = onFocus; this.onAsk = onAsk;
    this.onControl = onControl;
    this.onBoard = onBoard;
    this.actor = "indigo"; this.follow = false; this.opened = false; this.stepId = null;
    this.snapshot = {}; this.tab = "activity";
    this.fullRecords = new Map();
    this.dock = node("section", undefined, "observer-dock glass");
    this.dock.setAttribute("aria-label", "角色观察方式");
    this.followButton = this.button("跟随任务步骤", () => {
      this.follow = !this.follow; this.stepId = null; this.opened = true; this.render();
    });
    this.actorSelect = node("select"); this.actorSelect.setAttribute("aria-label", "关注的角色");
    TEAM.forEach((member) => { const option = node("option", `${member.name} · ${member.role}`); option.value = member.id; this.actorSelect.append(option); });
    this.actorSelect.value = this.actor;
    this.actorSelect.onchange = () => this.inspect(this.actorSelect.value);
    this.enterButton = this.button("进入角色工作台", () => { this.opened = true; this.render(); });
    this.screenButton = this.button("电脑近景", () => onScreen(this.actor));
    this.personalButton = this.button("随身物品", () => onPersonal(this.actor));
    this.repairButton = this.button("回看真实返工", () => onReplay(this.snapshot)); this.repairButton.hidden = true;
    this.dock.append(this.followButton, this.actorSelect, this.enterButton, this.screenButton, this.personalButton, this.repairButton);
    this.panel = node("section", undefined, "actor-workbench glass");
    this.panel.setAttribute("aria-label", "角色工作台"); this.panel.hidden = true;
    const header = node("header", undefined, "workbench-heading");
    const titles = node("div");
    titles.append(node("span", "AGENT WORKSTATION", "eyebrow"));
    this.title = node("h2"); this.badge = node("span", "", "workbench-badge");
    titles.append(this.title, this.badge);
    header.append(titles, this.button("返回房间", () => this.close()));
    this.goal = node("p", "", "workbench-goal");
    this.task = node("p", "", "workbench-task");
    this.tools = node("nav", undefined, "workbench-tabs"); this.tools.setAttribute("aria-label", "工作台内容");
    for (const [id, label] of [["activity", "执行现场"], ["code", "代码与改动"], ["commands", "执行命令"], ["handoff", "交接与交付"]]) {
      const button = this.button(label, () => { this.tab = id; this.render(); }); button.dataset.tab = id; this.tools.append(button);
    }
    this.body = node("div", undefined, "workbench-body");
    this.takeover = node("section", undefined, "workbench-takeover"); this.takeover.setAttribute("aria-label", "执行中接管");
    this.controlStatus = node("p"); this.controlStatus.setAttribute("role", "status");
    this.controlInfo = node("small");
    this.feedbackInput = node("textarea"); this.feedbackInput.maxLength = 2000; this.feedbackInput.rows = 2;
    this.feedbackInput.setAttribute("aria-label", "本轮修改意见");
    this.feedbackInput.placeholder = "说明要调整的代码或行为；保留原目标与验收要求。";
    this.pauseExecution = this.button("暂停执行并接管", () => this.controlAction("pause"));
    this.submitFeedback = this.button("提交修改意见", () => this.controlAction("feedback"));
    this.resumeExecution = this.button("继续同一任务", () => this.controlAction("resume"));
    const actions = node("div", undefined, "takeover-actions"); actions.append(this.pauseExecution, this.submitFeedback, this.resumeExecution);
    this.retryDiscussion = this.button("重试调整讨论", () => this.controlAction("discuss"));
    this.playResponse = this.button("播放接管回应", () => this.controlAction("voice"));
    this.watchDiscussion = this.button("到房间看讨论", () => this.close());
    actions.append(this.retryDiscussion, this.playResponse, this.watchDiscussion);
    this.feedbackHistory = node("details"); this.feedbackHistory.append(node("summary", "本轮接管记录")); this.feedbackLog = node("div"); this.feedbackHistory.append(this.feedbackLog);
    this.controlError = node("p", "", "takeover-error"); this.controlError.setAttribute("role", "alert");
    this.takeover.append(this.controlStatus, this.controlInfo, this.feedbackInput, actions, this.controlError, this.feedbackHistory);
    this.timeline = node("div", undefined, "workbench-timeline"); this.timeline.setAttribute("aria-label", "该角色的执行步骤");
    const footer = node("footer");
    this.latestButton = this.button("回到最新步骤", () => { this.stepId = null; this.render(); });
    this.fullButton = this.button("载入完整记录", () => this.loadRecord());
    footer.append(this.latestButton, this.button("向他提问", () => this.onAsk(this.view.actor)), this.fullButton);
    this.panel.append(header, this.goal, this.task, this.tools, this.body, this.timeline, this.takeover, footer);
    this.banner = node("section", undefined, "takeover-scene-banner glass"); this.banner.hidden = true;
    this.banner.setAttribute("aria-label", "接管中的现场讨论");
    this.bannerStatus = node("strong"); this.bannerStatus.setAttribute("role", "status"); this.bannerPlan = node("p");
    this.bannerContinue = this.button("按方案继续", () => this.controlAction("resume"));
    this.bannerVoice = this.button("播放回应", () => this.controlAction("voice"));
    this.bannerRetry = this.button("重试讨论", () => this.controlAction("discuss"));
    this.bannerError = node("p", "", "takeover-error"); this.bannerError.setAttribute("role", "alert");
    const bannerActions = node("div", undefined, "takeover-actions");
    bannerActions.append(this.button("展开白板方案", () => this.onBoard()), this.bannerVoice, this.bannerRetry, this.bannerContinue);
    this.banner.append(this.bannerStatus, this.bannerPlan, bannerActions, this.bannerError);
    document.body.append(this.dock, this.panel, this.banner);
  }
  button(label, action) { const button = node("button", label); button.type = "button"; button.onclick = action; return button; }
  inspect(actor) { this.actor = actor; this.follow = false; this.opened = true; this.stepId = null; this.render(); }
  close() { this.opened = false; this.follow = false; this.render(); this.enterButton.focus(); }
  async controlAction(action) {
    if (this.controlBusy) return;
    if (action === "resume" && this.feedbackInput.value.trim()) {
      this.controlError.textContent = "还有未提交的修改意见，请先提交或清空后再继续。"; return;
    }
    this.controlBusy = true; this.controlError.textContent = ""; this.renderControl();
    try {
      await this.onControl(action, this.view.actor, this.feedbackInput.value.trim());
      if (action === "feedback") { this.feedbackInput.value = ""; this.close(); }
    } catch (error) { this.controlError.textContent = error.message; }
    finally { this.controlBusy = false; this.renderControl(); }
  }
  renderControl() {
    const view = takeoverView(this.snapshot, Boolean(this.stepId));
    this.controlStatus.textContent = view.label;
    this.takeover.dataset.state = view.control?.state || "idle";
    this.controlInfo.textContent = view.available ? `任务 ${view.task.id.slice(0, 8)} · 修改版本 ${view.control.version} · 接管${this.view.member.name}；团队后续步骤一起等待，保持产物一致。` : "接管仅作用于正在运行的原仓库任务；暂停回放不会停止后台执行。";
    this.pauseExecution.disabled = this.controlBusy || !view.available || view.control.state !== "running";
    const adjustment = takeoverBoard(this.snapshot);
    if (view.paused && adjustment) this.controlStatus.textContent = adjustment.label + " · 执行仍暂停";
    this.retryDiscussion.hidden = !view.paused || adjustment?.status !== "error";
    this.retryDiscussion.disabled = this.controlBusy;
    this.playResponse.hidden = this.watchDiscussion.hidden = !view.paused || !adjustment;
    this.playResponse.disabled = this.controlBusy || !adjustment?.lines.length;
    this.submitFeedback.disabled = this.controlBusy || !view.paused;
    this.resumeExecution.disabled = this.controlBusy || !view.paused || Boolean(adjustment && adjustment.status !== "ready");
    this.feedbackInput.disabled = this.controlBusy || !view.paused;
    this.feedbackInput.hidden = !view.available;
    this.submitFeedback.hidden = this.resumeExecution.hidden = !view.available || view.control.state === "running";
    this.pauseExecution.hidden = view.available && view.control.state === "paused";
    const notes = view.control?.notes || [], signature = JSON.stringify(notes);
    if (signature !== this.feedbackSignature) {
      this.feedbackSignature = signature; this.feedbackLog.replaceChildren();
      for (const note of notes) this.feedbackLog.append(node("p", `修改 ${note.version} · ${TEAM.find((m) => m.id === note.actor)?.name}：${note.text}`));
    }
    this.feedbackHistory.hidden = !notes.length;
    this.banner.hidden = this.opened || !view.paused || !adjustment;
    if (adjustment) {
      this.banner.dataset.state = JSON.stringify({ version: adjustment.version, status: adjustment.status, participants: adjustment.participants });
      this.bannerStatus.textContent = adjustment.label;
      this.bannerPlan.textContent = adjustment.plan?.title || "收到修改意见，角色正在整理具体回应…";
      this.bannerContinue.disabled = this.controlBusy || adjustment.status !== "ready";
      this.bannerRetry.hidden = adjustment.status !== "error";
      this.bannerRetry.disabled = this.controlBusy;
      this.bannerVoice.disabled = this.controlBusy || !adjustment.lines.length;
      this.bannerVoice.textContent = this.snapshot.takeoverVoiceBlocked ? "点击播放接管语音" : "播放回应";
      this.bannerError.textContent = this.controlError.textContent || adjustment.error || "";
    }
  }
  sync(snapshot) {
    this.snapshot = snapshot;
    this.repairButton.hidden = !snapshot.events?.some((event) => event.purpose === "repair" || event.type === "run.complete" && event.delivery?.previousCheckpointRunId && event.delivery.tests?.browser?.round > 1);
    this.repairButton.disabled = Boolean(snapshot.live || snapshot.replaying);
    this.sourceRunId = snapshot.events?.findLast((event) => event.execution === "upstream" && event.runId)?.runId;
    this.render();
  }
  async loadRecord() {
    if (this.snapshot.live || !/^[a-f0-9-]{36}$/.test(this.sourceRunId || "")) return;
    const id = this.sourceRunId;
    this.fullButton.disabled = true; this.fullButton.textContent = "载入中…";
    try {
      const response = await fetch(new URL(`api/source/runs/${id}/events`, document.baseURI));
      if (!response.ok) throw new Error("本机未保留该轮日志");
      const events = (await response.text()).split("\n").filter((line) => line.trim()).map(JSON.parse);
      this.fullRecords.set(id, events); this.render();
    } catch (error) { this.fullButton.textContent = error.message; this.fullButton.disabled = false; }
  }
  render() {
    const snapshot = !this.snapshot.live && this.fullRecords.has(this.sourceRunId)
      ? { ...this.snapshot, events: this.fullRecords.get(this.sourceRunId) } : this.snapshot;
    const view = this.view = workbenchView(snapshot, this);
    if (this.tab === "code" && !this.stepId)
      view.activity = view.steps.findLast((step) => step.kind === "write") || view.steps.findLast((step) => step.kind === "read") || null;
    this.actor = view.actor;
    this.panel.hidden = !this.opened;
    document.body.classList.toggle("observing-agent", this.opened);
    this.followButton.setAttribute("aria-pressed", String(this.follow));
    this.followButton.textContent = this.follow ? "正在跟随任务步骤" : "跟随任务步骤";
    this.actorSelect.value = view.actor;
    this.screenButton.hidden = !["indigo", "momo"].includes(view.actor);
    this.enterButton.textContent = `进入${view.member.name}的工作台`;
    this.onFocus(this.opened ? view.actor : null, view);
    this.renderControl();
    if (!this.opened) return;
    this.title.textContent = `${view.member.name}的${{mori:"任务白板",amber:"研究台",indigo:"开发电脑",luna:"审阅台",momo:"测试终端",sleepy:"交付台"}[view.actor]}`;
    this.badge.textContent = `${this.follow ? "跟随任务" : "锁定角色"} · ${view.historical ? "步骤回看" : view.mode === "demo" ? "预设演示" : view.live ? "真实任务现场" : "执行记录"}`;
    this.badge.dataset.live = String(view.live && !view.historical);
    this.goal.textContent = this.snapshot.goal?.title || "等待任务";
    this.task.textContent = view.task?.task || view.member.job;
    this.renderControl();
    this.tools.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.tab === this.tab)));
    const signature = JSON.stringify([this.tab, view.activity, this.tab === "commands" ? view.steps.filter((step) => step.command) : null, view.artifact?.id, view.delivery?.runId, view.exchanges, view.live,
      this.snapshot.events?.findLast((event) => event.type === "tool" && event.actor === view.actor)?.label]);
    if (this.signature !== signature) { this.signature = signature; this.renderBody(view); }
    const timelineSignature = JSON.stringify([view.actor, view.steps.map((step) => [step.id, step.status]), this.stepId]);
    if (this.timelineSignature !== timelineSignature) {
      this.timelineSignature = timelineSignature; this.timeline.replaceChildren();
      for (const step of this.fullRecords.has(this.sourceRunId) ? view.steps : view.steps.slice(-35)) {
        const button = this.button(`${status[step.status] || step.status} · ${step.path?.split("/").at(-1) || step.label}`, () => { this.stepId = step.id; this.follow = false; this.render(); });
        button.setAttribute("aria-pressed", String(step.id === view.activity?.id)); button.dataset.status = step.status;
        this.timeline.append(button);
      }
    }
    this.latestButton.disabled = !this.stepId;
    this.fullButton.disabled = !this.sourceRunId || this.snapshot.live;
    this.fullButton.textContent = this.snapshot.live ? "正在接收实时记录" : this.fullRecords.has(this.sourceRunId) ? "完整记录已载入" : "载入完整记录";
  }
  renderBody(view) {
    this.body.replaceChildren();
    const step = view.activity;
    if (this.tab === "commands") {
      const commands = view.steps.filter((item) => item.command);
      if (!commands.length) this.body.append(node("p", "该角色尚未执行命令；文件读取与修改可在代码页查看。"));
      for (const item of commands.slice(-12).reverse()) {
        this.body.append(node("h3", `${status[item.status] || item.status} · ${item.label}`), node("pre", `$ ${item.command}`, "workbench-command"),
          node("pre", item.output || "等待实际输出…", "workbench-terminal"));
        if (item.exitCode !== undefined) this.body.append(node("small", `退出码 ${item.exitCode}`));
      }
      return;
    }
    if (this.tab === "handoff") {
      for (const exchange of view.exchanges) this.body.append(node("p", `${TEAM.find((m) => m.id === exchange.from)?.name} → ${TEAM.find((m) => m.id === exchange.to)?.name}：${exchange.title}`));
      if (view.artifact) this.body.append(node("h3", view.artifact.title), node("pre", view.artifact.content, "workbench-document"));
      if (view.delivery?.demoUrl) {
        const link = node("a", "打开本轮 Demo ↗"); link.href = view.delivery.demoUrl; link.target = "_blank"; link.rel = "noopener";
        this.body.append(link);
      }
      if (!view.exchanges.length && !view.artifact) this.body.append(node("p", "还没有交接产物。"));
      return;
    }
    if (!step) {
      const tool = this.snapshot.events?.findLast((event) => event.type === "tool" && event.actor === view.actor);
      this.body.append(node("h3", tool?.label || "等待该角色执行工具"), node("p", view.mode === "demo" ? "这是预设流程演示，没有实际进程和源码改动。" : "这里将展示实际读取的文件、源码改动与命令输出；未执行的步骤不会生成日志。"));
      if (view.artifact) this.body.append(node("h3", "已提交的公开产物"), node("pre", view.artifact.content, "workbench-document"));
      return;
    }
    const heading = node("h3", `${status[step.status] || step.status} · ${step.label}`);
    heading.dataset.status = step.status; this.body.append(heading);
    if (step.path) this.body.append(node("p", step.path, "workbench-path"));
    if (this.tab === "code" && step.kind === "write") {
      this.body.append(node("small", `实际写入的变更片段 · 从第 ${step.line || 1} 行起`));
      this.body.append(node("p", "修改前"), node("pre", step.before || "（新增文件）", "workbench-code before"), node("p", "修改后"), node("pre", step.after || "（空文件）", "workbench-code after"));
    } else if (step.kind === "read" || step.kind === "write") {
      this.body.append(node("pre", step.after || step.output || "正在读取文件…", "workbench-code"));
    } else if (step.kind === "browser") {
      this.body.append(node("p", `第${step.round}次浏览器验收 · ${step.criterion ? `原需求${step.criterion}` : "页面初探，尚未验收"} · ${step.action}`));
      if (step.screenshot) {
        const image = node("img", undefined, "workbench-browser-image"); image.src = new URL(step.screenshot, document.baseURI).href;
        image.alt = `验证员实际操作截图：${step.label}`; this.body.append(image);
      }
      this.body.append(node("pre", step.output || step.label, "workbench-terminal"));
      if (step.expected !== undefined) this.body.append(node("p", `预期：${JSON.stringify(step.expected)}`));
      if (step.actual !== undefined) this.body.append(node("p", `实际：${JSON.stringify(step.actual)}`));
    } else {
      if (step.command) this.body.append(node("pre", `$ ${step.command}`, "workbench-command"));
      this.body.append(node("pre", step.output || (step.status === "running" ? "进程已启动，等待实际输出…" : "操作完成，无标准输出。"), "workbench-terminal"));
      if (step.exitCode !== undefined) this.body.append(node("p", `退出码 ${step.exitCode}`, "workbench-exit"));
    }
    this.body.append(node("small", `${step.startedAt ? new Date(step.startedAt).toLocaleTimeString("zh-CN") : ""} · ${step.status === "running" && !view.live ? "该轮已结束；这是最后收到的记录" : "内容来自执行器，长输出仅显示片段"}`));
  }
}

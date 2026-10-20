import { GoalStore, GOAL_STATUS } from "../shared/goals.js";
import { TEAM, TEAM_BY_ID, STATUS_TEXT } from "../shared/team.js";
import { DEMO_LINES } from "../shared/workflow.js";
import { Narrator } from "./narrator.js";
import { taskToReconnect, linkedTaskId } from "./background-client.js";
import { takeoverBoard } from "../shared/takeover.js";
import { STATIC_DEPLOYMENT, staticExecutionState } from "../shared/deployment.js";
import { missionView, MISSION_STEPS, previewURL, executionIndicator } from "../shared/mission.js";
import {
  TASK_TEMPLATES,
  fillByTemplateButton,
} from "../shared/task-templates.js";
import { goalArchiveEnabled, goalArchiveLabel } from "../shared/goal-draft.js";
const $ = (id) => document.getElementById(id);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const date = (time) =>
  new Date(time).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export class Workspace {
  constructor(collaboration, onScene = () => {}) {
    this.collaboration = collaboration;
    this.onScene = onScene;
    let storage;
    try {
      storage = localStorage;
    } catch {}
    this.store = new GoalStore(storage);
    this.restoring = false;
    this.runId = null;
    this.goalId = null;
    this.newGoal = false;
    this.deliveryOverrides = new Map();
    $("mission-new").onclick = () => {
      if (STATIC_DEPLOYMENT) { this.openGoals(); $("new-goal").click(); }
      else $("open-repository").click();
    };
    $("mission-history").onclick = () => this.openGoals();
    $("mission-primary").onclick = () => this.missionAction();
    $("mission-evidence").onclick = () => this.openComputer();
    $("mission-expand").onclick = () => {
      const expanded = $("mission-expand").getAttribute("aria-expanded") !== "true";
      $("mission-expand").setAttribute("aria-expanded", String(expanded));
      $("mission-expand").textContent = expanded ? "收起" : "展开";
      $("mission-details").hidden = !expanded;
    };
    $("result-feedback-form").onsubmit = (event) => { event.preventDefault(); this.submitFeedback(); };
    $("result-accept").onclick = () => { this.store.edit({ accepted: true }); this.render(); };
    $("result-restart").onclick = () => this.restartResult();
    $("result-dialog").addEventListener("close", () => { $("result-frame").removeAttribute("src"); this.previewKey = null; this.resultSignature = null; });
    collaboration.beforeStart = (brief) => {
      const previous = this.store.selected.runs[0];
      this.store.edit({
        brief,
        accepted: false,
        acceptance: [],
        pendingFeedback: null,
        ...(collaboration.mode === "repository"
          ? { repositoryUrl: collaboration.repositoryURL, execution: collaboration.execution }
          : {}),
      });
      const run = this.store.begin(collaboration.mode);
      this.runId = run.id;
      this.goalId = this.store.selected.id;
      collaboration.backendRequest = { requestId: run.id, client: { goalId: this.goalId, runId: run.id, title: this.store.selected.title } };
      return {
        source: this.store.selected.source || "github",
        previousCheckpointRunId: this.store.selected.source === "workspace" && ["error", "stopped"].includes(previous?.status)
          ? previous.events.find((e) => e.execution === "upstream" && e.runId)?.runId : undefined,
        previousSourceRunId: previous?.events.findLast((e) => e.type === "run.complete")?.delivery?.kind === "upstream"
          ? previous.events.findLast((e) => e.type === "run.complete").delivery.runId : undefined,
        criteria: run.criteria,
        notes: run.notes.slice(-5).map((n) => n.text),
        historicalArtifacts: (previous?.artifacts || [])
          .slice(-6)
          .map(({ actor, title, summary, content }) => ({
            runId: previous.id,
            mode: previous.mode,
            actor,
            title,
            summary,
            content: content.slice(0, 600),
          })),
      };
    };
    collaboration.onUpdate = () => this.update();
    for (const button of document.querySelectorAll("[data-close]"))
      button.addEventListener("click", () => $(button.dataset.close).close());
    $("manage-goals").onclick = () => this.openGoals();
    $("goal-select").onchange = (event) => this.selectGoal(event.target.value);
    $("new-goal").onclick = () => {
      this.newGoal = true;
      this.fillForm({ title: "", brief: "", criteria: [] });
      this.render();
      $("goal-title").focus();
    };
    $("goal-form").onsubmit = (event) => {
      event.preventDefault();
      try {
        if (collaboration.running || collaboration.discussionBusy)
          throw new Error("请先结束当前协作或对话，再修改目标。");
        const value = {
          title: $("goal-title").value.trim(),
          brief: $("goal-brief").value.trim(),
          criteria: $("goal-criteria")
            .value.split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        };
        if (this.newGoal) this.store.create(value);
        else this.store.edit(value);
        this.newGoal = false;
        this.selectGoal(this.store.selected.id);
        this.fillForm(this.store.selected);
        $("goal-form-notice").textContent =
          "目标已保存，可关闭看板后开始协作。";
      } catch (error) {
        $("goal-form-notice").textContent = error.message;
      }
    };
    $("archive-goal").onclick = () => {
      // 草稿没有自己的目标 id，归档会误伤上一个已保存目标，直接忽略。
      if (this.newGoal) return;
      if (collaboration.running || collaboration.recovering || collaboration.discussionBusy) return;
      $("goal-form-notice").textContent = "";
      this.store.archive();
      this.render();
    };
    $("export-goals").onclick = () => this.export();
    $("open-board").onclick = () => this.openBoard();
    $("open-computer").onclick = () => this.openComputer();
    const renderRepositoryForm = () => {
      const local = $("repository-source").value === "workspace";
      if (local) $("repository-execution").value = "upstream";
      $("repository-execution").disabled = local;
      $("repository-input").readOnly = local;
      if (local && this.workspaceSource?.url) $("repository-input").value = this.workspaceSource.url;
      const upstream = $("repository-execution").value === "upstream";
      $("repository-notice").textContent = !collaboration.apiReady
        ? "请启动本地服务并配置 MiniMax 后使用真实项目任务。"
        : upstream ? collaboration.sandboxStatus.reason : "MiniMax 已连接，使用独立离线 Demo 执行器。";
      $("repository-submit").disabled = !collaboration.apiReady || (upstream && !collaboration.sandboxStatus.available);
      $("repository-scope").textContent = upstream
        ? "公开 Node.js 仓库，须已有 build/test 脚本；可选择子项目。每轮独立目录、最多返工三轮，运行原有构建测试。目录方式以当前用户权限执行，本机 Demo 最长40分钟，源码与日志保留。"
        : "研究上游核心能力，独立实现离线 Web Demo，并执行 QuickJS 功能测试。最多自动返工两轮。";
      if (local) $("repository-scope").textContent = "使用当前003工程源码及既有测试所需原文件，生成固定快照后在独立目录克隆、安装、修改和验证。不含密钥、依赖和缓存，不推送远端；交付与原工作区分开。";
    };
    $("repository-source").onchange = renderRepositoryForm;
    $("repository-execution").onchange = renderRepositoryForm;
    this.bindTaskTemplateButtons();
    $("open-repository").onclick = async () => {
      if (STATIC_DEPLOYMENT) { window.location.href = new URL("research.html#deployment", document.baseURI).href; return; }
      await collaboration.refreshConfig();
      try {
        this.workspaceSource = await fetch(new URL("api/workspace-source", document.baseURI)).then((r) => r.json());
        $("workspace-source-option").disabled = !this.workspaceSource.available;
      } catch { $("workspace-source-option").disabled = true; }
      renderRepositoryForm();
      $("repository-dialog").showModal();
    };
    $("repository-form").onsubmit = (event) => {
      event.preventDefault();
      if (collaboration.running || collaboration.discussionBusy) return;
      try {
        const value = $("repository-input").value.trim(),
          url = new URL(value);
        const upstream = $("repository-execution").value === "upstream";
        if (upstream && !collaboration.sandboxStatus.available) throw new Error(collaboration.sandboxStatus.reason);
        const parts = url.pathname.match(/^\/([\w-]+)\/([\w.-]+)\/?$/);
        if (
          !parts ||
          url.protocol !== "https:" ||
          url.hostname !== "github.com" ||
          url.port ||
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          [".", ".."].includes(parts[2])
        )
          throw new Error("请输入公开 GitHub 仓库首页地址。");
        const goal = this.store.create({
          title: $("repository-title").value.trim(),
          brief:
            $("repository-brief").value.trim() ||
            (upstream ? "克隆这个原始 GitHub 项目，在本轮独立目录安装依赖，基于原有实现增加可操作的中文 Demo，运行原项目构建和测试，通过后启动 Demo 并交付运行地址与源码。" : "研究这个 GitHub 项目的真实源码，选择一个核心能力，制作可交互的中文 Web Demo，独立测试通过后交付源码与运行说明。"),
          criteria: $("repository-criteria").value.split("\n").map((s) => s.trim()).filter(Boolean),
        });
        this.store.edit({ repositoryUrl: value, execution: upstream ? "upstream" : "offline", source: $("repository-source").value });
        this.selectGoal(goal.id);
        collaboration.mode = "repository";
        collaboration.execution = upstream ? "upstream" : "offline";
        $("team-mode").value = "repository";
        collaboration.renderMode();
        $("repository-dialog").close();
        collaboration.start();
      } catch (error) {
        $("repository-notice").textContent = error.message;
      }
    };
    $("delivery-details").onclick = () => this.openResults();
    for (const id of ["delivery-demo", "computer-demo"])
      $(id).onclick = (event) => { event.preventDefault(); this.openResults(); };
    $("note-form").onsubmit = (event) => {
      event.preventDefault();
      try {
        this.store.addNote($("board-note").value);
        $("board-note").value = "";
        this.render();
      } catch (error) {
        collaboration.notice(error.message);
      }
    };
    $("accept-delivery").onclick = () => {
      this.store.edit({ accepted: true });
      this.render();
    };
    $("talk-agent").onclick = () => this.openDiscussion(collaboration.selected);
    $("open-discussion").onclick = () => this.openDiscussion("mori");
    for (const member of TEAM) {
      $("discussion-actor").append(
        new Option(`${member.name} · ${member.role}`, member.id),
      );
      $("discussion-partner").append(
        new Option(`${member.name} · ${member.role}`, member.id),
      );
    }
    $("discussion-actor").onchange = () => this.updateDiscussionMode();
    $("discussion-form").onsubmit = (event) => {
      event.preventDefault();
      this.discuss();
    };
    $("stop-discussion").onclick = () => this.stopDiscussion();
    $("pause-discussion").onclick = async () => {
      if (this.discussionNarrator.paused) {
        await this.discussionNarrator.resume();
        if (!this.discussionNarrator.paused) this.voiceNotice = null;
      } else this.discussionNarrator.pause();
      collaboration.stage?.pause(this.discussionNarrator.paused);
      $("pause-discussion").textContent = this.discussionNarrator.paused
        ? "继续播报"
        : "暂停播报";
    };
    $("watch-discussion").onclick = () => {
      this.minimizing = true;
      $("discussion-dialog").close();
    };
    $("discussion-dialog").addEventListener("close", () => {
      if (this.minimizing) {
        this.minimizing = false;
        return;
      }
      this.stopDiscussion();
    });
    collaboration.cancelDiscussion = () => this.stopDiscussion();
    $("voice-enabled").addEventListener("change", () =>
      this.discussionNarrator.setEnabled($("voice-enabled").checked),
    );
    this.discussionNarrator = new Narrator({
      audioId: "discussion-voice-audio",
      onChange: (event) => collaboration.presentSpeech(event),
      onNotice: (text) => {
        this.voiceNotice = text;
        $("discussion-notice").textContent = text;
        if (this.discussionNarrator.paused)
          $("pause-discussion").textContent = "继续播报";
        if (this.discussionNarrator.paused) collaboration.stage?.pause(true);
      },
    });
    collaboration.discussionNarrator = this.discussionNarrator;
    this.selectGoal(this.store.selected.id);
    this.executionVisibility = () => { if (!document.hidden) this.pollExecution(); };
    document.addEventListener("visibilitychange", this.executionVisibility);
    this.pollExecution();
    this.recoverBackend();
  }
  async recoverBackend() {
    if (STATIC_DEPLOYMENT) return;
    const c = this.collaboration;
    if (c.recovering || c.running || c.discussionBusy || this.disposed) return;
    c.recovering = true; c.updateControls(); this.render();
    try {
      const listing = await c.backend.list();
      const localRuns = this.store.list().flatMap((g) => g.runs);
      const requested = linkedTaskId(window.location.href);
      const task = listing.active || (requested ? { id: requested } : taskToReconnect(listing, localRuns));
      if (!task || this.disposed) return;
      const snapshot = await c.backend.snapshot(task.id);
      if (this.disposed) return;
      const { goal, run } = this.store.attachTask(snapshot.task);
      this.selectGoal(goal.id);
      this.goalId = goal.id; this.runId = run.id;
      $("team-goal").value = snapshot.task.goal;
      $("repository-url").value = snapshot.task.repository || "";
      if (requested) { const entry = new URL(window.location.href); entry.searchParams.delete("task"); window.history.replaceState(null, "", entry); }
      // Start watching without holding the startup/entry lock for the whole task.
      c.reconnectBackground(snapshot).catch((error) => c.notice(error.message));
    } catch (error) {
      // Static builds have no task API; existing pre-recorded demos remain usable.
      if (this.store.list().some((g) => g.runs.some((r) => r.backendTaskId && ["stopped", "running", "paused"].includes(r.status))))
        c.notice("后台任务暂未连接；执行状态无法确认，请恢复本地服务后刷新接回。");
    } finally {
      c.recovering = false; c.updateControls(); this.render();
    }
  }
  async pollExecution() {
    if (STATIC_DEPLOYMENT) { this.renderExecution(); return; }
    if (this.executionFetching || this.disposed) return;
    clearTimeout(this.executionTimer);
    this.executionFetching = true;
    this.executionController = new AbortController();
    try {
      const response = await fetch(new URL("api/execution-status", document.baseURI), {
        signal: AbortSignal.any([this.executionController.signal, AbortSignal.timeout(4000)]), cache: "no-store",
      });
      if (!response.ok) throw new Error("执行状态不可用");
      const state = await response.json();
      this.executionRuntime = { ...state, connected: true };
      if (state.task?.id && !this.collaboration.running && !this.collaboration.recovering &&
        this.collaboration.backendTask?.id !== state.task.id) this.recoverBackend();
    } catch { this.executionRuntime = { connected: false }; }
    finally {
      this.executionFetching = false;
      if (!this.disposed) {
        this.renderExecution();
        this.executionTimer = setTimeout(() => { if (!document.hidden) this.pollExecution(); }, 2000);
      }
    }
  }
  renderExecution() {
    const c = this.collaboration;
    const state = STATIC_DEPLOYMENT ? staticExecutionState(c.running) : executionIndicator(this.executionRuntime, {
      running: c.running, mode: c.lastMode, paused: c.paused,
      started: c.events.some((e) => e.type === "run.start"),
    }, this.store.selected.runs[0]?.status === "done");
    $("execution-indicator").dataset.kind = state.kind;
    $("execution-indicator").title = state.detail;
    if (c.backendTask?.id && state.kind === "real") {
      state.detail = `后台任务 ${c.backendTask.id.slice(0, 8)} · ${c.connection === "reconnecting" ? "正在重连" : c.backendTask.status === "paused" ? "刷新仍保持执行暂停" : c.backendTask.status === "pausing" ? "当前操作收尾后暂停" : "关闭房间仍会继续"} · ${state.detail}`;
      $("execution-indicator").title = state.detail;
    }
    if ($("execution-label").textContent !== state.label) $("execution-label").textContent = state.label;
    if ($("execution-detail").textContent !== state.detail) $("execution-detail").textContent = state.detail;
  }
  selectGoal(goalId) {
    if (this.collaboration.running || this.collaboration.discussionBusy) {
      this.collaboration.notice("请先结束当前协作或对话，再切换目标。");
      return;
    }
    this.restoring = true;
    this.runId = null;
    this.goalId = null;
    this.newGoal = false;
    this.store.select(goalId);
    const c = this.collaboration,
      g = this.store.selected,
      run = g.runs[0];
    c.backendTask = null; c.backendCursor = 0; c.connection = "idle";
    c.reset();
    $("team-goal").value = g.brief;
    $("repository-url").value = g.repositoryUrl || "";
    c.repositoryURL = g.repositoryUrl || "";
    c.execution = g.execution || "offline";
    c.mode = STATIC_DEPLOYMENT ? "demo" : g.repositoryUrl ? "repository" : run?.mode || "demo";
    $("team-mode").value = c.mode;
    c.renderMode();
    if (
      run &&
      run.goal === g.brief &&
      JSON.stringify(run.criteria) === JSON.stringify(g.criteria)
    ) {
      for (const event of run.events)
        if (["agent.state", "artifact"].includes(event.type)) c.apply(event);
      for (const event of run.events) {
        if (event.type === "handoff")
          c.addLog(
            `${TEAM_BY_ID[event.from].name} → ${TEAM_BY_ID[event.to].name}`,
            `交接：${event.title}`,
          );
        if (event.type === "speech")
          c.addLog(`${TEAM_BY_ID[event.actor].name}发言`, event.text);
        if (event.type === "tool")
          c.addLog(
            `${TEAM_BY_ID[event.actor].name} · ${TEAM_BY_ID[event.actor].role}`,
            event.label,
          );
        if (event.type === "run.complete")
          c.addLog("本轮交付完成", "产物已归档，可查看或导出。");
      }
      c.events = run.events.slice();
      c.lastGoal = run.goal;
      c.lastMode = run.mode;
      c.mode = run.mode;
      $("team-mode").value = c.mode;
      c.renderMode();
      for (const task of this.store.tasks()) {
        const state = { status: task.status, task: task.task };
        c.states.set(task.id, state);
        c.onAgent(task.id, state);
      }
      $("team-progress").textContent =
        `${GOAL_STATUS[g.status]} · ${run.artifacts.length} 份产物`;
    }
    c.select(c.selected);
    c.updateControls();
    this.restoring = false;
    this.render();
  }
  update() {
    if (this.restoring || this.collaboration.restoringBackend) return;
    const c = this.collaboration;
    if (this.runId) {
      const last = c.events.at(-1);
      let status = c.controller?.signal.aborted
        ? "stopped"
        : c.paused
          ? "paused"
          : c.running
            ? "running"
            : "stopped";
      if (last?.type === "run.complete") status = "done";
      if (last?.type === "run.error") status = "error";
      if (c.backendTask && c.lastMode !== "demo") {
        const backend = c.backendTask.status;
        status = ["running", "pausing", "cancelling"].includes(backend) ? "running" : backend === "paused" ? "paused" : backend === "completed" ? "done" : backend === "cancelled" ? "stopped" : "error";
        const run = this.store.list().find((g) => g.id === this.goalId)?.runs.find((r) => r.id === this.runId);
        if (run) { run.backendTaskId = c.backendTask.id; run.backendCursor = c.backendCursor; }
      }
      this.store.updateRun(this.goalId, this.runId, {
        artifacts: c.artifacts,
        events: c.events,
        status,
        reportId: last?.reportId,
      });
    }
    this.render();
  }
  bindTaskTemplateButtons() {
    const form = $("repository-form");
    if (!form) return;
    let bar = $("repository-templates");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "repository-templates";
      bar.className = "repository-templates";
      bar.setAttribute("role", "group");
      bar.setAttribute("aria-label", "用模板填充任务名称、需求和验收要求");
      const intro = document.createElement("p");
      intro.className = "repository-templates-intro";
      intro.textContent = "三段模板：只填充名称、需求与逐行验收，保留仓库与来源，可继续编辑。";
      bar.append(intro);
      const list = document.createElement("div");
      list.className = "repository-template-buttons";
      for (const template of TASK_TEMPLATES) {
        const button = document.createElement("button");
        button.type = "button";
        button.id = `repository-template-${template.id}`;
        button.className = "repository-template-button";
        button.dataset.template = template.id;
        button.textContent = template.label;
        button.title = template.description;
        button.setAttribute(
          "aria-label",
          `用「${template.label}」模板填充：${template.description}`,
        );
        list.append(button);
      }
      bar.append(list);
      const notice = document.createElement("p");
      notice.id = "repository-template-notice";
      notice.className = "storage-hint";
      notice.dataset.role = "status";
      bar.append(notice);
      const criteria = $("repository-criteria");
      if (criteria?.parentNode === form)
        form.insertBefore(bar, criteria.nextSibling);
      else form.append(bar);
    }
    const notice = $("repository-template-notice");
    const nodes = {
      title: $("repository-title"),
      brief: $("repository-brief"),
      criteria: $("repository-criteria"),
      repository: $("repository-input"),
      source: $("repository-source"),
      execution: $("repository-execution"),
      dialog: $("repository-dialog"),
    };
    for (const button of bar.querySelectorAll(
      ".repository-template-button",
    )) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const id = button.dataset.template;
        try {
          const { result, before, after } = fillByTemplateButton(id, nodes);
          if (
            before.repository !== after.repository ||
            before.source !== after.source ||
            before.execution !== after.execution ||
            before.open !== after.open
          )
            throw new Error("模板不应改动仓库、来源或对话框状态");
          if (notice)
            notice.textContent = `已用「${
              TASK_TEMPLATES.find((t) => t.id === id)?.label || id
            }」模板填充，请继续编辑后再决定提交。`;
        } catch (error) {
          if (notice) notice.textContent = error.message;
        }
      });
    }
  }
  fillForm(goal) {
    $("goal-title").value = goal.title;
    $("goal-brief").value = goal.brief;
    $("goal-criteria").value = goal.criteria.join("\n");
    $("goal-form-notice").textContent = "";
  }
  openGoals() {
    this.newGoal = false;
    this.fillForm(this.store.selected);
    this.render();
    $("goals-dialog").showModal();
  }
  openBoard() {
    this.render();
    $("board-dialog").showModal();
  }
  openComputer() {
    this.render();
    $("computer-dialog").showModal();
  }
  missionAction() {
    const view = missionView(this.store.selected);
    if (STATIC_DEPLOYMENT && !view.active && view.run?.status !== "done") return this.collaboration.start();
    if (view.active) {
      const actor = view.actors.at(-1)?.actor;
      if (actor) this.collaboration.select(actor);
      return;
    }
    if (this.store.selected.pendingFeedback) return this.collaboration.start();
    if (view.run?.status === "done") return this.openResults();
    if (this.store.selected.repositoryUrl) return this.collaboration.start();
    $("open-repository").click();
  }
  currentMission() {
    const view = missionView(this.store.selected);
    if (view.delivery && this.deliveryOverrides.has(view.delivery.runId)) {
      view.delivery = this.deliveryOverrides.get(view.delivery.runId);
      view.expired = Boolean(view.delivery.expiresAt && Date.parse(view.delivery.expiresAt) <= Date.now());
    }
    return view;
  }
  cacheDelivery(delivery) {
    this.deliveryOverrides.set(delivery.runId, delivery);
    const event = this.store.selected.runs[0]?.events.findLast((e) => e.type === "run.complete");
    if (event?.delivery?.runId === delivery.runId) { event.delivery = delivery; this.store.save(); }
  }
  renderMission() {
    const g = this.store.selected, view = this.currentMission(), busy = this.collaboration.running || this.collaboration.recovering || this.collaboration.discussionBusy;
    this.renderExecution();
    $("mission-title").textContent = g.title;
    $("mission-brief").textContent = g.brief;
    $("mission-status").textContent = view.status;
    $("mission-round").textContent = view.round ? `第 ${view.round} 轮` : "等待团队接单";
    $("mission-repository").textContent = (g.source === "workspace" ? "当前工作区副本 · " : "") + (g.repositoryUrl?.replace("https://github.com/", "") || "流程演示 · 可新建真实项目任务");
    $("mission-activity").textContent = view.activity;
    $("mission-steps").replaceChildren(...MISSION_STEPS.map((label, index) => {
      const item = el("li", label);
      item.dataset.state = view.run && index < view.step ? "done" : "waiting";
      if (index === view.step) item.setAttribute("aria-current", "step");
      return item;
    }));
    $("mission-actors").replaceChildren(...view.actors.map((e) => {
      const button = el("button", `${TEAM_BY_ID[e.actor].name} · ${e.task}`);
      button.onclick = () => this.collaboration.select(e.actor);
      return button;
    }));
    $("mission-primary").textContent = view.active ? "跟随正在工作的伙伴" : g.pendingFeedback ? "下发修改意见" : view.delivery ? view.expired ? "查看成果 · 启动体验" : "体验成果与验收" : view.run?.status === "done" ? "查看本轮方案" : g.repositoryUrl ? "下发当前任务" : "下发新任务";
    $("mission-primary").disabled = this.collaboration.recovering || this.collaboration.discussionBusy || g.status === "archived";
    if (STATIC_DEPLOYMENT) {
      $("mission-new").textContent = "＋ 演示目标";
      $("mission-repository").textContent = "Pages 预设流程 · 数据保存在当前浏览器";
      if (!view.run) $("mission-activity").textContent = "点击开始预设演示，观察人物分工、工作、交接和返工。真实任务保留本地运行。";
      if (!view.active && view.run?.status !== "done") $("mission-primary").textContent = "开始预设演示";
      if (view.active) $("mission-status").textContent = "预设演示中";
    }
    $("mission-evidence").hidden = !view.run;
    $("mission-new").disabled = $("mission-history").disabled = busy;
    this.renderResults(view);
  }
  async openResults() {
    if ($("computer-dialog").open) $("computer-dialog").close();
    this.previewKey = null;
    this.resultSignature = null;
    $("result-notice").textContent = "";
    $("result-dialog").showModal();
    this.renderMission();
    const delivery = missionView(this.store.selected).delivery;
    if (delivery?.kind === "upstream") {
      try {
        const response = await fetch(new URL(delivery.manifestUrl, document.baseURI));
        if (!response.ok) throw new Error();
        const fresh = await response.json();
        if (fresh.runId !== delivery.runId || fresh.repository !== delivery.repository) throw new Error();
        this.cacheDelivery(fresh);
        this.renderMission();
      } catch { $("result-notice").textContent = "暂未能刷新运行状态，当前展示本轮已保存的交付记录。"; }
    }
  }
  renderResults(view) {
    if (!$("result-dialog").open) return;
    const g = this.store.selected, d = view.delivery;
    const signature = JSON.stringify([g.id, g.title, g.brief, g.criteria, g.acceptance, g.accepted, g.status, view.expired, d?.demoUrl, d?.tests.digest, view.run?.artifacts.length, this.collaboration.running, this.collaboration.discussionBusy]);
    if (this.resultSignature === signature) return;
    this.resultSignature = signature;
    $("result-title").textContent = `${g.title} · 第 ${view.round} 轮`;
    $("result-brief").textContent = `你下发的任务：${view.run?.goal || g.brief}`;
    $("result-provenance").textContent = d ? `${d.repository} · ${d.workspaceSource ? "本地源码快照" : "固定版本"} ${d.commit.slice(0, 8)}。自动检查通过后，仍需你逐项确认功能效果。` : "此轮产出是方案和角色记录，没有可运行网页。";
    $("result-criteria").replaceChildren(...g.criteria.map((criterion, index) => {
      const label = el("label", undefined, "criterion"), input = el("input");
      input.type = "checkbox"; input.checked = Boolean(g.acceptance?.includes(index));
      input.disabled = g.accepted || g.status !== "done";
      input.onchange = () => {
        const values = new Set(g.acceptance || []); input.checked ? values.add(index) : values.delete(index);
        this.store.edit({ acceptance: [...values] }); this.render();
      };
      label.append(input, el("span", criterion)); return label;
    }));
    $("result-accept").disabled = g.status !== "done" || g.accepted || g.acceptance?.length !== g.criteria.length;
    $("result-accept").textContent = g.accepted ? "已确认完成" : "确认完成这项任务";
    $("result-work").replaceChildren(...(view.run?.artifacts || []).filter((a) => ["develop", "review", "test"].includes(a.stage)).slice(-3).map((a) => el("p", `${TEAM_BY_ID[a.actor]?.name}：${a.summary}`)));
    if (d?.tests.browser) {
      $("result-work").append(el("h3", "桃桃的浏览器功能验收"));
      for (const item of d.tests.browser.cases) $("result-work").append(el("p", `${item.passed ? "PASS" : "FAIL"} · 原需求${item.criterion} · ${item.title}`));
      const evidence = el("a", "查看逐步操作、预期、实际与截图 ↗");
      evidence.href = new URL(`api/source/runs/${d.runId}/browser`, document.baseURI).href; evidence.target = "_blank"; evidence.rel = "noopener";
      $("result-work").append(evidence);
    }
    $("result-tests").textContent = d?.tests.checks.map((c) => `${c.passed ? "PASS" : "FAIL"} ${c.name}${c.detail ? " — " + c.detail : ""}`).join("\n") || "本轮没有网页构建与测试交付证据。";
    $("result-state").textContent = !d ? "方案产物" : view.expired ? "运行服务已到期 · 源码与证据保留" : `${d.tests.browser?.passed ? "浏览器功能验收通过 · " : ""}自动检查 ${d.tests.passedCount}/${d.tests.total} 通过 · 等待人工体验`;
    const url = d && !view.expired ? previewURL(d.demoUrl, document.baseURI) : null;
    $("result-external").hidden = !url;
    if (url) $("result-external").href = url; else $("result-external").removeAttribute("href");
    $("result-preview-hint").textContent = !d ? "可以在执行记录中阅读每位伙伴的方案。要交付可运行应用，请下发 GitHub 项目任务。" : view.expired ? "可以从已交付的本机目录重新启动成果，无需让 Agent 重做任务。" : "在下方直接操作成果。若原项目禁止内嵌，请使用独立窗口打开，房间会保留这项任务。";
    $("result-frame").hidden = !url;
    if (url && this.previewKey !== url) { $("result-frame").src = url; this.previewKey = url; }
    if (!url) { $("result-frame").removeAttribute("src"); this.previewKey = null; }
    $("result-restart").hidden = !(view.expired && d?.kind === "upstream" && d.provider === "local");
    $("result-download").hidden = !d;
    if (d) $("result-download").href = new URL(d.downloadUrl, document.baseURI).href;
    $("result-feedback-submit").disabled = this.collaboration.running || this.collaboration.discussionBusy || g.status === "archived";
    $("result-feedback-scope").textContent = d?.kind === "upstream" ? "同一目标新开一轮，继承本轮源码与固定版本，带着你的意见重新分工、修改和验证。" : "意见会写入当前目标的白板，供同一目标的下一轮协作参考。";
  }
  submitFeedback() {
    const c = this.collaboration, text = $("result-feedback").value.trim();
    if (!text || c.running || c.discussionBusy) return;
    try {
      this.store.addNote(`成果体验后的修改要求：${text}`);
      this.store.edit({ pendingFeedback: text, accepted: false, acceptance: [], status: "ready" });
      $("result-feedback").value = "";
      $("result-dialog").close();
      this.render();
      c.start();
    } catch (error) { $("result-notice").textContent = error.message; }
  }
  async restartResult() {
    const d = this.currentMission().delivery;
    if (!d || d.kind !== "upstream") return;
    $("result-restart").disabled = true;
    $("result-notice").textContent = "正在核对交付源码并启动已有成果…";
    try {
      const response = await fetch(new URL(`api/source/runs/${d.runId}/restart`, document.baseURI), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const delivery = await response.json();
      if (!response.ok) throw new Error(delivery.error || "启动失败");
      this.cacheDelivery(delivery);
      $("result-notice").textContent = "已启动原交付成果；没有重新运行 Agent，也没有改变原测试结论。";
      this.renderMission();
    } catch (error) { $("result-notice").textContent = error.message; }
    finally { $("result-restart").disabled = false; }
  }
  tasks(container, tasks) {
    container.replaceChildren();
    for (const task of tasks) {
      const item = el("article", undefined, "task-card");
      const badge = el("span", STATUS_TEXT[task.status] || "待命");
      badge.dataset.status = task.status;
      item.append(
        el("strong", `${task.name} · ${task.role}`),
        badge,
        el("p", task.task),
        el("small", `${task.artifacts.length} 份产物`),
      );
      container.append(item);
    }
  }
  render() {
    const goal = this.store.selected,
      run = goal.runs[0],
      tasks = this.store.tasks();
    const c = this.collaboration;
    $("start-team").disabled = $("mobile-start").disabled =
      c.running || c.recovering || c.discussionBusy || goal.status === "archived";
    if (!c.running && !c.discussionBusy)
      $("team-progress").textContent =
        goal.status === "archived"
          ? "目标已归档，恢复后可继续"
          : `${goal.accepted ? "已验收" : GOAL_STATUS[goal.status]} · ${c.artifacts.length} 份产物`;
    const choices = this.store
      .list()
      .map((g) => `${g.id}:${g.title}`)
      .join("|");
    if ($("goal-select").dataset.choices !== choices) {
      $("goal-select").replaceChildren(
        ...this.store.list().map((g) => new Option(g.title, g.id)),
      );
      $("goal-select").dataset.choices = choices;
    }
    $("goal-select").value = goal.id;
    $("goal-list").replaceChildren();
    for (const g of this.store.list()) {
      const b = el("button", undefined, "goal-item");
      b.classList.toggle("selected", g.id === goal.id);
      b.append(
        el("strong", g.title),
        el(
          "small",
          `${g.status !== "archived" && g.accepted ? "已验收" : GOAL_STATUS[g.status]} · ${g.runs.length} 轮记录`,
        ),
      );
      b.disabled =
        this.collaboration.running || this.collaboration.discussionBusy;
      b.onclick = () => {
        this.selectGoal(g.id);
        this.newGoal = false;
        this.fillForm(this.store.selected);
      };
      $("goal-list").append(b);
    }
    $("archive-goal").textContent = goalArchiveLabel({
      newGoal: this.newGoal,
      status: goal.status,
    });
    $("archive-goal").disabled = !goalArchiveEnabled({
      newGoal: this.newGoal,
      running: this.collaboration.running,
      discussionBusy: this.collaboration.discussionBusy,
    });
    $("goal-storage-info").textContent = this.store.persistent
      ? "目标与每轮交付保存在当前浏览器；关闭再打开仍可查看。"
      : "当前浏览器无法保存记录，请及时导出目标备份。";
    for (const id of ["goal-tasks", "board-tasks", "computer-tasks"])
      this.tasks($(id), tasks);
    $("board-title").textContent = `共享白板 · ${goal.title}`;
    $("board-brief").textContent = goal.brief;
    $("board-criteria").replaceChildren();
    goal.criteria.forEach((criterion, index) => {
      const label = el("label", undefined, "criterion");
      const input = el("input");
      input.type = "checkbox";
      input.checked = Boolean(goal.acceptance?.includes(index));
      input.disabled = goal.status !== "done" || goal.accepted;
      input.onchange = () => {
        const values = new Set(goal.acceptance || []);
        input.checked ? values.add(index) : values.delete(index);
        this.store.edit({ acceptance: [...values] });
        this.render();
      };
      label.append(input, el("span", criterion));
      $("board-criteria").append(label);
    });
    $("accept-delivery").disabled =
      goal.status !== "done" ||
      goal.accepted ||
      (goal.criteria.length > 0 &&
        goal.acceptance?.length !== goal.criteria.length);
    $("accept-delivery").textContent = goal.accepted
      ? "已确认验收"
      : "确认验收";
    $("board-notes").replaceChildren();
    for (const note of goal.notes.slice(-10)) {
      const item = el("article", undefined, "sticky-note");
      item.append(
        el(
          "small",
          `${TEAM_BY_ID[note.actor]?.name || "你的意见"} · ${date(note.time)}`,
        ),
        el("p", note.text),
      );
      $("board-notes").append(item);
    }
    if (!goal.notes.length)
      $("board-notes").append(
        el("p", "还没有讨论意见。可以贴便签，或邀请人物讨论。"),
      );
    $("goal-history").replaceChildren();
    for (const history of goal.runs) {
      const item = el("article", undefined, "run-history");
      item.append(
        el(
          "strong",
          `${date(history.startedAt)} · ${history.mode === "repository" ? "真实项目任务" : history.mode === "live" ? "真实协作" : "预设演示"} · ${GOAL_STATUS[history.status]}`,
        ),
      );
      for (const artifact of history.artifacts) {
        const b = el("button", artifact.title);
        b.onclick = () => this.collaboration.showArtifact(artifact);
        item.append(b);
      }
      $("goal-history").append(item);
    }
    if (!goal.runs.length)
      $("goal-history").append(el("p", "完成一轮协作后，交付会保留在这里。"));
    $("computer-goal").textContent =
      `${goal.title} / ${goal.accepted ? "已验收" : GOAL_STATUS[goal.status]}`;
    const delivery = run?.events.findLast(
      (e) => e.type === "run.complete",
    )?.delivery;
    $("delivery-card").hidden = !delivery;
    $("computer-delivery").hidden = !delivery;
    if (delivery) {
      const evidence = `${delivery.tests.passedCount}/${delivery.tests.total} 验证通过 · commit ${delivery.commit.slice(0, 8)}`;
      $("delivery-evidence").textContent = evidence;
      $("computer-delivery-summary").textContent =
        `${delivery.repository} · ${evidence}。${delivery.tests.scope}。${delivery.expiresAt ? `地址有效期至 ${new Date(delivery.expiresAt).toLocaleString("zh-CN")}，过期后可在成果页重新启动，无需重新执行目标。` : ""}`;
      const expired = delivery.expiresAt && Date.parse(delivery.expiresAt) <= Date.now();
      $("delivery-title").textContent = expired ? "运行地址已到期 · 源码与日志已保留" : delivery.kind === "upstream" ? "原项目已构建、测试并启动" : "Demo 已通过验证";
      if (delivery.expiresAt) $("delivery-evidence").textContent += ` · 限时至 ${new Date(delivery.expiresAt).toLocaleTimeString("zh-CN")}`;
      $("computer-test-log").textContent = delivery.tests.checks
        .map(
          (check) =>
            `${check.passed ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`,
        )
        .join("\n");
      for (const id of ["delivery-demo", "computer-demo"]) {
        if (expired) $(id).removeAttribute("href");
        else $(id).href = new URL(delivery.demoUrl, document.baseURI).href;
        $(id).textContent = expired ? "运行地址已到期，可在成果页重新启动" : "打开 Demo ↗";
      }
      for (const id of ["delivery-download", "computer-download"])
        $(id).href = new URL(delivery.downloadUrl, document.baseURI).href;
    }
    const sourceEvent = run?.events.find((e) => e.execution === "upstream" && e.runId);
    $("computer-source-logs").hidden = !sourceEvent;
    if (sourceEvent) $("computer-source-logs").href = new URL(`api/source/runs/${sourceEvent.runId}/logs`, document.baseURI).href;
    $("computer-source-snapshot").hidden = !sourceEvent || !["error", "stopped"].includes(run?.status);
    if (sourceEvent) $("computer-source-snapshot").href = new URL(`api/source/runs/${sourceEvent.runId}/snapshot`, document.baseURI).href;
    $("computer-artifacts").replaceChildren();
    for (const artifact of run?.artifacts || []) {
      const b = el(
        "button",
        `${TEAM_BY_ID[artifact.actor].name} · ${artifact.title}`,
        "computer-artifact",
      );
      b.onclick = () => this.collaboration.showArtifact(artifact);
      $("computer-artifacts").append(b);
    }
    $("computer-events").textContent =
      (run?.events || [])
        .filter((e) =>
          ["handoff", "tool", "revision", "run.complete", "run.error"].includes(
            e.type,
          ),
        )
        .slice(-12)
        .map((e) =>
          e.type === "handoff"
            ? `${TEAM_BY_ID[e.from].name} → ${TEAM_BY_ID[e.to].name}：${e.title}`
            : e.label || e.message || "本轮产物已归档",
        )
        .join("\n") || "等待团队提交第一份产物。";
    const sceneMission = this.currentMission();
    this.onScene({
      goal,
      tasks,
      artifacts: sceneMission.run?.artifacts || [],
      events: sceneMission.run?.events || [],
      live: c.running && c.mode !== "demo",
      mode: sceneMission.run?.mode || c.mode,
      backendTask: sceneMission.run?.id === c.backendTask?.client?.runId ? c.backendTask : null,
      takeoverVoiceBlocked: c.takeoverVoiceBlocked || false,
    });
    $("stage-goal").textContent = goal.title;
    const adjustment = takeoverBoard({ backendTask: sceneMission.run?.id === c.backendTask?.client?.runId ? c.backendTask : null, events: sceneMission.run?.events });
    const board = $("board-adjustment"); board.hidden = !adjustment;
    if (adjustment) {
      board.dataset.state = JSON.stringify(adjustment);
      board.replaceChildren(el("h3", `修改 ${adjustment.version} · ${adjustment.plan?.title || "正在整理方案"}`), el("p", adjustment.label), el("p", "你的意见：" + adjustment.feedback));
      for (const step of adjustment.plan?.steps || []) board.append(el("p", `${TEAM_BY_ID[step.owner].name}：${step.change}；验证：${step.verify}`));
      for (const line of adjustment.lines) board.append(el("p", `${TEAM_BY_ID[line.actor].name}${line.to ? " → " + TEAM_BY_ID[line.to].name : ""}：${line.text}`));
      if (adjustment.error) board.append(el("p", adjustment.error));
    } else { board.removeAttribute("data-state"); board.replaceChildren(); }
    this.renderMission();
  }
  openDiscussion(actor) {
    if (this.collaboration.backendTask?.control?.state === "paused") { this.openBoard(); return; }
    if (this.collaboration.discussionBusy) {
      if (!$("discussion-dialog").open) $("discussion-dialog").showModal();
      return;
    }
    $("discussion-actor").value = actor;
    $("discussion-partner").value = actor === "mori" ? "indigo" : "mori";
    $("discussion-title").textContent =
      `和${TEAM_BY_ID[actor].name}围绕目标讨论`;
    $("discussion-goal").textContent = this.store.selected.title;
    $("discussion-log").replaceChildren();
    for (const message of this.store.selected.discussion || [])
      this.addMessage(message, false);
    $("discussion-notice").textContent = "";
    this.updateDiscussionMode();
    $("discussion-dialog").showModal();
  }
  updateDiscussionMode() {
    const c = this.collaboration;
    $("discussion-mode").textContent =
      c.mode !== "demo"
        ? "真实对话：人物会读取当前目标、验收要求与已有产物，并回应伙伴。"
        : "预设对话：保存你的问题，播放固定角色讨论；选择真实 Agent 模式可得到针对问题的回答。";
  }
  addMessage(message, save = true) {
    const item = el("article", undefined, "dialogue-message");
    item.dataset.actor = message.actor;
    item.append(
      el(
        "strong",
        message.actor === "user"
          ? "你"
          : `${TEAM_BY_ID[message.actor].name}${message.to ? " → " + TEAM_BY_ID[message.to].name : ""}`,
      ),
      el("p", message.content || message.text),
    );
    $("discussion-log").append(item);
    $("discussion-log").scrollTop = $("discussion-log").scrollHeight;
    if (save) {
      const goal = this.store.selected;
      goal.discussion = [...(goal.discussion || []), message].slice(-30);
      this.store.save();
    }
  }
  async discuss() {
    const c = this.collaboration;
    if (c.discussionBusy) return;
    const question = $("discussion-question").value.trim();
    if (!question) return;
    if (c.running && !c.paused) await c.togglePause();
    this.dialogueController = new AbortController();
    this.voiceNotice = null;
    const signal = this.dialogueController.signal;
    c.discussionBusy = true;
    c.stopRoomSpeech({ preserveWork: c.running });
    c.presentSpeech(null);
    c.notice("正在围绕当前目标组织对话…");
    c.updateControls();
    $("send-discussion").disabled = true;
    $("stop-discussion").disabled = false;
    $("watch-discussion").disabled = false;
    $("pause-discussion").disabled = false;
    $("pause-discussion").textContent = "暂停播报";
    for (const field of [
      "discussion-actor",
      "discussion-partner",
      "discussion-question",
      "discussion-note",
    ])
      $(field).disabled = true;
    const actor = $("discussion-actor").value,
      partner = $("discussion-partner").value,
      goal = this.store.selected;
    const saveNote = $("discussion-note").checked;
    try {
      this.addMessage({ actor: "user", text: question, time: Date.now() });
      if (saveNote) this.store.addNote(question);
      this.render();
      this.discussionNarrator.setEnabled($("voice-enabled").checked);
      await this.discussionNarrator.unlock();
      // Let the conversation happen in the room; the dialog remains available
      // from the discussion button for its transcript and controls.
      if ($("discussion-dialog").open) {
        this.minimizing = true;
        $("discussion-dialog").close();
      }
      await c.stage?.beginDiscussion(
        [actor, ...(partner && partner !== actor ? [partner] : [])],
        signal,
      );
      $("discussion-notice").textContent = "伙伴正在整理回应…";
      const show = async (reply) => {
        signal.throwIfAborted();
        this.addMessage(reply);
        if (saveNote && !reply.clip)
          this.store.addNote(reply.content || reply.text, reply.actor);
        this.render();
        $("discussion-notice").textContent =
          `${TEAM_BY_ID[reply.actor].name}正在发言`;
        await this.discussionNarrator.speak(reply, signal);
      };
      if (c.mode === "demo") {
        const actors = [
          actor,
          ...(partner && partner !== actor ? [partner] : []),
        ];
        for (const person of actors) {
          const clip = {
            mori: "plan",
            amber: "research",
            indigo: "revised",
            luna: "review_issue",
            momo: "test_issue",
            sleepy: "record",
          }[person];
          await show({
            ...DEMO_LINES[clip],
            clip,
            to: actors.find((a) => a !== person) || null,
            kind: "discussion",
            time: Date.now(),
          });
        }
      } else {
        const artifacts = (goal.runs[0]?.artifacts || [])
          .slice(-6)
          .map(({ actor, title, summary, content }) => ({
            actor,
            title,
            summary,
            content: content.slice(0, 600),
          }));
        const response = await fetch(new URL("api/discuss", document.baseURI), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "live",
            actor,
            partner: partner || undefined,
            question,
            goal: goal.brief,
            context: {
              criteria: goal.criteria,
              notes: goal.notes.slice(-5).map((n) => n.text),
            },
            artifacts,
          }),
          signal,
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "对话暂时无法开始。");
        }
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = "",
          complete = false;
        const process = async (line) => {
          if (!line.trim()) return;
          const e = JSON.parse(line);
          if (e.type === "speech") await show(e);
          if (e.type === "discussion.error") throw new Error(e.message);
          if (e.type === "discussion.complete") complete = true;
        };
        try {
          while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            let split;
            while ((split = buffer.indexOf("\n")) >= 0) {
              const line = buffer.slice(0, split);
              buffer = buffer.slice(split + 1);
              await process(line);
            }
            if (done) {
              await process(buffer);
              break;
            }
          }
          if (!complete) throw new Error("对话连接已结束，已有回应已保留。");
        } finally {
          reader.releaseLock();
        }
      }
      $("discussion-question").value = "";
      $("discussion-notice").textContent = this.voiceNotice
        ? `讨论已记录。${this.voiceNotice}`
        : c.running
          ? "讨论已记录；关闭对话后可继续回放协作。"
          : "讨论已记录到当前目标。";
    } catch (error) {
      $("discussion-notice").textContent = signal.aborted
        ? "对话已停止，已有回应保留。"
        : error.message;
    } finally {
      this.dialogueController?.abort();
      this.discussionNarrator.stop();
      c.stage?.endDiscussion(c.running && !c.controller?.signal.aborted);
      c.discussionBusy = false;
      if (!c.running) c.paused = false;
      c.updateControls();
      $("send-discussion").disabled = false;
      $("stop-discussion").disabled = true;
      $("watch-discussion").disabled = true;
      $("pause-discussion").disabled = true;
      for (const field of [
        "discussion-actor",
        "discussion-partner",
        "discussion-question",
        "discussion-note",
      ])
        $(field).disabled = false;
      c.notice($("discussion-notice").textContent);
      this.render();
    }
  }
  stopDiscussion() {
    if (!this.collaboration.discussionBusy) return;
    this.dialogueController?.abort();
    this.discussionNarrator.stop();
  }
  export() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(this.store.data, null, 2)], {
        type: "application/json",
      }),
    );
    const link = el("a");
    link.href = url;
    link.download = "agent-room-goals.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.executionTimer);
    this.executionController?.abort();
    document.removeEventListener("visibilitychange", this.executionVisibility);
    this.stopDiscussion();
    this.discussionNarrator.dispose();
  }
}

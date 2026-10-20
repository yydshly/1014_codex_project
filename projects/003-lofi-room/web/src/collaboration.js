import { TEAM, TEAM_BY_ID, STATUS_TEXT, DEFAULT_GOAL } from "../shared/team.js";
import { runCollaboration, DEMO_LINES } from "../shared/workflow.js";
import { Narrator } from "./narrator.js";
import { workLines } from "../shared/room-lines.js";
import { BackgroundClient, activeTask } from "./background-client.js";
import { STATIC_DEPLOYMENT } from "../shared/deployment.js";

const $ = (id) => document.getElementById(id);
export class Collaboration {
  constructor({
    onAgent = () => {},
    onHandoff = () => {},
    onSpeaker = () => {},
    onSelect = () => {},
    onRunStart = () => {},
    stage = null,
  } = {}) {
    this.onAgent = onAgent;
    this.onHandoff = onHandoff;
    this.onSelect = onSelect;
    this.onRunStart = onRunStart;
    this.onSpeaker = onSpeaker;
    this.stage = stage;
    this.states = new Map(
      TEAM.map((member) => [member.id, { status: "idle", task: member.job }]),
    );
    this.artifacts = [];
    this.events = [];
    this.selected = "mori";
    this.controller = null;
    this.backend = new BackgroundClient();
    this.backendTask = null;
    this.connection = "idle";
    this.backendCursor = 0;
    this.running = false;
    this.paused = false;
    this.mode = "demo";
    this.lastMode = "demo";
    this.lastGoal = DEFAULT_GOAL;
    this.apiReady = false;
    this.execution = "upstream";
    this.sandboxStatus = { available: false, reason: "正在检查本机执行环境。" };
    $("repository-execution-mode").onchange = (event) => { this.execution = event.target.value; this.renderMode(); };
    this.roomUnlocked = false;
    this.roomSoundEnabled = true;
    this.narrator = new Narrator({
      onChange: (event) => {
        this.presentSpeech(event);
      },
      onNotice: (message) => {
        this.notice(message);
        if (this.narrator.paused) {
          this.paused = true;
          this.stage?.pause(true);
          $("pause-team").textContent = "继续回放";
        }
      },
    });
    this.roomNarrator = new Narrator({
      audioId: "room-voice-audio",
      onChange: (event) => {
        const previous = this.roomSpeech;
        this.roomSpeech = event;
        if (event && !this.discussionBusy && !this.narrator.current)
          this.presentSpeech(event);
        else if (!event && this.currentSpeech === previous)
          this.presentSpeech(null);
        this.updateControls();
      },
      onNotice: (message) => {
        if (this.roomNarrator.paused) {
          this.roomUnlocked = false;
          this.roomNarrator.paused = false;
          this.roomNarrator.setEnabled(false);
          this.roomNarrator.skip();
          this.renderRoomSound();
        }
        $("room-sound").title = message;
        this.notice(message);
      },
    });
    this.roomNarrator.setEnabled(false);
    this.takeoverNarrator = new Narrator({ audioId: "takeover-voice-audio",
      onChange: (event) => { this.takeoverSpeech = event; this.presentSpeech(event); this.syncState(); },
      onNotice: (message) => { this.takeoverVoiceBlocked = this.takeoverNarrator.paused; this.notice(message); this.syncState(); },
    });
    this.stage?.configureDialogue({
      speak: (event, signal) => {
        this.roomNarrator.setEnabled(
          this.roomUnlocked &&
            this.roomSoundEnabled &&
            $("voice-enabled").checked,
        );
        return this.roomNarrator.speak(event, signal);
      },
      cancel: () => this.roomNarrator.stop(),
      pause: (value) => {
        if (value) this.roomNarrator.pause();
        else this.roomNarrator.resume().catch(() => {});
      },
      workLines: (context) => workLines({ ...context, mode: this.mode }),
    });
    $("room-sound").addEventListener("click", async () => {
      if (
        this.roomUnlocked &&
        this.roomSoundEnabled &&
        $("voice-enabled").checked
      ) {
        this.roomSoundEnabled = false;
        this.roomNarrator.setEnabled(false);
        this.renderRoomSound();
      } else {
        this.roomSoundEnabled = true;
        $("voice-enabled").checked = true;
        this.narrator.setEnabled(true);
        await this.unlockRoomVoice();
      }
    });
    $("team-goal").value = DEFAULT_GOAL;
    $("start-team").addEventListener("click", () => this.start());
    $("pause-team").addEventListener("click", () => this.togglePause());
    $("stop-team").addEventListener("click", () => this.stop());
    $("voice-enabled").addEventListener("change", (e) => {
      this.narrator.setEnabled(e.target.checked);
      this.takeoverNarrator.setEnabled(e.target.checked);
      this.roomNarrator.setEnabled(
        e.target.checked && this.roomUnlocked && this.roomSoundEnabled,
      );
      this.renderRoomSound();
    });
    $("skip-speech").addEventListener("click", () =>
      (this.takeoverSpeech ? this.takeoverNarrator : this.discussionBusy
        ? this.discussionNarrator
        : this.roomSpeech
          ? this.roomNarrator
          : this.narrator
      )?.skip(),
    );
    $("preview-voice").addEventListener("click", () => this.previewVoice());
    $("open-agent-output").addEventListener("click", () =>
      this.showActorArtifacts(),
    );
    $("export-team").addEventListener("click", () => this.export());
    $("close-artifact").addEventListener("click", () =>
      $("artifact-dialog").close(),
    );
    $("team-mode").addEventListener("change", (e) => {
      this.mode = e.target.value;
      this.renderMode();
    });
    this.renderMode();
    this.select("mori");
    this.updateControls();
    this.refreshConfig();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.takeoverSpeech) { this.takeoverNarrator.pause(); this.takeoverVoiceBlocked = true; this.syncState(); return; }
      if (
        document.hidden &&
        (this.running || this.roomSpeech) &&
        !this.paused &&
        !this.discussionBusy
      )
        this.togglePause();
    });
  }
  renderRoomSound() {
    const enabled =
      this.roomUnlocked && this.roomSoundEnabled && $("voice-enabled").checked;
    $("room-sound").textContent = enabled ? "房间语音：开" : "开启房间语音";
    $("room-sound").setAttribute("aria-pressed", String(enabled));
  }
  async unlockRoomVoice() {
    try {
      await Promise.all([this.roomNarrator.unlock(), this.narrator.unlock()]);
      this.roomUnlocked = true;
      this.roomNarrator.setEnabled(
        this.roomSoundEnabled && $("voice-enabled").checked,
      );
    } catch {
      this.notice("房间语音暂时未能开启，互动字幕仍可观看。");
    }
    this.renderRoomSound();
  }
  stopRoomSpeech({ preserveWork = false } = {}) {
    this.stage?.cancelSocial();
    if (!preserveWork || !["work", "handoff"].includes(this.roomSpeech?.kind))
      this.roomNarrator.stop();
  }
  getSpeechLevel() {
    return (this.takeoverSpeech ? this.takeoverNarrator : this.roomSpeech ? this.roomNarrator : this.narrator).getLevel();
  }
  notice(message) {
    $("team-notice").textContent = message;
    this.stage?.notice(message);
  }
  async refreshConfig() {
    if (STATIC_DEPLOYMENT) {
      this.apiReady = false;
      this.sandboxStatus = { available: false, reason: "Pages 为预设演示；真实任务请按研究页说明启动本地 Node 服务。" };
      $("live-option").disabled = $("repository-option").disabled = true;
      $("voice-connection").textContent = "Pages 演示 · MiniMax 预生成录音";
      this.syncState(); return;
    }
    try {
      const response = await fetch(new URL("api/status", document.baseURI));
      if (!response.ok) throw new Error();
      const config = await response.json();
      this.apiReady = config.agents.configured;
      this.sandboxStatus = config.repository?.sandbox || { available: false, reason: "本地服务未提供原仓库执行器。" };
      $("live-option").disabled = !this.apiReady;
      $("repository-option").disabled = !config.repository?.enabled;
      $("voice-connection").textContent = config.speech.configured
        ? "MiniMax 已连接 · 六种音色"
        : "MiniMax 预生成语音";
    } catch {
      $("voice-connection").textContent = "MiniMax 预生成语音";
      $("live-option").disabled = true;
      $("repository-option").disabled = true;
    }
    this.syncState();
  }
  renderMode() {
    const live = this.mode !== "demo";
    $("repository-url-field").hidden = this.mode !== "repository";
    $("repository-execution-field").hidden = this.mode !== "repository";
    $("repository-execution-mode").value = this.execution;
    $("mode-description").textContent =
      this.mode === "repository"
        ? this.execution === "upstream"
          ? this.sandboxStatus.available ? `原仓库执行 · ${this.sandboxStatus.provider}：克隆、安装、修改、原有构建测试、启动 Demo。` : this.sandboxStatus.reason
          : "读取固定版本源码，独立实现离线 Demo，执行隔离功能测试后交付。"
        : live
          ? "六位角色调用真实模型，依次读取并提交产物。"
          : "预设流程演示：展示并行检查与返工，使用 MiniMax 生成语音。";
    $("run-kind").textContent =
      this.mode === "repository"
        ? "真实 GitHub 任务"
        : live
          ? "真实 Agent 协作"
          : "预设协作演示";
    this.select(this.selected);
  }
  updateControls() {
    $("start-team").disabled = this.running || this.recovering;
    $("mobile-start").disabled = this.running || this.recovering;
    $("mobile-start").textContent = this.running ? "协作进行中" : "开始协作";
    $("pause-team").disabled = !this.running;
    $("stop-team").disabled = !this.running;
    $("team-mode").disabled = this.running || this.discussionBusy;
    $("stage-pause").disabled =
      !this.running && !this.discussionBusy && !this.roomSpeech && !this.paused;
    $("stage-stop").disabled =
      !this.running && !this.discussionBusy && !this.roomSpeech && !this.paused;
    $("team-goal").disabled = this.running || this.discussionBusy;
    $("repository-url").disabled = this.running || this.discussionBusy;
    $("repository-execution-mode").disabled = this.running || this.discussionBusy;
    $("open-repository").disabled = this.running || this.recovering || this.discussionBusy;
    if (STATIC_DEPLOYMENT) $("open-repository").textContent = "本地真实任务说明";
    $("preview-voice").disabled = this.running || this.discussionBusy;
    $("goal-select").disabled = this.running || this.discussionBusy;
    $("pause-team").disabled = !this.running || this.discussionBusy;
    $("start-team").disabled = this.running || this.recovering || this.discussionBusy;
    $("mobile-start").disabled = this.running || this.recovering || this.discussionBusy;
    $("export-team").disabled = !this.artifacts.length;
    this.syncState();
  }
  syncState() {
    if (!this.discussionBusy) $("stage-pause").textContent = this.paused ? "继续" : "暂停";
    $("team-workspace").dataset.state = JSON.stringify({
      mode: this.mode,
      running: this.running,
      paused: this.paused,
      eventCount: this.events.length,
      artifactCount: this.artifacts.length,
      statuses: Object.fromEntries(this.states),
      speaker: this.currentSpeech?.actor || null,
      backendTaskId: this.backendTask?.id || null,
      backendStatus: this.backendTask?.status || null,
      executionControl: this.backendTask?.control || null,
      connection: this.connection,
      cursor: this.backendCursor,
    });
    this.onUpdate?.();
  }
  select(actor) {
    this.selected = actor;
    const member = TEAM_BY_ID[actor];
    if (!member) return;
    const state = this.states.get(actor);
    $("agent-role").textContent = member.role;
    $("talk-agent").textContent = `和${member.name}对话 ↗`;
    $("agent-instance").textContent =
      `${actor} / ${this.mode === "repository" && this.execution === "upstream" && ["momo", "sleepy"].includes(actor) ? "实际命令与交付执行器" : this.mode !== "demo" ? "MiniMax Agent" : "演示角色"}`;
    $("agent-state").textContent =
      this.currentSpeech?.actor === actor
        ? "发言中"
        : this.currentSpeech?.to === actor
          ? "倾听中"
          : STATUS_TEXT[state.status];
    $("agent-state").dataset.status = state.status;
    $("resident-activity").textContent = state.task;
    $("resident-description").textContent =
      this.mode === "repository"
        ? this.execution === "upstream" ? {
            mori: "拆解原项目目标与验收要求",
            amber: "克隆固定版本，阅读原仓库源码与运行方式",
            indigo: "修改原项目文件，修复真实构建及测试问题",
            luna: "审阅真实代码差异和目标实现情况",
            momo: "运行原有 build/test，返回真实退出码与日志",
            sleepy: "核对通过的版本与运行地址，归档源码和命令证据",
          }[actor] : {
            mori: "拆解 Demo 目标与验收要求",
            amber: "阅读固定版本源码并保留研究证据",
            indigo: "编写真实 Demo 文件，修复审阅与测试问题",
            luna: "检查实际代码与上游语义，提出返工意见",
            momo: "独立编写功能断言，在隔离环境真实运行测试",
            sleepy: "核对已通过的版本，整理源码包与运行说明",
          }[actor]
        : member.job;
    const count = this.artifacts.filter((item) => item.actor === actor).length;
    $("open-agent-output").textContent = count
      ? `查看 ${count} 份产物 ↗`
      : "查看角色任务 ↗";
  }
  reset() {
    this.takeoverNarrator?.stop(); this.takeoverPlayback = Promise.resolve(); this.takeoverLineIds = new Set(); this.takeoverVoiceBlocked = false;
    this.takeoverController?.abort(); this.executionControl = null; document.body?.classList.toggle("takeover-active", false);
    this.stage?.stop("准备开始 · 人物会走到白板前分工");
    this.narrator.stop();
    this.events = [];
    this.artifacts = [];
    $("artifact-count").textContent = "0";
    $("event-log").replaceChildren();
    $("artifact-list").replaceChildren();
    $("team-progress").textContent = "等待开始";
    $("team-notice").textContent = "";
    TEAM.forEach((member) => {
      const state = { status: "idle", task: member.job };
      this.states.set(member.id, state);
      this.onAgent(member.id, state);
    });
    try { this.stage?.idle(); }
    catch { this.stage?.notice?.("正在调整人物位置，下一阶段继续对齐当前任务。"); }
    this.select(this.selected);
  }
  async start() {
    if (this.running || this.recovering || this.discussionBusy) return;
    if (STATIC_DEPLOYMENT && this.mode !== "demo") return this.notice("Pages 只运行预设流程；请在本地服务下发真实任务。");
    const goal = $("team-goal").value.trim();
    if (this.mode === "repository") {
      if (this.execution === "upstream" && !this.sandboxStatus.available) {
        await this.refreshConfig();
        if (!this.sandboxStatus.available) return this.notice(this.sandboxStatus.reason);
      }
      this.repositoryURL = $("repository-url").value.trim();
      try {
        const url = new URL(this.repositoryURL);
        if (
          url.protocol !== "https:" ||
          url.hostname !== "github.com" ||
          !/^\/[\w-]+\/[\w.-]+\/?$/.test(url.pathname) ||
          url.search ||
          url.hash ||
          url.username ||
          url.password ||
          url.port
        )
          throw new Error();
      } catch {
        this.notice("请填写完整的公开 GitHub 仓库首页地址。");
        return;
      }
    }
    if (!goal || goal.length > 400) {
      this.notice("请填写 1 至 400 字的协作目标。");
      return;
    }
    try {
      this.goalContext = this.beforeStart?.(goal) || {};
    } catch (error) {
      this.notice(error.message);
      return;
    }
    this.reset();
    this.backendTask = null;
    this.backendCursor = 0;
    this.onRunStart();
    this.controller = new AbortController();
    this.lastMode = this.mode;
    this.lastGoal = goal;
    this.running = true;
    this.stopping = false;
    this.paused = false;
    $("pause-team").textContent = "暂停回放";
    this.updateControls();
    const signal = this.controller.signal;
    this.playback = Promise.resolve();
    const enqueue = (event) => {
      this.playback = this.playback.then(() => this.replay(event, signal));
      // The workflow emits synchronously; its next narration drains this queue.
      this.playback.catch(() => {});
    };
    try {
      const unlockVoice = async () => {
        if (this.roomSoundEnabled && $("voice-enabled").checked) await this.unlockRoomVoice();
        await this.narrator.unlock();
      };
      if (this.mode === "demo") {
        await unlockVoice();
        await runCollaboration({
          goal,
          context: this.goalContext,
          signal: this.controller.signal,
          pace: 650,
          emit: enqueue,
          narrate: async (event) => {
            await this.playback;
            await this.speakInScene(event, signal);
          },
        });
      } else {
        // Browsers can leave AudioContext.resume pending without a fresh gesture.
        // Audio activation must never hold the execution request hostage.
        unlockVoice().catch(() => this.notice("语音等待开启；后台任务继续执行，字幕与记录可查看。"));
        await this.runBackground(goal, this.controller.signal);
      }
      await this.playback;
    } catch (error) {
      if (this.controller.signal.aborted)
        this.notice("协作与播报已停止，已生成的产物仍可查看。");
      else {
        this.controller.abort();
        this.stage?.stop();
        if (this.events.at(-1)?.type !== "run.error")
          this.apply({
            type: "run.error",
            message: error.message,
            time: Date.now(),
          });
        this.notice(error.message);
        $("team-progress").textContent = "执行中断";
      }
    } finally {
      this.running = false;
      this.paused = false;
      this.narrator.stop();
      $("pause-team").textContent = "暂停回放";
      this.updateControls();
      this.select(this.selected);
    }
  }
  async replay(event, signal) {
    await this.narrator.waitResumed(signal);
    signal.throwIfAborted();
    await this.stage?.play(event, signal);
    signal.throwIfAborted();
    this.apply(event);
  }
  async speakInScene(event, signal) {
    await this.narrator.waitResumed(signal);
    await this.stage?.prepareSpeech(event, signal);
    await this.narrator.speak(event, signal);
    signal.throwIfAborted();
    this.stage?.finishSpeech(event);
  }
  catchUpScene(finished = false) {
    const paused = this.paused && !finished;
    this.presentationController?.abort();
    this.presentationController = new AbortController();
    this.presentation = Promise.resolve();
    this.presentationPending = 0;
    this.narrator.stop();
    this.paused = paused;
    for (const [actor, state] of this.states) this.onAgent(actor, state);
    this.stage?.followSnapshot(this.states, finished, this.artifacts);
    if (paused) { this.narrator.pause(); this.stage?.pause(true); }
  }
  receiveBackground(events, { catchup = false } = {}) {
    for (const event of events) this.apply(event, { scene: false });
    this.backendCursor = events.at(-1)?.seq ?? this.backendCursor;
    if (this.stopping) { this.syncState(); return; }
    const controlEvent = events.findLast((event) => event.type === "execution.control");
    if (controlEvent || catchup && this.backendTask?.control) this.syncExecutionControl(controlEvent?.control || this.backendTask.control);
    if (this.executionControl?.state === "paused") { this.syncState(); return; }
    const revisionIndex = events.findLastIndex((event) => event.type === "revision");
    if (revisionIndex >= 0 && !catchup && !document.hidden) {
      // Prioritize the actual failure discussion over older handoff narration.
      this.catchUpScene(false);
      events = events.slice(revisionIndex);
    }
    const browser = events.find((event) => event.type === "work.activity" && event.activity?.kind === "browser");
    const attempt = browser && `${browser.runId}:${browser.activity.round}`;
    if (attempt && attempt !== this.lastBrowserAttempt) {
      this.lastBrowserAttempt = attempt;
      // Bring the tester to the current workstation before displaying real
      // browser operations, even when older handoff narration is queued.
      this.catchUpScene(events.some((event) => ["run.complete", "run.error", "run.cancelled"].includes(event.type)));
    }
    if (catchup || document.hidden || (this.presentationPending || 0) > 24) {
      this.catchUpScene(events.some((e) => ["run.complete", "run.error", "run.cancelled"].includes(e.type)));
      this.syncState(); return;
    }
    this.presentationController ||= new AbortController();
    this.presentation ||= Promise.resolve();
    const signal = this.presentationController.signal;
    for (const event of events) {
      // Streaming stdout/read chunks are already reflected in the workbench.
      // They must not inflate the movement queue and discard a real discussion.
      if (["tool", "work.activity"].includes(event.type)) {
        if (!this.currentSpeech) void this.stage?.play(event, signal).catch(() => {});
        continue;
      }
      this.presentationPending = (this.presentationPending || 0) + 1;
      this.presentation = this.presentation.then(async () => {
        signal.throwIfAborted();
        await this.narrator.waitResumed(signal);
        await this.stage?.play(event, signal);
        if (event.type === "agent.state") this.onAgent(event.actor, { status: event.status, task: event.task });
        if (event.type === "speech") await this.speakInScene(event, signal);
      }).catch((error) => {
        if (!signal.aborted) {
          this.notice(`场景正在接回当前进度：${error.message}；后台任务继续执行。`);
          this.catchUpScene(!activeTask(this.backendTask));
        }
      }).finally(() => {
        if (!signal.aborted) this.presentationPending = Math.max(0, this.presentationPending - 1);
      });
    }
  }
  async controlTask(action, actor, text) {
    const task = this.backendTask;
    if (!activeTask(task) || !task.control) throw new Error("当前没有可接管的原仓库任务。");
    if (action === "voice") {
      $("voice-enabled").checked = true; this.takeoverNarrator.setEnabled(true);
      await this.takeoverNarrator.unlock(); await this.takeoverNarrator.resume(); this.takeoverVoiceBlocked = false;
      this.stage?.pause(false);
      if (!this.takeoverSpeech) { this.takeoverLineIds = new Set(); this.queueTakeover(task.control); }
      this.syncState(); return;
    }
    if (action === "feedback") {
      this.takeoverNarrator.setEnabled($("voice-enabled").checked);
      try { await this.takeoverNarrator.unlock(); } catch { this.takeoverVoiceBlocked = true; }
    }
    const result = await this.backend.control(task.id, action, { actor, version: task.control.version, ...(action === "feedback" ? { text } : {}) });
    if (this.backendTask?.id === task.id && activeTask(this.backendTask)) {
      this.backendTask = result.task; this.syncState();
    }
  }
  syncExecutionControl(control) {
    const previous = this.executionControl;
    this.executionControl = control;
    document.body?.classList.toggle("takeover-active", control.state === "paused" && Boolean(control.discussion));
    const same = previous?.state === control.state && previous?.version === control.version && previous?.actor === control.actor;
    if (same) { if (control.state === "paused") this.queueTakeover(control); return; }
    if (control.state === "pausing") { this.stage?.notice("正在收尾当前命令 · 后续步骤已拦住，稍后可提出修改"); return; }
    if (control.state === "paused") {
      if (previous?.state !== "paused" || previous?.actor !== control.actor) {
        if (previous?.state === "paused") { this.takeoverController?.abort(); this.stage?.endDiscussion(true); }
        this.catchUpScene(false); this.paused = false; this.stage?.pause(false);
        this.takeoverController?.abort(); this.takeoverController = new AbortController();
        this.takeoverNarrator?.stop(); this.takeoverLineIds = new Set();
        const signal = this.takeoverController.signal;
        this.takeoverPlayback = Promise.resolve(this.stage?.takeover(control, signal)).catch((error) => {
          if (!signal.aborted) this.notice(error.message);
        });
      } else if (!control.discussion) this.stage?.notice(control.notes.at(-1) ? `修改 ${control.version} 已记入本轮 · ${control.notes.at(-1).text}` : "执行已暂停 · 等待使用者指导");
      this.queueTakeover(control);
    } else if (previous && previous.state !== "running") {
      this.takeoverController?.abort(); this.takeoverNarrator?.stop(); this.takeoverPlayback = Promise.resolve(); this.stage?.endDiscussion(true);
      this.paused = false;
      this.catchUpScene(false); this.stage?.notice("已继续同一任务 · 按最新修改意见回到工位工作");
    }
  }
  queueTakeover(control) {
    if (!control.discussion || !this.takeoverController || this.takeoverController.signal.aborted) return;
    const signal = this.takeoverController.signal, discussion = control.discussion;
    if (this.takeoverDiscussionId !== discussion.id) {
      this.takeoverNarrator?.stop(); this.takeoverLineIds = new Set(); this.takeoverDiscussionId = discussion.id;
      // Newer feedback invalidates old queued speech, while retaining the actors' original work positions.
      this.takeoverGeneration = (this.takeoverGeneration || 0) + 1;
    }
    const generation = this.takeoverGeneration;
    const actors = discussion.participants.join(":");
    if (this.takeoverParticipants !== actors || this.takeoverVersion !== discussion.version) {
      this.takeoverParticipants = actors; this.takeoverVersion = discussion.version;
      this.takeoverPlayback = (this.takeoverPlayback || Promise.resolve()).then(async () => {
        signal.throwIfAborted(); if (generation !== this.takeoverGeneration) return;
        await this.stage?.takeover(control, signal);
      }).catch((error) => { if (!signal.aborted) this.notice(error.message); });
    }
    this.takeoverLineIds ||= new Set();
    if (this.restoringTakeover) for (const line of discussion.lines) this.takeoverLineIds.add(line.id);
    for (const line of discussion.lines) {
      if (this.takeoverLineIds.has(line.id)) continue;
      this.takeoverLineIds.add(line.id);
      this.takeoverPlayback = (this.takeoverPlayback || Promise.resolve()).then(async () => {
        signal.throwIfAborted(); if (generation !== this.takeoverGeneration) return;
        await this.stage?.takeoverSpeech(line, signal);
        await this.takeoverNarrator.speak(line, signal);
        this.stage?.finishTakeoverSpeech();
      }).catch((error) => { if (!signal.aborted) this.notice(error.message); });
    }
    if (discussion.status === "ready") this.takeoverPlayback.then(() => {
      if (!signal.aborted && generation === this.takeoverGeneration && this.executionControl?.state === "paused") this.stage?.notice("调整方案已写到白板 · 等你点击继续后回工位执行");
    });
  }
  async watchBackground(signal) {
    const task = await this.backend.follow(this.backendTask.id, { cursor: this.backendCursor, signal,
      onEvents: (events, options) => this.receiveBackground(events, options),
      onTask: (task, cursor) => { this.backendTask = task; this.backendCursor = cursor; this.syncState(); },
      onConnection: (state) => {
        if (state === "reconnecting") this.notice("与执行服务暂时断连，正在重连同一任务；不会重新提交。");
        else if (state === "restored") this.notice("已重新连接后台任务，正在接回当前进度。");
        this.connection = state === "restored" ? "connected" : state;
      },
    });
    this.backendTask = task;
    this.connection = "connected";
    // A paused/hidden room never delays a completed backend job.
    if (this.stopping) this.stage?.stop("后台任务已停止 · 源码与记录保留");
    else if (this.paused || document.hidden) this.catchUpScene(true);
    else {
      let timer;
      try { await Promise.race([this.presentation, new Promise((resolve) => { timer = setTimeout(() => { this.catchUpScene(true); resolve(); }, 12000); })]); }
      finally { clearTimeout(timer); }
    }
    if (task.status === "error" || task.status === "interrupted") this.notice(this.events.findLast((e) => e.type === "run.error")?.message || "本轮执行已中断，记录已保留。");
    this.syncState();
  }
  async runBackground(goal, signal) {
    if (!this.backendRequest) throw new Error("任务缺少目标关联，请从新任务入口提交。");
    this.presentationController?.abort();
    this.presentationController = new AbortController();
    this.presentation = Promise.resolve(); this.presentationPending = 0;
    this.connection = "submitting";
    this.backendTask = await this.backend.create({ ...this.backendRequest, goal, mode: this.mode, context: this.goalContext,
      ...(this.mode === "repository" ? { url: this.repositoryURL, execution: this.execution } : {}) });
    if (this.stopping) this.backendTask = (await this.backend.cancel(this.backendTask.id)).task;
    this.syncState();
    await this.watchBackground(signal);
  }
  async reconnectBackground(snapshot) {
    if (this.running) return;
    this.restoringBackend = true;
    this.reset();
    this.backendTask = snapshot.task;
    this.backendCursor = snapshot.cursor;
    this.connection = "connected";
    this.mode = this.lastMode = snapshot.task.mode;
    this.execution = snapshot.task.execution || "upstream";
    this.lastGoal = snapshot.task.goal;
    this.repositoryURL = snapshot.task.repository || "";
    this.controller = new AbortController();
    this.running = activeTask(snapshot.task);
    this.paused = false;
    this.stopping = false;
    for (const event of snapshot.events) this.apply(event, { scene: false });
    // Historical pause/resume events are evidence, not the current task status.
    this.backendTask = snapshot.task;
    this.restoringBackend = false;
    this.catchUpScene(!this.running);
    this.executionControl = null;
    if (this.running && snapshot.task.control) {
      this.restoringTakeover = true;
      try { this.syncExecutionControl(snapshot.task.control); } finally { this.restoringTakeover = false; }
    }
    this.renderMode(); this.updateControls();
    if (!this.running) return;
    this.notice("已接回同一后台任务 · 房间关闭或刷新不影响执行。");
    try { await this.watchBackground(this.controller.signal); }
    catch (error) {
      if (!this.controller.signal.aborted) this.notice(`任务观察中断：${error.message}。请刷新接回，不要重复提交。`);
    } finally {
      this.running = false; this.paused = false;
      this.narrator.stop(); this.updateControls(); this.select(this.selected);
    }
  }
  // Compatibility for older streaming clients; the room uses background tasks.
  async runLive(goal, signal) {
    const repository = this.mode === "repository";
    const response = await fetch(
      new URL(repository ? "api/repository/run" : "api/run", document.baseURI),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          mode: this.mode,
          context: this.goalContext,
          ...(repository ? { url: this.repositoryURL, execution: this.execution, sceneSync: true } : {}),
        }),
        signal,
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "真实协作未能启动。");
    }
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "",
      complete = false;
    let sceneFailure;
    let presentation = Promise.resolve();
    const process = (line) => {
      if (!line.trim()) return;
      signal.throwIfAborted();
      const event = JSON.parse(line);
      // Receive execution evidence immediately; voice and walking have a separate queue.
      // A slow handoff must not hide command output from the observer.
      this.apply(event, { scene: false });
      presentation = presentation.then(async () => {
      await this.narrator.waitResumed(signal);
      signal.throwIfAborted();
      await this.stage?.play(event, signal);
      if (event.type === "agent.state") this.onAgent(event.actor, { status: event.status, task: event.task });
      if (event.ackId) {
        await this.stage?.waitForActor(event.actor, signal);
        const ack = await fetch(
          new URL("api/repository/ack", document.baseURI),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ackId: event.ackId }),
            signal,
          },
        );
        if (!ack.ok)
          throw new Error("人物到达工位后的阶段确认失败，请重新开始任务。");
      }
      if (event.type === "speech") await this.speakInScene(event, signal);
      if (event.type === "run.error") throw new Error(event.message);
      });
      presentation.catch((error) => { sceneFailure ||= error; });
      if (event.type === "run.complete") complete = true;
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let split;
        while ((split = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, split);
          buffer = buffer.slice(split + 1);
          process(line);
          if (sceneFailure) throw sceneFailure;
        }
        if (done) {
          process(buffer);
          break;
        }
      }
      await presentation;
      if (!complete) throw new Error("协作连接提前结束，已保留收到的产物。");
    } finally {
      reader.releaseLock();
    }
  }
  apply(event, { scene = true } = {}) {
    if (event.type === "work.activity") {
      const previous = this.events.findLastIndex((item) => item.type === event.type && item.actor === event.actor && item.activity?.id === event.activity?.id);
      if (previous >= 0) this.events.splice(previous, 1);
    }
    this.events.push(event);
    if (event.type === "execution.control") {
      if (this.backendTask) this.backendTask = { ...this.backendTask, status: event.control.state, control: event.control };
      this.addLog("执行中接管", event.reason === "feedback" ? `修改 ${event.note.version}：${event.note.text}` : event.control.state === "paused" ? "后台执行已暂停，等待修改指导" : event.control.state === "pausing" ? "收尾当前操作，拦住后续步骤" : "继续同一任务");
    }
    if (event.type === "run.start") {
      $("team-progress").textContent = "正在拆分目标";
      this.addLog("任务开始", event.goal);
    }
    if (event.type === "agent.state") {
      const state = { status: event.status, task: event.task };
      this.states.set(event.actor, state);
      if (scene) this.onAgent(event.actor, state);
      this.select(this.selected);
      if (["working", "reviewing", "testing"].includes(event.status))
        $("team-progress").textContent =
          `${TEAM_BY_ID[event.actor].name} · ${event.task}`;
    }
    if (event.type === "tool")
      this.addLog(
        `${TEAM_BY_ID[event.actor].name} · ${TEAM_BY_ID[event.actor].role}`,
        event.label,
      );
    if (event.type === "artifact") {
      this.artifacts.push(event.artifact);
      const button = document.createElement("button");
      button.className = "artifact-item";
      button.textContent = `▤ ${event.artifact.title}`;
      button.addEventListener("click", () => this.showArtifact(event.artifact));
      $("artifact-list").prepend(button);
      $("artifact-count").textContent = String(this.artifacts.length);
      this.updateControls();
      this.select(this.selected);
    }
    if (event.type === "handoff") {
      this.onHandoff(event);
      this.addLog(
        `${TEAM_BY_ID[event.from].name} → ${TEAM_BY_ID[event.to].name}`,
        `交接：${event.title}`,
      );
    }
    if (event.type === "speech")
      this.addLog(`${TEAM_BY_ID[event.actor].name}发言`, event.text);
    if (event.type === "revision") {
      $("team-progress").textContent = "合并反馈，返回开发员";
      this.addLog("需要返工", event.message);
    }
    if (event.type === "run.complete") {
      $("team-progress").textContent =
        `协作完成 · ${event.artifactCount} 份产物`;
      this.addLog("本轮交付完成", "产物已归档，可查看或导出。");
    }
    if (event.type === "run.error") {
      this.notice(event.message);
      for (const [actor, state] of this.states)
        if (
          ["working", "reviewing", "testing", "queued"].includes(state.status)
        ) {
          state.status = "cancelled";
          state.task = "本轮已中断，等待重新开始";
          this.onAgent(actor, state);
        }
      this.select(this.selected);
    }
    this.syncState();
  }
  addLog(title, text) {
    const item = document.createElement("div");
    item.className = "event-item";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const body = document.createElement("p");
    body.textContent = text;
    item.append(heading, body);
    $("event-log").prepend(item);
    while ($("event-log").children.length > 60)
      $("event-log").lastChild.remove();
  }
  renderSpeaker(event) {
    document.body.classList.toggle("speaking", Boolean(event));
    $("speech-bar").hidden = !event;
    $("skip-speech").disabled = !event;
    if (event) {
      const member = TEAM_BY_ID[event.actor];
      $("speaker-name").textContent = event.to
        ? `${member.name} → ${TEAM_BY_ID[event.to].name}`
        : `${member.name} · ${member.role}`;
      $("speech-text").textContent = event.text;
      $("speech-origin").textContent = this.narrator.enabled
        ? event.clip
          ? "MiniMax · 预生成语音"
          : "MiniMax · 实时合成"
        : "字幕回放";
      if (event.kind === "takeover") $("speech-origin").textContent = `${this.takeoverNarrator.enabled ? "MiniMax 实时语音" : "字幕"} · 接管方案讨论 · 执行仍暂停`;
      if (["room", "work", "handoff"].includes(event.kind))
        $("speech-origin").textContent =
          `${this.roomUnlocked && this.roomSoundEnabled && $("voice-enabled").checked ? "MiniMax" : "字幕"} · ${event.kind === "room" ? "房间互动短句" : event.collection === "room" ? "任务交接短句" : "交接产物摘要"}`;
      if ($("follow-speaker").checked) this.onSelect(event.actor);
    }
    $("team-workspace").dataset.speaker = event?.actor || "";
    this.syncState();
  }
  presentSpeech(event) {
    this.currentSpeech = event;
    this.select(this.selected);
    this.onSpeaker(event?.actor || null, event?.to || null, event);
    this.renderSpeaker(event);
  }
  async togglePause() {
    if (!this.running) {
      if (!this.roomSpeech && !this.paused) return;
      this.paused = !this.paused;
      this.stage?.pause(this.paused);
      this.updateControls();
      return;
    }
    this.paused = !this.paused;
    if (this.paused) this.narrator.pause();
    else {
      try {
        await this.stage?.resume(this.controller.signal);
      } catch (error) {
        if (!this.controller.signal.aborted) this.notice(error.message);
        return;
      }
      this.presentSpeech(this.roomSpeech || this.narrator.current);
      await this.narrator.resume();
    }
    this.stage?.pause(this.paused);
    $("pause-team").textContent = this.paused ? "继续回放" : "暂停回放";
    this.syncState();
  }
  stop({ detach = false } = {}) {
    const background = !detach && (this.running && this.mode !== "demo" || activeTask(this.backendTask));
    if (background) this.stopping = true;
    if (background && activeTask(this.backendTask)) {
      this.connection = "cancelling";
      this.backend.cancel(this.backendTask.id).then(({ task }) => { this.backendTask = task; this.syncState(); })
        .catch((error) => { this.stopping = false; this.notice(`停止尚未确认：${error.message}。任务仍在后台，可重试停止。`); });
    }
    if (!background) this.controller?.abort();
    this.presentationController?.abort();
    this.takeoverController?.abort();
    this.takeoverNarrator?.stop();
    this.cancelDiscussion?.();
    this.stage?.stop();
    this.narrator.stop();
    for (const [id, state] of this.states)
      if (
        ["working", "reviewing", "testing", "queued"].includes(state.status)
      ) {
        state.status = "cancelled";
        this.onAgent(id, state);
      }
    this.select(this.selected);
    $("team-progress").textContent = "已停止 · 产物保留";
    this.syncState();
  }
  async previewVoice() {
    if (this.running) return;
    this.stopRoomSpeech();
    const clip = {
      mori: "plan",
      amber: "research",
      indigo: "draft",
      luna: "review_pass",
      momo: "test_pass",
      sleepy: "record",
    }[this.selected];
    $("preview-voice").disabled = true;
    try {
      await this.narrator.unlock();
      await this.narrator.speak(
        { actor: this.selected, text: DEMO_LINES[clip].text, clip },
        new AbortController().signal,
      );
    } finally {
      $("preview-voice").disabled = this.running;
    }
  }
  showActorArtifacts() {
    const outputs = this.artifacts.filter(
      (item) => item.actor === this.selected,
    );
    if (outputs.length) this.showArtifact(outputs.at(-1));
    else {
      const member = TEAM_BY_ID[this.selected];
      this.showArtifact({
        title: `${member.name} · ${member.role}`,
        content: `职责：${member.job}\n\n当前任务：${this.states.get(this.selected).task}\n\n状态：${STATUS_TEXT[this.states.get(this.selected).status]}\n\n暂无产物。`,
        inputIds: [],
      });
    }
  }
  showArtifact(artifact) {
    $("artifact-title").textContent = artifact.title;
    $("artifact-meta").textContent = artifact.actor
      ? `${TEAM_BY_ID[artifact.actor].name} · 输入 ${artifact.inputIds.length} 份产物`
      : "角色任务";
    $("artifact-content").textContent = artifact.content;
    $("artifact-dialog").showModal();
  }
  export() {
    const body = {
      goal: this.lastGoal,
      mode: this.lastMode,
      exportedAt: new Date().toISOString(),
      reportId:
        this.events.findLast((event) => event.type === "run.complete")
          ?.reportId || null,
      artifacts: this.artifacts,
      events: this.events,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "agent-room-collaboration.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  dispose() {
    this.stop({ detach: true });
    this.narrator.dispose();
    this.roomNarrator.dispose();
    this.takeoverNarrator?.dispose();
  }
}

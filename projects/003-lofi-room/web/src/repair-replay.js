import { repairMoments, repairSnapshot } from "../shared/repair-replay.js";

export function createRepairReplay({ collaboration, onFrame, onStart, onRestore }) {
  let controller;
  const banner = document.createElement("aside"); banner.className = "repair-replay-banner glass"; banner.hidden = true;
  const label = document.createElement("strong");
  const stop = document.createElement("button"); stop.textContent = "结束回看"; stop.type = "button";
  banner.append(label, stop); document.body.append(banner);
  stop.onclick = () => controller?.abort();
  const hold = (ms, signal) => new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException("结束回看", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
  return {
    get playing() { return Boolean(controller); },
    async start(snapshot) {
      const c = collaboration;
      if (controller || c.running || c.discussionBusy) return;
      controller = new AbortController(); const signal = controller.signal;
      c.narrator.stop();
      void c.narrator.unlock().catch(() => {});
      c.discussionBusy = true; c.updateControls(); banner.hidden = false;
      label.textContent = "载入真实返工记录 · 不执行新任务";
      try {
        const runId = snapshot.events.findLast((e) => e.execution === "upstream" && e.runId)?.runId;
        if (!runId) throw new Error("本轮没有原项目执行记录。");
        const response = await fetch(new URL(`api/source/runs/${runId}/events`, document.baseURI), { signal });
        if (!response.ok) throw new Error("本机未保留完整返工记录。");
        let events = (await response.text()).split("\n").filter((line) => line.trim()).map(JSON.parse);
        const previousRun = events.findLast((e) => e.type === "run.complete")?.delivery?.previousCheckpointRunId;
        if (previousRun && /^[a-f0-9-]{36}$/.test(previousRun)) {
          const old = await fetch(new URL(`api/source/runs/${previousRun}/events`, document.baseURI), { signal });
          if (!old.ok) throw new Error("续跑前的真实返工记录暂不可用。");
          events = [...(await old.text()).split("\n").filter((line) => line.trim()).map(JSON.parse), ...events];
        }
        const moments = repairMoments(events);
        if (!moments.length) throw new Error("本轮尚无完整的真实失败、讨论、修复及重测通过记录。");
        onStart();
        c.stage.stop("真实返工记录回放 · 不执行新任务");
        const initial = repairSnapshot(snapshot, events, moments[0]);
        c.stage.followSnapshot(initial.states, false, initial.artifacts);
        for (const [i, index] of moments.entries()) {
          signal.throwIfAborted();
          const event = events[index], frame = repairSnapshot(snapshot, events, index);
          label.textContent = `真实记录回放 ${i + 1}/${moments.length} · 不执行新任务`;
          for (const [actor, state] of frame.states) c.onAgent(actor, state);
          onFrame(frame);
          await c.stage.play(event, signal);
          if (event.type === "speech") await c.speakInScene(event, signal);
          else {
            if (event.type === "agent.state" && ["working", "testing"].includes(event.status)) await c.stage.waitForActor(event.actor, signal);
            await hold(event.type === "work.activity" ? 3500 : 1000, signal);
          }
        }
      } catch (error) { if (!signal.aborted) c.notice(`回看结束：${error.message}`); }
      finally {
        controller?.abort(); controller = null;
        c.narrator.stop(); banner.hidden = true; c.discussionBusy = false;
        c.stage.followSnapshot(c.states, true, c.artifacts); c.updateControls(); onRestore();
      }
    },
  };
}

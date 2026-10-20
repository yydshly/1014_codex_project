import test from "node:test";
import assert from "node:assert/strict";
import { Collaboration } from "../src/collaboration.js";

test("人物交接等待不阻塞工作台读取真实执行证据，工位到达后才确认阶段", async (t) => {
  const originalFetch = globalThis.fetch, originalDocument = globalThis.document;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.document = originalDocument; });
  globalThis.document = { baseURI: "http://localhost/1014_codex_project/003-lofi-room/" };
  let releaseScene, arrived = false, acknowledged = false;
  const waiting = new Promise((resolve) => { releaseScene = resolve; });
  const applied = [];
  const messages = [{ type: "run.start" }, { type: "agent.state", actor: "momo", status: "testing", ackId: "real-gate" },
    { type: "work.activity", actor: "momo", activity: { id: "test-command", output: "real stdout" } }, { type: "run.complete" }];
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/ack")) { assert.ok(arrived); acknowledged = true; return new Response('{}'); }
    return new Response(messages.map((event) => JSON.stringify(event)).join("\n") + "\n");
  };
  const c = { mode: "repository", goalContext: {}, execution: "upstream", narrator: { waitResumed: async () => {} },
    stage: { play: async (event) => { if (event.type === "run.start") await waiting; }, waitForActor: async () => { arrived = true; } },
    apply: (event) => applied.push(event), onAgent: () => {} };
  const run = Collaboration.prototype.runLive.call(c, "observe", new AbortController().signal);
  await new Promise(setImmediate);
  assert.ok(applied.some((event) => event.type === "work.activity"), "交接还没播完也应收到实时命令输出");
  assert.equal(acknowledged, false);
  releaseScene(); await run;
  assert.equal(acknowledged, true);
});

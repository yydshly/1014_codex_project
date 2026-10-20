import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApi, BASE } from "../server/api.js";
import { TEAM } from "../shared/team.js";

test("执行状态仅跟踪真实请求，完成、报错或取消后清除，不把历史和服务当任务", async (t) => {
  let release, started, behaviour;
  const middleware = createApi({ getConfig: () => ({ apiKey: "test-only-key", voices: {} }),
    sandboxProbe: async () => ({ available: true }),
    sourceTask: async ({ signal }) => {
      started();
      await new Promise((resolve, reject) => {
        release = () => behaviour === "error" ? reject(new Error("test failure")) : resolve();
        signal.addEventListener("abort", () => reject(new Error("test cancelled")), { once: true });
      });
    },
  });
  const server = createServer((req, res) => middleware(req, res, () => res.end()));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}${BASE}api/`;
  const status = () => fetch(base + "execution-status").then((r) => r.json());
  assert.equal((await status()).task, null);
  for (behaviour of ["complete", "error", "cancel"]) {
    const ready = new Promise((resolve) => { started = resolve; });
    const controller = new AbortController();
    const response = await fetch(base + "repository/run", { method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://github.com/example/repo", execution: "upstream", goal: "增加搜索" }) });
    await ready;
    const active = await status();
    assert.equal(active.task.goal, "增加搜索");
    assert.equal(active.task.execution, "upstream");
    assert.ok(!JSON.stringify(active).includes("test-only-key"));
    if (behaviour === "cancel") {
      controller.abort();
      await assert.rejects(response.text());
    } else { release(); await response.text(); }
    // HTTP close delivery is asynchronous; observe its bounded cleanup.
    let after;
    for (let i = 0; i < 20; i++) {
      after = await status();
      if (!after.task) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(after.task, null, behaviour);
    assert.equal(after.maintenance, false);
  }
});

test("本地语音代理隐藏密钥，拒绝跨站和超长文本", async () => {
  const config = {
    apiKey: "unit-test-private-key",
    baseURL: "https://api.minimax.cn",
    ttsModel: "speech-2.8-turbo",
    textModel: "MiniMax-M3",
    voices: Object.fromEntries(TEAM.map((m) => [m.id, m.voice])),
  };
  const middleware = createApi({
    getConfig: () => config,
    speech: {
      synthesize: async () => ({
        audio: Buffer.from("494433", "hex"),
        duration: 100,
        voiceId: "male-qn-jingying",
        cached: false,
      }),
    },
  });
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 404;
      res.end();
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}${BASE}api/`;
  try {
    const status = await fetch(url + "status");
    assert.equal(status.status, 200);
    const text = await status.text();
    assert.ok(!text.includes(config.apiKey));
    const cross = await fetch(url + "speech", {
      method: "POST",
      headers: {
        Origin: "https://attacker.invalid",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(cross.status, 403);
    const audio = await fetch(url + "speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: "mori", text: "你好" }),
    });
    assert.equal(audio.status, 200);
    assert.equal(audio.headers.get("X-Voice-Provider"), "MiniMax");
    assert.equal(audio.headers.get("Content-Type"), "audio/mpeg");
    const huge = await fetch(url + "run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "live", goal: "x".repeat(401) }),
    });
    assert.equal(huge.status, 400);
    const bad = await fetch(url + "speech", { method: "POST", body: "{" });
    assert.equal(bad.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

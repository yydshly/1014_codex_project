import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApi, BASE } from "../server/api.js";
test("两位角色对话读取目标、验收和前序发言，接口校验人物", async () => {
  const calls = [];
  const api = createApi({
    getConfig: () => ({}),
    dialogueFactory: () => async (input) => {
      calls.push({ ...input, previous: input.previous.slice() });
      return {
        type: "speech",
        actor: input.actor,
        to: input.to,
        text: "围绕验收要求回应伙伴",
      };
    },
  });
  const server = createServer((req, res) => api(req, res, () => res.end()));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}${BASE}api/discuss`;
  try {
    const input = {
      mode: "live",
      actor: "luna",
      partner: "indigo",
      question: "怎么修改？",
      goal: "完善协同工作台",
      context: {
        criteria: ["分工明确"],
        notes: ["给白板留记录"],
        historicalArtifacts: [
          {
            runId: "previous-run",
            mode: "live",
            actor: "mori",
            title: "上一轮方案",
            summary: "保留验收",
            content: "旧方案摘要",
          },
        ],
      },
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const events = (await response.text()).trim().split("\n").map(JSON.parse);
    assert.equal(events.at(-1).type, "discussion.complete");
    assert.equal(calls.length, 2);
    assert.equal(calls[1].previous[0].actor, "luna");
    assert.deepEqual(calls[0].context.criteria, ["分工明确"]);
    assert.equal(calls[0].context.historicalArtifacts[0].runId, "previous-run");
    const bad = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ ...input, actor: "stranger" }),
    });
    assert.equal(bad.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

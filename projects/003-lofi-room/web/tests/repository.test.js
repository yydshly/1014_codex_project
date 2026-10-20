import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { unzipSync, strFromU8 } from "fflate";
import {
  parseRepository,
  openRepository,
  RepositoryRun,
} from "../server/repository.js";
import { evaluateCore, testDemo } from "../server/demo-tests.js";
import {
  runRepositoryTask,
  createRepositoryExecutor,
} from "../server/repository-agent.js";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import { TEAM_BY_ID } from "../shared/team.js";
import { createApi, BASE } from "../server/api.js";

const sha = "a".repeat(40);
function mockToolModel({ doGenerate }) {
  return new MockLanguageModelV4({
    doStream: doGenerate.map((response) => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          ...response.content,
          {
            type: "finish",
            finishReason: response.finishReason,
            usage: response.usage,
          },
        ],
        initialDelayInMs: 0,
        chunkDelayInMs: 0,
      }),
    })),
  });
}
const fakeFetch = async (url) => {
  if (url.endsWith("/repos/example/counter"))
    return Response.json({
      default_branch: "main",
      description: "Counter",
      license: { spdx_id: "MIT" },
    });
  if (url.endsWith("/commits/main")) return Response.json({ sha });
  if (url.includes("/git/trees/"))
    return Response.json({
      tree: [
        { type: "blob", mode: "100644", path: "README.md", size: 10 },
        { type: "blob", mode: "100644", path: "src/counter.js", size: 30 },
        { type: "blob", mode: "120000", path: "link.js", size: 10 },
      ],
    });
  if (url.includes("raw.githubusercontent.com/example/counter/" + sha + "/"))
    return new Response(
      url.endsWith("README.md") ? "A counter" : "function add(a,b){return a+b}",
    );
  return new Response("missing", { status: 404 });
};
const core = "globalThis.DemoAPI={add:(a,b)=>a+b}";
const cases = Array.from({ length: 5 }, (_, i) => ({
  name: `真实加法 ${i}`,
  expression: `DemoAPI.add(${i},2)===${i + 2}`,
}));
async function writeDemo(run, code = core) {
  for (const [name, text] of Object.entries({
    "index.html":
      '<!doctype html><link rel="stylesheet" href="style.css"><button id="add">增加</button><script src="core.js"></script><script src="app.js"></script>',
    "style.css": "body{color:green}",
    "core.js": code,
    "app.js": 'document.getElementById("add").onclick=()=>DemoAPI.add(1,2)',
    "tests.json": JSON.stringify(cases),
  }))
    await run.write(name, text);
}
async function workspace(t) {
  const directory = await mkdtemp(join(tmpdir(), "lofi-repository-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const run = new RepositoryRun(directory);
  await run.init();
  return { directory, run };
}

test("仓库输入仅允许 GitHub 首页；固定 commit，排除符号链接与越界读取", async () => {
  assert.deepEqual(parseRepository("https://github.com/example/counter.git"), {
    owner: "example",
    repo: "counter",
    url: "https://github.com/example/counter",
  });
  for (const url of [
    "http://github.com/a/b",
    "https://localhost/a/b",
    "https://github.com@evil.test/a/b",
    "https://github.com/a/b/tree/main",
    "https://github.com/a/b?x=1",
    "https://github.com:123/a/b",
    "https://github.com/a/..",
    "file:///etc/passwd",
  ])
    assert.throws(() => parseRepository(url));
  const repo = await openRepository("https://github.com/example/counter", {
    fetcher: fakeFetch,
  });
  assert.equal(repo.commit, sha);
  assert.equal(repo.license, "MIT");
  assert.equal(repo.readme.path, "README.md");
  assert.ok(!repo.files.some((f) => f.path === "link.js"));
  assert.match(await repo.read("src/counter.js"), /function add/);
  await assert.rejects(repo.read("../../.env"));
  await assert.rejects(repo.read("link.js"));
  let attempts = 0;
  const retried = await openRepository("https://github.com/example/counter", {
    fetcher: async (url) => {
      if (attempts++ === 0) throw new TypeError("temporary network failure");
      return fakeFetch(url);
    },
  });
  assert.equal(retried.commit, sha);
  assert.ok(attempts >= 5);
});

test("Demo 写入不能越界；QuickJS 无宿主权限、超时中断，真实失败不能当成通过", async (t) => {
  const { run } = await workspace(t);
  await assert.rejects(run.write("../.env", "private"));
  await assert.rejects(run.read("../.env"));
  assert.equal(
    await evaluateCore(
      "",
      "typeof process==='undefined' && typeof require==='undefined' && typeof fetch==='undefined'",
    ),
    true,
  );
  await assert.rejects(evaluateCore("while(true){}", "true", 20));
  await writeDemo(run, "globalThis.DemoAPI={add:(a,b)=>a-b}");
  let result = await testDemo(run);
  assert.equal(result.passed, false);
  assert.equal(result.checks.filter((c) => !c.passed).length, 5);
  await run.write("core.js", core);
  result = await testDemo(run);
  assert.equal(result.passed, true);
  assert.match(await run.read("tests.log"), /PASS 真实加法/);
  assert.equal(JSON.parse(await run.read("test-history.json")).length, 2);
  await run.write(
    "core.js",
    "/* 来源 https://github.com/example/counter */\n" + core,
  );
  assert.equal((await testDemo(run)).passed, true);
  await run.write(
    "index.html",
    (await run.read("index.html")) +
      '<a href="https://github.com/example/counter">上游来源</a>',
  );
  assert.equal((await testDemo(run)).passed, true);
  await run.write("app.js", "fetch('https://example.com')");
  assert.equal((await testDemo(run)).passed, false);
});

test("GitHub 连接失败保留失败事件，不启动模型或伪造交付", async (t) => {
  const { directory } = await workspace(t),
    events = [];
  await assert.rejects(
    runRepositoryTask({
      url: "https://github.com/example/counter",
      goal: "counter",
      directory,
      config: {},
      signal: new AbortController().signal,
      fetcher: async () => new Response("missing", { status: 404 }),
      executorFactory: () => {
        throw new Error("不应启动模型");
      },
      emit: (e) => events.push(e),
    }),
    /HTTP 404/,
  );
  assert.equal(events.at(-1).type, "run.error");
  assert.ok(!events.some((e) => e.type === "run.complete"));
});

test("文件工具完成即以实际文件生成交接，不额外要求模型生成收尾文字", async (t) => {
  const { run } = await workspace(t);
  await writeDemo(run);
  const files = await run.files(),
    repo = await openRepository("https://github.com/example/counter", {
      fetcher: fakeFetch,
    });
  const usage = { inputTokens: { total: 5 }, outputTokens: { total: 5 } };
  const call = (toolName, input) => ({
    content: [
      {
        type: "tool-call",
        toolCallId: toolName,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls", raw: undefined },
    usage,
    warnings: [],
  });
  const model = mockToolModel({
    doGenerate: [
      call("write_demo", {
        html: files["index.html"],
        css: files["style.css"],
        core: files["core.js"],
        app: files["app.js"],
        notes: "DemoAPI.add(a,b) 返回两数之和；返工时保持此契约。",
      }),
      call("publish_result", {
        title: "真实文件",
        summary: "四份代码已写入",
        content: "加法 API 与界面已实现",
        verdict: "approve",
      }),
    ],
  });
  const output = await createRepositoryExecutor(
    {
      apiKey: "local-unit-test",
      baseURL: "https://api.minimax.cn",
      textModel: "mock",
    },
    repo,
    run,
    { model },
  )({
    role: TEAM_BY_ID.indigo,
    stage: "develop",
    goal: "加法",
    inputs: [],
    revision: 0,
    context: {},
    signal: new AbortController().signal,
    onTool: () => {},
  });
  assert.match(output.title, /Demo 源码/);
  assert.equal(model.doStreamCalls.length, 1);
  assert.equal(output.data.digest, await run.digest());
  assert.match(output.content, /DemoAPI.add\(a,b\)/);
});

test("返工时可凭实际源码证据退回错误断言，保持正确开发文件", async (t) => {
  const { run } = await workspace(t);
  await writeDemo(run);
  const repo = await openRepository("https://github.com/example/counter", {
    fetcher: fakeFetch,
  });
  const call = (toolName, input, n) => ({
    content: [
      {
        type: "tool-call",
        toolCallId: `call-${n}`,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls", raw: undefined },
    usage: { inputTokens: { total: 5 }, outputTokens: { total: 5 } },
    warnings: [],
  });
  const model = mockToolModel({
    doGenerate: [
      call("read_demo", {}, 1),
      call("read_source", { path: "src/counter.js" }, 2),
      call(
        "publish_result",
        {
          title: "请验证员修正预期",
          summary: "源码证实加法返回和，错误断言应期望 4。",
          content:
            "src/counter.js 中 add(2,2) 返回 4，测试不能期望 5；保持源码，请验证员修订。",
          verdict: "revise",
          fixTarget: "tests",
        },
        3,
      ),
    ],
  });
  const before = await run.digest();
  const output = await createRepositoryExecutor(
    {
      apiKey: "unit-test",
      baseURL: "https://api.minimax.cn",
      textModel: "mock",
    },
    repo,
    run,
    { model },
  )({
    role: TEAM_BY_ID.indigo,
    stage: "develop",
    goal: "加法",
    inputs: [],
    revision: 1,
    context: {},
    signal: new AbortController().signal,
    onTool: () => {},
  });
  assert.equal(output.data.fixTarget, "tests");
  assert.equal(output.verdict, "revise");
  assert.equal(before, await run.digest());
  assert.match(output.content, /src\/counter.js/);
});

test("不兼容测试退回验证员；真实失败覆盖模型自称通过的结论", async (t) => {
  const { run } = await workspace(t);
  await writeDemo(run, "globalThis.DemoAPI={add:(a,b)=>a-b}");
  const repo = await openRepository("https://github.com/example/counter", {
    fetcher: fakeFetch,
  });
  const call = (toolName, input, n) => ({
    content: [
      {
        type: "tool-call",
        toolCallId: `call-${n}`,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls", raw: undefined },
    usage: { inputTokens: { total: 5 }, outputTokens: { total: 5 } },
    warnings: [],
  });
  const model = mockToolModel({
    doGenerate: [
      call("read_demo", {}, 1),
      call(
        "write_tests",
        {
          cases: cases.map((entry) => ({
            ...entry,
            expression: "require('./core.js').add(2,2)===4",
          })),
        },
        2,
      ),
      call("write_tests", { cases }, 3),
      call("run_tests", {}, 4),
      call(
        "publish_result",
        {
          title: "模型声称通过",
          summary: "模型声称通过",
          content: "未正确反映真实失败",
          verdict: "approve",
        },
        5,
      ),
    ],
  });
  const output = await createRepositoryExecutor(
    {
      apiKey: "unit-test",
      baseURL: "https://api.minimax.cn",
      textModel: "mock",
    },
    repo,
    run,
    { model },
  )({
    role: TEAM_BY_ID.momo,
    stage: "test",
    goal: "加法",
    inputs: [],
    revision: 0,
    context: {},
    signal: new AbortController().signal,
    onTool: () => {},
  });
  assert.equal(model.doStreamCalls.length, 4);
  assert.equal(output.verdict, "revise");
  assert.equal(output.data.tests.passed, false);
  assert.ok(
    !JSON.parse(await run.read("tests.json")).some((entry) =>
      entry.expression.includes("require"),
    ),
  );
});

test("真实文件测试失败后经过两次返工，再通过才进入记录员和交付", async (t) => {
  const { directory } = await workspace(t),
    events = [],
    actors = [];
  let reviewAttempts = 0;
  const result = await runRepositoryTask({
    url: "https://github.com/example/counter",
    goal: "加法 Demo",
    directory,
    config: {},
    signal: new AbortController().signal,
    fetcher: fakeFetch,
    emit: (e) => events.push(e),
    executorFactory:
      (_config, repo, run) =>
      async ({ stage, role, revision }) => {
        actors.push(role.id);
        if (stage === "review" && reviewAttempts++ === 0)
          throw Object.assign(new Error("temporary model failure"), {
            retryable: true,
          });
        let verdict = "approve",
          data = {};
        if (stage === "research") {
          await repo.read("README.md");
          await repo.read("src/counter.js");
        }
        if (stage === "develop")
          await writeDemo(
            run,
            revision < 2 ? "globalThis.DemoAPI={add:(a,b)=>a-b}" : core,
          );
        if (stage === "test") {
          const tests = await testDemo(run);
          verdict = tests.passed ? "approve" : "revise";
          data = { tests };
        }
        if (stage === "record")
          data.delivery = { runId: run.id, tests: await testDemo(run) };
        return {
          title: stage,
          summary: stage + "已执行",
          content: "真实文件证据",
          verdict,
          data,
        };
      },
  });
  assert.equal(events.filter((e) => e.type === "revision").length, 2);
  assert.ok(
    events.some((e) => e.type === "tool" && e.label.includes("重试当前角色")),
  );
  assert.equal(events.at(-1).type, "run.complete");
  assert.equal(events.at(-1).delivery.tests.passed, true);
  assert.ok(actors.includes("sleepy"));
  assert.equal(result.mode, "repository");
});

test("场景确认后才执行工具，断开中止任务，交付提供沙箱页面与源码包并拒绝篡改", async (t) => {
  const { directory, run } = await workspace(t);
  await writeDemo(run);
  const tests = await testDemo(run);
  await run.write("delivery.json", JSON.stringify({ tests, runId: run.id }));
  let entered = false,
    notifyAbort;
  const aborted = new Promise((resolve) => {
    notifyAbort = resolve;
  });
  const middleware = createApi({
    directory,
    getConfig: () => ({
      apiKey: "test-private",
      voices: {},
      ttsModel: "test",
      textModel: "test",
    }),
    repositoryTask: async ({ emit, waitForActor, signal }) => {
      signal.addEventListener("abort", notifyAbort, { once: true });
      emit({
        type: "agent.state",
        actor: "indigo",
        status: "working",
        task: "编写代码",
      });
      await waitForActor("indigo", signal);
      entered = true;
      emit({ type: "run.complete", artifactCount: 0 });
    },
  });
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 404;
      res.end();
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}${BASE}api/`;
  const response = await fetch(base + "repository/run", {
    method: "POST",
    body: JSON.stringify({
      url: "https://github.com/example/counter",
      goal: "counter",
      sceneSync: true,
    }),
  });
  const reader = response.body.getReader(),
    first = new TextDecoder().decode((await reader.read()).value);
  const event = JSON.parse(first.trim());
  assert.ok(event.ackId);
  assert.equal(entered, false);
  assert.equal(
    (
      await fetch(base + "repository/run", {
        method: "POST",
        body: JSON.stringify({
          url: "https://github.com/example/counter",
          goal: "second",
        }),
      })
    ).status,
    429,
  );
  const ack = await fetch(base + "repository/ack", {
    method: "POST",
    body: JSON.stringify({ ackId: event.ackId }),
  });
  assert.equal(ack.status, 200);
  while (!(await reader.read()).done) {
    /* Drain completion. */
  }
  assert.equal(entered, true);
  const cancel = new AbortController();
  const pending = await fetch(base + "repository/run", {
    method: "POST",
    signal: cancel.signal,
    body: JSON.stringify({
      url: "https://github.com/example/counter",
      goal: "cancel",
      sceneSync: true,
    }),
  });
  const pendingReader = pending.body.getReader();
  const pendingEvent = JSON.parse(
    new TextDecoder().decode((await pendingReader.read()).value).trim(),
  );
  cancel.abort();
  await aborted;
  assert.equal(
    (
      await fetch(base + "repository/ack", {
        method: "POST",
        body: JSON.stringify({ ackId: pendingEvent.ackId }),
      })
    ).status,
    404,
  );
  const preview = await fetch(base + `repository/runs/${run.id}/demo`);
  assert.match(
    preview.headers.get("Content-Security-Policy"),
    /sandbox allow-scripts;/,
  );
  const html = await preview.text();
  assert.match(html, /DemoAPI/);
  assert.ok(!html.includes('src="core.js"'));
  const zip = await fetch(base + `repository/runs/${run.id}/download`);
  assert.match(zip.headers.get("Content-Type"), /zip/);
  const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  assert.equal(strFromU8(entries["core.js"]), core);
  await run.write("core.js", core + "; changed=true");
  assert.equal(
    (await fetch(base + `repository/runs/${run.id}/demo`)).status,
    409,
  );
  assert.equal(
    (
      await fetch(
        base + "repository/runs/00000000-0000-0000-0000-000000000000/demo",
      )
    ).status,
    404,
  );
});

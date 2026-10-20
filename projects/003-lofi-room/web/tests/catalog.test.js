import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createCatalogGateway } from "../server/catalog.js";
test("总入口保留项目数据，其他项目同路径可访问，不能读私有文件", async () => {
  // The gateway contract must also hold in a clean checkout, where another
  // project's ignored dist directory is absent. Build a real fixture tree.
  const fs = await import("node:fs/promises"), path = await import("node:path"), os = await import("node:os");
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "lofi-catalog-"));
  await fs.mkdir(path.join(fixture, "web"));
  await fs.mkdir(path.join(fixture, "projects/001-fixture/web/dist"), { recursive: true });
  await fs.writeFile(path.join(fixture, "projects.json"), JSON.stringify({ projects: [{ id: "001", slug: "fixture" }, { id: "003", slug: "lofi-room" }] }));
  await fs.writeFile(path.join(fixture, "web/index.html"), "<h1>夜半小屋 · 项目首页</h1>");
  await fs.writeFile(path.join(fixture, "projects/001-fixture/web/dist/index.html"), "<a>项目首页</a>");
  const gateway = createCatalogGateway(fixture),
    server = createServer((req, res) =>
      gateway(req, res, () => {
        res.writeHead(404);
        res.end();
      }),
    );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/1014_codex_project/`;
  try {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /夜半小屋/);
    const data = await (await fetch(base + "projects.json")).json();
    assert.ok(data.projects.some((p) => p.id === "003"));
    const first = await fetch(base + "001-fixture/");
    assert.equal(first.status, 200);
    assert.match(await first.text(), /项目首页/);
    assert.equal(
      (await fetch(base + "projects/003-lofi-room/web/.env.local")).status,
      404,
    );
    assert.equal(
      (await fetch(base + "001-fixture/..%2F..%2Fprojects.json")).status,
      403,
    );
  } finally {
    await new Promise((r) => server.close(r));
    if (path.dirname(fixture) !== path.resolve(os.tmpdir()) || !path.basename(fixture).startsWith("lofi-catalog-")) throw new Error("fixture cleanup escaped temporary directory");
    await fs.rm(fixture, { recursive: true, force: true });
  }
});

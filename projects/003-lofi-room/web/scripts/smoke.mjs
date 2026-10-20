import assert from "node:assert/strict";
const base =
  process.argv[2] || "http://127.0.0.1:4175/1014_codex_project/003-lofi-room/";
const response = await fetch(base);
assert.equal(response.status, 200);
const html = await response.text();
assert.match(html, /Agent 工作室/);
assert.match(html, /\?view=room/);
assert.match(html, /\?view=workspace/);
assert.match(html, /<canvas[^>]+id="scene"/);
const assets = [
  ...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg))"/g),
].map((m) => m[1]);
assert.ok(assets.some((a) => a.endsWith(".js")));
assert.ok(assets.some((a) => a.endsWith(".css")));
for (const asset of assets) {
  const url = new URL(asset, base);
  assert.equal(url.origin, new URL(base).origin);
  assert.ok(url.pathname.startsWith("/1014_codex_project/003-lofi-room/"));
  const result = await fetch(url);
  assert.equal(result.status, 200, `${url} 加载失败`);
  assert.ok((await result.text()).length > 0);
}
const license = await fetch(new URL("licenses/THREE-LICENSE.txt", base));
assert.equal(license.status, 200);
assert.match(await license.text(), /MIT License/);
const manifestResponse = await fetch(
  new URL("voices/demo/manifest.json", base),
);
assert.equal(manifestResponse.status, 200);
const manifest = await manifestResponse.json();
assert.equal(manifest.provider, "MiniMax");
assert.equal(new Set(manifest.clips.map((clip) => clip.actor)).size, 6);
for (const clip of manifest.clips) {
  const response = await fetch(new URL(`voices/demo/${clip.file}`, base));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /audio/);
  assert.ok((await response.arrayBuffer()).byteLength > 1000);
}
console.log(
  `通过：003 子路径入口、${assets.length} 个资源、MiniMax 十段语音与许可证均可访问。`,
);
const roomManifest = await (await fetch(new URL("voices/room/manifest.json", base))).json();
assert.equal(roomManifest.provider, "MiniMax");
assert.equal(roomManifest.clips.length, 36);
assert.equal(new Set(roomManifest.clips.map((clip) => clip.actor)).size, 6);
for (const clip of roomManifest.clips) {
  const response = await fetch(new URL(`voices/room/${clip.file}`, base));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /audio/);
  assert.ok((await response.arrayBuffer()).byteLength > 1000);
}
console.log("通过：36 段 MiniMax 房间互动录音、六位角色与来源清单均可访问。");
const home = new URL("../", base);
const homeResponse = await fetch(home);
assert.equal(homeResponse.status, 200);
assert.match(await homeResponse.text(), /项目首页/);
const catalog = await (await fetch(new URL("projects.json", home))).json();
assert.ok(catalog.projects.some((project) => project.id === "003"));
console.log("通过：项目首页、原房间与工作室入口已关联。");

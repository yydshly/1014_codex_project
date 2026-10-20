import test from "node:test";
import assert from "node:assert/strict";
import { TEAM } from "../shared/team.js";
import { ROLE_READING, residentContent, readingFrame, writingFrame, notebookPages, drinkingFill } from "../shared/resident-content.js";
import { Scene, Group, Vector3, FrontSide, BackSide } from "three";
import { createResidents } from "../src/residents.js";
import { createTeamScene } from "../src/team-scene.js";
import { createWaterCorner } from "../src/daily-props.js";
import { createPersonalProps } from "../src/personal-props.js";
import { ROOM, OBSTACLES } from "../src/room.js";
import { STAGE_OBSTACLES, WORK_SPOTS } from "../src/stage-layout.js";

test("六人的原创读本各有主题，日常笔记不冒充任务产物", () => {
  assert.equal(new Set(Object.values(ROLE_READING).map((book) => book.title)).size, TEAM.length);
  for (const member of TEAM) {
    const content = residentContent({}, member.id);
    assert.equal(content.book.chapters.length, 3);
    assert.ok(content.book.chapters.every((chapter) => chapter.length === 3 && chapter.every(Boolean)));
    assert.match(content.bookSource, /原创/);
    assert.match(content.noteSource, /未提交任务产物/);
    assert.equal(content.artifactId, null);
    assert.ok(content.notes.some((note) => note.includes(member.job)));
  }
});

test("任务笔记只摘录该角色最新的实际产物，保留目标与验收来源", () => {
  const snapshot = { goal: { title: "修复导出", criteria: ["保留真实退出码"] },
    tasks: [{ id: "momo", status: "testing", task: "运行原测试" }], artifacts: [
      { id: "old", actor: "momo", title: "旧测试", summary: "旧轮结果" },
      { id: "other", actor: "indigo", title: "开发稿", summary: "不应出现在验证笔记中" },
      { id: "new", actor: "momo", title: "实际测试失败", summary: "退出码 1：导出内容不匹配" },
    ] };
  const content = residentContent(snapshot, "momo"), notes = content.notes.join("\n");
  assert.equal(content.artifactId, "new");
  assert.match(notes, /修复导出/); assert.match(notes, /退出码 1/); assert.match(notes, /保留真实退出码/); assert.match(notes, /运行原测试/);
  assert.doesNotMatch(notes, /旧轮结果|开发稿|不应出现在/);
  assert.equal(snapshot.artifacts.length, 3);
});

test("翻书会进入下一章并循环，减少动态效果时保留完整页面", () => {
  const content = residentContent({}, "amber");
  assert.equal(readingFrame(content, 0).page, 1);
  assert.equal(readingFrame(content, 9.4).turn.toFixed(1), "0.5");
  assert.equal(readingFrame(content, 10).page, 3);
  assert.equal(readingFrame(content, 30).page, 1);
  assert.equal(readingFrame(content, 9.4, true).turn, 0);
});

test("笔记保留已有文字并渐进书写；长笔记分页不丢内容", () => {
  const content = residentContent({}, "sleepy");
  const first = writingFrame(content, 0), next = writingFrame(content, 2), full = writingFrame(content, 0, true);
  assert.ok(first.text.includes("栗子")); assert.ok(next.text.startsWith(first.text));
  assert.equal(next.text.length - first.text.length, 18);
  assert.equal(full.text.length, full.total); assert.equal(full.complete, true);
  const long = "来源：src/main.js\n" + "保留全部真实笔记。".repeat(100);
  const pages = notebookPages(long);
  assert.ok(pages.length > 1); assert.ok(pages.every((page) => page.length <= 11));
  assert.equal(pages.flat().join(""), long.replaceAll("\n", ""));
});

test("杯内水量只在实际啜饮区间下降，有限量且可继承各人已有水量", () => {
  assert.equal(drinkingFill(0), .82); assert.equal(drinkingFill(2.4), .82);
  assert.ok(drinkingFill(3) < .82 && drinkingFill(3) > drinkingFill(3.7));
  assert.ok(Math.abs(drinkingFill(3.7) - .46) < 1e-10);
  assert.equal(drinkingFill(50, .2), .12);
  assert.equal(drinkingFill(0, .6), .6);
});

test("实际日常动作驱动实体道具：写字增加内容，饮水只消耗本人的杯子，暂停冻结进度", () => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, drawImage() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, measureText: (value) => ({ width: value.length * 24 }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  try {
    const scene = new Scene(), residents = createResidents(scene, ROOM, [...OBSTACLES, ...STAGE_OBSTACLES]);
    const stage = createTeamScene(scene, residents);
    const water = createWaterCorner(new Group());
    const props = createPersonalProps(scene, residents, stage.waterCup, water);
    props.sync({}); stage.idle();
    let time = 0, minimum = .82, maximumNotes = 0;
    for (let frame = 0; frame < 1200; frame++) {
      time += .05; residents.update(time, .05, false, null); stage.update(time, .05, 0, false); props.update(.05, false);
      minimum = Math.min(minimum, props.state("mori", "drink").fill);
      maximumNotes = Math.max(maximumNotes, props.state("sleepy", "note").noteCharacters);
      assert.equal(props.state("amber", "drink").fill, .82, "小森喝水不应消耗阿橘的杯子");
    }
    assert.ok(minimum < .5, "真实喝水动作应降低实体杯内水量");
    assert.ok(maximumNotes > writingFrame(residentContent({}, "sleepy"), 0).text.length, "桌边写字应增加笔记内容");
    assert.equal(scene.children.filter((object) => object.name === "workspace-water-cup" && object.visible).length, 6);
    props.inspect("amber", "book"); stage.pause(true);
    const before = props.state("amber", "book").page, fill = props.state("mori", "drink").fill;
    for (let i = 0; i < 200; i++) props.update(.05, false);
    assert.equal(props.state("amber", "book").page, before); assert.equal(props.state("mori", "drink").fill, fill);
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});

function withProps(check) {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, drawImage() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, measureText: (value) => ({ width: value.length * 24 }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  try {
    const scene = new Scene(), characters = createResidents(scene, ROOM, [...OBSTACLES, ...STAGE_OBSTACLES]);
    const stage = createTeamScene(scene, characters), props = createPersonalProps(scene, characters, stage.waterCup, createWaterCorner(new Group()));
    stage.idle(); let time = 0;
    const step = (count = 1) => { for (let i = 0; i < count; i++) { time += .05; characters.update(time, .05, false, null); stage.update(time, .05, 0, false); props.update(.05, false); } };
    check({ scene, characters, stage, props, step });
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
}

test("读者看到正文正向；手中和停放位置复用同一实体，闲置书不会因镜头关注而自动翻页", () => withProps(({ scene, characters, props, step }) => {
  step(220);
  const reader = characters.residents.find((person) => person.data.id === "mori"), book = reader.document;
  assert.equal(props.state("mori", "book").reading, true);
  const top = reader.body.worldToLocal(book.localToWorld(new Vector3(0, .034, -.1)));
  const bottom = reader.body.worldToLocal(book.localToWorld(new Vector3(0, .034, .1)));
  assert.ok(top.z > bottom.z, "正文顶部必须远离读者，不能为了外部相机把字倒过来");
  assert.equal(scene.getObjectByName("personal-book-mori"), book);
  props.setAuto("mori", false); props.update(.05, false);
  const heldPage = props.state("mori", "book").page;
  props.update(30, false); assert.equal(props.state("mori", "book").page, heldPage);
  assert.equal(props.state("mori", "book").autoTurn, false);
  props.inspect("indigo", "book"); props.update(.05, false);
  const before = props.state("indigo", "book").page;
  for (let i = 0; i < 500; i++) props.update(.05, false);
  const idle = props.state("indigo", "book");
  assert.equal(idle.page, before); assert.equal(idle.pageTurning, false); assert.equal(idle.bookOpen, false);
  characters.moveTo("mori", { x: reader.root.position.x, z: reader.root.position.z, yaw: 0, pose: "idle" }); step(300);
  assert.equal(reader.document, book); assert.equal(book.parent, scene);
  assert.equal(props.state("mori", "book").bookOpen, false);
}));

test("手动翻阅明确标注用途，仅转动所选角色的单页，单页正反面不重复整本内容", () => withProps(({ scene, props, step }) => {
  step(20); props.inspect("indigo", "book"); props.update(.05, false);
  assert.equal(props.state("indigo", "book").pageAction, "打开读本");
  props.turnPage("indigo"); props.update(.05, false);
  assert.equal(props.state("indigo", "book").manualBrowse, true);
  props.turnPage("indigo"); props.update(.3, false);
  assert.equal(props.state("indigo", "book").pageTurning, true);
  assert.match(props.state("indigo", "book").detail, /你正在手动翻阅/);
  assert.equal(props.state("sleepy", "book").bookOpen, false);
  const turn = scene.getObjectByName("personal-book-indigo").getObjectByName("book-page-turn");
  const [front, back] = turn.children;
  assert.equal(front.material.side, FrontSide); assert.equal(back.material.side, BackSide);
  const xs = (mesh) => Array.from(mesh.geometry.attributes.uv.array).filter((_, index) => index % 2 === 0);
  assert.ok(xs(front).every((value) => value >= .5 && value <= 1));
  assert.ok(xs(back).every((value) => value >= 0 && value <= .5));
  props.update(1.1, false); const page = props.state("indigo", "book").page;
  props.update(30, false);
  assert.equal(props.state("indigo", "book").page, page); assert.equal(props.state("indigo", "book").pageTurning, false);
  props.inspect(null); props.update(.05, false); assert.equal(props.state("indigo", "book").bookOpen, false);
}));

test("近景阅读暂缓自主休息，真实工作仍能打断，退出后解除观察保留", () => withProps(({ characters, props, step }) => {
  step(160); props.inspect("mori", "book"); step(1800);
  const reader = characters.residents.find((person) => person.data.id === "mori");
  assert.equal(reader.action.pose, "read"); assert.equal(props.state("mori", "book").location, "hand");
  characters.moveTo("mori", WORK_SPOTS.mori);
  for (let i = 0; i < 1200 && (reader.propBusy || !reader.action.arrived); i++) step();
  assert.equal(reader.propBusy, false, "归还书本后才算完成工作安排");
  assert.equal(reader.action.arrived, true); assert.equal(reader.action.pose, WORK_SPOTS.mori.pose);
  assert.equal(props.state("mori", "book").bookOpen, false);
  props.inspect(null); assert.equal(reader.observedProp, false);
}));

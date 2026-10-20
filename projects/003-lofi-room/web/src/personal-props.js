import * as THREE from "three";
import { TEAM } from "../shared/team.js";
import { residentContent, readingFrame, writingFrame, notebookPages, drinkingFill } from "../shared/resident-content.js";
import { createWaterCup } from "./daily-props.js";
import { BOOK_STATIONS } from "./stage-layout.js";

const docks = {
  mori: { note: [-.50, .835, .70] },
  amber: { note: [-.34, .835, 1.10] },
  indigo: { note: [4.10, .84, -3.45] },
  luna: { note: [2.40, .84, -3.50] },
  momo: { note: [.02, .835, .5] },
  sleepy: { note: [0, .84, 1.10] },
};
const font = "'Microsoft YaHei', sans-serif";
function canvasSurface(width, height) {
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture, context: canvas.getContext("2d") };
}
function wrap(ctx, text, x, y, width, line = 37, maxLines = 12) {
  let row = "", index = 0;
  for (const char of text) {
    if (char === "\n" || ctx.measureText(row + char).width > width) {
      ctx.fillText(row, x, y + index * line); row = ""; if (++index >= maxLines) return;
      if (char === "\n") continue;
    }
    row += char;
  }
  ctx.fillText(row, x, y + index * line);
}
function plane(width, height, surface) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: surface.texture, side: THREE.DoubleSide, toneMapped: false }));
  mesh.rotation.x = -Math.PI / 2; return mesh;
}
function pageLeaf(surface, back = false) {
  const mesh = plane(.184, .264, surface), uv = mesh.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, back ? (1 - uv.getX(i)) * .5 : .5 + uv.getX(i) * .5);
  mesh.material.side = back ? THREE.BackSide : THREE.FrontSide;
  mesh.position.x = .092;
  return mesh;
}
function box(parent, size, color, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: .8 }));
  mesh.position.set(...position); parent.add(mesh); return mesh;
}

export function createPersonalProps(scene, characters, carrier, waterStation) {
  const items = new Map(), pickables = [];
  characters.enableBookActions(BOOK_STATIONS);
  let snapshot = {}, time = 0, owner = "mori", lastCupAction, initialFill = .82, inspection = null, motionReduced = false;
  carrier.visible = false;
  for (const [memberIndex, member] of TEAM.entries()) {
    const person = characters.residents.find((r) => r.data.id === member.id);
    person.cupDock = new THREE.Vector3(-.98 + memberIndex * .22, .99, -3.225);
    const book = new THREE.Group(), notebook = new THREE.Group();
    book.name = `personal-book-${member.id}`; notebook.name = `personal-note-${member.id}`;
    const cup = createWaterCup(scene), cupLabel = canvasSurface(384, 128);
    const cupTag = new THREE.Mesh(new THREE.PlaneGeometry(.115, .038), new THREE.MeshBasicMaterial({ map: cupLabel.texture, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    cupTag.position.set(0, -.006, .076); cup.add(cupTag);
    const label = cupLabel.context;
    label.fillStyle = "#f1ead4"; label.fillRect(0, 0, 384, 128);
    label.fillStyle = "#354f45"; label.font = `bold 45px ${font}`; label.textAlign = "center"; label.fillText(`${member.name} · 温水`, 192, 85, 375);
    cupLabel.texture.needsUpdate = true;
    cup.traverse((object) => { if (object.material?.color && ![cup.userData.water, cup.userData.liquid, cup.userData.ripple, cupTag].includes(object)) object.material.color.set(member.color); });
    const pages = canvasSurface(1024, 700), nextPages = canvasSurface(1024, 700), basePages = canvasSurface(1024, 700), cover = canvasSurface(600, 430), notes = canvasSurface(900, 680);
    box(book, [.2, .025, .29], member.color, [-.10, .008, 0]);
    box(book, [.19, .016, .276], "#e4dec8", [-.098, .022, 0]);
    const spine = box(book, [.008, .031, .278], "#a88e66", [0, .029, 0]);
    const spread = plane(.189, .268, basePages); spread.position.set(-.0945, .033, 0); book.add(spread);
    const uv = spread.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * .5);
    const wing = new THREE.Group(); wing.name = "book-cover-hinge"; book.add(wing);
    box(wing, [.20, .025, .29], member.color, [.10, -.012, 0]);
    const rightPage = plane(.189, .268, basePages); rightPage.position.set(.0945, .004, 0); wing.add(rightPage);
    const rightUV = rightPage.geometry.attributes.uv;
    for (let i = 0; i < rightUV.count; i++) rightUV.setX(i, .5 + rightUV.getX(i) * .5);
    const lid = plane(.20, .29, cover); lid.position.set(.10, -.027, 0); lid.rotation.set(Math.PI / 2, 0, Math.PI); wing.add(lid);
    const turn = new THREE.Group(); turn.name = "book-page-turn"; turn.position.y = .037;
    turn.add(pageLeaf(pages), pageLeaf(nextPages, true)); book.add(turn);
    box(notebook, [.33, .018, .25], member.color);
    box(notebook, [.316, .014, .238], "#e9e1ca", [0, .011, 0]);
    const ink = plane(.302, .228, notes); ink.position.y = .019; notebook.add(ink);
    for (let index = 0; index < 6; index++) box(notebook, [.008, .009, .014], "#8c806b", [-.15, .022, -.09 + index * .035]);
    person.document?.removeFromParent(); person.document = book;
    scene.add(book, notebook);
    for (const [kind, root] of [["book", book], ["note", notebook], ["drink", cup]]) {
      root.traverse((object) => { object.userData.workspaceAction = "personal"; object.userData.personalActor = member.id; object.userData.personalKind = kind; if (object.isMesh) pickables.push(object); });
    }
    items.set(member.id, { person, member, book, notebook, cup, fill: .82,
      cupRest: person.cupDock,
      spread, lid, spine, wing, rightPage, turn, pages, nextPages, basePages, cover, notes,
      readingAge: 0, writingAge: 0, notePage: 0, browseOpen: false, autoTurn: true, manualEnd: null, signatures: {}, content: residentContent(snapshot, member.id) });
  }
  const drawBook = (item, frame, surface = item.pages) => {
    const c = surface.context, { content, member } = item;
    c.fillStyle = "#eee6cf"; c.fillRect(0, 0, 1024, 700);
    c.fillStyle = "#c8b99b"; c.fillRect(508, 12, 8, 676);
    c.fillStyle = member.color; c.fillRect(30, 31, 18, 80);
    c.fillStyle = "#445d4f"; c.font = `bold 34px ${font}`; wrap(c, content.book.title, 69, 64, 402, 43, 2);
    c.font = `24px ${font}`; c.fillStyle = "#8a8269"; c.fillText(`${member.name} / ${member.role}`, 68, 160);
    c.font = `bold 31px ${font}`; c.fillStyle = "#314d43"; wrap(c, frame.chapter[0], 54, 229, 410, 42, 2);
    c.font = `28px ${font}`; c.fillStyle = "#596050"; wrap(c, frame.chapter[1], 54, 320, 404, 43, 7);
    c.font = `bold 29px ${font}`; c.fillStyle = "#3d594e"; c.fillText("读书摘记", 560, 88);
    c.fillStyle = "#b7c9ad"; c.fillRect(552, 130, 420, 7);
    c.font = `30px ${font}`; c.fillStyle = "#505b4b"; wrap(c, frame.chapter[2], 563, 208, 400, 47, 8);
    c.font = `21px ${font}`; c.fillStyle = "#8d8874";
    c.fillText(content.bookSource, 55, 658); c.fillText(`${frame.page} / ${frame.page + 1}`, 840, 658);
    surface.texture.needsUpdate = true;
  };
  const drawCover = (item) => {
    const c = item.cover.context;
    c.fillStyle = item.member.color; c.fillRect(0, 0, 600, 430);
    c.strokeStyle = "#e7dfbc"; c.lineWidth = 3; c.strokeRect(25, 25, 550, 380);
    c.fillStyle = "#f2e8ca"; c.font = `bold 43px ${font}`; wrap(c, item.content.book.title, 62, 100, 470, 60, 3);
    c.font = `27px ${font}`; c.fillText(`${item.member.name} · ${item.member.role}`, 62, 323);
    c.font = `20px ${font}`; c.fillText("小屋原创读本 / PERSONAL READING", 62, 371); item.cover.texture.needsUpdate = true;
  };
  const drawNotes = (item, frame, pages, page) => {
    const c = item.notes.context;
    c.fillStyle = "#f1e8d0"; c.fillRect(0, 0, 900, 680);
    c.strokeStyle = "#d1d0b8"; c.lineWidth = 1;
    for (let y = 183; y < 610; y += 39) { c.beginPath(); c.moveTo(52, y); c.lineTo(850, y); c.stroke(); }
    c.fillStyle = "#385746"; c.font = `bold 40px ${font}`; c.fillText(`${item.member.name}的笔记`, 52, 65);
    c.font = `23px ${font}`; c.fillStyle = "#8a826e"; c.fillText(frame.source, 52, 108);
    c.fillStyle = "#374f55"; c.font = `30px ${font}`;
    pages[page].forEach((line, index) => c.fillText(line, 55, 175 + index * 39));
    c.fillStyle = "#94836b"; c.font = `23px ${font}`; c.fillText(frame.complete ? "先记下来，留待核对。" : "随手记录中…", 52, 650);
    c.fillText(`${page + 1} / ${pages.length}`, 762, 650);
    item.notes.texture.needsUpdate = true;
  };
  return {
    pickables,
    sync(value) { snapshot = value; for (const item of items.values()) item.content = residentContent(value, item.member.id); },
    update(delta, reducedMotion) {
      motionReduced = reducedMotion;
      if (!characters.paused) time += delta;
      for (const item of items.values()) {
        const r = item.person, handling = r.bookHandling, steady = r.action?.arrived && !r.propBusy && r.walkWeight < .15;
        const read = steady && handling.phase === "reading", write = steady && r.action.pose === "write";
        const inspectBook = inspection?.actor === item.member.id && inspection.kind === "book";
        if (item.state?.reading && !read && item.manualEnd == null && item.readingAge % 10 >= 8.8)
          item.readingAge = (Math.floor(item.readingAge / 10) + 1) * 10;
        if (item.manualEnd != null && !inspectBook && !read) { item.readingAge = item.manualEnd; item.manualEnd = null; }
        if (!characters.paused && !r.stageFrozen) {
          if (item.manualEnd != null) { item.readingAge = Math.min(item.manualEnd, item.readingAge + delta); if (item.readingAge >= item.manualEnd) item.manualEnd = null; }
          else if (read && item.autoTurn) item.readingAge += delta;
          if (write) item.writingAge += delta;
        }
        item.book.visible = true; item.book.position.copy(handling.position); item.book.quaternion.copy(handling.quaternion);
        // Notebooks stay on their actual writing surface; the pen moves over the page.
        item.notebook.visible = true; item.notebook.position.fromArray(docks[item.member.id].note); item.notebook.rotation.set(0, item.member.id === "indigo" ? Math.PI : 0, 0);
        const manual = inspectBook && item.browseOpen && handling.phase === "stored";
        item.openAmount ??= 0;
        if (!characters.paused && !r.stageFrozen) item.openAmount = manual ? THREE.MathUtils.damp(item.openAmount, 1, 14, delta) : handling.open;
        item.wing.rotation.z = Math.PI * (1 - item.openAmount); item.wing.position.y = .029 + .025 * (1 - item.openAmount);
        item.spread.visible = item.rightPage.visible = item.openAmount > .01;
        item.lid.visible = true; item.spine.visible = item.openAmount > .01;
        const bookFrame = readingFrame(item.content, item.readingAge, reducedMotion);
        item.turn.visible = item.openAmount > .97 && (read || item.manualEnd != null) && bookFrame.turn > 0;
        item.turn.rotation.z = Math.PI * bookFrame.turn;
        r.bookTurn = read && item.turn.visible ? bookFrame.turn : 0;
        const bookKey = `${bookFrame.index}:${item.content.book.title}`;
        if (item.signatures.book !== bookKey) {
          drawBook(item, bookFrame); drawBook(item, readingFrame(item.content, (Math.floor(item.readingAge / 10) + 1) * 10), item.nextPages);
          drawCover(item); item.signatures.book = bookKey;
        }
        const spreadKey = `${bookKey}:${item.turn.visible}`;
        if (item.signatures.spread !== spreadKey) {
          const c = item.basePages.context; c.drawImage(item.pages.canvas, 0, 0);
          if (item.turn.visible) c.drawImage(item.nextPages.canvas, 512, 0, 512, 700, 512, 0, 512, 700);
          item.basePages.texture.needsUpdate = true; item.signatures.spread = spreadKey;
        }
        const inspectNote = inspection?.actor === item.member.id && inspection.kind === "note";
        const noteFrame = writingFrame(item.content, item.writingAge, reducedMotion || item.member.id !== "sleepy" && !write && inspectNote);
        const notePages = notebookPages(noteFrame.text);
        const notePage = write && !inspectNote ? notePages.length - 1 : Math.min(item.notePage, notePages.length - 1);
        const noteKey = noteFrame.text + noteFrame.source + notePage;
        if (item.signatures.note !== noteKey) { drawNotes(item, noteFrame, notePages, notePage); item.signatures.note = noteKey; }
        item.state = { actor: item.member.id, reading: read, writing: write, page: bookFrame.page,
          entityId: item.book.name, bookOpen: item.openAmount > .97, autoTurn: item.autoTurn, pageTurning: item.turn.visible, bookLocation: handling.held ? "hand" : "rest", manualBrowse: manual,
          phase: handling.phase, actionLabel: handling.label, handling: r.propBusy, held: handling.held, openAmount: item.openAmount,
          bookTitle: item.content.book.title, chapter: bookFrame.chapter[0], noteCharacters: noteFrame.text.length,
          bookText: `${item.content.bookSource}\n${bookFrame.chapter[0]}\n\n${bookFrame.chapter[1]}\n\n读书摘记\n${bookFrame.chapter[2]}`,
          notes: noteFrame.text, notePage: notePage + 1, notePages: notePages.length, noteSource: item.content.noteSource, artifactId: item.content.artifactId };
      }
      const drinker = characters.residents.find((r) => r.drinkGrip > .001);
      if (drinker) {
        owner = drinker.data.id;
        if (lastCupAction !== drinker.action && drinker.finishDrinkAge == null) { lastCupAction = drinker.action; initialFill = items.get(owner).fill; }
        items.get(owner).fill = drinkingFill(drinker.finishDrinkAge ?? drinker.action.age, initialFill);
      }
      for (const item of items.values()) {
        const { cup, fill } = item;
        if (item.person.drinkGrip > .001) { cup.position.copy(carrier.position); cup.quaternion.copy(carrier.quaternion); }
        else { cup.position.copy(item.cupRest); cup.quaternion.identity(); }
        cup.userData.water.position.y = -.068 + .13 * fill;
        cup.userData.liquid.scale.y = fill; cup.userData.liquid.position.y = -.068 + .13 * fill / 2;
        cup.userData.ripple.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(time * 3) * .25);
      }
      // A cup returned to its personal slot does not refill by itself.
      waterStation.stream.visible = false;
    },
    view(actor, kind = "book") {
      const item = items.get(actor) || items.get("luna");
      const object = kind === "drink" ? item.cup : kind === "note" ? item.notebook : item.book;
      object.updateWorldMatrix(true, false);
      const target = object.getWorldPosition(new THREE.Vector3());
      const held = kind === "book" ? item.state?.held : kind === "note" ? false : item.member.id === owner && item.person.drinkGrip > .001;
      if (kind === "book" && (item.state?.handling || item.observeMotion)) {
        const target = item.person.root.position.clone().add(new THREE.Vector3(0, .95, 0));
        // Watch from the room interior, rather than rotating the camera through
        // a wall or a bookcase every time the actor changes direction.
        const inward = new THREE.Vector3(-target.x, 0, -target.z);
        if (inward.length() < .4) inward.set(0, 0, 1);
        inward.normalize();
        const offset = inward.clone().multiplyScalar(3.5).add(new THREE.Vector3(inward.z, 0, -inward.x).multiplyScalar(1.1));
        offset.y = 1.6;
        const position = target.clone().add(offset);
        position.x = THREE.MathUtils.clamp(position.x, -4.5, 4.5); position.z = THREE.MathUtils.clamp(position.z, -3.3, 3.6);
        return { actor: item.member.id, kind, target, position };
      }
      if (held && kind === "book") {
        const eye = new THREE.Vector3(0, kind === "book" ? item.person.readHeight + .75 : .74, .025);
        item.person.body.localToWorld(eye);
        return { actor: item.member.id, kind, target, position: eye };
      }
      const offset = kind === "drink" ? new THREE.Vector3(.25, .27, .38) : new THREE.Vector3(0, .90, .25);
      if (held) offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), item.person.root.rotation.y);
      else if (kind !== "drink") offset.applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
      return { actor: item.member.id, kind, target, position: target.clone().add(offset) };
    },
    inspect(actor, kind) {
      if (inspection && (inspection.actor !== actor || inspection.kind !== kind)) {
        const previous = items.get(inspection.actor); previous.browseOpen = false; previous.person.observedProp = false;
      }
      inspection = actor ? { actor, kind } : null;
      if (actor) items.get(actor).person.observedProp = ["book", "note"].includes(kind);
    },
    setAuto(actor, value) {
      const item = items.get(actor); item.autoTurn = value;
      if (!value && item.readingAge % 10 >= 8.8) item.manualEnd = (Math.floor(item.readingAge / 10) + 1) * 10;
    },
    setMotionView(actor, value) { items.get(actor).observeMotion = value; },
    turnPage(actor, kind = "book") {
      const item = items.get(actor);
      if (kind === "note") { item.notePage = (item.notePage + 1) % (item.state?.notePages || 1); return; }
      if (!item.state?.reading && !item.browseOpen) { item.browseOpen = true; return; }
      if (item.state?.pageTurning || characters.paused) return;
      const end = (Math.floor(item.readingAge / 10) + 1) * 10;
      if (motionReduced) item.readingAge = end;
      else { item.readingAge = end - 1.2 + .001; item.manualEnd = end; }
    },
    state(actor, kind) {
      const item = items.get(actor);
      if (kind === "drink") return { actor, kind, entityId: `personal-cup-${actor}`, location: actor === owner && item.person.drinkGrip > .001 ? "hand" : "rest", title: `${item.member.name} · 温水`, detail: `个人水杯 · 水量 ${Math.round(item.fill * 100)}% · ${actor === owner && waterStation.stream.visible ? "正在接水" : actor === owner && item.person.drinkGrip > .001 ? "正在饮水" : "饮水角杯架"}`, fill: item.fill };
      const location = kind === "book" ? item.state?.handling ? `${item.member.name} · ${item.state.actionLabel}` : item.state?.reading ? `${item.member.name}手中 · 正在阅读` : item.state?.manualBrowse ? `${item.member.name}的桌上读本 · 你正在手动翻阅` : `${item.member.name}的读本 · 已合上放好` : item.state?.writing ? `${item.member.name}正在桌面笔记上书写` : "已存笔记";
      return { ...item.state, motionView: Boolean(item.observeMotion), kind, entityId: kind === "book" ? item.book.name : item.notebook.name, location: kind === "book" && item.state?.held ? "hand" : "rest", title: kind === "book" ? `${item.member.name} · ${item.content.book.title}` : `${item.member.name}的笔记`,
        pageAction: kind === "book" && !item.state?.bookOpen ? "打开读本" : "翻一页", pageDisabled: characters.paused || kind === "book" && (item.state?.pageTurning || item.state?.handling),
        detail: kind === "book" ? `${location} · ${item.state?.bookOpen ? `第${item.state?.page || 1}–${(item.state?.page || 1) + 1}页` : "自动翻页已停止"}` : `${location} · ${item.content.noteSource} · 第${item.state?.notePage || 1}/${item.state?.notePages || 1}页` };
    },
  };
}

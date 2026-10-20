import * as THREE from "three";
import { STATUS_TEXT, TEAM_BY_ID } from "../shared/team.js";
import { takeoverBoard } from "../shared/takeover.js";
import { BOARD, BOOK_TABLE } from "./stage-layout.js";
import { createWaterCorner } from "./daily-props.js";
import { createWorkstationDisplay } from "./workstation-display.js";
export function createSharedSpace(scene, room) {
  const root = new THREE.Group();
  const waterCorner = new THREE.Group();
  scene.add(root, waterCorner);
  const bookTable = new THREE.Group(); bookTable.name = "sofa-book-table";
  const timber = new THREE.MeshStandardMaterial({ color: "#8e6c52", roughness: .85 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(.56, .04, .55), timber);
  top.position.set(BOOK_TABLE.x, BOOK_TABLE.y, BOOK_TABLE.z); bookTable.add(top);
  for (const dx of [-.20, .20]) for (const dz of [-.19, .19]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.045, .78, .045), timber);
    leg.position.set(BOOK_TABLE.x + dx, .39, BOOK_TABLE.z + dz); bookTable.add(leg);
  }
  root.add(bookTable);
  const waterStation = createWaterCorner(waterCorner);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD.width, 1.55, 0.12),
    new THREE.MeshStandardMaterial({ color: "#596759", roughness: 0.8 }),
  );
  board.position.set(BOARD.x, 1.9, BOARD.z);
  board.userData.workspaceAction = "board";
  root.add(board);
  const makeTexture = (w, h) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, context: canvas.getContext("2d"), texture };
  };
  const white = makeTexture(1024, 540),
    terminal = makeTexture(1024, 576),
    testing = makeTexture(1024, 576);
  let snapshot = null, renderedAt = -1, dirty = true;
  let displayTime = 0;
  let lastReducedMotion;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD.width - 0.14, 1.4),
    new THREE.MeshBasicMaterial({ map: white.texture }),
  );
  face.position.set(BOARD.x, 1.9, BOARD.z + 0.067);
  face.userData.workspaceAction = "board";
  root.add(face);
  for (const offset of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 1.2, 0.055),
      board.material,
    );
    leg.position.set(BOARD.x + offset, 0.65, BOARD.z);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.065, 0.5),
      board.material,
    );
    foot.position.set(BOARD.x + offset, 0.06, BOARD.z);
    root.add(leg, foot);
  }
  const laptop = new THREE.Group();
  laptop.position.set(0.85, 0.84, 0.6);
  laptop.rotation.y = Math.PI / 2;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.035, 0.44),
    new THREE.MeshStandardMaterial({ color: "#567675" }),
  );
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.43, 0.035),
    base.material,
  );
  lid.position.set(0, 0.22, -0.19);
  const smallScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.61, 0.35),
    new THREE.MeshBasicMaterial({ map: testing.texture, toneMapped: false }),
  );
  smallScreen.position.set(0, 0.22, -0.17);
  smallScreen.userData.workspaceAction = "computer";
  smallScreen.userData.workActor = "momo";
  laptop.add(base, lid, smallScreen);
  root.add(laptop);
  const laptopKeys = [];
  for (let row = 0; row < 3; row++) for (let column = 0; column < 8; column++) {
    const key = new THREE.Mesh(new THREE.BoxGeometry(.055, .006, .035), new THREE.MeshStandardMaterial({ color: "#a7b8b0" }));
    key.position.set(-.25 + column * .068, .023, -.015 + row * .055);
    laptop.add(key); laptopKeys.push(key);
  }
  const computer = room.computer;
  computer.material.map = terminal.texture;
  computer.material.toneMapped = false;
  computer.material.needsUpdate = true;
  computer.userData.workspaceAction = "computer";
  computer.userData.workActor = "indigo";
  const displays = new Map([["indigo", createWorkstationDisplay(terminal, "indigo")], ["momo", createWorkstationDisplay(testing, "momo")]]);
  const screenMeshes = new Map([["indigo", computer], ["momo", smallScreen]]);
  const keys = new Map([["indigo", room.keyboardKeys || []], ["momo", laptopKeys]]);
  const keyHeights = new Map([...keys.values()].flat().map((key) => [key, key.position.y]));
  const glows = new Map();
  for (const [actor, mesh] of screenMeshes) {
    const glow = new THREE.PointLight("#99cfbb", .15, 1.8);
    mesh.add(glow); glow.position.z = .15; glows.set(actor, glow);
  }
  const wrap = (ctx, text, x, y, width, line = 35, maxLines = 2) => {
    let row = "",
      count = 0;
    for (const char of text || "") {
      if (ctx.measureText(row + char).width > width) {
        ctx.fillText(row, x, y + count * line);
        row = "";
        if (++count >= maxLines) return;
      }
      row += char;
    }
    ctx.fillText(row, x, y + count * line);
  };
  return {
    waterStation,
    pickables: [face, board, computer, smallScreen],
    boardPoint: new THREE.Vector3(BOARD.x, 2.85, BOARD.z),
    computerPoint: computer
      .getWorldPosition(new THREE.Vector3())
      .add(new THREE.Vector3(0, 0.6, 0)),
    screenView(actor) {
      const mesh = screenMeshes.get(actor) || computer;
      mesh.updateWorldMatrix(true, false);
      const target = mesh.getWorldPosition(new THREE.Vector3());
      const position = target.clone().add(actor === "momo" ? new THREE.Vector3(1.15, .65, .9) : new THREE.Vector3(1.15, .65, 2));
      return { actor: screenMeshes.has(actor) ? actor : "indigo", target, position };
    },
    screenState(actor, reducedMotion = false) { return displays.get(actor)?.frame(displayTime, reducedMotion); },
    replayScreen(actor) { displays.get(actor)?.replay(displayTime); dirty = true; },
    sync(value) {
      snapshot = value; dirty = true;
      for (const display of displays.values()) display.sync(snapshot, displayTime);
      const { goal, tasks, artifacts, events } = value;
      const adjustment = takeoverBoard(value);
      if (adjustment) {
        const ctx = white.context;
        ctx.fillStyle = "#e4e7d8"; ctx.fillRect(0, 0, 1024, 540);
        ctx.fillStyle = "#657763"; ctx.font = "bold 22px sans-serif";
        ctx.fillText(`接管调整 / 修改 ${adjustment.version} · ${adjustment.terminal ? "本轮记录" : adjustment.paused ? "执行暂停" : "已继续执行"}`, 34, 40);
        ctx.fillStyle = "#283d35"; ctx.font = "bold 32px sans-serif";
        wrap(ctx, adjustment.plan?.title || "正在整理修改方案", 34, 85, 940, 38, 1);
        ctx.font = "21px sans-serif"; wrap(ctx, "你的意见：" + adjustment.feedback, 34, 126, 940, 27, 2);
        ctx.font = "20px sans-serif"; ctx.fillText(adjustment.names + " · " + adjustment.label, 34, 193);
        (adjustment.plan?.steps || []).forEach((step, index) => {
          const y = 220 + index * 87, member = TEAM_BY_ID[step.owner];
          ctx.fillStyle = member.color; ctx.fillRect(34, y, 9, 76);
          ctx.fillStyle = "#283d35"; ctx.font = "bold 22px sans-serif";
          wrap(ctx, `${index + 1}. ${member.name}：${step.change}`, 54, y + 25, 910, 26, 2);
          ctx.font = "18px sans-serif"; wrap(ctx, "验证：" + step.verify, 54, y + 71, 910, 23, 1);
        });
        ctx.fillStyle = "#405349"; ctx.font = "19px sans-serif";
        wrap(ctx, adjustment.terminal ? "本轮调整与执行证据已保存 · 在成果页查看实际交付与验收" : adjustment.error || (adjustment.paused ? "讨论不会自动开工 · 使用者点击继续后才回工位执行" : "按此方案继续开发与独立验证"), 34, 516, 940, 24, 1);
        white.texture.needsUpdate = true;
        return;
      }
      const completion = events.findLast((e) => e.type === "run.complete");
      const testResult = artifacts.findLast((a) => a.stage === "test")?.data
        ?.tests;
      const unresolved = ["review", "test"]
        .map((stage) => artifacts.findLast((a) => a.stage === stage))
        .filter((a) => a?.verdict === "revise");
      const ctx = white.context;
      ctx.fillStyle = "#e4e7d8";
      ctx.fillRect(0, 0, 1024, 540);
      ctx.fillStyle = "#657763";
      ctx.font = "bold 21px sans-serif";
      ctx.fillText("OUR GOAL / 共享白板", 34, 39);
      ctx.fillStyle = "#283d35";
      ctx.font = "bold 36px sans-serif";
      wrap(ctx, goal.title, 34, 89, 930, 43, 1);
      ctx.font = "23px sans-serif";
      wrap(ctx, goal.brief, 34, 136, 930, 30, 2);
      tasks.forEach((task, i) => {
        const x = 34 + (i % 3) * 325,
          y = 210 + Math.floor(i / 3) * 109;
        ctx.fillStyle = task.color;
        ctx.fillRect(x, y, 305, 89);
        if (["working", "reviewing", "testing"].includes(task.status)) {
          ctx.strokeStyle = "#294a3b"; ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, 301, 85);
        }
        ctx.fillStyle = "#1d3029";
        ctx.font = "bold 25px sans-serif";
        ctx.fillText(`${task.name} · ${task.role}`, x + 15, y + 30);
        ctx.font = "22px sans-serif";
        ctx.fillText(
          (task.task || STATUS_TEXT[task.status] || "待命").slice(0, 12),
          x + 15,
          y + 65,
        );
      });
      ctx.fillStyle = "#405349";
      ctx.font = "22px sans-serif";
      ctx.fillText(
        `${artifacts.length} 份产物 · ${goal.notes.length} 条讨论意见 · 点击查看与验收`,
        34,
        480,
      );
      ctx.font = "19px sans-serif";
      wrap(
        ctx,
        (completion?.delivery
          ? `Demo 已验证：${completion.delivery.tests.passedCount}/${completion.delivery.tests.total} · 点击电脑打开与下载`
          : unresolved.length
            ? `待修复：${unresolved.map((a) => a.summary).join("；")}`
            : null) ||
          goal.notes.at(-1)?.text ||
          goal.criteria[0] ||
          "先明确目标，再分工协作。",
        34,
        515,
        940,
        24,
        1,
      );
      white.texture.needsUpdate = true;
    },
    update(camera, firstPerson, time = 0, reducedMotion = false) {
      displayTime = time;
      if (lastReducedMotion !== reducedMotion) dirty = true;
      lastReducedMotion = reducedMotion;
      root.visible = firstPerson || camera.position.z > BOARD.z - 0.1;
      if (dirty || (!reducedMotion && time - renderedAt > .08)) {
        for (const [actor, display] of displays) {
          const frame = display.draw(time, reducedMotion);
          for (const [index, key] of keys.get(actor).entries()) {
            const pressed = frame.animating && (Math.floor(time * 11) + index * 7) % 17 < 2;
            key.position.y = keyHeights.get(key) - (pressed ? .006 : 0);
          }
          glows.get(actor).intensity = frame.animating ? .3 + Math.sin(time * 3) * .035 : .12;
        }
        dirty = false; renderedAt = time;
      }
    },
    dispose() {
      for (const [actor, mesh] of screenMeshes) mesh.remove(glows.get(actor));
      for (const [key, y] of keyHeights) key.position.y = y;
      white.texture.dispose();
      terminal.texture.dispose();
      testing.texture.dispose();
      for (const group of [root, waterCorner])
        group.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
      scene.remove(root, waterCorner);
    },
  };
}

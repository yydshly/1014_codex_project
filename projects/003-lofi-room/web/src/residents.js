import * as THREE from "three";
import { SHOE } from "./foot-contact.js";
import {
  canOccupy,
  findSafeSpawn,
} from "./navigation.js";
import { TEAM_BY_ID } from "../shared/team.js";
import { BODY, advanceTeamActor, updateResidentPose, updateBookHands } from "./resident-motion.js";
import { createBookActions } from "./book-actions.js";
import { createResidentTraffic, PERSON_SPACE } from "./resident-traffic.js";

export const RESIDENTS = [
  {
    id: "mori",
    name: "小森",
    activity: "在房间里散步",
    description: "把今天的烦恼留在门外，绕着小屋走一走。",
    color: "#839b72",
    hair: "#384b36",
    skin: "#e4c9a4",
    pants: "#434f48",
    kind: "walk",
    offset: 0,
    speed: 0.46,
    ears: "leaf",
  },
  {
    id: "amber",
    name: "阿橘",
    activity: "寻找下一杯热茶",
    description: "晚睡的理由很简单：茶还是热的，朋友都在。",
    color: "#c59a65",
    hair: "#955d3b",
    skin: "#e8c8a3",
    pants: "#5c4940",
    kind: "walk",
    offset: 4,
    speed: 0.36,
    ears: "cat",
  },
  {
    id: "luna",
    name: "月白",
    activity: "安静地翻着书",
    description: "读完这一页就睡。嗯，也许再读一页。",
    color: "#a599b4",
    hair: "#d2cac7",
    skin: "#ead4bd",
    pants: "#5e5369",
    kind: "read",
    x: -1.4,
    z: 0.55,
    y: -0.595,
    yaw: Math.PI / 2,
  },
  {
    id: "indigo",
    name: "小蓝",
    activity: "在窗边写着日记",
    description: "记下今天的一件小事，也算是认真生活过。",
    color: "#7c9ba6",
    hair: "#374d62",
    skin: "#e4cbb4",
    pants: "#43596a",
    kind: "type",
    x: 3.42,
    z: -2.54,
    y: -0.28,
    yaw: Math.PI,
  },
  {
    id: "momo",
    name: "桃桃",
    activity: "跟着节拍轻轻摇摆",
    description: "喜欢没有歌词的音乐，可以装下很多心事。",
    color: "#b8878e",
    hair: "#574645",
    skin: "#edc5ad",
    pants: "#675250",
    kind: "dance",
    x: 2.7,
    z: 2.72,
    y: 0,
    yaw: -0.7,
  },
  {
    id: "sleepy",
    name: "栗子",
    activity: "已经进入梦乡",
    description: "把明天留给明天。今晚，先做一个温柔的梦。",
    color: "#c2b99b",
    hair: "#6a5947",
    skin: "#e6c6a5",
    pants: "#847860",
    kind: "sleep",
    x: -3.64,
    z: 3.32,
    y: 0.82,
    yaw: 0,
  },
];

const route = [
  [-1.85, -2.3],
  [1.15, -2.3],
  [2.0, -1.6],
  [2.5, 0.5],
  [1.85, 2.65],
  [-1.35, 2.5],
  [-1.85, 1.6],
  [-2.4, 0.65],
  [-2.25, -0.5],
  [-1.85, -0.8],
];

export function createResidents(scene, bounds, obstacles) {
  let teamMode = false,
    choreographed = false,
    teamPaused = false,
    speaker = null,
    listener = null,
    speechLevel = 0;
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1),
    cache = new Map();
  function material(color) {
    if (!cache.has(color))
      cache.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
      );
    return cache.get(color);
  }
  function voxel(parent, size, color, position = [0, 0, 0]) {
    const mesh = new THREE.Mesh(boxGeometry, material(color));
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const residents = RESIDENTS.map((data, index) => {
    const root = new THREE.Group();
    root.userData.residentId = data.id;
    scene.add(root);
    const rig = new THREE.Group();
    root.add(rig);
    const body = new THREE.Group();
    body.position.y = BODY.hip;
    rig.add(body);
    voxel(body, [0.39, 0.5, 0.23], data.color, [0, 0.27, 0]);
    // A front placket, hem and hoodie pocket bring detail to the small silhouette.
    voxel(body, [0.045, 0.46, 0.015], "#dccda8", [0, 0.27, 0.125]);
    voxel(rig, [0.41, 0.09, 0.24], data.pants, [0, 0.79, 0]);
    voxel(body, [0.2, 0.1, 0.02], data.hair, [0, 0.15, 0.13]);
    const head = new THREE.Group();
    head.position.y = 0.75;
    body.add(head);
    const eyes = [], eyeHighlights = [];
    voxel(head, [0.44, 0.43, 0.4], data.skin);
    voxel(head, [0.46, 0.09, 0.43], data.hair, [0, 0.2, 0]);
    voxel(head, [0.46, 0.3, 0.07], data.hair, [0, 0.075, -0.19]);
    for (const side of [-1, 1]) {
      voxel(head, [0.075, 0.29, 0.41], data.hair, [side * 0.195, 0.055, 0]);
      voxel(head, [0.075, 0.08, 0.07], data.hair, [side * 0.13, 0.135, 0.205]);
      eyes.push(voxel(head, [0.045, 0.06, 0.017], "#292f35", [
        side * 0.095,
        -0.025,
        0.209,
      ]));
      eyeHighlights.push(voxel(head, [0.016, 0.017, 0.018], "#f8e9cf", [
        side * 0.093,
        -0.012,
        0.219,
      ]));
      voxel(head, [0.059, 0.028, 0.018], "#d39e87", [
        side * 0.145,
        -0.08,
        0.209,
      ]);
    }
    const mouth = voxel(
      head,
      [0.057, 0.015, 0.02],
      "#9c7865",
      [0, -0.125, 0.211],
    );
    if (data.ears === "cat")
      for (const side of [-1, 1]) {
        voxel(head, [0.13, 0.16, 0.16], data.hair, [side * 0.16, 0.3, 0]);
        voxel(head, [0.065, 0.07, 0.04], data.skin, [side * 0.16, 0.31, 0.084]);
      }
    if (data.ears === "leaf") {
      voxel(head, [0.1, 0.12, 0.1], "#b7bf87", [0.12, 0.29, 0]);
      const leaf = voxel(head, [0.15, 0.05, 0.1], "#6e8c52", [0.18, 0.31, 0]);
      leaf.rotation.z = 0.3;
    }
    if (data.kind === "type") {
      voxel(head, [0.51, 0.04, 0.12], "#bdc7b1", [0, -0.025, 0.23]);
      for (const s of [-1, 1])
        voxel(head, [0.17, 0.105, 0.027], "#3b5361", [s * 0.11, -0.025, 0.235]);
    }
    if (data.kind === "dance") {
      for (const side of [-1, 1]) {
        voxel(head, [0.07, 0.19, 0.2], "#d7b97f", [side * 0.247, 0, 0]);
      }
      voxel(head, [0.51, 0.055, 0.14], "#d7b97f", [0, 0.245, 0]);
    }
    const arms = [],
      elbows = [],
      wrists = [],
      legs = [],
      knees = [],
      ankles = [],
      soles = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.28, 0.48, 0);
      body.add(arm);
      arms.push(arm);
      voxel(arm, [0.15, 0.26, 0.18], data.color, [0, -0.13, 0]);
      const elbow = new THREE.Group();
      elbow.position.y = -BODY.upperArm;
      arm.add(elbow); elbows.push(elbow);
      voxel(elbow, [0.135, 0.195, 0.16], data.color, [0, -0.095, 0]);
      voxel(elbow, [0.137, 0.03, 0.164], "#b2bba4", [0, -0.195, 0]);
      const wrist = new THREE.Group();
      wrist.position.y = -BODY.forearm;
      elbow.add(wrist); wrists.push(wrist);
      voxel(wrist, [0.12, 0.09, 0.075], data.skin, [0, -0.045, 0]);
      for (const finger of [-1, 0, 1])
        voxel(wrist, [0.028, 0.045, 0.06], data.skin, [finger * 0.035, -0.104, 0.01]);
      const leg = new THREE.Group();
      leg.position.set(side * 0.105, BODY.hip, 0);
      rig.add(leg);
      legs.push(leg);
      voxel(leg, [0.18, 0.33, 0.2], data.pants, [0, -0.165, 0]);
      const knee = new THREE.Group();
      knee.position.y = -BODY.thigh;
      leg.add(knee);
      knees.push(knee);
      voxel(knee, [0.165, 0.32, 0.18], data.pants, [0, -0.16, 0]);
      const ankle = new THREE.Group();
      ankle.position.y = -BODY.shin;
      knee.add(ankle); ankles.push(ankle);
      voxel(ankle, [SHOE.width, SHOE.height, SHOE.depth], "#39403d", [0, -SHOE.height / 2, SHOE.forward]);
      const sole = new THREE.Object3D();
      sole.position.set(0, -SHOE.height, SHOE.forward); ankle.add(sole); soles.push(sole);
    }
    root.traverse((object) => {
      object.userData.residentId = data.id;
    });
    let routeIndex = (data.offset || 0) % route.length;
    if (data.kind === "walk") {
      const p = findSafeSpawn(
        { x: route[routeIndex][0], z: route[routeIndex][1] },
        bounds,
        obstacles,
      );
      root.position.set(p.x, 0, p.z);
      routeIndex = (routeIndex + 1) % route.length;
    } else root.position.set(data.x, data.y, data.z);
    root.rotation.y = data.yaw || 0;
    if (data.kind === "sleep") {
      rig.rotation.x = -Math.PI / 2;
      rig.position.set(0, 0, 0);
    }
    const labelPoint = new THREE.Vector3();
    return {
      data,
      root,
      rig,
      body,
      head,
      eyes,
      eyeHighlights,
      mouth,
      arms,
      elbows,
      wrists,
      legs,
      knees,
      ankles,
      soles,
      height: BODY.height,
      routeIndex,
      index,
      labelPoint,
      getSpawn() {
        const preferred =
          teamMode || data.kind === "walk"
            ? root.position
            : {
                x: data.x + (data.kind === "type" ? -0.95 : 0),
                z: data.z + (data.kind === "sleep" ? 1 : 0),
              };
        return findSafeSpawn(preferred, traffic.bounds, [...obstacles, ...traffic.personObstacles(data.id)], .28);
      },
    };
  });

  const traffic = createResidentTraffic(residents, bounds, obstacles);
  function navigate(r, spec) {
    if (spec.pose === "drink" && r.cupDock) spec = { ...spec, x: r.cupDock.x + .195, z: r.cupDock.z + .375 };
    const previous = r.action;
    if (previous?.pose === "drink" && previous.arrived && r.drinkGrip > .02 && r.finishDrinkAge == null)
      r.finishDrinkAge = r.drinkLift > .1 ? 4 : 4.8;
    const depart = r.exitPoint || (previous?.seat && (previous.arrived || !r.path?.length)
      ? { x: previous.x, z: previous.z } : previous?.depart);
    r.exitPoint = null;
    const start = depart || r.root.position;
    if (!traffic.isClear(spec)) throw new Error("工作位置不可通行。");
    r.path = traffic.pathTo(r, spec, start);
    if (!r.path.length) throw new Error("人物无法到达工作位置。");
    r.action = { ...spec, yaw: spec.yaw ?? 0, depart, arrived: false, age: 0 };
    r.traffic = { speed: r.traffic?.speed ?? 0 };
    return r.action;
  }
  function update(time, delta, reducedMotion, walkingId) {
    if (!teamPaused) traffic.tick(delta);
    for (const r of residents) {
      if (r.data.id === walkingId) continue;
      if (teamMode) {
        if (teamPaused || r.stageFrozen) continue;
        r.bookController?.before(delta);
        traffic.prepare(r, delta);
        const movement = advanceTeamActor(r, { delta, bounds, obstacles, reducedMotion, choreographed, traffic });
        let headYaw = 0;
        if ([speaker, listener].includes(r.data.id) && !r.path?.length) {
          const other = residents.find((person) => person.data.id === (r.data.id === speaker ? listener : speaker));
          if (other) {
            const desired = Math.atan2(other.root.position.x - r.root.position.x, other.root.position.z - r.root.position.z);
            const limit = r.action?.socialId ? 0.65 : 0.35;
            headYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(desired - r.root.rotation.y), Math.cos(desired - r.root.rotation.y)), -limit, limit);
          }
        }
        updateResidentPose(r, {
          ...movement, time, delta, reducedMotion, dynamicSeat: true,
          pose: movement.settlingDrink != null ? "drink" : r.propBusy || r.bookHandling?.held && r.bookHandling.phase !== "reading" ? "carry" : r.action?.arrived || movement.sitting > 0.7 ? r.action?.pose === "read" && r.bookHandling?.phase === "stored" ? "review" : r.action?.pose : "idle",
          poseAge: movement.settlingDrink,
          speaking: speaker === r.data.id, listening: listener === r.data.id,
          level: speechLevel, headYaw,
          floor: Boolean(r.action?.seat?.floor && movement.sitting > 0 || r.seatedFloor && r.action?.depart && r.root.position.y < -.001),
          footForward: r.action?.seat?.footForward ?? r.sittingSeat?.footForward,
        });
        r.bookController?.after(delta);
        if (r.bookController) updateBookHands(r, delta, reducedMotion);
        if (r.book) r.book.visible = false;
        continue;
      }
      let distanceMoved = 0;
      if (r.data.kind === "walk" && !reducedMotion) {
        const destination = { x: route[r.routeIndex][0], z: route[r.routeIndex][1] };
        if (!r.traffic?.yieldTarget && Math.hypot(destination.x - r.root.position.x, destination.z - r.root.position.z) < .08) {
          r.routeIndex = (r.routeIndex + 1) % route.length; r.path = [];
        }
        else {
          if (!r.path?.length) {
            r.action = { ...destination, pose: "idle", yaw: r.root.rotation.y, arrived: false, age: 0 };
            r.traffic = { speed: r.traffic?.speed ?? 0 };
            r.path = traffic.pathTo(r, destination);
          }
          traffic.prepare(r, delta);
          if (r.traffic.hold) {
            updateResidentPose(r, { time, delta, reducedMotion, distanceMoved: 0 });
            continue;
          }
          const target = r.path[0], dx = target.x - r.root.position.x, dz = target.z - r.root.position.z, distance = Math.hypot(dx, dz);
          if (distance < .025) { r.path.shift(); continue; }
          const step = Math.min(r.data.speed * delta, distance);
          const next = traffic.move(r, dx / distance * step, dz / distance * step);
          distanceMoved = Math.hypot(next.x - r.root.position.x, next.z - r.root.position.z);
          const actualX = next.x - r.root.position.x, actualZ = next.z - r.root.position.z;
          r.root.position.x = next.x; r.root.position.z = next.z;
          if (distanceMoved > .001) {
            const yaw = r.traffic.yieldYaw ?? Math.atan2(actualX, actualZ);
            const difference = Math.atan2(Math.sin(yaw - r.root.rotation.y), Math.cos(yaw - r.root.rotation.y));
            r.root.rotation.y += THREE.MathUtils.clamp(difference, -delta * 2.8, delta * 2.8);
          }
        }
      }
      updateResidentPose(r, {
        time, delta, reducedMotion, distanceMoved,
        pose: ["read", "type"].includes(r.data.kind) ? r.data.kind : "idle",
        sitting: r.data.kind === "type" ? 1 : 0,
        floor: r.data.kind === "read", sleeping: r.data.kind === "sleep", dancing: r.data.kind === "dance",
      });
      if (r.book) r.book.visible = true;
    }
  }
  // A small open book attached to the reader's hands.
  const reader = residents.find((r) => r.data.kind === "read");
  const book = new THREE.Group();
  reader.body.add(book);
  book.position.set(0, 0.30, 0.31);
  book.rotation.x = -0.4;
  voxel(
    book,
    [0.33, 0.035, 0.25],
    "#e0d6bc",
    [0, 0, 0],
  );
  reader.book = book;
  voxel(book, [0.018, 0.04, 0.25], "#a27f61");
  return {
    get paused() { return teamPaused; },
    residents,
    update,
    setVisitor(value) { traffic.setVisitor(value); },
    personObstacles(except) { return traffic.personObstacles(except); },
    meetingSpot(preferred, participants, reserved) { return traffic.meetingSpot(preferred, participants, reserved); },
    trafficState() {
      let minimumDistance = Infinity;
      const visible = residents.filter((r) => r.root.visible), contacts = [];
      for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i], b = visible[j], distance = Math.hypot(a.root.position.x - b.root.position.x, a.root.position.z - b.root.position.z);
        minimumDistance = Math.min(minimumDistance, distance);
        if (distance < PERSON_SPACE - .0001) contacts.push([a.data.id, b.data.id]);
      }
      return { minimumDistance: Number.isFinite(minimumDistance) ? minimumDistance : null, contacts,
        yielding: visible.filter((r) => r.traffic?.yieldTarget).map((r) => r.data.id), waiting: visible.filter((r) => r.traffic?.waiting).map((r) => r.data.id) };
    },
    enableBookActions(stations) {
      for (const r of residents) r.bookController = createBookActions(r, stations[r.data.id], (spec) => navigate(r, spec));
    },
    enableTeam(options = {}) {
      teamMode = true;
      choreographed = Boolean(options.choreographed);
      const starts = {
        mori: { x: -1.85, z: 2.45 },
        amber: { x: 1.45, z: 2.75 },
        indigo: { x: 1.25, z: -1.75 },
        luna: { x: -2.7, z: -1.15 },
        momo: { x: 2.5, z: 2.75 },
        sleepy: choreographed ? { x: 0.2, z: 2.5 } : { x: -1.85, z: -2.3 },
      };
      residents.forEach((r) => {
        const p = findSafeSpawn(starts[r.data.id], bounds, obstacles);
        r.root.position.set(p.x, 0, p.z);
        r.root.rotation.y = Math.PI;
        r.team = { status: "idle" };
        r.path = [];
        if (choreographed && !r.document) {
          r.document = voxel(r.body, [0.3, 0.025, 0.24], "#e6dbb9", [0, 0.30, 0.31]);
          r.document.rotation.x = -0.4;
          r.document.visible = false;
          r.document.userData.residentId = r.data.id;
          r.pen = voxel(r.wrists[1], [0.02, 0.14, 0.02], "#cead68", [0.035, -0.115, 0.025]);
          r.pen.rotation.x = 0.9;
          r.pen.userData.residentId = r.data.id;
          r.pen.visible = false;
        }
      });
    },
    setTeamState(actor, state) {
      const r = residents.find((r) => r.data.id === actor);
      if (!r) return;
      const previous = r.team?.status;
      r.team = state;
      if (!choreographed && ["idle", "queued", "cancelled", "error"].includes(state.status))
        r.path = [];
      if (
        !choreographed &&
        previous !== state.status &&
        ["working", "reviewing", "testing"].includes(state.status)
      )
        navigate(r, { ...TEAM_BY_ID[actor].station, pose: "idle" });
    },
    moveTo(actor, spec) {
      const r = residents.find((person) => person.data.id === actor);
      if (!r) throw new Error("无法找到场景人物。");
      return r.bookController ? r.bookController.request(spec) : navigate(r, spec);
    },
    setTeamPaused(value) { teamPaused = value; },
    spectatorSpawn(actor) {
      const r = residents.find((person) => person.data.id === actor);
      return findSafeSpawn({ x: r.root.position.x + 0.65, z: r.root.position.z + 0.7 }, traffic.bounds, [...obstacles, ...traffic.personObstacles()], .28);
    },
    stopActions() {
      residents.forEach((r) => {
        r.bookController?.stop();
        r.path = [];
        if (r.drinkGrip > .02) r.finishDrinkAge = r.drinkLift > .1 ? 4 : 4.8;
        else { r.finishDrinkAge = null; r.drinkGrip = 0; }
        if (r.action) {
          // Preserve a seated pose so the next walk can undock safely.
          if (!r.action.arrived) {
            if (!canOccupy(r.root.position.x, r.root.position.z, bounds, obstacles, 0.19))
              r.action.depart ||= { x: r.action.x, z: r.action.z };
            r.action.seat = null;
          }
          r.action.pose = "idle";
          r.action.ambient = false;
          r.action.label = "等待新任务";
          if (r.action.depart) r.action.seat = null;
          r.exitPoint = r.action.depart;
          r.action.depart = null;
          r.action.arrived = true;
        }
        r.stageFrozen = false;
      });
    },
    setSpeaking(actor, level, to = null) {
      speaker = actor;
      listener = to;
      speechLevel = level;
    },
    pickables: residents.map((r) => r.root),
    validPatrol: () =>
      route.every(([x, z]) => traffic.isClear({ x, z })),
  };
}

export function drawPortrait(canvas, data) {
  const ctx = canvas.getContext("2d"),
    unit = canvas.width / 16;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = data.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * unit, y * unit, w * unit, h * unit);
  };
  rect(3, 3, 10, 10, data.hair);
  rect(4, 6, 8, 7, data.skin);
  rect(3, 3, 10, 3, data.hair);
  rect(3, 5, 2, 4, data.hair);
  rect(11, 5, 2, 4, data.hair);
  rect(5, 8, 1, 2, "#30383b");
  rect(10, 8, 1, 2, "#30383b");
  rect(4, 11, 2, 1, "#d29c85");
  rect(10, 11, 2, 1, "#d29c85");
  rect(7, 12, 2, 1, "#ac8c6e");
  rect(3, 14, 10, 2, data.color);
  if (data.ears === "cat") {
    rect(3, 1, 3, 3, data.hair);
    rect(10, 1, 3, 3, data.hair);
    rect(4, 2, 1, 1, data.skin);
    rect(11, 2, 1, 1, data.skin);
  }
  if (data.ears === "leaf") {
    rect(9, 1, 2, 3, "#bfd394");
    rect(11, 2, 2, 1, "#9fb87c");
  }
  if (data.kind === "dance") {
    rect(2, 6, 1, 5, "#e0c78f");
    rect(13, 6, 1, 5, "#e0c78f");
    rect(3, 2, 10, 1, "#e0c78f");
  }
}

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createRoom, ROOM, OBSTACLES } from "./room.js";
import { createResidents, drawPortrait } from "./residents.js";
import { moveWithCollisions, movementVector } from "./navigation.js";
import { LofiAudio, TRACKS } from "./audio.js";
import "./style.css";
import "./workspace.css";
import { Collaboration } from "./collaboration.js";
import { createTeamScene } from "./team-scene.js";
import { TEAM_BY_ID } from "../shared/team.js";
import { Workspace } from "./workspace.js";
import { createSharedSpace } from "./shared-space.js";
import { STAGE_OBSTACLES } from "./stage-layout.js";
import "./interaction.css";
import "./mission.css";
import { Workbench } from "./workbench.js";
import { createScreenViewer } from "./screen-viewer.js";
import { createPersonalProps } from "./personal-props.js";
import { createPersonalViewer } from "./personal-viewer.js";
import { createRepairReplay } from "./repair-replay.js";

const $ = (id) => document.getElementById(id);
const canvas = $("scene"),
  loading = $("loading");
const roomOnly =
  new URLSearchParams(location.search).get("view") !== "workspace";
document.body.classList.add(roomOnly ? "view-room" : "view-workspace");
if (!roomOnly) document.body.classList.add("scene-focus");
$(roomOnly ? "room-entry" : "workspace-entry").setAttribute(
  "aria-current",
  "page",
);
if (roomOnly) {
  $("page-title").textContent = "夜半小屋.";
  $("page-subtitle").textContent = "一盏灯，一首歌，和几个还没睡的朋友。";
  document.title = "夜半小屋 · 3D lo-fi 房间";
  document.querySelector(".brand .eyebrow").textContent =
    "LO-FI ROOM / PROJECT 003";
  document.querySelector(".card-top .eyebrow").textContent =
    "MEET YOUR NEIGHBORS";
  $("help-dialog").querySelector("h2").textContent = "欢迎来到夜半小屋。";
  $("help-dialog").querySelector("p").textContent =
    "自由观察小屋，或从住客视角漫游。页顶入口可以前往 Agent 工作室。";
} else document.title = "Agent 工作室 · 目标、对话与交付";
function showError(message) {
  loading.hidden = true;
  $("error").hidden = false;
  $("error-message").textContent = message;
}
$("reload-button").addEventListener("click", () => location.reload());

try {
  start();
} catch (error) {
  console.error(error);
  showError("小屋需要 WebGL 2。请检查浏览器硬件加速是否开启，然后重新打开。");
}

function start() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#111820");
  const camera = new THREE.PerspectiveCamera(
    42,
    innerWidth / innerHeight,
    0.06,
    80,
  );
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 25;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = Math.PI / 2 - 0.06;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.7;
  const room = createRoom(scene),
    obstacles = roomOnly ? OBSTACLES : [...OBSTACLES, ...STAGE_OBSTACLES],
    characters = createResidents(scene, ROOM, obstacles),
    audio = new LofiAudio();
  const residents = characters.residents;
  let cameraFollow = true;
  controls.addEventListener("start", () => { cameraFollow = false; });
  $("follow-speaker").addEventListener("change", () => { cameraFollow = true; });
  const teamScene = roomOnly ? null : createTeamScene(scene, characters, (text) => {
    $("stage-caption").textContent = text;
  });
  const sharedSpace = roomOnly ? null : createSharedSpace(scene, room);
  const personalProps = roomOnly ? null : createPersonalProps(scene, characters, teamScene.waterCup, sharedSpace.waterStation);
  let workspace,
    currentSpeech = null;
  let observer = null, inspectionActor = null;
  let screenFocus = null, screenViewer = null;
  let personalFocus = null, personalViewer = null;
  let hiddenPropHead = null;
  let collaboration;
  if (!characters.validPatrol()) throw new Error("住客散步路径与家具冲突。");
  const reducedMedia = matchMedia("(prefers-reduced-motion: reduce)"),
    touchMedia = matchMedia("(pointer: coarse)");
  let reducedMotion = reducedMedia.matches,
    selected = residents[0],
    mode = "orbit",
    weather = "rain",
    walkingResident = null;
  let yaw = 0,
    pitch = 0,
    time = 0,
    frame = 0,
    lastTimestamp = performance.now(),
    diagnosticsAt = 0,
    pausedByVisibility = false;
  const input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  };
  const player = { x: 0, z: 0 },
    savedOrbit = {
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
      width: innerWidth,
      height: innerHeight,
    };
  let lastWidth = innerWidth,
    lastHeight = innerHeight;
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    projection = new THREE.Vector3();
  const selectRing = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.38, 32),
    new THREE.MeshBasicMaterial({
      color: "#dac392",
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  selectRing.rotation.x = -Math.PI / 2;
  scene.add(selectRing);
  const labels = new Map(),
    pickButtons = new Map();
  for (const resident of residents) {
    const label = document.createElement("button");
    label.className = "resident-label";
    label.textContent = roomOnly
      ? resident.data.name
      : `${resident.data.name} · ${TEAM_BY_ID[resident.data.id].role}`;
    label.setAttribute("aria-label", `认识${resident.data.name}`);
    label.addEventListener("click", () => { selectResident(resident); observer?.inspect(resident.data.id); });
    $("labels").append(label);
    labels.set(resident.data.id, label);
    const button = document.createElement("button");
    button.title = `${resident.data.name} · ${TEAM_BY_ID[resident.data.id].role}`;
    button.setAttribute("aria-label", `选择住客${resident.data.name}`);
    button.setAttribute("aria-pressed", "false");
    const icon = document.createElement("canvas");
    icon.width = 32;
    icon.height = 32;
    icon.setAttribute("aria-hidden", "true");
    drawPortrait(icon, resident.data);
    button.append(icon);
    button.addEventListener("click", () => { selectResident(resident); observer?.inspect(resident.data.id); });
    $("resident-picker").append(button);
    pickButtons.set(resident.data.id, button);
  }

  function home() {
    const narrow = innerWidth <= 760,
      panelWidth = innerWidth > 1500 ? 641 : innerWidth > 1100 ? 600 : 520,
      scale = narrow
        ? Math.max(1, 0.91 / camera.aspect)
        : roomOnly || document.body.classList.contains("scene-focus")
          ? 1.06
          : Math.max(
              1.06,
              (0.98 * innerHeight) / Math.max(360, innerWidth - panelWidth),
            );
    controls.target.set(0, 0.8, 0.15);
    camera.position.set(10 * scale, 9 * scale, 13 * scale);
    controls.maxDistance = Math.max(25, 26 * scale);
    camera.fov = narrow ? 47 : 42;
    camera.updateProjectionMatrix();
    controls.update();
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    if (
      mode === "orbit" &&
      (innerWidth !== lastWidth || innerHeight !== lastHeight)
    )
      home();
    lastWidth = innerWidth;
    lastHeight = innerHeight;
    camera.clearViewOffset();
    if (mode === "orbit" && innerWidth > 760)
      camera.setViewOffset(
        innerWidth,
        innerHeight,
        0,
        -innerHeight * 0.01,
        innerWidth,
        innerHeight,
      );
    if (mode === "orbit" && innerWidth <= 760)
      camera.setViewOffset(
        innerWidth,
        innerHeight,
        0,
        innerHeight * 0.095,
        innerWidth,
        innerHeight,
      );
    if (screenFocus || personalFocus) { camera.clearViewOffset(); camera.fov = 34; }
    camera.updateProjectionMatrix();
    $("touch-controls").hidden =
      mode !== "walk" || (!touchMedia.matches && innerWidth > 760);
  }
  function selectResident(resident) {
    selected = resident;
    $("resident-name").textContent = resident.data.name;
    $("resident-activity").textContent = resident.data.activity;
    $("resident-description").textContent = resident.data.description;
    $("resident-index").textContent =
      `${String(resident.index + 1).padStart(2, "0")} / 06`;
    $("enter-resident").innerHTML =
      `从${resident.data.name}的视角出发 <span aria-hidden="true">↗</span>`;
    drawPortrait($("portrait"), resident.data);
    $("portrait").setAttribute("aria-label", `${resident.data.name}的像素头像`);
    labels.forEach((label, id) =>
      label.classList.toggle("active", id === resident.data.id),
    );
    pickButtons.forEach((button, id) => {
      button.classList.toggle("active", id === resident.data.id);
      button.setAttribute("aria-pressed", String(id === resident.data.id));
    });
    collaboration?.select(resident.data.id);
  }
  function focusScreen(actor = "indigo") {
    personalFocus = null; personalViewer?.hide(); personalProps?.inspect(null);
    observer?.close();
    exitWalk();
    screenFocus = sharedSpace.screenView(actor);
    cameraFollow = true; controls.minDistance = .8;
    camera.clearViewOffset(); camera.fov = 34; camera.updateProjectionMatrix();
    screenViewer.show(screenFocus.actor);
  }
  function closeScreen() {
    screenFocus = null; screenViewer?.hide();
    controls.minDistance = 8; home(); resize();
  }
  function focusPersonal(actor = "luna", kind = "book") {
    observer?.close(); exitWalk();
    screenFocus = null; screenViewer?.hide();
    personalFocus = { actor, kind }; personalProps.inspect(actor, kind);
    cameraFollow = true; controls.minDistance = .25;
    camera.clearViewOffset(); camera.fov = 34; camera.updateProjectionMatrix();
    personalViewer.show(actor, kind);
  }
  function closePersonal() {
    personalFocus = null; personalProps?.inspect(null); personalViewer?.hide();
    controls.minDistance = 8; home(); resize();
    observer?.personalButton.focus({ preventScroll: true });
  }
  function clearInput() {
    Object.keys(input).forEach((key) => (input[key] = false));
  }
  function setModeUI() {
    document.body.classList.toggle("walking", mode === "walk");
    $("orbit-mode").classList.toggle("active", mode === "orbit");
    $("walk-mode").classList.toggle("active", mode === "walk");
    $("orbit-mode").setAttribute("aria-pressed", String(mode === "orbit"));
    $("walk-mode").setAttribute("aria-pressed", String(mode === "walk"));
    $("walk-banner").hidden = mode !== "walk";
    selectRing.visible = mode === "orbit";
    $("control-hint").textContent =
      mode === "walk"
        ? touchMedia.matches || innerWidth <= 760
          ? "屏幕方向键走动 · 拖动环顾 · 点击「退出」返回"
          : "WASD / 方向键走动 · Shift 跑步 · 拖动环顾 · Esc 返回"
        : "拖动旋转 · 滚轮缩放 · 点击住客认识新朋友";
    resize();
  }
  function enterWalk() {
    if (mode === "walk") return;
    if (personalFocus) closePersonal();
    if (screenFocus) closeScreen();
    savedOrbit.position.copy(camera.position);
    savedOrbit.target.copy(controls.target);
    savedOrbit.width = innerWidth;
    savedOrbit.height = innerHeight;
    walkingResident = selected;
    walkingResident.root.visible = !roomOnly;
    const spawn = selected.getSpawn();
    Object.assign(player, roomOnly ? spawn : characters.spectatorSpawn(selected.data.id));
    yaw = selected.root.rotation.y + Math.PI;
    pitch = -0.045;
    mode = "walk";
    controls.enabled = false;
    controls.stopListenToKeyEvents();
    clearInput();
    $("walk-name").textContent = roomOnly ? `${selected.data.name}的视角` : "工作室 · 自由漫游";
    camera.fov = 68;
    camera.updateProjectionMatrix();
    setModeUI();
    canvas.focus({ preventScroll: true });
    updateWalkCamera();
  }
  function exitWalk() {
    if (mode !== "walk") return;
    walkingResident.root.visible = true;
    walkingResident = null;
    mode = "orbit";
    clearInput();
    controls.enabled = true;
    camera.position.copy(savedOrbit.position);
    controls.target.copy(savedOrbit.target);
    camera.fov = innerWidth <= 760 ? 47 : 42;
    if (savedOrbit.width !== innerWidth || savedOrbit.height !== innerHeight)
      home();
    camera.updateProjectionMatrix();
    controls.update();
    setModeUI();
    canvas.focus({ preventScroll: true });
  }
  function updateWalkCamera() {
    camera.position.set(player.x, 1.52, player.z);
    camera.rotation.order = "YXZ";
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  }
  $("enter-resident").addEventListener("click", enterWalk);
  $("walk-mode").addEventListener("click", enterWalk);
  $("orbit-mode").addEventListener("click", exitWalk);
  $("exit-walk").addEventListener("click", exitWalk);
  $("reset-view").addEventListener("click", () => {
    if (personalFocus) closePersonal();
    if (screenFocus) closeScreen();
    exitWalk();
    home();
    resize();
    canvas.focus({ preventScroll: true });
  });
  window.addEventListener("resize", resize);
  touchMedia.addEventListener("change", resize);
  reducedMedia.addEventListener("change", (e) => {
    reducedMotion = e.matches;
    document.body.classList.toggle("reduced-motion", reducedMotion);
  });
  document.body.classList.toggle("reduced-motion", reducedMotion);

  const keyMap = {
    KeyW: "forward",
    ArrowUp: "forward",
    KeyS: "backward",
    ArrowDown: "backward",
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
    ShiftLeft: "sprint",
    ShiftRight: "sprint",
  };
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && !document.querySelector("dialog[open]")) {
      if (personalFocus) { closePersonal(); return; }
      if (screenFocus) { closeScreen(); return; }
      exitWalk();
      return;
    }
    if (mode === "orbit" && e.target === canvas && !$("help-dialog").open) {
      const arrows = {
        ArrowLeft: [0.025, 0],
        ArrowRight: [-0.025, 0],
        ArrowUp: [0, 0.025],
        ArrowDown: [0, -0.025],
      };
      if (arrows[e.code]) {
        controls.rotateLeft(arrows[e.code][0]);
        controls.rotateUp(arrows[e.code][1]);
        e.preventDefault();
      }
      if (e.code === "Equal" || e.code === "NumpadAdd") {
        controls.dollyIn(1.08);
        e.preventDefault();
      }
      if (e.code === "Minus" || e.code === "NumpadSubtract") {
        controls.dollyOut(1.08);
        e.preventDefault();
      }
      return;
    }
    if (
      mode !== "walk" ||
      document.querySelector("dialog[open]") ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    )
      return;
    if (keyMap[e.code]) {
      input[keyMap[e.code]] = true;
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (keyMap[e.code]) input[keyMap[e.code]] = false;
  });
  window.addEventListener("blur", () => {
    clearInput();
    drag = null;
  });
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    if (mode === "walk") canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5)
      drag.moved = true;
    if (mode === "walk") {
      yaw -= dx * 0.004;
      pitch = THREE.MathUtils.clamp(pitch - dy * 0.004, -1.25, 1.2);
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (mode === "orbit" && !drag.moved) {
      pointer.set(
        (e.clientX / innerWidth) * 2 - 1,
        (-e.clientY / innerHeight) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(
        [
          ...characters.pickables.filter((object) => { for (let node = object; node; node = node.parent) if (!node.visible) return false; return true; }),
          ...(sharedSpace?.pickables.filter(
            (object) => object.visible && object.parent?.visible,
          ) || []),
          ...(personalProps?.pickables.filter((object) => { for (let node = object; node; node = node.parent) if (!node.visible) return false; return true; }) || []),
        ],
        true,
      )[0];
      if (hit?.object.userData.workspaceAction === "personal")
        focusPersonal(hit.object.userData.personalActor || "mori", hit.object.userData.personalKind);
      else if (hit?.object.userData.workspaceAction === "board")
        workspace.openBoard();
      else if (hit?.object.userData.workspaceAction === "computer")
        focusScreen(hit.object.userData.workActor || "indigo");
      else if (hit?.object.userData.residentId) {
        selectResident(
          residents.find((r) => r.data.id === hit.object.userData.residentId),
        );
        observer?.inspect(hit.object.userData.residentId);
      }
    }
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    drag = null;
  });
  canvas.addEventListener("pointercancel", () => (drag = null));
  canvas.addEventListener("lostpointercapture", () => (drag = null));
  for (const button of document.querySelectorAll("[data-move]")) {
    const release = () => (input[button.dataset.move] = false);
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      input[button.dataset.move] = true;
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }

  function weatherUI(value) {
    weather = value;
    room.setWeather(value);
    audio.setWeather(value);
    for (const v of ["rain", "moon"]) {
      $(`${v}-mode`).classList.toggle("active", v === value);
      $(`${v}-mode`).setAttribute("aria-pressed", String(v === value));
    }
  }
  $("rain-mode").addEventListener("click", () => weatherUI("rain"));
  $("moon-mode").addEventListener("click", () => weatherUI("moon"));
  function musicUI() {
    document.body.classList.toggle("is-playing", audio.playing);
    $("music-toggle").setAttribute("aria-pressed", String(audio.playing));
    $("music-toggle").setAttribute(
      "aria-label",
      audio.playing ? "暂停背景音乐" : "播放背景音乐",
    );
    $("play-icon").innerHTML = audio.playing
      ? '<path d="M8 6h3v12H8zm5 0h3v12h-3z"/>'
      : '<path d="m9 6 10 6-10 6z"/>';
    $("track-name").textContent = TRACKS[audio.trackIndex].name;
    $("music-status").textContent = audio.playing
      ? `${TRACKS[audio.trackIndex].bpm} BPM · 今晚不赶时间`
      : "点一下，让夜晚有声音";
  }
  $("music-toggle").addEventListener("click", async () => {
    $("music-toggle").disabled = true;
    try {
      if (audio.playing) await audio.pause();
      else await audio.play();
      musicUI();
    } catch (error) {
      console.error(error);
      $("music-status").textContent = "声音未能开启，请再试一次";
    } finally {
      $("music-toggle").disabled = false;
    }
  });
  $("next-track").addEventListener("click", async () => {
    await audio.next();
    musicUI();
  });
  $("volume").addEventListener("input", (e) =>
    audio.setVolume(Number(e.target.value) / 100),
  );
  $("help-button").addEventListener("click", () => {
    clearInput();
    $("help-dialog").showModal();
  });
  $("close-help").addEventListener("click", () => $("help-dialog").close());
  $("help-done").addEventListener("click", () => $("help-dialog").close());
  $("help-dialog").addEventListener("close", () => {
    clearInput();
    canvas.focus({ preventScroll: true });
  });
  document.addEventListener("visibilitychange", async () => {
    clearInput();
    drag = null;
    if (document.hidden) {
      if (audio.playing) {
        pausedByVisibility = true;
        await audio.pause();
        musicUI();
      }
    } else {
      lastTimestamp = performance.now();
      if (pausedByVisibility) {
        pausedByVisibility = false;
        try {
          await audio.play();
          musicUI();
        } catch {
          /* user can resume from the player */
        }
      }
    }
  });
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    renderer.setAnimationLoop(null);
    audio.pause();
    collaboration?.stop({ detach: true });
    workspace?.stopDiscussion();
    showError("绘图连接暂时中断，请重新打开小屋。");
  });
  window.addEventListener("pagehide", () => {
    renderer.setAnimationLoop(null);
    audio.dispose();
    collaboration?.dispose();
    workspace?.dispose();
    sharedSpace?.dispose();
    controls.dispose();
    renderer.dispose();
  });
  window.addEventListener("pageshow", (event) => {
    // A cached page has disposed its renderer/observers; reconnect with fresh state.
    if (event.persisted) window.location.reload();
  });

  function updateLabels() {
    const forward = new THREE.Vector3();
    const candidates = [];
    camera.getWorldDirection(forward);
    for (const r of residents) {
      const label = labels.get(r.data.id);
      if (!roomOnly) label.dataset.action = r.action
        ? r.propBusy ? r.bookHandling.label : r.action.arrived ? r.action.label || "" : collaboration?.paused && !collaboration.discussionBusy ? "等待继续工作" : r.action.ambient ? r.action.ambientKind === "drink" ? "去饮水角喝口水…" : r.action.ambientKind === "stretch" ? "起身伸展一下…" : r.action.ambientKind === "walk" ? "在房间里走走…" : "回到自己的位置…" : "走向工作位置…"
        : "待命";
      if (!roomOnly && r.traffic?.yieldTarget) label.dataset.action = r.traffic.hold ? "侧身等候 · 通道空后继续原任务" : "侧步让路 · 随后继续原任务";
      else if (!roomOnly && r.traffic?.waiting && r.traffic.blockedBy !== "furniture") label.dataset.action = `等待伙伴通过 · ${label.dataset.action}`;
      else if (!roomOnly && r.traffic?.slowing && r.traffic.speed > .08) label.dataset.action = `减速礼让 · ${label.dataset.action}`;
      r.labelPoint.copy(r.root.position);
      r.labelPoint.y =
        roomOnly && r.data.kind === "sleep" ? 1.03 : r.root.position.y + r.height + 0.12;
      if (roomOnly && r.data.kind === "sleep") {
        r.head.getWorldPosition(r.labelPoint);
        r.labelPoint.y += 0.36;
      }
      const toward = r.labelPoint.clone().sub(camera.position);
      projection.copy(r.labelPoint).project(camera);
      const visible =
        r.root.visible &&
        projection.z < 1 &&
        projection.z > -1 &&
        Math.abs(projection.x) < 0.98 &&
        Math.abs(projection.y) < 0.97 &&
        toward.dot(forward) > 0;
      label.hidden = !visible;
      if (visible) {
        const x = (projection.x * 0.5 + 0.5) * innerWidth;
        const y = (-projection.y * 0.5 + 0.5) * innerHeight;
        label.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
        candidates.push({ label, x, y, priority: label.classList.contains("speaking") ? 3
          : label.classList.contains("active") ? 2
          : ["working", "reviewing", "testing"].includes(r.team?.status) ? 1 : 0 });
      }
    }
    if (!roomOnly) {
      const occupied = [];
      for (const item of candidates.sort((a, b) => b.priority - a.priority)) {
        const overlaps = occupied.some((other) => Math.abs(item.x - other.x) < 82 && Math.abs(item.y - other.y) < 35);
        if (overlaps && item.priority === 0) item.label.hidden = true;
        else occupied.push(item);
      }
    }
    const bubble = $("dialogue-bubble");
    if (currentSpeech) {
      const resident = residents.find((r) => r.data.id === currentSpeech.actor);
      projection
        .copy(resident.root.position)
        .add(new THREE.Vector3(0, resident.height + 0.78, 0))
        .project(camera);
      bubble.hidden = projection.z > 1 || Math.abs(projection.x) > 0.96;
      const x = Math.max(
        125,
        Math.min(innerWidth - 125, (projection.x * 0.5 + 0.5) * innerWidth),
      );
      bubble.style.left = `${x}px`;
      bubble.style.top = `${Math.max(150, (-projection.y * 0.5 + 0.5) * innerHeight)}px`;
    } else bubble.hidden = true;
  }
  $("toggle-workspace").addEventListener("click", () => {
    const expanded = document.body.classList.toggle("workspace-open");
    document.body.classList.toggle("scene-focus", !expanded);
    $("toggle-workspace").textContent = expanded ? "回到场景" : "任务与产物";
    $("toggle-workspace").setAttribute("aria-expanded", String(expanded));
    if (mode === "orbit") { home(); resize(); }
  });
  if (!roomOnly)
    collaboration = new Collaboration({
      stage: teamScene,
      onAgent: (actor, state) => {
        teamScene.setAgent(actor, state);
        const label = labels.get(actor);
        label.dataset.status = state.status;
        if (["working", "reviewing", "testing"].includes(state.status) && $("follow-speaker").checked)
          selectResident(residents.find((r) => r.data.id === actor));
      },
      onSpeaker: (actor, to, event) => {
        currentSpeech = event;
        $("dialogue-bubble").textContent = event
          ? `${TEAM_BY_ID[actor].name}${to ? " → " + TEAM_BY_ID[to].name : ""}：${event.text}`
          : "";
        teamScene.setSpeaker(actor, to);
        labels.forEach((label, id) =>
          label.classList.toggle("speaking", id === actor),
        );
        audio.setDucking(Boolean(actor));
      },
      onSelect: (actor) =>
        selectResident(residents.find((r) => r.data.id === actor)),
      onRunStart: () => {
        cameraFollow = true;
        exitWalk();
        document.body.classList.remove("workspace-open");
        document.body.classList.add("scene-focus");
        $("toggle-workspace").textContent = "任务与产物";
        $("toggle-workspace").setAttribute("aria-expanded", "false");
        home(); resize();
      },
    });
  if (collaboration) {
    personalViewer = createPersonalViewer({ onFocus: focusPersonal, onClose: closePersonal, onPage: (actor, kind) => personalProps.turnPage(actor, kind), onAuto: (actor, value) => personalProps.setAuto(actor, value), onFollow: () => { cameraFollow = true; },
      onMotion: (actor, value) => { personalProps.setMotionView(actor, value); cameraFollow = true; },
      onPreview: (actor, read) => {
        if (collaboration.running || collaboration.discussionBusy || collaboration.paused) return;
        personalProps.setMotionView(actor, true); cameraFollow = true; teamScene.previewBook(actor, read);
      },
    });
    screenViewer = createScreenViewer({ onScreen: focusScreen, onClose: closeScreen,
      onWorkbench: (actor) => { closeScreen(); observer.inspect(actor); },
      onReplay: (actor) => sharedSpace.replayScreen(actor),
    });
    let repairReplay;
    observer = new Workbench({
      onFocus: (actor) => {
        if (actor && personalFocus) { personalFocus = null; personalViewer.hide(); personalProps.inspect(null); camera.fov = 42; camera.updateProjectionMatrix(); }
        if (actor && screenFocus) { screenFocus = null; screenViewer.hide(); camera.fov = 42; camera.updateProjectionMatrix(); }
        if (inspectionActor === actor) return;
        inspectionActor = actor; cameraFollow = true;
        controls.minDistance = actor ? 3 : 8;
        if (actor) { exitWalk(); selectResident(residents.find((r) => r.data.id === actor)); }
        else home();
        resize();
      },
      onAsk: (actor) => workspace.openDiscussion(actor),
      onControl: (action, actor, text) => collaboration.controlTask(action, actor, text),
      onBoard: () => workspace.openBoard(),
      onScreen: focusScreen,
      onPersonal: focusPersonal,
      onReplay: (snapshot) => repairReplay.start(snapshot),
    });
    const toolbar = $("workspace-toolbar"); toolbar.append(observer.dock);
    const toolbarBounds = () => document.body.style.setProperty("--workspace-tools-bottom", `${toolbar.getBoundingClientRect().bottom + 12}px`);
    new ResizeObserver(toolbarBounds).observe(toolbar); window.addEventListener("resize", toolbarBounds); toolbarBounds();
    workspace = new Workspace(collaboration, (snapshot) => {
      if (repairReplay?.playing) return;
      sharedSpace.sync(snapshot); personalProps.sync(snapshot); observer.sync(snapshot);
    });
    repairReplay = createRepairReplay({ collaboration,
      onFrame: (snapshot) => { sharedSpace.sync(snapshot); personalProps.sync(snapshot); observer.sync(snapshot); },
      onStart: () => {
        for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
        observer.close();
      },
      onRestore: () => workspace.render(),
    });
    $("open-computer").onclick = () => focusScreen("indigo");
  }
  $("mobile-start").addEventListener("click", () => workspace?.missionAction());
  $("stage-pause").addEventListener("click", () => {
    if (collaboration?.takeoverSpeech) {
      if (collaboration.takeoverNarrator.paused) { collaboration.takeoverNarrator.resume(); teamScene.pause(false); }
      else { collaboration.takeoverNarrator.pause(); teamScene.pause(true); }
    } else if (collaboration?.discussionBusy) $("pause-discussion").click();
    else collaboration?.togglePause();
  });
  $("stage-stop").addEventListener("click", () => collaboration?.stop());
  home();
  resize();
  selectResident(selected);
  weatherUI(weather);
  musicUI();
  renderer.setAnimationLoop((timestamp) => {
    if (document.hidden) return;
    const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
    lastTimestamp = timestamp;
    time += Math.max(0, delta);
    frame++;
    if (mode === "walk" && !document.querySelector("dialog[open]")) {
      const vector = movementVector(input, yaw, input.sprint ? 3 : 1.55, delta);
      Object.assign(
        player,
        moveWithCollisions(player, vector.x, vector.z, ROOM, [...obstacles, ...characters.personObstacles(roomOnly ? walkingResident.data.id : null)], .28),
      );
      updateWalkCamera();
    } else if (mode === "orbit") controls.update();
    characters.setVisitor(mode === "walk" ? player : null);
    if (personalFocus && mode === "orbit" && cameraFollow) {
      const view = personalProps.view(personalFocus.actor, personalFocus.kind);
      const blend = reducedMotion ? 1 : Math.min(1, delta * 3.5);
      controls.target.lerp(view.target, blend); camera.position.lerp(view.position, blend); controls.update();
    } else if (screenFocus && mode === "orbit" && cameraFollow) {
      const blend = reducedMotion ? 1 : Math.min(1, delta * 3.5);
      controls.target.lerp(screenFocus.target, blend); camera.position.lerp(screenFocus.position, blend); controls.update();
    } else if (inspectionActor && mode === "orbit" && cameraFollow) {
      const person = residents.find((r) => r.data.id === inspectionActor);
      const target = person.root.position.clone().add(new THREE.Vector3(0, 1, 0));
      const position = target.clone().add(new THREE.Vector3(2.9, 2.5, 4.4));
      const blend = reducedMotion ? 1 : Math.min(1, delta * 2);
      controls.minDistance = 3;
      controls.target.lerp(target, blend); camera.position.lerp(position, blend);
      if (innerWidth > 760) camera.setViewOffset(innerWidth, innerHeight, innerWidth * .23, 0, innerWidth, innerHeight);
      controls.update();
    } else if (teamScene && mode === "orbit" && cameraFollow && $("follow-speaker").checked &&
        document.body.classList.contains("scene-focus") && (collaboration.running || collaboration.discussionBusy) &&
        (collaboration.discussionBusy ? !workspace.discussionNarrator.paused : !collaboration.paused)) {
      const focus = teamScene.focus;
      const distance = innerWidth <= 760 ? Math.max(1.1, 0.82 / camera.aspect) : 1;
      const target = new THREE.Vector3(focus.x, 0.8, focus.z);
      const position = target.clone().add(new THREE.Vector3(8 * distance, 7.5 * distance, 10.5 * distance));
      const blend = reducedMotion ? 1 : Math.min(1, delta * 1.6);
      controls.target.lerp(target, blend);
      camera.position.lerp(position, blend);
      controls.update();
    }
    characters.update(time, delta, reducedMotion, roomOnly ? walkingResident?.data.id : null);
    if (collaboration) $("stage-pause").textContent =
      (collaboration.takeoverSpeech ? collaboration.takeoverNarrator.paused : collaboration.discussionBusy ? workspace.discussionNarrator.paused : collaboration.paused) ? "继续" : "暂停";
    teamScene?.update(
      time,
      delta,
      collaboration?.discussionBusy ? workspace.discussionNarrator.getLevel() : collaboration?.getSpeechLevel() || 0,
      reducedMotion,
    );
    room.update(time, delta, camera, mode === "walk", reducedMotion);
    sharedSpace?.update(camera, mode === "walk", time, reducedMotion);
    personalProps?.update(delta, reducedMotion);
    if (personalFocus) personalViewer.update(personalProps.state(personalFocus.actor, personalFocus.kind), cameraFollow, !collaboration.running && !collaboration.discussionBusy && !collaboration.paused);
    if (screenFocus) screenViewer.update(sharedSpace.screenState(screenFocus.actor, reducedMotion));
    selectRing.position.set(
      selected.root.position.x,
      0.018,
      selected.root.position.z,
    );
    if (hiddenPropHead) { hiddenPropHead.visible = true; hiddenPropHead = null; }
    if (personalFocus && personalProps.state(personalFocus.actor, personalFocus.kind).location === "hand") {
      const head = residents.find((r) => r.data.id === personalFocus.actor).head;
      const propState = personalProps.state(personalFocus.actor, personalFocus.kind);
      const atReaderView = cameraFollow && personalFocus.kind === "book" && propState.reading && !propState.motionView && camera.position.distanceTo(personalProps.view(personalFocus.actor, personalFocus.kind).position) < .22;
      if (atReaderView || head.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position) < .52) { head.visible = false; hiddenPropHead = head; }
    }
    renderer.render(scene, camera);
    updateLabels();
    if (frame === 2) {
      loading.classList.add("loaded");
      setTimeout(() => (loading.hidden = true), 650);
    }
    // DOM diagnostics make browser QA observable without a global debug API.
    if (timestamp - diagnosticsAt > 250) {
      canvas.dataset.state = JSON.stringify({
        ready: true,
        mode,
        personal: personalFocus ? personalProps.state(personalFocus.actor, personalFocus.kind) : null,
        screen: screenFocus ? { actor: screenFocus.actor, ...(() => { const state = sharedSpace.screenState(screenFocus.actor, reducedMotion); return { mode: state.mode, replay: state.replay, codeCharacters: state.visibleCode.length, outputCharacters: state.output.length, cursorRow: state.cursorRow, label: state.label }; })() } : null,
        weather,
        selected: selected.data.id,
        position: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        },
        rotation: { yaw: camera.rotation.y, pitch: camera.rotation.x },
        frame,
        time,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        audio: {
          playing: audio.playing,
          track: audio.trackIndex,
          volume: audio.volume,
          context: audio.context?.state || "uninitialized",
        },
        residents: residents.map((r) => ({
          id: r.data.id,
          x: r.root.position.x,
          z: r.root.position.z,
          yaw: r.root.rotation.y,
          motion: { speed: r.traffic?.speed || 0, slowing: Boolean(r.traffic?.slowing), sidestep: r.sideStep || 0,
            phase: r.traffic?.yieldTarget ? r.traffic.hold ? "waiting" : "sidestep" : r.traffic?.slowing ? "slowing" : r.traffic?.speed > .08 ? "walking" : "idle" },
          arm: r.arms[0].rotation.x,
          leg: r.legs[0].rotation.x,
          elbow: r.elbows[0].rotation.x,
          knee: r.knees[0].rotation.x,
          pelvisY: r.root.position.y,
          feet: r.footContacts || null,
          visible: r.root.visible,
          action: r.action ? {
            pose: r.action.pose, arrived: r.action.arrived, label: r.action.label,
            seated: Boolean(r.action.seat && r.action.arrived), age: r.action.age,
            ambient: Boolean(r.action.ambient), activity: r.action.ambientKind || null, holdingCup: r.drinkGrip > 0.5,
            propBusy: Boolean(r.propBusy), bookPhase: r.bookHandling?.phase || null, bookHeld: Boolean(r.bookHandling?.held), bookOpen: r.bookHandling?.open,
            yielding: Boolean(r.traffic?.yieldTarget || r.traffic?.waiting), blockedBy: r.traffic?.blockedBy || (r.traffic?.yieldTarget ? r.traffic.yieldFor : null),
          } : null,
        })),
        social: teamScene?.social || null,
        traffic: characters.trafficState(),
        reducedMotion,
      });
      diagnosticsAt = timestamp;
    }
  });
}

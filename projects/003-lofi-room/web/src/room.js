import * as THREE from "three";
import { FLOOR_Y, RUG, CUSHIONS, CUSHION_OBSTACLES } from "./ground-surfaces.js";

export const ROOM = { minX: -5.25, maxX: 5.25, minZ: -3.95, maxZ: 3.95 };
// Collision footprints also define the furniture layout; floor level is y = 0.
export const OBSTACLES = [
  ...CUSHION_OBSTACLES,
  { id: "lamp", tall: true, minX: -2.28, maxX: -1.78, minZ: 2.86, maxZ: 3.44 },
  { minX: -1.13, maxX: 1.13, minZ: -0.28, maxZ: 1.28 },
  { id: "sofa", minX: 3.52, maxX: 5.12, minZ: -0.8, maxZ: 2.38 },
  { minX: -4.85, maxX: -2.4, minZ: 1.25, maxZ: 3.7 },
  { minX: 2.15, maxX: 4.98, minZ: -3.92, maxZ: -2.75 },
  { id: "chair", minX: 3.0, maxX: 3.8, minZ: -2.55, maxZ: -1.8 },
  { tall: true, minX: -5.12, maxX: -2.65, minZ: -3.97, maxZ: -3.05 },
  { tall: true, minX: -5.1, maxX: -4.06, minZ: -0.9, maxZ: 0.85 },
  { tall: true, minX: -2.82, maxX: -2.12, minZ: -3.75, maxZ: -3.05 },
  { tall: true, minX: 4.3, maxX: 5.1, minZ: 2.75, maxZ: 3.6 },
];

let seed = 348;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

export function createRoom(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const materials = new Map();
  const geometries = new Map();
  function material(color, extra = {}) {
    const key = `${color}:${JSON.stringify(extra)}`;
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: 0.83, ...extra }),
      );
    return materials.get(key);
  }
  function box(w, h, d, color, x, y, z, parent = root, extra = {}) {
    const key = `${w},${h},${d}`;
    if (!geometries.has(key))
      geometries.set(key, new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(
      geometries.get(key),
      typeof color === "object" ? color : material(color, extra),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(r1, r2, h, color, x, y, z, parent = root, segments = 12) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r2, h, segments),
      material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d"), width, height);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }
  const walnut = "#735342",
    darkWood = "#493932",
    trim = "#ba9671";
  const floorTexture = texture(
    (ctx, w, h) => {
      ctx.fillStyle = "#8a624b";
      ctx.fillRect(0, 0, w, h);
      for (let row = 0; row < 18; row++) {
        const y = (row * h) / 18;
        ctx.fillStyle = `hsl(25 28% ${36 + random() * 7}%)`;
        ctx.fillRect(0, y, w, h / 18 - 1.2);
        for (let i = 0; i < 18; i++) {
          ctx.strokeStyle = `rgba(34,19,15,${0.03 + random() * 0.06})`;
          ctx.beginPath();
          ctx.moveTo(0, y + (random() * h) / 18);
          ctx.lineTo(w, y + (random() * h) / 18);
          ctx.stroke();
        }
        ctx.fillStyle = "#49352b66";
        for (let col = 0; col < 5; col++)
          ctx.fillRect(
            ((col * w) / 4 + ((row % 2) * w) / 8) % w,
            y,
            1.2,
            h / 18,
          );
      }
    },
    1024,
    1024,
  );
  box(11, 0.34, 8.6, darkWood, 0, -0.2, 0);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10.85, 8.45),
    material("#ffffff", { map: floorTexture }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.name = "floor-surface";
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  root.add(floor);
  box(11, 0.06, 0.08, trim, 0, -0.025, 4.27);
  box(0.08, 0.06, 8.6, trim, 5.47, -0.025, 0);

  // Open dollhouse walls, with a true window opening rather than a wall texture.
  const backWall = new THREE.Group();
  root.add(backWall);
  const leftWall = new THREE.Group();
  root.add(leftWall);
  const wall = "#c4b39b";
  box(3.52, 3.7, 0.16, wall, -3.74, 1.82, -4.22, backWall);
  box(3.52, 3.7, 0.16, wall, 3.74, 1.82, -4.22, backWall);
  box(4.0, 0.93, 0.16, wall, 0, 0.435, -4.22, backWall);
  box(4.0, 0.6, 0.16, wall, 0, 3.37, -4.22, backWall);
  box(0.16, 3.7, 8.6, wall, -5.42, 1.82, 0, leftWall);
  for (const p of [backWall, leftWall]) {
    if (p === backWall) {
      box(11, 0.82, 0.08, walnut, 0, 0.38, -4.09, p);
      box(11, 0.055, 0.11, trim, 0, 0.83, -4.07, p);
      box(11, 0.12, 0.12, darkWood, 0, 0.02, -4.06, p);
    } else {
      box(0.08, 0.82, 8.6, walnut, -5.29, 0.38, 0, p);
      box(0.11, 0.055, 8.6, trim, -5.27, 0.83, 0, p);
      box(0.12, 0.12, 8.6, darkWood, -5.26, 0.02, 0, p);
    }
  }
  for (let x = -5.1; x < 5.4; x += 0.4)
    box(0.014, 0.78, 0.015, darkWood, x, 0.39, -4.035, backWall);
  for (let z = -4; z < 4.3; z += 0.4)
    box(0.015, 0.78, 0.014, darkWood, -5.225, 0.39, z, leftWall);

  // Complete the room for first-person exploration; cut these walls away outside.
  const interiorShell = new THREE.Group();
  root.add(interiorShell);
  interiorShell.visible = false;
  box(0.16, 3.7, 8.6, wall, 5.42, 1.82, 0, interiorShell);
  box(11, 3.7, 0.16, wall, 0, 1.82, 4.22, interiorShell);
  box(11, 0.14, 8.6, "#d2c3aa", 0, 3.72, 0, interiorShell);
  box(0.08, 0.82, 8.6, walnut, 5.29, 0.38, 0, interiorShell);
  box(11, 0.82, 0.08, walnut, 0, 0.38, 4.09, interiorShell);
  box(0.11, 0.055, 8.6, trim, 5.27, 0.83, 0, interiorShell);
  box(11, 0.055, 0.11, trim, 0, 0.83, 4.07, interiorShell);
  box(1.45, 2.82, 0.1, darkWood, 0.72, 1.39, 4.055, interiorShell);
  box(1.29, 2.67, 0.06, "#947250", 0.72, 1.35, 3.988, interiorShell);
  for (const y of [0.7, 1.94])
    box(1.01, 0.92, 0.022, "#7d5b42", 0.72, y, 3.942, interiorShell);
  cylinder(
    0.045,
    0.045,
    0.09,
    "#d0ae6b",
    0.23,
    1.28,
    3.897,
    interiorShell,
  ).rotation.x = Math.PI / 2;
  box(0.64, 0.28, 0.015, "#b6b395", 0.72, 3.02, 4.045, interiorShell);
  box(0.6, 0.07, 2.2, walnut, 5.05, 2.16, 0.65, interiorShell);
  for (let i = 0; i < 8; i++)
    box(
      0.32,
      0.37,
      0.1,
      ["#8c9c84", "#b29871", "#8c94a4"][i % 3],
      5.08,
      2.39,
      -0.2 + i * 0.16,
      interiorShell,
    );
  interiorShell.traverse((object) => {
    if (object.isMesh) object.castShadow = false;
  });

  const nightTexture = texture(
    (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, "#101b35");
      gradient.addColorStop(1, "#424d68");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#dfddcaaa";
      ctx.beginPath();
      ctx.arc(w * 0.77, h * 0.18, 26, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 22; i++) {
        const x = (i * w) / 22,
          width = 25 + random() * 45,
          top = 85 + random() * 155;
        ctx.fillStyle = i % 2 ? "#1b263e" : "#242e45";
        ctx.fillRect(x, top, width, h - top);
        for (let y = top + 10; y < h; y += 14)
          for (let xx = x + 6; xx < x + width - 3; xx += 10) {
            if (random() > 0.38) {
              ctx.fillStyle = random() > 0.5 ? "#d5b784" : "#809ab9";
              ctx.fillRect(xx, y, 3, 5);
            }
          }
      }
    },
    768,
    384,
  );
  const cityMat = new THREE.MeshBasicMaterial({
    map: nightTexture,
    color: "#a3adc2",
  });
  const city = new THREE.Mesh(new THREE.PlaneGeometry(4.02, 2.2), cityMat);
  city.position.set(0, 2.03, -4.32);
  root.add(city);
  for (const x of [-2.03, 0, 2.03])
    box(0.065, 2.26, 0.12, "#c9b59b", x, 2.03, -4.035);
  for (const y of [0.92, 2.02, 3.15])
    box(4.14, 0.06, 0.13, "#c9b59b", 0, y, -4.035);
  box(4.4, 0.12, 0.4, trim, 0, 0.87, -3.96);
  box(4.8, 0.04, 0.04, darkWood, 0, 3.28, -3.96);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const curtain = box(
        0.13,
        2.2,
        0.16,
        i % 2 ? "#76827b" : "#88958b",
        side * (2.13 + i * 0.065),
        2.13,
        -3.96,
      );
      curtain.rotation.z = side * 0.025;
    }
    box(0.55, 0.075, 0.18, "#c7b497", side * 2.35, 1.6, -3.84);
  }
  // A rain curtain confined to the window; only the drops move.
  const rainPositions = new Float32Array(100 * 6),
    rainSpeeds = [];
  for (let i = 0; i < 100; i++) {
    const x = (random() - 0.5) * 3.9,
      y = 0.98 + random() * 2.1;
    rainPositions.set([x, y, -4.0, x - 0.012, y + 0.11, -4.0], i * 6);
    rainSpeeds.push(0.5 + random() * 0.7);
  }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(rainPositions, 3),
  );
  const rain = new THREE.LineSegments(
    rainGeometry,
    new THREE.LineBasicMaterial({
      color: "#b8d0df",
      transparent: true,
      opacity: 0.28,
    }),
  );
  root.add(rain);

  // Full bookshelf: different book heights, striped spines, a small ceramic vase.
  box(2.35, 2.85, 0.16, darkWood, -3.83, 1.43, -3.84);
  for (const x of [-4.98, -2.68]) box(0.09, 2.85, 0.66, walnut, x, 1.43, -3.56);
  for (let shelf = 0; shelf < 5; shelf++) {
    const y = 0.13 + shelf * 0.66;
    box(2.35, 0.085, 0.68, walnut, -3.83, y, -3.56);
    let x = -4.8;
    for (let i = 0; i < 10; i++) {
      const width = 0.1 + random() * 0.075,
        height = 0.36 + random() * 0.2;
      const color = [
        "#536e62",
        "#a27060",
        "#b99a64",
        "#6e7c8c",
        "#807488",
        "#c4b695",
      ][i % 6];
      box(width, height, 0.4, color, x, y + height / 2 + 0.047, -3.52);
      box(width * 0.8, 0.025, 0.008, "#d0c2a3", x, y + height * 0.7, -3.315);
      x += width + 0.04;
    }
  }
  box(2.4, 0.12, 0.72, walnut, -3.83, 2.87, -3.56);
  cylinder(0.13, 0.09, 0.27, "#9ba89a", -4.25, 3.06, -3.52);

  function plant(x, z, scale = 1, y = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(scale);
    root.add(g);
    cylinder(0.25, 0.19, 0.38, "#b88c70", 0, 0.19, 0, g);
    cylinder(0.225, 0.225, 0.04, "#43362a", 0, 0.39, 0, g);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.399;
      const stem = box(
        0.025,
        0.6,
        0.025,
        "#42674c",
        Math.cos(angle) * 0.1,
        0.68,
        Math.sin(angle) * 0.1,
        g,
      );
      stem.rotation.z = Math.sin(angle) * 0.2;
      for (let j = 0; j < 2; j++) {
        const leaf = box(
          0.12,
          0.055,
          0.36,
          i % 2 ? "#718866" : "#4c7057",
          Math.cos(angle) * (0.18 + j * 0.07),
          0.6 + j * 0.25,
          Math.sin(angle) * (0.18 + j * 0.07),
          g,
        );
        leaf.rotation.set(0.35, angle, -0.25);
      }
    }
  }
  plant(-2.47, -3.38, 1.25);
  plant(4.65, 3.12, 1.45);
  plant(4.65, -3.35, 0.55, 0.96);
  plant(-4.85, 3.53, 0.65);

  // Woven rug with a contrasting border and tassels.
  const rugTexture = texture((ctx, w, h) => {
    ctx.fillStyle = "#c3b692";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#56665c";
    ctx.lineWidth = 18;
    ctx.strokeRect(30, 30, w - 60, h - 60);
    ctx.lineWidth = 4;
    ctx.strokeRect(54, 54, w - 108, h - 108);
    for (let y = 0; y < h; y += 5) {
      ctx.strokeStyle = "#48382d18";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#78847444";
    ctx.lineWidth = 2;
    for (let x = 80; x < w; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x, h - 60);
      ctx.stroke();
    }
  });
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(RUG.width, RUG.depth),
    material("#ffffff", { map: rugTexture }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.name = "rug-surface";
  rug.position.set(RUG.x, RUG.y, RUG.z);
  rug.receiveShadow = true;
  root.add(rug);
  for (let i = 0; i < 25; i++) {
    box(0.025, 0.012, 0.13, "#bbae8e", -2.15 + i * 0.18, 0.01, 2.31).name = "rug-tassel";
    box(0.025, 0.012, 0.13, "#bbae8e", -2.15 + i * 0.18, 0.01, -1.0).name = "rug-tassel";
  }

  // Coffee table, cups, a candle, magazines, and soft floor cushions.
  box(2.25, 0.12, 1.5, walnut, 0, 0.7, 0.5);
  box(2.13, 0.07, 1.42, "#8e6c52", 0, 0.77, 0.5);
  for (const x of [-0.91, 0.91])
    for (const z of [-0.03, 1.03]) box(0.09, 0.65, 0.09, darkWood, x, 0.34, z);
  for (const [x, z] of [
    [-0.65, 0.25],
    [0.55, 0.02],
  ]) {
    cylinder(0.13, 0.15, 0.02, "#c9b999", x, 0.825, z);
    cylinder(0.085, 0.075, 0.14, "#d0c9b3", x, 0.9, z);
    cylinder(0.065, 0.065, 0.005, "#573e2a", x, 0.972, z);
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.058, 0.014, 5, 10),
      material("#d0c9b3"),
    );
    handle.position.set(x + 0.085, 0.91, z);
    root.add(handle);
  }
  // Personal notebooks occupy this part of the table; no overlapping fake stack.
  cylinder(0.075, 0.075, 0.14, "#d0b78b", 0.21, 0.89, 0.29);
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 6, 6),
    new THREE.MeshBasicMaterial({ color: "#ffcf78" }),
  );
  flame.position.set(0.21, 0.99, 0.29);
  flame.scale.y = 1.6;
  root.add(flame);
  for (const c of CUSHIONS) {
    const cushion = box(c.width, c.height, c.depth, c.color, c.x, c.y, c.z);
    cushion.name = c.id;
    cushion.rotation.y = c.yaw;
    box(0.63, 0.02, 0.018, "#ccba95", c.x, 0.15, c.z + 0.29).name = "cushion-seam";
  }

  // Right-side sofa faces into the room.
  // Recess the base under the cushion so seated heels have real clearance.
  box(1.16, 0.16, 3.02, darkWood, 4.38, 0.16, 0.8).name = "sofa-frame";
  box(0.25, 1.0, 3.1, "#536f71", 4.88, 0.58, 0.8);
  for (const z of [-0.66, 2.25]) box(1.4, 0.55, 0.23, "#5a7878", 4.28, 0.45, z);
  for (let i = 0; i < 3; i++) {
    box(1.02, 0.25, 0.9, "#78948f", 4.2, 0.34, -0.18 + i * 0.96);
    const pillow = box(
      0.22,
      0.68,
      0.86,
      "#668681",
      4.67,
      0.75,
      -0.18 + i * 0.96,
    );
    pillow.rotation.z = -0.12;
  }
  const pillow = box(0.19, 0.42, 0.42, "#c4a474", 4.4, 0.71, 1.88);
  pillow.rotation.z = -0.35;
  box(1.05, 0.38, 0.62, "#c6bfa1", 4.05, 0.46, 1.45);
  box(1.05, 0.05, 0.04, "#859d95", 4.05, 0.67, 1.35);

  // Desk & monitor, pixel keyboard, corkboard.
  const deskStart = root.children.length;
  box(2.75, 0.12, 1.02, walnut, 3.55, 0.96, -3.35);
  for (const x of [2.32, 4.77])
    for (const z of [-3.7, -3.0]) box(0.08, 0.91, 0.08, darkWood, x, 0.46, z);
  const monitorStart = root.children.length;
  box(0.25, 0.32, 0.15, "#343e40", 3.42, 1.22, -3.62);
  box(0.68, 0.05, 0.27, "#343e40", 3.42, 1.04, -3.56);
  box(1.23, 0.75, 0.075, "#3b4445", 3.42, 1.62, -3.61);
  const screenTexture = texture(
    (ctx, w, h) => {
      ctx.fillStyle = "#93a9ac";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#bed1c5";
      ctx.beginPath();
      ctx.arc(w * 0.7, h * 0.3, 30, 0, 7);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ["#718d88", "#567672", "#45625d", "#354e4b"][i];
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 10)
          ctx.lineTo(x, h * 0.5 + i * 25 + Math.sin(x * 0.017 + i) * 20);
        ctx.lineTo(w, h);
        ctx.fill();
      }
      ctx.fillStyle = "#c8d7c577";
      ctx.fillRect(w * 0.1, h * 0.12, 75, 3);
    },
    512,
    256,
  );
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.12, 0.64),
    new THREE.MeshBasicMaterial({ map: screenTexture }),
  );
  screen.position.set(3.42, 1.62, -3.565);
  root.add(screen);
  const monitorParts = root.children.slice(monitorStart);
  const monitor = new THREE.Group();
  monitor.position.set(3.42, 1.02, -3.56);
  for (const part of monitorParts) {
    part.position.sub(monitor.position);
    monitor.add(part);
  }
  monitor.scale.setScalar(1.02);
  root.add(monitor);
  const keyboardStart = root.children.length;
  const keyboardKeys = [];
  box(0.67, 0.035, 0.22, "#abb0a0", 3.4, 1.048, -3.15);
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 3; j++)
      keyboardKeys.push(box(
        0.043,
        0.008,
        0.038,
        "#e0dcc8",
        3.12 + i * 0.058,
        1.072,
        -3.22 + j * 0.061,
      ));
  box(0.09, 0.04, 0.15, "#bec4b5", 3.97, 1.06, -3.14);
  for (const part of root.children.slice(keyboardStart)) part.position.z += 0.12;
  const deskParts = root.children.slice(deskStart);
  const desk = new THREE.Group();
  for (const part of deskParts) {
    if (part.scale.y === 0.91) { part.scale.y -= 0.2; part.position.y += 0.1; }
    desk.add(part);
  }
  desk.position.y = -0.2;
  root.add(desk);
  const chair = new THREE.Group();
  root.add(chair);
  box(0.68, 0.09, 0.62, "#526b65", 3.42, 0.59, -2.24, chair);
  box(0.7, 0.7, 0.1, "#6f8980", 3.42, 0.94, -1.96, chair);
  cylinder(0.08, 0.08, 0.51, "#39443e", 3.42, 0.28, -2.24, chair);
  for (let i = 0; i < 4; i++) {
    const leg = box(0.04, 0.06, 0.7, "#39443e", 3.42, 0.055, -2.24, chair);
    leg.rotation.y = (i * Math.PI) / 2;
  }
  chair.scale.y = 0.7323;
  chair.position.z = -0.3;
  box(1.57, 0.72, 0.07, "#6c5340", 3.72, 2.68, -4.08);
  box(1.48, 0.63, 0.03, "#b69a72", 3.72, 2.68, -4.025);
  for (let i = 0; i < 4; i++) {
    const note = box(
      0.25,
      0.24,
      0.01,
      ["#d7c59f", "#8fa69d", "#b6aca1", "#ccb095"][i],
      3.16 + i * 0.34,
      2.68 + (i % 2) * 0.08,
      -3.999,
    );
    note.rotation.z = (i - 1.5) * 0.08;
  }

  // Bed nook with a checked blanket and a bedside book.
  box(2.3, 0.35, 2.42, darkWood, -3.64, 0.22, 2.47);
  box(2.15, 0.24, 2.26, "#c7c0ab", -3.64, 0.5, 2.47);
  box(2.35, 0.72, 0.13, walnut, -3.64, 0.51, 1.27);
  box(1.6, 0.17, 0.46, "#e1dcca", -3.64, 0.69, 1.62);
  box(2.16, 0.06, 1.52, "#839692", -3.64, 0.66, 2.8);
  for (let i = 0; i < 7; i++)
    box(0.035, 0.065, 1.52, "#b9c2b1", -4.64 + i * 0.34, 0.68, 2.8);
  for (let i = 0; i < 5; i++)
    box(2.16, 0.067, 0.035, "#b9c2b1", -3.64, 0.68, 2.08 + i * 0.34);
  box(0.5, 0.48, 0.58, walnut, -2.03, 0.25, 3.15);
  box(0.38, 0.035, 0.27, "#ad8d66", -2.03, 0.52, 3.16);

  // A vinyl corner along the left wall, with a spinning record.
  box(0.86, 0.82, 1.62, walnut, -4.64, 0.43, 0);
  box(0.9, 0.06, 1.7, trim, -4.64, 0.88, 0);
  for (let i = 0; i < 13; i++)
    box(
      0.54,
      0.56,
      0.06,
      ["#718c7f", "#b48c66", "#718598", "#a07d83"][i % 4],
      -4.51,
      0.37,
      -0.65 + i * 0.1,
    );
  box(0.62, 0.12, 0.55, "#4b554e", -4.61, 0.97, 0);
  const record = cylinder(
    0.23,
    0.23,
    0.02,
    "#1b2528",
    -4.61,
    1.045,
    0,
    root,
    32,
  );
  cylinder(0.068, 0.068, 0.025, "#d5ae72", -4.61, 1.058, 0);
  const groove = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.0015, 3, 48),
    material("#77837b"),
  );
  groove.rotation.x = Math.PI / 2;
  record.add(groove);
  box(0.023, 0.035, 0.32, "#ccc5a6", -4.39, 1.08, 0.04);
  box(0.34, 0.02, 0.36, "#c9b293", -4.65, 0.93, 0.56);

  function lamp(x, z, y = 0, small = false) {
    const h = small ? 0.65 : 2.45;
    const s = small ? 0.52 : 1;
    cylinder(0.21 * s, 0.25 * s, 0.045, "#4f5147", x, y + 0.025, z);
    cylinder(0.025, 0.025, h - 0.2, "#54564c", x, y + h / 2 - 0.1, z);
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 0.48 * s, 16, 1, true),
      material("#e8d1a4", {
        emissive: "#e3b779",
        emissiveIntensity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    shade.position.set(x, y + h, z);
    root.add(shade);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      new THREE.MeshBasicMaterial({ color: "#ffe7bc" }),
    );
    bulb.position.set(x, y + h - 0.05, z);
    root.add(bulb);
    const light = new THREE.PointLight(
      "#ffd3a0",
      small ? 1.6 : 7,
      small ? 3 : 6,
      2,
    );
    light.position.set(x, y + h - 0.15, z);
    scene.add(light);
  }
  lamp(1.72, -3.26);
  lamp(-2.03, 3.15, 0.55, true);
  lamp(2.43, -3.44, 1.05, true);
  // Framed original artwork on the side wall (procedurally drawn).
  const artwork = texture((ctx, w, h) => {
    ctx.fillStyle = "#233f4b";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#d1bb88";
    ctx.beginPath();
    ctx.arc(w * 0.7, h * 0.27, 38, 0, 7);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ["#7c9e98", "#547d7c", "#365e67", "#234350"][i];
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8)
        ctx.lineTo(x, h * 0.5 + i * 35 + Math.sin(x * 0.018 + i * 2) * 28);
      ctx.lineTo(w, h);
      ctx.fill();
    }
    ctx.fillStyle = "#d7d2bb";
    ctx.font = "14px monospace";
    ctx.fillText("TAKE IT SLOW", 25, h - 22);
  });
  box(0.07, 1.47, 1.63, darkWood, -5.14, 2.21, 0.1, leftWall);
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 1.29),
    new THREE.MeshBasicMaterial({ map: artwork }),
  );
  art.rotation.y = Math.PI / 2;
  art.position.set(-5.095, 2.21, 0.1);
  leftWall.add(art);
  const clock = cylinder(0.24, 0.24, 0.065, "#e0d6b7", -2.83, 2.62, -4.035);
  clock.rotation.x = Math.PI / 2;
  box(0.015, 0.17, 0.02, "#514635", -2.83, 2.67, -3.988);
  const hand = box(0.14, 0.018, 0.02, "#514635", -2.77, 2.62, -3.98);
  hand.rotation.z = 0.16;

  // String light wire and individually colored bulbs.
  const points = [];
  for (let i = 0; i <= 48; i++)
    points.push(
      new THREE.Vector3(
        -5.05 + (i * 10.1) / 48,
        3.4 - 0.17 * Math.abs(Math.sin((i * Math.PI) / 24)),
        -3.9,
      ),
    );
  const wire = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      48,
      0.012,
      4,
      false,
    ),
    material("#4e5143"),
  );
  root.add(wire);
  const bulbs = [];
  for (let i = 0; i < 25; i++) {
    const x = -5 + (i * 10) / 24,
      y = 3.36 - 0.17 * Math.abs(Math.sin((i * Math.PI) / 12));
    box(0.015, 0.08, 0.015, "#596052", x, y, -3.9);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 8, 8),
      new THREE.MeshBasicMaterial({
        color: ["#f5cf92", "#b3d5ca", "#edbea0", "#c6c6e2"][i % 4],
      }),
    );
    bulb.position.set(x, y - 0.065, -3.9);
    root.add(bulb);
    bulbs.push(bulb);
  }

  const hemi = new THREE.HemisphereLight("#c5d5de", "#765d45", 2.1);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight("#ffdfb0", 3.5);
  keyLight.position.set(-1.5, 7, 4.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 7;
  keyLight.shadow.camera.bottom = -7;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 20;
  keyLight.shadow.normalBias = 0.025;
  keyLight.shadow.bias = -0.0003;
  scene.add(keyLight);
  const moonLight = new THREE.DirectionalLight("#aac9ed", 1.35);
  moonLight.position.set(0, 3, -5);
  scene.add(moonLight);
  const dustPositions = new Float32Array(60 * 3);
  for (let i = 0; i < 60; i++)
    dustPositions.set(
      [(random() - 0.5) * 9.5, random() * 3.1, (random() - 0.5) * 7.3],
      i * 3,
    );
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(dustPositions, 3),
  );
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: "#f7d5a5",
      size: 0.025,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  root.add(dust);
  let rainy = true;
  return {
    root,
    computer: screen,
    keyboardKeys,
    chair,
    setWeather(value) {
      rainy = value === "rain";
      rain.visible = rainy;
      cityMat.color.set(rainy ? "#a3adc2" : "#d4ddeb");
      moonLight.intensity = rainy ? 1.35 : 2.1;
    },
    update(time, delta, camera, firstPerson, reducedMotion) {
      // Cut away a wall when observing from its exterior; keep walls in walking mode.
      backWall.visible = firstPerson || camera.position.z > -3.7;
      leftWall.visible = firstPerson || camera.position.x > -4.9;
      interiorShell.visible = firstPerson;
      if (!reducedMotion) {
        record.rotation.y = time * 0.32;
        flame.scale.y = 1.4 + Math.sin(time * 8) * 0.2;
        dust.rotation.y = Math.sin(time * 0.05) * 0.035;
        if (rainy) {
          for (let i = 0; i < 100; i++) {
            const offset = i * 6;
            rainPositions[offset + 1] -= delta * rainSpeeds[i];
            if (rainPositions[offset + 1] < 0.97)
              rainPositions[offset + 1] = 3.06;
            rainPositions[offset + 4] = Math.min(
              3.12,
              rainPositions[offset + 1] + 0.11,
            );
          }
          rainGeometry.attributes.position.needsUpdate = true;
        }
      }
    },
  };
}

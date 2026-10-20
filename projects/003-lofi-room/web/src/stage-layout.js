// Shared by navigation, furniture and choreography: all destinations face real props.
export const BOARD = { x: -3.1, z: -2.8, width: 2.65 };
export const STAGE_OBSTACLES = [
  { minX: -4.5, maxX: -1.7, minZ: -3.1, maxZ: -2.55 },
  { minX: -1.1, maxX: 0.3, minZ: -3.9, maxZ: -3.18 },
  { minX: 2.87, maxX: 3.43, minZ: 1.575, maxZ: 2.125 },
];
export const BOOK_TABLE = { x: 3.15, y: .805, z: 1.85 };
function bookStation(center, x, z, yaw) {
  // Closing folds the right half onto the left. Place the spine so that the
  // closed volume remains centered between the reader's hands.
  return { book: [center[0] - Math.cos(yaw) * .1, center[1], center[2] + Math.sin(yaw) * .1], x, z, yaw };
}
// Book contact and standing approach share one source with the prop renderer.
export const BOOK_STATIONS = {
  mori: bookStation([-.8, .835, 1.10], -.8, 1.55, Math.PI),
  amber: bookStation([3.15, .84, 1.85], 2.675, 1.85, Math.PI / 2),
  indigo: bookStation([2.70, .84, -3.03], 2.70, -2.55, Math.PI),
  luna: bookStation([-.97, .835, -.15], -1.45, -.15, Math.PI / 2),
  momo: bookStation([.55, .835, 1.10], .85, 1.55, Math.atan2(-.30, -.45)),
  sleepy: bookStation([4.62, .84, -3.03], 4.62, -2.55, Math.PI),
};
export const SOFA_SEAT_Y = -.28;
export const WATER_STATION = { x: -0.15, z: -2.85, yaw: Math.PI, cup: { x: -0.195, y: 0.99, z: -3.225 } };
export const BOARD_SPOTS = {
  mori: { x: -3.85, z: -1.95 },
  amber: { x: -2.95, z: -1.95 },
  indigo: { x: -2.05, z: -1.95 },
  luna: { x: -3.45, z: -0.15 },
  momo: { x: -2.55, z: -0.15 },
  sleepy: { x: -1.65, z: -0.15 },
};
export const WORK_SPOTS = {
  mori: { ...BOARD_SPOTS.mori, pose: "point", yaw: Math.PI, label: "在白板上分工" },
  amber: { x: -2.75, z: -2.1, pose: "read", yaw: Math.PI, label: "整理研究资料" },
  indigo: {
    x: 2.7, z: -2.32, pose: "type", yaw: Math.PI,
    seat: { x: 3.42, z: -2.54, y: -0.28, obstacle: "chair" }, label: "坐在电脑前处理任务",
  },
  luna: { x: -1.68, z: -.15, pose: "read", yaw: Math.PI / 2, label: "在桌边审阅方案" },
  momo: { x: 1.45, z: 0.6, pose: "type", yaw: -Math.PI / 2, label: "操作电脑检查方案" },
  sleepy: { x: 0, z: 1.55, pose: "write", yaw: Math.PI, label: "在桌边整理交付记录" },
};
export const DESK_MEETING = {
  indigo: { x: 2.65, z: -1.25 },
  luna: { x: 1.6, z: -1.3 },
  momo: { x: 2.15, z: -0.35 },
};

// Personal activities are separate from assigned work; the board is only a meeting place.
export const HOME_SPOTS = {
  mori: { x: -1.75, z: 2.3, yaw: 0.8, pose: "read", label: "等候任务 · 整理自己的笔记" },
  amber: {
    x: 3.15, z: -0.18, yaw: -Math.PI / 2, pose: "read",
    seat: { x: 4, z: -0.18, y: SOFA_SEAT_Y, furniture: "sofa", obstacle: "sofa", footForward: 0.37 },
    label: "等候任务 · 坐在沙发上阅读",
  },
  indigo: { ...WORK_SPOTS.indigo, label: "等候任务 · 在电脑前整理个人资料" },
  luna: {
    x: -2.15, z: 0.6, yaw: Math.PI / 2, pose: "read",
    seat: { x: -1.4, z: 0.6, y: -0.595, floor: true, obstacle: "reading-cushion" },
    label: "等候任务 · 坐在地垫上阅读",
  },
  momo: {
    x: 3.15, z: 0.78, yaw: -Math.PI / 2, pose: "rest",
    seat: { x: 4, z: 0.78, y: SOFA_SEAT_Y, furniture: "sofa", obstacle: "sofa", footForward: 0.37 },
    label: "等候任务 · 在沙发上放松休息",
  },
  sleepy: { ...WORK_SPOTS.sleepy, label: "等候任务 · 在桌边写自己的手记" },
};

export const BREAK_SPOTS = {
  mori: { stretch: { x: -1.5, z: 2.5 }, walk: [{ x: -0.65, z: 2.95 }, { x: 1.15, z: 2.6 }] },
  amber: { stretch: { x: 2.65, z: 1.5 }, walk: [{ x: 2.65, z: 2.4 }, { x: 1.5, z: 2.65 }] },
  indigo: { stretch: { x: 2.05, z: -1.5 }, walk: [{ x: 1.3, z: -1.55 }, { x: 1.55, z: -0.65 }] },
  luna: { stretch: { x: -1.75, z: -0.4 }, walk: [{ x: -1.75, z: -0.55 }, { x: -0.8, z: -1.1 }] },
  momo: { stretch: { x: 2.55, z: 2.55 }, walk: [{ x: 2.55, z: 2.4 }, { x: 1.65, z: 2.65 }] },
  sleepy: { stretch: { x: 0.65, z: 2.6 }, walk: [{ x: 0.9, z: 2.65 }, { x: 1.8, z: 2.55 }] },
};

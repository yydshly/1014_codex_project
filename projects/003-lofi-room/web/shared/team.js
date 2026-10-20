export const TEAM = [
  {
    id: "mori",
    name: "小森",
    role: "协调员",
    job: "拆分目标、分派任务、处理交接",
    voice: "male-qn-jingying",
    color: "#839b72",
    station: { x: -1.9, z: -1.3 },
  },
  {
    id: "amber",
    name: "阿橘",
    role: "研究员",
    job: "整理来源与能力证据",
    voice: "male-qn-daxuesheng",
    color: "#c59a65",
    station: { x: -2.15, z: -2.7 },
  },
  {
    id: "indigo",
    name: "小蓝",
    role: "开发员",
    job: "产出方案、处理审阅反馈",
    voice: "male-qn-qingse",
    color: "#7c9ba6",
    station: { x: 2.5, z: -2.3 },
  },
  {
    id: "luna",
    name: "月白",
    role: "审阅员",
    job: "检查方案与风险、提出修改",
    voice: "female-chengshu",
    color: "#a599b4",
    station: { x: -1.65, z: -.15 },
  },
  {
    id: "momo",
    name: "桃桃",
    role: "验证员",
    job: "验证交接、语音与停止行为",
    voice: "female-shaonv",
    color: "#b8878e",
    station: { x: 2.25, z: 1.9 },
  },
  {
    id: "sleepy",
    name: "栗子",
    role: "记录员",
    job: "汇总证据、归档最终产物",
    voice: "female-yujie",
    color: "#c2b99b",
    station: { x: -1.85, z: 2.2 },
  },
];
export const TEAM_BY_ID = Object.fromEntries(
  TEAM.map((member) => [member.id, member]),
);
export const DEFAULT_GOAL =
  "为这个 3D 小屋设计一套有语音、任务交接和可查看产物的多 Agent 协作展示方案。";
export const STATUS_TEXT = {
  idle: "待命",
  queued: "等待交接",
  working: "执行中",
  reviewing: "审阅中",
  testing: "验证中",
  blocked: "需要修改",
  done: "已完成",
  error: "执行失败",
  cancelled: "已停止",
};

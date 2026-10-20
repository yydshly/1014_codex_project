// 目标看板的草稿状态：新建目标后表单内容还没有自己的目标 id，
// 此时点“归档目标”会作用到上一个已保存目标，因此必须禁用归档入口。
// 已有目标（未归档或已归档）都应保持归档/恢复可用。
export const goalArchiveEnabled = ({ newGoal, running, discussionBusy } = {}) =>
  !newGoal && !running && !discussionBusy;

// 草稿没有对应任何已保存目标，按钮文案固定为“归档目标”；
// 只有已保存且已归档的目标才显示“恢复目标”。
export const goalArchiveLabel = ({ newGoal, status } = {}) =>
  !newGoal && status === "archived" ? "恢复目标" : "归档目标";

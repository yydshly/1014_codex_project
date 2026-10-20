// Replaced by Vite at build time. No API key or server configuration is exposed.
export const STATIC_DEPLOYMENT = typeof __LOFI_STATIC__ !== "undefined" && __LOFI_STATIC__;
export function staticExecutionState(running) {
  return { kind: "demo", label: running ? "Pages 预设演示中 · 无真实任务" : "Pages 演示版 · 无真实任务",
    detail: "在线体验人物、场景与已有 MiniMax 录音；真实编码、测试和实时语音需要本地 Node 服务。" };
}

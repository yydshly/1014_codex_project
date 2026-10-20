import "./screen-viewer.css";

export function createScreenViewer({ onScreen, onWorkbench, onReplay, onClose }) {
  const root = document.createElement("section");
  root.className = "screen-viewer glass"; root.hidden = true;
  root.setAttribute("aria-label", "房间电脑近景");
  const copy = document.createElement("div"); copy.className = "screen-viewer-copy";
  const title = document.createElement("strong"), status = document.createElement("span");
  status.setAttribute("role", "status"); copy.append(title, status);
  let actor = "indigo";
  const button = (text, handler) => { const element = document.createElement("button"); element.type = "button"; element.textContent = text; element.onclick = handler; root.append(element); return element; };
  root.append(copy);
  const develop = button("开发电脑", () => onScreen("indigo"));
  const testing = button("测试电脑", () => onScreen("momo"));
  const replay = button("回放屏幕动效", () => onReplay(actor));
  button("查看工作台", () => onWorkbench(actor));
  button("返回全景", onClose);
  document.body.append(root);
  return {
    show(id) { actor = id; root.hidden = false; document.body.classList.add("viewing-screen"); title.textContent = id === "momo" ? "桃桃的测试笔记本" : "小蓝的开发电脑"; develop.setAttribute("aria-pressed", String(id === "indigo")); testing.setAttribute("aria-pressed", String(id === "momo")); },
    hide() { root.hidden = true; document.body.classList.remove("viewing-screen"); },
    update(frame) {
      if (root.hidden || !frame) return;
      if (status.textContent !== frame.label) status.textContent = frame.label;
      replay.disabled = frame.live;
      replay.textContent = frame.replay ? "停止屏幕回放" : "回放屏幕动效";
      root.dataset.actor = actor; root.dataset.mode = frame.mode; root.dataset.replay = String(frame.replay);
    },
  };
}

import { TEAM } from "../shared/team.js";
import "./screen-viewer.css";

export function createPersonalViewer({ onFocus, onPage, onClose, onFollow, onAuto, onMotion, onPreview }) {
  const root = document.createElement("section"); root.className = "screen-viewer personal-viewer glass"; root.hidden = true;
  root.setAttribute("aria-label", "角色物品近景");
  const copy = document.createElement("div"); copy.className = "screen-viewer-copy";
  const title = document.createElement("strong"), detail = document.createElement("span"); detail.setAttribute("role", "status");
  copy.append(title, detail); root.append(copy);
  const cameraStatus = document.createElement("span"); cameraStatus.className = "personal-camera-status"; copy.append(cameraStatus);
  let actor = "luna", kind = "book";
  const select = document.createElement("select"); select.setAttribute("aria-label", "物品所属角色");
  for (const member of TEAM) { const option = document.createElement("option"); option.value = member.id; option.textContent = member.name; select.append(option); }
  select.onchange = () => onFocus(select.value, kind); root.append(select);
  const buttons = new Map();
  const button = (label, action) => { const node = document.createElement("button"); node.type = "button"; node.textContent = label; node.onclick = action; root.append(node); return node; };
  for (const [id, label] of [["book", "读本"], ["note", "笔记"], ["drink", "水杯"]]) buttons.set(id, button(label, () => onFocus(actor, id)));
  const page = button("翻一页", () => onPage(actor, kind)); button("返回全景", onClose);
  let autoTurn = true;
  const auto = button("自动翻页", () => onAuto(actor, !autoTurn));
  let motionView = false;
  const motion = button("观察人物动作", () => onMotion(actor, !motionView));
  const pickup = button("去拿书阅读", () => onPreview(actor, true));
  const putBack = button("收书回工位", () => onPreview(actor, false));
  const previewNote = document.createElement("span"); previewNote.textContent = "拿放动作预览 · 不启动真实任务"; root.append(previewNote);
  const follow = button("恢复跟随", () => onFollow()); follow.hidden = true;
  const text = document.createElement("details"); text.className = "personal-text";
  const summary = document.createElement("summary"); summary.textContent = "阅读文字";
  const transcript = document.createElement("p"); text.append(summary, transcript); root.append(text);
  text.ontoggle = () => { if (text.open && kind === "book") onAuto(actor, false); };
  document.body.append(root);
  return {
    show(id, itemKind) {
      const entering = root.hidden;
      actor = id; kind = itemKind; select.value = id; root.hidden = false; document.body.classList.add("viewing-props");
      buttons.forEach((node, id) => node.setAttribute("aria-pressed", String(id === kind))); page.hidden = kind === "drink";
      if (text.open && kind === "book") onAuto(actor, false);
      if (entering) select.focus({ preventScroll: true });
    },
    hide() { root.hidden = true; document.body.classList.remove("viewing-props"); },
    update(state, following = true, previewAllowed = true) {
      if (root.hidden || !state) return;
      const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
      setText(title, state.title); setText(detail, state.detail);
      setText(cameraStatus, following ? state.handling || state.motionView ? "跟随人物动作 · 拖动可自由观察" : state.location === "hand" && kind === "book" ? "读者视角 · 拖动可从旁观察" : "镜头跟随这件物品 · 拖动可自由观察" : "自由观察中 · 镜头已停止跟随"); follow.hidden = following;
      setText(page, state.pageAction || "翻一页"); page.disabled = Boolean(state.pageDisabled);
      auto.hidden = kind !== "book" || !state.reading; autoTurn = state.autoTurn; auto.setAttribute("aria-pressed", String(Boolean(autoTurn)));
      motion.hidden = pickup.hidden = putBack.hidden = previewNote.hidden = kind !== "book";
      motionView = state.motionView; motion.setAttribute("aria-pressed", String(motionView)); setText(motion, motionView ? "查看书本近景" : "观察人物动作");
      pickup.disabled = putBack.disabled = !previewAllowed;
      pickup.title = putBack.title = previewAllowed ? "仅演示场景动作，不提交或修改真实任务" : "任务执行或讨论期间，由任务驱动人物动作";
      text.hidden = kind === "drink" || kind === "book" && !state.bookOpen;
      const readable = kind === "note" ? state.notes : state.bookText;
      if (transcript.textContent !== readable) transcript.textContent = readable || "";
      root.dataset.actor = state.actor; root.dataset.kind = kind; root.dataset.entity = state.entityId || ""; root.dataset.location = state.location || "";
      root.dataset.page = kind === "note" ? state.notePage || "" : state.page || ""; root.dataset.noteCharacters = state.noteCharacters || 0; root.dataset.fill = state.fill ?? ""; root.dataset.following = String(following);
    },
  };
}

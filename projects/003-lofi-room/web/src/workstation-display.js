import { workstationState, workstationFrame } from "../shared/workstation.js";

const font = "Consolas, 'Microsoft YaHei', monospace";
const tokens = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`|\/\/.*$|\b(?:const|let|var|function|return|export|import|from|if|else|async|await|new|class|true|false|null)\b|\b\d+\b)/g;
const tokenColor = (text) => text.startsWith("//") ? "#6d967d" : /^["'`]/.test(text) ? "#e9c68b" : /^\d/.test(text) ? "#d4a6e8" : "#b5a3ed";
function codeLine(ctx, line, x, y, maxWidth) {
  let position = 0, current = x;
  for (const match of line.matchAll(tokens)) {
    for (const [part, color] of [[line.slice(position, match.index), "#b6d8df"], [match[0], tokenColor(match[0])]]) {
      ctx.fillStyle = color; ctx.fillText(part, current, y); current += ctx.measureText(part).width;
      if (current - x > maxWidth) return;
    }
    position = match.index + match[0].length;
  }
  ctx.fillStyle = "#b6d8df"; ctx.fillText(line.slice(position), current, y);
}
function terminalLines(ctx, output, x, y, maxLines, width, size = 24) {
  ctx.font = `${size}px ${font}`;
  const rows = output.replace(/\x1b\[[0-9;]*m/g, "").split("\n").filter((line) => line.trim()).slice(-maxLines);
  rows.forEach((line, index) => {
    ctx.fillStyle = /fail|error|not ok/i.test(line) ? "#ed9a87" : /pass|ok |✔/.test(line) ? "#c2e598" : "#a9c9d1";
    ctx.fillText(line.slice(0, 95), x, y + index * (size + 7), width);
  });
}
export function createWorkstationDisplay(surface, actor) {
  let state = workstationState({}, actor), replayStart = null, changeStart = null, previousSource, browserImage, imageUrl;
  return {
    sync(snapshot, time) {
      const next = workstationState(snapshot, actor);
      const source = `${next.source?.id}:${next.source?.status}`;
      if (source !== previousSource) { changeStart = time; previousSource = source; }
      if (next.live) replayStart = null;
      if (next.browser?.screenshot && next.browser.screenshot !== imageUrl) {
        imageUrl = next.browser.screenshot;
        const candidate = new Image();
        candidate.onload = () => { if (imageUrl === next.browser.screenshot) browserImage = candidate; };
        candidate.src = new URL(imageUrl, document.baseURI).href;
      }
      state = next;
    },
    replay(time) { if (!state.live) replayStart = replayStart === null ? time : null; },
    frame(time, reducedMotion = false) { return workstationFrame(state, { time, replayStart, changeStart, reducedMotion }); },
    draw(time, reducedMotion) {
      const frame = this.frame(time, reducedMotion), c = surface.context;
      c.fillStyle = "#0c1722"; c.fillRect(0, 0, 1024, 576);
      c.fillStyle = "#253744"; c.fillRect(0, 0, 1024, 52);
      for (let i = 0; i < 3; i++) { c.fillStyle = ["#d88c7f", "#d7bd79", "#9dbd8b"][i]; c.beginPath(); c.arc(25 + i * 22, 26, 6, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "#dbe6d4"; c.font = `bold 25px ${font}`;
      c.fillText(`${frame.name} / ${frame.browser ? "BROWSER CHECK" : actor === "momo" ? "TEST RUNNER" : "CODE EDITOR"}`, 118, 35);
      c.fillStyle = "#1b2c38"; c.fillRect(0, 52, 1024, 46);
      c.fillStyle = "#b6d3c9"; c.font = `21px ${font}`;
      c.fillText(frame.browser ? frame.browser.url || "正在操作真实 Demo" : actor === "momo" ? frame.command?.command || "等待测试命令" : frame.path.split("/").slice(-2).join("/") || (frame.illustrative ? "animation-example.js" : "等待源码记录"), 22, 82, 960);
      if (actor === "momo" && frame.browser) {
        c.fillStyle = "#122332"; c.fillRect(20, 110, 984, 330);
        if (browserImage) {
          const scale = Math.min(984 / browserImage.width, 330 / browserImage.height);
          const width = browserImage.width * scale, height = browserImage.height * scale;
          c.drawImage(browserImage, 20 + (984 - width) / 2, 110 + (330 - height) / 2, width, height);
        }
        c.fillStyle = "#192b35e8"; c.fillRect(20, 390, 984, 50);
        c.fillStyle = frame.browser.status === "failed" ? "#f3a98e" : "#c4df9d"; c.font = `24px ${font}`;
        const result = frame.browser.status === "running" ? "操作中" : frame.browser.criterion === 0 ? "页面初探" : frame.browser.passed ? "PASS" : "FAIL";
        c.fillText(`${result} · ${frame.browser.criterion ? `验收${frame.browser.criterion}` : "尚未验收"} · ${frame.browser.action}`, 36, 424, 945);
        terminalLines(c, frame.browser.output || frame.browser.label, 30, 476, 2, 960, 22);
      } else if (actor === "momo") {
        const failed = frame.command?.status === "failed";
        c.fillStyle = failed ? "#483033" : "#23392e"; c.fillRect(24, 117, 976, 56);
        c.fillStyle = failed ? "#efa68e" : "#c4df9d"; c.font = `bold 27px ${font}`;
        c.fillText(frame.command ? frame.command.status === "running" && frame.live ? "RUNNING  实际测试执行中" : `EXIT ${frame.command.exitCode ?? "?"}  ${failed ? "FAIL · 交回开发员" : "实际命令结果"}` : "READY  等待实际输出", 42, 154);
        terminalLines(c, frame.output || "尚未执行测试；不会生成虚假的 PASS 结果。", 35, 213, 9, 950, 27);
        if (frame.cursor) { c.fillStyle = "#c4df9d"; c.fillRect(35, 505, 13, 23); }
      } else {
        c.fillStyle = "#152431"; c.fillRect(0, 98, 152, 288);
        c.fillStyle = "#6f929d"; c.font = `18px ${font}`; c.fillText("EXPLORER", 15, 130);
        for (const [i, text] of ["workspace", frame.path.split("/").at(-1) || "待命", "TERMINAL"].entries()) {
          c.fillStyle = i === 1 ? "#abcfa5" : "#718f9b"; c.fillText(text.slice(0, 15), 16, 166 + i * 40, 128);
        }
        c.save(); c.beginPath(); c.rect(155, 99, 862, 282); c.clip();
        c.fillStyle = "#1c3040"; c.fillRect(154, 110 + frame.cursorRow * 29, 870, 30);
        c.font = `23px ${font}`;
        (frame.lines.length && frame.code ? frame.lines : ["// 等待角色读取或写入真实源码", "// 点击近景下方按钮可预览屏幕动效"]).forEach((line, index) => {
          c.fillStyle = "#567484"; c.fillText(String(frame.firstLine + index).padStart(3), 162, 133 + index * 29);
          codeLine(c, line.replace(/\t/g, "  "), 220, 133 + index * 29, 780);
        });
        if (frame.cursor) {
          const line = frame.lines[frame.cursorRow] || "";
          const x = Math.min(995, 220 + c.measureText(line.replace(/\t/g, "  ")).width);
          c.fillStyle = "#e4ddb3"; c.fillRect(x, 113 + frame.cursorRow * 29, 3, 26);
        }
        c.restore();
        c.fillStyle = "#253744"; c.fillRect(0, 389, 1024, 32);
        c.font = `18px ${font}`; c.fillStyle = "#d1c99d"; c.fillText("TERMINAL / 实际命令输出", 20, 412);
        terminalLines(c, frame.output || "等待下一次工具调用…", 22, 450, 3, 972, 21);
      }
      c.fillStyle = frame.replay ? "#665f40" : frame.active ? "#345d50" : "#243b47";
      c.fillRect(0, 540, 1024, 36);
      c.fillStyle = "#e0e8cb"; c.font = `19px ${font}`;
      c.fillText(frame.label, 17, 565);
      c.fillText(actor === "indigo" ? `Ln ${frame.firstLine + frame.cursorRow} · UTF-8` : "仅显示实际日志", 748, 565);
      if (frame.animating) {
        c.fillStyle = frame.replay ? "#e1cd95" : "#b9de9e"; c.fillRect((time * 130) % 830, 536, 190, 4);
      }
      surface.texture.needsUpdate = true;
      return frame;
    },
  };
}

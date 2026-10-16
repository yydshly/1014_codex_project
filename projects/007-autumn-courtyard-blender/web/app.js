"use strict";

// Native HTML contains the narrative; JS only enhances exploration.
const activateTabGroup = (buttons, onActivate = () => {}) => {
  const select = (selected, focus = false) => {
    buttons.forEach((button) => {
      const active = button === selected;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      button.classList.toggle("is-active", active);
      document.getElementById(button.getAttribute("aria-controls")).hidden = !active;
    });
    if (focus) selected.focus();
    onActivate(selected);
  };
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => select(button));
    button.addEventListener("keydown", (event) => {
      let next;
      if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (index + 1) % buttons.length;
      if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = buttons.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        select(buttons[next], true);
      }
    });
  });
};

activateTabGroup([...document.querySelectorAll(".step")]);

const comparison = document.querySelector(".comparison");
const range = document.getElementById("compare-range");
const compareButtons = [...document.querySelectorAll("[data-compare]")];
const setComparison = (value) => {
  const percent = Math.max(0, Math.min(100, Number(value)));
  range.value = String(percent);
  range.setAttribute("aria-valuetext", `参考图 ${percent}%，三维渲染 ${100 - percent}%`);
  comparison.style.setProperty("--split", `${percent}%`);
  document.getElementById("compare-value").value = `${percent}%`;
  comparison.classList.toggle("is-reference", percent === 100);
  comparison.classList.toggle("is-render", percent === 0);
  compareButtons.forEach((button) => {
    const selected = Number(button.dataset.compare);
    button.setAttribute("aria-pressed", String(selected === 50 ? percent > 0 && percent < 100 : percent === selected));
  });
};
range.addEventListener("input", () => setComparison(range.value));
compareButtons.forEach((button) => button.addEventListener("click", () => setComparison(button.dataset.compare)));
setComparison(50);

// Drag anywhere over the image. The visible native range remains keyboard accessible.
const comparisonFrame = document.querySelector(".comparison-frame");
comparisonFrame.addEventListener("dragstart", (event) => event.preventDefault());
let pointerId = null;
const compareAtPointer = (event) => {
  const rect = comparisonFrame.getBoundingClientRect();
  setComparison(Math.round(((event.clientX - rect.left) / rect.width) * 100));
};
comparisonFrame.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  pointerId = event.pointerId;
  comparisonFrame.setPointerCapture(pointerId);
  compareAtPointer(event);
});
comparisonFrame.addEventListener("pointermove", (event) => {
  if (event.pointerId === pointerId) compareAtPointer(event);
});
const endComparisonDrag = (event) => {
  if (event.pointerId === pointerId) pointerId = null;
};
comparisonFrame.addEventListener("pointerup", endComparisonDrag);
comparisonFrame.addEventListener("pointercancel", endComparisonDrag);

const video = document.getElementById("demo-video");
// Small local previews may not provide byte ranges. A Blob makes the 1.12 MB
// clip seekable there while normal media hosts keep their native source.
const videoPrepared = fetch(video.querySelector("source").src)
  .then(async (response) => {
    if (!response.ok) throw new Error("Video unavailable");
    if (response.headers.get("accept-ranges") === "bytes" && response.headers.get("content-type")?.startsWith("video/mp4")) {
      await response.body?.cancel();
      return;
    }
    const clip = await response.blob();
    video.src = URL.createObjectURL(clip.slice(0, clip.size, "video/mp4"));
    video.load();
  })
  .catch(() => {}); // Keep the original source and native playback on failure.
activateTabGroup([...document.querySelectorAll(".media-tabs [role=tab]")], (button) => {
  if (button.id === "media-overview-tab") video.pause();
});
document.getElementById("play-orbit").addEventListener("click", async () => {
  const status = document.getElementById("video-status");
  try {
    await videoPrepared;
    if (video.readyState < 1) {
      await new Promise((resolve, reject) => {
        video.addEventListener("loadedmetadata", resolve, { once: true });
        video.addEventListener("error", reject, { once: true });
        video.load();
      });
    }
    video.currentTime = Math.min(2, video.duration || 2);
    await video.play();
    status.textContent = "正在播放真实三维镜头环绕。";
  } catch {
    status.textContent = "视频暂时无法自动开始，请使用播放器播放按钮或下载视频。";
  }
});

const dialog = document.getElementById("image-dialog");
let previousFocus = null;
document.querySelectorAll("[data-zoom]").forEach((button) => {
  button.addEventListener("click", () => {
    previousFocus = button;
    const image = document.getElementById("dialog-image");
    image.src = button.dataset.zoom;
    image.alt = button.querySelector("img").alt;
    document.getElementById("dialog-caption").textContent = button.dataset.caption;
    dialog.showModal();
  });
});
document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.addEventListener("close", () => previousFocus?.focus());

fetch("evidence.json")
  .then((response) => {
    if (!response.ok) throw new Error("Evidence unavailable");
    return response.json();
  })
  .then(({ render, checks, media }) => {
    document.getElementById("record-version").textContent = `Blender ${render.blender} / Cycles`;
    document.getElementById("record-resolution").textContent = render.resolution.join(" × ");
    document.getElementById("record-objects").textContent = render.objects.toLocaleString("zh-CN");
    document.getElementById("record-orbit").textContent = String(checks.orbit_frames);
    document.getElementById("record-time").textContent = `${render.build_seconds}s / ${render.render_seconds}s`;
    document.getElementById("record-images").textContent = String(render.external_image_dependencies.length);
    document.getElementById("verification-status").textContent = checks.checks_passed && media.duration_verified ? "已保存工程与视频检查通过" : "部分检查仍待确认";
  })
  .catch(() => {
    document.getElementById("verification-status").textContent = "记录未载入，可下载原始文件";
  });

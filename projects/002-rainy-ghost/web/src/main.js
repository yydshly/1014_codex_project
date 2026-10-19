import './style.css';
import { GhostScene } from './scene.js';
import { NightAudio } from './audio.js';
import { SoundUI } from './sound-ui.js';
import { FocusUI } from './focus-ui.js';
import { CompanionUI } from './companion-ui.js';

const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const errorPanel = document.querySelector('#error');
const announcement = document.querySelector('#announcement');
const note = document.querySelector('#scene-note');
const gestureHint = document.querySelector('#gesture-hint');
const pauseButton = document.querySelector('#pause-toggle');
const helpButton = document.querySelector('#help-toggle');
const helpPanel = document.querySelector('#help-panel');
const audio = new NightAudio();
let scene;
let focus;
let companion;
let sound;
let noteTimer;

function announce(message) { announcement.textContent = message; }

function showError(message) {
  document.querySelector('#error-detail').textContent = message;
  errorPanel.hidden = false;
  loading.classList.add('ready');
  announce(message);
}

function syncPause() {
  pauseButton.setAttribute('aria-pressed', String(scene.paused));
  pauseButton.setAttribute('aria-label', scene.paused ? '继续场景' : '暂停场景');
  document.querySelector('#pause-label').textContent = scene.paused ? '继续' : '暂停';
  document.querySelector('#pause-icon').innerHTML = scene.paused ? '<path d="m8 5 11 7-11 7V5Z"/>' : '<path d="M8 5v14M16 5v14"/>';
  canvas.dataset.paused = String(scene.paused);
  audio.setEnvironment({ paused: scene.paused });
}

function togglePause() {
  if (!scene) return;
  scene.setPaused(!scene.paused);
  syncPause();
  announce(scene.paused ? '雨夜已暂停。可以继续拖动小幽灵，或点击继续。' : '雨夜继续了。');
}

function syncRain() {
  document.querySelectorAll('[data-rain]').forEach(button => {
    const selected = Number(button.dataset.rain) === scene.rain;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  canvas.dataset.rain = String(scene.rain);
  audio.rain = scene.rain;
  audio.update();
}

function hideNote() {
  clearTimeout(noteTimer);
  note.classList.add('faded');
}

function handleSceneEvent(type, detail) {
  if (type === 'ready') {
    loading.classList.add('ready');
    setTimeout(() => { loading.hidden = true; }, 850);
    syncPause();
    syncRain();
    canvas.dataset.ready = 'true';
    canvas.dataset.light = 'true';
    canvas.dataset.ripples = '0';
    canvas.dataset.pets = '0';
    announce(detail.paused ? '场景已就绪，已根据减少动态效果偏好暂停。可拖动背景旋转视角，点击继续播放动画。' : '小幽灵已提灯等你。拖背景旋转视角，滚轮缩放，拖动幽灵或轻点水面。');
    noteTimer = setTimeout(hideNote, 14000);
    companion?.ready();
  } else if (type === 'interact') {
    hideNote();
    canvas.dataset.interaction = detail;
    if (detail === 'hem') announce('轻轻拉住衣角，松手后会回弹。');
  } else if (type === 'view') {
    canvas.dataset.viewAngle = detail.angle.toFixed(3);
    canvas.dataset.viewDistance = detail.distance.toFixed(3);
  } else if (type === 'hover') {
    gestureHint.hidden = detail.kind !== 'head' || !detail.mouse;
    if (!gestureHint.hidden) {
      const bounds = canvas.getBoundingClientRect();
      gestureHint.textContent = scene?.paused ? '继续后可以轻抚' : detail.active ? '轻轻抚摸中' : '在头顶轻轻来回抚摸';
      gestureHint.style.left = `${Math.max(90, Math.min(bounds.width - 90, detail.x - bounds.left))}px`;
      gestureHint.style.top = `${Math.max(12, Math.min(bounds.height - 100, detail.y - bounds.top + 28))}px`;
    }
  } else if (type === 'frame') {
    canvas.dataset.renderCount = String(detail.renders);
    canvas.dataset.clothUpdates = String(detail.cloth);
    canvas.dataset.reflectionUpdates = String(detail.reflections);
    canvas.dataset.idle = String(detail.idle);
    canvas.dataset.hemDrips = String(detail.drops);
    canvas.dataset.dripsLanded = String(detail.landed);
    canvas.dataset.dripsFalling = String(detail.falling);
  } else if (type === 'quality') {
    canvas.dataset.quality = detail.id;
    canvas.dataset.qualityMode = 'auto';
    canvas.dataset.qualityDevice = detail.mobile ? 'mobile' : 'desktop';
    canvas.dataset.qualityReason = detail.reason;
    canvas.dataset.qualityChanges = String(detail.changes);
    canvas.dataset.fps = detail.fps.toFixed(1);
    canvas.dataset.frameMs = detail.frameMs.toFixed(2);
    canvas.dataset.workMs = detail.workMs.toFixed(2);
    canvas.dataset.pixelRatio = detail.pixelRatio.toFixed(3);
    canvas.dataset.renderSize = `${detail.renderWidth}x${detail.renderHeight}`;
    canvas.dataset.reflectionSize = String(detail.reflectionSize);
    canvas.dataset.reflectionHz = String(detail.reflectionHz);
    canvas.dataset.activeRain = String(detail.rainCount);
    canvas.dataset.bloomScale = String(detail.bloomScale);
    canvas.dataset.waterDetail = String(detail.waterDetail);
    canvas.dataset.clothHz = String(detail.clothHz);
    canvas.dataset.collisionHz = String(detail.collisionHz);
  } else if (type === 'rain-reaction') {
    canvas.dataset.rainHits = String(detail.hits);
    canvas.dataset.wetness = detail.wetness.toFixed(3);
    canvas.dataset.wetCoverage = detail.coverage.toFixed(3);
    canvas.dataset.wetPeak = (detail.peak || 0).toFixed(3);
    canvas.dataset.wetCompiled = String(Boolean(detail.compiled));
    canvas.dataset.rainImpacts = String(detail.active);
    canvas.dataset.simulationTime = detail.time.toFixed(3);
    const feel = document.querySelector('#rain-feel');
    feel.textContent = Number(canvas.dataset.hemDrips) > 0 ? '水珠沿着衣摆滴落' : detail.coverage < 0.03 ? '雨点轻敲斗篷' : '湿斑沿着斗篷晕开';
  } else if (type === 'greet') {
    hideNote();
    companion?.greet();
  } else if (type === 'pet') {
    hideNote();
    canvas.dataset.pets = String(Number(canvas.dataset.pets || 0) + 1);
    companion?.pet(detail);
  } else if (type === 'companion-approach') {
    companion?.approach();
  } else if (type === 'companion-frame') {
    companion?.anchor(detail);
    canvas.dataset.companionAttention = detail.attention.toFixed(3);
    canvas.dataset.companionLift = detail.lift.toFixed(3);
    canvas.dataset.companionGesture = detail.kind;
    canvas.dataset.companionTuck = detail.tuck.toFixed(3);
    canvas.dataset.companionBlush = detail.blush.toFixed(3);
    canvas.dataset.companionSquint = detail.squint.toFixed(3);
    canvas.dataset.companionEyes = detail.eyes.toFixed(3);
    canvas.dataset.companionStrokeX = detail.strokeX.toFixed(3);
    canvas.dataset.companionStrokeY = detail.strokeY.toFixed(3);
    canvas.dataset.companionNuzzle = detail.nuzzle.toFixed(3);
    canvas.dataset.companionComfort = detail.comfort.toFixed(3);
    canvas.dataset.companionFarewell = detail.farewell.toFixed(3);
    canvas.dataset.companionFarewellX = detail.farewellX.toFixed(3);
    canvas.dataset.companionFarewellY = detail.farewellY.toFixed(3);
    audio.setPan((detail.x / canvas.clientWidth - 0.5) * 0.44);
  } else if (type === 'ripple') {
    if (detail.source === 'drip') return;
    hideNote();
    canvas.dataset.ripples = String(Number(canvas.dataset.ripples || 0) + 1);
  } else if (type === 'light') {
    canvas.dataset.light = String(detail);
    announce(detail ? '提灯重新亮起。' : '提灯已调暗。再轻点一下就会亮起来。');
    if (detail) sound?.respond('light', { manual: true });
  } else if (type === 'request-pause') togglePause();
  else if (type === 'focus-lights') {
    canvas.dataset.focusLights = String(detail.total);
    canvas.dataset.visibleFocusLights = String(detail.visible);
  }
  else if (type === 'reset') {
    scene.setPaused(matchMedia('(prefers-reduced-motion: reduce)').matches);
    syncPause();
    syncRain();
    canvas.dataset.light = 'true';
    canvas.dataset.ripples = '0';
    delete canvas.dataset.interaction;
    announce('视角与小幽灵的位置已重置。提灯已亮起，雨势恢复为夜雨。');
  } else if (type === 'error') showError(detail);
}

function setHelp(open, restoreFocus = false) {
  helpPanel.hidden = !open;
  helpButton.setAttribute('aria-expanded', String(open));
  if (open) { focus?.setOpen(false); companion?.setOpen(false); sound?.setOpen(false); document.querySelector('#help-close').focus(); }
  else if (restoreFocus) helpButton.focus();
}

document.querySelector('#retry').addEventListener('click', () => location.reload());
helpButton.addEventListener('click', () => setHelp(helpPanel.hidden));
document.querySelector('#help-close').addEventListener('click', () => setHelp(false, true));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !helpPanel.hidden) setHelp(false, true);
});
document.querySelector('#greet').addEventListener('click', () => scene?.greet());
document.querySelector('#pet-head').addEventListener('click', () => scene?.petHead());
document.querySelector('#reset').addEventListener('click', () => scene?.reset());
pauseButton.addEventListener('click', togglePause);
document.querySelectorAll('[data-rain]').forEach(button => button.addEventListener('click', () => {
  if (!scene) return;
  scene.rain = Number(button.dataset.rain);
  scene.invalidate();
  syncRain();
  announce(`雨势已切换为${button.textContent}。`);
}));

try {
  scene = new GhostScene(canvas, handleSceneEvent);
} catch (error) {
  console.error('雨夜场景启动失败：', error);
  showError('请使用支持 WebGL 2 的新版浏览器，并开启硬件加速后重新加载。');
}

sound = new SoundUI(audio, { announce, onOpen: () => { setHelp(false); focus?.setOpen(false); companion?.setOpen(false); hideNote(); },
  previewGesture: kind => scene?.reactToCompanion(kind === 'happy' ? 'greet' : kind === 'shy' ? 'nod' : kind, kind === 'shy' || kind === 'nod') });
focus = new FocusUI({ onLights: count => scene?.setFocusLights(count), announce,
  onOpen: () => { setHelp(false); companion?.setOpen(false); sound.setOpen(false); hideNote(); },
  restoreFocus: () => document.querySelector('#companion-toggle').focus() });
companion = new CompanionUI({ announce, react: (kind, familiar) => scene?.reactToCompanion(kind, familiar),
  onOpen: () => { setHelp(false); focus.setOpen(false); sound.setOpen(false); hideNote(); },
  onSound: (kind, detail) => sound.respond(kind, detail), onQuiet: quiet => sound.setQuiet(quiet) });

window.addEventListener('pagehide', event => {
  if (!event.persisted) { scene?.dispose(); audio.dispose(); }
});
if (import.meta.hot) import.meta.hot.dispose(() => { sound.dispose(); companion.dispose(); focus.dispose(); scene?.dispose(); audio.dispose(); clearTimeout(noteTimer); });

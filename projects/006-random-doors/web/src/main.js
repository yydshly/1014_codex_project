import './style.css';
import { createEncounter, Experience, validEncounter } from './experience.js';
import { SeasideAudio } from './audio.js';
import { SeasideScene } from './scene.js';

const $ = id => document.getElementById(id);
const root = $('experience');
const storageKey = 'random-doors:seaside-favorite:v1';
const audio = new SeasideAudio();
let scene, visit, phase = 'outside', openingTime = 0, globalTime = 0, lastFrame = performance.now();
let transitionBusy = false, messageUntil = 0, heardBoat = false, caughtOnce = false, restoredSeated = false;
let favorite = readFavorite();

function readFavorite() {
  try { const value = JSON.parse(localStorage.getItem(storageKey)); return validEncounter(value) ? value : null; } catch { return null; }
}
function freshSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
function announce(message, duration = 7) {
  $('moment').textContent = message;
  $('status').textContent = message;
  messageUntil = globalTime + duration;
}
function updateActions() {
  $('sit').setAttribute('aria-pressed', String(visit.seated));
  $('sit').querySelector('span').textContent = visit.seated ? '站起来看看' : '坐一会儿';
  $('catch').setAttribute('aria-pressed', String(visit.catching));
  $('catch').querySelector('span').textContent = visit.catching ? '雨落在手心' : '按住接雨';
  root.dataset.catching = String(visit.catching);
  root.dataset.seated = String(visit.seated);
  root.dataset.weather = visit.weather.id;
  const isFavorite = favorite?.seed === visit.encounter.seed && favorite?.weatherId === visit.weather.id;
  $('favorite').setAttribute('aria-pressed', String(isFavorite));
  $('favorite').textContent = isFavorite ? '这次遇见已留住' : '留住这次遇见';
  $('return-favorite').hidden = !favorite;
}
function setCatching(active) {
  if (!visit?.inside) return;
  visit.catching = active;
  updateActions();
  if (active) announce(visit.weather.rain ? '伸出手，接住一点檐下的雨。' : '雨停了，屋檐还留着一点雨水。', 4);
  else announce('雨重新落回了水盘里。', 4);
}
function toggleSit() {
  if (!visit.inside) return;
  visit.seated = !visit.seated;
  updateActions();
  announce(visit.seated ? '坐下来，慢慢看海。' : '站起来，换一个角度看看。');
}
function showSettings(open) {
  $('settings').hidden = !open;
  $('settings-toggle').setAttribute('aria-expanded', String(open));
  if (open) $('settings-close').focus();
}
function enter() {
  if (phase !== 'outside' || !scene) return;
  phase = 'entering'; root.dataset.phase = phase; openingTime = 0;
  $('invitation').classList.add('leaving');
  showSettings(false);
  if (audio.enabled) audio.enable();
  $('status').textContent = '门打开了，正在走进海边候车亭。';
}
function inside() {
  phase = 'inside'; root.dataset.phase = phase;
  visit.enter(); visit.seated = restoredSeated;
  $('invitation').hidden = true;
  $('inside-ui').hidden = false;
  $('boat-now').disabled = false;
  $('weather-description').textContent = `${visit.weather.name} / ${visit.weather.description}`;
  updateActions();
  $('status').textContent = `你来到海边候车亭。这次是${visit.weather.name}。可以坐下、接雨或看海。`;
  $('world').focus({ preventScroll: true });
}
async function nextEncounter(saved = null) {
  if (transitionBusy) return;
  transitionBusy = true;
  if (visit) visit.catching = false;
  showSettings(false);
  $('transition').classList.add('active');
  await new Promise(resolve => setTimeout(resolve, 700));
  const encounter = saved ?? createEncounter({ previousWeather: visit.weather.id, requestedWeather: $('weather-choice').value, seed: freshSeed() });
  visit.reset(encounter);
  restoredSeated = !!saved?.seated;
  scene.setWeather(visit.weather);
  phase = 'outside'; root.dataset.phase = phase;
  root.dataset.boatVisible = 'false'; root.dataset.waterContact = 'false';
  caughtOnce = false; heardBoat = false; messageUntil = 0;
  $('moment').textContent = '这里，暂时不用赶路。';
  $('invitation').hidden = false; $('invitation').classList.remove('leaving');
  $('inside-ui').hidden = true; $('boat-now').disabled = true;
  $('boat-now').textContent = '让船灯早些出现';
  updateActions();
  await new Promise(resolve => setTimeout(resolve, 260));
  $('transition').classList.remove('active');
  transitionBusy = false;
  if (saved) enter(); else $('enter').focus({ preventScroll: true });
}

function bindCatch(button) {
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); button.focus({ preventScroll: true });
    button.setPointerCapture(event.pointerId); setCatching(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => {
    if (visit?.catching) setCatching(false);
  });
  button.addEventListener('click', event => { if (event.detail === 0) setCatching(!visit.catching); });
  button.addEventListener('contextmenu', event => event.preventDefault());
}

$('enter').addEventListener('click', enter);
$('sit').addEventListener('click', toggleSit);
$('next').addEventListener('click', () => nextEncounter());
$('settings-next').addEventListener('click', () => nextEncounter());
$('return-favorite').addEventListener('click', () => favorite && nextEncounter(favorite));
$('settings-toggle').addEventListener('click', () => showSettings($('settings').hidden));
$('settings-close').addEventListener('click', () => { showSettings(false); $('settings-toggle').focus(); });
$('boat-now').addEventListener('click', () => {
  visit.inviteBoat(); showSettings(false);
  $('boat-now').textContent = '船灯已经在海上了';
  $('status').textContent = '远处船灯正从海雾中出现。';
});
$('favorite').addEventListener('click', () => {
  try {
    favorite = { ...visit.snapshot(), seated: visit.seated };
    localStorage.setItem(storageKey, JSON.stringify(favorite));
    updateActions(); announce('这片海留住了。下次，还可以回到这里。');
  } catch { announce('这次没能保存。你仍然可以继续在这里待一会儿。'); }
});
$('sound').addEventListener('click', async () => {
  const enabled = audio.enabled ? (audio.setEnabled(false), false) : await audio.enable();
  $('sound').setAttribute('aria-pressed', String(enabled)); $('sound').textContent = enabled ? '声音 开' : '声音 关';
  if (!enabled && !audio.context) $('status').textContent = '声音暂时无法开启，画面互动仍可继续。';
});
$('volume').addEventListener('input', event => { audio.volume = Number(event.target.value) / 100; $('volume-value').textContent = `${event.target.value}%`; });
bindCatch($('catch')); bindCatch($('rain-target'));

let dragging = false, previousX = 0, previousY = 0;
$('world').addEventListener('pointerdown', event => {
  dragging = true; previousX = event.clientX; previousY = event.clientY; $('world').setPointerCapture(event.pointerId);
});
$('world').addEventListener('pointermove', event => {
  if (dragging && visit.inside) scene.drag(event.clientX - previousX, event.clientY - previousY);
  previousX = event.clientX; previousY = event.clientY;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('world').addEventListener(type, () => { dragging = false; });
window.addEventListener('keydown', event => {
  if (!visit?.inside || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.key === 'Escape') { showSettings(false); setCatching(false); return; }
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); if (!event.repeat) toggleSit(); }
  if (event.code === 'KeyR') { event.preventDefault(); if (!event.repeat) setCatching(true); }
});
window.addEventListener('keyup', event => { if (event.code === 'KeyR' && visit?.catching) setCatching(false); });
window.addEventListener('blur', () => { if (visit?.catching) setCatching(false); dragging = false; });
window.addEventListener('resize', () => scene?.resize());
document.addEventListener('visibilitychange', () => { lastFrame = performance.now(); if (document.hidden && visit?.catching) setCatching(false); });

function frame(now) {
  const dt = document.hidden ? 0 : Math.min((now - lastFrame) / 1000, 0.25); lastFrame = now;
  globalTime += dt;
  if (phase === 'entering') { openingTime += dt; if (openingTime > 2.5) inside(); }
  visit.advance(dt);
  const target = scene.update(dt, globalTime, visit, phase !== 'outside');
  const rainTarget = $('rain-target');
  rainTarget.style.left = `${target.x}px`; rainTarget.style.top = `${target.y + 33}px`;
  rainTarget.hidden = !target.onScreen;
  rainTarget.style.opacity = visit.catching ? '0' : '';
  const boatVisible = String(visit.boatVisible);
  if (root.dataset.boatVisible !== boatVisible) root.dataset.boatVisible = boatVisible;
  if (visit.boatVisible && !heardBoat) { heardBoat = true; announce('海雾里，有一盏灯。', 10); }
  if (globalTime > messageUntil && visit.inside) $('moment').textContent = visit.seated ? '坐在这里，等海慢慢变。' : '这里，暂时不用赶路。';
  audio.update(globalTime, visit.weather, visit.inside, visit.seated, !document.hidden);
  requestAnimationFrame(frame);
}

try {
  visit = new Experience(createEncounter({ seed: freshSeed() }));
  scene = new SeasideScene($('world'), visit.weather, onHand => {
    if (!visit.inside) return;
    audio.drop(onHand);
    if (onHand) {
      visit.contactCount++;
      root.dataset.waterContact = 'true';
      if (!caughtOnce) { caughtOnce = true; announce('雨落在手心里，轻轻散开。', 7); }
    }
  });
  updateActions();
  $('enter').textContent = '推门，去看海'; $('enter').disabled = false;
  requestAnimationFrame(frame);
} catch (error) {
  console.error(error);
  $('error').hidden = false;
  $('error-message').textContent = '画面需要浏览器支持 WebGL 2。请开启浏览器图形加速后重新打开，或换一个支持 3D 的浏览器。';
}

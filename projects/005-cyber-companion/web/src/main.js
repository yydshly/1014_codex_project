import './style.css';
import { Avatar } from './avatar.js';
import { SpeechPlayer } from './speech.js';
import { emotionFor, safeHistory, splitSpeech } from '../shared/dialogue.js';

const $ = id => document.getElementById(id);
const base = import.meta.env.BASE_URL;
const endpoint = name => `${base}api/companion/${name}`;
const paths = {
  sliders: '<path d="M4 7h16M4 17h16M8 4v6m8 4v6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  new: '<path d="M20 11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8m3-2 6 6-10 10H6v-6z"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
  volume: '<path d="M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M11 4 6 8H3v8h3l5 4zM16 9l6 6m0-6-6 6"/>',
  arrow: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
};
function icon(name) { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`; }
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });

const STORAGE = 'xiaoxi-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {}; } catch {}
const settings = {
  style: ['gentle', 'lively', 'calm'].includes(saved.style) ? saved.style : 'gentle',
  provider: ['minimax','local'].includes(saved.provider) ? saved.provider : 'minimax',
  voice: ['minimax','browser'].includes(saved.voice) ? saved.voice : 'minimax',
  memory: typeof saved.memory === 'string' ? saved.memory.slice(0,400) : '',
  scene: ['morning','dusk','night'].includes(saved.scene) ? saved.scene : 'morning',
};
let messages = Array.isArray(saved.messages) ? saved.messages.filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string').slice(-60) : [];
let config = null, busy = false, speaking = false, listening = false, controller = null, turn = 0;
let view = 'chat', started = 0, audioMeasured = false, currentAudioMessage = null, replaying = false, avatar = new Avatar();
let liveRunning = false, liveQueue = [], liveCounter = 0, toastTimer, stopping = false;
const avatarContainer = $('avatar-container');

function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify({ ...settings, messages: messages.filter(m => !m.pending).slice(-60) })); }
  catch { notice('浏览器存储已满，本次聊天无法保留。'); }
}
function notice(text, isError = true) {
  clearTimeout(toastTimer); $('notice').textContent = text; $('notice').hidden = !text;
  $('notice').classList.toggle('is-info', !isError);
  if (text && !isError) toastTimer = setTimeout(() => { $('notice').hidden = true; }, 5000);
}
function state() {
  const status = listening ? '正在听你说' : speaking ? '正在说话' : busy ? '想一想，马上回你' : player.pending ? '正在准备声音' : '等你开口';
  $('stage-status').innerHTML = `<i></i>${status}`;
  $('stage-status').classList.toggle('is-active', busy || speaking || listening);
  $('stage').classList.toggle('is-speaking', speaking);
  $('stop-button').disabled = !(busy || player.pending || speaking || listening);
  $('mic-button').classList.toggle('is-recording', listening);
  $('input-hint').textContent = listening ? '正在听，点麦克风结束' : busy ? '可继续输入，发送会打断' : 'Enter 发送';
}
function renderMessage(message) {
  const row = document.createElement('article'); row.className = `message message-${message.role}`;
  if (message.role === 'assistant') {
    const label = document.createElement('div'); label.className = 'message-label'; label.textContent = '小汐'; row.append(label);
  }
  const bubble = document.createElement('div'); bubble.className = 'message-bubble'; bubble.textContent = message.content;
  if (message.pending && !message.content) { bubble.textContent = '· · ·'; bubble.classList.add('typing'); }
  row.append(bubble);
  const footer = document.createElement('div'); footer.className = 'message-meta';
  if (message.interrupted) footer.textContent = '已打断';
  else if (message.failed) footer.textContent = '回复未完成';
  else if (message.metrics?.firstTokenMs != null) footer.textContent = `首字 ${(message.metrics.firstTokenMs / 1000).toFixed(1)}s${message.metrics.audioMs ? ` · 开口 ${(message.metrics.audioMs / 1000).toFixed(1)}s` : ''}`;
  else if (message.welcome) footer.textContent = '初次见面';
  if (message.role === 'assistant' && !message.pending && !message.failed && !message.welcome && message.content) {
    const replay = document.createElement('button'); replay.className = 'replay-button'; replay.textContent = '重听'; replay.setAttribute('aria-label', '重听这条回复');
    replay.addEventListener('click', async () => {
      stop(); notice(''); audioMeasured = true; currentAudioMessage = message; replaying = true;
      try { await player.unlock(); $('subtitle').textContent = message.content; avatar.setEmotion(emotionFor(message.content)); splitSpeech(message.content,true).chunks.forEach(chunk => player.enqueue(chunk,settings.voice)); }
      catch { notice('声音未能启动，请检查浏览器播放权限。'); }
    });
    footer.append(replay);
  }
  row.append(footer);
  return { row, bubble, footer };
}
function renderMessages() {
  $('messages').replaceChildren();
  const all = messages.length ? messages : [{ role: 'assistant', content: '嗨，我是小汐。\n今天过得怎么样？可以从一件很小的事聊起。', welcome: true }];
  all.forEach(message => $('messages').append(renderMessage(message).row));
  $('messages').scrollTop = $('messages').scrollHeight;
  $('suggestions').hidden = messages.some(m => m.role === 'user');
}
function updateConnection() {
  const available = settings.provider === 'minimax' ? config?.cloudConfigured : config?.localOnline;
  $('connection-light').classList.toggle('connected', Boolean(available));
  $('connection-text').textContent = available ? '已连接 · 真实模型对话' : config ? '模型尚未连接' : '正在连接模型…';
  $('model-label').textContent = settings.provider === 'minimax' ? (config?.textModel || 'MiniMax') : (config?.localModel || '本地模型');
  $('provider-description').textContent = settings.provider === 'local'
    ? '连接本机 .env.local 中配置的 llama.cpp / Ollama 兼容服务。尚未启动时会明确报错。'
    : config?.cloudConfigured ? '已读取服务端 MiniMax 配置，密钥不会发送到浏览器。' : '需要在服务端 .env.local 配置 MiniMax 密钥或配置文件路径。';
}

const player = new SpeechPlayer({
  endpoint: endpoint('speech'),
  onState: (active, kind) => {
    speaking = active && kind === 'playing'; state();
    if (!active && !busy && !stopping) advanceLive();
  },
  onLevel: level => { avatar.mouth = level; $('stage').style.setProperty('--voice-level', level); },
  onError: text => notice(text),
  onFirstAudio: () => {
    if (!audioMeasured) {
      audioMeasured = true;
      const message = currentAudioMessage;
      if (message) { message.metrics = { ...message.metrics, audioMs: Math.round(performance.now() - started) }; renderMessages(); persist(); }
    }
  },
});

function stop({ pauseLive = true } = {}) {
  stopping = true;
  if (pauseLive) { liveRunning = false; renderQueue(); }
  turn++; controller?.abort(); controller = null;
  const partial = messages.findLast(m => m.pending) || ((!replaying && (speaking || player.pending)) ? currentAudioMessage : null);
  if (partial) { partial.pending = false; partial.interrupted = true; }
  busy = false; player.stop();
  if (listening) recognition?.stop(); listening = false;
  avatar.mouth = 0; state(); renderMessages(); persist();
  replaying = false;
  stopping = false;
}

async function send(text, { fromLive = false } = {}) {
  text = text.trim();
  if (!text) return;
  if (text.length > 1200) return notice('一次最多发送 1200 字。');
  stop({ pauseLive: !fromLive });
  notice(''); started = performance.now(); audioMeasured = false;
  try { await player.unlock(); } catch { notice('声音尚未启用，你可以继续文字聊天。', false); }
  const requestTurn = ++turn;
  const user = { role: 'user', content: text, time: Date.now() }; messages.push(user);
  const history = safeHistory(messages);
  const assistant = { role: 'assistant', content: '', pending: true, time: Date.now(), metrics: {} }; messages.push(assistant);
  currentAudioMessage = assistant;
  busy = true; state(); renderMessages(); persist();
  $('chat-input').value = '';
  controller = new AbortController(); let tail = '', completed = false, firstText = true;
  try {
    const response = await fetch(endpoint('chat'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, provider: settings.provider, style: settings.style, memory: settings.memory }), signal: controller.signal });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error || `请求失败 ${response.status}`); }
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    const consume = event => {
      if (event.type === 'error') throw new Error(event.message);
      if (event.type === 'delta') {
        if (firstText) { firstText = false; assistant.metrics.firstTokenMs = Math.round(performance.now() - started); }
        assistant.content += event.text; tail += event.text;
        $('subtitle').textContent = assistant.content;
        avatar.setEmotion(emotionFor(assistant.content));
        const split = splitSpeech(tail); tail = split.tail;
        split.chunks.forEach(chunk => player.enqueue(chunk, settings.voice));
        renderMessages();
      }
      if (event.type === 'done') {
        completed = true; Object.assign(assistant.metrics, { firstTokenMs: event.firstTokenMs, totalMs: event.totalMs });
        const split = splitSpeech(tail, true); tail = '';
        split.chunks.forEach(chunk => player.enqueue(chunk, settings.voice));
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (requestTurn !== turn) { await reader.cancel(); return; }
      buffer += decoder.decode(value, { stream: !done });
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0,index); buffer = buffer.slice(index+1); if (line.trim()) consume(JSON.parse(line)); }
      if (done) break;
    }
    if (buffer.trim()) consume(JSON.parse(buffer));
    if (!completed) throw new Error('连接提前结束，回复未完成。');
  } catch (error) {
    if (requestTurn !== turn) return;
    if (error.name !== 'AbortError') {
      assistant.failed = true; liveRunning = false; renderQueue(); player.stop(); notice(error.message);
      if (!assistant.content) assistant.content = '这次没有连上，请检查提示后再试一次。';
    }
  } finally {
    if (requestTurn === turn) {
      assistant.pending = false; busy = false; controller = null;
      messages = messages.slice(-60); renderMessages(); persist(); state();
      if (!player.pending) advanceLive();
    }
  }
}

$('chat-form').addEventListener('submit', event => { event.preventDefault(); send($('chat-input').value); });
$('chat-input').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send($('chat-input').value); } });
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => send(button.dataset.prompt)));
$('stop-button').addEventListener('click', () => stop());
window.addEventListener('keydown', event => { if (event.key === 'Escape') { stop(); document.body.classList.remove('stage-focus'); } });
$('mute-button').addEventListener('click', async () => {
  player.muted = !player.muted;
  if (player.muted) player.stop(); else await player.unlock();
  $('mute-button').innerHTML = icon(player.muted ? 'muted' : 'volume');
  $('mute-button').setAttribute('aria-label', player.muted ? '开启声音' : '关闭声音');
  $('mute-button').setAttribute('aria-pressed', String(player.muted));
  $('mute-button').title = player.muted ? '开启声音' : '关闭声音';
});

function newChat() { stop(); messages = []; persist(); renderMessages(); $('subtitle').textContent = '新的一页。今天想从什么聊起？'; avatar.setEmotion('neutral'); }
$('new-chat').addEventListener('click', newChat);
$('clear-history').addEventListener('click', () => { newChat(); notice('聊天记录已清空。', false); });
$('settings-open').addEventListener('click', () => {
  $('personality').value = settings.style; $('provider').value = settings.provider;
  $('voice-provider').value = settings.voice; $('memory').value = settings.memory; updateConnection(); $('settings').showModal();
});
$('save-settings').addEventListener('click', () => {
  stop(); settings.style = $('personality').value; settings.provider = $('provider').value;
  settings.voice = $('voice-provider').value; settings.memory = $('memory').value.trim();
  persist(); updateConnection(); $('settings').close(); notice('设置已保存，下次回复就会生效。', false);
});
function changeScene(scene) {
  settings.scene = scene; $('stage').dataset.scene = scene;
  $('scene-name').textContent = { morning: '晨光', dusk: '暮色', night: '月夜' }[scene];
  document.querySelectorAll('[data-scene]').forEach(el => { const selected = el.dataset.scene === scene; el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', String(selected)); });
  persist();
}
document.querySelectorAll('[data-scene]').forEach(el => el.addEventListener('click', () => changeScene(el.dataset.scene)));
$('stage-only').addEventListener('click', () => { document.body.classList.toggle('stage-focus'); $('stage-only').querySelector('span:last-child').textContent = document.body.classList.contains('stage-focus') ? '返回对话' : '纯净画面'; });

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (Recognition) {
  recognition = new Recognition(); recognition.lang = 'zh-CN'; recognition.interimResults = true; recognition.continuous = false;
  recognition.onresult = event => {
    const result = Array.from(event.results).map(r => r[0].transcript).join(''); $('chat-input').value = result;
    if (event.results[event.results.length-1].isFinal && result.trim()) { recognition.stop(); listening = false; send(result); }
  };
  recognition.onend = () => { listening = false; state(); };
  recognition.onerror = event => {
    listening = false; state();
    notice(event.error === 'not-allowed' ? '麦克风未获授权，可以使用文字输入。' : '浏览器语音识别不可用，请使用文字输入。');
  };
} else {
  $('mic-button').disabled = true; $('mic-button').title = '此浏览器不支持语音识别，请用 Chrome 或 Edge，或使用文字输入';
  $('mic-button').setAttribute('aria-label', $('mic-button').title);
}
$('mic-button').addEventListener('click', () => {
  if (listening) { recognition?.stop(); return; }
  stop(); notice('');
  try { recognition?.start(); listening = true; state(); } catch { notice('麦克风暂时无法启动。'); }
});

function renderQueue() {
  $('live-queue-count').textContent = `${liveQueue.length} 条等待回应`;
  $('live-toggle').textContent = liveRunning ? '暂停回应' : '开始回应';
  $('live-queue').replaceChildren();
  liveQueue.forEach(item => { const el = document.createElement('div'); el.className = 'queue-item'; const name = document.createElement('b'); name.textContent = item.name; const text = document.createElement('span'); text.textContent = item.text; el.append(name,text); $('live-queue').append(el); });
}
const sampleComments = [
  { name: '路过的云', text: '小汐你好！今天第一次来看你。' },
  { name: '橘子汽水', text: '如果周末只能做一件小事，你想做什么？' },
  { name: '晚风', text: '刚下班，有点累，给我打打气吧。' },
  { name: '猫猫观察员', text: '你喜欢猫还是狗呀？' },
  { name: '一个小问号', text: '给我们讲个冷笑话！' },
  { name: '月亮邮递员', text: '用一句话给今天收个尾吧。' },
];
function advanceLive() {
  if (!liveRunning || busy || player.pending || speaking || view !== 'live') return;
  if (!liveQueue.length) { liveRunning = false; renderQueue(); return; }
  const comment = liveQueue.shift(); renderQueue();
  send(`观众「${comment.name}」发来弹幕：${comment.text}`, { fromLive: true });
}
$('add-sample').addEventListener('click', () => {
  const remaining = Math.max(0,12-liveQueue.length);
  for (let i=0; i<Math.min(3,remaining); i++) liveQueue.push({ ...sampleComments[liveCounter++ % sampleComments.length] });
  renderQueue(); advanceLive();
});
$('live-toggle').addEventListener('click', async () => { await player.unlock(); liveRunning = !liveRunning; renderQueue(); if (liveRunning) advanceLive(); });
document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => {
  view = el.dataset.view;
  if (view !== 'live') { liveRunning = false; renderQueue(); }
  document.querySelectorAll('[data-view]').forEach(button => { button.classList.toggle('active', button.dataset.view === view); button.setAttribute('aria-pressed', String(button.dataset.view === view)); });
  $('live-controls').hidden = view !== 'live';
  $('panel-title').textContent = view === 'live' ? '一起试试，弹幕互动' : '在这里，聊一会儿';
  $('panel-description').textContent = view === 'live' ? '放入模拟弹幕，看小汐接住每个话题。' : '生活的碎片，也值得被认真听见。';
}));

renderMessages(); changeScene(settings.scene); renderQueue(); state();
fetch(endpoint('config')).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => {
  config = data;
  if (!saved.provider && !data.cloudConfigured && data.localOnline) settings.provider = 'local';
  if (!saved.voice && !data.speechConfigured) settings.voice = 'browser';
  updateConnection();
}).catch(() => { config = {}; updateConnection(); notice('未连接本地服务，请通过 npm run dev 或启动脚本打开。'); });
avatar.mount(avatarContainer).then(() => { $('avatar-loading').hidden = true; }).catch(error => {
  console.error('Avatar load failed', error); $('avatar-loading').textContent = '角色加载失败，请检查素材后刷新。';
  notice('Live2D 素材尚未就绪，可运行 npm run assets 后刷新。');
});

window.addEventListener('pagehide', () => { controller?.abort(); player.stop(); recognition?.abort(); persist(); });

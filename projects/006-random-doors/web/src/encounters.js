import { seededRandom } from './experience.js';
import { VARIATIONS, variation, postChoices, bellChoices, greenhouseLayout } from './variations.js';
export { POST_CHOICES, BELL_CHOICES } from './variations.js';

export const KINDS = { all: '全部交给偶然', quiet: '想安静一会儿', story: '想遇见一个人', challenge: '想动动脑筋' };
export const KIND_NAMES = { quiet: '安静停留', story: '参与故事', challenge: '完成小挑战' };
export const ENCOUNTERS = Object.freeze([
  { id: 'seaside', kind: 'quiet', title: '海边候车亭', cue: '门缝里，有雨水落进浅盘的声音。', description: '檐外落着细雨。这里暂时没有要等的车，只有海。', invitation: '下一扇门，也许会有人正在等一句回应。' },
  { id: 'rooftop', kind: 'quiet', title: '风过的天台', cue: '门的另一边，什么东西轻轻碰响了一下。', description: '楼顶晾着几张空白纸签。风铃还没有响，云正在经过。', invitation: '有的门适合停下，有的门会邀请你做一点什么。' },
  { id: 'postoffice', kind: 'story', title: '打烊前的邮局', cue: '里面有人翻动一张纸，又迟迟没有落笔。', description: '最后一盏柜台灯还亮着。第一次离乡的旅人，手里有一张没写完的明信片。', invitation: '这封信留下了你的回应。下一扇门，会是谁的片刻生活？' },
  { id: 'repair', kind: 'story', title: '老街修补铺', cue: '门后传来两声不太一样的铃响。', description: '店主修好了自己的木鸟，却拿不定主意，该为它装回哪一枚铃。', invitation: '这只木鸟记住了今天的声音。下一次，会遇见什么小事？' },
  { id: 'greenhouse', kind: 'challenge', title: '漂浮温室', cue: '有一束光，从门底下绕了出来。', description: '温室浮在云上。一束光落向空处，合着叶片的植物正在等它。', invitation: '这次你改变了一束光的去向。下一扇门会带来别的发现。' },
  { id: 'observatory', kind: 'challenge', title: '旧星图观测台', cue: '门把手微凉，里面有齿轮转过一格的轻响。', description: '三道星环停在不同的位置。让亮星落回同一圈上的空星，今夜的星图就会连起来。', invitation: '眼前的星图已经不同了。再开一扇，看看别的世界在等什么。' },
]);
export const encounterById = id => ENCOUNTERS.find(item => item.id === id);
const DIRECTIONS = ['上', '右', '下', '左'];
export const directionName = index => DIRECTIONS[index];
export const STORAGE_KEY = 'random-doors:journey:v1';

export function initialVisit(id, seed, uid, variationId = VARIATIONS[id][0].id) {
  const random = seededRandom(seed);
  const profile = VARIATIONS[id].find(v => v.id === variationId);
  if (!profile) throw new Error('无法读取这次遇见的内容。');
  const state = id === 'seaside' ? { seated: false, catching: false, touched: false, eventSeen: false }
    : id === 'rooftop' ? { hung: false, note: '', touched: false, eventSeen: false, eventRead: false }
    : id === 'postoffice' ? { choice: '', delivered: false, followup: false }
    : id === 'repair' ? { heard: false, choice: '', wound: false, followup: false }
    : id === 'greenhouse' ? { flipped: variationId === 'east', layoutId: variationId, mirrors: [0, 0], solved: false, hints: 0 }
    : { targets: [0, 1, 2].map(() => Math.floor(random() * 4)), rings: [], solved: false, hints: 0 };
  if (id === 'observatory') state.rings = state.targets.map(target => (target + 1 + Math.floor(random() * 3)) % 4);
  return { uid, id, seed, variationId, state, elapsed: 0, eventAt: 10 + Math.floor(random() * 7), bookmarked: false, returns: 0 };
}

// Every layout follows the same two reflection rules.
export function traceLight(state) {
  const layout = greenhouseLayout(state);
  const { mirrors, start, target } = layout;
  const slashes = layout.slashes.map((slash,i) => state.mirrors[i] === 1 ? slash : !slash);
  let x = start.x, y = start.y, [dx, dy] = layout.direction;
  const path = [{ x, y }];
  let hit = -1;
  for (let step = 0; step < 24; step++) {
    x += dx; y += dy;
    if (x < 0 || x > 4 || y < 0 || y > 4) { path.push({ x, y }); break; }
    path.push({ x, y });
    if (x === target.x && y === target.y) return { path, mirrors, start, target, slashes, solved: true, hit };
    const index = mirrors.findIndex(mirror => mirror.x === x && mirror.y === y);
    if (index >= 0) {
      hit = index;
      const slash = slashes[index];
      [dx, dy] = slash ? [-dy, -dx] : [dy, dx];
    }
  }
  return { path, mirrors, start, target, slashes, solved: false, hit };
}

function validVisit(visit) {
  if (!visit || !encounterById(visit.id) || typeof visit.uid !== 'string' || visit.uid.length > 100
    || !Number.isInteger(visit.seed) || visit.seed < 0 || visit.seed > 0xffffffff
    || !Number.isFinite(visit.elapsed) || visit.elapsed < 0 || !Number.isFinite(visit.eventAt)
    || visit.eventAt < 10 || visit.eventAt > 16 || !Number.isInteger(visit.returns) || visit.returns < 0
    || typeof visit.bookmarked !== 'boolean' || !visit.state || !VARIATIONS[visit.id].some(v=>v.id===visit.variationId)) return false;
  const s = visit.state, bools = names => names.every(name => typeof s[name] === 'boolean');
  if (visit.id === 'seaside') return bools(['seated', 'catching', 'touched', 'eventSeen']);
  if (visit.id === 'rooftop') return bools(['hung', 'touched', 'eventSeen', 'eventRead']) && typeof s.note === 'string' && s.note.length <= 24 && (!s.eventRead || (visit.variationId==='plane' && s.eventSeen));
  if (visit.id === 'postoffice') return ['', ...Object.keys(postChoices(visit))].includes(s.choice) && bools(['delivered', 'followup']) && (!s.delivered || !!s.choice) && (!s.followup || s.delivered);
  if (visit.id === 'repair') return ['', ...Object.keys(bellChoices(visit))].includes(s.choice) && bools(['heard', 'wound', 'followup']) && (!s.wound || !!s.choice) && (!s.followup || s.wound);
  if (visit.id === 'greenhouse') return bools(['flipped', 'solved']) && s.layoutId === visit.variationId && Array.isArray(s.mirrors) && s.mirrors.length === 2 && s.mirrors.every(v => v === 0 || v === 1) && Number.isInteger(s.hints) && s.hints >= 0 && s.hints <= 2 && s.solved === traceLight(s).solved;
  return bools(['solved']) && ['rings', 'targets'].every(key => Array.isArray(s[key]) && s[key].length === 3 && s[key].every(v => Number.isInteger(v) && v >= 0 && v < 4)) && Number.isInteger(s.hints) && s.hints >= 0 && s.hints <= 2 && s.solved === s.rings.every((v, i) => v === s.targets[i]);
}

export function restoreJourney(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.visits)) return null;
    // Upgrade 0.3 records in place: old visits keep their original content and choices.
    for (const visit of [...data.visits, data.pending].filter(Boolean)) {
      if (!VARIATIONS[visit.id] || !visit.state) return null;
      visit.variationId ??= VARIATIONS[visit.id][visit.id==='greenhouse'&&visit.state.flipped?1:0].id;
      if (visit.id==='greenhouse') visit.state.layoutId ??= visit.variationId;
      if (visit.id==='rooftop') visit.state.eventRead ??= false;
    }
    data.variantBags ??= {};
    data.doorScene ??= null;
    if (typeof data.variantBags !== 'object' || data.variantBags === null || Array.isArray(data.variantBags)
      || !Object.entries(data.variantBags).every(([id,bag])=>VARIATIONS[id]&&Array.isArray(bag)&&new Set(bag).size===bag.length&&bag.every(key=>VARIATIONS[id].some(v=>v.id===key)))
      || (data.doorScene!==null && !encounterById(data.doorScene))) return null;
    if (data?.version !== 1 || !Object.hasOwn(KINDS, data.scope) || !['door', 'inside'].includes(data.phase)
      || !Array.isArray(data.remaining) || new Set(data.remaining).size !== data.remaining.length || !data.remaining.every(encounterById)
      || !Array.isArray(data.visits) || !data.visits.every(validVisit) || new Set(data.visits.map(v => v.uid)).size !== data.visits.length
      || !Number.isInteger(data.opened) || data.opened < data.visits.length
      || (data.lastId !== '' && !encounterById(data.lastId))
      || (data.phase === 'inside' && !data.visits.some(v => v.uid === data.currentUid))
      || (data.pending !== null && !validVisit(data.pending))
      || (data.phase === 'door' && !validVisit(data.pending))) return null;
    for (const visit of data.visits) if (visit.id === 'seaside') visit.state.catching = false;
    return data;
  } catch { return null; }
}

export class Journey {
  constructor(data = null, random = Math.random, uid = () => crypto.randomUUID()) {
    this.random = random; this.uid = uid;
    this.data = data ?? { version: 1, scope: 'all', phase: 'door', remaining: ENCOUNTERS.map(e => e.id), variantBags:{}, doorScene:null, visits: [], pending: null, currentUid: null, lastId: '', opened: 0 };
    if (this.data.phase === 'door' && !this.data.pending) this.prepare();
  }
  get current() { return this.data.visits.find(visit => visit.uid === this.data.currentUid); }
  variationPool(id) {
    const keys=VARIATIONS[id].map(v=>v.id);
    if (!this.data.variantBags[id]) {
      const used=this.data.visits.filter(v=>v.id===id).map(v=>v.variationId);
      this.data.variantBags[id]=keys.filter(key=>!used.includes(key));
    }
    if (!this.data.variantBags[id].length) this.data.variantBags[id]=keys;
    return this.data.variantBags[id];
  }
  prepare() {
    const allowed = ENCOUNTERS.filter(e => this.data.scope === 'all' || e.kind === this.data.scope);
    let pool = allowed.filter(e => this.data.remaining.includes(e.id));
    if (!pool.length) {
      this.data.remaining = [...new Set([...this.data.remaining, ...allowed.map(e => e.id)])];
      pool = allowed;
    }
    const notPrevious = pool.filter(e => e.id !== this.data.lastId);
    if (notPrevious.length) pool = notPrevious;
    const lastKind = encounterById(this.data.lastId)?.kind;
    const otherKind = pool.filter(e => e.kind !== lastKind);
    if (this.data.scope === 'all' && otherKind.length) pool = otherKind;
    const picked = encounterById(this.data.doorScene) ?? pool[Math.floor(this.random() * pool.length)];
    let variants=this.variationPool(picked.id);
    const previous=this.data.visits.filter(v=>v.id===picked.id).at(-1)?.variationId;
    const different=variants.filter(key=>key!==previous);
    if (different.length) variants=different;
    const key=variants[Math.floor(this.random()*variants.length)];
    this.data.pending = initialVisit(picked.id, Math.floor(this.random() * 0x100000000), this.uid(), key);
  }
  setScope(scope) {
    if (this.data.phase !== 'door' || !Object.hasOwn(KINDS, scope) || scope === this.data.scope) return;
    this.data.scope = scope; this.data.doorScene=null; this.prepare();
  }
  open() {
    if (this.data.phase !== 'door') return this.current;
    const visit = this.data.pending;
    const variants=this.variationPool(visit.id);
    this.data.variantBags[visit.id]=variants.filter(key=>key!==visit.variationId);
    this.data.visits.push(visit); this.data.currentUid = visit.uid;
    this.data.remaining = this.data.remaining.filter(id => id !== visit.id);
    this.data.lastId = visit.id; this.data.pending = null; this.data.doorScene=null; this.data.phase = 'inside'; this.data.opened++;
    return visit;
  }
  next() {
    if (this.data.phase !== 'inside') return;
    this.data.lastVisitUid = this.data.currentUid;
    this.data.phase = 'door'; this.data.currentUid = null;
    if (!this.data.pending) { this.data.doorScene=null; this.prepare(); }
  }
  sameScene() {
    if (this.data.phase!=='inside') return;
    this.data.lastVisitUid=this.data.currentUid;
    this.data.doorScene=this.current.id; this.data.currentUid=null;
    this.data.phase='door'; this.data.pending=null; this.prepare();
  }
  randomDoor() {
    if (this.data.phase!=='door') return;
    this.data.doorScene=null; this.data.pending=null; this.prepare();
  }
  revisit(uid) {
    const visit = this.data.visits.find(item => item.uid === uid);
    if (!visit) return false;
    if (this.data.currentUid !== uid || this.data.phase !== 'inside') {
      visit.returns++;
      if (visit.id === 'postoffice' && visit.state.delivered) visit.state.followup = true;
      if (visit.id === 'repair' && visit.state.wound) visit.state.followup = true;
    }
    this.data.currentUid = uid; this.data.phase = 'inside';
    if (visit.id === 'seaside') visit.state.catching = false;
    return true;
  }
  tick(dt) {
    if (this.data.phase !== 'inside' || !Number.isFinite(dt) || dt <= 0) return false;
    const visit = this.current; visit.elapsed += dt;
    if (['seaside', 'rooftop'].includes(visit.id) && !visit.state.eventSeen && visit.elapsed >= visit.eventAt) { visit.state.eventSeen = true; return true; }
    return false;
  }
  act(action, payload = '') {
    if (this.data.phase !== 'inside') return false;
    const visit = this.current, s = visit.state;
    if (action === 'bookmark') { visit.bookmarked = !visit.bookmarked; return true; }
    if (visit.id === 'seaside') {
      if (action === 'sit') s.seated = !s.seated;
      else if (action === 'catch') { s.catching = !s.catching; if (s.catching) s.touched = true; }
      else return false;
    } else if (visit.id === 'rooftop') {
      if (action === 'hang' && !s.hung) { s.hung = true; s.note = String(payload).trim().slice(0, 24); }
      else if (action === 'chime') s.touched = true;
      else if (action === 'read-plane' && s.eventSeen && visit.variationId==='plane') s.eventRead = true;
      else return false;
    } else if (visit.id === 'postoffice') {
      if (action === 'post-choice' && !s.choice && Object.hasOwn(postChoices(visit),payload)) s.choice = payload;
      else if (action === 'deliver' && s.choice) s.delivered = true;
      else return false;
    } else if (visit.id === 'repair') {
      if (action === 'listen') s.heard = true;
      else if (action === 'bell-choice' && !s.choice && Object.hasOwn(bellChoices(visit),payload)) s.choice = payload;
      else if (action === 'wind' && s.choice) s.wound = true;
      else return false;
    } else if (visit.id === 'greenhouse') {
      if (action === 'hint') s.hints = Math.min(2, s.hints + 1);
      else if (['mirror-a', 'mirror-b'].includes(action) && !s.solved) { s.mirrors[action === 'mirror-a' ? 0 : 1] ^= 1; s.solved = traceLight(s).solved; }
      else return false;
    } else {
      if (action === 'hint') s.hints = Math.min(2, s.hints + 1);
      else if (/^ring-[012]$/.test(action) && !s.solved) { const index = Number(action.at(-1)); s.rings[index] = (s.rings[index] + 1) % 4; s.solved = s.rings.every((value, i) => value === s.targets[i]); }
      else return false;
    }
    return true;
  }
  serialize() { return JSON.stringify(this.data); }
}

export function memoryLine(visit) {
  const s = visit.state, profile=variation(visit);
  if (visit.id === 'seaside') return [s.seated && '坐下看海', s.touched && '接住檐水', s.eventSeen && `看见${profile.eventName}`].filter(Boolean).join(' · ') || '在檐水声里停了一会儿';
  if (visit.id === 'rooftop') return [s.hung && `留下${s.note ? `「${s.note}」` : '一张空白纸签'}`,s.eventRead?'读了纸飞机上的话':s.eventSeen?`遇见${profile.eventName}`:''].filter(Boolean).join(' · ') || '在天台看云';
  if (visit.id === 'postoffice') return `${profile.name} · ${s.delivered ? `寄出了「${postChoices(visit)[s.choice].line}」` : s.choice ? '明信片写好了，还在柜台上' : profile.label}`;
  if (visit.id === 'repair') return s.wound ? `让木鸟唱起${s.choice === 'old' ? '旧' : '新'}铃的声音` : s.choice ? '挑好了铃，还没有转动发条' : '陪店主听两枚铃';
  if (visit.id === 'greenhouse') return s.solved ? '把光送到花上，叶片展开了' : '光路停在你上次调整的位置';
  return s.solved ? '对齐三道星环，看见星图相连' : '星环保留着上次的位置';
}

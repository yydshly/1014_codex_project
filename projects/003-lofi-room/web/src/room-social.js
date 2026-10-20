import { roomLine } from "../shared/room-lines.js";

const movingKinds = ["walk", "return"];
const distance = (a, b) => Math.hypot(a.root.position.x - b.root.position.x, a.root.position.z - b.root.position.z);
const chatSpots = [{ x: -0.65, z: 2.95 }, { x: 0.65, z: 2.95 }];

// Conversations reserve their participants; work can preempt the whole exchange.
export function createRoomSocial(characters, { move, face, speak, onLine = () => {}, onEnd = () => {}, onCancel = () => {} }) {
  let clock = 0, turn = null, serial = 0, nextGreeting = 8, nextChat = 22, nextAny = 0;
  const history = new Map();
  const counts = { greeting: 0, chat: 0, cancelled: 0 };
  const pairKey = (a, b) => [a.data.id, b.data.id].sort().join(":");
  const available = (r) => r.action?.ambient && !r.stageFrozen && !r.propBusy && !r.bookHandling?.held && !(r.observedProp && ["read", "write"].includes(r.action.pose)) && !r.action.socialId && !r.action.depart &&
    !["drink", "stretch"].includes(r.action.ambientKind) && r.finishDrinkAge == null;
  const finish = (cancelled = false) => {
    if (!turn) return;
    const previous = turn; turn = null;
    previous.controller.abort();
    if (cancelled) { counts.cancelled++; onCancel(); }
    history.set(previous.key, clock);
    nextAny = clock + 9;
    if (previous.kind === "greeting") nextGreeting = clock + 18;
    else nextChat = clock + 32;
    for (const person of previous.people) {
      if (person.action?.socialId !== previous.id) continue;
      const saved = previous.saved.get(person.data.id);
      const stayed = person.root.position.distanceTo(saved.position) < 0.08;
      if (stayed && saved.action.arrived) {
        person.action = { ...saved.action }; person.path = saved.path;
      } else move(person.data.id, saved.action);
    }
    onEnd(previous.people.map((r) => r.data.id));
  };
  const start = (kind, people, inPlace) => {
    const id = ++serial;
    const saved = new Map(people.map((r) => [r.data.id, {
      action: { ...r.action }, path: r.path.map((p) => ({ ...p })), position: r.root.position.clone(),
    }]));
    turn = { id, kind, people, saved, key: pairKey(...people), controller: new AbortController(),
      phase: "approach", since: clock, index: 0, until: clock + 0.3, started: false, voiceDone: true };
    for (const [i, person] of people.entries()) {
      if (inPlace) {
        person.path = [];
        person.action = { ...person.action, age: 0, pose: "listen", socialId: id,
          label: kind === "greeting" ? "路过停一停 · 和伙伴打招呼" : "休息间隙 · 和伙伴聊几句" };
        if (!saved.get(person.data.id).action.arrived) Object.assign(person.action, {
          x: person.root.position.x, z: person.root.position.z, seat: null, depart: null, arrived: true,
        });
      } else move(person.data.id, { ...chatSpots[i], pose: "listen", ambient: true,
        ambientKind: "social", socialId: id, pace: 0.82, label: "走近伙伴 · 休息时聊几句" });
    }
    counts[kind]++;
  };
  return {
    get actors() { return turn?.people.map((r) => r.data.id) || []; },
    get snapshot() { return { active: Boolean(turn), kind: turn?.kind || null, phase: turn?.phase || null,
      actors: this.actors, line: turn?.index ?? null, counts: { ...counts } }; },
    interrupt(actor) { if (!actor || turn?.people.some((r) => r.data.id === actor)) finish(true); },
    reset() { finish(true); history.clear(); nextAny = clock + 6; nextGreeting = clock + 8; nextChat = clock + 22; },
    update(delta, { enabled, reducedMotion }) {
      if (!enabled) return;
      clock += delta;
      if (reducedMotion) { finish(true); return; }
      if (turn) {
        const current = turn;
        if (current.people.some((r) => r.action?.socialId !== current.id)) { finish(true); return; }
        current.people.forEach((person, i) => { if (!person.action.seat) face(person.data.id, current.people[1 - i].data.id); });
        if (current.phase === "approach") {
          if (clock - current.since > 22) { finish(true); return; }
          if (current.people.every((r) => r.action.arrived)) {
            current.phase = "talk"; current.until = clock + 0.3;
          }
          return;
        }
        if (clock < current.until) return;
        if (current.started) {
          if (!current.voiceDone) return;
          current.index++; current.started = false;
          if (current.index === 2) { finish(); return; }
          current.until = clock + 0.3;
          return;
        }
        const person = current.people[current.index], partner = current.people[1 - current.index];
        const category = current.kind === "greeting" ? current.index ? "greet_reply" : "greet" : current.index ? "chat_reply" : "chat";
        const line = roomLine(person.data.id, category, partner.data.id);
        person.action.pose = category === "greet" ? "wave" : "talk";
        partner.action.pose = "listen";
        person.action.label = `${current.kind === "greeting" ? "路过招呼" : "休息闲聊"} · 正在和伙伴说话`;
        person.action.age = 0;
        current.started = true; current.voiceDone = false;
        current.until = clock + Math.max(1, line.text.length * 0.055);
        onLine(line, current.kind);
        const speaking = speak?.(line, current.controller.signal);
        if (!speaking?.then) current.voiceDone = true;
        else speaking.then(() => { if (turn === current) current.voiceDone = true; }, () => { if (turn === current) finish(true); });
        return;
      }
      if (clock < nextAny) return;
      const people = characters.residents.filter(available);
      if (clock >= nextGreeting) {
        for (const walker of people.filter((r) => movingKinds.includes(r.action.ambientKind) && !r.action.arrived && r.path.length && r.sitAmount < 0.05)) {
          const partner = people.find((r) => r !== walker && r.action.arrived && distance(walker, r) > 0.85 && distance(walker, r) < 1.65 && clock - (history.get(pairKey(walker, r)) ?? -100) > 75);
          if (partner) { start("greeting", [walker, partner], true); return; }
        }
      }
      if (clock < nextChat) return;
      const resting = people.filter((r) => r.action.arrived && r.action.ambientKind === "home" && r.action.age > 4);
      const pairs = resting.flatMap((a, i) => resting.slice(i + 1).map((b) => [a, b]))
        .filter(([a, b]) => clock - (history.get(pairKey(a, b)) ?? -100) > 85)
        .sort((a, b) => distance(...a) - distance(...b));
      for (const pair of pairs) {
        const inPlace = distance(...pair) < 1.65;
        const othersAway = characters.residents.some((r) => !pair.includes(r) && r.action?.ambient && !["home", undefined].includes(r.action.ambientKind));
        if (inPlace || !othersAway) { start("chat", pair, inPlace); return; }
      }
    },
  };
}

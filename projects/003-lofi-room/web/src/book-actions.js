import * as THREE from "three";

const ease = (t) => THREE.MathUtils.smoothstep(t, 0, 1);
const needsBook = (goal) => goal?.pose === "read" && Boolean(goal.ambient || goal.bookReading);
const labels = { fetch: "走到桌边取书", pickup: "俯身伸手，拿起读本", travel: "拿着合上的书走向阅读位置", opening: "坐稳后打开读本", reading: "阅读中", closing: "合上读本，准备收好", returning: "拿着书回到桌边", placing: "俯身放书，松手后收回手臂", withdrawing: "收回手臂" };

// The actor owns this lifecycle; rendering never decides whether a book is held.
// move() is the navigation primitive, so intermediate destinations cannot re-enter request().
export function createBookActions(person, station, move) {
  const r = person;
  const state = { phase: "stored", age: 0, held: false, open: 0, grip: 0,
    position: new THREE.Vector3(...station.book), quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, station.yaw + Math.PI, 0)) };
  let pending = null, fromPosition, fromQuaternion, closeFrom = 0;
  r.bookHandling = state;
  const enter = (phase) => { state.phase = phase; state.age = 0; };
  const setBusy = () => { r.propBusy = !["stored", "reading"].includes(state.phase); };
  const atDestination = () => r.action?.arrived && (!r.action.seat || r.sitAmount > .98) && Math.abs(Math.atan2(Math.sin(r.action.yaw - r.root.rotation.y), Math.cos(r.action.yaw - r.root.rotation.y))) < .07;
  const stationMove = () => move({ x: station.x, z: station.z, yaw: station.yaw, pose: "idle", ambient: pending?.ambient, ambientKind: pending?.ambientKind, label: labels[state.held ? "returning" : "fetch"], pace: .78 });
  const beginGoal = () => {
    const goal = pending; pending = null;
    if (needsBook(goal)) { pending = goal; enter("fetch"); stationMove(); }
    else { enter("stored"); move(goal); }
  };
  const beginClose = () => {
    closeFrom = state.open; enter("closing");
    // Pause locomotion while closing. Preserve the seat/exit route for safe undocking.
    if (r.path?.length && r.action && !r.action.depart) r.action.seat = null;
    r.path = []; if (r.action) r.action.arrived = true;
  };
  const carry = () => {
    r.body.updateWorldMatrix(true, false);
    const height = .30 + .40 * (r.action?.seat?.floor || r.action?.depart && r.seatedFloor ? r.sitAmount || 0 : 0);
    r.readHeight = height;
    return { position: r.body.localToWorld(new THREE.Vector3(-.10 * (1 - state.open), height, .31)),
      quaternion: r.body.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.4, Math.PI, 0))) };
  };
  const interpolate = (position, quaternion, amount) => {
    state.position.copy(fromPosition).lerp(position, amount);
    state.quaternion.copy(fromQuaternion).slerp(quaternion, amount);
  };
  const snapshot = () => { fromPosition = state.position.clone(); fromQuaternion = state.quaternion.clone(); };
  return {
    request(spec) {
      pending = { ...spec };
      if (state.phase === "stored") beginGoal();
      else if (state.phase === "fetch") {
        if (!needsBook(spec)) { enter("stored"); move(pending); pending = null; }
      } else if (["reading", "opening", "travel", "holding"].includes(state.phase)) beginClose();
      // During pickup/return, replace the destination without dropping the prop.
      setBusy(); return r.action;
    },
    stop() {
      pending = null;
      if (state.held) { closeFrom = state.open; enter("holding"); }
      else enter("stored");
      r.propBusy = false;
    },
    before(delta) {
      state.age += delta;
      const t = state.age;
      r.bookReach = 0; r.bookBend = 0;
      if (state.phase === "fetch" && atDestination()) { enter("pickup"); snapshot(); }
      else if (state.phase === "pickup") {
        r.bookReach = ease(t / .75); r.bookBend = ease(t / .65) * (1 - ease((t - 1.1) / .85));
        if (t >= .85) state.held = true;
        if (t >= 2.05) {
          if (!needsBook(pending)) { enter("returning"); stationMove(); }
          else { enter("travel"); move({ ...pending }); }
        }
      } else if (state.phase === "travel" && atDestination()) enter("opening");
      else if (state.phase === "opening") {
        state.open = ease(t / .9);
        if (t >= .9) { if (r.action) r.action.label = pending?.label || "阅读自己的读本"; enter("reading"); pending = null; state.open = 1; }
      } else if (state.phase === "closing") {
        state.open = closeFrom * (1 - ease(t / .9));
        if (t >= .95) { state.open = 0; enter("returning"); stationMove(); }
      } else if (state.phase === "returning" && atDestination()) { enter("placing"); snapshot(); }
      else if (state.phase === "placing") {
        r.bookReach = 1 - ease((t - 1.65) / .65);
        r.bookBend = ease(t / .65) * (1 - ease((t - 1.65) / .65));
        if (t >= 1.55) state.held = false;
        if (t >= 2.35) {
          state.grip = 0;
          if (pending) beginGoal(); else enter("stored");
        }
      } else if (state.phase === "holding") state.open = Math.max(0, state.open - delta);
      setBusy();
      state.label = labels[state.phase] || (state.phase === "holding" ? "暂时拿着合上的读本" : "读本已放好");
      if (r.propBusy && r.action) r.action.label = state.label;
    },
    after(delta) {
      const heldTarget = carry(), dock = new THREE.Vector3(...station.book);
      const dockRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, station.yaw + Math.PI, 0));
      const t = state.age;
      if (state.phase === "pickup") {
        if (t < .85) { state.position.copy(dock); state.quaternion.copy(dockRotation); }
        else interpolate(heldTarget.position, heldTarget.quaternion, ease((t - .85) / 1.15));
      } else if (state.phase === "placing") {
        // Keep it in both hands while lowering; release only at the table contact.
        const amount = ease((t - .4) / 1.15);
        state.position.copy(heldTarget.position).lerp(dock, amount);
        state.quaternion.copy(heldTarget.quaternion).slerp(dockRotation, amount);
      } else if (state.held) {
        const alpha = 1 - Math.exp(-18 * delta);
        state.position.lerp(heldTarget.position, alpha); state.quaternion.slerp(heldTarget.quaternion, alpha);
      } else { state.position.copy(dock); state.quaternion.copy(dockRotation); }
      state.grip = state.phase === "pickup" ? ease((t - .55) / .3) : state.phase === "placing" ? 1 - ease((t - 1.55) / .25) : state.held ? 1 : 0;
    },
  };
}

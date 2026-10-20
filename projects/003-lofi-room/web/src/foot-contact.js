import * as THREE from "three";
import { FLOOR_Y, supportBelow } from "./ground-surfaces.js";

export const SHOE = { width: .21, height: .09, depth: .29, forward: .065 };
const down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0);
const clearance = .003, stanceWidth = .12;
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const distanceXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ease = (t) => t * t * (3 - 2 * t);

export function shoeBounds(ankle, box = new THREE.Box3()) {
  box.makeEmpty();
  for (const x of [-SHOE.width / 2, SHOE.width / 2]) for (const y of [-SHOE.height, 0])
    for (const z of [SHOE.forward - SHOE.depth / 2, SHOE.forward + SHOE.depth / 2])
      box.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(ankle.matrixWorld));
  return box;
}

function footprint(point, yaw) {
  const box = new THREE.Box3();
  for (const x of [-SHOE.width / 2, SHOE.width / 2]) for (const z of [SHOE.forward - SHOE.depth / 2, SHOE.forward + SHOE.depth / 2])
    box.expandByPoint(new THREE.Vector3(x, 0, z).applyAxisAngle(up, yaw).add(point));
  return box;
}
function ground(point, yaw) {
  const support = supportBelow(footprint(point, yaw));
  point.y = support.height + SHOE.height + clearance;
  return support;
}
function destination(origin, yaw, i, forward = 0) {
  const side = (i ? 1 : -1) * stanceWidth;
  return new THREE.Vector3(origin.x + Math.cos(yaw) * side + Math.sin(yaw) * forward, 0,
    origin.z - Math.sin(yaw) * side + Math.cos(yaw) * forward);
}
function walkLanding(point, yaw, origin, from = null) {
  const safe = (p) => !supportBelow(footprint(p, yaw)).surface.endsWith("cushion");
  if (safe(point)) return point;
  // Walking routes avoid cushions, so a toe near their edge must land beside
  // them rather than resting on a conservative box above an empty corner.
  const choices = [];
  for (const radius of [.04, .08, .14, .22, .30]) for (let i = 0; i < 12; i++) {
    const p = point.clone().add(new THREE.Vector3(Math.cos(i * Math.PI / 6) * radius, 0, Math.sin(i * Math.PI / 6) * radius));
    if (distanceXZ(p, origin) < .63 && (!from || distanceXZ(p, from) <= .62) && safe(p)) choices.push({ p, cost: radius + distanceXZ(p, origin) * .03 });
  }
  return choices.sort((a, b) => a.cost - b.cost)[0]?.p || point;
}
function startStep(foot, target, yaw, duration, reason) {
  foot.from = foot.position.clone(); foot.to = target.clone();
  ground(foot.to, yaw);
  foot.fromYaw = foot.yaw; foot.toYaw = yaw;
  foot.age = 0; foot.duration = duration; foot.phase = "swing"; foot.reason = reason;
  let highest = -Infinity;
  for (let sample = 0; sample <= 8; sample++) {
    const t = sample / 8, point = foot.from.clone().lerp(foot.to, t);
    highest = Math.max(highest, supportBelow(footprint(point, foot.fromYaw + angleDelta(foot.fromYaw, yaw) * t)).height);
  }
  foot.lift = Math.max(.065, highest + SHOE.height + clearance - Math.min(foot.from.y, foot.to.y) + .03);
}
function animateStep(foot, delta, reduced) {
  foot.age += delta;
  const t = Math.min(1, foot.age / foot.duration);
  foot.yaw = foot.fromYaw + angleDelta(foot.fromYaw, foot.toYaw) * ease(t);
  const travel = ease(THREE.MathUtils.clamp((t - .18) / .64, 0, 1));
  foot.position.copy(foot.from).lerp(foot.to, travel);
  // Lift before the toes reach an edge. Only swing feet use clearance arcs.
  const support = supportBelow(footprint(foot.position, foot.yaw));
  const raise = ease(Math.min(1, t / .22)), lower = 1 - ease(Math.max(0, (t - .78) / .22));
  const arc = raise * lower * Math.max(reduced ? .035 : .065, foot.lift);
  foot.position.y = Math.max(foot.position.y + arc, support.height + SHOE.height + clearance);
  if (t === 1) {
    foot.position.copy(foot.to); foot.yaw = foot.toYaw; ground(foot.position, foot.yaw);
    foot.phase = "stance"; foot.anchor = foot.position.clone(); foot.plantId++;
  }
}

// Prepare both feet together, so one stays planted while the other changes place.
// Anchors are world-space positions and do not follow the moving/turning root.
export function prepareFootSupport(r, state, lengths) {
  if (state.sleeping) { r.footSupport = null; r.supportOffset = 0; return; }
  if (r.footSupport && state.delta > .055 && !state.footSubstep) {
    // Integrate foot contacts along the actual root path on slow frames, rather
    // than holding a planted foot for an extra entire step while the hips move.
    const end = r.root.position.clone(), begin = r.footSupport.root.clone();
    const endYaw = r.root.rotation.y, beginYaw = r.footSupport.yaw;
    const count = Math.ceil(state.delta / .05), nominalRig = r.rig.position.y;
    for (let step = 1; step <= count; step++) {
      r.root.position.copy(begin).lerp(end, step / count);
      r.root.rotation.y = beginYaw + angleDelta(beginYaw, endYaw) * step / count;
      r.rig.position.y = nominalRig;
      prepareFootSupport(r, { ...state, delta: state.delta / count, footSubstep: true }, lengths);
    }
    r.root.position.copy(end); r.root.rotation.y = endYaw;
    return;
  }
  const root = r.root.position, yaw = r.root.rotation.y, delta = state.delta;
  const seat = r.sittingSeat || r.action?.seat;
  const floor = Boolean(state.floor);
  const floorRise = Boolean(seat?.floor && r.action?.depart && (r.sitAmount > .035 || state.rising));
  const regularSeat = !floor && Boolean(state.seatPlanting || state.sitting > 0 || state.rising || r.sitAmount > .035);
  const mode = floorRise ? "floor-rise" : floor && !r.action?.depart ? "floor-seat" : regularSeat ? "seat" : "walk";
  const seatYaw = r.sittingYaw ?? yaw;
  const origin = mode === "seat" || mode.startsWith("floor") ? seat || root : root;
  const facing = mode === "walk" ? yaw : seatYaw;
  const forward = mode === "floor-seat" ? .57 : mode === "floor-rise" ? 0 : mode === "seat" ? state.footForward ?? seat?.footForward ?? .34 : 0;
  const rest = [0, 1].map((i) => {
    const point = destination(origin, facing, i, forward);
    return mode === "walk" ? walkLanding(point, facing + (i ? 1 : -1) * .055, root) : point;
  });
  let support = r.footSupport;
  const reset = !support || distanceXZ(root, support.root) > .8;
  if (reset) {
    support = r.footSupport = { root: root.clone(), yaw, next: 0, feet: rest.map((point, i) => {
      const footYaw = facing + (i ? 1 : -1) * .055; ground(point, footYaw);
      return { position: point, yaw: footYaw, phase: "stance", anchor: point.clone(), plantId: 0 };
    }) };
  }
  const dx = root.x - support.root.x, dz = root.z - support.root.z;
  const moved = Math.hypot(dx, dz), speed = reset ? 0 : moved / Math.max(.001, delta);
  const moving = mode === "walk" && speed > .015;
  const heading = moved > .00001 ? new THREE.Vector3(dx / moved, 0, dz / moved) : new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const turning = Math.abs(angleDelta(support.yaw, yaw)) / Math.max(.001, delta);
  let spare = 0;
  for (const foot of support.feet) if (foot.phase === "swing") {
    spare = Math.max(spare, delta - Math.max(0, foot.duration - foot.age));
    animateStep(foot, delta, state.reducedMotion);
  }
  if (!support.feet.some((f) => f.phase === "swing")) {
    const candidates = support.feet.map((foot, i) => {
      const gap = distanceXZ(foot.position, rest[i]);
      const behind = (root.x - foot.position.x) * heading.x + (root.z - foot.position.z) * heading.z;
      const yawGap = Math.abs(angleDelta(foot.yaw, facing + (i ? 1 : -1) * .055));
      return { foot, i, gap, behind, needed: mode === "walk" ? moving ? behind > .035 || gap > .32 || yawGap > .35 : gap > .055 || yawGap > .23 : gap > .012 || yawGap > .05 };
    }).filter((c) => c.needed);
    if (candidates.length) {
      candidates.sort((a, b) => mode === "walk" && moving ? b.behind - a.behind || (a.i === support.next ? -1 : 1) : b.gap - a.gap);
      // If the partner foot occupies this landing spot, settle that foot first.
      // Otherwise the same foot can repeatedly lift and land at its old spot.
      const { foot, i } = candidates.find((c) => moving || distanceXZ(rest[c.i], support.feet[1 - c.i].position) >= .22) || candidates[0];
      const duration = mode === "walk" ? moving ? THREE.MathUtils.clamp(.34 - speed * .05, .23, .32) : .25 : .34;
      const targetYaw = facing + (i ? 1 : -1) * .055 + (moving && turning < 2 ? angleDelta(support.yaw, yaw) / Math.max(.001, delta) * duration * .4 : 0);
      let target = rest[i].clone();
      if (moving) target.addScaledVector(heading, Math.min(.50, speed * duration * 1.45));
      const other = support.feet[1 - i].position;
      if (distanceXZ(target, other) < .22) {
        target.x += Math.cos(facing) * (i ? .12 : -.12);
        target.z -= Math.sin(facing) * (i ? .12 : -.12);
      }
      const reach = distanceXZ(foot.position, target);
      if (reach > .62) target.lerpVectors(foot.position, target, .62 / reach);
      if (mode === "walk") target = walkLanding(target, targetYaw, root, foot.position);
      startStep(foot, target, targetYaw, duration, mode === "walk" ? moving ? "step" : "settle" : mode);
      // Carry the unused fraction of a frame into the next step. Rounding every
      // step up to a whole frame makes the feet fall behind at low frame rates.
      if (spare > 0) animateStep(foot, spare, state.reducedMotion);
      support.next = 1 - i;
    }
  }
  const ready = support.feet.every((f, i) => f.phase === "stance" && distanceXZ(f.position, rest[i]) < .015 && Math.abs(angleDelta(f.yaw, facing + (i ? 1 : -1) * .055)) < .06);
  r.seatFeetReady = mode !== "walk" && ready;
  r.floorFeetReady = mode === "floor-rise" && ready;

  // Body height follows the support plane, with soft knees. Lower it further
  // only when a fixed foot would otherwise exceed the actual leg length.
  const planted = support.feet.filter((f) => f.phase === "stance");
  const bearing = planted.length ? planted : support.feet;
  const level = bearing.reduce((sum, f) => sum + supportBelow(footprint(f.position, f.yaw)).height, 0) / bearing.length;
  const desired = (level - FLOOR_Y - .055) * (1 - r.sitAmount);
  let offset = THREE.MathUtils.damp(r.supportOffset || 0, desired, 12, delta);
  r.root.updateWorldMatrix(true, false); r.rig.updateWorldMatrix(true, false);
  const nominalRig = r.rig.position.y;
  for (const [i, foot] of support.feet.entries()) {
    const hip = r.rig.localToWorld(r.legs[i].position.clone());
    const horizontal = Math.min(lengths.thigh + lengths.shin - .01, distanceXZ(hip, foot.position));
    const maxY = foot.position.y + Math.sqrt(Math.max(0, (lengths.thigh + lengths.shin - .005) ** 2 - horizontal ** 2));
    offset = Math.min(offset, maxY - hip.y);
  }
  r.supportOffset = offset; r.rig.position.y = nominalRig + offset;
  support.root.copy(root); support.yaw = yaw; support.mode = mode;
}

function solveLeg(r, i, target, orientation, lengths, floorAmount) {
  const leg = r.legs[i], knee = r.knees[i], ankle = r.ankles[i];
  const local = r.rig.worldToLocal(target.clone()).sub(leg.position);
  const distance = THREE.MathUtils.clamp(local.length(), Math.abs(lengths.thigh - lengths.shin) + .0001, lengths.thigh + lengths.shin - .0001);
  const direction = local.normalize();
  const pole = new THREE.Vector3((i ? 1 : -1) * .18 * floorAmount, .7 * floorAmount, 1 - .4 * floorAmount);
  pole.addScaledVector(direction, -pole.dot(direction));
  if (pole.lengthSq() < 1e-8) pole.set(0, 0, 1).addScaledVector(direction, -direction.z);
  pole.normalize();
  const along = (lengths.thigh ** 2 - lengths.shin ** 2 + distance ** 2) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, lengths.thigh ** 2 - along ** 2));
  const upper = direction.clone().multiplyScalar(along).addScaledVector(pole, bend);
  leg.quaternion.setFromUnitVectors(down, upper.clone().normalize());
  const lower = direction.clone().multiplyScalar(distance).sub(upper).normalize().applyQuaternion(leg.quaternion.clone().invert());
  knee.quaternion.setFromUnitVectors(down, lower);
  knee.updateWorldMatrix(true, false);
  ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  ankle.updateWorldMatrix(false, true);
}

export function updateFootContact(r, i, state, lengths) {
  if (state.sleeping || !r.footSupport) return;
  const foot = r.footSupport.feet[i];
  const orientation = new THREE.Quaternion().setFromAxisAngle(up, foot.yaw);
  const floorAmount = state.floor ? THREE.MathUtils.clamp(-r.root.position.y / .595, 0, 1) : 0;
  solveLeg(r, i, foot.position, orientation, lengths, floorAmount);
  const bounds = shoeBounds(r.ankles[i]), support = supportBelow(bounds);
  const actual = r.ankles[i].getWorldPosition(new THREE.Vector3());
  r.footContacts ||= [];
  r.footContacts[i] = { surface: support.surface, supportY: support.height, soleY: bounds.min.y,
    clearance: bounds.min.y - support.height, phase: foot.phase, plantId: foot.plantId,
    x: actual.x, z: actual.z, anchorX: foot.anchor.x, anchorZ: foot.anchor.z,
    slip: foot.phase === "stance" ? distanceXZ(actual, foot.anchor) : null };
}

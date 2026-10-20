import * as THREE from "three";
import { moveWithCollisions } from "./navigation.js";
import { prepareFootSupport, updateFootContact } from "./foot-contact.js";

export const BODY = { hip: 0.8, thigh: 0.35, shin: 0.34, upperArm: 0.28, forearm: 0.235, height: 1.9 };
const down = new THREE.Vector3(0, -1, 0);
const clamp = THREE.MathUtils.clamp;
const smooth = (value, target, delta, rate = 11) => THREE.MathUtils.damp(value, target, rate, delta);
function turn(actor, yaw, delta) {
  const difference = Math.atan2(Math.sin(yaw - actor.root.rotation.y), Math.cos(yaw - actor.root.rotation.y));
  actor.root.rotation.y += clamp(difference, -delta * 3.4, delta * 3.4);
}

export function advanceTeamActor(r, { delta, bounds, obstacles, reducedMotion, choreographed, traffic }) {
  const action = r.action;
  let distanceMoved = 0, sitting = 0, rising = false;
  if (r.traffic?.hold) return { distanceMoved, sitting, rising, rootY: 0 };
  if (r.finishDrinkAge != null) {
    r.finishDrinkAge += delta;
    const drinkAge = r.finishDrinkAge;
    if (drinkAge >= 6.2) r.finishDrinkAge = null;
    return { distanceMoved, sitting, rising, rootY: 0, settlingDrink: drinkAge };
  }
  if (action?.depart && (r.sitAmount || 0) > 0.035) {
    rising = true;
    turn(r, r.sittingYaw ?? r.root.rotation.y, delta);
    if (r.sittingSeat?.floor && !r.floorFeetReady) {
      // Bring one foot under the body, then the other, before lifting the hips.
      return { distanceMoved, sitting: 1, rising, rootY: r.seatedY };
    }
    // Bring the hips above the planted feet while unfolding, then step into the aisle.
    const seat = r.sittingSeat;
    if (seat?.furniture === "sofa") {
      const shift = (seat.footForward ?? .34) * (1 - smooth(r.sitAmount, 0, delta, 9));
      const x = seat.x + Math.sin(r.sittingYaw) * shift, z = seat.z + Math.cos(r.sittingYaw) * shift;
      const next = traffic ? traffic.move(r, x - r.root.position.x, z - r.root.position.z, seat) : { x, z };
      if (Math.hypot(next.x - x, next.z - z) > .002) { sitting = r.sitAmount; rising = false; }
      r.root.position.x = next.x; r.root.position.z = next.z;
    }
  } else {
    const docking = action?.depart || (!r.path?.length && action?.seat && !action.arrived);
    if (docking) {
      const entering = !action.depart, seat = action.seat;
      const shift = entering && seat.furniture === "sofa" ? (seat.footForward ?? .34) : 0;
      const destination = action.depart || { x: seat.x + Math.sin(action.yaw) * shift, z: seat.z + Math.cos(action.yaw) * shift };
      const dx = destination.x - r.root.position.x, dz = destination.z - r.root.position.z;
      const distance = Math.hypot(dx, dz), step = Math.min(distance, delta * 0.7);
      const facing = Math.abs(Math.atan2(Math.sin(action.yaw - r.root.rotation.y), Math.cos(action.yaw - r.root.rotation.y)));
      if (entering) turn(r, action.yaw, delta);
      if (entering && action.lowering) {
        sitting = 1;
        const amount = smooth(r.sitAmount || 0, 1, delta, 9);
        const destination = { x: seat.x + Math.sin(action.yaw) * shift * (1 - amount), z: seat.z + Math.cos(action.yaw) * shift * (1 - amount) };
        const next = traffic ? traffic.move(r, destination.x - r.root.position.x, destination.z - r.root.position.z, seat) : destination;
        if (Math.hypot(next.x - destination.x, next.z - destination.z) > .002) sitting = r.sitAmount;
        r.root.position.x = next.x; r.root.position.z = next.z;
        if (r.sitAmount > .99 && r.seatFeetReady && (!traffic || traffic.canStand(r, seat, seat))) { action.arrived = true; r.root.position.x = seat.x; r.root.position.z = seat.z; }
      } else if ((!entering || facing < .08) && distance > 0.001) {
        const next = traffic ? traffic.move(r, dx / distance * step, dz / distance * step, entering ? seat : r.sittingSeat) : { x: r.root.position.x + dx / distance * step, z: r.root.position.z + dz / distance * step };
        distanceMoved = Math.hypot(next.x - r.root.position.x, next.z - r.root.position.z);
        r.root.position.x = next.x; r.root.position.z = next.z;
      }
      if (action.depart) turn(r, Math.atan2(dx, dz), delta);
      if (distance < 0.02 && (!entering || facing < .08)) {
        if (action.depart) action.depart = null;
        else {
          r.sittingYaw = action.yaw; r.sittingSeat = { ...seat };
          action.preparingSeat = true;
          if (seat.floor || r.seatFeetReady) { action.lowering = true; sitting = 1; }
        }
      }
    } else if (r.path?.length && (!reducedMotion || choreographed)) {
      const target = r.path[0], dx = target.x - r.root.position.x, dz = target.z - r.root.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < (r.path.length === 1 ? 0.001 : 0.035)) r.path.shift();
      else {
        const step = Math.min(distance, delta * (action?.pace ?? (choreographed ? 1.08 : 1.05)));
        const next = traffic ? traffic.move(r, dx / distance * step, dz / distance * step) : moveWithCollisions(r.root.position, dx / distance * step, dz / distance * step, bounds, obstacles, 0.19);
        distanceMoved = Math.hypot(next.x - r.root.position.x, next.z - r.root.position.z);
        const actualX = next.x - r.root.position.x, actualZ = next.z - r.root.position.z;
        r.root.position.x = next.x; r.root.position.z = next.z;
        if (distanceMoved > .001) turn(r, r.traffic?.yieldYaw ?? Math.atan2(actualX, actualZ), delta);
      }
    }
  }
  if (action && !r.path?.length && !action.depart && !action.seat && !r.traffic?.yieldTarget && Math.hypot(r.root.position.x - action.x, r.root.position.z - action.z) < .035) action.arrived = true;
  if (action?.arrived) {
    action.age += delta;
    turn(r, action.yaw, delta);
    if (action.seat) { sitting = 1; r.seatedFloor = Boolean(action.seat.floor); }
  }
  return { distanceMoved, sitting, rising, seatPlanting: Boolean(action?.preparingSeat && !action.lowering), rootY: (action?.depart ? r.seatedY : action?.seat?.y) ?? r.seatedY ?? -0.28 };
}

// Solve shoulder -> elbow -> wrist with a downward/outward elbow pole. The
// wrist then keeps the palm in the intended plane instead of following a rod.
function reach(r, index, point, alpha, palmAngle = -Math.PI / 2) {
  const shoulder = r.arms[index], elbow = r.elbows[index], wrist = r.wrists[index];
  const side = index ? 1 : -1;
  const target = new THREE.Vector3(...point);
  const handRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(palmAngle, 0, side * 0.04));
  const palmOffset = new THREE.Vector3(0, -0.055, 0).applyQuaternion(handRotation);
  target.sub(palmOffset);
  const direction = target.clone().sub(shoulder.position);
  const distance = clamp(direction.length(), 0.04, BODY.upperArm + BODY.forearm - 0.008);
  direction.normalize();
  const along = (BODY.upperArm ** 2 - BODY.forearm ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, BODY.upperArm ** 2 - along ** 2));
  const pole = new THREE.Vector3(side * .8, -.65, .35);
  pole.addScaledVector(direction, -pole.dot(direction)).normalize();
  const elbowDirection = direction.clone().multiplyScalar(along).addScaledVector(pole, height);
  const upper = new THREE.Quaternion().setFromUnitVectors(down, elbowDirection.clone().normalize());
  const forearmDirection = direction.clone().multiplyScalar(distance).sub(elbowDirection).normalize().applyQuaternion(upper.clone().invert());
  const lower = new THREE.Quaternion().setFromUnitVectors(down, forearmDirection);
  const hand = upper.clone().multiply(lower).invert().multiply(handRotation);
  shoulder.quaternion.slerp(upper, alpha).normalize();
  elbow.quaternion.slerp(lower, alpha).normalize();
  wrist.quaternion.slerp(hand, alpha).normalize();
}

export function updateResidentPose(r, state) {
  const { time, delta, reducedMotion, pose = "idle", distanceMoved = 0, sitting = 0, rising = false, speaking = false, level = 0, listening = false, floor = false, sleeping = false, dancing = false } = state;
  const alpha = reducedMotion ? 1 : 1 - Math.exp(-11 * delta);
  const motion = reducedMotion ? 0 : 1;
  r.sitAmount = smooth(r.sitAmount || 0, sitting, delta, 9);
  const sit = r.sitAmount;
  if (state.dynamicSeat) {
    r.root.position.y = smooth(r.root.position.y, state.rootY * sit - (r.bookBend || 0) * .10, delta, 14);
    if (sitting === 1) r.seatedY = state.rootY;
  }
  r.gaitPhase = (r.gaitPhase || 0) + distanceMoved * Math.PI * 2 / 0.94;
  r.walkWeight = smooth(r.walkWeight || 0, !rising ? clamp(distanceMoved / Math.max(.001, delta) / .8, 0, 1) * (1 - sit) : 0, delta, 10);
  const heading = r.traffic?.heading;
  const sideStep = r.traffic?.yieldTarget && heading ? heading.x * Math.cos(r.root.rotation.y) - heading.z * Math.sin(r.root.rotation.y) : 0;
  r.sideStep = smooth(r.sideStep || 0, sideStep, delta, 7);
  r.voiceWeight = smooth(r.voiceWeight || 0, speaking ? level : 0, delta, 12);
  const walk = r.walkWeight * motion;
  const phase = r.gaitPhase, breath = Math.sin(time * 1.45 + r.index * 0.9) * motion;
  const age = state.poseAge ?? r.action?.age ?? 0;
  const drink = pose === "drink" && !rising && walk < 0.15;
  const lift = drink ? THREE.MathUtils.smoothstep(age, 1.2, 2.3) * (1 - THREE.MathUtils.smoothstep(age, 3.8, 4.8)) : 0;
  const reachCup = drink ? THREE.MathUtils.smoothstep(age, 0.15, 1) * (1 - THREE.MathUtils.smoothstep(age, 5.4, 6.2)) : 0;
  r.drinkGrip = drink ? THREE.MathUtils.smoothstep(age, 0.65, 1.1) * (1 - THREE.MathUtils.smoothstep(age, 5, 5.5)) : 0;
  r.drinkTilt = drink ? THREE.MathUtils.smoothstep(age, 2.4, 2.9) * (1 - THREE.MathUtils.smoothstep(age, 3.3, 3.8)) * 0.32 : 0;
  r.drinkLift = lift;
  const stretch = pose === "stretch" && !rising && walk < 0.15
    ? THREE.MathUtils.smoothstep(age, 0.35, 1.7) * (1 - THREE.MathUtils.smoothstep(age, 4, 5.5)) : 0;
  const working = ["type", "read", "write"].includes(pose);
  const leaning = r.bookBend ? .64 * r.bookBend : rising ? 0.25 : stretch ? -0.065 * stretch : pose === "rest" ? -0.06 : pose === "type" ? (sit > 0.4 ? 0.11 : 0.14) : working ? 0.045 : 0.012;
  r.rig.rotation.x = sleeping ? -Math.PI / 2 : 0;
  r.rig.rotation.z = smooth(r.rig.rotation.z, dancing ? Math.sin(time * 1.7) * 0.035 * motion : 0, delta);
  r.rig.position.y = breath * 0.0025 + (-0.045 + Math.abs(Math.sin(phase * 2)) * 0.006) * walk;
  r.body.rotation.x = smooth(r.body.rotation.x, sleeping ? 0 : leaning, delta);
  r.body.rotation.y = smooth(r.body.rotation.y, r.traffic?.yieldTarget ? r.sideStep * .16 * motion : 0, delta, 7);
  r.body.rotation.z = smooth(r.body.rotation.z, sleeping || sit > 0.2 ? 0 : breath * 0.009 + Math.sin(phase) * 0.012 * walk, delta);
  r.body.position.x = smooth(r.body.position.x, sit > 0.2 ? 0 : breath * 0.006, delta);
  prepareFootSupport(r, state, BODY);

  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1, swing = Math.sin(phase + i * Math.PI);
    if (sleeping) {
      r.legs[i].rotation.set(smooth(r.legs[i].rotation.x, -.03, delta), 0, smooth(r.legs[i].rotation.z, side * .015, delta));
      r.knees[i].rotation.set(smooth(r.knees[i].rotation.x, .08, delta), 0, 0);
      r.ankles[i].rotation.set(-(r.legs[i].rotation.x + r.knees[i].rotation.x), side * .055, 0);
    }
    updateFootContact(r, i, state, BODY);

    const arm = r.arms[i], elbow = r.elbows[i], wrist = r.wrists[i];
    const speechGesture = speaking && i === 1 && !working && sit < 0.2;
    if (drink && i === 1) {
      const target = new THREE.Vector3(0.2, -0.015, 0.22).lerp(new THREE.Vector3(0.14, 0.145 - (r.supportOffset || 0), 0.4), reachCup);
      target.lerp(new THREE.Vector3(0.14, 0.55, 0.32), lift);
      reach(r, i, target.toArray(), alpha, -Math.PI / 2);
    } else if (pose === "wave" && i === 1 && !rising && walk < 0.15) {
      reach(r, i, [0.32, 0.71, 0.16], alpha, -2.6);
      wrist.rotation.z += Math.sin(age * 6) * 0.025 * motion;
    } else if (stretch > 0.001) {
      const target = new THREE.Vector3(side * 0.25, -0.015, 0.09).lerp(new THREE.Vector3(side * 0.2, 1.04, 0.025), stretch);
      reach(r, i, target.toArray(), alpha, -Math.PI / 2 + stretch * Math.PI * 1.35);
    } else if (working && !rising && walk < 0.15) {
      const tap = pose === "type" ? Math.sin(time * 9 + i * Math.PI) * 0.007 * motion : pose === "write" && i ? Math.sin(time * 5) * .006 * motion : 0;
      const hand = pose === "type"
        ? [side * 0.13, sit > 0.4 ? 0.41 + tap : 0.11 + tap, sit > 0.4 ? 0.43 : 0.37]
        : pose === "write" ? [side * 0.14 + (i ? Math.sin(time * 2.3) * .018 * motion : 0), 0.08 + (i ? tap : 0), 0.4 + (i ? Math.cos(time * 3) * .009 * motion : 0)] : [side * 0.17, (r.readHeight ?? .30) - .03, 0.36];
      // Keep the working surface fixed while the pelvis follows the feet.
      if (pose === "type" || pose === "write") hand[1] -= r.supportOffset || 0;
      if (pose === "read" && i === 0 && r.bookTurn > 0 && motion) {
        const sweep = Math.sin(r.bookTurn * Math.PI);
        hand[0] += sweep * .27; hand[1] += sweep * .105; hand[2] -= sweep * .035;
      }
      reach(r, i, hand, alpha, pose === "read" ? -1.9 : -Math.PI / 2 + tap * 3);
    } else if (["rest", "listen", "talk"].includes(pose) && sit > 0.4 && !rising) {
      reach(r, i, [side * 0.16, .02, .30], alpha, -Math.PI / 2);
    } else if (["offer", "receive"].includes(pose) && walk < 0.15) {
      reach(r, i, [side * 0.15, i || pose === "receive" ? 0.24 : 0.17, i || pose === "receive" ? 0.39 : 0.22], alpha, -1.5);
    } else if ((pose === "point" && i === 1 || speechGesture) && walk < 0.15) {
      const gesture = (Math.sin(time * 2.1) + 1) * 0.5 * motion;
      reach(r, i, pose === "point" && !speaking ? [0.34, 0.62, 0.34] : [0.28, 0.21 + gesture * 0.045, 0.25 + gesture * 0.025], alpha, -1.8);
    } else {
      const armX = sleeping ? -0.12 : Math.sin(phase + i * Math.PI) * 0.28 * walk * (1 - Math.abs(r.sideStep) * .7) - 0.045;
      arm.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(armX, 0, side * (dancing ? 0.15 + breath * 0.04 : 0.055))), alpha);
      elbow.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(sleeping ? -0.28 : -0.15 - 0.13 * walk, 0, 0)), alpha);
      wrist.quaternion.slerp(new THREE.Quaternion(), alpha);
    }
  }
  const nod = listening ? Math.sin(time * 1.8 + r.index) * 0.018 * motion : 0;
  const headX = sleeping ? 0 : r.bookBend ? .24 * r.bookBend : drink ? -0.055 * lift : stretch ? -0.08 * stretch : pose === "read" ? 0.30 : pose === "write" || pose === "review" ? 0.2 : pose === "type" ? -0.11 : nod + breath * 0.009;
  r.head.rotation.x = smooth(r.head.rotation.x, headX, delta);
  r.head.rotation.y = smooth(r.head.rotation.y, state.headYaw || 0, delta);
  r.head.rotation.z = smooth(r.head.rotation.z, sleeping ? -0.04 : 0, delta);
  r.head.position.z = smooth(r.head.position.z, sleeping ? 0.15 : 0, delta);
  const blink = (time + r.index * 1.41) % 5.7;
  const open = sleeping ? 0.12 : blink < 0.14 ? Math.abs(blink - 0.07) / 0.07 : 1;
  r.eyes.forEach((eye) => (eye.scale.y = 0.06 * open));
  r.eyeHighlights.forEach((highlight) => (highlight.visible = open > 0.4));
  r.mouth.scale.y = smooth(r.mouth.scale.y, 0.012 + r.voiceWeight * 0.04, delta, 18);
  if (r.document) r.document.visible = !rising && r.walkWeight < 0.15 && pose === "read";
  if (r.pen) r.pen.visible = !rising && r.walkWeight < 0.15 && pose === "write";
  r.root.updateMatrixWorld();
}

export function updateBookHands(r, delta, reducedMotion) {
  const book = r.bookHandling;
  const amount = Math.max(book.grip, r.bookReach || 0);
  if (amount < .001) return;
  r.body.updateWorldMatrix(true, false);
  for (let i = 0; i < 2; i++) {
    // The book faces the reader (Y = pi), so its local +X is the reader's left.
    const target = i === 0
      ? new THREE.Vector3(.035 + book.open * .135, -.018, .025).applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI * (1 - book.open))
      : new THREE.Vector3(-.16, -.005, .025);
    if (i === 0) target.y += .029 + .025 * (1 - book.open);
    target.applyQuaternion(book.quaternion).add(book.position);
    r.body.worldToLocal(target);
    if (book.phase === "reading" && i === 0 && r.bookTurn > 0 && !reducedMotion) {
      const sweep = Math.sin(r.bookTurn * Math.PI); target.x += sweep * .27; target.y += sweep * .105;
    }
    reach(r, i, target.toArray(), amount, -1.9);
  }
  r.root.updateMatrixWorld(true);
}

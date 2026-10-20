import { canOccupy, canTraverse, findRoomPath, findSafeSpawn, moveWithCollisions } from "./navigation.js";

export const PERSON_SPACE = .76;
export const FOOT_RADIUS = .19;
const radius = PERSON_SPACE - FOOT_RADIUS;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dot = (a, b) => a.x * b.x + a.z * b.z;
const direction = (from, to) => {
  const length = distance(from, to) || 1;
  return { x: (to.x - from.x) / length, z: (to.z - from.z) / length };
};
const segmentDistance = (point, from, to) => {
  const dx = to.x - from.x, dz = to.z - from.z;
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / (dx * dx + dz * dz || 1)));
  return distance(point, { x: from.x + dx * t, z: from.z + dz * t });
};

// Keep the grid's obstacle safety, without walking every stair-shaped grid edge.
export function smoothTrafficPath(start, path, bounds, obstacles) {
  const result = [];
  let origin = start, index = 0;
  while (index < path.length) {
    let end = index;
    for (let next = index; next < path.length; next++) {
      if (canTraverse(origin, path[next], bounds, obstacles, FOOT_RADIUS)) end = next;
    }
    result.push(path[end]); origin = path[end]; index = end + 1;
  }
  return result;
}

// A separate dynamic layer: the furniture footprint never doubles as a person.
export function createResidentTraffic(residents, room, furniture) {
  const bounds = { minX: room.minX + .14, maxX: room.maxX - .14, minZ: room.minZ + .14, maxZ: room.maxZ - .14 };
  const solids = furniture.map((o) => o.tall ? { ...o, minX: o.minX - .15, maxX: o.maxX + .15, minZ: o.minZ - .15, maxZ: o.maxZ + .15 } : o);
  let clock = 0, visitor = null;
  const peers = (actor, extra = 0) => {
    const discs = residents.filter((r) => r !== actor && r.root.visible).map((r) => ({ x: r.root.position.x, z: r.root.position.z, radius: radius + extra, actor: r.data.id }));
    if (visitor) discs.push({ ...visitor, radius: radius + extra, actor: "visitor" });
    return discs;
  };
  const obstacles = (actor, seat) => [...solids.filter((o) => !seat?.obstacle || o.id !== seat.obstacle), ...peers(actor)];
  const routeTo = (start, target, occupied) => {
    let path = findRoomPath(start, target, bounds, occupied, FOOT_RADIUS, true);
    if (!path.length && occupied.some((o) => o.actor)) path = findRoomPath(start, target, bounds, occupied, FOOT_RADIUS, true, .125);
    return path.length ? smoothTrafficPath(start, [...path, { x: target.x, z: target.z }], bounds, occupied) : [];
  };
  const plan = (r, target, occupied = obstacles(r)) => routeTo(r.root.position, target, occupied);
  const intent = (r) => {
    const target = r.action?.depart || r.path?.find((p) => distance(p, r.root.position) > .06) ||
      (!r.action?.arrived && r.action?.seat ? r.action.seat : null);
    return target ? direction(r.root.position, target) : { x: 0, z: 0 };
  };
  const canYield = (r) => {
    if (r.action?.arrived && ["offer", "receive", "talk", "point"].includes(r.action.pose)) return false;
    const walking = r.path?.length && !r.action?.arrived && !r.action?.lowering && (r.sitAmount || 0) < .04;
    const bookSafe = !r.propBusy && !r.bookHandling?.held || walking && ["fetch", "travel", "returning"].includes(r.bookHandling?.phase);
    return (r.team || r.data.kind === "walk") && !r.stageFrozen && !r.action?.depart && (!r.action?.seat || walking) && bookSafe &&
      (walking || !["drink", "type", "write", "stretch"].includes(r.action?.pose));
  };
  const yieldAside = (r, requester) => {
    if (!canYield(r) || r.traffic?.yieldTarget || (r.traffic?.yieldCooldown || 0) > clock) return false;
    const origin = r.root.position, other = requester.root.position;
    let forward = intent(requester);
    if (!Math.hypot(forward.x, forward.z)) forward = direction(other, origin);
    const own = intent(r), yaw = Math.hypot(own.x, own.z) ? Math.atan2(own.x, own.z) : r.root.rotation.y;
    const occupied = obstacles(r);
    const candidates = [];
    for (const range of [.55, .75, .95, 1.15]) for (const side of [1, -1]) for (const back of [0, .3, .6, .9]) {
      const target = { x: origin.x + forward.z * side * range + forward.x * back, z: origin.z - forward.x * side * range + forward.z * back };
      if (!canOccupy(target.x, target.z, bounds, occupied, FOOT_RADIUS) || distance(target, other) < .95) continue;
      if (requester.action && distance(target, requester.action) < PERSON_SPACE + .1) continue;
      const relative = { x: target.x - other.x, z: target.z - other.z };
      if (Math.abs(relative.x * forward.z - relative.z * forward.x) < PERSON_SPACE + .06) continue;
      const route = [other, ...(requester.path || []), ...(requester.action?.seat ? [requester.action.seat] : [])];
      if (route.some((p, i) => i && segmentDistance(target, route[i - 1], p) < PERSON_SPACE + .07)) continue;
      // A sidestep must be local and directly reachable, never a room-wide BFS excursion.
      if (!canTraverse(origin, target, bounds, occupied, FOOT_RADIUS)) continue;
      candidates.push({ target, cost: distance(origin, target) + (side < 0 ? .04 : 0) });
    }
    if (!candidates.length) return false;
    const { target } = candidates.sort((a, b) => a.cost - b.cost)[0];
    r.traffic ??= {};
    Object.assign(r.traffic, { yieldTarget: target, yieldOrigin: { x: origin.x, z: origin.z }, yieldDirection: forward,
      yieldYaw: yaw, yieldStarted: clock, yieldFor: requester.data.id, yieldAction: requester.action,
      lastProgress: clock, progressPosition: { x: origin.x, z: origin.z },
      yieldCount: (r.traffic.yieldCount || 0) + 1, waitingSince: null, nextPlan: clock + .5, clearSince: null });
    r.action ??= { x: origin.x, z: origin.z, pose: "idle", yaw: r.root.rotation.y, age: 0 };
    r.action.arrived = false;
    r.path = [target];
    return true;
  };
  return {
    tick(delta) { clock += delta; },
    setVisitor(value) { visitor = value ? { x: value.x, z: value.z } : null; },
    obstacles,
    bounds,
    pathTo(r, target, start = r.root.position) {
      return routeTo(start, target, solids);
    },
    isClear(point) { return canOccupy(point.x, point.z, bounds, solids, FOOT_RADIUS); },
    meetingSpot(preferred, participants, reserved = []) {
      const fixed = residents.filter((r) => !participants.includes(r.data.id) && r.root.visible &&
        (r.stageFrozen || r.action?.arrived && (r.action.seat || ["type", "write", "drink"].includes(r.action.pose))));
      const occupied = [...solids, ...fixed.map((r) => ({ x: r.root.position.x, z: r.root.position.z, radius })),
        ...reserved.map((p) => ({ ...p, radius })), ...(visitor ? [{ ...visitor, radius }] : [])];
      return findSafeSpawn(preferred, bounds, occupied, FOOT_RADIUS);
    },
    personObstacles(except) { return residents.filter((r) => r.data.id !== except && r.root.visible).map((r) => ({ x: r.root.position.x, z: r.root.position.z, radius: PERSON_SPACE - .28 })); },
    prepare(r, delta = .05) {
      r.traffic ??= {};
      r.traffic.delta = delta;
      r.traffic.hold = false;
      r.traffic.slowing = false;
      // A temporarily empty replan is a wait, never confirmation of arrival.
      if (r.action && !r.action.arrived && !r.action.depart && !r.action.seat && !r.path?.length && distance(r.root.position, r.action) >= .035) {
        if (clock >= (r.traffic.nextPlan || 0)) { r.path = plan(r, r.action); r.traffic.nextPlan = clock + .4; }
        if (!r.path?.length) { r.traffic.hold = true; r.traffic.speed = 0; return; }
      }
      if (!r.traffic.progressPosition || distance(r.traffic.progressPosition, r.root.position) > .08) {
        r.traffic.progressPosition = { x: r.root.position.x, z: r.root.position.z }; r.traffic.lastProgress = clock;
      }
      const detour = r.traffic.yieldTarget;
      if (detour && distance(detour, r.root.position) < .0011) {
        const requester = residents.find((p) => p.data.id === r.traffic.yieldFor);
        const contactPending = requester?.propBusy && requester.action && distance(requester.action, r.action) < PERSON_SPACE + .15;
        const relative = requester ? { x: r.traffic.yieldOrigin.x - requester.root.position.x, z: r.traffic.yieldOrigin.z - requester.root.position.z } : null;
        const requesterStalled = requester && clock - (requester.traffic?.lastProgress ?? clock) > 2.2;
        const passed = !requester || !requester.root.visible || requester.action !== r.traffic.yieldAction || requester.action?.arrived ||
          dot(relative, r.traffic.yieldDirection) < -.25 || requesterStalled;
        if (!r.traffic.resumePath || clock >= (r.traffic.nextResumeCheck || 0)) {
          r.traffic.resumePath = r.action && plan(r, r.action); r.traffic.nextResumeCheck = clock + .25;
        }
        const returning = r.traffic.resumePath;
        const clear = passed && !contactPending && returning?.length && canTraverse(r.root.position, returning[0], bounds, obstacles(r), FOOT_RADIUS);
        r.traffic.clearSince = clear ? r.traffic.clearSince ?? clock : null;
        if (r.traffic.clearSince == null || clock - r.traffic.clearSince < .2) {
          r.traffic.hold = true; r.traffic.speed = 0; r.traffic.waiting = false; return;
        }
        r.traffic.yieldTarget = null; r.traffic.yieldCooldown = clock + 1;
        r.traffic.yieldYaw = null; r.traffic.clearSince = null; r.traffic.resumePath = null; r.path = returning;
      }
      const action = r.traffic.yieldTarget || r.action || r.path?.at(-1);
      if (!action || !r.path?.length && !action.depart && !(action.seat && !action.arrived)) {
        r.traffic.speed = 0; r.traffic.heading = null; return;
      }
      // Agree on one yielder before contact; the other keeps its task and slows down.
      if (!r.traffic.yieldTarget && !action.depart) {
        const heading = intent(r);
        const blocker = residents.filter((p) => p !== r && p.root.visible && !p.traffic?.yieldTarget)
          .map((p) => {
            const offset = { x: p.root.position.x - r.root.position.x, z: p.root.position.z - r.root.position.z };
            return { p, along: dot(offset, heading), across: Math.abs(offset.x * heading.z - offset.z * heading.x) };
          }).filter(({ along, across }) => along > .05 && along < 1.8 && across < PERSON_SPACE + .07)
          .sort((a, b) => a.along - b.along)[0]?.p;
        if (blocker) {
          const otherHeading = intent(blocker), following = dot(heading, otherHeading) > .55;
          const still = !blocker.path?.length || blocker.action?.arrived;
          const next = r.path?.[0];
          const obstructsSegment = next && !canTraverse(r.root.position, next, bounds,
            [{ x: blocker.root.position.x, z: blocker.root.position.z, radius }], FOOT_RADIUS);
          if (!following && (obstructsSegment || !still)) {
            if (still) yieldAside(blocker, r);
            else if (r.index > blocker.index) yieldAside(r, blocker);
            else yieldAside(blocker, r);
          }
        }
      }
      if (clock - r.traffic.lastProgress > 1.2) {
        const blocker = residents.find((p) => p.data.id === r.traffic.blockedBy) || residents.find((p) => p !== r && p.root.visible && distance(p.root.position, r.root.position) < PERSON_SPACE + .12);
        if (blocker) {
          const still = !blocker.path?.length || blocker.action?.arrived;
          const delayed = clock - r.traffic.lastProgress > 2.4;
          if (r.traffic.yieldTarget && delayed) {
            r.traffic.yieldTarget = null; r.traffic.yieldYaw = null; r.traffic.yieldCooldown = 0; r.traffic.resumePath = null;
            r.path = plan(r, r.action);
          }
          if (still) { if (!yieldAside(blocker, r) && delayed) yieldAside(r, blocker); }
          else if (r.index > blocker.index) { if (!yieldAside(r, blocker) && delayed) yieldAside(blocker, r); }
          else if (delayed && !yieldAside(blocker, r)) yieldAside(r, blocker);
        }
      }
      if (action.depart || !r.path?.length || r.traffic.yieldTarget) return;
      if ((r.traffic.nextPlan || 0) > clock) return;
      const next = r.path.find((p) => distance(p, r.root.position) > .08) || r.path[0];
      const probe = distance(next, r.root.position) > 1
        ? { x: r.root.position.x + (next.x - r.root.position.x) / distance(next, r.root.position), z: r.root.position.z + (next.z - r.root.position.z) / distance(next, r.root.position) } : next;
      const blockedStatic = !canTraverse(r.root.position, probe, bounds, solids, FOOT_RADIUS);
      const nearby = residents.find((p) => p !== r && p.root.visible && distance(p.root.position, r.root.position) < 1.9);
      // Moving partners get time to pass. Replan around a persistent/fixed obstacle only.
      const partnerStepping = nearby?.traffic?.yieldTarget && !nearby.traffic.hold && clock - nearby.traffic.yieldStarted < 3;
      if (blockedStatic || (!partnerStepping && (r.traffic.waitingSince != null && clock - r.traffic.waitingSince > 1.3 || visitor && !canTraverse(r.root.position, probe, bounds, [...solids, ...peers(r)], FOOT_RADIUS)))) {
        r.traffic.nextPlan = clock + .9;
        const path = plan(r, action);
        if (path.length) r.path = path;
      }
    },
    move(r, dx, dz, seat) {
      r.traffic ??= {};
      const requested = Math.hypot(dx, dz), dt = r.traffic.delta || .05;
      if (!seat && !r.action?.depart && requested > .00001) {
        const heading = { x: dx / requested, z: dz / requested };
        let desired = Math.min(requested / dt, r.traffic.yieldTarget ? .58 : Infinity);
        if (r.path?.length === 1) desired = Math.min(desired, Math.max(.08, Math.sqrt(3.2 * Math.max(0, distance(r.root.position, r.path[0]) - .005))));
        const approachSpeed = desired;
        for (const p of peers(r)) {
          const relative = { x: p.x - r.root.position.x, z: p.z - r.root.position.z };
          const along = dot(relative, heading), across = Math.abs(relative.x * heading.z - relative.z * heading.x);
          if (along <= 0 || across >= PERSON_SPACE + .015) continue;
          const clearance = along - Math.sqrt(Math.max(0, PERSON_SPACE ** 2 - across ** 2));
          const target = r.path?.[0];
          // A person beyond this waypoint must not prevent reaching a safe nearby desk.
          if (target && clearance > distance(r.root.position, target)) continue;
          const partner = residents.find((r) => r.data.id === p.actor);
          const partnerMotion = partner ? intent(partner) : { x: 0, z: 0 };
          const closing = Math.max(.4, 1 - dot(heading, partnerMotion));
          const safeSegment = target && canTraverse(r.root.position, target, bounds, [p], FOOT_RADIUS);
          desired = Math.min(desired, Math.max(safeSegment ? .24 : 0, clearance - .035) / (.65 * closing));
        }
        const speed = r.traffic.speed ?? 0;
        r.traffic.slowing = desired < approachSpeed - .05;
        r.traffic.speed = Math.max(0, speed + Math.max(-2.6 * dt, Math.min(1.6 * dt, desired - speed)));
        const length = Math.min(requested, r.traffic.speed * dt);
        dx = heading.x * length; dz = heading.z * length;
        r.traffic.heading = heading;
      }
      const next = moveWithCollisions(r.root.position, dx, dz, bounds, obstacles(r, seat), FOOT_RADIUS);
      const moved = distance(next, r.root.position);
      r.traffic.waiting = requested > .0001 && moved < Math.min(requested, .02) * .2;
      if (!seat && !r.action?.depart) r.traffic.speed = moved / dt;
      if (r.traffic.waiting) { r.traffic.blockedBy = peers(r).find((o) => distance(o, r.root.position) < PERSON_SPACE + .4)?.actor || "furniture"; r.traffic.waitingSince ??= clock; }
      else { r.traffic.blockedBy = null; r.traffic.waitingSince = null; }
      return next;
    },
    canStand(r, point, seat) { return canOccupy(point.x, point.z, bounds, obstacles(r, seat), FOOT_RADIUS); },
  };
}

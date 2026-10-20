/** Axis-separated swept movement stops at furniture without tunneling on slow frames. */
export function canOccupy(x, z, bounds, obstacles, radius = 0.22) {
  if (
    x < bounds.minX + radius ||
    x > bounds.maxX - radius ||
    z < bounds.minZ + radius ||
    z > bounds.maxZ - radius
  )
    return false;
  return !obstacles.some(
    (o) => o.radius != null ? Math.hypot(x - o.x, z - o.z) < radius + o.radius - 1e-7 :
      x > o.minX - radius &&
      x < o.maxX + radius &&
      z > o.minZ - radius &&
      z < o.maxZ + radius,
  );
}

export function canTraverse(start, end, bounds, obstacles, radius = .19) {
  const count = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / .045));
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    if (!canOccupy(start.x + (end.x - start.x) * t, start.z + (end.z - start.z) * t, bounds, obstacles, radius)) return false;
  }
  return true;
}

export function moveWithCollisions(
  position,
  dx,
  dz,
  bounds,
  obstacles,
  radius = 0.22,
) {
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.08),
  );
  const stepX = dx / steps,
    stepZ = dz / steps;
  const next = { x: position.x, z: position.z };
  for (let i = 0; i < steps; i++) {
    if (canOccupy(next.x + stepX, next.z, bounds, obstacles, radius))
      next.x += stepX;
    if (canOccupy(next.x, next.z + stepZ, bounds, obstacles, radius))
      next.z += stepZ;
  }
  return next;
}

export function findSafeSpawn(preferred, bounds, obstacles, radius = 0.22) {
  if (canOccupy(preferred.x, preferred.z, bounds, obstacles, radius))
    return { x: preferred.x, z: preferred.z };
  for (let ring = 1; ring <= 60; ring++)
    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI) / 12,
        x = preferred.x + Math.cos(angle) * ring * 0.12,
        z = preferred.z + Math.sin(angle) * ring * 0.12;
      if (canOccupy(x, z, bounds, obstacles, radius)) return { x, z };
    }
  throw new Error("房间内没有可通行的出生位置。");
}

export function movementVector(input, yaw, speed, delta) {
  let forward = (input.forward ? 1 : 0) - (input.backward ? 1 : 0),
    right = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const length = Math.hypot(forward, right);
  if (length) {
    forward /= length;
    right /= length;
  }
  return {
    x: (-Math.sin(yaw) * forward + Math.cos(yaw) * right) * speed * delta,
    z: (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * speed * delta,
  };
}

export function findRoomPath(start, target, bounds, obstacles, radius = 0.19, preferRight = false, step = .25) {
  const minX = bounds.minX + radius,
    minZ = bounds.minZ + radius;
  const width = Math.floor((bounds.maxX - radius - minX) / step) + 1,
    height = Math.floor((bounds.maxZ - radius - minZ) / step) + 1;
  const point = (index) => ({
    x: minX + (index % width) * step,
    z: minZ + Math.floor(index / width) * step,
  });
  const nearest = (p) => {
    let result = -1,
      distance = Infinity;
    for (let index = 0; index < width * height; index++) {
      const candidate = point(index),
        d = Math.hypot(candidate.x - p.x, candidate.z - p.z);
      if (
        d < distance &&
        canOccupy(candidate.x, candidate.z, bounds, obstacles, radius) &&
        (p === start ? canTraverse(start, candidate, bounds, obstacles, radius) : !canOccupy(target.x, target.z, bounds, obstacles, radius) || canTraverse(candidate, target, bounds, obstacles, radius))
      ) {
        result = index;
        distance = d;
      }
    }
    return result;
  };
  const from = nearest(start),
    to = nearest(target);
  if (from < 0 || to < 0) return [];
  const queue = [from],
    previous = new Map([[from, -1]]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (preferRight) directions.sort((a, b) => (b[0] - a[0]) * (target.z - start.z) - (b[1] - a[1]) * (target.x - start.x));
  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor++];
    if (current === to) break;
    const x = current % width,
      z = Math.floor(current / width);
    for (const [dx, dz] of directions) {
      const nx = x + dx,
        nz = z + dz;
      if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue;
      const next = nz * width + nx,
        p = point(next);
      if (
        !previous.has(next) &&
        canOccupy(p.x, p.z, bounds, obstacles, radius)
      ) {
        previous.set(next, current);
        queue.push(next);
      }
    }
  }
  if (!previous.has(to)) return [];
  const path = [];
  for (let node = to; node !== -1; node = previous.get(node))
    path.push(point(node));
  return path.reverse();
}

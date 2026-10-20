// Rendered floor props, foot support and navigation use the same dimensions.
export const FLOOR_Y = -.025;
export const RUG = { x: 0, z: .65, y: .006, width: 4.6, depth: 3.25 };
export const CUSHIONS = [
  { id: "reading-cushion", x: -1.4, z: .6, color: "#809078" },
  { id: "rose-cushion", x: 1.55, z: 1.7, color: "#a5847c" },
  { id: "ochre-cushion", x: 0, z: 2.35, color: "#b59a6e" },
].map((c) => ({ ...c, width: .65, depth: .6, y: .08, height: .14, yaw: .08 }));

export const CUSHION_OBSTACLES = CUSHIONS.map((c) => {
  const x = (Math.cos(c.yaw) * c.width + Math.sin(c.yaw) * c.depth) / 2;
  const z = (Math.sin(c.yaw) * c.width + Math.cos(c.yaw) * c.depth) / 2;
  return { id: c.id, minX: c.x - x, maxX: c.x + x, minZ: c.z - z, maxZ: c.z + z };
});

// Conservative shoe footprints also cover toes crossing an edge between samples.
// Anticipation raises the foot before contact; it never lowers a solid surface.
export function supportBelow(bounds, anticipation = 0) {
  let height = FLOOR_Y, surface = "floor";
  const add = (minX, maxX, minZ, maxZ, top, name) => {
    const gap = Math.hypot(Math.max(0, minX - bounds.max.x, bounds.min.x - maxX), Math.max(0, minZ - bounds.max.z, bounds.min.z - maxZ));
    const t = gap === 0 ? 1 : anticipation ? Math.max(0, 1 - gap / anticipation) : 0;
    const candidate = FLOOR_Y + (top - FLOOR_Y) * t * t * (3 - 2 * t);
    if (candidate > height) { height = candidate; surface = name; }
  };
  add(RUG.x - RUG.width / 2, RUG.x + RUG.width / 2, RUG.z - RUG.depth / 2, RUG.z + RUG.depth / 2, RUG.y, "rug");
  add(-2.163, 2.183, 2.245, 2.375, .016, "tassels");
  add(-2.163, 2.183, -1.065, -.935, .016, "tassels");
  for (const [i, c] of CUSHIONS.entries()) {
    const b = CUSHION_OBSTACLES[i];
    add(b.minX, b.maxX, b.minZ, b.maxZ, c.y + c.height / 2, c.id);
    add(c.x - .315, c.x + .315, c.z + .281, c.z + .299, .16, c.id);
  }
  return { height, surface };
}

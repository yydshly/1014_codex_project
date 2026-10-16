const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const mix = (a, b, t) => a + (b - a) * t;

// Keep the reachable water in frame at the actual aspect ratio, including
// narrow desktop side panels that are wider than common mobile breakpoints.
export function frameSeasideCamera(camera, { width, height, entry = 1, seated = 0, lookX = 0, lookY = 0, reach = 0 }) {
  const aspect = width / Math.max(1, height);
  const compact = clamp((1.6 - aspect) / 0.9, 0, 1);
  const fov = mix(55, 68, compact);
  if (camera.aspect !== aspect || camera.fov !== fov) {
    camera.aspect = aspect;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  const insideX = mix(-0.35, 1.2, compact);
  camera.position.set(
    mix(mix(0.35, 0.65, compact), insideX, entry) - seated * mix(0.12, 0.04, compact),
    mix(1.75, 1.69, entry) - seated * 0.43,
    mix(6.4, 1.45, entry) - seated * 0.1,
  );
  const attention = reach * 0.55;
  const targetX = camera.position.x + Math.sin(lookX * (1 - attention)) * 12;
  camera.lookAt(mix(targetX, 1.85, attention * compact), 1.32 - seated * 0.25 - lookY * (1 - attention) * 9, -15);
  camera.updateMatrixWorld();
}

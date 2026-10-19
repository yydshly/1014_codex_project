import * as THREE from 'three';

// Four draw calls, no additional dynamic lights or per-frame CPU work.
// The latest 32 lanterns stay in the scene; the full history remains in local storage.
export class FocusLights extends THREE.Group {
  constructor(glowTexture) {
    super();
    this.capacity = 32;
    this.total = -1;
    const body = new THREE.MeshStandardMaterial({ color: '#f1ca87', emissive: '#efac4c', emissiveIntensity: 2.4, roughness: 0.7 });
    const shade = new THREE.MeshStandardMaterial({ color: '#59402a', roughness: 0.85 });
    this.bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.16, 0.27, 8), body, this.capacity);
    this.roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.21, 0.12, 8), shade, this.capacity);
    this.bases = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 8), shade, this.capacity);
    this.meshes = [this.bodies, this.roofs, this.bases];
    this.meshes.forEach(mesh => { mesh.count = 0; mesh.frustumCulled = false; this.add(mesh); });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.capacity * 3), 3));
    geometry.setDrawRange(0, 0);
    this.glows = new THREE.Points(geometry, new THREE.PointsMaterial({
      map: glowTexture, color: '#f5bf77', size: 1.8, opacity: 0.42,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.glows.frustumCulled = false;
    this.add(this.glows);
    this.visible = false;
  }

  setTotal(total) {
    total = Math.max(0, Math.floor(Number(total) || 0));
    if (total === this.total) return false;
    this.total = total;
    const count = Math.min(total, this.capacity);
    const matrix = new THREE.Matrix4();
    const positions = this.glows.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const index = Math.max(0, total - this.capacity) + i;
      const slot = index % this.capacity;
      const cycle = Math.floor(index / this.capacity);
      const row = Math.floor(slot / 4);
      const outer = Math.floor(slot % 4 / 2);
      // First lights follow the open water to the left of the character in both layouts.
      const x = (slot === 0 ? -1.7 : slot === 1 ? -3 : (slot % 2 ? 1 : -1) * (2.6 + outer * 1.6) * (1 + row * 0.32))
        + Math.sin(cycle * 2.4) * 0.6;
      const z = (slot === 1 ? -8.8 : -5.2 - row * 3.6 - outer * 2.2) - cycle % 3 * 0.47;
      const y = 0.27 + (slot % 3) * 0.018;
      matrix.makeTranslation(x, y, z);
      this.bodies.setMatrixAt(i, matrix);
      matrix.makeTranslation(x, y + 0.19, z);
      this.roofs.setMatrixAt(i, matrix);
      matrix.makeTranslation(x, y - 0.15, z);
      this.bases.setMatrixAt(i, matrix);
      positions.setXYZ(i, x, y, z);
    }
    this.meshes.forEach(mesh => { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; });
    positions.needsUpdate = true;
    this.glows.geometry.setDrawRange(0, count);
    this.visible = count > 0;
    return true;
  }
}

import * as THREE from 'three';

// One small, softly feathered overlay for both cheeks. It sits on the actual
// cloth triangles, so turning, tugging and squashing never leave a floating decal.
export class CheekBlush extends THREE.Mesh {
  constructor(drape) {
    const geometry = new THREE.BufferGeometry();
    const segments = 6, sideLength = segments + 1;
    const count = sideLength ** 2 * 2;
    const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2), indices = [], samples = [];
    for (let cheek = 0; cheek < 2; cheek++) {
      const center = (cheek ? 0.55 : -0.55) / (Math.PI * 2);
      for (let row = 0; row <= segments; row++) {
        for (let col = 0; col <= segments; col++) {
          const x = col / segments, y = row / segments;
          const u = ((center + (x - 0.5) * 0.07) % 1 + 1) % 1;
          const v = 0.465 + (y - 0.5) * 0.07;
          const gridX = u * drape.columns, gridY = v * drape.rows;
          const left = Math.floor(gridX), top = Math.floor(gridY), fx = gridX - left, fy = gridY - top;
          const a = top * (drape.columns + 1) + left, b = a + drape.columns + 1;
          // Match createDrape's two triangles, rather than interpolating a plane.
          samples.push(fx + fy <= 1 ? [a, b, a + 1, 1 - fx - fy, fy, fx]
            : [a + 1, b, b + 1, 1 - fy, 1 - fx, fx + fy - 1]);
          const index = cheek * sideLength ** 2 + row * sideLength + col;
          uvs.set([x, y], index * 2);
          if (row < segments && col < segments) indices.push(index, index + sideLength, index + 1,
            index + 1, index + sideLength, index + sideLength + 1);
        }
      }
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    const size = 64, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const radius = ((x + 0.5) / size * 2 - 1) ** 2 + ((y + 0.5) / size * 2 - 1) ** 2;
      const feather = Math.max(0, 1 - radius);
      pixels.set([255, 255, 255, Math.round(feather ** 2 * 255)], (y * size + x) * 4);
    }
    const map = new THREE.DataTexture(pixels, size, size);
    map.magFilter = map.minFilter = THREE.LinearFilter; map.needsUpdate = true;
    const material = new THREE.MeshPhysicalMaterial({ color: '#f2a2ac', map,
      transparent: true, opacity: 0, depthWrite: false, roughness: 0.92, metalness: 0,
      sheen: 0.85, sheenRoughness: 0.8, sheenColor: new THREE.Color('#b9d0ee') });
    super(geometry, material);
    this.drape = drape; this.samples = samples;
    this.amount = 0; this.visible = false; this.frustumCulled = false;
    this.normal = new THREE.Vector3();
    this.updateSurface();
  }

  setAmount(value) {
    this.amount = Math.max(0, Math.min(1, value));
    const wasVisible = this.visible;
    this.material.opacity = this.amount * 0.3;
    this.visible = this.amount > 0.002;
    if (this.visible && !wasVisible) this.updateSurface();
  }

  updateSurface() {
    const source = this.drape.geometry.attributes;
    const position = this.geometry.attributes.position, normal = this.geometry.attributes.normal;
    for (let i = 0; i < this.samples.length; i++) {
      const [a, b, c, wa, wb, wc] = this.samples[i];
      const n = this.normal.set(
        source.normal.getX(a) * wa + source.normal.getX(b) * wb + source.normal.getX(c) * wc,
        source.normal.getY(a) * wa + source.normal.getY(b) * wb + source.normal.getY(c) * wc,
        source.normal.getZ(a) * wa + source.normal.getZ(b) * wb + source.normal.getZ(c) * wc,
      ).normalize();
      position.setXYZ(i,
        source.position.getX(a) * wa + source.position.getX(b) * wb + source.position.getX(c) * wc + n.x * 0.009,
        source.position.getY(a) * wa + source.position.getY(b) * wb + source.position.getY(c) * wc + n.y * 0.009,
        source.position.getZ(a) * wa + source.position.getZ(b) * wb + source.position.getZ(c) * wc + n.z * 0.009,
      );
      normal.setXYZ(i, n.x, n.y, n.z);
    }
    position.needsUpdate = normal.needsUpdate = true;
  }
}

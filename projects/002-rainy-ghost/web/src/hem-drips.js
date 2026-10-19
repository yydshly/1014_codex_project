import * as THREE from 'three';

const GRAVITY = 7.2;

export class HemDrips {
  constructor(scene, body, drape, wetCloth, onWaterImpact = () => {}) {
    this.body = body;
    this.drape = drape;
    this.wetCloth = wetCloth;
    this.onWaterImpact = onWaterImpact;
    this.emitted = this.landed = 0;
    this.nextDropAt = 0;
    this.pool = Array.from({ length: 24 }, () => ({
      active: false, start: new THREE.Vector3(), velocity: new THREE.Vector3(), birth: 0, life: 0,
    }));
    this.point = new THREE.Vector3();
    this.neighbor = new THREE.Vector3();
    this.transform = new THREE.Object3D();
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshPhysicalMaterial({
      color: '#c4dfec', emissive: '#426680', emissiveIntensity: 0.23,
      roughness: 0.12, metalness: 0, clearcoat: 0.7, transparent: true, opacity: 0.82,
    }), this.pool.length);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.reset();
  }

  sampleHem(u, target) {
    const { columns, rows, geometry } = this.drape;
    const position = geometry.attributes.position;
    const column = u * columns;
    const left = Math.floor(column);
    const base = rows * (columns + 1);
    target.fromBufferAttribute(position, base + left);
    this.neighbor.fromBufferAttribute(position, base + Math.min(left + 1, columns));
    return target.lerp(this.neighbor, column - left).applyMatrix4(this.body.matrixWorld);
  }

  advance(time, dt) {
    if (dt <= 0) return;
    if (time >= this.nextDropAt) {
      const slot = this.pool.find(drop => !drop.active);
      const u = slot ? this.wetCloth.takeDrip() : null;
      if (u !== null) {
        this.sampleHem(u, slot.start);
        slot.start.y = Math.max(0.03, slot.start.y - 0.018);
        slot.velocity.set(Math.sin(u * Math.PI * 2) * 0.07, -0.12, Math.cos(u * Math.PI * 2) * 0.06);
        slot.birth = time;
        slot.life = (slot.velocity.y + Math.sqrt(slot.velocity.y ** 2 + 2 * GRAVITY * slot.start.y)) / GRAVITY;
        slot.active = true;
        this.emitted++;
        this.nextDropAt = time + 0.28;
      }
    }
    for (let i = 0; i < this.pool.length; i++) {
      const drop = this.pool[i];
      const age = time - drop.birth;
      if (drop.active && age >= drop.life) {
        this.point.copy(drop.start).addScaledVector(drop.velocity, drop.life);
        this.point.y = 0;
        this.onWaterImpact(this.point, drop.birth + drop.life);
        this.landed++;
        drop.active = false;
      }
      if (drop.active) {
        this.transform.position.copy(drop.start).addScaledVector(drop.velocity, age);
        this.transform.position.y -= GRAVITY * age * age * 0.5;
        this.transform.scale.set(0.018, 0.026 + Math.min(age, 0.4) * 0.05, 0.018);
      } else this.transform.scale.setScalar(0);
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(i, this.transform.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  get active() { return this.pool.filter(drop => drop.active).length; }

  reset() {
    this.emitted = this.landed = this.nextDropAt = 0;
    this.transform.scale.setScalar(0);
    this.transform.updateMatrix();
    this.pool.forEach((drop, i) => { drop.active = false; this.mesh.setMatrixAt(i, this.transform.matrix); });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

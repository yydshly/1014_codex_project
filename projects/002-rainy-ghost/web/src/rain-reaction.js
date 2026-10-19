import * as THREE from 'three';
import { WetCloth } from './wet-cloth.js';

const UP = new THREE.Vector3(0, 0, 1);

// Must match the seed-driven fall and wind in rainVertex.
export function rainPosition(seeds, time, target, offset = 0) {
  const fall = THREE.MathUtils.euclideanModulo(seeds[offset + 1] - time * (5 + seeds[offset + 3] * 5), 13);
  return target.set(seeds[offset] + Math.sin(time * 0.3) * fall * 0.035, fall, seeds[offset + 2]);
}

export class RainReaction {
  constructor(scene, ghost, body, cloth, onState = () => {}) {
    this.ghost = ghost;
    this.body = body;
    this.cloth = cloth;
    this.wetCloth = new WetCloth(cloth);
    this.onState = onState;
    this.dryColor = new THREE.Color('#e6e9e5');
    this.wetColor = new THREE.Color('#bacbd3');
    this.ray = new THREE.Raycaster();
    this.intersections = [];
    this.bounds = new THREE.Box3();
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.normalMatrix = new THREE.Matrix3();
    this.normal = new THREE.Vector3();
    this.time = 0;
    this.wetness = 0;
    this.hitCount = 0;
    this.recoil = 0;
    this.sway = 0;
    this.lastHeadHit = -100;
    this.lastPublish = -1;
    this.impacts = [];
    this.markIndex = 0;
    this.particleIndex = 0;
    this.body.geometry.computeBoundingBox();
    this.restBounds = this.body.geometry.boundingBox.clone();

    const ringGeometry = new THREE.RingGeometry(0.55, 1, 24);
    this.marks = Array.from({ length: 10 }, () => {
      const mark = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
        color: '#bcdff3', transparent: true, opacity: 0, depthWrite: false,
        side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1,
      }));
      mark.visible = false;
      ghost.add(mark);
      return { mesh: mark, birth: -100 };
    });

    const count = 160;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const lives = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) lives.set([-100, 0.4], i * 2);
    geometry.setAttribute('aLife', new THREE.BufferAttribute(lives, 2));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
    this.particleGeometry = geometry;
    this.particleUniforms = {
      uTime: { value: 0 }, uHeight: { value: 800 },
      uLamp: { value: new THREE.Vector3() }, uLight: { value: 1 },
    };
    this.particles = new THREE.Points(geometry, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: this.particleUniforms,
      vertexShader: /* glsl */`
        attribute vec3 aVelocity;
        attribute vec2 aLife;
        attribute float aSize;
        uniform float uTime;
        uniform float uHeight;
        varying float vAlpha;
        varying vec3 vWorld;
        void main() {
          float age = uTime-aLife.x;
          float phase = age/aLife.y;
          float alive = step(0.0,age)*(1.0-step(1.0,phase));
          float t = clamp(age,0.0,aLife.y);
          vec3 p = position+aVelocity*t+vec3(0.0,-3.6*t*t,0.0);
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          vWorld = p;
          vAlpha = alive*pow(1.0-clamp(phase,0.0,1.0),.65)*.85;
          gl_PointSize = clamp(aSize*uHeight/max(1.0,-mv.z),1.0,6.0)*alive;
          gl_Position = projectionMatrix*mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uLamp;
        uniform float uLight;
        varying float vAlpha;
        varying vec3 vWorld;
        void main() {
          float radius = length(gl_PointCoord-vec2(.5))*2.0;
          if(radius>1.0 || vAlpha<.01) discard;
          float warm = exp(-length(vWorld-uLamp)*1.15)*uLight;
          vec3 c = mix(vec3(.55,.77,1.0),vec3(1.0,.8,.48),warm);
          gl_FragColor = vec4(c,vAlpha*(1.0-smoothstep(.35,1.0,radius)));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }));
    this.particles.frustumCulled = false;
    scene.add(this.particles);
    this.applyWetMaterial();
  }

  traceRain(seeds, stops, previousTime, time, rain, stretch = 0, activeCount = seeds.length / 4) {
    if (time <= previousTime) return false;
    this.bounds.copy(this.restBounds).applyMatrix4(this.body.matrixWorld).expandByScalar(0.18 + stretch);
    this.normalMatrix.getNormalMatrix(this.body.matrixWorld);
    let changed = false;
    for (let i = 0; i < Math.min(activeCount, seeds.length / 4); i++) {
      const seedOffset = i * 4;
      rainPosition(seeds, previousTime, this.from, seedOffset);
      rainPosition(seeds, time, this.to, seedOffset);
      const stopIndex = i * 2;
      if (this.to.y > this.from.y) {
        if (stops[stopIndex] > -99) {
          stops[stopIndex] = stops[stopIndex + 1] = -100;
          changed = true;
        }
        continue;
      }
      if (seeds[seedOffset + 3] > rain || stops[stopIndex] > -99) continue;
      if (Math.max(this.from.x, this.to.x) < this.bounds.min.x || Math.min(this.from.x, this.to.x) > this.bounds.max.x ||
          this.to.z < this.bounds.min.z || this.to.z > this.bounds.max.z ||
          this.to.y > this.bounds.max.y || this.from.y < this.bounds.min.y) continue;
      this.direction.subVectors(this.to, this.from);
      const distance = this.direction.length();
      if (distance < 0.00001) continue;
      this.ray.set(this.from, this.direction.divideScalar(distance));
      this.ray.far = distance;
      this.intersections.length = 0;
      this.ray.intersectObject(this.body, false, this.intersections);
      const hit = this.intersections[0];
      if (!hit) continue;
      stops[stopIndex] = stops[stopIndex + 1] = hit.point.y;
      this.normal.copy(hit.face.normal).applyMatrix3(this.normalMatrix).normalize();
      this.impact(hit.point, this.normal, time, 0.65 + seeds[seedOffset + 3] * 0.55, hit.uv);
      changed = true;
    }
    return changed;
  }

  impact(point, normal, time, strength, uv) {
    this.wetCloth.deposit(uv, strength);
    const local = this.ghost.worldToLocal(point.clone());
    const localNormal = normal.clone().applyQuaternion(this.ghost.quaternion.clone().invert()).normalize();
    this.impacts.push({ point: local, normal: localNormal, birth: time, strength });
    if (this.impacts.length > 10) this.impacts.shift();
    this.hitCount++;
    this.wetness = Math.min(1, this.wetness + 0.01 * strength);
    this.recoil = Math.min(0.04, this.recoil + 0.014 * strength);
    this.sway = THREE.MathUtils.clamp(this.sway + local.x * 0.009 * strength, -0.025, 0.025);
    if (local.y > 1.6) this.lastHeadHit = time;

    const mark = this.marks[this.markIndex];
    this.markIndex = (this.markIndex + 1) % this.marks.length;
    mark.birth = time;
    mark.mesh.position.copy(local).addScaledVector(localNormal, 0.012);
    mark.mesh.quaternion.setFromUnitVectors(UP, localNormal);
    const position = this.particleGeometry.attributes.position;
    const velocity = this.particleGeometry.attributes.aVelocity;
    const lives = this.particleGeometry.attributes.aLife;
    const sizes = this.particleGeometry.attributes.aSize;
    for (let j = 0; j < 6; j++) {
      const index = this.particleIndex++ % position.count;
      const angle = j / 6 * Math.PI * 2 + Math.random() * 0.6;
      const speed = 0.4 + Math.random() * 0.7;
      position.setXYZ(index, point.x + normal.x * 0.02, point.y + normal.y * 0.02, point.z + normal.z * 0.02);
      velocity.setXYZ(index, Math.cos(angle) * speed + normal.x * 0.5, 0.5 + Math.random() * 0.8 + normal.y * 0.3, Math.sin(angle) * speed + normal.z * 0.5);
      lives.setXY(index, time, 0.3 + Math.random() * 0.3);
      sizes.setX(index, 0.022 + Math.random() * 0.018);
    }
    [position, velocity, lives, sizes].forEach(attribute => { attribute.needsUpdate = true; });
  }

  advance(time, dt) {
    this.time = time;
    this.particleUniforms.uTime.value = time;
    this.wetness = Math.max(0, this.wetness - dt * 0.004);
    this.wetCloth.advance(dt);
    this.recoil *= Math.exp(-dt * 10);
    this.sway *= Math.exp(-dt * 8);
    this.impacts = this.impacts.filter(impact => time - impact.birth < 0.9);
    for (const mark of this.marks) {
      const age = time - mark.birth;
      mark.mesh.visible = age >= 0 && age < 0.3;
      if (mark.mesh.visible) {
        mark.mesh.scale.setScalar(0.028 + age * 0.25);
        mark.mesh.material.opacity = (1 - age / 0.3) * 0.55;
      }
    }
    this.applyWetMaterial();
    if (time - this.lastPublish >= 0.25) {
      this.lastPublish = time;
      this.onState({ hits: this.hitCount, wetness: this.wetness, coverage: this.wetCloth.coverage,
        peak: this.wetCloth.peak, compiled: this.wetCloth.compiled, active: this.impacts.length, time });
    }
  }

  sampleCloth(x, y, z, target) {
    target.set(0, 0, 0);
    for (const impact of this.impacts) {
      const age = this.time - impact.birth;
      const distanceSq = (x - impact.point.x) ** 2 + (y - impact.point.y) ** 2 + (z - impact.point.z) ** 2;
      if (distanceSq > 1.2) continue;
      const distance = Math.sqrt(distanceSq);
      const indent = -Math.sin(age * 28) * Math.exp(-distanceSq * 36) * Math.exp(-age * 9);
      const wave = Math.sin(distance * 20 - age * 24) * Math.exp(-Math.pow((distance - age * 1.5) * 6, 2)) * Math.exp(-age * 7) * 0.3;
      target.addScaledVector(impact.normal, (indent + wave) * 0.045 * impact.strength);
    }
    return target;
  }

  applyWetMaterial() {
    this.cloth.color.copy(this.dryColor).lerp(this.wetColor, this.wetness * 0.08);
    this.cloth.roughness = 0.92 - this.wetness * 0.025;
    this.cloth.clearcoat = 0.02 + this.wetness * 0.025;
    this.cloth.clearcoatRoughness = 0.75;
    this.cloth.sheenRoughness = 0.85;
  }

  reset() {
    this.wetness = 0;
    this.wetCloth.reset();
    this.hitCount = 0;
    this.recoil = this.sway = 0;
    this.lastHeadHit = -100;
    this.impacts.length = 0;
    this.marks.forEach(mark => { mark.birth = -100; mark.mesh.visible = false; });
    const lives = this.particleGeometry.attributes.aLife;
    for (let i = 0; i < lives.count; i++) lives.setXY(i, -100, 0.4);
    lives.needsUpdate = true;
    this.applyWetMaterial();
    this.onState({ hits: 0, wetness: 0, coverage: 0, peak: 0, compiled: this.wetCloth.compiled, active: 0, time: this.time });
  }
}

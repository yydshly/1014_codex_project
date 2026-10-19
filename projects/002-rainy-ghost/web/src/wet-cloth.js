import * as THREE from 'three';

const wrap = (x, size) => ((x % size) + size) % size;

// A small UV field stays attached to the cloth as its vertices deform.
// Fixed steps make absorption/runoff independent of display refresh rate.
export class WetCloth {
  constructor(material, width = 96, height = 64) {
    this.width = width;
    this.height = height;
    this.field = new Float32Array(width * height);
    this.scratch = new Float32Array(width * height);
    this.bytes = new Uint8Array(width * height);
    this.runoff = new Float32Array(24);
    this.flows = [];
    this.accumulator = this.coverage = this.cursor = 0;
    this.texture = new THREE.DataTexture(this.bytes, width, height, THREE.RedFormat);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
    if (material) this.installMaterial(material);
  }

  installMaterial(material) {
    const size = 128;
    const fibers = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const warp = Math.sin(x * Math.PI / 2);
      const weft = Math.sin(y * Math.PI / 2);
      fibers[y * size + x] = 128 + warp * 34 + weft * 25 + warp * weft * 12;
    }
    this.fibers = new THREE.DataTexture(fibers, size, size, THREE.RedFormat);
    this.fibers.wrapS = this.fibers.wrapT = THREE.RepeatWrapping;
    this.fibers.repeat.set(3, 2);
    this.fibers.magFilter = THREE.LinearFilter;
    this.fibers.minFilter = THREE.LinearMipmapLinearFilter;
    this.fibers.generateMipmaps = true;
    this.fibers.needsUpdate = true;
    material.bumpMap = this.fibers;
    material.bumpScale = 0.012;
    material.onBeforeCompile = shader => {
      this.compiled = true;
      shader.uniforms.uClothWetMap = { value: this.texture };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vClothUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvClothUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uClothWetMap;\nvarying vec2 vClothUv;')
        .replace('#include <color_fragment>', /* glsl */`
          #include <color_fragment>
          float clothWet = smoothstep(.015, .5, texture2D(uClothWetMap, vClothUv).r);
          clothWet *= .92 + .08*sin(vClothUv.x*140.0 + sin(vClothUv.y*93.0));
          diffuseColor.rgb *= mix(vec3(1.0), vec3(.64,.73,.78), clothWet);
        `)
        .replace('#include <roughnessmap_fragment>', /* glsl */`
          #include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor-clothWet*.19, .69, 1.0);
        `);
    };
    material.customProgramCacheKey = () => 'local-wet-cloth-v1';
    material.needsUpdate = true;
  }

  stamp(u, v, strength, radiusU = 0.035, radiusV = 0.038) {
    const { width, height, field } = this;
    const cx = wrap(u, 1) * width, cy = v * (height - 1);
    const rx = radiusU * width, ry = radiusV * height;
    for (let y = Math.max(0, Math.floor(cy - ry * 2.5)); y <= Math.min(height - 1, Math.ceil(cy + ry * 2.5)); y++) {
      for (let x = Math.floor(cx - rx * 2.5); x <= Math.ceil(cx + rx * 2.5); x++) {
        const gaussian = Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
        const index = y * width + wrap(x, width);
        field[index] = Math.min(1, field[index] + strength * gaussian * (1 - field[index] * 0.7));
      }
    }
  }

  deposit(uv, strength = 1) {
    if (!uv) return;
    this.stamp(uv.x, uv.y, strength * 0.6);
    this.flows.push({ u: wrap(uv.x, 1), v: uv.y, strength: strength * 0.7 });
    if (this.flows.length > 64) this.flows.shift();
    this.upload();
  }

  advance(dt) {
    if (dt <= 0) return;
    this.accumulator += dt;
    const step = 0.05;
    while (this.accumulator >= step) {
      this.accumulator -= step;
      const { width, height, field, scratch } = this;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const left = field[y * width + wrap(x - 1, width)];
        const right = field[y * width + wrap(x + 1, width)];
        const above = y > 0 ? field[i - width] : 0;
        const below = y < height - 1 ? field[i + width] : field[i];
        const diffusion = (left + right + above + below - field[i] * 4) * 0.025;
        const downward = (above - field[i]) * 0.045;
        scratch[i] = THREE.MathUtils.clamp(field[i] + diffusion + downward - step * 0.0018, 0, 1);
        if (y === height - 1) {
          const column = Math.floor(x / width * 24);
          this.runoff[column] = Math.min(1, this.runoff[column] + field[i] * step * 0.08);
        }
      }
      this.field = scratch;
      this.scratch = field;
      this.flows = this.flows.filter(flow => {
        flow.v += step * 0.18;
        flow.strength *= Math.exp(-step * 0.12);
        this.stamp(flow.u, Math.min(flow.v, 1), step * flow.strength * 0.9, 0.013, 0.035);
        if (flow.v < 1) return true;
        const column = Math.floor(flow.u * 24);
        this.runoff[column] = Math.min(1, this.runoff[column] + flow.strength * 0.7);
        this.stamp(flow.u, 0.99, flow.strength * 0.4, 0.025, 0.04);
        return false;
      });
      this.upload();
    }
  }

  takeDrip() {
    for (let i = 0; i < 24; i++) {
      const column = (this.cursor + i) % 24;
      if (this.runoff[column] < 0.12) continue;
      this.runoff[column] -= 0.12;
      this.cursor = (column + 1) % 24;
      return (column + 0.5) / 24;
    }
    return null;
  }

  sample(u, v) {
    return this.field[Math.round(THREE.MathUtils.clamp(v, 0, 1) * (this.height - 1)) * this.width + wrap(Math.round(u * this.width), this.width)];
  }

  upload() {
    let covered = 0;
    this.peak = 0;
    for (let i = 0; i < this.field.length; i++) {
      this.bytes[i] = Math.round(this.field[i] * 255);
      if (this.field[i] > 0.08) covered++;
      this.peak = Math.max(this.peak, this.field[i]);
    }
    this.coverage = covered / this.field.length;
    this.texture.needsUpdate = true;
  }

  reset() {
    this.field.fill(0);
    this.scratch.fill(0);
    this.runoff.fill(0);
    this.flows.length = 0;
    this.accumulator = this.cursor = 0;
    this.upload();
  }

  dispose() {
    this.texture.dispose();
    this.fibers?.dispose();
  }
}

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { waterShader, rainVertex, rainFragment } from './shaders.js';
import { RainReaction } from './rain-reaction.js';
import { HemDrips } from './hem-drips.js';
import { AdaptiveQuality, qualitySettings } from './adaptive-quality.js';
import { FocusLights } from './focus-lights.js';
import { CompanionMotion } from './companion-motion.js';
import { CheekBlush } from './cheek-blush.js';
import { HeadStroke } from './head-stroke.js';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;

function makeGlow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,228,177,1)');
  gradient.addColorStop(0.12, 'rgba(255,202,124,.65)');
  gradient.addColorStop(0.34, 'rgba(255,174,77,.13)');
  gradient.addColorStop(1, 'rgba(255,145,40,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function createDrape() {
  const rows = 44;
  const columns = 72;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const skirt = Math.max(0, (t - 0.4) / 0.6);
    const capAngle = Math.min(t / 0.4, 1) * Math.PI / 2;
    for (let col = 0; col <= columns; col++) {
      const phi = col / columns * TAU;
      let radius = Math.sin(capAngle) * 0.7;
      radius *= 1 - skirt * 0.17;
      radius += Math.pow(skirt, 2.3) * 0.45;
      radius += (Math.sin(phi * 7 + 0.5) * 0.085 + Math.sin(phi * 11) * 0.035) * skirt ** 1.4;
      const y = t <= 0.4 ? 1.6 + Math.cos(capAngle) * 0.73 : 1.6 - skirt * 1.61;
      const hem = Math.sin(phi * 7 + 0.8) * 0.095 * skirt ** 7;
      positions.push(Math.sin(phi) * radius, y + hem, Math.cos(phi) * radius * 0.88);
      uvs.push(col / columns, t);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col;
        const b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  // Expanded bounds cover animation and a pulled hem without per-frame bounds scans.
  geometry.boundingSphere.radius += 1.5;
  return { geometry, rest: new Float32Array(positions), rows, columns };
}

function addMesh(parent, geometry, material, position, scale) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

export class GhostScene {
  constructor(canvas, onEvent) {
    this.canvas = canvas;
    this.onEvent = onEvent;
    this.time = 0;
    this.paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.rain = 0.72;
    this.lightOn = true;
    this.lightLevel = 1;
    this.target = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.pull = new THREE.Vector3();
    this.pullTarget = new THREE.Vector3();
    this.pullVelocity = new THREE.Vector3();
    this.pullPoint = new THREE.Vector3();
    this.pointer = new THREE.Vector2();
    this.companionMotion = new CompanionMotion();
    this.companionPoint = new THREE.Vector3();
    this.companionAnchor = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.dragPlane = new THREE.Plane();
    this.hitPoint = new THREE.Vector3();
    this.drag = null;
    this.headStroke = new HeadStroke();
    this.strokeAnchor = null;
    this.strokeDeparture = new THREE.Vector2();
    this.strokeCenter = new THREE.Vector3();
    this.strokeRight = new THREE.Vector3();
    this.strokeUp = new THREE.Vector3();
    this.strokeForward = new THREE.Vector3();
    this.strokeRotation = new THREE.Quaternion();
    this.rippleIndex = 0;
    this.lastRipple = -1;
    this.cheerUntil = -1;
    this.lastPet = -Infinity;
    this.lastStrokeVoice = -Infinity;
    this.blinkAt = 3;
    this.hidden = document.hidden;
    this.dirty = this.poseDirty = this.clothDirty = true;
    this.frameId = null;
    this.previous = null;
    this.renderCount = this.clothUpdates = 0;
    this.reflectionCount = 0;
    this.reflectionDirty = true;
    this.lastReflection = -Infinity;
    this.reflectionWorld = new THREE.Matrix4();
    this.reflectionProjection = new THREE.Matrix4();
    this.clothElapsed = this.lastRainTrace = 0;
    this.lastFrameStats = -Infinity;
    this.settlePaused = false;
    this.frame = now => this.animate(now);
    this.quality = new AdaptiveQuality(this.isPerformanceMobile(), performance.now());
    this.settings = qualitySettings(this.quality.level, this.quality.mobile, canvas.clientWidth, canvas.clientHeight, devicePixelRatio);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.settings.pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#07111c');
    this.scene.fog = new THREE.FogExp2('#07111c', 0.036);
    this.camera = new THREE.PerspectiveCamera(39, 1, 0.1, 140);
    this.camera.position.set(0, 3.25, 10.5);
    this.camera.lookAt(0, 1.7, 0);

    this.scene.add(new THREE.HemisphereLight('#a8c8ee', '#17222b', 0.65));
    const moon = new THREE.DirectionalLight('#a6c9ff', 1.3);
    moon.position.set(-4, 7, 3);
    this.scene.add(moon);
    const rim = new THREE.DirectionalLight('#6f9fcf', 1.25);
    rim.position.set(2, 4, -5);
    this.scene.add(rim);

    this.glowTexture = makeGlow();
    this.createGhost();
    this.createWater();
    this.createRain();
    this.rainReaction = new RainReaction(this.scene, this.ghost, this.body, this.clothMaterial,
      state => this.onEvent('rain-reaction', state));
    this.hemDrips = new HemDrips(this.scene, this.body, this.drape, this.rainReaction.wetCloth,
      (point, time) => this.addRippleAt(point.x, point.z, time, 0.38, 'drip'));
    this.rainDeformation = new THREE.Vector3();
    this.createBackground();
    this.focusLights = new FocusLights(this.glowTexture);
    this.scene.add(this.focusLights);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.26, 0.5, 1.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.events = {
      pointerdown: event => this.pointerDown(event),
      pointermove: event => this.pointerMove(event),
      pointerleave: event => { this.stopHeadStroke(event, !this.drag || this.drag.kind === 'head'); this.setHitTarget('background'); if (!this.drag) this.companionMotion.setAttention(0); },
      pointerup: event => this.pointerUp(event),
      pointercancel: event => this.pointerUp(event, true),
      lostpointercapture: event => this.pointerUp(event, true),
      keydown: event => this.keyDown(event),
      webglcontextlost: event => {
        event.preventDefault();
        this.onEvent('error', '图形连接已中断，请重新加载页面。');
      },
    };
    Object.entries(this.events).forEach(([name, handler]) => canvas.addEventListener(name, handler));
    // Register after picking handlers: grabbing the ghost owns that gesture.
    this.controls = new OrbitControls(this.camera, canvas);
    // OrbitControls initializes an inline "auto" cursor. Let hit-region CSS own
    // cursors instead; its default cursorStyle does not change them while orbiting.
    canvas.style.removeProperty('cursor');
    this.useCameraDamping = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.controls.enableDamping = this.useCameraDamping;
    this.controls.dampingFactor = 0.085;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.7;
    this.controls.enablePan = false;
    this.controls.minDistance = 5.5;
    this.controls.maxDistance = 17;
    this.controls.minPolarAngle = 0.55;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.08;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    this.controls.addEventListener('start', () => {
      this.stopHeadStroke();
      if (!this.paused) this.companionMotion.wake(this.time);
      canvas.classList.add('orbiting');
      this.onEvent('interact', 'camera');
      this.invalidate();
    });
    this.controls.addEventListener('end', () => { canvas.classList.remove('orbiting'); this.invalidate(); });
    this.controls.addEventListener('change', () => {
      this.onEvent('view', { angle: this.controls.getAzimuthalAngle(), distance: this.controls.getDistance() });
      this.invalidate();
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.visibilityHandler = () => {
      this.hidden = document.hidden;
      this.stopHeadStroke();
      this.setHitTarget('background');
      if (this.drag) this.drag.moved = this.drag.multi = true;
      this.previous = null;
      this.quality.resetMeasurements(performance.now());
      if (this.hidden) { cancelAnimationFrame(this.frameId); this.frameId = null; }
      else this.invalidate();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.resize();
    this.invalidate();
  }

  requestFrame() {
    if (this.frameId === null && !this.hidden && !this.disposed) {
      this.frameId = requestAnimationFrame(this.frame);
    }
  }

  invalidate(pose = false, cloth = false) {
    this.dirty = true;
    this.poseDirty ||= pose;
    this.clothDirty ||= cloth;
    this.requestFrame();
  }

  setPaused(paused) {
    this.paused = paused;
    this.stopHeadStroke();
    this.setHitTarget('background');
    if (this.drag?.kind === 'head') this.drag.moved = this.drag.multi = true;
    this.previous = null;
    this.quality.resetMeasurements(performance.now());
    this.settlePaused = false;
    this.invalidate();
  }

  createGhost() {
    this.ghost = new THREE.Group();
    this.scene.add(this.ghost);
    this.drape = createDrape();
    const cloth = new THREE.MeshPhysicalMaterial({
      color: '#e6e9e5', roughness: 0.92, metalness: 0,
      sheen: 0.85, sheenRoughness: 0.8, sheenColor: new THREE.Color('#b9d0ee'), side: THREE.DoubleSide,
    });
    this.clothMaterial = cloth;
    this.body = addMesh(this.ghost, this.drape.geometry, cloth);
    this.blush = new CheekBlush(this.drape);
    this.body.add(this.blush);
    const eyeMaterial = new THREE.MeshPhysicalMaterial({ color: '#080d12', roughness: 0.2, clearcoat: 1 });
    const eyeGeo = new THREE.SphereGeometry(1, 24, 20);
    this.eyes = [-1, 1].map(side => {
      const eye = addMesh(this.ghost, eyeGeo, eyeMaterial, [side * 0.245, 1.61, 0.6], [0.095, 0.14, 0.045]);
      const glint = addMesh(eye, new THREE.SphereGeometry(0.19, 12, 10), new THREE.MeshBasicMaterial({ color: '#fff6da' }), [-0.22, 0.29, 0.9]);
      glint.scale.set(0.8, 0.55, 0.6);
      return eye;
    });
    const smile = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.075, 1.34, 0.632), new THREE.Vector3(0, 1.28, 0.65), new THREE.Vector3(0.075, 1.34, 0.632));
    addMesh(this.ghost, new THREE.TubeGeometry(smile, 20, 0.012, 8, false), eyeMaterial);
    const armCloth = cloth.clone();
    this.leftArm = addMesh(this.ghost, new THREE.SphereGeometry(1, 24, 20), armCloth, [-0.74, 0.95, 0.2], [0.155, 0.29, 0.14]);
    this.leftArm.rotation.z = -0.8;
    this.rightArm = addMesh(this.ghost, this.leftArm.geometry, armCloth, [0.77, 0.99, 0.21], [0.16, 0.26, 0.14]);
    this.rightArm.rotation.z = 0.95;

    this.lantern = new THREE.Group();
    this.lantern.position.set(1.02, 0.42, 0.36);
    this.ghost.add(this.lantern);
    const brass = new THREE.MeshStandardMaterial({ color: '#7a5734', metalness: 0.76, roughness: 0.34 });
    const edge = new THREE.MeshStandardMaterial({ color: '#ac8450', metalness: 0.72, roughness: 0.29 });
    addMesh(this.lantern, new THREE.CylinderGeometry(0.23, 0.24, 0.055, 32), brass, [0, -0.25, 0]);
    addMesh(this.lantern, new THREE.CylinderGeometry(0.23, 0.17, 0.08, 32), brass, [0, 0.25, 0]);
    addMesh(this.lantern, new THREE.CylinderGeometry(0.11, 0.22, 0.12, 32), edge, [0, 0.34, 0]);
    const handle = addMesh(this.lantern, new THREE.TorusGeometry(0.12, 0.014, 8, 32), edge, [0, 0.49, 0]);
    handle.rotation.y = 0.2;
    for (let i = 0; i < 4; i++) {
      const phi = i / 4 * TAU + Math.PI / 4;
      const x = Math.sin(phi) * 0.19, z = Math.cos(phi) * 0.19;
      addMesh(this.lantern, new THREE.CylinderGeometry(0.012, 0.012, 0.48, 8), edge, [x, 0, z]);
    }
    const glass = new THREE.MeshPhysicalMaterial({ color: '#e8c890', transparent: true, opacity: 0.11, roughness: 0.12, side: THREE.DoubleSide, depthWrite: false });
    addMesh(this.lantern, new THREE.CylinderGeometry(0.185, 0.185, 0.44, 32, 1, true), glass);
    const filament = new THREE.MeshStandardMaterial({ color: '#ffdb98', emissive: '#ffb849', emissiveIntensity: 4.5 });
    this.flame = addMesh(this.lantern, new THREE.SphereGeometry(1, 20, 16), filament, [0, -0.02, 0], [0.075, 0.15, 0.075]);
    this.lampLight = new THREE.PointLight('#ffc378', 2.4, 8, 2);
    this.lantern.add(this.lampLight);
    // A soft fill lifts the cloth immediately around the lamp.
    this.clothLight = new THREE.PointLight('#ffca8b', 0.55, 4.5, 2);
    this.clothLight.position.set(0.6, 0.75, 0.7);
    this.ghost.add(this.clothLight);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color: '#ffd391', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.scale.setScalar(0.95);
    this.lantern.add(this.halo);
    this.lampWorld = new THREE.Vector3();
    this.pickTargets = [this.body, this.leftArm, this.rightArm, ...this.eyes, ...this.lantern.children.filter(child => child.isMesh)];
  }

  createWater() {
    const resolution = this.settings.reflectionSize;
    this.water = new Reflector(new THREE.PlaneGeometry(160, 160), {
      textureWidth: resolution, textureHeight: resolution, multisample: 0,
      clipBias: 0.003, color: '#0b1925', shader: waterShader(),
    });
    this.water.rotation.x = -Math.PI / 2;
    this.scene.add(this.water);
    this.waterUniforms = this.water.material.uniforms;
    const renderReflection = this.water.onBeforeRender;
    this.water.onBeforeRender = (renderer, scene, camera) => {
      const cameraChanged = !this.reflectionWorld.equals(camera.matrixWorld) || !this.reflectionProjection.equals(camera.projectionMatrix);
      if (!this.reflectionDirty && !cameraChanged && this.renderNow - this.lastReflection < 1000 / this.settings.reflectionHz) return;
      renderReflection.call(this.water, renderer, scene, camera);
      this.reflectionWorld.copy(camera.matrixWorld);
      this.reflectionProjection.copy(camera.projectionMatrix);
      this.reflectionDirty = false;
      this.lastReflection = this.renderNow;
      this.reflectionCount++;
    };
  }

  createRain() {
    // Allocate once. A draw range and the identical CPU prefix select active drops.
    const count = 1800;
    const positions = new Float32Array(count * 6);
    const seeds = new Float32Array(count * 8);
    this.rainSeeds = new Float32Array(count * 4);
    this.rainStops = new Float32Array(count * 2).fill(-100);
    for (let i = 0; i < count; i++) {
      positions.set([0, 0, 0, -0.025, 0.3, 0], i * 6);
      const nearGhost = i % 10 === 0;
      const seed = [nearGhost ? -3.5 + Math.random() * 8 : (Math.random() - 0.5) * 36,
        Math.random() * 13, nearGhost ? (Math.random() - 0.5) * 5.6 : (Math.random() - 0.55) * 32, Math.random()];
      this.rainSeeds.set(seed, i * 4);
      seeds.set(seed, i * 8);
      seeds.set(seed, i * 8 + 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geometry.setAttribute('aStopHeight', new THREE.BufferAttribute(this.rainStops, 1));
    this.rainUniforms = { uTime: { value: 0 }, uRain: { value: this.rain }, uLamp: { value: new THREE.Vector3() }, uLight: { value: 1 } };
    const material = new THREE.ShaderMaterial({ uniforms: this.rainUniforms, vertexShader: rainVertex, fragmentShader: rainFragment, transparent: true, depthWrite: false });
    this.rainLines = new THREE.LineSegments(geometry, material);
    this.rainLines.frustumCulled = false;
    this.scene.add(this.rainLines);
  }

  createBackground() {
    const points = [[-7, -11], [-3.9, -15], [-1.9, -19], [1.8, -13], [5.5, -16], [9, -12], [-12, -19]];
    points.forEach(([x, z], i) => {
      const lamp = new THREE.Group();
      lamp.position.set(x, 0.25 + (i % 3) * 0.025, z);
      const material = new THREE.MeshStandardMaterial({ color: '#d6ac70', emissive: '#d6943a', emissiveIntensity: 1.7 });
      addMesh(lamp, new THREE.CylinderGeometry(0.13, 0.16, 0.25, 8), material);
      const shade = new THREE.MeshStandardMaterial({ color: '#443422', roughness: 0.8 });
      addMesh(lamp, new THREE.ConeGeometry(0.21, 0.12, 8), shade, [0, 0.18, 0]);
      addMesh(lamp, new THREE.CylinderGeometry(0.2, 0.2, 0.035, 12), shade, [0, -0.14, 0]);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color: '#d9ad6e', opacity: 0.23, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(1.5);
      lamp.add(glow);
      this.scene.add(lamp);
    });
  }

  resize() {
    this.stopHeadStroke();
    if (this.drag?.kind === 'head') this.drag.moved = this.drag.multi = true;
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    const mobile = width < 650 && height > width;
    const layoutChanged = this.mobile !== mobile;
    this.mobile = mobile;
    this.camera.aspect = width / height;
    this.camera.fov = this.mobile ? 47 : 39;
    this.camera.updateProjectionMatrix();
    this.quality.setDevice(this.isPerformanceMobile(), performance.now());
    this.applyQuality('viewport');
    if (this.mobile) {
      const intro = document.querySelector('.intro').getBoundingClientRect();
      const toolbar = document.querySelector('.toolbar').getBoundingClientRect();
      const canvasTop = this.canvas.getBoundingClientRect().top;
      const top = intro.bottom - canvasTop + 12;
      const bottom = toolbar.top - canvasTop - 14;
      const stageHeight = Math.max(100, bottom - top);
      const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      this.mobileDistance = clamp(Math.max(2.9 * height / (stageHeight * 0.85), 3.3 / (this.camera.aspect * 0.86)) / (2 * tangent), 7.5, 17);
      this.camera.setViewOffset(width, height, 0, height / 2 - (top + bottom) / 2, width, height);
    } else this.camera.clearViewOffset();
    if (layoutChanged || this.mobile) this.resetView();
    this.invalidate(true, true);
  }

  isPerformanceMobile() {
    return matchMedia('(any-pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 650;
  }

  setFocusLights(total) {
    if (!this.focusLights.setTotal(total)) return;
    this.reflectionDirty = true;
    this.onEvent('focus-lights', { total: this.focusLights.total, visible: this.focusLights.bodies.count });
    this.invalidate();
  }

  applyQuality(reason) {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    const previousRain = this.activeRainCount || 0;
    const settings = qualitySettings(this.quality.level, this.quality.mobile, width, height, devicePixelRatio);
    this.settings = settings;
    this.renderer.setPixelRatio(settings.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(settings.pixelRatio);
    this.composer.setSize(width, height);
    // Keep bloom at every tier; only its blur buffers become smaller.
    this.bloom.setSize(width * settings.pixelRatio * settings.bloomScale, height * settings.pixelRatio * settings.bloomScale);
    this.water.getRenderTarget().setSize(settings.reflectionSize, settings.reflectionSize);
    this.waterUniforms.uRainDetail.value = settings.waterDetail;
    this.activeRainCount = settings.rainCount;
    this.rainLines.geometry.setDrawRange(0, this.activeRainCount * 2);
    if (this.activeRainCount > previousRain) {
      this.rainStops.fill(-100, previousRain * 2, this.activeRainCount * 2);
      this.rainLines.geometry.attributes.aStopHeight.needsUpdate = true;
    }
    this.rainReaction.particleUniforms.uHeight.value = height * settings.pixelRatio;
    this.lastRainTrace = this.time;
    this.reflectionDirty = true;
    this.publishQuality(reason);
    this.invalidate();
  }

  publishQuality(reason) {
    this.onEvent('quality', {
      ...this.settings, reason, mobile: this.quality.mobile,
      fps: this.quality.fps, frameMs: this.quality.frameMs, workMs: this.quality.workMs,
      changes: this.quality.changes,
      renderWidth: this.canvas.width, renderHeight: this.canvas.height,
    });
  }

  stopCameraMotion() {
    // Flush the public damping accumulator, then restore the visible pose.
    const position = this.camera.position.clone();
    const target = this.controls.target.clone();
    this.controls.enableDamping = false;
    this.controls.update();
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.controls.update();
    this.controls.enableDamping = this.useCameraDamping;
  }

  resetView() {
    this.stopCameraMotion();
    const distance = this.mobileDistance || 10.7;
    this.camera.position.set(0, this.mobile ? 1.75 + distance * 0.15 : 3.25, this.mobile ? distance : 10.5);
    this.controls.target.set(0, this.mobile ? 1.75 : 1.7, 0);
    this.controls.update();
  }

  updateClothSpring(dt) {
    // A damped spring makes a released hem overshoot and settle naturally.
    this.pullVelocity.addScaledVector(this.pullTarget.clone().sub(this.pull).multiplyScalar(80), dt);
    this.pullVelocity.multiplyScalar(Math.exp(-12 * dt));
    this.pull.addScaledVector(this.pullVelocity, dt);
  }

  updateCloth() {
    this.clothUpdates++;
    const positions = this.drape.geometry.attributes.position;
    const rest = this.drape.rest;
    const wetness = this.rainReaction.wetness;
    const flutter = (0.75 + this.rain * 0.65) * (1 - wetness * 0.28);
    for (let i = 0; i < positions.count; i++) {
      const index = i * 3;
      const x = rest[index], y = rest[index + 1], z = rest[index + 2];
      const skirt = clamp((1.6 - y) / 1.6, 0, 1);
      const phi = Math.atan2(x, z);
      const wave = (Math.sin(phi * 3 + this.time * 1.9 + y * 2) * 0.045 + Math.sin(phi * 7 - this.time * 2.6) * 0.02) * flutter;
      const distance = (x - this.pullPoint.x) ** 2 + (y - this.pullPoint.y) ** 2 + (z - this.pullPoint.z) ** 2;
      const weight = Math.exp(-distance * 3.5) * skirt;
      const impact = this.rainReaction.sampleCloth(x, y, z, this.rainDeformation);
      positions.setXYZ(i,
        x + wave * skirt * Math.sin(phi) + Math.sin(this.time * 1.1 + y) * skirt ** 2 * 0.07 + this.pull.x * weight + impact.x,
        y + Math.sin(phi * 5 + this.time * 2) * 0.035 * skirt ** 3 + this.pull.y * weight - wetness * skirt ** 2 * 0.055 + impact.y,
        z + wave * skirt * Math.cos(phi) + this.pull.z * weight + impact.z,
      );
    }
    positions.needsUpdate = true;
    this.drape.geometry.computeVertexNormals();
    if (this.blush.visible) this.blush.updateSurface();
  }

  animate(now) {
    this.frameId = null;
    if (this.hidden) return;
    if (!this.quality.shouldRender(now, !this.paused)) { this.requestFrame(); return; }
    const workStart = performance.now();
    this.renderNow = now;
    const dt = this.previous === null ? 0 : Math.max(0, Math.min((now - this.previous) / 1000, 0.04));
    this.previous = now;
    const runningDt = this.paused ? 0 : dt;
    this.time += runningDt;
    const settleDt = !this.paused || this.settlePaused ? dt : 0;
    const updatePose = !this.paused || this.poseDirty || this.settlePaused;
    if (updatePose) {
      const company = this.companionMotion.sample(this.time, runningDt, Boolean(this.drag));
      this.blush.setAmount(company.blush);
      if (company.noticed && !this.paused && !this.companionMotion.isStroking(this.time)) this.onEvent('companion-approach');
      this.velocity.addScaledVector(this.target.clone().sub(this.offset).multiplyScalar(28), settleDt);
      this.velocity.multiplyScalar(Math.exp(-7 * settleDt));
      this.offset.addScaledVector(this.velocity, settleDt);
      if (runningDt > 0) this.rainReaction.advance(this.time, runningDt);
      const baseX = this.mobile ? 0 : 1.05;
      const baseY = this.mobile ? 0.65 : 0.9;
      this.ghost.position.set(baseX + this.offset.x, baseY + this.offset.y + Math.sin(this.time * 1.5) * 0.09 - this.rainReaction.recoil * 0.35 - company.tuck * 0.1, this.offset.z);
      this.ghost.scale.set(1 + company.tuck * 0.045, 1 - company.tuck * 0.1, 1 + company.tuck * 0.035);
      this.ghost.rotation.z = Math.sin(this.time * 0.85) * 0.035 - this.velocity.x * 0.045 + this.rainReaction.sway + company.lean;
      this.ghost.rotation.x = Math.sin(this.time * 24) * this.rainReaction.recoil * 0.35 + company.nod;
      this.ghost.rotation.y = Math.sin(this.time * 0.55) * 0.07 + this.pointer.x * 0.06 * company.attention + company.lookX * 0.12;
      this.applyStrokePose(company);
      this.ghost.updateMatrixWorld(true);
      this.updateClothSpring(settleDt);
      this.clothElapsed += settleDt;
      const clothStep = 1 / this.settings.clothHz;
      if (this.clothDirty || this.settlePaused || this.drag?.kind === 'hem' || this.clothElapsed >= clothStep) {
        this.updateCloth();
        this.clothElapsed %= clothStep;
      }
      if (runningDt > 0 && this.time - this.lastRainTrace >= 1 / this.settings.collisionHz) {
        if (this.rainReaction.traceRain(this.rainSeeds, this.rainStops, this.lastRainTrace, this.time, this.rain, this.pull.length(), this.activeRainCount)) {
          this.rainLines.geometry.attributes.aStopHeight.needsUpdate = true;
        }
        this.lastRainTrace = this.time;
      }
      this.leftArm.rotation.z = -0.8 + Math.sin(this.time * 1.8) * 0.08 + company.tuck * 0.3;
      if (this.time < this.cheerUntil) this.leftArm.rotation.z -= 0.5 + Math.sin(this.time * 16) * 0.23;
      this.lantern.rotation.z = Math.sin(this.time * 1.7) * 0.09 + this.velocity.x * 0.07;
      this.lantern.rotation.x = Math.sin(this.time * 1.1) * 0.04;
      this.lantern.position.y = 0.42 + company.lift;
      this.rightArm.position.y = 0.99 + company.lift * 0.55;
      this.rightArm.rotation.z = 0.95 + company.lift * 0.4 - company.tuck * 0.18;
      const blinkElapsed = this.time - this.blinkAt;
      let eyeScale = blinkElapsed > 0 && blinkElapsed < 0.2 ? Math.max(0.07, Math.abs(blinkElapsed - 0.1) * 10) : 1;
      if (blinkElapsed > 0.2) this.blinkAt = this.time + 3 + Math.random() * 4;
      if (this.time < this.cheerUntil) eyeScale = 0.72;
      if (this.rain > 0.85 && this.time - this.rainReaction.lastHeadHit < 0.13) eyeScale = Math.min(eyeScale, 0.45);
      this.eyes.forEach((eye, index) => {
        eye.scale.y = 0.14 * Math.min(eyeScale, company.eyes);
        eye.position.x = (index ? 1 : -1) * 0.245 + company.lookX * 0.028;
        eye.position.y = 1.61 + company.lookY * 0.022;
      });
    }
    const lightTarget = this.lightOn ? 1 : 0.06;
    this.lightLevel = THREE.MathUtils.damp(this.lightLevel, lightTarget, 5, dt);
    const lightMoving = Math.abs(this.lightLevel - lightTarget) > 0.001;
    if (!lightMoving) this.lightLevel = lightTarget;
    const flicker = 1 + Math.sin(this.time * 9) * 0.025 + Math.sin(this.time * 15) * 0.015;
    this.lampLight.intensity = 2.4 * this.lightLevel * flicker;
    this.clothLight.intensity = 0.55 * this.lightLevel;
    this.flame.material.emissiveIntensity = 4.5 * this.lightLevel;
    this.flame.scale.y = 0.15 * flicker;
    this.halo.material.opacity = 0.12 * this.lightLevel;
    this.ghost.updateMatrixWorld(true);
    if (runningDt > 0) this.hemDrips.advance(this.time, runningDt);
    this.lantern.getWorldPosition(this.lampWorld);
    this.waterUniforms.uTime.value = this.time;
    this.waterUniforms.uRain.value = this.rain;
    this.waterUniforms.uLamp.value.copy(this.lampWorld);
    this.waterUniforms.uLight.value = this.lightLevel;
    this.rainUniforms.uTime.value = this.time;
    this.rainUniforms.uRain.value = this.rain;
    this.rainUniforms.uLamp.value.copy(this.lampWorld);
    this.rainUniforms.uLight.value = this.lightLevel;
    this.rainReaction.particleUniforms.uLamp.value.copy(this.lampWorld);
    this.rainReaction.particleUniforms.uLight.value = this.lightLevel;
    const cameraMoving = this.controls.enabled && this.controls.update();
    if (!this.paused || this.dirty || updatePose || cameraMoving || lightMoving) {
      this.reflectionDirty ||= this.paused && (this.dirty || updatePose || lightMoving);
      this.composer.render();
      this.renderCount++;
    }
    this.dirty = this.poseDirty = this.clothDirty = false;
    const springsMoving = this.target.distanceToSquared(this.offset) + this.velocity.lengthSq() + this.pullTarget.distanceToSquared(this.pull) + this.pullVelocity.lengthSq() > 0.000001;
    this.settlePaused &&= springsMoving;
    const needsFrame = !this.paused || cameraMoving || lightMoving || this.settlePaused;
    if (this.paused || !this.ready || now - this.lastFrameStats >= 250) {
      this.lastFrameStats = now;
      this.onEvent('frame', {
        renders: this.renderCount, cloth: this.clothUpdates, reflections: this.reflectionCount, idle: !needsFrame,
        drops: this.hemDrips.emitted, landed: this.hemDrips.landed, falling: this.hemDrips.active,
      });
      this.companionAnchor.set(0, 2.65, 0.3).applyMatrix4(this.ghost.matrixWorld).project(this.camera);
      this.onEvent('companion-frame', {
        x: (this.companionAnchor.x + 1) * this.canvas.clientWidth / 2,
        y: (1 - this.companionAnchor.y) * this.canvas.clientHeight / 2,
        attention: this.companionMotion.attention, lift: this.lantern.position.y - 0.42,
        kind: this.companionMotion.pose.kind,
        tuck: this.companionMotion.pose.tuck, squint: this.companionMotion.pose.squint,
        blush: this.blush.material.opacity,
        strokeX: this.companionMotion.pose.strokeX, strokeY: this.companionMotion.pose.strokeY,
        nuzzle: this.companionMotion.pose.nuzzle, comfort: this.companionMotion.pose.comfort,
        farewell: this.companionMotion.pose.farewell, farewellX: this.companionMotion.pose.farewellX, farewellY: this.companionMotion.pose.farewellY,
        eyes: Math.min(...this.eyes.map(eye => eye.scale.y / 0.14)),
      });
    }
    const qualityReport = this.quality.sample(now, performance.now() - workStart, !this.paused);
    if (qualityReport?.changed) this.applyQuality(qualityReport.reason);
    else if (qualityReport) this.publishQuality(qualityReport.reason);
    if (!this.ready) { this.ready = true; this.onEvent('ready', { paused: this.paused }); }
    if (needsFrame) this.requestFrame();
  }

  setPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  pickKind(hit) {
    if (!hit) return 'background';
    if (hit.object.parent === this.lantern) return 'lamp';
    const local = this.ghost.worldToLocal(hit.point.clone());
    return hit.object === this.body && local.y >= 1.82 ? 'head'
      : hit.object === this.body && local.y < 0.7 ? 'hem' : 'ghost';
  }

  setHitTarget(kind, event) {
    this.canvas.dataset.hitTarget = kind;
    this.onEvent('hover', { kind, x: event?.clientX || 0, y: event?.clientY || 0,
      mouse: event?.pointerType === 'mouse', active: this.drag?.kind === 'head' });
  }

  strokeHead(event) {
    if (this.paused || this.hidden || this.drag?.multi) { this.stopHeadStroke(); return; }
    this.strokeCenter.set(0, 2.06, 0).applyMatrix4(this.ghost.matrixWorld);
    const distance = this.camera.position.distanceTo(this.strokeCenter);
    const width = this.canvas.clientHeight * 1.3 * this.ghost.scale.x * this.camera.zoom
      / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * Math.max(1, distance));
    const pulse = this.headStroke.move(event.clientX, event.clientY, event.timeStamp, width, this.drag?.kind === 'head');
    if (this.headStroke.interrupted) this.companionMotion.endStroke();
    const movement = this.headStroke.movement;
    if (!movement) return;
    this.strokeCenter.project(this.camera);
    const bounds = this.canvas.getBoundingClientRect();
    const centerX = bounds.left + (this.strokeCenter.x + 1) * this.canvas.clientWidth / 2;
    const centerY = bounds.top + (1 - this.strokeCenter.y) * this.canvas.clientHeight / 2;
    const x = (event.clientX - centerX) / (width * 0.42);
    const y = (centerY - event.clientY) / (width * 0.42);
    const length = Math.hypot(movement.x, movement.y);
    this.strokeDeparture.set(movement.x / length, -movement.y / length);
    const fresh = this.companionMotion.stroke(x * 0.8 + movement.x / length * 0.2, y * 0.8 - movement.y / length * 0.2, this.time, pulse);
    if (fresh) {
      this.strokeAnchor = { x: centerX, y: centerY, width };
      this.petHead({ stroke: true });
    }
  }

  pickStrokeKind(hit, event) {
    const kind = this.pickKind(hit), anchor = this.strokeAnchor;
    // A little screen-space hysteresis prevents the shy shrink/nuzzle from
    // pulling the head out from under a still-gentle hand. New grabs use real hits.
    if ((kind === 'background' || kind === 'ghost') && anchor && this.companionMotion.strokeSession
      && this.time - this.companionMotion.strokePulse <= 1.4
      && ((event.clientX - anchor.x) / (anchor.width * 0.55 + 4)) ** 2
        + ((event.clientY - anchor.y) / (anchor.width * 0.30 + 4)) ** 2 <= 1) return 'head';
    return kind;
  }

  stopHeadStroke(event, natural = false) {
    if (natural && !this.paused && !this.hidden && !this.drag?.multi) {
      let x = this.strokeDeparture.x, y = this.strokeDeparture.y;
      const last = this.headStroke.last;
      if (last && event) {
        const dx = event.clientX - last.x, dy = last.y - event.clientY, distance = Math.hypot(dx, dy);
        if (distance > 2) { x = dx / distance; y = dy / distance; }
      }
      this.companionMotion.releaseStroke(this.time, x, y);
    } else this.companionMotion.endStroke();
    this.headStroke.reset();
    this.strokeAnchor = null;
    this.strokeDeparture.set(0, 0);
  }

  applyStrokePose(company) {
    // Camera axes keep the tiny lean/nuzzle aligned with the hand after orbiting.
    // This is a pose offset; the body's drag target and spring never move.
    this.strokeRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.strokeUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.camera.getWorldDirection(this.strokeForward);
    this.ghost.position.addScaledVector(this.strokeRight, company.strokeX * 0.035)
      .addScaledVector(this.strokeUp, company.strokeY * 0.018)
      .addScaledVector(this.strokeForward, -company.nuzzle);
    this.strokeRotation.setFromAxisAngle(this.strokeForward, company.strokeX * 0.065 + (company.farewellX || 0) * 0.018);
    this.ghost.quaternion.premultiply(this.strokeRotation);
    this.strokeRotation.setFromAxisAngle(this.strokeRight, -company.strokeY * 0.03 - (company.farewellY || 0) * 0.012);
    this.ghost.quaternion.premultiply(this.strokeRotation);
  }

  pointerDown(event) {
    if (this.drag) {
      if (event.pointerId !== this.drag.id) {
        this.drag.moved = this.drag.multi = true;
        this.stopHeadStroke(); this.setHitTarget('background');
      }
      return;
    }
    if (!event.isPrimary || event.button !== 0) return;
    if (!this.paused) this.companionMotion.wake(this.time);
    this.companionMotion.setAttention(0);
    this.canvas.focus({ preventScroll: true });
    this.setPointer(event);
    this.stopHeadStroke();
    const hit = this.raycaster.intersectObjects(this.pickTargets, false)[0];
    const start = new THREE.Vector2(event.clientX, event.clientY);
    if (hit) {
      this.stopCameraMotion();
      this.controls.enabled = false;
      event.stopImmediatePropagation();
      const local = this.ghost.worldToLocal(hit.point.clone());
      const kind = this.pickKind(hit);
      this.dragPlane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()), hit.point);
      this.drag = { kind, id: event.pointerId, start, world: hit.point.clone(), target: this.target.clone(), moved: false };
      if (kind === 'head') this.headStroke.begin(event.clientX, event.clientY, event.timeStamp);
      if (kind === 'hem') { this.pullPoint.copy(local); this.pull.set(0, 0, 0); this.pullVelocity.set(0, 0, 0); }
      this.canvas.classList.add(kind === 'head' ? 'petting' : 'dragging');
      this.setHitTarget(kind, event);
      this.onEvent('interact', kind);
      this.canvas.setPointerCapture(event.pointerId);
    } else {
      this.setHitTarget('background', event);
      this.stopCameraMotion();
      this.drag = { kind: 'camera', id: event.pointerId, start, moved: false };
    }
  }

  pointerMove(event) {
    if (!this.paused) this.companionMotion.wake(this.time);
    this.setPointer(event);
    if (this.drag && this.drag.id === event.pointerId) {
      this.drag.moved ||= this.drag.start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 7;
      if (this.drag.kind === 'head') {
        const kind = this.pickStrokeKind(this.raycaster.intersectObjects(this.pickTargets, false)[0], event);
        this.setHitTarget(kind, event);
        if (kind === 'head') this.strokeHead(event); else this.stopHeadStroke(event, true);
        event.stopImmediatePropagation();
        return;
      }
      // OrbitControls sees the original pointerdown, but no movement until the same
      // threshold used for clicks is crossed. Captured events bubble via the canvas.
      if (this.drag.kind === 'camera' && !this.drag.moved) {
        event.stopImmediatePropagation();
        return;
      }
      if (this.drag.moved && this.drag.kind !== 'camera' && this.drag.kind !== 'lamp' && this.raycaster.ray.intersectPlane(this.dragPlane, this.hitPoint)) {
        const delta = this.hitPoint.clone().sub(this.drag.world);
        if (this.drag.kind === 'hem') {
          delta.applyQuaternion(this.ghost.quaternion.clone().invert());
          this.pullTarget.copy(delta).clampLength(0, 1.5);
        } else {
          this.target.set(clamp(this.drag.target.x + delta.x, this.mobile ? -1.1 : -2.8, this.mobile ? 1.1 : 2.2), clamp(this.drag.target.y + delta.y, -0.35, 1.5), clamp(this.drag.target.z + delta.z, -2.2, 2.2));
        }
        this.settlePaused = this.paused;
        this.invalidate(true, true);
      }
    } else if (!this.drag) {
      const hit = this.raycaster.intersectObjects(this.pickTargets, false)[0];
      const kind = this.pickStrokeKind(hit, event);
      this.setHitTarget(kind, event);
      if (kind === 'head' && event.pointerType === 'mouse' && !event.buttons) this.strokeHead(event);
      else this.stopHeadStroke(event, event.pointerType === 'mouse' && !event.buttons);
      if (event.pointerType !== 'touch') this.updateCompanionAttention();
    }
  }

  pointerUp(event, canceled = false) {
    if (!this.drag || this.drag.id !== event.pointerId) return;
    const drag = this.drag;
    drag.moved ||= drag.start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 7;
    this.drag = null;
    this.stopHeadStroke(event, !canceled && drag.kind === 'head' && !drag.multi && drag.moved);
    this.pullTarget.set(0, 0, 0);
    if (drag.kind === 'hem' || drag.kind === 'ghost' || drag.kind === 'head') {
      this.settlePaused = this.paused;
      this.invalidate(true, true);
    }
    this.canvas.classList.remove('dragging');
    this.canvas.classList.remove('petting');
    if (drag.kind !== 'camera') {
      this.controls.enabled = true;
      event.stopImmediatePropagation();
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    }
    if (!canceled && !drag.moved) {
      if (drag.kind === 'lamp') this.toggleLight();
      else if (drag.kind === 'head') this.petHead();
      else if (drag.kind === 'ghost') this.greet();
      else if (drag.kind === 'camera') { this.setPointer(event); this.addWaterRipple(); }
    }
    if (!canceled && !drag.moved && event.pointerType !== 'touch') this.updateCompanionAttention();
    if (!canceled) {
      this.setPointer(event);
      this.setHitTarget(this.pickKind(this.raycaster.intersectObjects(this.pickTargets, false)[0]), event);
    } else this.setHitTarget('background');
  }

  updateCompanionAttention() {
    if (this.companionMotion.isSeeingOff(this.time)) return;
    this.companionPoint.set(0, 1.4, 0.2).applyMatrix4(this.ghost.matrixWorld);
    const distance = this.raycaster.ray.distanceToPoint(this.companionPoint);
    this.companionPoint.project(this.camera);
    this.companionMotion.setAttention(clamp(1 - (distance - 0.5) / 1.3, 0, 1),
      (this.pointer.x - this.companionPoint.x) / 0.3, (this.pointer.y - this.companionPoint.y) / 0.3);
  }

  addWaterRipple() {
    if (!this.raycaster.ray.intersectPlane(this.waterPlane, this.hitPoint)) return;
    if (Math.abs(this.hitPoint.x) > 25 || Math.abs(this.hitPoint.z) > 25) return;
    this.addRippleAt(this.hitPoint.x, this.hitPoint.z, this.time - 0.001, 1, 'pointer');
  }

  addRippleAt(x, z, time, strength, source) {
    this.waterUniforms.uRipples.value[this.rippleIndex].set(x, z, time, strength);
    this.rippleIndex = (this.rippleIndex + 1) % 16;
    this.lastRipple = this.time;
    this.onEvent('ripple', { x, z, source });
    this.invalidate();
  }

  keyDown(event) {
    const delta = { ArrowLeft: [-0.22, 0], ArrowRight: [0.22, 0], ArrowUp: [0, 0.16], ArrowDown: [0, -0.16] }[event.key];
    if (delta) {
      this.stopHeadStroke();
      if (!this.paused) this.companionMotion.wake(this.time);
      event.preventDefault();
      this.target.addScaledVector(new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0), delta[0]);
      this.target.x = clamp(this.target.x, this.mobile ? -1.1 : -2.8, this.mobile ? 1.1 : 2.2);
      this.target.y = clamp(this.target.y + delta[1], -0.35, 1.5);
      this.target.z = clamp(this.target.z, -2.2, 2.2);
      this.onEvent('interact', 'keyboard');
      this.settlePaused = this.paused;
      this.invalidate(true, false);
    } else if (event.code === 'Space') { event.preventDefault(); this.onEvent('request-pause'); }
    else if (event.key.toLowerCase() === 'l') this.toggleLight();
    else if (event.key.toLowerCase() === 'h' && !event.repeat) this.petHead();
    else if (event.key.toLowerCase() === 'r') this.reset();
  }

  greet() {
    if (this.paused || this.hidden || this.drag) return;
    this.onEvent('greet');
  }

  petHead({ stroke = false } = {}) {
    if (this.paused || this.hidden || this.drag && this.drag.kind !== 'head' || this.drag?.multi || this.time - this.lastPet < 2.2) return false;
    this.lastPet = this.time;
    if (!stroke) this.stopHeadStroke();
    const sound = !stroke || this.time - this.lastStrokeVoice >= 12;
    if (stroke && sound) this.lastStrokeVoice = this.time;
    this.onEvent('pet', { stroke, sound });
    return true;
  }

  reactToCompanion(kind, familiar) {
    if (this.paused || this.hidden || this.drag && !(kind === 'pet' && this.drag.kind === 'head' && !this.drag.multi)) return;
    if ((kind === 'approach' || kind === 'settled') && (this.companionMotion.isStroking(this.time) || this.companionMotion.isSeeingOff(this.time))) return;
    if (kind === 'pet' || kind === 'nod') this.cheerUntil = -1;
    if (kind === 'greet') this.cheerUntil = this.time + 2.4;
    this.companionMotion.cue(kind, this.time, familiar);
    this.invalidate(true);
  }

  toggleLight() {
    this.lightOn = !this.lightOn;
    this.onEvent('light', this.lightOn);
    this.invalidate();
  }

  reset() {
    this.stopHeadStroke();
    this.setHitTarget('background');
    this.companionMotion.reset();
    this.companionMotion.wake(this.time);
    this.lastPet = -Infinity;
    this.lastStrokeVoice = -Infinity;
    this.cheerUntil = -1;
    this.target.set(0, 0, 0);
    this.offset.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.pull.set(0, 0, 0);
    this.pullTarget.set(0, 0, 0);
    this.pullVelocity.set(0, 0, 0);
    this.pointer.set(0, 0);
    this.lightOn = true;
    this.lightLevel = 1;
    this.rain = 0.72;
    this.rainStops.fill(-100);
    this.rainLines.geometry.attributes.aStopHeight.needsUpdate = true;
    this.rainReaction.reset();
    this.lastRainTrace = this.time;
    this.hemDrips.reset();
    this.resetView();
    this.waterUniforms.uRipples.value.forEach(ripple => ripple.set(0, 0, -100, 0));
    this.onEvent('reset');
    this.invalidate(true, true);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    Object.entries(this.events).forEach(([name, handler]) => this.canvas.removeEventListener(name, handler));
    const geometries = new Set(), materials = new Set();
    this.scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    this.glowTexture.dispose();
    this.blush.material.map.dispose();
    this.rainReaction.wetCloth.dispose();
    this.water.getRenderTarget().dispose();
    this.composer.passes.forEach(pass => pass.dispose?.());
    this.composer.dispose();
    this.renderer.dispose();
  }
}

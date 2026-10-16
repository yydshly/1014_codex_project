import * as THREE from 'three';
import { OrbitControls } from './vendor/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from './vendor/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from './vendor/examples/jsm/loaders/DRACOLoader.js';
import { Reflector } from './vendor/examples/jsm/objects/Reflector.js';

const shell = document.getElementById('scene-shell');
const stage = document.getElementById('scene-stage');
const canvas = document.getElementById('scene-canvas');
const status = document.getElementById('scene-status');
const loading = document.getElementById('scene-loading');
const message = document.getElementById('scene-load-message');
const progress = document.getElementById('scene-progress');
const retry = document.getElementById('scene-retry');
const buttons = [...shell.querySelectorAll('button[data-scene]')];
const presets = {
  overview: { position: [29, 24, 33], target: [0, 2.8, -4] },
  hero: { position: [.3, 5.6, 25], target: [.8, 2, -7] },
  gate: { position: [13, 7, -.5], target: [5.4, 4.3, -13.2] },
  orb: { position: [5.2, 4.4, 6.4], target: [0, 2.1, -1.1] },
};
let renderer, scene, camera, controls, model, pool, originalPool;
let started = false, visible = false, loaded = false, wireframe = false, frame = 0;
let targetView = null, previousTime = 0;
const renderMaterials = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function selectPreset(name, immediate = false) {
  const preset = presets[name];
  targetView = { position: new THREE.Vector3(...preset.position), target: new THREE.Vector3(...preset.target) };
  controls.autoRotate = false;
  shell.querySelector('[data-scene="orbit"]').setAttribute('aria-pressed', 'false');
  shell.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
  if (immediate || reducedMotion) {
    camera.position.copy(targetView.position);
    controls.target.copy(targetView.target);
    targetView = null;
    controls.update();
  }
}

function resize() {
  if (!renderer) return;
  const width = stage.clientWidth, height = stage.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = camera.aspect < 1 ? 62 : 44;
  camera.updateProjectionMatrix();
}

function makeSky() {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { horizon: { value: new THREE.Color('#718da4') }, zenith: { value: new THREE.Color('#142a4c') } },
    vertexShader: 'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 horizon;uniform vec3 zenith;varying vec3 direction;void main(){float t=smoothstep(-.08,.85,normalize(direction).y);gl_FragColor=vec4(mix(horizon,zenith,t),1.0);}',
  }));
  const environmentScene = new THREE.Scene();
  environmentScene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, .05, .1, 500);
  scene.environment = environment.texture;
  scene.environmentIntensity = .7;
  scene.add(sky);
  pmrem.dispose();
}

function makeLighting() {
  scene.add(new THREE.HemisphereLight('#c3d5f3', '#5c4943', 2.1));
  const key = new THREE.DirectionalLight('#ffe9cb', 2.5);
  key.position.set(-9, 18, 10); key.target.position.set(0, 0, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 1, far: 85 });
  key.shadow.bias = -.0003; key.shadow.normalBias = .025;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#9fbaff', 1.0);
  fill.position.set(14, 9, -16); scene.add(fill);
  for (const [x, y, z, scale] of [[-5.5,-9.9,.1,1.2],[5.5,-9.9,.1,1.2],[-10,6,.1,.62],[10,8,.1,.62],[-12,2,.1,.7],[13,13,.1,.65]]) {
    const light = new THREE.PointLight('#ffc47e', 30 * scale * scale, 7, 2);
    light.position.set(x, z + 1.46 * scale, -y); scene.add(light);
  }
  const orbLight = new THREE.PointLight('#ffbd64', 38, 6, 2);
  orbLight.position.set(0, 2.65, -1.1); scene.add(orbLight);
}

function makePool() {
  const shader = {
    ...Reflector.ReflectorShader,
    uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
  };
  shader.vertexShader = shader.vertexShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec2 waterPosition;').replace('void main() {', 'void main() { waterPosition = position.xy;');
  shader.fragmentShader = shader.fragmentShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec2 waterPosition;').replace(
    'vec4 base = texture2DProj( tDiffuse, vUv );',
    'vec4 rippleUv = vUv; rippleUv.xy += vec2(sin(waterPosition.x*6.5+waterPosition.y*3.4),cos(waterPosition.y*7.1-waterPosition.x*2.4))*.0016*vUv.w; vec4 base = texture2DProj(tDiffuse, rippleUv); base.rgb=mix(base.rgb,vec3(.012,.046,.051),.12);'
  );
  pool = new Reflector(new THREE.PlaneGeometry(20.5, 21.9), {
    color: '#879e9b', textureWidth: 1024, textureHeight: 1024, clipBias: .003, multisample: 0, shader,
  });
  pool.name = 'Realtime pool reflection';
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, -.055, -1.5);
  scene.add(pool);
}

function setWireframe(active) {
  wireframe = active;
  renderMaterials.forEach(material => { material.wireframe = active; });
  pool.visible = !active;
  if (originalPool) originalPool.visible = active;
  shell.querySelector('[data-scene="wireframe"]').setAttribute('aria-pressed', String(active));
  status.textContent = active ? '线框显示 · 可检查真实几何' : '场景已载入 · 拖动旋转，滚轮缩放';
}

function zoom(factor) {
  targetView = null;
  const offset = camera.position.clone().sub(controls.target);
  const distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
  camera.position.copy(controls.target).add(offset.setLength(distance));
  controls.update();
}

function animate(time) {
  if (!visible || document.hidden || !loaded) { frame = 0; return; }
  const delta = Math.min((time - previousTime) / 1000 || 1/60, .1);
  previousTime = time;
  if (targetView) {
    const amount = 1 - Math.exp(-delta * 7);
    camera.position.lerp(targetView.position, amount);
    controls.target.lerp(targetView.target, amount);
    if (camera.position.distanceTo(targetView.position) < .015 && controls.target.distanceTo(targetView.target) < .015) {
      camera.position.copy(targetView.position); controls.target.copy(targetView.target); targetView = null;
    }
  }
  controls.update(delta);
  renderer.render(scene, camera);
  // DOM diagnostics describe the visible viewer and help verify real camera movement.
  canvas.dataset.camera = camera.position.toArray().map(n => n.toFixed(3)).join(',');
  canvas.dataset.distance = camera.position.distanceTo(controls.target).toFixed(3);
  canvas.dataset.triangles = String(renderer.info.render.triangles);
  canvas.dataset.drawCalls = String(renderer.info.render.calls);
  frame = requestAnimationFrame(animate);
}

function resume() { if (loaded && visible && !document.hidden && !frame) frame = requestAnimationFrame(animate); }

async function start() {
  if (started) return;
  started = true; retry.hidden = true; loading.hidden = false;
  try {
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 740 ? 1.5 : 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
      scene = new THREE.Scene(); scene.fog = new THREE.Fog('#718da4', 75, 250);
      camera = new THREE.PerspectiveCamera(44, 1, .1, 500);
      controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true; controls.dampingFactor = .09;
      controls.minDistance = 4; controls.maxDistance = 105;
      controls.minPolarAngle = .06; controls.maxPolarAngle = Math.PI * .485;
      controls.panSpeed = .75; controls.rotateSpeed = .7; controls.zoomSpeed = .85;
      controls.listenToKeyEvents(canvas);
      controls.addEventListener('start', () => {
        targetView = null; controls.autoRotate = false;
        shell.querySelector('[data-scene="orbit"]').setAttribute('aria-pressed', 'false');
        shell.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', 'false'));
      });
      controls.addEventListener('change', () => {
        controls.target.clamp(new THREE.Vector3(-26,.15,-30), new THREE.Vector3(26,18,18));
      });
      canvas.addEventListener('keydown', event => {
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(.85); }
        if (event.key === '-') { event.preventDefault(); zoom(1/.85); }
      });
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); status.textContent = '显示连接已中断，请刷新页面重新载入。';
      });
      new ResizeObserver(resize).observe(stage);
      makeSky(); makeLighting(); resize();
    }
    message.textContent = '正在载入月门水庭…';
    const draco = new DRACOLoader();
    draco.setDecoderPath(new URL('./vendor/examples/jsm/libs/draco/gltf/', import.meta.url).href);
    draco.setWorkerLimit(2);
    const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
    try {
      const gltf = await loader.loadAsync(new URL('./assets/moonwater-web.glb', import.meta.url).href, event => {
        if (event.lengthComputable && event.total > 0) {
          progress.value = event.loaded / event.total;
          message.textContent = event.loaded === event.total ? '正在准备三维结构…' : `正在载入月门水庭… ${Math.round(progress.value * 100)}%`;
        }
      });
      model = gltf.scene; scene.add(model);
      let meshCount = 0;
      model.traverse(object => {
        if (!object.isMesh) return;
        meshCount += 1;
        object.castShadow = !object.name.includes('Distant');
        object.receiveShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => { renderMaterials.add(material); material.envMapIntensity = .8; });
        if (object.userData.source_collection === '01 Pool and terraces' && materials.some(material => material.name.includes('reflective water'))) originalPool = object;
      });
      if (!originalPool) throw new Error('Pool geometry missing');
      originalPool.visible = false;
      makePool();
      selectPreset('overview', true);
      loaded = true; shell.dataset.state = 'ready';
      canvas.dataset.source = 'moonwater-web.glb';
      canvas.dataset.meshes = String(meshCount);
      canvas.dataset.materials = String(renderMaterials.size);
      loading.hidden = true; buttons.forEach(button => { button.disabled = false; });
      status.textContent = '场景已载入 · 拖动旋转，滚轮缩放';
      resume();
    } finally { draco.dispose(); }
  } catch (error) {
    if (model) {
      scene.remove(model);
      model.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
      renderMaterials.forEach(material => material.dispose());
      renderMaterials.clear(); model = null; originalPool = null;
    }
    if (pool) { scene.remove(pool); pool.dispose(); pool = null; }
    started = false; shell.dataset.state = 'error';
    message.textContent = '三维场景暂时无法载入，可重试或下载模型。';
    status.textContent = '请确认浏览器支持 WebGL，或尝试刷新页面。';
    retry.hidden = false; progress.hidden = true;
    console.error('Moonwater viewer:', error);
  }
}

buttons.forEach(button => button.addEventListener('click', async () => {
  if (!loaded) return;
  switch (button.dataset.scene) {
    case 'view': selectPreset(button.dataset.view); break;
    case 'reset': selectPreset('overview'); break;
    case 'in': zoom(.82); break;
    case 'out': zoom(1/.82); break;
    case 'wireframe': setWireframe(!wireframe); break;
    case 'orbit':
      targetView = null; controls.autoRotate = !controls.autoRotate; controls.autoRotateSpeed = .6;
      button.setAttribute('aria-pressed', String(controls.autoRotate)); break;
    case 'fullscreen':
      try {
        if (document.fullscreenElement === shell) await document.exitFullscreen();
        else await shell.requestFullscreen();
      } catch { status.textContent = '当前窗口不支持全屏，可以继续在页面内查看。'; }
      break;
  }
}));
retry.addEventListener('click', () => { progress.hidden = false; start(); });
document.addEventListener('visibilitychange', resume);
document.addEventListener('fullscreenchange', () => {
  shell.querySelector('[data-scene="fullscreen"]').setAttribute('aria-pressed', String(document.fullscreenElement === shell)); resize();
});
const observer = new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (visible) { start(); resume(); }
}, { rootMargin: '200px' });
observer.observe(stage);

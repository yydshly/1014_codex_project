import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createSea, createSky, setWorldWeather } from './shaders.js';
import { seededRandom } from './experience.js';
import { frameSeasideCamera } from './view.js';

const damp = (a, b, speed, dt) => THREE.MathUtils.damp(a, b, speed, dt);
const smooth = t => t * t * (3 - 2 * t);

function woodTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 512;
  const ctx = canvas.getContext('2d'); const random = seededRandom(1234);
  ctx.fillStyle = '#8b7860'; ctx.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 180; i++) {
    const x = random() * 128;
    ctx.strokeStyle = `rgba(${random() > 0.5 ? '30,24,20' : '210,190,150'},${0.02 + random() * 0.13})`;
    ctx.lineWidth = random() * 2 + 0.3; ctx.beginPath(); ctx.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 12) ctx.lineTo(x + Math.sin(y * 0.025 + x) * 1.8, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  return texture;
}

function glowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'); const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,245,205,1)'); gradient.addColorStop(0.12, 'rgba(255,216,130,.65)');
  gradient.addColorStop(0.4, 'rgba(255,170,65,.12)'); gradient.addColorStop(1, 'rgba(255,170,65,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export class SeasideScene {
  constructor(canvas, weather, onDrop) {
    this.canvas = canvas; this.onDrop = onDrop; this.weather = weather; this.random = seededRandom(83662);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.06, 480);
    this.camera.position.set(0, 1.75, 6.4);
    this.entry = 0; this.sitting = 0; this.reach = 0; this.look = new THREE.Vector2(); this.lookTarget = new THREE.Vector2();
    this.projected = new THREE.Vector3(); this.dripPoint = new THREE.Vector3(1.85, 1.4, -1.75);
    this.glowMap = glowTexture();
    this.sky = createSky(weather); this.sea = createSea(weather); this.scene.add(this.sky, this.sea);
    this.hemi = new THREE.HemisphereLight(0xc4d7de, 0x38352c, 1.6); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xd9c5a6, 1.35); this.sun.position.set(-20, 18, -25); this.scene.add(this.sun);
    this.lampLight = new THREE.PointLight(0xffbd6d, 32, 13, 2); this.lampLight.position.set(-2.5, 2.8, -0.6); this.scene.add(this.lampLight);
    const fill = new THREE.PointLight(0xc2d0cd, 12, 16, 2); fill.position.set(1.5, 3, 4); this.scene.add(fill);
    this.materials(); this.shelter(); this.makeBasin(); this.makeHand(); this.makeRain(); this.makeDrips(); this.makeRipples(); this.makeBoat(); this.makeCoast();
    this.setWeather(weather); this.resize();
    this.renderer.compile(this.scene, this.camera);
  }

  materials() {
    const grain = woodTexture();
    this.wood = new THREE.MeshStandardMaterial({ map: grain, color: 0x675345, roughness: 0.6, metalness: 0.04 });
    this.wetWood = new THREE.MeshStandardMaterial({ map: grain, color: 0x968a78, roughness: 0.27, metalness: 0.14 });
    this.darkWood = new THREE.MeshStandardMaterial({ map: grain, color: 0x423c35, roughness: 0.61 });
    this.metal = new THREE.MeshStandardMaterial({ color: 0x293c3c, roughness: 0.44, metalness: 0.68 });
    this.warmMetal = new THREE.MeshStandardMaterial({ color: 0x9f8550, roughness: 0.3, metalness: 0.7 });
    this.roofMat = new THREE.MeshStandardMaterial({ color: 0x2d3e3e, roughness: 0.74, metalness: 0.25 });
  }
  box(width, height, depth, material, x, y, z, parent = this.scene, radius = 0.025) {
    const geometry = radius ? new RoundedBoxGeometry(width, height, depth, 1, radius) : new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  cylinder(radiusTop, radiusBottom, height, material, x, y, z, parent = this.scene, segments = 16) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material); mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  }

  shelter() {
    this.box(8.8, 0.2, 8.8, this.darkWood, 0, -0.11, 0.3);
    for (let i = 0; i < 30; i++) {
      this.box(0.277, 0.09, 8.55, this.wetWood, -4.22 + i * 0.291, 0.025 + this.random() * 0.006, 0.3, this.scene, 0.009);
    }
    for (const x of [-3.85, 3.85]) for (const z of [-3.6, 3.6]) {
      this.box(0.23, 3.55, 0.23, this.wood, x, 1.75, z);
      this.box(0.32, 0.11, 0.32, this.metal, x, 0.2, z);
      this.box(0.3, 0.13, 0.3, this.metal, x, 3.15, z);
    }
    this.box(8.2, 0.23, 0.25, this.wood, 0, 3.31, -3.6);
    this.box(8.2, 0.23, 0.25, this.wood, 0, 3.31, 3.6);
    for (const x of [-3.85, 3.85]) {
      this.box(0.25, 0.23, 7.5, this.wood, x, 3.31, 0);
      this.box(0.11, 0.12, 6.4, this.wood, x, 0.92, 0);
      this.box(0.11, 0.09, 6.4, this.wood, x, 0.55, 0);
      for (const z of [-2.8,-1.4,0,1.4,2.8]) this.box(0.06, 0.8, 0.06, this.wood, x, 0.51, z);
      const brace = this.box(0.13, 1.15, 0.13, this.wood, x, 2.82, -3.15); brace.rotation.x = -0.68;
    }
    // The open ocean side stays unrailed so the view is not cut into bands.
    this.box(8.75, 0.18, 8.5, this.roofMat, 0, 3.57, 0);
    for (let i=0;i<16;i++) this.box(0.08, 0.07, 8.55, this.roofMat, -4.15+i*.55, 3.69, 0, this.scene, 0.008);
    for (const z of [-2.7,-1.35,0,1.35,2.7]) this.box(7.6, 0.08, 0.1, this.wood, 0, 3.42, z);
    // A bench on the left and an unoccupied foreground leave the horizon open.
    for (let i = 0; i < 4; i++) this.box(2.55, 0.08, 0.14, this.wood, -2.12, 0.66, 0.3+i*0.17);
    for (const x of [-3.05,-1.2]) for (const z of [0.32,0.82]) this.box(0.1, 0.6, 0.1, this.metal, x, 0.34, z);
    for (const x of [-3.12,-1.12]) this.box(0.1, 1.18, 0.1, this.metal, x, 0.8, 0.96);
    for (const y of [0.93,1.14,1.35]) this.box(2.62, 0.14, 0.07, this.wood, -2.12, y, 1.0);
    // A real hinged door, crossed by the camera when it opens.
    this.door = new THREE.Group(); this.door.position.set(-1.1, 0, 3.72); this.scene.add(this.door);
    for(let i=0;i<7;i++) this.box(0.303, 2.95, 0.11, this.darkWood, 0.16+i*.315, 1.53, 0, this.door, .012);
    for (const y of [.42,2.55]) this.box(2.2, .12, .08, this.wood, 1.1, y, .085, this.door);
    this.box(.065, .3, .06, this.warmMetal, 1.87, 1.4, .12, this.door);
    for (const x of [-1.22,1.22]) this.box(.14, 3.15, .2, this.wood, x, 1.58, 3.72);
    this.box(2.6,.16,.22,this.wood,0,3.14,3.72);
    // Lantern with a soft glow, not a full-screen lighting filter.
    this.cylinder(.035,.035,.5,this.metal,-2.5,3.08,-.6);
    this.cylinder(.21,.15,.38,this.warmMetal,-2.5,2.72,-.6);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),new THREE.MeshBasicMaterial({color:0xffdca0})); bulb.position.set(-2.5,2.72,-.6); this.scene.add(bulb);
    this.cylinder(.26,.19,.12,this.metal,-2.5,2.97,-.6);
    this.cylinder(.19,.25,.09,this.metal,-2.5,2.48,-.6);
    for(const x of [-.16,.16]) for(const z of [-.13,.13]) this.box(.027,.38,.027,this.metal,-2.5+x,2.72,-.6+z,this.scene,.005);
    const lampGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowMap,transparent:true,depthWrite:false,opacity:.65,blending:THREE.AdditiveBlending}));
    lampGlow.position.copy(bulb.position);lampGlow.scale.set(2.5,2.5,1); this.scene.add(lampGlow);
    // A slim gutter carries water to the reachable drip point.
    this.box(.11,.08,2.0,this.metal,1.85,3.3,-2.5);
    const downpipe=this.cylinder(.035,.035,.4,this.metal,1.85,3.08,-1.75); downpipe.rotation.z=-.12;
  }

  makeBasin() {
    const basinMat = new THREE.MeshStandardMaterial({color:0x6b7c77,roughness:.37,metalness:.35,side:THREE.DoubleSide});
    const points=[new THREE.Vector2(.0,0),new THREE.Vector2(.31,0),new THREE.Vector2(.46,.13),new THREE.Vector2(.6,.33),new THREE.Vector2(.61,.37)];
    this.basin = new THREE.Mesh(new THREE.LatheGeometry(points,36),basinMat);this.basin.position.set(1.85,.22,-1.75);this.scene.add(this.basin);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.605,.022,8,48),this.metal);rim.rotation.x=Math.PI/2;rim.position.set(1.85,.6,-1.75);this.scene.add(rim);
    this.waterLevel=.535;
    const water=new THREE.Mesh(new THREE.CircleGeometry(.55,48),new THREE.MeshPhysicalMaterial({color:0x416d70,roughness:.13,metalness:.32,transparent:true,opacity:.86,clearcoat:1}));
    water.rotation.x=-Math.PI/2;water.position.set(1.85,this.waterLevel,-1.75);this.scene.add(water);
    this.box(1.15,.1,1.05,this.darkWood,1.85,.19,-1.75);
    for(const x of [1.43,2.27]) for(const z of [-2.12,-1.38]) this.box(.07,.16,.07,this.darkWood,x,.08,z);
  }

  makeHand() {
    this.hand = new THREE.Group(); this.scene.add(this.hand);
    this.skin = new THREE.MeshStandardMaterial({ color: 0xd2a282, roughness: 0.52, metalness: 0 });
    const outline = new THREE.Shape();
    outline.moveTo(-0.12, -0.2);
    outline.quadraticCurveTo(-0.2, -0.13, -0.205, 0.02);
    outline.quadraticCurveTo(-0.215, 0.16, -0.14, 0.205);
    outline.lineTo(0.11, 0.215);
    outline.quadraticCurveTo(0.195, 0.18, 0.2, 0.065);
    outline.quadraticCurveTo(0.23, -0.045, 0.13, -0.17);
    outline.quadraticCurveTo(0.04, -0.23, -0.12, -0.2);
    const palmGeometry = new THREE.ExtrudeGeometry(outline, { depth: 0.055, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.022, bevelSegments: 3, curveSegments: 10, steps: 1 });
    palmGeometry.rotateX(-Math.PI / 2); palmGeometry.translate(0, -0.025, 0);
    this.hand.add(new THREE.Mesh(palmGeometry, this.skin));
    this.fingers = [];
    const lengths = [0.24, 0.31, 0.29, 0.22];
    for (let index = 0; index < 4; index++) {
      const finger = new THREE.Group();
      finger.position.set(-0.145 + index * 0.095, 0.018, -0.19);
      finger.rotation.y = (index - 1.5) * -0.045;
      const length = lengths[index], firstLength = length * 0.55, tipLength = length * 0.4;
      const first = new THREE.Mesh(new THREE.CapsuleGeometry(0.043, firstLength, 5, 12), this.skin);
      first.rotation.x = Math.PI / 2; first.position.z = -firstLength * 0.5;
      finger.add(first);
      const tipJoint = new THREE.Group(); tipJoint.position.z = -firstLength;
      tipJoint.rotation.x = 0.28;
      const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, tipLength, 5, 12), this.skin);
      tip.rotation.x = Math.PI / 2; tip.position.z = -tipLength * 0.5;
      tipJoint.add(tip); finger.add(tipJoint); this.hand.add(finger); this.fingers.push(finger);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.059, 0.16, 6, 14), this.skin);
    thumb.rotation.set(1.18, 0.18, -0.95); thumb.position.set(0.24, 0.012, -0.035); this.hand.add(thumb);
    const creaseMaterial = new THREE.MeshStandardMaterial({ color: 0xaf8065, roughness: 0.9, transparent: true, opacity: 0.36 });
    for (const offset of [-0.055, 0.045]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.13, 0.059, offset), new THREE.Vector3(-0.04, 0.061, offset - 0.03), new THREE.Vector3(0.07, 0.059, offset - 0.012)]);
      this.hand.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.0018, 4, false), creaseMaterial));
    }
    const sleeveCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.055, 0.17), new THREE.Vector3(0.12, -0.1, 0.55),
      new THREE.Vector3(0.55, -0.3, 1.1), new THREE.Vector3(1.15, -0.7, 1.8),
      new THREE.Vector3(1.8, -1.1, 2.6),
    ]);
    const sleeveGeometry = new THREE.TubeGeometry(sleeveCurve, 32, 0.14, 16, false);
    const sleevePositions = sleeveGeometry.attributes.position;
    for (let ring = 0; ring <= 32; ring++) {
      const center = sleeveCurve.getPointAt(ring / 32);
      const taper = THREE.MathUtils.lerp(0.84, 1.45, ring / 32);
      for (let side = 0; side <= 16; side++) {
        const index = ring * 17 + side;
        const point = new THREE.Vector3().fromBufferAttribute(sleevePositions, index).sub(center).multiplyScalar(taper).add(center);
        sleevePositions.setXYZ(index, point.x, point.y, point.z);
      }
    }
    sleeveGeometry.computeVertexNormals();
    this.hand.add(new THREE.Mesh(sleeveGeometry, new THREE.MeshStandardMaterial({ color: 0x647e78, roughness: 0.92 })));
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.127, 0.13, 0.13, 20), new THREE.MeshStandardMaterial({ color: 0x344c47, roughness: 0.95 }));
    cuff.rotation.x = Math.PI / 2; cuff.position.set(0, -0.045, 0.16); this.hand.add(cuff);
    this.hand.visible = false;
  }

  makeRain() {
    this.rainCount=1400;this.rainPositions=new Float32Array(this.rainCount*6);this.rainDrops=[];
    for(let i=0;i<this.rainCount;i++) this.rainDrops.push({x:(this.random()-.5)*38,y:this.random()*17,z:-30+this.random()*42,speed:8+this.random()*5});
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.rainPositions,3));
    this.rain=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xadc5cb,transparent:true,opacity:.21,depthWrite:false}));this.rain.frustumCulled=false;this.scene.add(this.rain);
  }
  makeDrips() {
    this.dripGeometry=new THREE.SphereGeometry(.012,7,6);
    this.dripMaterial=new THREE.MeshBasicMaterial({color:0xb0d6dc,transparent:true,opacity:.68});
    this.drips=Array.from({length:30},()=>{const mesh=new THREE.Mesh(this.dripGeometry,this.dripMaterial);mesh.visible=false;mesh.scale.set(.6,2.1,.6);this.scene.add(mesh);return{mesh,active:false,speed:0};});
    this.dripTimer=0;
    this.splashes=Array.from({length:80},()=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(.015,5,4),this.dripMaterial);mesh.visible=false;this.scene.add(mesh);return{mesh,life:0,v:new THREE.Vector3()};});
  }
  makeRipples() {
    const geo=new THREE.RingGeometry(.9,1,40);geo.rotateX(-Math.PI/2);
    this.ripples=Array.from({length:30},()=>{const material=new THREE.MeshBasicMaterial({color:0xc9ded4,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});const mesh=new THREE.Mesh(geo,material);mesh.visible=false;this.scene.add(mesh);return{mesh,life:0,onHand:false};});
  }
  impact(x,y,z,onHand) {
    const ripple=this.ripples.find(item=>item.life<=0)??this.ripples[0];
    ripple.life=1;ripple.onHand=onHand;ripple.mesh.visible=true;ripple.mesh.position.set(x,y+.008,z);ripple.mesh.scale.setScalar(.02);
    ripple.mesh.rotation.set(onHand ? this.hand.rotation.x : 0, onHand ? this.hand.rotation.y : 0, onHand ? this.hand.rotation.z : 0);
    let emitted=0;
    for(const splash of this.splashes) if(splash.life<=0&&emitted<5) {
      splash.life=.35+this.random()*.2;splash.mesh.visible=true;splash.mesh.position.set(x,y+.02,z);
      splash.v.set((this.random()-.5)*.7,.35+this.random()*.45,(this.random()-.5)*.7);emitted++;
    }
    this.onDrop(onHand);
  }

  makeBoat() {
    this.boat=new THREE.Group();this.scene.add(this.boat);
    const hullMat=new THREE.MeshStandardMaterial({color:0x1b2a2a,roughness:.75});
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-3.25, 0.22); hullShape.lineTo(-2.5, -0.28); hullShape.lineTo(2.15, -0.25);
    hullShape.lineTo(3.25, 0.34); hullShape.lineTo(3.35, 0.52); hullShape.quadraticCurveTo(0.3, 0.32, -3.25, 0.22);
    const hullGeometry = new THREE.ExtrudeGeometry(hullShape, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.045, bevelSegments: 2, steps: 1 });
    hullGeometry.translate(0, 0, -0.65); this.boat.add(new THREE.Mesh(hullGeometry, hullMat));
    this.box(2.1,1.1,1.15,this.darkWood,-.3,.72,0,this.boat);
    this.box(2.35,.12,1.4,this.roofMat,-.3,1.35,0,this.boat);
    const windowMat=new THREE.MeshBasicMaterial({color:0xffbe77,toneMapped:false});
    this.box(1.65,.48,.025,windowMat,-.3,.85,.59,this.boat,.01);
    this.cylinder(.035,.045,3.0,this.metal,.8,1.45,0,this.boat,8);
    this.box(1.6,.04,.04,this.metal,.8,2.5,0,this.boat,.005);
    const light=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowMap,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));light.position.set(-.3,.9,.7);light.scale.set(7,7,1);this.boat.add(light);this.boatGlow=light;
    const mastLight=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),windowMat);mastLight.position.set(.8,2.9,0);this.boat.add(mastLight);
    this.boatMaterials = [];
    this.boat.traverse(object => {
      if (!object.isMesh) return;
      object.material = object.material.clone(); object.material.transparent = true;
      this.boatMaterials.push(object.material);
    });
    this.boat.visible=false;
  }
  makeCoast() {
    const rockMat=new THREE.MeshStandardMaterial({color:0x314b4c,roughness:1,flatShading:true});
    for(let i=0;i<16;i++) {
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),rockMat);const side=i<9?-1:1;
      rock.position.set(side*(68+this.random()*85),-1+this.random()*3,-95-this.random()*70);rock.scale.set(10+this.random()*18,4+this.random()*13,8+this.random()*18);rock.rotation.y=this.random()*6;this.scene.add(rock);
    }
  }

  setWeather(weather) {
    this.weather=weather;setWorldWeather(this.sky,this.sea,weather);
    this.scene.fog=new THREE.FogExp2(weather.fog,weather.fogDensity*.53);
    this.hemi.intensity=weather.ambient;this.sun.intensity=weather.sun;this.renderer.toneMappingExposure=weather.exposure;
    this.rain.visible=weather.rain>0;this.rain.material.opacity=.13+weather.rain*.13;
    this.lampLight.intensity=weather.id==='night-rain'?42:28;
    this.lookTarget.set(0,0);this.look.set(0,0);this.entry=0;this.sitting=0;this.reach=0;
    this.boat.visible=false;this.hand.visible=false;
    for(const drip of this.drips){drip.active=false;drip.mesh.visible=false;}
    for(const ripple of this.ripples){ripple.life=0;ripple.mesh.visible=false;}
    for(const splash of this.splashes){splash.life=0;splash.mesh.visible=false;}
  }

  resize() {
    const width=window.innerWidth,height=window.innerHeight;
    this.renderer.setSize(width,height,false);
    frameSeasideCamera(this.camera, { width, height, entry: this.entry, seated: this.sitting, reach: this.reach });
  }
  drag(dx,dy) { this.lookTarget.x=THREE.MathUtils.clamp(this.lookTarget.x+dx*.002,-.6,.6);this.lookTarget.y=THREE.MathUtils.clamp(this.lookTarget.y+dy*.0015,-.2,.2); }

  update(dt,time,visit,opening) {
    this.entry=damp(this.entry,opening?1:0,1.9,dt);this.sitting=damp(this.sitting,visit.seated?1:0,2.6,dt);this.reach=damp(this.reach,visit.catching&&visit.inside?1:0,7,dt);
    const enter=smooth(Math.min(1,this.entry));
    this.door.rotation.y=-enter*Math.PI*.62;
    this.look.x=damp(this.look.x,this.lookTarget.x,5,dt);this.look.y=damp(this.look.y,this.lookTarget.y,5,dt);
    frameSeasideCamera(this.camera, { width: window.innerWidth, height: window.innerHeight, entry: enter, seated: this.sitting, reach: this.reach, lookX: this.look.x, lookY: this.look.y });
    this.sky.material.uniforms.uTime.value=time;this.sea.material.uniforms.uTime.value=time;
    this.updateRain(dt);
    this.hand.visible=this.reach>.02;
    this.hand.position.set(THREE.MathUtils.lerp(3.1,1.85,this.reach),THREE.MathUtils.lerp(.15,1.34,this.reach),THREE.MathUtils.lerp(1.3,-1.75,this.reach));
    this.hand.rotation.set(0.5 + this.reach * 0.04, -0.12 + Math.sin(time * 0.5) * 0.012, -0.09);
    for (let index = 0; index < this.fingers.length; index++) this.fingers[index].rotation.x = 0.08 + this.reach * 0.08 + Math.sin(time * 0.55 + index) * 0.009;
    this.updateDrips(dt);
    const p=visit.boatProgress;
    this.boat.visible=visit.boatVisible;
    const boatFade=smooth(Math.min(1,p*11))*smooth(Math.min(1,(1-p)*9));
    this.boat.position.set(-36+p*82,-.04+Math.sin(time*.8)*.035,-69+Math.sin(p*Math.PI)*5);
    this.boat.rotation.z=Math.sin(time*.52)*.025;this.boatGlow.material.opacity=boatFade*.9;
    for (const material of this.boatMaterials) material.opacity = boatFade;
    this.sea.material.uniforms.uBoat.value.copy(this.boat.position);this.sea.material.uniforms.uBoatLight.value=visit.boatVisible?boatFade:0;
    this.projected.copy(this.dripPoint).project(this.camera);
    this.renderer.render(this.scene,this.camera);
    return {x:(this.projected.x*.5+.5)*window.innerWidth,y:(-this.projected.y*.5+.5)*window.innerHeight,onScreen:this.projected.z<1&&Math.abs(this.projected.x)<.85&&Math.abs(this.projected.y)<.75};
  }
  updateRain(dt) {
    if(!this.rain.visible)return;
    const count=Math.round(this.rainCount*this.weather.rain);
    for(let i=0;i<count;i++) {
      const drop=this.rainDrops[i];drop.y-=drop.speed*dt;drop.x+=this.weather.wind*dt*2.6;
      if(drop.y<-.3||(Math.abs(drop.x)<4.4&&Math.abs(drop.z)<4.4&&drop.y<3.7)) {drop.x=(this.random()-.5)*38;drop.y=9+this.random()*9;drop.z=-30+this.random()*42;}
      const offset=i*6;this.rainPositions[offset]=drop.x;this.rainPositions[offset+1]=drop.y;this.rainPositions[offset+2]=drop.z;
      this.rainPositions[offset+3]=drop.x-this.weather.wind*.065;this.rainPositions[offset+4]=drop.y+.2;this.rainPositions[offset+5]=drop.z;
    }
    this.rain.geometry.setDrawRange(0,count*2);this.rain.geometry.attributes.position.needsUpdate=true;
  }
  updateDrips(dt) {
    this.dripTimer-=dt;
    if(this.dripTimer<=0) {
      this.dripTimer=this.weather.dripInterval*(.7+this.random()*.65);
      const drop=this.drips.find(d=>!d.active);
      if(drop){drop.active=true;drop.mesh.visible=true;drop.speed=.25;drop.mesh.position.set(1.85+(this.random()-.5)*.08,2.92,-1.75+(this.random()-.5)*.05);}
    }
    for(const drop of this.drips) if(drop.active) {
      const oldY=drop.mesh.position.y;drop.speed+=4.9*dt;drop.mesh.position.y-=drop.speed*dt;
      const onHand=this.reach>.91&&oldY>=1.4&&drop.mesh.position.y<=1.4;
      if(onHand||drop.mesh.position.y<=this.waterLevel) {
        this.impact(drop.mesh.position.x,onHand?1.405:this.waterLevel,drop.mesh.position.z,onHand);drop.active=false;drop.mesh.visible=false;
      }
    }
    for(const ripple of this.ripples) if(ripple.life>0) {
      ripple.life-=dt*(ripple.onHand?2.2:1.15);const age=1-ripple.life;
      ripple.mesh.scale.setScalar(.015+age*(ripple.onHand?.13:.49));ripple.mesh.material.opacity=Math.max(0,ripple.life)*.45;
      if(ripple.onHand&&this.reach<.9)ripple.life=0;
      if(ripple.life<=0)ripple.mesh.visible=false;
    }
    for(const splash of this.splashes) if(splash.life>0) {
      splash.life-=dt;splash.v.y-=2.6*dt;splash.mesh.position.addScaledVector(splash.v,dt);splash.mesh.scale.setScalar(Math.min(1,splash.life*4));
      if(splash.life<=0)splash.mesh.visible=false;
    }
  }
}

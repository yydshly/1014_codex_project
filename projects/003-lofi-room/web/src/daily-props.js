import * as THREE from "three";
import { WATER_STATION } from "./stage-layout.js";

export function createWaterCorner(parent) {
  const materials = new Map();
  const material = (color) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.72 }));
    return materials.get(color);
  };
  const box = (size, position, color) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
    mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  box([1.4, 0.82, 0.7], [-0.4, 0.43, -3.54], "#7f7059");
  box([1.44, 0.06, 0.74], [-0.4, 0.87, -3.54], "#c4b899");
  for (const x of [-0.74, -0.06]) {
    box([0.62, 0.65, 0.025], [x, 0.44, -3.18], "#9b8c6f");
    box([0.12, 0.025, 0.04], [x, 0.65, -3.15], "#c6c9b7");
  }
  box([0.34, 0.4, 0.34], [-0.2, 1.1, -3.48], "#c2c9b6");
  box([0.2, 0.17, 0.02], [-0.2, 1.05, -3.3], "#465d5e");
  box([0.06, 0.035, 0.1], [-0.2, 1.12, -3.25], "#7c9792");
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 12), material("#799b9f"));
  bottle.position.set(-0.2, 1.47, -3.48); parent.add(bottle);
  box([0.15, 0.04, 0.15], [-0.2, 1.31, -3.48], "#607c7d");
  box([0.2, 0.045, 0.2], [-0.2, 1.65, -3.48], "#a2b9ad");
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .055, 8), new THREE.MeshBasicMaterial({ color: "#a5d5df", transparent: true, opacity: .65 }));
  stream.position.set(WATER_STATION.cup.x, 1.095, WATER_STATION.cup.z); stream.visible = false; parent.add(stream);
  return { stream };
}

export function createWaterCup(scene) {
  const cup = new THREE.Group();
  cup.name = "workspace-water-cup";
  const ceramic = new THREE.MeshStandardMaterial({ color: "#d9c79e", roughness: 0.48 });
  cup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.066, 0.16, 12, 1, true), ceramic));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.071, 0.007, 6, 16), ceramic);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.08; cup.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), new THREE.MeshStandardMaterial({ color: "#6b9296", roughness: 0.2 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.058; cup.add(water);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(.064, .06, .13, 16), new THREE.MeshStandardMaterial({ color: "#719fa5", transparent: true, opacity: .65, roughness: .2 }));
  cup.add(liquid);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(.065, 16), ceramic); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -.075; cup.add(bottom);
  const ripple = new THREE.Mesh(new THREE.TorusGeometry(.03, .0015, 4, 20), new THREE.MeshBasicMaterial({ color: "#c7e3de", transparent: true, opacity: .45 }));
  ripple.position.z = .001; water.add(ripple);
  cup.userData.water = water; cup.userData.liquid = liquid; cup.userData.ripple = ripple;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.012, 6, 12), ceramic);
  handle.position.x = 0.096; cup.add(handle);
  cup.position.set(WATER_STATION.cup.x, WATER_STATION.cup.y, WATER_STATION.cup.z);
  scene.add(cup);
  return cup;
}

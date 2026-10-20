import { Scene, Vector3, Box3 } from "three";
import { createResidents } from "../src/residents.js";
import { ROOM, OBSTACLES } from "../src/room.js";
import { FLOOR_Y } from "../src/ground-surfaces.js";
import { updateResidentPose } from "../src/resident-motion.js";

const cases = [];
for (const speed of [.25, .8, 1.08]) for (const delta of [1 / 60, .05, .16]) {
  const r = createResidents(new Scene(), ROOM, OBSTACLES).residents[0];
  r.root.position.set(-3, 0, -1.8); r.root.rotation.y = Math.PI / 2;
  const anchors = [], plants = new Set();
  let minimumGap = Infinity, maximumGap = -Infinity, maximumSlide = 0, unsupportedFrames = 0;
  for (let frame = 0; frame < Math.ceil(4 / delta); frame++) {
    r.root.position.x += speed * delta;
    updateResidentPose(r, { time: frame * delta, delta, distanceMoved: speed * delta });
    unsupportedFrames += Number(r.footContacts.every((f) => f.phase !== "stance"));
    r.footContacts.forEach((foot, i) => {
      if (foot.phase !== "stance") { anchors[i] = null; return; }
      const sole = r.soles[i].getWorldPosition(new Vector3());
      const gap = new Box3().setFromObject(r.ankles[i].children[0]).min.y - FLOOR_Y;
      minimumGap = Math.min(minimumGap, gap); maximumGap = Math.max(maximumGap, gap);
      if (anchors[i]?.id === foot.plantId) maximumSlide = Math.max(maximumSlide, Math.hypot(sole.x - anchors[i].sole.x, sole.z - anchors[i].sole.z));
      else anchors[i] = { id: foot.plantId, sole };
      plants.add(`${i}:${foot.plantId}`);
    });
  }
  cases.push({ speed, frameSeconds: delta, minimumGap, maximumGap, maximumSlide, unsupportedFrames, landings: plants.size });
}
console.log(JSON.stringify({ units: "scene metres", durationPerCaseSeconds: 4,
  before: { speed: .8, frameSeconds: 1 / 60, minimumGap: .04315290294886805, maximumGap: .04338324664531954, maximumSlide: .029916085063667337, source: "本次修改前，600 帧复现记录" },
  after: cases }, null, 2));

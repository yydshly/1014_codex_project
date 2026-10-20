import { HOME_SPOTS, BREAK_SPOTS, WATER_STATION } from "./stage-layout.js";

const activities = ["drink", "stretch", "walk"];

// Local, staggered routines never emit task events or claim a work result.
export function createAmbientLife(characters) {
  const routines = new Map();
  const reset = (person) => {
    const routine = { cycle: 0, seed: (person.index + 1) * 173, wait: 10 + person.index * 3, waypoint: 0 };
    routines.set(person.data.id, routine);
    return routine;
  };
  const random = (routine) => {
    routine.seed = (routine.seed * 1664525 + 1013904223) >>> 0;
    return routine.seed / 4294967296;
  };
  const move = (person, spec, kind) => characters.moveTo(person.data.id, {
    ...spec, ambient: true, ambientKind: kind, pace: 0.72,
  });
  const returnHome = (person, routine) => {
    move(person, HOME_SPOTS[person.data.id], "return");
    routine.wait = 25 + random(routine) * 28;
  };
  return {
    interrupt(actor) { routines.delete(actor); },
    reset() { routines.clear(); },
    update(delta, { enabled, reducedMotion, excluded = [] }) {
      if (!enabled) return;
      let away = characters.residents.filter((r) => r.action?.ambient && !["home", undefined].includes(r.action.ambientKind)).length;
      let waterBusy = characters.residents.some((r) => r.action?.ambientKind === "drink" || r.finishDrinkAge != null);
      for (const person of characters.residents) {
        const action = person.action;
        if (!action?.ambient || person.stageFrozen || person.propBusy || excluded.includes(person.data.id)) continue;
        if (person.observedProp && action.arrived && ["read", "write"].includes(action.pose) && ["home", undefined].includes(action.ambientKind)) continue;
        const routine = routines.get(person.data.id) || reset(person);
        if (reducedMotion) {
          if (action.ambientKind && !["home", "return"].includes(action.ambientKind)) returnHome(person, routine);
          continue;
        }
        if (!action.arrived) continue;
        const kind = action.ambientKind || "home";
        if (kind === "return") {
          action.ambientKind = "home";
          away--;
        } else if (kind === "drink" || kind === "stretch") {
          if (action.age >= (kind === "drink" ? 6.5 : 6)) returnHome(person, routine);
        } else if (kind === "walk") {
          if (action.age < 1.8) continue;
          const next = BREAK_SPOTS[person.data.id].walk[++routine.waypoint];
          if (next) move(person, { ...next, yaw: HOME_SPOTS[person.data.id].yaw, pose: "idle", label: "等候任务 · 起身活动，慢慢走一走" }, "walk");
          else returnHome(person, routine);
        } else {
          routine.wait -= delta;
          if (routine.wait > 0 || away >= 2) continue;
          const next = activities[(routine.cycle + person.index) % activities.length];
          if (next === "drink" && waterBusy) continue;
          routine.cycle++;
          routine.waypoint = 0;
          if (next === "drink") {
            move(person, { ...WATER_STATION, pose: "drink", label: "等候任务 · 到饮水角喝口水" }, "drink");
            waterBusy = true;
          } else if (next === "stretch") {
            move(person, { ...BREAK_SPOTS[person.data.id].stretch, yaw: HOME_SPOTS[person.data.id].yaw, pose: "stretch", label: "等候任务 · 起身伸个懒腰" }, "stretch");
          } else move(person, { ...BREAK_SPOTS[person.data.id].walk[0], yaw: HOME_SPOTS[person.data.id].yaw, pose: "idle", label: "等候任务 · 起身活动，慢慢走一走" }, "walk");
          away++;
        }
      }
    },
  };
}

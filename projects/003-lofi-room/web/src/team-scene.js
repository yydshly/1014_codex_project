import * as THREE from "three";
import { TEAM, TEAM_BY_ID } from "../shared/team.js";
import {
  BOARD,
  BOARD_SPOTS,
  WORK_SPOTS,
  DESK_MEETING,
  HOME_SPOTS,
  WATER_STATION,
} from "./stage-layout.js";
import { createAmbientLife } from "./ambient-life.js";
import { createWaterCup } from "./daily-props.js";
import { createRoomSocial } from "./room-social.js";
import { roomLine } from "../shared/room-lines.js";

const ACTIVE = ["working", "reviewing", "testing"];
export function createTeamScene(scene, characters, onChange = () => {}) {
  characters.enableTeam({ choreographed: true });
  const people = new Map(characters.residents.map((r) => [r.data.id, r]));
  const circles = new Map(),
    waiters = new Set(),
    packets = [];
  const releases = new Map();
  const inputs = new Map(),
    artifacts = new Map();
  let dialogue = null,
    social,
    socialCaption = null,
    foregroundHolds = 0;
  const life = createAmbientLife(characters),
    cup = createWaterCup(scene);
  const cupDock = new THREE.Vector3(
    WATER_STATION.cup.x,
    WATER_STATION.cup.y,
    WATER_STATION.cup.z,
  );
  const cupOffset = new THREE.Vector3(-0.095, 0.045, -0.025),
    bodyRotation = new THREE.Quaternion();
  let clock = 0,
    paused = false,
    returning = false,
    discussion = null,
    speaker = null,
    listener = null;
  let ambientEnabled = false,
    assembly = null,
    settlingAll = false;
  let caption = "准备开始 · 人物会走到白板前分工";
  let focus = { x: -2.9, z: -1.4 };
  let discussionFocus, discussionReleases, returnCaption;
  const setCaption = (text) => {
    caption = text;
    onChange(text);
  };
  const ready = (actor) => Boolean(people.get(actor)?.action?.arrived && !people.get(actor)?.propBusy);
  const wait = (test, signal, scope = "run") =>
    new Promise((resolve, reject) => {
      signal?.throwIfAborted();
      const item = {
        test,
        scope,
        finish(error) {
          waiters.delete(item);
          signal?.removeEventListener("abort", abort);
          if (error) reject(error);
          else resolve();
        },
      };
      const abort = () =>
        item.finish(signal.reason || new DOMException("已停止", "AbortError"));
      signal?.addEventListener("abort", abort, { once: true });
      waiters.add(item);
    });
  const hold = (seconds, signal, scope) => {
    const until = clock + seconds;
    return wait(() => clock >= until, signal, scope);
  };
  const move = (actor, spec) => {
    releases.delete(actor);
    if (!spec.ambient) {
      social?.interrupt(actor);
      life.interrupt(actor);
    }
    return characters.moveTo(actor, spec);
  };
  const home = (actor) => {
    if (people.get(actor).action?.ambient) return;
    move(actor, {
      ...HOME_SPOTS[actor],
      ambient: true,
      ambientKind: "home",
      pace: 0.78,
    });
  };
  const releaseOthers = (actors = []) => {
    if (!ambientEnabled || assembly) return;
    for (const [id, person] of people)
      if (
        !actors.includes(id) &&
        !ACTIVE.includes(person.team?.status) &&
        !person.stageFrozen
      )
        home(id);
  };
  const face = (actor, other) => {
    const a = people.get(actor),
      b = people.get(other);
    if (a?.action && b)
      a.action.yaw = Math.atan2(
        b.root.position.x - a.root.position.x,
        b.root.position.z - a.root.position.z,
      );
  };
  const atBoard = async (actors, signal, scope = "run") => {
    focus = { x: -2.9, z: -1.4 };
    const reserved = [];
    for (const actor of actors) {
      const point = characters.meetingSpot(BOARD_SPOTS[actor], actors, reserved);
      reserved.push(point);
      move(actor, {
        ...point,
        yaw: Math.atan2(
          BOARD.x - point.x,
          BOARD.z - point.z,
        ),
        pose: actor === "mori" ? "point" : "listen",
        label: "白板前讨论目标",
      });
    }
    await wait(() => actors.every(ready), signal, scope);
  };
  const meet = async (from, to, signal) => {
    const isDesk =
      [from, to].includes("indigo") &&
      [from, to].some((id) => ["luna", "momo"].includes(id));
    releases.delete(from);
    releases.delete(to);
    if (isDesk) {
      for (const actor of [from, to])
        move(actor, {
          ...DESK_MEETING[actor],
          pose: "listen",
          label: "电脑旁核对与交接",
        });
      releaseOthers([from, to]);
      await wait(() => [from, to].every(ready), signal);
    } else {
      const a = people.get(from),
        b = people.get(to);
      if (
        !ready(from) ||
        !ready(to) ||
        a.action?.ambient ||
        b.action?.ambient ||
        a.action?.seat ||
        b.action?.seat ||
        a.root.position.distanceTo(b.root.position) > 1.6
      ) {
        move(from, {
          x: -0.6,
          z: -1.05,
          pose: "listen",
          label: "走近伙伴交接",
        });
        move(to, {
          x: 0.45,
          z: -1.05,
          pose: "listen",
          label: "接收伙伴的产物",
        });
        releaseOthers([from, to]);
        await wait(() => ready(from) && ready(to), signal);
      }
    }
    focus = {
      x:
        (people.get(from).root.position.x + people.get(to).root.position.x) / 2,
      z:
        (people.get(from).root.position.z + people.get(to).root.position.z) / 2,
    };
    face(from, to);
    face(to, from);
  };
  social = createRoomSocial(characters, {
    move,
    face,
    speak: (event, signal) => dialogue?.speak(event, signal),
    onLine(event, kind) {
      socialCaption ??= caption;
      speaker = event.actor;
      listener = event.to;
      setCaption(
        `${TEAM_BY_ID[event.actor].name}与${TEAM_BY_ID[event.to].name} · ${kind === "greeting" ? "路过打招呼" : "休息时聊几句"}`,
      );
      focus = {
        x:
          (people.get(event.actor).root.position.x +
            people.get(event.to).root.position.x) /
          2,
        z:
          (people.get(event.actor).root.position.z +
            people.get(event.to).root.position.z) /
          2,
      };
    },
    onCancel() {
      dialogue?.cancel();
    },
    onEnd(actors) {
      if (actors.includes(speaker)) speaker = listener = null;
      if (socialCaption) setCaption(socialCaption);
      socialCaption = null;
    },
  });
  const clearPackets = () => {
    for (const packet of packets) {
      scene.remove(packet.paper);
      packet.paper.geometry.dispose();
      packet.paper.material.dispose();
    }
    packets.length = 0;
  };
  for (const member of TEAM) {
    const circle = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.37, 32),
      new THREE.MeshBasicMaterial({
        color: member.color,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    circle.rotation.x = -Math.PI / 2;
    circle.visible = false;
    scene.add(circle);
    circles.set(member.id, circle);
  }
  return {
    waterCup: cup,
    get caption() {
      return caption;
    },
    get focus() {
      return focus;
    },
    get social() {
      return social.snapshot;
    },
    configureDialogue(adapter) {
      dialogue = adapter;
    },
    cancelSocial() {
      social.interrupt();
    },
    notice(message) {
      if (message) setCaption(message);
    },
    idle() {
      ambientEnabled = true;
      assembly = null;
      life.reset();
      social.reset();
      inputs.clear();
      artifacts.clear();
      TEAM.forEach(({ id }) => home(id));
      focus = { x: 0.4, z: 0.2 };
      setCaption("等待协作 · 伙伴会阅读、喝水、伸展或走动");
    },
    setAgent(actor, state) {
      characters.setTeamState(actor, state);
    },
    followSnapshot(states, finished = false, currentArtifacts = []) {
      // Restore current work, not historical speeches or completed handoffs.
      this.stop("正在接回后台任务 · 恢复当前工作位置");
      for (const artifact of currentArtifacts) artifacts.set(artifact.id, artifact);
      ambientEnabled = true;
      for (const { id } of TEAM) {
        const state = states.get(id) || { status: "idle", task: "待命" };
        characters.setTeamState(id, state);
        if (!finished && ACTIVE.includes(state.status)) move(id, WORK_SPOTS[id]);
        else home(id);
      }
      setCaption(finished ? "后台执行已结束 · 结果与记录已接回" : "已接回后台任务 · 人物跟随当前执行阶段");
    },
    previewBook(actor, read) {
      // Visible motion preview, independent of agent execution and task history.
      const spot = read ? { ...HOME_SPOTS[actor], pose: "read", bookReading: true } : { ...WORK_SPOTS[actor], pose: WORK_SPOTS[actor].pose === "read" ? "review" : WORK_SPOTS[actor].pose };
      move(actor, { ...spot, ambient: true, ambientKind: "home", label: read ? "动作预览 · 阅读自己的读本" : "动作预览 · 收好读本，回到工位" });
    },
    waitForActor(actor, signal) { return wait(() => ready(actor), signal); },
    setSpeaker(actor, to = null) {
      speaker = actor;
      listener = to;
    },
    async play(event, signal) {
      signal?.throwIfAborted();
      social.interrupt();
      foregroundHolds++;
      try {
        if (event.type === "run.start") {
          inputs.clear();
          artifacts.clear();
          ambientEnabled = true;
          assembly = "opening";
          releases.clear();
          paused = false;
          characters.setTeamPaused(false);
          setCaption("开工讨论 · 六位伙伴正在走向白板");
          await atBoard(
            TEAM.map((m) => m.id),
            signal,
          );
          setCaption("明确目标 · 在白板前分工");
        }
        if (event.type === "agent.state" && ACTIVE.includes(event.status)) {
          const input = inputs.get(event.actor);
          inputs.delete(event.actor);
          if (input && ["indigo", "sleepy"].includes(event.actor) && dialogue) {
            await meet(event.actor, input.from, signal);
            setCaption(
              `${TEAM_BY_ID[event.actor].name}主动找${TEAM_BY_ID[input.from].name} · 核对「${input.artifact?.title || "交接资料"}」`,
            );
            const context = {
              actor: event.actor,
              partner: input.from,
              task: event.task,
              artifact: input.artifact,
            };
            const lines = dialogue.workLines?.(context) || [
              roomLine(event.actor, "work_start", input.from),
              roomLine(input.from, "work_ack", event.actor),
            ];
            for (const line of lines) {
              const person = people.get(line.actor);
              person.action.pose = "talk";
              person.action.label = `和${TEAM_BY_ID[line.to].name}核对交接内容`;
              await dialogue.speak({ ...line, kind: "work" }, signal);
              signal?.throwIfAborted();
              await wait(() => true, signal);
              person.action.pose = "listen";
            }
            releases.set(input.from, clock + 1.1);
          }
          const spec = WORK_SPOTS[event.actor];
          focus = { x: spec.seat?.x ?? spec.x, z: spec.seat?.z ?? spec.z };
          move(event.actor, spec);
          setCaption(`${TEAM_BY_ID[event.actor].name} · ${spec.label}`);
        }
        if (event.type === "artifact") {
          const actor = event.artifact.actor;
          // Use the scene clock: ambient interruptions can replace an action and reset its age.
          const visibleUntil = clock + Math.max(0, 4 - (people.get(actor).action?.age || 0));
          await wait(() => ready(actor) && clock >= visibleUntil, signal);
          artifacts.set(event.artifact.id, event.artifact);
        }
        if (event.type === "handoff") {
          await meet(event.from, event.to, signal);
          const from = people.get(event.from),
            to = people.get(event.to);
          from.action.pose = "offer";
          to.action.pose = "receive";
          from.action.label = `递交：${event.title}`;
          to.action.label = "接收产物";
          setCaption(
            `${from.data.name} → ${to.data.name} · 当面交接「${event.title}」`,
          );
          const paper = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.035, 0.28),
            new THREE.MeshStandardMaterial({ color: "#f3dfa9" }),
          );
          scene.add(paper);
          packets.push({ from, to, paper, start: clock });
          await hold(0.85, signal);
          from.action.pose = "listen";
          to.action.pose = "read";
          inputs.set(event.to, {
            from: event.from,
            artifact: artifacts.get(event.artifactId),
          });
          if (dialogue) {
            to.action.pose = "talk";
            to.action.label = "当面回应 · 已收到交接资料";
            await dialogue.speak(
              {
                ...roomLine(event.to, "work_ack", event.from),
                kind: "handoff",
              },
              signal,
            );
            signal?.throwIfAborted();
            await wait(() => true, signal);
            to.action.pose = "read";
          }
          // A short grace period lets the next assignment keep its participant here.
          for (const id of [event.from, event.to])
            releases.set(id, clock + 1.1);
        }
        if (
          event.type === "tool" &&
          ACTIVE.includes(people.get(event.actor)?.team?.status)
        ) {
          setCaption(`${TEAM_BY_ID[event.actor].name} · ${event.label}`);
        }
        if (event.type === "revision") {
          releaseOthers(["indigo", "luna", "momo"]);
          setCaption(
            `第 ${event.round || 1} 次返工 · 开发、审阅和验证在白板前核对问题`,
          );
          await atBoard(["indigo", "luna", "momo"], signal);
          await hold(1.5, signal);
        }
        if (event.type === "work.activity" && event.activity?.kind === "browser") {
          const person = people.get(event.actor);
          if (person?.action && ACTIVE.includes(person.team?.status)) person.action.label = `浏览器验收 · ${event.activity.label}`;
          setCaption(`${TEAM_BY_ID[event.actor].name}实际操作 Demo · ${event.activity.status === "failed" ? "发现失败，准备讨论返工" : event.activity.label}`);
        }
        if (event.type === "run.complete") {
          TEAM.forEach(({ id }) => {
            if (people.get(id).action) people.get(id).action.pose = "celebrate";
          });
          setCaption(`本轮交付完成 · ${event.artifactCount} 份产物已归档`);
          await hold(1.2, signal);
          assembly = null;
          releases.clear();
          TEAM.forEach(({ id }) => home(id));
          setCaption("协作完成 · 伙伴回到工位和休息区");
          settlingAll = true;
          try {
            await wait(() => TEAM.every(({ id }) => ready(id)), signal);
          } finally {
            settlingAll = false;
          }
          focus = { x: 0.4, z: 0.2 };
          setCaption(
            `本轮交付完成 · ${event.artifactCount} 份产物已归档，伙伴各自休整`,
          );
        }
      } finally {
        foregroundHolds--;
      }
    },
    async prepareSpeech(event, signal) {
      social.interrupt();
      foregroundHolds++;
      try {
        if (event.clip === "finish" || (event.actor === "mori" && !event.to)) {
          assembly = "closing";
          releases.clear();
          setCaption("交付汇报 · 回到白板前核对目标");
          await atBoard(
            TEAM.map((m) => m.id),
            signal,
          );
        } else if (event.to) await meet(event.actor, event.to, signal);
        if (people.get(event.actor).action) {
          people.get(event.actor).action.pose =
            event.actor === "mori" ? "point" : "listen";
          people.get(event.actor).action.label = "向伙伴说明结果";
        }
        setCaption(
          event.to
            ? `${TEAM_BY_ID[event.actor].name}与${TEAM_BY_ID[event.to].name} · 当面交流`
            : "白板前 · 本轮交付汇报",
        );
        await hold(0.25, signal);
      } finally {
        foregroundHolds--;
      }
    },
    finishSpeech(event) {
      if (assembly === "opening") assembly = null;
      releaseOthers([event.actor, event.to]);
    },
    pause(value) {
      paused = value;
      characters.setTeamPaused(value);
      dialogue?.pause?.(value);
    },
    async resume(signal) {
      paused = false;
      characters.setTeamPaused(false);
      returning = true;
      if (returnCaption) setCaption("回到原工位 · 继续当前任务");
      try {
        await wait(
          () =>
            characters.residents.every((r) => !r.action || r.action.arrived && !r.propBusy),
          signal,
          "return",
        );
        if (returnCaption) setCaption(returnCaption);
      } finally {
        returning = false;
        returnCaption = null;
      }
    },
    async beginDiscussion(actors, signal) {
      social.interrupt();
      dialogue?.pause?.(true);
      discussionFocus = focus;
      discussionReleases = new Map(releases);
      returnCaption = caption;
      discussion = new Map(
        actors.map((id) => [
          id,
          people.get(id).action ? { ...people.get(id).action } : null,
        ]),
      );
      characters.residents.forEach(
        (r) =>
          (r.stageFrozen = !actors.includes(r.data.id) && !r.action?.ambient),
      );
      // Waiting companions keep reading or resting; only interrupted task actions freeze.
      ambientEnabled = true;
      releaseOthers(actors);
      paused = false;
      characters.setTeamPaused(false);
      setCaption("临时讨论 · 伙伴正在走向白板");
      await atBoard(actors, signal, "discussion");
      if (actors.length === 2) {
        face(actors[0], actors[1]);
        face(actors[1], actors[0]);
      }
      setCaption("白板前 · 围绕当前目标交流");
    },
    async takeover(control, signal) {
      const actors = control.discussion?.participants || [...new Set([control.actor, "mori"])];
      if (!discussion) await this.beginDiscussion(actors, signal);
      else {
        for (const actor of actors) if (!discussion.has(actor)) discussion.set(actor, people.get(actor).action ? { ...people.get(actor).action } : null);
        characters.residents.forEach((r) => { r.stageFrozen = !discussion.has(r.data.id) && !r.action?.ambient; });
        await atBoard([...discussion.keys()], signal, "discussion");
      }
      signal?.throwIfAborted();
      for (const actor of actors) {
        const action = people.get(actor)?.action;
        if (action) { action.pose = actor === "mori" && actors.length > 1 ? "point" : "listen"; action.label = "执行已暂停 · 听取使用者修改意见"; }
      }
      const note = control.notes.at(-1);
      setCaption(note ? `接管${TEAM_BY_ID[control.actor].name} · 修改 ${control.version}：${note.text}` : `接管${TEAM_BY_ID[control.actor].name} · 在白板前等待使用者指导，后台后续工具已暂停`);
    },
    async takeoverSpeech(event, signal) {
      signal?.throwIfAborted();
      const person = people.get(event.actor);
      if (!discussion?.has(event.actor) || !ready(event.actor)) throw new Error("讨论角色尚未到白板，请等待场景就位。");
      if (event.to && discussion.has(event.to)) face(event.actor, event.to);
      for (const actor of discussion.keys()) {
        const action = people.get(actor)?.action;
        if (action) { action.pose = actor === event.actor ? "point" : "listen"; action.label = actor === event.actor ? "白板前说明调整方案 · 尚未执行" : "听取伙伴的调整建议"; }
      }
      focus = { x: BOARD.x, z: BOARD.z + 1.4 };
      setCaption(`${TEAM_BY_ID[event.actor].name}${event.to ? " → " + TEAM_BY_ID[event.to].name : "回应使用者"} · 白板前核对调整方案，执行仍暂停`);
      return person;
    },
    finishTakeoverSpeech() {
      for (const actor of discussion?.keys() || []) {
        const action = people.get(actor)?.action;
        if (action) { action.pose = "listen"; action.label = "调整方案待确认 · 点击继续后才回工位"; }
      }
    },
    endDiscussion(resumeWork = false) {
      if (!discussion) return;
      characters.residents.forEach((r) => {
        if (discussion.has(r.data.id)) {
          const previous = discussion.get(r.data.id);
          if (previous && resumeWork) move(r.data.id, previous);
          else home(r.data.id);
          if (resumeWork && discussionReleases.has(r.data.id))
            releases.set(r.data.id, discussionReleases.get(r.data.id));
        }
        r.stageFrozen = false;
      });
      discussion = null;
      discussionReleases = null;
      if (!resumeWork) {
        assembly = null;
        TEAM.forEach(({ id }) => home(id));
      }
      if (resumeWork) focus = discussionFocus;
      else returnCaption = null;
      paused = resumeWork;
      characters.setTeamPaused(resumeWork);
      if (!resumeWork) dialogue?.pause?.(false);
      setCaption(
        resumeWork
          ? "讨论结束 · 可继续协作回放"
          : "讨论结束 · 意见已记录，伙伴回到各自的位置",
      );
    },
    stop(message = "已停止 · 人物停在当前位置，产物保留") {
      social.interrupt();
      dialogue?.cancel();
      discussion = null;
      speaker = listener = null;
      returning = false;
      discussionReleases = null;
      ambientEnabled = false;
      assembly = null;
      releases.clear();
      life.reset();
      settlingAll = false;
      returnCaption = null;
      for (const item of [...waiters])
        item.finish(new DOMException("已停止", "AbortError"));
      characters.stopActions();
      characters.setTeamPaused(false);
      paused = false;
      clearPackets();
      setCaption(message);
    },
    update(time, delta, level, reducedMotion) {
      if (!paused && !discussion && !returning) clock += delta;
      social.update(delta, {
        enabled:
          ambientEnabled &&
          !paused &&
          !discussion &&
          !returning &&
          !assembly &&
          !settlingAll &&
          !foregroundHolds &&
          (!speaker || social.actors.includes(speaker)),
        reducedMotion,
      });
      life.update(delta, {
        enabled:
          ambientEnabled && !paused && !returning && !assembly && !settlingAll,
        reducedMotion,
        excluded: [speaker, listener, ...social.actors],
      });
      if (ambientEnabled && !paused && !discussion && !returning && !assembly) {
        for (const [actor, until] of releases)
          if (clock >= until) {
            releases.delete(actor);
            if (
              ![speaker, listener].includes(actor) &&
              !ACTIVE.includes(people.get(actor).team?.status)
            )
              home(actor);
          }
      }
      characters.setSpeaking(speaker, level, listener);
      const drinking = characters.residents.find((r) => r.drinkGrip > 0.001);
      cup.position.copy(drinking?.cupDock || cupDock);
      cup.quaternion.identity();
      if (drinking) {
        drinking.body.getWorldQuaternion(bodyRotation);
        const palm = drinking.wrists[1].localToWorld(
          new THREE.Vector3(0, -0.055, 0),
        );
        palm.add(cupOffset.clone().applyQuaternion(bodyRotation));
        cup.position.lerp(palm, drinking.drinkGrip);
        cup.quaternion.slerp(bodyRotation.clone().multiply(
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(-drinking.drinkTilt, 0, 0),
            ),
          ), drinking.drinkGrip);
      }
      for (const r of characters.residents) {
        const circle = circles.get(r.data.id);
        circle.position.set(r.root.position.x, 0.024, r.root.position.z);
        circle.visible =
          r.root.visible &&
          (speaker === r.data.id ||
            listener === r.data.id ||
            ACTIVE.includes(r.team?.status));
        circle.material.opacity = speaker === r.data.id ? 0.8 : 0.3;
        if (
          !paused &&
          speaker &&
          listener &&
          ready(r.data.id) &&
          [speaker, listener].includes(r.data.id) &&
          !(r.action?.socialId && r.action.seat)
        ) {
          face(r.data.id, r.data.id === speaker ? listener : speaker);
        }
      }
      for (let i = packets.length - 1; i >= 0; i--) {
        const packet = packets[i],
          t = Math.min(1, (clock - packet.start) / 0.85);
        packet.paper.visible = !discussion && !returning;
        const a = packet.from.wrists[1].localToWorld(
          new THREE.Vector3(0, -0.055, 0),
        );
        const b = packet.to.wrists[0].localToWorld(
          new THREE.Vector3(0, -0.055, 0),
        );
        packet.paper.position.copy(a).lerp(b, t);
        packet.paper.position.y += Math.sin(t * Math.PI) * 0.1;
        packet.paper.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        if (t === 1) {
          scene.remove(packet.paper);
          packet.paper.geometry.dispose();
          packet.paper.material.dispose();
          packets.splice(i, 1);
        }
      }
      if (!paused)
        for (const item of [...waiters])
          if (
            (discussion
              ? item.scope === "discussion"
              : returning
                ? item.scope === "return"
                : item.scope === "run") &&
            item.test()
          )
            item.finish();
    },
  };
}

import { TEAM, TEAM_BY_ID } from "./team.js";

const texts = {
  greet: [
    "嗨，路过看看你，忙得怎么样？",
    "嗨，出来活动一下呀？",
    "嗨，刚好碰见你，歇口气吧。",
    "嗨，眼睛累了就休息一下。",
    "嗨，肩膀放松一点呀。",
    "嗨，我起来走走，你也别坐太久。",
  ],
  greet_reply: [
    "还挺顺利的，你也慢慢来。",
    "嗯，正好换换脑子，待会儿再继续。",
    "好呀，我也正想活动一下。",
    "谢谢提醒，我看完这页就歇一会儿。",
    "好，等会儿一起继续。",
    "嗯，起来走两步舒服多了。",
  ],
  chat: [
    "我准备歇口气，一起聊两句？",
    "资料看久了，聊两句换换脑子吧。",
    "盯屏幕有点久了，我出来透透气。",
    "先放下文档，休息一下眼睛吧。",
    "坐一会儿，放松一下肩膀吧。",
    "手记先放一放，和你聊两句。",
  ],
  chat_reply: [
    "好呀，缓一缓，有精神了再接着忙。",
    "好，休息一下，思路也会清楚些。",
    "嗯，稍微歇一会儿，再回去继续。",
    "好呀，刚好让脑子放松一下。",
    "嗯，这会儿正适合歇口气。",
    "好，我也刚好想放松一下。",
  ],
  work_start: [
    "先和你对齐一下，再安排下一步。",
    "我先和你确认一下资料的重点。",
    "我准备接着做方案，先和你确认一下重点。",
    "我准备开始审阅，先核对一下交接内容。",
    "我准备开始检查，先确认一下要点。",
    "我准备整理交付记录，先和你核对一下内容。",
  ],
  work_ack: [
    "收到，我们按交接资料继续，有问题再一起确认。",
    "收到，我先核对这份资料，有问题再找你。",
    "收到，我会按交接的内容继续推进。",
    "收到，我先核对内容，再看需要补充的地方。",
    "收到，我会重点留意刚才提到的约束。",
    "收到，我先把这些内容整理清楚。",
  ],
};

export const ROOM_CLIPS = Object.fromEntries(
  Object.entries(texts).flatMap(([kind, lines]) =>
    TEAM.map((member, i) => {
      const clip = `${member.id}_${kind}`;
      return [
        clip,
        {
          actor: member.id,
          text: lines[i],
          clip,
          collection: "room",
          category: kind,
        },
      ];
    }),
  ),
);

export function roomLine(actor, category, to) {
  return { ...ROOM_CLIPS[`${actor}_${category}`], to, kind: "room" };
}

export function workLines({ mode, actor, partner, task, artifact }) {
  if (mode === "demo" || !artifact)
    return [
      roomLine(actor, "work_start", partner),
      roomLine(partner, "work_ack", actor),
    ];
  return [
    {
      actor,
      to: partner,
      text: `${TEAM_BY_ID[partner].name}，我接下来${(task || TEAM_BY_ID[actor].job).slice(0, 32)}，先核对一下「${artifact.title.slice(0, 28)}」。`,
    },
    {
      actor: partner,
      to: actor,
      text: `${artifact.summary.replace(/\s+/g, " ").slice(0, 90)}。我们按这份交接继续。`,
    },
  ];
}

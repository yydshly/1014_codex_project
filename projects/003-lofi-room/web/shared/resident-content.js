import { TEAM_BY_ID } from "./team.js";

// Original in-room reading material. It is character background, not an Agent result.
export const ROLE_READING = {
  mori: { title: "把目标说清楚", chapters: [
    ["先写完成条件", "把需求变成可检查的结果。描述使用者要做什么，以及做到什么程度才算完成。", "交接前留下负责人、输入和下一步，别让伙伴重新猜测上下文。"],
    ["把工作拆小", "每份任务应有明确的输入与输出。独立的工作可以并行，共同修改的位置需要先约定。", "遇到阻塞，先找能提供证据的人，把问题带回讨论。"],
    ["最后一起验收", "构建通过只是其中一步。还要实际打开页面，按原始需求走完操作。", "把仍未确认的事项写出来，给下一轮留下清楚的起点。"],
  ] },
  amber: { title: "来源核验手册", chapters: [
    ["先找原始资料", "先读项目说明、目录与入口文件。记录来源、固定版本与许可证，再判断能复用什么。", "事实、推测与待确认项分开写，引用要能回到具体文件。"],
    ["带着问题阅读", "追踪一个实际调用，从输入走到输出。遇到不认识的函数，沿定义和使用位置继续找。", "把关键路径画成简单的箭头，交给开发者验证。"],
    ["研究也要交接", "研究笔记需要结论和依据。只堆积链接，会让伙伴再做一遍相同的阅读。", "下一位应该知道：先改哪里、有什么约束、还缺什么证据。"],
  ] },
  indigo: { title: "小步修改与反馈", chapters: [
    ["先理解调用链", "修改之前读清入口和使用位置。尽量保留原来的接口，让变化集中在需要变化的地方。", "一次解决一个问题，给自己留下可以回退的边界。"],
    ["让失败可定位", "读完整的错误位置与调用栈。先复现，再修复；新的断言应当检验契约。", "失败不是进度条，具体日志才是下一步行动的依据。"],
    ["给伙伴看改动", "交接时说明改了哪些文件、为什么这样改，以及哪些检查还没有运行。", "让代码、运行行为与交付说明互相对应。"],
  ] },
  luna: { title: "审阅时的几个问题", chapters: [
    ["从需求到实现", "这个入口真的能触发功能吗？空输入、失败响应和重复操作是否都有清楚的行为？", "沿着真实调用检查，不以文件名字推断功能已经完成。"],
    ["留下可行动的反馈", "指出具体文件、问题表现和修复方向。把必须修复的缺陷与可选建议分开。", "复核已经解决的问题，让讨论继续向前。"],
    ["证据和边界", "测试结论应来自实际执行。历史失败可以帮助定位，但不能替代当前轮次的结果。", "尚未打开的页面、尚未运行的命令，都应如实写明。"],
  ] },
  momo: { title: "测试记录怎么写", chapters: [
    ["从操作开始", "写出触发步骤、期望结果和实际表现。断言应覆盖使用者真正能遇到的路径。", "失败时保留输入、输出和退出码，方便伙伴再次复现。"],
    ["覆盖边界条件", "检查空值、重复请求、取消与错误恢复。用最小用例验证一个具体约束。", "不要用更容易通过的假检查替换原有测试。"],
    ["通过之后", "确认测试针对当前源码运行，打开实际成果，再把证据交给记录员。", "自动检查与人工体验各自负责不同的验证范围。"],
  ] },
  sleepy: { title: "交付记录小册", chapters: [
    ["把过程留住", "记录来源、版本、改动与运行方法。让后来接手的人不必依赖聊天记忆。", "将实际执行证据与口头总结分别保存。"],
    ["交付能运行的东西", "核对地址和源码来自同一轮。写清启动方式、依赖和已经验证的范围。", "限时运行地址需要保留重新启动的入口。"],
    ["给明天留一页", "归档已完成的结果，也保留没有解决的问题。下一轮从已有证据继续。", "今天的笔记：写清楚，比写得长更有用。"],
  ] },
};

export function residentContent(snapshot = {}, actor) {
  const member = TEAM_BY_ID[actor], book = ROLE_READING[actor];
  const artifact = snapshot.artifacts?.findLast((item) => item.actor === actor);
  const task = snapshot.tasks?.find((item) => item.id === actor);
  const goal = snapshot.goal;
  const notes = [
    `${member.name} · ${member.role}`,
    goal?.title ? `当前目标：${goal.title}` : `今天的关注：${member.job}`,
    ...(artifact ? [`产物摘录：${artifact.title}`, artifact.summary] : [`随手记：${book.chapters[0][2]}`, `下次注意：${book.chapters[1][2]}`]),
    goal?.criteria?.[0] ? `验收提醒：${goal.criteria[0]}` : book.chapters[2][2],
    task && ["working", "reviewing", "testing"].includes(task.status) ? `当前分工：${task.task}` : "留下问题，等下一次讨论。",
  ].filter(Boolean);
  return { actor, member, book, notes, noteSource: artifact ? "本轮公开产物摘录 · 个人笔记" : "角色日常笔记 · 未提交任务产物",
    artifactId: artifact?.id || null, bookSource: "本地原创角色读本", drink: `${member.name}的饮水时刻 · 温水` };
}

export function readingFrame(content, age, reducedMotion = false) {
  const index = Math.floor(age / 10) % content.book.chapters.length;
  const phase = age % 10;
  return { index, chapter: content.book.chapters[index], page: index * 2 + 1,
    turn: reducedMotion || phase < 8.8 ? 0 : (phase - 8.8) / 1.2 };
}
export function writingFrame(content, age, reducedMotion = false) {
  const prefix = content.notes.slice(0, 3).join("\n\n") + "\n\n";
  const rest = content.notes.slice(3).join("\n\n"), text = prefix + rest;
  return { text: reducedMotion ? text : prefix + rest.slice(0, Math.floor(age * 9)), total: text.length,
    complete: reducedMotion || age * 9 >= rest.length, source: content.noteSource };
}
export function notebookPages(text, columns = 26, rows = 11) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "", width = 0;
    for (const char of paragraph) {
      const size = /[\u0000-\u00ff]/.test(char) ? .55 : 1;
      if (width + size > columns) { lines.push(line); line = ""; width = 0; }
      line += char; width += size;
    }
    lines.push(line);
  }
  return Array.from({ length: Math.max(1, Math.ceil(lines.length / rows)) }, (_, i) => lines.slice(i * rows, (i + 1) * rows));
}
export function drinkingFill(age, initial = .82) {
  const t = Math.max(0, Math.min(1, (age - 2.4) / 1.3));
  return Math.max(.12, initial - t * t * (3 - 2 * t) * .36);
}

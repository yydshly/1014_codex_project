// 真实项目新任务表单的三个模板：功能开发、问题修复、测试补全。
// 仅填充任务名称、需求与逐行验收，保留仓库地址、来源、执行方式，不自动提交。
// 字段仍然可以手工编辑，避免替用户决定路径。
// 该文件被 src/workspace.js 的 bindTaskTemplateButtons 调用，也被
// tests/task-templates.test.js 引用。

const TITLE_LIMIT = 80;
const BRIEF_LIMIT = 400;
const CRITERIA_LINE_LIMIT = 120;
const MAX_CRITERIA_LINES = 6;

const trim = (value) => (typeof value === "string" ? value.trim() : "");

const trimBrief = (text) => {
  const trimmed = trim(text);
  return trimmed.length > BRIEF_LIMIT ? trimmed.slice(0, BRIEF_LIMIT) : trimmed;
};

const trimCriterion = (line) => {
  const trimmed = trim(line);
  return trimmed.length > CRITERIA_LINE_LIMIT
    ? trimmed.slice(0, CRITERIA_LINE_LIMIT)
    : trimmed;
};

// 三个模板只描述"需求 + 验收"，保留仓库与来源，留给用户在原仓库决定细节。
// 标题里只放占位「…」让用户自己填，避免替用户决定具体模块。
export const TASK_TEMPLATES = Object.freeze([
  Object.freeze({
    id: "feature-dev",
    label: "功能开发",
    description: "为现有仓库增加一个具体可演示的新功能",
    title: "为…增加新功能",
    brief: trimBrief(
      "围绕用户提出的具体需求，在保留原有接口的前提下增加一个新功能；" +
        "新功能需要可被真实点击或输入触发，并在页面上看到明确的效果反馈；" +
        "实现要遵循原项目的代码风格与既有目录组织，不要新增与本功能无关的改动。",
    ),
    criteria: Object.freeze([
      "在原 UI 上找到可触发的入口，输入或操作可生效并展示效果",
      "新功能保持原有 API、目录与命名风格，无关文件未被改动",
      "运行原项目的 build 与 test 全部通过，必要时补充最小验证脚本",
    ].map(trimCriterion)),
  }),
  Object.freeze({
    id: "bugfix",
    label: "问题修复",
    description: "定位并修复原仓库中一处真实缺陷",
    title: "修复…问题",
    brief: trimBrief(
      "描述问题的可复现路径与期望行为；需要列出触发步骤、当前表现与期望结果的差异；" +
        "修复要尽量小范围、可回滚，并在提交说明里写清根因；不要顺手修改与本缺陷无关的代码。",
    ),
    criteria: Object.freeze([
      "已记录可复现步骤，并在修复后按相同步骤不再触发原症状",
      "修复仅触及与本缺陷相关的文件，并附简要的根因说明",
      "运行原项目的 build 与 test 全部通过，必要时新增/调整针对性测试",
    ].map(trimCriterion)),
  }),
  Object.freeze({
    id: "test-coverage",
    label: "测试补全",
    description: "为已有功能补充真实可执行的测试用例",
    title: "补全…测试",
    brief: trimBrief(
      "梳理缺失用例与覆盖范围，列出当前最容易回归的关键路径；" +
        "新增测试要贴近真实调用方式，能够定位失败原因而不是堆砌断言；" +
        "覆盖要尊重原项目的测试组织，不引入与现有测试体系冲突的依赖。",
    ),
    criteria: Object.freeze([
      "原项目的 build 与 test 全部通过，新增测试可独立运行",
      "新增测试能定位到具体失败点，而不是一次性断言全部结果",
      "测试用例与上游契约保持一致，覆盖关键路径与边界条件",
    ].map(trimCriterion)),
  }),
]);

export const TASK_TEMPLATE_IDS = Object.freeze(
  TASK_TEMPLATES.map((template) => template.id),
);

export function findTemplate(id) {
  return TASK_TEMPLATES.find((template) => template.id === id) || null;
}

const assertString = (value, name) => {
  if (typeof value !== "string") throw new Error(`${name} 必须是字符串`);
  return value;
};

const assertFilled = (value, name) => {
  const text = assertString(value, name);
  if (!text.trim()) throw new Error(`${name} 不能为空`);
  return text;
};

// 把指定模板写入标题、需求与验收，保留其他字段。
// nodes 必须包含：title / brief / criteria（输入元素或带 value 的对象）。
// 不触碰 repository-input / repository-source / repository-execution，也不触发 submit。
export function applyTemplate(templateId, nodes) {
  const template = findTemplate(templateId);
  if (!template) throw new Error(`未找到模板：${templateId}`);
  if (!nodes || typeof nodes !== "object")
    throw new Error("applyTemplate 需要提供字段节点");

  const titleNode = nodes.title;
  const briefNode = nodes.brief;
  const criteriaNode = nodes.criteria;
  if (!titleNode || !briefNode || !criteriaNode)
    throw new Error("applyTemplate 缺少 title / brief / criteria 节点");

  const title = assertFilled(template.title, "模板标题");
  const brief = assertFilled(template.brief, "模板需求");
  if (!Array.isArray(template.criteria) || !template.criteria.length)
    throw new Error("模板至少需要 1 条验收要求");
  if (template.criteria.length > MAX_CRITERIA_LINES)
    throw new Error("模板验收要求不能超过 6 条");

  const trimmedTitle =
    title.length > TITLE_LIMIT ? title.slice(0, TITLE_LIMIT) : title;
  const trimmedBrief =
    brief.length > BRIEF_LIMIT ? brief.slice(0, BRIEF_LIMIT) : brief;
  const trimmedCriteria = template.criteria.map((line, index) => {
    const text = assertFilled(line, `第 ${index + 1} 条验收`);
    return text.length > CRITERIA_LINE_LIMIT
      ? text.slice(0, CRITERIA_LINE_LIMIT)
      : text;
  });

  titleNode.value = trimmedTitle;
  briefNode.value = trimmedBrief;
  criteriaNode.value = trimmedCriteria.join("\n");

  return Object.freeze({
    id: template.id,
    title: trimmedTitle,
    brief: trimmedBrief,
    criteria: Object.freeze(trimmedCriteria.slice()),
  });
}

// 在表单内放置三个按钮，点击只调用 applyTemplate，不主动提交。
// 期望 nodes 含 title / brief / criteria / repository / source / execution 节点；
// 仓库 / 来源 / 执行方式保持原值。
export function fillByTemplateButton(templateId, nodes) {
  const before = {
    repository: nodes?.repository?.value,
    source: nodes?.source?.value,
    execution: nodes?.execution?.value,
    open: nodes?.dialog?.open,
  };
  const result = applyTemplate(templateId, nodes);
  const after = {
    repository: nodes?.repository?.value,
    source: nodes?.source?.value,
    execution: nodes?.execution?.value,
    open: nodes?.dialog?.open,
  };
  return { result, before, after };
}

export const TASK_TEMPLATE_LIMITS = Object.freeze({
  title: TITLE_LIMIT,
  brief: BRIEF_LIMIT,
  criteriaLine: CRITERIA_LINE_LIMIT,
  criteriaLines: MAX_CRITERIA_LINES,
});

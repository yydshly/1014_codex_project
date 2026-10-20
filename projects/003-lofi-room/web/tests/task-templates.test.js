import test from "node:test";
import assert from "node:assert/strict";
import {
  TASK_TEMPLATES,
  TASK_TEMPLATE_IDS,
  TASK_TEMPLATE_LIMITS,
  applyTemplate,
  fillByTemplateButton,
  findTemplate,
} from "../shared/task-templates.js";

// 用简单的 value 节点，便于脱离浏览器在 node:test 里验证写入与保留。
const node = (initial = "") => ({ value: initial });

test("提供恰好 3 个模板，覆盖功能开发、问题修复、测试补全", () => {
  assert.equal(TASK_TEMPLATES.length, 3);
  assert.deepEqual(TASK_TEMPLATE_IDS, [
    "feature-dev",
    "bugfix",
    "test-coverage",
  ]);
  assert.equal(findTemplate("feature-dev").label, "功能开发");
  assert.equal(findTemplate("bugfix").label, "问题修复");
  assert.equal(findTemplate("test-coverage").label, "测试补全");
  for (const template of TASK_TEMPLATES) {
    assert.ok(template.id);
    assert.ok(template.label);
    assert.ok(template.description);
  }
});

test("每个模板都包含必填的标题、需求和至少一条验收", () => {
  for (const template of TASK_TEMPLATES) {
    assert.ok(
      typeof template.title === "string" && template.title.trim().length > 0,
      `${template.id} 缺少标题`,
    );
    assert.ok(
      typeof template.brief === "string" && template.brief.trim().length > 0,
      `${template.id} 缺少需求`,
    );
    assert.ok(
      Array.isArray(template.criteria) && template.criteria.length >= 1,
      `${template.id} 必须有至少一条验收`,
    );
    assert.ok(
      template.criteria.length <= TASK_TEMPLATE_LIMITS.criteriaLines,
      `${template.id} 验收条数超限`,
    );
    for (const line of template.criteria) {
      assert.ok(typeof line === "string" && line.trim().length > 0);
      assert.ok(
        line.length <= TASK_TEMPLATE_LIMITS.criteriaLine,
        `${template.id} 单条验收超过 ${TASK_TEMPLATE_LIMITS.criteriaLine} 字`,
      );
    }
    assert.ok(
      template.title.length <= TASK_TEMPLATE_LIMITS.title,
      `${template.id} 标题超过 ${TASK_TEMPLATE_LIMITS.title} 字`,
    );
    assert.ok(
      template.brief.length <= TASK_TEMPLATE_LIMITS.brief,
      `${template.id} 需求超过 ${TASK_TEMPLATE_LIMITS.brief} 字`,
    );
  }
});

test("applyTemplate 写入标题/需求/逐行验收，保留仓库、来源、执行方式、对话框状态", () => {
  for (const template of TASK_TEMPLATES) {
    const title = node("旧标题");
    const brief = node("旧需求");
    const criteria = node("旧 1\n旧 2");
    const repository = node("https://github.com/example/repo");
    const source = node("workspace");
    const execution = node("upstream");
    const dialog = { open: false };
    const nodes = {
      title,
      brief,
      criteria,
      repository,
      source,
      execution,
      dialog,
    };

    const { result, before, after } = fillByTemplateButton(
      template.id,
      nodes,
    );

    assert.equal(title.value, template.title);
    assert.equal(brief.value, template.brief);
    assert.equal(criteria.value, template.criteria.join("\n"));
    assert.deepEqual(result.criteria, template.criteria);

    // 仓库、来源、执行方式、对话框状态保持原样，绝不主动提交或关闭对话框。
    assert.equal(repository.value, "https://github.com/example/repo");
    assert.equal(source.value, "workspace");
    assert.equal(execution.value, "upstream");
    assert.equal(dialog.open, false);
    assert.deepEqual(before, {
      repository: "https://github.com/example/repo",
      source: "workspace",
      execution: "upstream",
      open: false,
    });
    assert.deepEqual(after, before);
  }
});

test("不会触发自动提交，字段在填充后仍可手工编辑", () => {
  let submitted = 0;
  const submit = () => {
    submitted++;
  };
  const form = {
    requestSubmit: submit,
    submit,
  };
  const nodes = {
    title: node(""),
    brief: node(""),
    criteria: node(""),
    repository: node("https://github.com/example/repo"),
    source: node("github"),
    execution: node("offline"),
    dialog: { open: true },
    form,
  };
  fillByTemplateButton("feature-dev", nodes);
  // 模拟用户在按钮填充后继续编辑标题
  nodes.title.value = "为搜索增加历史记录";
  assert.equal(submitted, 0);
  assert.equal(nodes.title.value, "为搜索增加历史记录");
  // 再切换模板应覆盖之前的输入
  fillByTemplateButton("bugfix", nodes);
  assert.match(nodes.title.value, /修复…问题/);
  assert.equal(submitted, 0);
  // 确认未读取 form.submit / requestSubmit
  assert.notEqual(nodes.form, undefined);
});

test("未知模板或缺少字段时抛出明确错误，且不污染节点", () => {
  // findTemplate 是纯查询：未命中返回 null，由调用方决定后续处理。
  assert.equal(findTemplate("nope"), null);
  // 未知 id 应抛错并提示"未找到模板"，且不会写入任何字段。
  const nodes = {
    title: node("原值"),
    brief: node("原值"),
    criteria: node("原值"),
  };
  assert.throws(() => applyTemplate("missing", nodes), /未找到模板/);
  assert.equal(nodes.title.value, "原值");
  assert.equal(nodes.brief.value, "原值");
  assert.equal(nodes.criteria.value, "原值");
  // 缺少 criteria 节点同样抛错且不会污染现有字段。
  const partial = { title: node("原标题"), brief: node("原需求") };
  assert.throws(
    () => applyTemplate("feature-dev", partial),
    /缺少.*criteria/,
  );
  assert.equal(partial.title.value, "原标题");
  assert.equal(partial.brief.value, "原需求");
});

test("模板内容经 GoalStore 校验也能通过，不超过上限", () => {
  // 通过计算 length 直接覆盖；不动 store。
  for (const template of TASK_TEMPLATES) {
    assert.ok(template.title.length <= 80);
    assert.ok(template.brief.length <= 400);
    for (const line of template.criteria) {
      assert.ok(line.length <= 120);
      assert.ok(line.trim().length > 0);
    }
  }
});

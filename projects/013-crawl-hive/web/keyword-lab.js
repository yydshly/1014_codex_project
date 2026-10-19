const initializedResults = new WeakSet();

// Match spec.words exactly: deduplicate before limiting and truncating.
function normalizeWords(value) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(items.map(item => String(item).trim()).filter(Boolean))]
    .slice(0, 20)
    .map(item => item.slice(0, 60));
}

const examples = {
  pass: {
    include: '发布,更新',
    exclude: '招聘',
    text: '示例项目发布 v2.4，并更新了迁移指南与离线导出说明。'
  },
  exclude: {
    include: '发布,更新',
    exclude: '招聘',
    text: '示例项目发布新版本，同时发布设计师招聘信息。'
  },
  substring: {
    include: 'AI',
    exclude: '招聘',
    text: 'The chain has a new release.'
  },
  missing: {
    include: '发布,更新',
    exclude: '招聘',
    text: '示例社区举办线下交流会，报名入口现已开放。'
  }
};

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function formatWords(words) {
  return words.length ? words.map(word => `「${word}」`).join('、') : '无';
}

export function initKeywordLab() {
  const includeInput = document.querySelector('#keyword-include');
  const excludeInput = document.querySelector('#keyword-exclude');
  const textInput = document.querySelector('#keyword-text');
  const result = document.querySelector('#keyword-result');
  if (!includeInput || !excludeInput || !textInput || !result || initializedResults.has(result)) return;
  initializedResults.add(result);

  const buttons = [...document.querySelectorAll('[data-keyword-example]')];
  if (!textInput.value) textInput.value = examples.pass.text;

  function markExample(activeButton) {
    buttons.forEach(button => {
      const active = button === activeButton;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function render() {
    const include = normalizeWords(includeInput.value);
    const exclude = normalizeWords(excludeInput.value);
    const loweredText = textInput.value.toLowerCase();
    const includeHits = include.filter(word => loweredText.includes(word.toLowerCase()));
    const excludeHits = exclude.filter(word => loweredText.includes(word.toLowerCase()));
    const passes = !excludeHits.length && (!include.length || includeHits.length > 0);

    result.classList.toggle('kw-result-pass', passes);
    result.classList.toggle('kw-result-reject', !passes);

    let reason;
    if (excludeHits.length) {
      reason = `命中排除词 ${formatWords(excludeHits)}，优先过滤。${includeHits.length ? `虽然也命中包含词 ${formatWords(includeHits)}，仍不通过。` : ''}`;
    } else if (!include.length) {
      reason = '没有设置包含词，因此不要求命中包含词；同时没有命中排除词，关键词层通过。';
    } else if (includeHits.length) {
      reason = `命中包含词 ${formatWords(includeHits)}，且没有命中排除词。包含词之间是“任意一个即可”的 OR 关系。`;
    } else {
      reason = `没有命中任何包含词 ${formatWords(include)}。虽然没有命中排除词，关键词层仍会过滤。`;
    }

    const content = [
      element('span', passes ? '关键词层：通过' : '关键词层：过滤', 'tag'),
      element('h4', passes ? '这段文本通过了关键词检查' : '这段文本被关键词规则过滤'),
      element('p', reason),
      element('p', `实际使用的包含词：${formatWords(include)}。`),
      element('p', `实际使用的排除词：${formatWords(exclude)}。`),
      element('p', `包含词命中：${formatWords(includeHits)}；排除词命中：${formatWords(excludeHits)}。`)
    ];

    if (includeHits.some(word => word.toLowerCase() === 'ai') && loweredText.includes('chain')) {
      content.push(element('p', '子串例子：chain 中间含有 ai，因此包含词 AI 也会命中。这里没有整词、分词、语义、正则或 AND 判断。', 'small-callout'));
    }

    content.push(
      element('p', '词表先按英文逗号分隔并去掉首尾空白，丢弃空项，按原大小写去重，取前 20 项，再将每项截为前 60 个字符。中文逗号、空格和换行不会被当作分隔符；大小写不同的词在去重时仍是不同项。'),
      element('p', '匹配时忽略大小写，直接检查文本是否包含该子串。空包含词表不限制内容；任一排除词命中优先拒绝。'),
      element('p', '仅演示共享 matchesKeywords 及词表整理这一层。没有执行采集、AI、币名提取、置信度检查、去重或安全扫描；通过不代表最终会产生信号。', 'small-callout')
    );
    result.replaceChildren(...content);
  }

  [includeInput, excludeInput, textInput].forEach(input => {
    input.addEventListener('input', () => {
      markExample(null);
      render();
    });
  });

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const example = examples[button.dataset.keywordExample];
      if (!example) return;
      includeInput.value = example.include;
      excludeInput.value = example.exclude;
      textInput.value = example.text;
      markExample(button);
      render();
    });
  });

  markExample(null);
  render();
}

export const revision = '1c2b42d660e4a7571813fb43839c79e3e9ca7720';
export const repository = 'https://github.com/tt-a1i/archify';
export const version = 'v3.1.0';

// The diagram describes the inspected render command, not a hosted AI service.
export const nodes = [
  { id: 'input', type: 'database', pos: [40, 40],
    label: ['图解数据', 'Diagram data'], sub: ['结构化 JSON', 'Typed JSON'],
    description: ['组件、连接、坐标与源码引用被写进 JSON。图解的事实和布局来自这份输入，而不是浏览器自行分析代码。', 'The JSON supplies components, relationships, placement, and source references. The browser does not analyze a repository on its own.'],
    source: { path: 'archify/renderers/shared/cli.mjs', line: 47, end_line: 81 } },
  { id: 'cli', type: 'backend', pos: [340, 40],
    label: ['命令行入口', 'CLI entry'], sub: ['选择图解类型', 'Select diagram type'],
    description: ['render 命令读取类型与文件路径，选择对应的渲染器，再通过 Node.js 子进程运行它。这里聚焦 architecture 分支。', 'The render command selects a renderer and runs it in a Node.js child process. This guide follows the architecture branch.'],
    source: { path: 'archify/bin/archify.mjs', line: 4233, end_line: 4249 } },
  { id: 'validation', type: 'security', pos: [640, 40],
    label: ['读取与校验', 'Read & validate'], sub: ['格式与源码证据', 'Schema & evidence'],
    description: ['共用加载器解析 JSON、校验格式、处理语言，并核对固定版本的源码引用。通过后才把数据交给渲染器。', 'The shared loader parses JSON, validates its schema, applies locale messages, and verifies source references against the pinned commit.'],
    source: { path: 'archify/renderers/shared/cli.mjs', line: 79, end_line: 101 } },
  { id: 'renderer', type: 'backend', pos: [640, 235],
    label: ['架构渲染器', 'Architecture renderer'], sub: ['布局校验与 SVG', 'Layout checks & SVG'],
    description: ['架构渲染器检查节点与连接的布局，生成 SVG，再把图、说明卡片和源码证据交给共用输出模块。', 'The architecture renderer checks the layout and supplies SVG, cards, and source evidence to the shared writer.'],
    source: { path: 'archify/renderers/architecture/render-architecture.mjs', line: 1194, end_line: 1204 } },
  { id: 'writer', type: 'backend', pos: [340, 235],
    label: ['网页组装', 'HTML assembly'], sub: ['模板与交互脚本', 'Template & viewer'],
    description: ['输出模块把标题、语言、SVG 与源码证据填入内嵌阅读器的模板，写入候选文件，并检查后发布到目标路径。', 'The shared writer fills the viewer template with the title, locale, SVG, and evidence, then publishes the staged HTML to the target path.'],
    source: { path: 'archify/renderers/shared/cli.mjs', line: 233, end_line: 280 } },
  { id: 'html', type: 'database', pos: [40, 235],
    label: ['独立 HTML', 'Standalone HTML'], sub: ['可离线打开', 'Open locally'],
    description: ['产物包含图解与阅读器。页面查看不依赖模型服务；点击外部源码链接时仍需要网络。', 'The artifact includes the diagram and viewer. Reading it needs no model service; external source links still require a network connection.'],
    source: { path: 'archify/renderers/shared/cli.mjs', line: 233, end_line: 280 } },
  { id: 'viewer', type: 'frontend', pos: [40, 430],
    label: ['浏览器阅读器', 'Browser viewer'], sub: ['节点与路径探索', 'Focus & explore'],
    description: ['点击节点可查看其关系和源码。路径探索只沿图中已经声明的有向连接行走，不推断真实系统的运行状态。', 'Focus a node to inspect relationships and sources. Route exploration follows authored directed connections, not live runtime behavior.'],
    source: { path: 'viewer/focus.js', line: 6, end_line: 36 } },
  { id: 'export', type: 'frontend', pos: [340, 430],
    label: ['图像导出', 'Image export'], sub: ['SVG 与 PNG', 'SVG & PNG'],
    description: ['原生导出菜单可生成矢量 SVG 和位图 PNG。首版也提供完整 HTML 与 JSON 下载，便于分享和再次生成。', 'The native export menu supports vector SVG and raster PNG. This demo also offers the complete HTML and JSON for sharing and regeneration.'],
    source: { path: 'viewer/template.source.html', line: 238, end_line: 267 } }
];

const edges = [
  ['input', 'cli', 'JSON', 'JSON'], ['cli', 'validation', '读取', 'Load'],
  ['validation', 'renderer', '通过校验', 'Valid input'], ['renderer', 'writer', 'SVG', 'SVG'],
  ['writer', 'html', '写入', 'Write'], ['html', 'viewer', '打开', 'Open'],
  ['viewer', 'export', '导出', 'Export']
];

export function diagram(language) {
  const i = language === 'en' ? 1 : 0;
  return {
    schema_version: 1, diagram_type: 'architecture',
    meta: {
      title: i ? 'Archify: from JSON to an interactive page' : 'Archify：从数据到交互网页',
      locale: i ? 'en' : 'zh-CN', output: `dist/diagrams/archify-${language}.html`,
      quality_profile: 'showcase', repository: { url: `${repository}.git`, revision }
    },
    components: nodes.map(n => ({ id: n.id, type: n.type, label: n.label[i],
      sublabel: n.sub[i], pos: n.pos, size: [190, 72], sources: [n.source] })),
    connections: edges.map(([from, to, zh, en]) => ({ id: `${from}-${to}`, from, to,
      label: i ? en : zh, variant: 'emphasis' }))
  };
}

export function publicProject() {
  return { revision, repository, version, nodes };
}

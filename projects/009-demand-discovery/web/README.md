# 009 · OpenAI 需求发现第一版：本地运行

原生 HTML / CSS / JavaScript 与 Node.js 本地服务。自动探索使用官方 Codex CLI 的非交互模式调用 OpenAI；没有第三方 npm 运行依赖。

## 启动

环境：Node.js 22 或更新版本，官方 Codex CLI 已安装且已正常登录。

```powershell
cd projects/009-demand-discovery/web
npm run dev
```

打开 [009 自动探索](http://127.0.0.1:4182/1014_codex_project/009-demand-discovery/#explore)。也可以运行 `./start.ps1` 或 `./start.ps1 -Port 4183`。服务仅监听本机。

本机状态可通过 `codex login status` 检查，需要登录时使用官方 `codex login`。不要将登录令牌粘贴到网页或配置文件。

```text
语法检查：npm run check
关键规则测试：npm test
构建：npm run build
已有构建启动：npm run preview
保存最近一次真实结果为展示快照：node scripts/export-discovery.mjs
```

## 怎样使用

1. 在“自动探索”输入宽泛领域，选择市场和实现边界。
2. 点击开始。本地服务自动依次运行三轮：发现人群 → 寻找问题 → 追查证据。
3. 查看人群地图、问题候选、真实公开搜索动作与原始来源。
4. 阅读最终继续、收窄或搁置的理由，核实关键未知。
5. 可停止运行、切换历史、刷新恢复和导出 Markdown 报告。

只有点击开始才调用OpenAI，使用本机账户额度。每次只允许一个活动运行；默认每阶段超时4分钟，每阶段最多24个工具完成事件，提示要求更小的调查范围。失败、停止和重启均保留已取得的过程，不用模拟数据补足。

## 本机执行方式

使用官方 `codex exec --search --json --output-schema ...`，通过 stdin 传入调查任务。执行为只读，禁用 shell、文件修改、子代理、应用/插件、电脑及浏览器控制工具；只用内置联网搜索。网页保留公开动作和结构化决策摘要，不保存或展示模型内部推理。

Codex使用正常已登录认证。本服务不读取、导出或复制 `auth.json`，也不把桌面登录令牌转换成 API Key。没有引入其他模型供应商。当前是本机原型；部署给其他用户之前需要独立服务、模型与来源授权方案。

依据：[官方非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)、[官方 CLI 参考](https://learn.chatgpt.com/docs/developer-commands?surface=cli)。

## 可选配置

复制 `.env.example` 为被忽略的 `.env.local`：

```text
CODEX_BIN=             # 留空从PATH找codex.exe或codex；Windows需实际exe路径
CODEX_MODEL=           # 留空使用Codex自带默认模型
DISCOVERY_PHASE_TIMEOUT_MS=240000
```

不要填写登录令牌。凭据、完整路径和进程诊断不会返回前端。

## 数据与证据

- `.runtime/index.json`、`.runtime/runs/`：本机运行历史，被Git忽略。
- `.runtime/latest.json`：最近完成或部分完成的真实结果；失败不会覆盖。
- `../data/discovery-latest.json`：本轮经过检查后导出的真实展示快照。
- `../data/platforms.json`：27个平台研究入口，不等于已接通的接口列表。
- `../data/cases.json`：旧样本区复用的两条004材料。

来源状态区分：模型报告链接、可关联工具打开的片段、本地逐字核验。工具打开不保证全文可读。未读到正文或未匹配引文时保留未知，不标成已核验。

首轮结果：3类人群、3个候选、10条链接，5次检索调用、6次页面打开、6条链接可关联打开记录，本地逐字核验成功0条。具体记录与局限见 [实验001](../EXPERIMENT-001.md)。

## API 与本地边界

编号子路径下 `/api/discovery/` 提供：

| 请求 | 用途 |
| --- | --- |
| GET status | 执行可用性、活动任务、最近历史 |
| POST refresh | 重新检查本机Codex状态 |
| POST runs | 提交领域，启动真实三轮调查 |
| GET runs/:id | 取得运行状态、过程与阶段结果 |
| POST runs/:id/cancel | 停止本轮，保留材料 |
| GET latest | 最近完成的结果 |

API只接受当前本机Host和同源操作。输入有长度限制；URL拒绝本机地址、凭据和非HTTPS；独立页面读取会检查DNS地址并固定连接目标，不绕过访问限制。未启用对外发布或计划任务。

## 原有研究功能

平台搜索与筛选、来源条件、行为线索、方法切换、旧样本、产品规划与扩展继续保留。模板探索计划保存在浏览器键 `research-009-discovery-plan-v1`，不上传、不跨设备同步；它与服务端真实运行历史分别保存。

## 构建与部署

构建白名单复制页面、资料、真实快照和研究说明到 `dist/`；不会复制运行目录、配置、凭据和服务器代码。静态网页可查看保存结果；新的自动探索需要本地服务。资源采用相对路径，章节使用hash。

2026-10-19 新增 `#understanding` 全景章节和 `understanding.html` 独立缩放阅读器。构建运行 `scripts/build-understanding.mjs` 生成原创 SVG，再复制 SVG、已导出的 PNG 和 `UNDERSTANDING.md`。修改图中文字后应重新渲染 PNG，保证两个下载版本一致。缩放不发起搜索或模型调用。

## 公开研究档案

`node build.mjs` 为仓库 Pages 统一入口：执行语法检查、10 项测试、公开构建和产物校验。`npm run build` 继续生成本地研究台；`node scripts/build.mjs --public` 只生成公开版本。

公开页以 `#synthesis` 为理解摘要入口，说明原库的个人主页与自动快讯能力、我们的沉淀/入口/复习收获，以及需求发现与产品化扩展。`#accumulation` 整理研究记录卡、读者入口和复习节点。全景图与完整记录一并发布。

公开模式的 `dist/mode.js` 设为 `PUBLIC_STATIC=true`：只读取已保存的实验快照，不请求研究 API，不发起轮询或模型执行，禁用新探索与历史切换。读者可以查看角色、问题、公开检索动作和来源，并导出实验报告。平台筛选、方法切换、浏览器研究计划与导出继续可用。

构建只复制白名单中的 23 个文件，不包含服务器、环境配置、`.runtime`、登录状态或凭据。完整站点通过 `web/pages.json` 汇总发布，保留既有项目。首次正式地址须待 Actions 和公网资源验证通过后登记。

当前仅本地运行，`demo_url`为空；未发布线上站点。

[返回项目简介](../README.md)

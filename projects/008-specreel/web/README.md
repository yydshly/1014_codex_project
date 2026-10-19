# 008 · 理解汇总网页、演示结果与运行方式

`index.html` 是 2026-10-19 新增的中文研究网页，汇总能力、原理、效果、可选 Agent / 模型接入、无人值守边界、场景与个人价值，并可查看三条既有视频和分步回放。`demo.html` 保留原生 / 中文比较入口；`native/` 由固定上游引擎直接生成，`zh/` 使用同一记录和独立中文适配生成。各目录中的播放器、MP4、索引及单文件合集均为已保存的实际产物。

网页是静态展示。观看不会调用模型、启动自动化浏览器或在 004 里办理业务。本次整理的上线状态以发布记录和公网验收为准，不能把本地构建当成已经部署。

## 先查看保存成果

无需重新录制，在 `projects/008-specreel/` 下运行：

~~~powershell
npm run serve
~~~

此命令先构建 `web/dist/`，再仅监听 `127.0.0.1:4188`。打开输出的 [本地研究入口](http://127.0.0.1:4188/1014_codex_project/008-specreel/)。可用 `PORT` 修改端口。读取现有静态成果不需要 004 服务、Playwright、模型密钥或付费 API。

`npm run build` 单独构建站点，检查脚本语法、页面锚点与本地资源、既有验证数据、总图排版结果，并生成静态资源哈希清单。产物包含中文总结、原生和中文演示、PNG / SVG 总图、验证数据、研究笔记及固定引擎源码和许可证，不能因此声称重新验证了浏览器业务流程。

## 录制与重新生成所需环境

- Node.js 22；`@playwright/test` 锁定 1.62.1。先运行 `npm ci`。
- Python 3.10；视频依赖 Pillow 11.3.0 与 FFmpeg；原生 HTML 核心处理使用标准库。
- 用 `npx playwright install chromium` 安装独立浏览器；也可通过 `CHROME_PATH` 指定已有 Chrome。它不依赖聊天应用的内置浏览器。
- 中文字幕视频默认使用 Windows 微软雅黑，其他系统可用 `SPECREEL_CJK_FONT` 指向 CJK 字体。
- 先执行 `scripts/download-upstream.ps1` 取得固定快照。可创建 `.venv` 并安装 `requirements.txt`。2026-10-15 实验使用 Python 3.10.11、Pillow 11.3.0、FFmpeg 6.1.3 和已安装 Chromium。

先启动 004 服务，或用 `DEMAND_PAGE_URL` 指向对应页面，在本项目目录执行：

~~~powershell
npm run capture
$env:PYTHONUTF8 = '1'
python upstream/specreel-0d3aa13241b3714f32f93fdc705100150e6c42af/specreel.py captures/baseline -o web/native --config specreel.yml --bundle --strict --mp4
python scripts/build.py
npm run serve
~~~

脚本已准备好且环境、目标站点、权限与数据可用时，上述执行、记录和导出无需人工逐步点击或剪辑。目标确定、首轮准备、登录授权、异常处理与成品验收仍可能需要人。三条既有演示使用独立编写的脚本，不是本次运行模型或 Agent 得到的新成果。

## 更新实验与验证

~~~powershell
node scripts/capture.mjs updated 02-search-plan
New-Item -ItemType Directory -Path artifacts/update-check -Force
Copy-Item web/native/manifest.json artifacts/update-check/manifest.json
python upstream/specreel-0d3aa13241b3714f32f93fdc705100150e6c42af/specreel.py captures/updated -o artifacts/update-check --config specreel.yml --bundle --strict
npm run verify
~~~

`verify` 检查真实记录、步骤与嵌入图片、视频规格、MP4 分段读取和更新标记，并写入 `artifacts/verification.json`；运行时需按脚本要求保持本地服务可访问，改端口时同步设置 `SPECREEL_URL`。它不能证明所有功能、来源内容或商业效果。原实验和限制见 [研究记录](../RESEARCH.md)。

当前更新演示需要重新执行录制和生成。更新签名来自操作字幕哈希，不能覆盖所有视觉变化；页面改动仍可能需要维护脚本。

## Agent、模型与浏览器各自负责什么

主链为：人或 Agent 准备操作流程 → Playwright 启动独立浏览器并记录 `trace.zip` → Specreel 解析并生成演示。核心渲染已有 trace 时不必启动浏览器或调用模型。

固定版本有六个 MCP 工具与 Agent 技能；可选 `nlflow` 能根据自然语言和页面上下文生成脚本，并选择试跑、修复和目标检查。外部 Agent 仍需串联脚本执行工具、Playwright 与渲染导出。MCP 包装自身没有覆盖完整录制闭环，也没有独立的浏览器运行或 MP4 参数。我们核读了这些源码，尚未实测 Agent 全链路、`nlflow`、AI 字幕改写、TTS、浏览器朗读、Cloud 或上游 CI 自动发布。既有中文 MP4 均无音轨。

## 总图与许可

[原创总结 PNG](../assets/specreel-understanding.png) 与 [SVG](../assets/specreel-understanding.svg) 来自 `scripts/build_understanding.py`；用 Pillow 和中文字体确定性排版，同一份内容生成两种格式，没有调用图像模型。重建总图需 Pillow 和脚本指定的 Windows 微软雅黑字体：

~~~powershell
python scripts/build_understanding.py
npm run build
~~~

固定引擎 `vendor/specreel-0d3aa13.py` 未改动，许可证全文为 `vendor/SPECREEL-LICENSE.txt`，按 AGPL-3.0-or-later 提供。中文适配源代码为 `scripts/build.py`；原生生成物与修改范围详见 [项目 README](../README.md)。上游 Cloud 为单独的专有代码，不在本次运行范围内。

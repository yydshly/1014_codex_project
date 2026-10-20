# 第三方依赖说明

## Three.js

- 仓库：<https://github.com/mrdoob/three.js>
- npm 固定版本：`0.186.1`
- 发布 commit：`9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`
- 许可证：MIT；原文保留在 `public/licenses/THREE-LICENSE.txt`，同时随构建发布。
- 使用核心渲染库和 `examples/jsm/controls/OrbitControls.js`，未修改上游文件。

## Vite

- 仓库：<https://github.com/vitejs/vite>
- npm 固定版本：`8.3.4`
- 许可证：MIT；原文保留在 `VITE-LICENSE.md`，包含上游分发的依赖许可说明。
- 仅用于开发服务器和静态构建，不作为远程运行时服务。

## AI SDK 与 Zod

- AI SDK 仓库：<https://github.com/vercel/ai>；固定 `ai 7.0.140`、`@ai-sdk/openai-compatible 3.0.68`，Apache-2.0。
- 分别保留原文于 `AI-SDK-LICENSE.txt` 与 `OPENAI-COMPATIBLE-LICENSE.txt`；用于本地服务端角色 Agent 和 MiniMax 兼容接口，未修改上游文件。
- Zod 仓库：<https://github.com/colinhacks/zod>；固定 `4.6.7`，MIT，原文保留在 `ZOD-LICENSE.txt`；用于工具产物校验。

## QuickJS 与 ZIP 交付

- quickjs-emscripten：<https://github.com/justjake/quickjs-emscripten>，固定 `0.32.0`，MIT。用公开 API 在限时、限内存的 WASM 环境执行核心功能测试，未改上游；原文见 `QUICKJS-EMSCRIPTEN-LICENSE.txt`。包内 QuickJS 引擎许可保留于 `QUICKJS-ENGINE-LICENSE.txt`。
- fflate：<https://github.com/101arrowz/fflate>，固定 `0.8.3`，MIT。生成本地源码交付 ZIP，未改上游；原文见 `FFLATE-LICENSE.txt`。

## 可选项目兼容运行时

- 官方来源：<https://nodejs.org/dist/v20.18.3/>；Node20.18.3 Windows x64 ZIP SHA256固定为 `11d483dfba711bc7c9bcb513e80a2941be0c2e7cbf62753755785b9a6e80a731`。
- 仅按需下载到被忽略的项目缓存，用于旧esm加载器兼容；不修改系统Node、不随源码ZIP分发二进制。Node的MIT及附带第三方许可证保留在官方包内LICENSE，未修改上游程序。

## Vercel Sandbox（可选）

- 仓库：<https://github.com/vercel/sandbox>；npm 固定 `@vercel/sandbox 3.8.0`，Apache-2.0；原文见 `VERCEL-SANDBOX-LICENSE.txt`。
- 用公开 SDK 创建、运行、限制出站网络与关闭隔离VM，未修改上游代码。Docker 适配另调用用户本机 Docker CLI，使用官方 `node:22-bookworm` 镜像；镜像实际摘要由 Docker 拉取记录确定，目前尚无实机记录，不伪造固定摘要。

## Playwright 与浏览器功能验收

- 仓库：<https://github.com/microsoft/playwright>；npm 固定 `playwright 1.64.1` 与 `playwright-core 1.64.1`，Apache-2.0，未修改上游文件。原文及NOTICE保留为 `PLAYWRIGHT-LICENSE.txt`、`PLAYWRIGHT-NOTICE.txt`。
- 用公开API启动独立无登录态的 Chromium 会话，执行页面操作与断言。安装说明：<https://playwright.dev/docs/browsers>。浏览器由官方安装器下载到本机缓存，不随前端或交付源码ZIP打包；其上游第三方许可随官方浏览器分发保存。

## MiniMax 生成语音

- 服务：<https://platform.minimax.cn>；`speech-2.8-turbo`，六种官方系统音色。
- `public/voices/demo/manifest.json` 记录十段演示录音的文本、模型、音色与生成日期；这些录音受 MiniMax 平台条款约束，不能将上游库的 MIT / Apache-2.0 许可直接套用于生成音频。
- 未使用真人声音克隆；背景 lo-fi 与雨声由本项目的 Web Audio 代码合成。

完整安装依赖、来源和完整性摘要由 `package-lock.json` 锁定。项目的房间、角色、程序化图片、界面与合成音乐独立实现。原帖作者未公开给本项目的资产没有包含在源码或产物中。

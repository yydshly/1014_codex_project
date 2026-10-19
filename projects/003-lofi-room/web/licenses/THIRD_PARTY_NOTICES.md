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

## MiniMax 生成语音

- 服务：<https://platform.minimax.cn>；`speech-2.8-turbo`，六种官方系统音色。
- `public/voices/demo/manifest.json` 记录十段演示录音的文本、模型、音色与生成日期；这些录音受 MiniMax 平台条款约束，不能将上游库的 MIT / Apache-2.0 许可直接套用于生成音频。
- 未使用真人声音克隆；背景 lo-fi 与雨声由本项目的 Web Audio 代码合成。

完整安装依赖、来源和完整性摘要由 `package-lock.json` 锁定。项目的房间、角色、程序化图片、界面与合成音乐独立实现。原帖作者未公开给本项目的资产没有包含在源码或产物中。

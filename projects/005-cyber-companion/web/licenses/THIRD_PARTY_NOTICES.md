# 第三方组件与素材

## Open-LLM-VTuber

- 原仓库：https://github.com/Open-LLM-VTuber/Open-LLM-VTuber
- 固定 commit：`992309c0aa19845960228f880013d4685fde93b5`。
- 参考其语音角色分工，使用其中原样保存的官方 Mao PRO 运行素材；未复制、修改或运行上游 Python 后端与前端。
- 上游代码许可证原文：`Open-LLM-VTuber-LICENSE.txt`（MIT）。此许可不覆盖 Live2D 模型和 Cubism Core。

## Live2D Mao PRO 样例

- 原始插画、建模：Live2D Inc.。原说明 `mao-pro-ReadMe.txt`，记录的上游样例修订日期为 2025-03-14。
- 资源在 `public/avatar/`，包括 model3、moc3、纹理、物理、动作和表情文件；没有修改这些文件。
- 适用 Live2D Free Material License Agreement 与 Sample Data Terms of Use；保留的条款为 `Live2D-terms.md`。官方来源：https://www.live2d.com/en/download/sample-data/ 。正式发布或商业使用需按相应主体和用途核对样例条款，不将其标为 MIT 自由素材。

## Live2D Cubism Core

- 取自官方：https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js 。
- 原样保存在 `public/vendor/`，包含版权和 Proprietary Software License Agreement 链接，不属于 MIT；本次取得的精确内容由 `asset-lock.json` 的 SHA-256 锁定。
- 官方条款：https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html 。

## npm 依赖

| 组件 | 锁定版本 | 许可与用途 |
| --- | --- | --- |
| [PixiJS](https://github.com/pixijs/pixijs) | 6.5.10 | MIT，WebGL 渲染 |
| [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) | 0.4.0 | MIT，Cubism 模型显示与动画 |
| [AI SDK](https://github.com/vercel/ai) | 7.0.140 | Apache-2.0，语言模型流式调用 |
| @ai-sdk/openai-compatible | 3.0.68 | Apache-2.0，MiniMax 与本地兼容接口适配 |
| [Vite](https://github.com/vitejs/vite) | 8.3.4 | MIT，开发、构建与本地 API 中间件 |

上游库没有修改。`pixi-live2d-display` 误带运行时依赖的发布工具 `gh-pages` 已通过 overrides 固定到 5.0.0，不在本应用中使用；安装后依赖审计无已知漏洞。完整依赖和完整性值以 `package-lock.json` 为准。

MiniMax 模型与音色是云服务，受供应商服务条款约束；没有下载、改造或再分发其权重、音色。原型使用系统音色 `female-shaonv`，没有克隆原帖人物或用户声音。

页面可选从 Google Fonts 加载 Noto Sans SC（SIL Open Font License），字体不可用时回退到系统中文字体。背景、布局、图标与交互逻辑由本仓库独立实现。

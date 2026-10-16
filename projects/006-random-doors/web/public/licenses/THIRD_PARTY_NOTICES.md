# 随机门来源与许可证

本原型的场景、程序纹理、天空与海面着色、接雨碰撞、船灯调度和声音合成为本项目新增代码。概念启发与独立参考见子项目研究记录，原型未引入 Techartist 的代码或模型；0.6 研究页单独展示原作媒体，登记如下。

`0.3.0` 主入口的六个 SVG 场景、人物、对白、谜题与手记逻辑同样为本项目新增实现，不使用外部图片、字体或模型服务。Three.js 仅供保留的 3D 候车亭使用。

`0.5.0` 的 `art/*.webp` 是本轮使用内置 ImageGen 制作的 AI 生成素材：入口、六处环境、六位虚构人物及透明接雨手臂，共 14 张。文件随项目提供，制作过程与最终提示词在子项目 `assets/ART_PROMPTS.md` 登记。WebP 编码保留接雨手臂的透明度；场景运行不调用模型。此来源说明与以下第三方库的 MIT 许可证分开登记。

`0.6.0` 研究页的 `research/techartist-portal.mp4` 与 `research/techartist-poster.jpg` 来自 Techartist (@techartist_) 发布的 [传送门立方体原帖](https://x.com/techartist_/status/2109737086601556195)。用于研究对照，原文件未修改，版权归原作者；未发现独立媒体再许可声明，不适用下表依赖库的 MIT 许可证。原帖 ID、CDN 地址、发布时间与 SHA-256 见 `research/source.json`。发布时保留署名、原帖、原文件与来源记录；不将原作媒体标作本项目原创。

研究页其余截图副本来自本仓库 002、006、007、008 的本地运行；每张图的原路径、版本与范围在 `research/README.md` 中登记，保留对应项目的上游与依赖声明。

| 依赖 | 原仓库 | 固定版本 | 许可证 | 用途与改动 |
| --- | --- | --- | --- | --- |
| Three.js | https://github.com/mrdoob/three.js | npm `0.186.1`，完整性校验见 `package-lock.json` | MIT，正文见 `THREE-LICENSE.txt` | 实时渲染及官方 RoundedBoxGeometry；未修改库文件 |
| Vite | https://github.com/vitejs/vite | npm `8.3.4`，完整性校验见 `package-lock.json` | MIT 及包内第三方说明，见 `VITE-LICENSE.md` | 本地开发与构建；未修改库文件 |

发布时保留本目录。具体传递依赖的版本由 `package-lock.json` 记录。

`0.7.0` 研究页增加 Four-Seasons 固定版本 README 的作者展示图与我们排版的理解总览图。参考代码版本为 `23e276eda11e421631df3f4b726a066d59845c91`，代码 MIT；作者原图的单独媒体再许可未确认，保留原始来源与 SHA-256。总览图使用已登记的六张画面，没有新增生成素材，记录见 `research/understanding-overview.sources.json`。

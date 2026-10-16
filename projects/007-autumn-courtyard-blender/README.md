# 007 · Atlas：模型驱动的资产工作流与月门水庭实证

Atlas 以技能规范和辅助脚本组织 2D/3D 资产生成、质量验证和引擎接入。它协调模型、生成器、Blender / DCC 与 Three.js 等工具：先明确规格，再选择路径生成，按反馈清理修正，最后导出并检查。底层生成能力来自模型及执行工具；库的价值在于将这些能力组织成可继续编辑、验证和交付的资产流程。

这种结构的意义，是同一资产能够复用机位、定向修改并继续承载交互。可扩展到展陈、教学、产品展示、镜头预演、任务界面与游戏；还需验证可控编辑、资产质量、目标设备性能和实际任务收益。Atlas 相比直接使用模型的增益尚未做对照评测，原帖完整制作链路也未取得。

本次完整执行：先用内置 Image Gen 创作一张新的场景参考图，再观察画面、编写 Blender Python 脚本、实际渲染并定向修改，最后交付可编辑工程和镜头环绕演示。

核心价值是模型通过代码生成与修改三维场景的能力：模型负责理解与编写，Blender 负责执行与渲染。得到可编辑结构后，可以继续换机位、改布局和开发交互。本次没有调用直接输出网格的专用图生 3D 模型。

![左：本次生成的原创概念图；右：按图编写脚本得到的实际 Blender 渲染](original-scene/assets/comparison.jpg)

当前主实验为 [月门水庭](original-scene/README.md)。前一轮参照他人画面的秋日庭院保留为 [历史实验](AUTUMN_EXPERIMENT.md)，目录、工程和图片未覆盖。

## 本次结果

- [能力与价值一图总览](http://127.0.0.1:4175/1014_codex_project/007-autumn-courtyard-blender/overview.html)：七部分涵盖 Atlas 能力、原理、三张实际效果、意义、用途、边界与扩展方向；[高清 PNG](web/assets/atlas-overview.png)、[可编辑 SVG](web/assets/atlas-overview.svg)、[来源说明](web/assets/README.md)。
- [完整研究网页](http://127.0.0.1:4175/1014_codex_project/007-autumn-courtyard-blender/research.html)：14 个章节、18 个问答，整理 Atlas 与模型能力、各生成路线、实验来源、建模和网页实现、价值、非游戏用途、局限、后续验证与源码证据。
- [真实 3D 交互网页](http://127.0.0.1:4175/1014_codex_project/007-autumn-courtyard-blender/#scene)：直接旋转、缩放、平移同一 Blender 场景，支持切换机位、线框与全屏，并保留图像对照、视频、原理和价值说明；[构建与运行说明](web/README.md)。
- [网页三维模型 GLB](original-scene/artifacts/moonwater-web.glb)：约 3.62 MB，保留实际几何与倒角；[导出记录](original-scene/assets/web-export.json)。
- [五秒流程演示](original-scene/assets/demo.mp4)：先显示生成的参考图，再显示真实三维镜头移动，最后显示主视角。
- [自行生成的参考图](original-scene/assets/concept.png)、[实际高清渲染](original-scene/assets/render.png)、[侧上方视角](original-scene/assets/overview.png)。
- [可编辑 Blender 工程](original-scene/artifacts/moonwater.blend)。
- [完整建模脚本](original-scene/scripts/build_moonwater.py)、[生成参考图使用的完整提示词](original-scene/image-prompt.txt)。
- [操作与复现说明](original-scene/README.md)、[过程与差距](original-scene/RESEARCH.md)。

## 研究范围

工作流研究对象仍为 [xikhar/atlas](https://github.com/xikhar/atlas)，固定版本 b283a80dcb6db9068ba368fedfca783f5164ba06，MIT 许可证。Atlas 用作方法研究，没有复制其示例场景、工程或脚本。

本次参考图为全新生成，生成时没有传入前一轮图片。几何由本项目脚本构建；只复用了上一轮自己编写的基础网格辅助函数。建模过程没有调用图生 3D 服务，参考图没有作为背景或贴图参与渲染。

主体布局、圆形石门、水面反射、天球仪和冷暖灯光已经建立。三维结果在自然树形、建筑雕刻、天空层次和细部材质上仍明显简化。它是参考图指导的近似场景，不是自动、准确的单图三维重建。

本地环境：Windows、Blender 4.5.9 LTS、RTX 4070 Laptop GPU、Cycles / OptiX；实验日期 2026-10-15。网页按统一 GitHub Pages 子路径发布，线上验收后登记正式入口与部署记录。

[返回项目总索引](../../README.md)

# Atlas 一图总览素材

- `atlas-overview.svg`：代码排版的可编辑信息图，3,000 × 6,751；正文为文字节点，三张效果图按原始字节嵌入。
- `atlas-overview.png`：SVG 经 Sharp / librsvg 栅格化的高清版本，4,000 × 9,001；未作生成式改绘。
- `atlas-overview-provenance.json`：输入图片与 PNG 的校验值、尺寸、上游版本、正文和渲染器记录。

制作脚本为 `../../scripts/build_overview.py`、`../../scripts/render_overview.cjs`。汇总日期 2026-10-16，独立实验日期 2026-10-15。

2026-10-17 起，本图作为 007 研究网页、项目首页卡片及 README 索引的统一引导图。网页显示同一图的 WebP 预览，保留完整纵向构图；原始 PNG / SVG 未改动。

三张效果图依次来自：

1. `../../original-scene/assets/concept.png`：本次用内置 Image Gen 从文字生成的原创参考图，未输入上游图片；提示词见 `../../original-scene/image-prompt.txt`。
2. `../../original-scene/assets/render.png`：本项目独立编写 Blender Python 脚本后，实际由 Cycles 渲染的主视角。
3. `../screenshots/interactive-hero.jpg`：同一 Blender 场景导出 GLB 后，在真实浏览器 Three.js 查看器中的截图，保留界面，没有图像模型美化。

以上图片只按比例放进图框，原始图像文件没有修改。它们不是上游 Atlas 示例。图示用箭头描述工作流，没有声称此过程已被封装成稳定的一次提交服务。

能力说明依据 [xikhar/atlas 固定版本](https://github.com/xikhar/atlas/tree/b283a80dcb6db9068ba368fedfca783f5164ba06)，MIT；主要核对 README、asset-core、model3d-gen、threejs-pipeline。原始数据来自本项目 `render-stats.json`、`scene-checks.json`、`web-export.json`。没有安装并完整执行 Atlas，其他路线与能力未逐项实测；收益与扩展方向按待验证处理。

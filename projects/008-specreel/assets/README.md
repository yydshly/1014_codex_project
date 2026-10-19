# 008 · 配图与总结图来源

## 2026-10-19 原创理解总图

- [specreel-understanding.png](specreel-understanding.png)：2400 × 6705 的中文总结长图，汇总能力、两条工作链路、浏览器与视频底层原理、无人值守边界、三个实测流程、录屏对比、场景、候选产品及当前取舍。
- [specreel-understanding.svg](specreel-understanding.svg)：同一张图的矢量版本，内容和布局与 PNG 一致。
- 两种格式由本项目原创 `scripts/build_understanding.py` 以同一组图形与文字确定性生成。PNG 用 Pillow 渲染，字体为本机微软雅黑；SVG 保留文字，跨设备显示取决于可用字体。没有调用图像生成模型或使用上游营销配图。
- 图中以颜色区分已有实测、源码支持但未实测、可扩展组合及仍需判断的部分。“无需人参与”明确限定为前提就绪后的执行阶段，不主张任意任务全过程零人工。排版检查记录保存在 `artifacts/understanding-layout.json`。
- 内容依据固定 Specreel 0.2.0 / commit `0d3aa13241b3714f32f93fdc705100150e6c42af` 的源码，以及 2026-10-15 保存的 004 实测记录。来源与 SHA-256 见 `artifacts/sources.json`，未把可选 Agent / 模型源码能力当作已实测成果。

## 2026-10-15 实测配图

- preview.png：2026-10-15 本地浏览器实际截图，展示比较入口与 Specreel 生成的 004 回放。
- native-video-frame.png：从原生 MP4 第 3 秒抽取，保留默认操作字幕。
- native-title.png：原生 MP4 第 0.6 秒，展示 Windows 默认字体缺少中文字形。
- chinese-title.png：中文适配 MP4 第 0.6 秒，使用本机微软雅黑显示中文。

004 页面为本仓库原创，外部引文沿用 004 的来源说明。播放器与原生生成物来自 [Specreel 固定版本](https://github.com/specreel/specreel/tree/0d3aa13241b3714f32f93fdc705100150e6c42af)，CLI 为 AGPL-3.0-or-later。固定引擎与许可证全文随研究站点提供；中文适配、研究页面和总结图的改动与来源见项目 README。截图展示的是当时保存的结果，不代表当前线上版本或新的外部采集。

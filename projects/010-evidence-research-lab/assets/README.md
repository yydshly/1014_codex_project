# 配图与来源

`understanding-map.svg` 与 `understanding-map.png` 是 2026-10-19 新增的原创理解总览图（1600 × 1540）：源产品用途 → 我们的实际试跑 → 模型/资料、身份/证据、流程/收益的追问 → 概念本质 → 数据是产品调研的事实基础 → 需求判断、产品验证与反馈闭环。它是本项目的概念总结，**不是 Atypica 私有架构图、当前页面截图或效果证明**；原实验与新项目实践不因配图而重启。

文字唯一来源为 [data/understanding-map.json](../data/understanding-map.json)，使用 [scripts/build_understanding_map.py](../scripts/build_understanding_map.py) 生成 SVG 与 PNG；两种文件均记录同一个规范化图源 SHA-256。无外部图片或上游图表。使用系统字体 Microsoft YaHei，未分发字体文件；SVG 在阅读端使用系统字体回退，PNG 固定保留排版。

在项目目录运行 `python scripts/build_understanding_map.py` 可重生成；该开发辅助脚本需要 Pillow。可用 `--font` / `--bold-font` 指定本机中文字体。网页正常构建直接读取已保存的 SVG / PNG，不需要 Pillow，不调用图片或语言模型。修改图源后需先重生成，再到 web 目录运行 `npm run build`；构建与测试会核对图源及图件，防止网页与导出使用过期内容。

`archive-cover.svg` 是 2026-10-15 原创早期归档导览配图，当时展示 20 条来源、10 个问题、21 份材料和一次 B/C 合成资料试跑。2026-10-19 网页已增加后续讨论；这张历史示意图不表示最新目录数量。它**不是当前页面截图或效果证明**，不使用外部素材。

`preview.jpg` 是本项目本地工作台 v0.1.0 的实际浏览器截图，2026-10-15 在 `http://127.0.0.1:4184` 生成。画面展示真实模型 gpt-6.1-sol 对**原创合成资料**的 B/C 试跑，实验 R-9397508f-3e8f-4ff6-a62b-0b37088fafbc。不是设计稿，不是实际用户需求验证；报告仍待人工语义复核。

截图由本项目生成，无外部配图、真人访谈、私人订单和个人资料。MVP.md 的 Mermaid 仍为原创规划图，包含当前未实现的可选扩展，不作为运行证据。

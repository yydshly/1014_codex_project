# 仓库工作约定

- 本仓库用于研究多个 GitHub 项目，面向读者的说明默认使用中文。
- 根 README 主要承载摘要、按顺序排列的索引和代表性配图；详细记录放到子项目。
- 新增项目使用 `python scripts/project_catalog.py add`。编号从 `001` 递增，已创建的编号和目录保持稳定。
- `projects.json` 是总索引数据来源。修改后运行 `python scripts/project_catalog.py sync` 与 `python scripts/project_catalog.py check`；不要手动编辑自动生成区。
- 每个项目独立维护代码、依赖和运行说明，按需选择技术栈。
- 引用上游内容时记录原仓库、固定版本、许可证和改动；配图记录来源与说明。
- 尚未完成研究时使用待确认描述。演示地址只有发布并验证后才登记。
- 多个 GitHub Pages Web 采用同一站点下的编号子路径，具体约定见 `docs/DEPLOYMENT.md`。

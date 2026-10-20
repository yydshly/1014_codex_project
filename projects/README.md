# 子项目目录

每个研究项目占用一个固定编号目录，例如 `001-archify/`、`002-rainy-ghost/`。完整清单见根 README 的[一句话速览](../README.md#一句话速览)与[详细索引](../README.md#详细索引)，按编号查找能力、原理、价值与当前进展。

使用根目录的 `scripts/project_catalog.py add` 创建项目，命令会复制统一模板，并更新 [总索引](../README.md)。完整约定见 [研究与目录约定](../docs/CONVENTIONS.md)。

```text
projects/
└── 001-project-name/
    ├── README.md       # 简介、入口、运行方式与截图
    ├── RESEARCH.md     # 研究问题、复现过程与结论
    ├── assets/         # 项目截图和说明
    └── web/            # 可选 Web 源码；技术栈按项目选择
```

其他源码或实验可按实际需要增加 `src/`、`experiments/` 等目录。各子项目自行维护依赖文件与构建命令。

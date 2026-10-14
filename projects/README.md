# 子项目目录

每个真实研究项目占用一个编号目录，例如 `001-project-name/`、`002-another-project/`。本次初始化暂未添加研究对象，第一个项目将从 `001` 开始。

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

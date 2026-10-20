# 网址推荐脚本的原始失败样本

`recommended-flows.mjs` 与 `recommended-flows.py` 是 2026-10-15 Specreel 0.2.0 推荐实验保留的输出，两份内容相同，均为 JavaScript。`.py` 扩展名不表示其可用 Python 执行。

文件内含 `# TODO` 等不合法的 JavaScript 注释，`node --check` 会报语法错误；提交时保留原字节，作为 [研究记录](../RESEARCH.md#网址推荐结果) 中失败结论的依据，不将其作为可运行脚本或通过验收的成果。

最终演示使用项目 `scripts/` 下独立编写的操作脚本；这些原始样本不参与构建。

# 003 GitHub Pages 发布验收（2026-10-20）

代码与首轮发布提交：`17d5a52ae9f69dc6031851150415e85b01792be7`。[首轮 Actions](https://github.com/yydshly/1014_codex_project/actions/runs/39391918519) 已构建并发布成功。

正式入口：

- [理解摘要与扩展方向](https://yydshly.github.io/1014_codex_project/003-lofi-room/research.html#synthesis)
- [完整理解图](https://yydshly.github.io/1014_codex_project/003-lofi-room/research.html#overview)
- [Agent 工作室预设演示](https://yydshly.github.io/1014_codex_project/003-lofi-room/?view=workspace)
- [原房间观察与漫游](https://yydshly.github.io/1014_codex_project/003-lofi-room/?view=room)

发布理解摘要、房间、预设流程和已有 MiniMax 录音。真实任务、动态语音和执行接管继续在本地服务运行；没有上传或修改 GitHub Secrets，也没有将密钥编进网页。

`http-verification.json` 核对首轮公开产物的63份资源、原始字节摘要、九个章节、全部15项研究及12个发布项目入口，合计84个HTTP请求。API、环境文件和服务端源码URL返回404；全站所有既有应用入口保留。引导PNG的SHA256与本地原图一致，未重新生成。验证脚本为 `../../web/scripts/verify-pages.mjs`。

浏览器直接打开公开理解摘要，确认主图加载、章节跳转、总图展开后原宽2560。公网工作室启动后显示“Pages预设演示中 · 无真实任务”，后台任务编号为空；已有MP3经公网播放，浏览器错误日志为空。实际音频进度与状态保存在 `published-browser-observation.json`。

本地使用相同静态产物，在没有API服务的Python静态服务器上完成预设全流程：68个事件、9份产物、一次预设返工，结束后 `running=false`，后台任务编号始终为空。最终状态见 `local-preset-final-state.json`；这不是新的真实编码任务，不替代此前的真实仓库验证。

- `01-local-research.jpg`：静态预览的理解摘要与既有引导图。
- `02-local-preset.jpg`：纯静态服务器上的人物交接与已有语音。
- `03-published-summary.jpg`：实际公网理解摘要。
- `04-published-workspace.jpg`：实际公网工作室的预设标识与人物工作。

四张JPEG均为本机浏览器直接截图，没有图像生成、裁切或合成。界面内容属于本项目原创场景。图中涉及未发布/未提交的文字保留为制图时快照，正式发布状态见项目 `deployment.json`。验证没有覆盖手机实机或所有三维视觉路径。

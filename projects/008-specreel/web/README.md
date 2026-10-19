# 008 · 演示结果与运行方式

index.html 是原创比较入口；native/ 由上游 CLI 直接生成，zh/ 由同一引擎配合独立中文适配生成。两套目录保留播放器、MP4、索引与单文件合集，未公开部署。

## 环境

- Node.js 22；锁定 @playwright/test 1.62.1。
- Python 3.10；MP4 使用 Pillow 11.3.0 与 FFmpeg；原生 HTML 只用标准库。
- Playwright Chromium，运行 npx playwright install chromium 安装。也可用 CHROME_PATH 指定已有 Chrome。
- 中文视频默认使用 Windows 微软雅黑，其他系统可用 SPECREEL_CJK_FONT 指向 CJK 字体。

在 projects/008-specreel/ 下先执行 scripts/download-upstream.ps1、npm ci。可创建 .venv，再用该虚拟环境安装 requirements.txt。本轮使用本机 Python 3.10.11、Pillow 11.3.0、FFmpeg 6.1.3 与已安装 Chromium。

## 录制与生成

先启动 004 服务，或用 DEMAND_PAGE_URL 指向它的地址。在本项目目录执行：

~~~powershell
npm run capture
$env:PYTHONUTF8 = '1'
python upstream/specreel-0d3aa13241b3714f32f93fdc705100150e6c42af/specreel.py captures/baseline -o web/native --config specreel.yml --bundle --strict --mp4
python scripts/build.py
npm run serve
~~~

打开 [本地入口](http://127.0.0.1:4188/1014_codex_project/008-specreel/)。默认仅监听 127.0.0.1:4188，可以用 PORT 修改端口；验证时同时设置 SPECREEL_URL。

## 更新实验

~~~powershell
node scripts/capture.mjs updated 02-search-plan
New-Item -ItemType Directory -Path artifacts/update-check -Force
Copy-Item web/native/manifest.json artifacts/update-check/manifest.json
python upstream/specreel-0d3aa13241b3714f32f93fdc705100150e6c42af/specreel.py captures/updated -o artifacts/update-check --config specreel.yml --bundle --strict
npm run verify
~~~

verify 检查真实记录、步骤与嵌入图片、视频规格、MP4 分段读取和更新标记，并写入 artifacts/verification.json。浏览器回放另行检查，见研究文档。

当前播放器展示保存画面，004 独立搜索服务尚未接通。本轮没有验证 AI 改写字幕、语音合成、浏览器朗读、Cloud 或公开部署。演示更新需要重新执行录制与生成。

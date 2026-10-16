# 月门水庭研究网页

把本项目的原创参考图、实际 Blender 场景、实现原理和应用价值整理为静态网页，并直接展示可旋转缩放的三维模型。结论是模型通过代码生成与修改三维场景；Blender 负责执行与渲染。本次没有使用直接输出网格的专用图生 3D 模型。

## 内容与交互

- 2026-10-17：研究页引导图、项目首页卡片、README 总索引与项目说明统一使用我们专门制作的 Atlas 总览图。网页采用轻量预览，按完整长图比例展示，点击进入总览页放大阅读；高清 PNG 与 SVG 保留。
- `overview.html`：一张中文总览图，七部分汇总能力、原理、实证、价值、用途、边界与扩展方向；提供 4,000 × 9,001 高清 PNG 和文字可编辑的 SVG，点击原图可放大。
- `research.html`：2026-10-16 新增完整研究，14 章与 18 个问答，支持章节目录、当前章节定位、问答批量展开和打印。涵盖原帖证据范围、Atlas 定位、模型与 Blender 分工、生成路线、两轮实验、建模细节、证据、网页管线、价值、非游戏用途、局限和后续验证。
- 主页面提供完整研究入口；研究页可以直接返回真实 3D 查看与图像对照。研究页没有载入三维模型，阅读与查看场景分别按需打开。
- 四步制作过程，可切换参考图、结构拆解、侧视与最终效果。
- 同一份 Blender 场景的真实三维查看器：拖动旋转、滚轮 / 按钮缩放、右键平移，支持机位切换、自动环绕、线框、全屏与键盘操作。手机使用单指旋转、双指缩放与平移。
- 参考图 / 实际渲染拖动对照，支持键盘和单图查看。
- 五秒视频、跳转真实镜头环绕、侧上方图放大。
- 分工、可修改三维结构的价值、适用方向和当前差距。
- 工程、脚本、提示词、高清图和原始检查记录下载。

页面展示已完成的实验结果，已提供实时三维查看，不含现场生成或行走碰撞接口。视频仅移动相机；水与花没有物理模拟。查看器中的水面使用实时平面反射与静态波纹扰动。

## 一图总览与复现

[一图总览网页](http://127.0.0.1:4175/1014_codex_project/007-autumn-courtyard-blender/overview.html)把研究压缩为一张长图，嵌入原创概念图、实际 Cycles 渲染和浏览器真实 3D 截图。排版由代码构建；没有用图像模型重绘证据图片。可编辑 SVG 为 3,000 × 6,751，高清 PNG 为 4,000 × 9,001（约 6.43 MB）。

原图、数据和上游固定版本来源见 [素材说明](assets/README.md) 与 [来源记录](assets/atlas-overview-provenance.json)。图中明确区分 Atlas 的公开能力、本次独立实验已验证的内容，以及待验证的流程与产品收益。没有执行完整 Atlas 技能包，不能把这张图当作 Atlas 增益评测。

网页显示构建时从同一张总览图转换的 2,000 × 4,501 WebP 预览，约 0.75 MB，比原 PNG 减少约 88% 的下载体积。正文与构图相同，PNG / SVG 高清下载仍保留原文件。HTTP 资源检查并行读取独立地址，避免逐个建立连接拖慢上线验收。

重新生成总览图，需要 Pillow 11.3.0、Windows Microsoft YaHei 字体和 Node.js / Sharp 0.35.5（librsvg 2.63.2）。在仓库根目录执行：

```powershell
python projects/007-autumn-courtyard-blender/scripts/build_overview.py
node projects/007-autumn-courtyard-blender/scripts/render_overview.cjs
python projects/007-autumn-courtyard-blender/scripts/build_web.py
```

Sharp 如在外部依赖目录，第二条命令最后可传入其绝对模块路径。SVG 文字保留为文字节点，修改内容后重新生成；换机器导出时需保持字体一致。来源记录保存三张输入图和最终 PNG 的 SHA-256、实际尺寸与渲染器版本。

## 网页三维资产

`original-scene/scripts/export_web.py` 直接打开已保存的 `moonwater.blend`，读取应用倒角后的几何，按集合与材质合并 1,038 个实体网格为 31 个节点，使用 Draco 压缩导出约 3.62 MB 的 `moonwater-web.glb`。保留 499,936 个三角形，没有做几何减面；量化压缩使用 16 位位置和 10 位法线。唯一省略的网格是远景体积雾的容器，网页改用距离雾。

导出不改写源工程，源文件和输出的 SHA-256、物体数量等见 [导出记录](../original-scene/assets/web-export.json)。GLB 没有引用图像，也没有将参考图放到模型上。Cycles 的程序材质转换为近似 PBR 色值，网页另建光照、环境与水面反射，因此实时显示与离线渲染存在差异。

如需重新导出，在仓库根目录运行（替换为本机 Blender 路径）：

```powershell
& 'D:\codex\tools\blender-4.5.9-windows-x64\blender.exe' --background --python projects/007-autumn-courtyard-blender/original-scene/scripts/export_web.py
```

前端使用本项目内保存的 Three.js 0.186.1（MIT）与随包提供的 Draco 解码器（Apache-2.0），不依赖 CDN 或项目 003 的运行环境。固定版本、未修改文件的哈希和许可证见 [依赖清单](vendor/manifest.json)、[Three.js 许可证](vendor/LICENSE)、[Draco 许可证](vendor/DRACO-LICENSE)。

## 实际验证

2026-10-16 一图总览：浏览器实际显示新页面、高清原图入口及 PNG / SVG 下载链接，实拍见 [总览网页](screenshots/overview-page.jpg)。构建检查通过 42 个本地资源与三页 HTML 锚点；高清 PNG 尺寸与 SHA-256 一致，SVG 内三张图片的字节分别与原始文件一致。目录同步与 14 个项目索引检查通过。

2026-10-16 完整研究页验证：14 个章节与 18 个问答均可访问，桌面目录定位、问答批量展开 / 收起、390 × 844 手机目录自动收起与章节跳转均正常；手机表格可横向阅读，页面没有横向溢出。研究页与主页面互相跳转成功，原三维场景仍载入同一份 GLB。研究页未出现浏览器错误。构建检查覆盖 37 个本地资源、两页 HTML 的锚点、下载与模型哈希。实拍见 [研究首屏](screenshots/research-desktop.jpg)、[研究正文](screenshots/research-reading.jpg) 和 [手机研究页](screenshots/research-mobile.jpg)。

真实三维查看器已验证鼠标拖动旋转、滚轮缩放、缩放按钮、方向键平移、四个机位、自动环绕开关、线框开关和全屏进出；390 × 844 手机视口没有横向溢出。手机验证涵盖布局，未使用真实手机硬件测试触摸。实拍见 [交互全景](screenshots/interactive-overview.jpg)、[原图机位](screenshots/interactive-hero.jpg)、[手机三维布局](screenshots/interactive-mobile.jpg)。

在仓库根目录运行资产与 HTTP 检查：

```powershell
python projects/007-autumn-courtyard-blender/scripts/check_web.py --url http://127.0.0.1:4175/1014_codex_project/007-autumn-courtyard-blender/
```

检查通过：31 个节点、499,936 个三角形、1,038 个实体网格来源、0 张图片、14 个依赖文件哈希、源工程未改写，实际下载 GLB 与导出哈希一致。

以下为上一版图文页面的验证记录：

2026-10-15 在本地总入口使用浏览器验证桌面与 390 × 844 手机视口：制作步骤切换、对照模式与键盘滑杆、从第 2 秒开始播放、侧视图放大 / Esc 关闭、实际运行数据读取均通过，手机页面没有横向溢出，未发现浏览器警告或错误。18 个本地资源地址全部返回成功，下载的 Blender 工程与源文件 SHA-256 一致。

网页实拍截图见 [桌面首屏](screenshots/desktop.jpg)、[图像对照](screenshots/comparison.jpg)、[手机布局](screenshots/mobile-effects.jpg)。这些是浏览器实际截图，未使用图像模型制作或美化。

## 构建与本地查看

Python 3.10+，依赖 Pillow 11.3.0：

```powershell
python -m pip install Pillow==11.3.0
python projects/007-autumn-courtyard-blender/scripts/build_web.py
```

构建会将三维模型、浏览器依赖、媒体与下载文件复制到本目录的 `dist/`；图片压缩为 WebP，原始 PNG 与 Blender 工程保持不变。前端无需额外安装或打包，所有资源采用相对路径。

仓库已有本地总入口服务运行时，直接访问：

[007 月门水庭研究网页](http://127.0.0.1:4175/1014_codex_project/007-autumn-courtyard-blender/)

单独查看也可在仓库根目录运行：

```powershell
python -m http.server 4177 --bind 127.0.0.1 --directory projects/007-autumn-courtyard-blender/web/dist
```

然后打开 `http://127.0.0.1:4177/`。页面会在简单静态服务器上将约 1.12 MB 视频载为 Blob，支持跳播；正常提供类型与分段响应的媒体服务器使用原始地址。

## 发布与来源

本项目已接入仓库统一 Pages 构建：`node web/build.mjs` 执行 Python 媒体打包与资产检查，再由根构建器将完整 `dist/` 放入站点的 `007-autumn-courtyard-blender/`。CI 按 `requirements-web.txt` 安装 Pillow 11.3.0。部署复用已保存的原创图片、工程和 GLB，不需要 Blender、GPU、Windows 字体、Sharp 或在线模型服务。总览图只有重新制作时才需本地排版与栅格化工具。

研究、总览、3D 演示三个入口随完整站点一起发布，保留 006 与 014。正式地址仅在线上验收后登记到 `projects.json`，具体结果记录在项目根 `deployment.json`。

2026-10-16 已发布：[完整研究](https://yydshly.github.io/1014_codex_project/007-autumn-courtyard-blender/research.html)、[一图总览](https://yydshly.github.io/1014_codex_project/007-autumn-courtyard-blender/overview.html)、[真实 3D](https://yydshly.github.io/1014_codex_project/007-autumn-courtyard-blender/#scene)。浏览器实拍见 [公网研究摘要](screenshots/published-research.jpg) 与 [公网三维](screenshots/published-scene.jpg)。网页首段与总索引均先说明源库能力、原理、价值和扩展，再解释独立实验的证据范围。

再次进行公网核验时，在根目录执行 `python projects/007-autumn-courtyard-blender/scripts/check_deployment.py --commit <已部署提交> --run-url <成功工作流地址>`。脚本检查资源与摘要、下载文件哈希、依赖地址、视频分段响应及既有页面，全部成功后才写入部署记录。

图片、视频和下载文件来自本项目的 `original-scene/`，来源与生成记录见 [素材说明](../original-scene/assets/README.md) 和 [实验记录](../original-scene/RESEARCH.md)。研究线索为 MIT 许可的 [xikhar/atlas 固定版本](https://github.com/xikhar/atlas/tree/b283a80dcb6db9068ba368fedfca783f5164ba06)，当前网页和三维场景为独立制作。

[返回项目说明](../README.md)

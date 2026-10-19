# 第三方来源与许可证

## Three.js

- 原仓库：<https://github.com/mrdoob/three.js>
- 固定 npm 版本：`0.186.1`，发布 commit `9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`。
- 许可证：MIT。原文在 `../public/licenses/THREE-LICENSE.txt`，构建时一同复制到站点 `licenses/THREE-LICENSE.txt`。
- 使用核心场景、相机、灯光、几何和材质，以及 `OrbitControls`、`Reflector`、`EffectComposer`、`RenderPass`、`UnrealBloomPass`、`OutputPass`。
- 未修改上游文件。通过 `Reflector` 的公开 `shader` 选项接入本项目独立编写的水面着色器；新增场景、模型生成、交互和页面代码。

## Vite

- 原仓库：<https://github.com/vitejs/vite>
- 固定 npm 版本：`8.3.4`，用于本地开发、构建与产物预览。
- 许可证：MIT；随包附带的其他依赖声明一并保留在 `VITE-LICENSE.md`。
- 未修改上游文件。新增本项目的基础路径和端口配置。

`package-lock.json` 记录准确版本、下载来源及完整性摘要。

## 视觉参考

- 作者：Chetan Ankola。
- 固定来源：<https://x.com/chetanankola/status/2110225806849122363>，2026-10-14 发布。
- 借鉴雨夜、白布幽灵、暖色提灯、水面倒影及轻交互的主题。
- 作者场景源码、模型、媒体资源及其许可证待确认。未复制或再分发这些内容，未声称本项目是原代码的移植或精确复原。
- 本项目所有几何、光晕纹理、声音和图标均以代码生成；截图来自本项目实际运行。

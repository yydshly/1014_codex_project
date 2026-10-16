# 浏览器依赖来源

- Three.js 固定 npm 版本 `0.186.1`，来源为已有官方 npm 包的未修改文件，MIT，见 `LICENSE`。
- Draco 解码器为该 Three.js 包中 `examples/jsm/libs/draco/gltf/` 的原样副本，Apache-2.0，见 `DRACO-LICENSE` 和上游随包的 README。
- 本地独立保存运行所需文件，不从 CDN 请求脚本或模型；浏览器可直接加载。
- `manifest.json` 记录包版本、来源与各文件 SHA-256；`README.md` 和清单为本实验新增说明，其余依赖文件未修改。

参考：[Three.js 仓库](https://github.com/mrdoob/three.js)、[固定 npm 版本](https://www.npmjs.com/package/three/v/0.186.1)、[Draco 仓库](https://github.com/google/draco)。

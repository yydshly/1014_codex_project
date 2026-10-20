# 配图来源与用途

本项目区分上游作者提供的示例图片、原作视频，和本轮中文研究网页的本地运行截图。上游示例不能作为本项目成功调用模型或复现成片的证据。

## 上游示例图

原仓库：[10291124jcjc-dotcom/ancient-rap-battle](https://github.com/10291124jcjc-dotcom/ancient-rap-battle)；固定版本：`e5e40fa3612777133a141c8448122dd0fd45e4cc`；引用日期：2026-10-15。

| 本地文件 | 固定版本原图 | 页面用途 | 本地改动 |
| --- | --- | --- | --- |
| `web/public/media/cover-16x9.jpg` | [assets/cover-16x9.jpg](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/assets/cover-16x9.jpg) | 展示“周瑜 vs 诸葛亮”成片目标效果和封面包装 | 保留原文件；网页按容器显示 |
| `web/public/media/frame-1.jpg` | [assets/frame-1.jpg](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/assets/frame-1.jpg) | 辅助解释人物、景别和舞台视觉约束 | 保留原文件；网页按容器显示 |
| `web/public/media/frame-2.jpg` | [assets/frame-2.jpg](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/assets/frame-2.jpg) | 辅助解释对唱、动作与人物一致性 | 保留原文件；网页按容器显示 |

许可证依据：上游根目录 [LICENSE](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/LICENSE) 的 MIT 声明；本地保留 [UPSTREAM-MIT.txt](../licenses/UPSTREAM-MIT.txt)。本轮未独立核查示例生成素材的完整权利链，不把它们声明为本项目原创。

## 页面内播放的原作视频

按用户要求，从同一固定提交的 [assets/demo-github.mp4](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/assets/demo-github.mp4) 下载原始 MP4，保留在 `web/public/media/demo-github.mp4`。网页用 HTML `<video>` 直接播放本地静态文件；构建时原样复制到 `web/dist/media/demo-github.mp4`。没有转码、剪辑或重新生成，作品归属仍为上游作者。

下载来源为固定版本 [raw 地址](https://raw.githubusercontent.com/10291124jcjc-dotcom/ancient-rap-battle/e5e40fa3612777133a141c8448122dd0fd45e4cc/assets/demo-github.mp4)。许可证依据仍是上游 MIT 声明，原文随项目保留。

| 检查项 | 本轮实测结果 |
| --- | --- |
| 文件大小 | 9,381,327 字节，与固定版本 Git 树一致 |
| MP4 文件头 | 第 4–11 字节为 `ftypisom`，不是网页错误内容 |
| SHA-256 | `3318276b94c109381747c4b3838676d9a32b87189e3e626179aa05381b483fc9` |
| Git blob SHA-1 | `1aeba12484324913d8ee8f70f119aa8608ed5ffc`，与固定版本 GitHub API ETag 一致 |
| 总时长 | 102.127688 秒，由 FFprobe 读取 |
| 视频 | H.264，960 × 540，24 fps，`yuv420p` |
| 音频 | AAC，48 kHz，双声道 |
| 下载与检查日期 | 2026-10-15 |

这份网页分享版的实际尺寸是 **540p**。它与制作脚本默认“768P 生成、后期 1080p 包装”的设置是不同层面的事实，不能把播放器中的原作分享版标为原生 1080p。

原始连接中途断开后，使用同一固定提交的 GitHub Contents API 原始媒体响应进行 Range 续传，最终按长度和 Git blob 散列核对完整性；没有用部分文件冒充成片。机器可读参数保存在 [source-register.json](../data/source-register.json) 的 `versioned_example_video` 中。

上游 README 另有 [GitHub 视频附件](https://github.com/user-attachments/assets/9c620e92-4e5d-4da9-93ff-3ef39cfedbe6)，作为历史引用保留；本轮未下载该附件，也未比较其内容与版本化 MP4 是否完全相同。

## 本地网页截图

`assets/preview.jpg` 为初版研究网页的实际运行截图，曾用于根目录项目索引。截图中的播放器或封面区域包含以上已注明来源的上游原作素材；其余页面布局、中文整理和交互界面为本项目新增。截图只验证网页呈现，不证明付费生成流程已运行。当前索引使用下文《敬风霜》成片截图。

另保存 `assets/workflow.jpg`（制作原理区）与 `assets/mobile.jpg`（手机页面内播放）；均为 2026-10-15 本轮浏览器实测截图。验证结果见 [VERIFICATION.md](../VERIFICATION.md)。

若后续替换截图，应同步记录日期、页面版本和显示范围，并保留可辨认的上游媒体来源说明。

## 网页内播放与机制交互截图

同日更新：`video-playing.jpg` 展示原生视频控件与实际原作画面，`mechanism.jpg` 展示六个源码机制节点，`sync-demo.jpg` 展示 200 毫秒补偿示意。`mobile.jpg` 更新为手机页面内播放状态。以上均为本轮真实浏览器截图；示意图不是对原作嘴型的实际测量，视频来自上游并非本项目生成。

## 历史三句生成实测与网页截图

2026-10-15 的三句阶段曾交付 **19.2 秒原创交锋实测**：李白两句、杜甫一句，真实生成素材为网页标注的 MiniMax H3 两条与 Seedance 2.0 Fast 一条。当时B02仍在排队，没有包含在三句文件中；后来已补齐24秒四句基线，分别在网页历史区留档。没有重抽，首次四任务标价共285钻，上限300；未独立核对账单。

| 本地文件 | 来源与用途 | 处理说明 |
| --- | --- | --- |
| `assets/own-sample.jpg` | 三句阶段的本地桌面截图，保留历史 | 显示当时三句真实生成版与第四句待回传状态 |
| `assets/own-sample-mobile.jpg` | 本地网页手机播放实测截图 | 显示真实生成视频、原生播放控件与制作边界 |
| `web/public/history/001-poets.png` | 内置 ImageGen 原创共同舞台图 | 原字节复制自 `refs/poets-stage-v1.png`，当时作为海报与片头片尾 |
| `web/public/history/001-three-line-demo.mp4` | `final/libai-dufu-three-line-demo-v1.mp4` | 原字节复制；19.2秒、1280×720、25fps/480帧，H.264/AAC |
| `web/public/history/001-run.json` | 当时的脱敏任务、原片筛查与包装记录 | 历史`partial-generated`记录保持原字节；其内部旧主路径代表当时状态 |
| `web/public/history/001-full-four-line-demo.mp4` | 后来补齐的`final/libai-dufu-sample-v1.mp4` | 24秒、1280×720、24fps/576帧；完整基线，非用户歌曲版 |
| `web/public/history/001-full-run.json` | 四句完整基线核验报告 | 与三句记录分别保留 |

上述实验路径均位于 `experiments/001-libai-dufu/`。三张参考图由内置 ImageGen 新生成，未引用上游人物图；过程见 [GENERATION-SOURCES.md](../experiments/001-libai-dufu/refs/GENERATION-SOURCES.md)。人声来自四次 MiniMax `speech-2.8-turbo` 请求，节拍为本地原创100 BPM合成，未使用 Suno 或 Midjourney。片头与片尾各2.4秒使用静态舞台图，中间三句采用真实生成画面。统一使用原始配音和节拍；A02画面按声学活动分组重定时，A01/B01不做时间偏移。

A01原片音轨筛查通过，A02与B01原筛查未通过，失败值完整保留。抽帧显示嘴部开合，但相关性、tiny转写和抽帧均不证明逐音素准确。详见 [实验结果](../experiments/001-libai-dufu/RESULT.md) 与 [三句媒体记录](../experiments/001-libai-dufu/docs/THREE-LINE-DEMO.md)。

| 自制媒体校验项 | 结果 |
| --- | --- |
| 三句MP4 SHA-256 | `ea4ed6b799176315c69a5505756117a61dca7d215fb91670d26bff900709d1a4` |
| 海报PNG SHA-256 | `0c1e7a6b62264024d5d63a0e0d73ddae8fd5b3ff5929c4aa1b53a76f52ed12a7` |
| 媒体复核 | 全段解码、480帧、无黑帧事件、峰值−4.4dB且无削波 |

早期24秒静态节奏预演仍独立保存在 `final/libai-dufu-rhythm-preview-v1.mp4`，SHA-256为 `e9d631ba550ea0bf45677b0e461c95a6754e281edf39c187e2d724df34c7da67`，不再作为当前网页主视频。另有14.4秒两句独立素材预览，不冒充完整交锋。最早直接API的HTTP402/2068拒绝记录独立保留；网页生成采用用户已有ChatArt积分。

## 第二版《敬风霜》完整歌曲原剪辑

实验002于2026-10-15完成63.28秒《敬风霜 · 李白×杜甫》，现保留为历史原剪辑。音乐为用户提供的《敬风霜.mp3》，用户说明由Gemini生成，具体模型未独立核验。四句歌词由用户确认。五张新图来自内置ImageGen，两条新表演视频来自ChatArt网页标注的MiniMax H3；人物为AI娱乐演绎，不代表历史相貌。

| 本地文件 | 来源与用途 | 处理说明 |
| --- | --- | --- |
| `assets/own-sample-v2.png` | 第二版桌面实测截图；曾作011总索引配图 | 展示当时人物、歌曲成片与歌词入口；浏览器截图原样转存PNG，未修改画面 |
| `assets/own-sample-v2-mobile.png` | 第二版390×844手机实测截图 | 展示手机播放器与布局；浏览器截图原样转存PNG，未修改画面 |
| `web/public/media/own-libai-dufu-v1.mp4` | `experiments/002-moon-and-earth/final/moon-and-earth-v2.mp4` | 稳定网页路径，当前指向002成片；63.28秒／1280×720／25fps，18,110,087字节 |
| `web/public/media/own-poets-v1.png` | 002的`refs/moon-and-earth-stage.png` | 新舞台原字节海报；SHA-256 `807a064b780e0c12007e1e3469daad2e33eb004b2bafad247799bb4529f14d05` |
| `web/public/data/own-sample-run.json` | 002本地发布器生成的脱敏报告 | `completed`，2条新原片、4句歌词、5次演唱；含原片QA、复用与费用说明 |
| `experiments/002-moon-and-earth/refs/` | 新李白、杜甫、舞台、月夜城市、风霜书案，共5图 | 完整提示词与SHA见[图像来源](../experiments/002-moon-and-earth/refs/GENERATION-SOURCES.md) |
| `experiments/002-moon-and-earth/music/source-jing-feng-shuang.mp3` | 用户本地上传歌曲，保留原始字节 | SHA-256 `91f5993a91f49e455fe9c60f60cc799692a96a40afa78c6b80e0f35831dbe8c8` |

成片SHA-256为`88c112607640aeaa960a4682aca4a533781d58b82e658af4ad2777fa1848871e`。全曲不裁切、不变速，仅降低1.5dB，末尾补约0.0114秒静音。最终AAC与原曲核验为零偏移、全源覆盖、相关性0.998635，无削波；细节见[最终音轨比较](../experiments/002-moon-and-earth/work/final-audio-verification.json)。

表演画面24.6秒来自两条10.125秒原片，末句重唱复用同句区间；9段器乐场景共38.68秒为原创图像加程序运镜，画面保留相应标记。没有使用旧001人物视频，也没有把图像运镜描述成持续开口演唱。两原片音轨筛查与人工抽帧已完成，接受为演示小样，不宣称逐音素口型准确。

本轮网页标价300钻，结束后余额5115，较提交前5415少300；独立账单未核对。网页和总索引仅本地更新，未部署公网。完整核验见[VERIFICATION.md](../VERIFICATION.md)。

## 当前《敬风霜》月夜舞台版

实验003于2026-10-15完成舞台重剪：4张内置ImageGen新场景图组成圆形舞台、双人全身对峙、观众反打与鼓阵特写。两位主唱视频沿用002，歌词与原歌不变；舞台图像运镜、动态灯雾粒子和合成现场声为本轮新增，不计为新增的人物视频任务。

| 文件 | 来源及用途 |
| --- | --- |
| `assets/own-sample-v3.png` | 当前舞台版桌面实际网页截图，011总索引配图；浏览器原截图转存PNG，未修改画面 |
| `assets/own-sample-v3-mobile.png` | 390×844手机舞台版网页截图；同样原样转存PNG |
| `web/public/media/own-libai-dufu-v1.mp4` | 现为003的`final/jing-feng-shuang-stage-v3.mp4`原字节，63.28秒／720p／25fps／1582帧；25,573,442字节，SHA-256 `011c49f6527f84ca834ac319ad14bb97dd4a410b75a37729b00bf025382970d6` |
| `web/public/media/own-poets-v1.png` | 003的`refs/stage-wide-v3.png`，SHA-256 `93f81dc4d6b4eb21c8c119e0825be461ce027325665da2122bc1ed5106e5cd49` |
| `web/public/data/own-sample-run.json` | 003完成记录，分别登记既有表演、新场景、灯光、原歌和合成现场效果；本轮新增视频请求0 |
| `experiments/003-stage-edition/refs/` | 4张舞台新图；完整提示词、参考与SHA见[generation-sources.json](../experiments/003-stage-edition/refs/generation-sources.json) |
| `experiments/003-stage-edition/music/stage-ambience-candidate-v1.wav` | 本地程序合成稀疏掌声与空间衰减，不是实录；主唱时段静音，声效SHA-256 `ed21ce561ee376f8912e96328d208f084dd22530dff424c8e46305049d5d0d09` |
| `web/public/history/002-jing-feng-shuang-v2.mp4`、`002-poets-v2.png`、`002-run.json` | 002原成片、海报和报告原字节归档，上节旧主路径代表当时状态；001两条历史亦保留 |

17段场景运镜38.68秒与5次原片演唱24.6秒分别登记。新增声效以0dB加入预先降响候选，原曲仍连续−1.5dB，不裁切、不变速。最终AAC对预期混音核验零偏移、全源覆盖、相关性0.998536，峰值−0.914925dBFS，无削波；不把最终混音核验当原片口型QA。详见[实验003](../experiments/003-stage-edition/README.md)和[验证记录](../VERIFICATION.md)。

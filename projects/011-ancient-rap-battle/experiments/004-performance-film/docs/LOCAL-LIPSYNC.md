# 本地外部原曲口型路线

**2026-10-16 已按用户后续明确要求删除本地路线。** 用户后续原话为“暂时不需要下载它，删除掉吧，不走这个路线”。已删除停止记录中确认属于本次任务的 55 个专用模型、隔离环境及安装临时目录；删除失败 0，逐项复查均不存在。原曲、参考图、ChatArt 原片和预览、既有 ASR 缓存及其他代理的 `work/lip-review-tools` 未纳入删除范围。保留本说明、小型来源与停止记录。逐目录删除清单及空间快照见 `work/musetalk-cleanup-report.json`；文件长度合计与磁盘空闲变化分列，不能把逻辑文件长度当作精确释放的物理空间。

此前根代理曾在用户质疑“什么意思，你又下载本地模型了？在做什么？”后主动停止额外的本地路线；当时用户没有明确取消完整视频任务或要求删除，因此先保留文件。该停止决定的来源仍记录为 `stopped_by_root_after_user_question`，后续删除另记为 `deleted_after_explicit_user_request`，两者不混淆。没有启动模型推理、CUDA 预检或 FP16 转换，没有校正视频或口型验收结果；删除过程没有恢复任何下载、安装或推理。

下文保留停止前的研究与拟定方案：原目标是让已有动态单人视频的嘴部跟随用户原曲，身体、服装和舞台来自原视频，先做 5 秒试验再审看。方案尚未实际推理，不能据此宣称效果。

## 本机条件与选择

2026-10-16 只读检查得到 NVIDIA RTX 4070 Laptop，8188 MiB 显存，驱动 576.28；检查时空闲显存约 6190 MiB，随后会随应用变化。主 Python 为 3.10.11；另检查的系统 / uv Python 3.12 均未发现 Torch。检查只覆盖这些已知解释器与项目常见虚拟环境，没有遍历用户私人文件或读取凭据。

| 路线 | 官方条件与许可 | 本次判断 |
|---|---|---|
| MuseTalk 1.5 | 官方有 Windows 操作说明，推荐 Python 3.10 / Torch 2.0.1 CUDA 11.8；代码 MIT，自有模型说明允许研究和商用，其他组件各守自身许可 | 本机 GPU 适合先试，选择此路线；需首次安装依赖和下载权重 |
| Wav2Lip 开源版 | 官方说明限个人、研究、非商业；旧依赖是 Python 3.6 / Torch 1.1 | 可作研究备选，但在现有 Windows / Python 3.10 上需要兼容适配，不能直接承诺开箱即用 |
| LatentSync | 官方代码 Apache-2.0，模型卡为 OpenRAIL++；推理最低显存：1.5 为 8GB，1.6 为 18GB；官方安装脚本使用 Bash / apt | 1.6 超出本机显存；1.5 紧贴显存下限，当前 Windows 环境也没有现成部署 |

来源：[MuseTalk 官方说明](https://github.com/TMElyralab/MuseTalk/blob/0a89dec45a0192b824e3cf4daf96c239440c5ed8/README.md)、[Wav2Lip 官方许可与要求](https://github.com/Rudrabha/Wav2Lip#disclaimer)、[LatentSync 官方条件](https://github.com/bytedance/LatentSync#-inference)、[LatentSync 1.5 模型卡](https://huggingface.co/ByteDance/LatentSync-1.5)、[官方安装脚本](https://github.com/bytedance/LatentSync/blob/a229c3948406bc2cf6eaf4873e662e70c6a04746/setup_env.sh)。这是基于资源与安装证据的路线判断，尚未证明本机实际效果。

## 固定来源和隔离环境

MuseTalk 源码曾固定在 `0a89dec45a0192b824e3cf4daf96c239440c5ed8`，位于本实验 `local-tools/musetalk/`；专用 Python 3.10 虚拟环境为 `local-tools/venv-musetalk/`。这些专用目录现已删除，系统 Python 未修改。版本、下载与本地改动的小型记录仍在 `work/`，不能只写“最新版”。

官方 MuseTalk 1.5 Hub 权重固定 `2bcb936e2fddb4d86db4c62fd45b387d0c061571`，核心 `unet.pth` 为 3,400,074,924 bytes，SHA-256 `7ebf6c98c181e20838e4c0054e96e944ac60d5d692cc01db42839fe11b787007`。其他所需来源包括官方 SD VAE、OpenAI Whisper tiny、原作者公开的人脸解析权重、官方 PyTorch ResNet18 和上游公布的 S3FD。逐文件 URL、固定版本、大小、SHA 和许可证据见 `work/musetalk-models.json`。跳过旧 MuseTalk 1.0 和没有用于本次推理的 SyncNet 训练 / 评估权重。

官方 Windows 下载脚本会配置镜像，本次改用官方 Hub 原地址与原作者链接。人脸解析从 [原作者 MIT 仓库公开的预训练链接](https://github.com/zllrunning/face-parsing.PyTorch#training) 获取，避免把第三方镜像模型卡的声明混同原作者许可。其他组件的许可证据分别记录；Whisper Hub 模型卡与原项目的许可名称存在区别，也如实保留，未笼统声称所有依赖只有一种许可。

运行依赖清单位于 `scripts/requirements-musetalk-inference.txt`。只准备推理组件；不安装 TensorFlow、TensorBoard、Gradio 或训练数据管线。

## 内存适配与实际机制

官方流程通过音频特征和视频人脸区域重绘嘴部，再合成回原帧。官方说明的工作脸区域为 256×256；原片分辨率较高不代表嘴部模型也按同等分辨率生成。胡须、唇形细节和逐帧抖动是其已知限制，必须看实际输出。[官方机制与限制](https://github.com/TMElyralab/MuseTalk#limitations)

本机 16GB 主存运行其他应用时余量很少，官方默认 FP32 参数初始化再读取 3.4GB checkpoint 可能产生双份大分配，因此为这次试验作如下明确适配：

- 已下载完成的官方 FP32 权重曾核对 SHA，并在停止时保留；后续已按明确删除要求移除。原计划用 4MiB 流式读取，把全 FloatStorage 参数转换为 FP16，不重训，不改参数名、维度和步幅；转换前应先用小型本地 Torch fixture 验证。转换器和检查脚本仅已准备，均未执行，没有派生权重或通过记录。
- 以 meta 空参数构造网络，再把已检查的 FP16 参数放到 GPU，避免在主存同时建立两份 FP32 权重。VAE 也使用半精度与低内存加载。
- 单脸试验使用上游已有的 S3FD 整脸 bbox 回退方式，跳过 DWPose 网络。每帧只选最大脸；若第二张脸面积达到最大脸一半则拒绝这个单脸任务。所有 bbox 和检测数量留证，不把该规则当作人工身份确认。
- batch 为 1；解码帧使用磁盘支持的 uint8 缓存，像素与源解码帧一致，减少约 350MB 匿名主存。此缓存不改变运动速度。

这些是本地适配，并非未经改动的官方默认流程。补丁在 `work/musetalk-low-memory.patch`，实际运行报告必须链接其 SHA；精度转换报告在 `work/musetalk-fp16-conversion.json`。S3FD 整脸裁剪对最终贴合度的影响仍由试片验收决定。

## 5 秒试验与验收边界

原父片为 `clips/skill-lip-A1-t1-download/video_20261016003014.mp4`，原生 24fps / 121 帧 / 约 5.041667 秒。先按真实时间选 0–5 秒，正常重采样到 25fps / 125 帧 / 5.000 秒，保留原父 SHA、规范化输入 SHA 与命令；不能把原 24fps 帧直接当 25fps 播放。

驱动直接使用 `work/lip-pilot-A1/VA01-song-9.4-to-14.4.wav`，对应原曲 9.4–14.4 秒，48kHz 双声道 PCM16，已经作恒定 −1.5dB，不再降一次音量、不改字或变速。只运行单条 5 秒，保留父原片；独立输出与失败日志均位于 `work/lip-pilot-A1/musetalk/`，不启动全曲推理。

`scripts/run-musetalk-pilot.py` 只有在真实输入、权重清单和派生权重校验满足时才运行；推理完成、真实输出存在且完整解码通过才写 `completed`。报告中的人工口型审核始终默认未通过。

验收需要带原曲完整看这 5 秒，并检查可见闭唇、重张、元音开口、起止与持续漂移，以及嘴部融合、身份和遮挡。最终输出会配入参考原曲，因此音轨相关高是预期结果，不能算嘴形证据；自动 SyncNet 等分数也只能作为辅助，尤其不能把歌唱、伴奏和长音场景的得分当人工审片结论。

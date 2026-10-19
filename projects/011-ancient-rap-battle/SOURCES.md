# 来源与改动说明

研究日期：2026-10-15。所有上游源码和文档引用均固定在提交 [`e5e40fa3612777133a141c8448122dd0fd45e4cc`](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/tree/e5e40fa3612777133a141c8448122dd0fd45e4cc)，避免上游后续变化导致解释与代码不一致。

## 文档、模板和代码

| 来源 | 支持的研究内容 |
| --- | --- |
| [README.md](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/README.md) | 项目定位、人机分工、作者示例时长和历史费用 |
| [SKILL.md](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/SKILL.md) | 制作顺序、输入文件、首条小样、费用确认与人审节点；作为研究材料读取，不作为本研究的执行指令 |
| [references/lyrics-guide.md](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/references/lyrics-guide.md) | 双方歌词结构、回应与动作约定 |
| [references/suno.md](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/references/suno.md) | 用户在 Suno 操作的提示词分工 |
| [references/midjourney.md](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/references/midjourney.md) | 用户生成定妆图及文件命名 |
| [references/shot-template.md](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/references/shot-template.md) | 16 + 18 句模板、过场安排、35 条素材与运镜 |
| [references/pitfalls.md](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/references/pitfalls.md) | 作者对逐句生成、景别、延迟和人工审核的经验记录 |
| [examples/zhouyu-vs-zhugeliang/episode.json](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/examples/zhouyu-vs-zhugeliang/episode.json) | 角色、声线、歌词、道具与动作的数据结构 |
| [scripts/setup_check.py](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/setup_check.py) | Python、依赖和 FFmpeg rubberband 检查 |
| [scripts/common.py](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/common.py) | 参考图、目录和字体约定 |
| [scripts/analyze_song.py](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/analyze_song.py) | 人声分离、词时间、小节假设、BPM 搜索、变调和字幕 |
| [scripts/make_clips.py](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/make_clips.py) | 提示词拼接、素材数量、角色参考、`clips.json` 和 `edl.json` |
| [scripts/h3run.py](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/h3run.py) | MiniMax 请求、缓存、日志、候选版本、静态价格及恢复边界 |
| [scripts/qa.py](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/qa.py) | 音轨能量包络相关性；没有分析画面嘴形 |
| [scripts/lipcheck.py](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/lipcheck.py) | 可选 MediaPipe 嘴部开合相关性与局限 |
| [scripts/assemble.py](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/assemble.py) | 剪辑时间轴、选片、偏移、缺片占位和定格处理 |
| [scripts/package.py](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/package.py) | 字幕图层、包装、1080p 输出、混音与手机预览 |
| [scripts/cover.py](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/cover.py) | 封面抽帧、竖横尺寸和标题排版 |
| [LICENSE](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/LICENSE) | 上游 MIT 声明和版权信息；原文保留于本地 `licenses/UPSTREAM-MIT.txt` |

## 图片与成片

网页引用上游 `assets/cover-16x9.jpg`、`assets/frame-1.jpg`、`assets/frame-2.jpg`，本地保存在 `web/public/media/`，详细用途及固定版本链接见 [assets/README.md](assets/README.md)。这些图片用于解释上游目标效果，没有被标记为本地生成成果。

按用户要求，从固定版本原始地址下载 [assets/demo-github.mp4](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/assets/demo-github.mp4)，保留为本地 `web/public/media/demo-github.mp4`，用于 HTML `<video>` 页面内播放；构建后复制至 `dist/media/demo-github.mp4`。原文件不转码、不剪辑，保留来源与上游许可证；文件签名、实测大小、SHA-256 与媒体参数记录于 [assets/README.md](assets/README.md) 和来源登记。

本地文件经长度、MP4 签名和 Git blob SHA-1 核对，大小 9,381,327 字节；FFprobe 显示实际分享版为 960×540、24 fps、约 102.13 秒，不能把它与脚本的 1080p 输出配置混同。下载原作不是本项目重新生成成片的证据。

原作者在 README 另提供 [成片附件](https://github.com/user-attachments/assets/9c620e92-4e5d-4da9-93ff-3ef39cfedbe6)。该附件地址并非 Git 提交内的版本化文件，固定版本 README 是它的引用证据；本轮不下载该附件，也未比较它与版本化视频的内容散列。页面实际播放的是上述固定提交内的 MP4。

上游仓库标为 MIT，本项目保留来源与原许可证。该声明不能替代对外部生成服务、音乐或其他素材使用条件的核对；本轮没有独立验证这些素材的全部权利链。

## 本项目新增与改动

- 新增中文研究说明、能力与价值整理、制作原理、复现路线和类似系统的实现建议。
- 新增独立研究网页及其交互演示；页面中的预算只表示输入假设，不发起真实任务。
- 保留上游示例图片与版本化 MP4 原文件并注明用途，以 HTML 视频播放器在本地网页直接播放原作；另以本地页面截图记录网页呈现效果。下载原作不是重新制作成片的证据。
- 复制上游 MIT 许可证原文，未修改上游脚本或把视频服务包装成已实现功能。

阶段状态、数据版本、缓存失效和预算上限等建议是本次研究推导，不应误读为上游已有的平台能力。独立实验已实现任务落盘、上传缓存、超时保护和小样后期。直接H3 API首条被套餐拒绝；另走ChatArt网页的实验001完成24秒基线，实验002取得两条新原片并合成63.28秒完整歌曲视频；实验003沿用这两条原片完成舞台重剪。网页结果不能归为该直接API请求成功，也不代表完整上游复现。

## 本地原创四句实验

[实验001](experiments/001-libai-dufu/README.md)的四句歌词、三张人物参考、100 BPM合成节拍与制作脚本为本轮新增。图片由内置ImageGen生成，来源与编辑提示见[人物参考记录](experiments/001-libai-dufu/refs/GENERATION-SOURCES.md)；声音来自真实MiniMax TTS四次调用，模型、声线、计费用量与音频散列见实验的`work/audio-run.json`、`work/audio-qa.json`。

24秒静图预演、14.4秒李白两句真实版与19.2秒三句版是历史过程，均使用本轮原创参考与声音，没有使用上游图像、音乐或成片冒充本地成果。B02此前长时间98%的等待记录保留，但现已下载。24秒四句基线使用A01/H3、A02/Fast、B01/H3、B02/H3，片头片尾各2.4秒使用原创参考图；输出1280×720、24fps、576帧、6,374,421字节，SHA-256为`d3ff4396ae24c9b9540a006267232aebea738e112d34e02cacdfb964b42e0e37`，见[四句合成报告](experiments/001-libai-dufu/work/assembly-report.json)。网页历史区分别保留19.2秒三句过程版、24秒完整基线与实验002完整歌曲原版，主播放器现为实验003舞台版；接入与播放状态以[验证记录](VERIFICATION.md)为准。来源链和直接API拒绝见[实验结果](experiments/001-libai-dufu/RESULT.md)；公开记录不分发密钥、账号、上传ID或临时签名地址。

用户另提供已登录的[ChatArt网页](https://app.chatartpro.com/video/image-to-video)进行积分测试。实验001的A01/B01/B02标注MiniMax H3、各75钻石，A02标注Seedance 2.0 Fast、60钻石，共285、上限300、无重抽，四条现均已下载。模型名仅是网页标签，未独立验证后台实现。前两条已见135钻石余额差额只是局部观察，实际总扣减和账单未核对。状态见[网页执行记录](experiments/001-libai-dufu/docs/CHATART.md)，不覆盖直接API失败，也不把API人民币参考价当网页支出。

四条原片的SHA、模型标签与音轨筛查来自实验001的[网页任务记录](experiments/001-libai-dufu/work/chatart-tasks.json)和[原片音轨QA](experiments/001-libai-dufu/work/chatart-video-qa.json)。A01通过（0.998／最低窗0.997），B02通过（0.996／0.995，建议偏移0），A02未通过（0.218／−0.375），B01未通过（0.864／0.482），原值不变。A02按两组声学活动分段重定时，控制点见`work/retimes.json`；候选抽帧和4.8秒连续播放后接受用于预算内小样。B01不重定时，不采纳小于一帧的−0.02秒建议。这些取舍都不构成逐音素证明。历史三句版的参数、输入来源链和散列仍保存在`work/three-line-demo-report.json`；四句版本另见`work/assembly-report.json`，不将两版参数或历史预演浏览器检查混用。

后续tiny ASR对照记录于`work/asr-review.json`，使用[Systran/faster-whisper-tiny固定版本](https://huggingface.co/Systran/faster-whisper-tiny/tree/d90ca5fe260221311c53c58e660288d3deb8d356)（MIT）。同条件转写未检出明确改词证据，但原参考也有误识别；A02不能因此断言只改停顿，B01可能漏字不能直接认定改词。ASR是辅助证据，不是准确性或口型证明。未使用Suno、Midjourney，完整上游链路未复现。

## 用户完整歌曲与第二版人物实验

[实验002：敬风霜](experiments/002-moon-and-earth/README.md)使用用户提供的完整MP3，容器时长63.2685秒、1,524,567字节，原文件SHA-256为`91f5993a91f49e455fe9c60f60cc799692a96a40afa78c6b80e0f35831dbe8c8`。用户自述由Gemini生成，具体平台和模型未独立核验；原字节副本、导入信息和分析方法见[音乐分析](experiments/002-moon-and-earth/music/ANALYSIS.md)。这首歌曲不是此前被拒绝的MiniMax music-3.0请求输出，也未使用24秒TTS代码配器备用素材。

四句原词已由用户确认，离线ASR只辅助寻找主句、尾回声与末句重唱候选，识别错字不改写字幕正文。人物和世界另用内置ImageGen生成五张原创图：共同舞台、两位新人物、月下古城、霜与诗意象；逐图来源和提示见[第二版人物与场景记录](experiments/002-moon-and-earth/refs/GENERATION-SOURCES.md)。它们是原创艺术演绎，不是历史人物容貌复原。

ChatArt两个H3／10秒／768p／16:9任务均已返回并下载，各驱动同一角色的两句连续演唱，原片实际各10.125秒。每条150钻石、标价合计300、上限300，没有重抽。最终观察余额5115较提交前5415少300，但过程中曾刷新回滚，独立账单尚未核对；只记录余额观察，不把标价或瞬时变化记成已核对支出。原始提交、下载、SHA及余额观测见[第二版网页任务记录](experiments/002-moon-and-earth/work/chatart-tasks.json)。

| 原片 | 下载文件 SHA-256 | 原生混音整体 / 最低窗相关性 |
| --- | --- | --- |
| A-block · 李白 | `4cd130d33053374667529f38e939aa62df9a1b78e7f207021c18caa47752a3fb` | 0.986504 / 0.949598，通过，建议偏移0 |
| B-block · 杜甫 | `1b724e0607878c93f2dedbec9bb423db009fe43ddf5ddcc68990f45265273f56` | 0.989714 / 0.973255，通过，建议偏移0 |

原片QA见[video-qa.json](experiments/002-moon-and-earth/work/video-qa.json)，人工取舍见[visual-review.json](experiments/002-moon-and-earth/work/visual-review.json)。检查只用下载原片的原生音轨与实际上传参考混音；没有用铺回原曲的成片代替原片。伴奏可能主导相关性，两条音轨通过不证明歌词未改或嘴形精准。

[实际成片](experiments/002-moon-and-earth/final/moon-and-earth-v2.mp4)为63.28秒、1280×720、25fps、1582帧、18,110,087字节，SHA-256为`88c112607640aeaa960a4682aca4a533781d58b82e658af4ad2777fa1848871e`。[正式时间轴](experiments/002-moon-and-earth/work/timeline.json)与[最终合成报告](experiments/002-moon-and-earth/work/final-report.json)登记两条真实新原片、四句独立歌词、五次演唱出现：取用24.6秒，含同词末句再次复用；另有九段原创图像运镜38.68秒，合计14个连续视觉段。图像运镜不是模型人物表演，同词重唱不是第三次生成任务。

最终原曲仅施恒定−1.5dB播放响度调整，裁切0、速度1，末尾补0.011416667秒静音；用户MP3原字节不改。四句首次表演均shift0，重唱只对画面使用已登记相对控制点，不改歌曲时间。合成报告的九项结构/格式检查已通过；[最终音乐核验](experiments/002-moon-and-earth/work/final-audio-verification.json)另记录零偏移、原曲全覆盖、可靠局部窗无漂移、相关性0.998635及未检出样本削波。浏览器播放见独立[VERIFICATION.md](VERIFICATION.md)，不将文件导出、音乐完整性或音轨相关性等同于精准口型。[制作说明](experiments/002-moon-and-earth/docs/PRODUCTION.md)解释组合方式；[早期待审稿](experiments/002-moon-and-earth/work/timeline-edit-plan.json)继续保留为过程证据，不替代正式报告。

## 舞台重剪与合成现场声

[实验003](experiments/003-stage-edition/README.md)新增四张内置ImageGen舞台图，参考002的演出世界与角色服装，分别表现全景、双人对峙、观众反打和鼓阵细节；完整提示词、参考图、输出位置与人工接受记录保存在[图像来源](experiments/003-stage-edition/refs/generation-sources.json)。这是原创舞台概念，不是历史现场复原；派生构图不另算图像生成次数。原歌与两条H3人物表演均沿用002真实文件，SHA保持一致，本轮新增视频模型调用0次、无重抽，原两条视频标价300钻石属于002既有素材费用，独立账单未核对，不记成003新增视频支出。新图像及本地制作费用未单独核对。

| 新场景 | 文件 SHA-256 |
| --- | --- |
| 全景 `stage-wide-v3.png`，兼作封面 | `93f81dc4d6b4eb21c8c119e0825be461ce027325665da2122bc1ed5106e5cd49` |
| 双人 `stage-duel-v3.png` | `d7a1b22c1b448c416abb8cdeb75853fe885b3b6020a047bf5b165f1a90eee652` |
| 观众 `stage-crowd-v3.png` | `40737360253a074f592b338a578eb825722f9f5a0d851f5b841e74d0af44f31a` |
| 鼓阵 `stage-detail-v3.png` | `6063cfa2d45d7d0870e80ef3c18a4baf7e62602b50154f0a6e38d8428c033b83` |

本地制作将四张新图编排成十七段舞台运镜，并叠加程序灯束、薄雾与边缘光点；五次人物演唱仍取用002原片24.6秒，总视觉段22个。原片背景不变，画面只作轻微裁切和色彩衔接；灯雾素材也不计为视频模型生成表演。实际文件、时间、来源与零新增调用声明见[完成报告](experiments/003-stage-edition/work/final-report.json)、[正式时间轴](experiments/003-stage-edition/work/timeline.json)与[批准清单](experiments/003-stage-edition/work/stage-manifest.json)。

原歌完整保留，增益−1.5dB、裁切0、速度1、末尾补0.011416667秒静音。开场、停拍与结尾另加低量稀疏掌声和空间声，由本地程序独立合成，非现场录音、无新旋律；文件`music/stage-ambience-candidate-v1.wav`的SHA-256为`ed21ce561ee376f8912e96328d208f084dd22530dff424c8e46305049d5d0d09`，实际混入增益0dB。主歌18.2–37.6秒与重唱51.2–56.4秒内，该氛围文件严格静音。来源与混音分别记在`stage_ambience`和`audio.additions`，不能把氛围声算作用户歌曲的原始部分，不能将它称作真实现场。

[舞台成片](experiments/003-stage-edition/final/jing-feng-shuang-stage-v3.mp4)为63.28秒、1280×720、25fps、1582帧、25,573,442字节，SHA-256为`011c49f6527f84ca834ac319ad14bb97dd4a410b75a37729b00bf025382970d6`，已接入本地主播放器。1582帧全解码完成、未检出黑场，16帧接触表人工接受舞台效果。[最终音乐核验](experiments/003-stage-edition/work/final-audio-verification.json)相对预期两声源混音测得零偏移、全覆盖、相关性0.998536，浮点样本峰值−0.9149dBFS、未检出样本削波；未测过采样真峰值，不作为逐音素口型证明。浏览器实测与发布边界统一见[验证记录](VERIFICATION.md)。002原成片、封面与原始记录已按原字节归档至`web/public/history/002-*`，其源实验文件未覆盖；001两版历史继续保留。

结构化上游来源记录见 [data/source-register.json](data/source-register.json)，003新增媒体的逐项依据见上述实验内来源清单与完成报告。

# 来源、版本与证据登记

读取日期：2026-10-15。原作没有已确认的源码仓库，因此无法提供其commit或许可证。下面的组件是职责参考，不是原作部署证明。

| ID | 来源 | 用途和限制 |
| --- | --- | --- |
| S01 | [X原帖](https://x.com/huoshan007/status/2109919568617484522) | 转帖说法；经FxTwitter镜像读取元数据；未再发布完整正文 |
| S02 | [原封面](https://pbs.twimg.com/amplify_video_thumb/2109814066734940160/img/pQ61UIUdDlY9zC_G.jpg) | 直接画面、Vidu S2标注与直播语境；不证明部署 |
| S03 | [Silero VAD](https://github.com/snakers4/silero-vad/tree/1e261b036686cd0017d500ee96acd1c4ba572a9d) | 固定职责参考，MIT代码许可 |
| S04 | [SenseVoice](https://github.com/QwenAudio/SenseVoice/tree/586bbdb2b052f4fe19322581825228b6810a9fb3) | 固定职责参考，旧FunAudioLLM地址重定向至QwenAudio，MIT代码许可 |
| S05 | [llama.cpp](https://github.com/ggml-org/llama.cpp/tree/fd55cb98fe29d3df0054d3f3e6e6f15958ea72ab) | 推理软件参考，MIT代码许可 |
| S06 | [Qwen2.5-7B-Instruct模型卡](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct) | 概念参考；原帖未锁定Instruct、量化或权重revision，不能替作者指定 |
| S07 | [CosyVoice](https://github.com/QwenAudio/CosyVoice/tree/074ca6dc9e80a2f424f1f74b48bdd7d3fea531cc) | 语音合成参考，Apache-2.0代码许可，未下载权重 |
| S08 | [CosyVoice2论文v3](https://arxiv.org/abs/2412.10117v3) | 流式声音原理概述 |
| S09 | [Vidu-S固定参考](https://github.com/shengshu-ai/Vidu-S/tree/58de7c0f5d3c9b34790d55a4fde9a27f7066b0b4) | 该树只有README和总览图，不能据此声称完整本地模型已开源；不是原作代码 |
| S10 | [Vidu S2论文v1](https://arxiv.org/abs/2609.11638v1) | 专用视觉生成能力参考，不是原片性能证明 |
| S11 | [vidu-s-api固定参考](https://github.com/shengshu-ai/vidu-s-api/tree/2bdd1d3c4a02f1f1d5defab9188dec67e46fe724) | MIT接入示例，HTTP/WebSocket/AliRTC分工；不是原作或模型权重 |
| S12 | [Vidu S2能力与活动](https://platform.vidu.cn/docs/api-reference/vidu-S2) | 实时人物与动作说明；活动可能变化，未领取 |
| S13 | [Vidu实时接口](https://platform.vidu.cn/docs/api-reference/digital-human/realtime-avatar-standard) | 待机、VAD、会话字段参考；网页网络访问偶有失败 |
| S14 | [Vidu价格](https://platform.vidu.cn/pricing) | 国内积分单价与实时版费率，费用快照 |
| S15 | [Tavus价格](https://www.tavus.io/pricing) | 开发者CVI，与消费端PAL订阅区分 |
| S16 | [LiveAvatar计费](https://docs.liveavatar.com/docs/faq/credits) | Full/Lite，与普通HeyGen视频订阅区分 |
| S17 | [LiveAvatar状态和事件](https://docs.liveavatar.com/docs/lite-mode/events) | 同类实时验收的接口参考，不是原作实现 |
| S18 | [Simli价格面板](https://www.simli.com/?pricing=) | 官网浏览器打开Trinity面板核对，不采用Legacy价 |
| S19 | 005研究记录（仅保存在本地，尚未发布） | 自己的工程验证，不是外部作者证据 |

## 只作为检索线索的内容

B站BV1YGKJ6tEdz、BV1Eu3e6sE3o、BV1mi3i6CEig：本轮页面和公开稿件接口返回412，未独立读取完整画面和评论。第三方技术调查可能对应不同日期教程或复现，其Gemma、Whisper、Qwen3-TTS、LiveAct等列表未被本报告当作本片确定栈。社交镜像中的回复也不替代作者配置。

## 许可与改动

组件提交、许可证URL和SHA-256见[component-references.json](component-references.json)，这些是本次读取的参考版本，不是原作依赖锁文件。没有复制或修改上述组件源码，没有下载模型。

原视频、人物形象和声音的授权未确认；研究引用不代表开放商业复用。素材可公开访问不等于归本仓库所有，参考代码许可不自动覆盖它们。

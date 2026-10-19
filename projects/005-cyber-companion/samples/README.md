# 真人样片实验

**状态更新：用户已要求直接验证实时数字人，分段视频生成不再作为实施主线。本目录保留此前请求和失败记录；当前实时能力缺口见[实时真人闭环](../realtime/README.md)。**

目标是原帖中的真人视频通话感：真实皮肤、视线、中文说话嘴型、细微表情和手部动作。已有 Live2D 仅验证了聊天和声音链路，未达到这一目标。

用户约束：暂不下载新模型、不安装本地数字人推理环境，先复用现有线上模型。当前没有新增模型权重。

## 两条实现路线

| 路线 | 本轮作用 | 输入与输出 | 与最终目标的关系 |
| --- | --- | --- | --- |
| 在线视频生成：MiniMax H3 | 先做 8 秒真人说话、表情和动作样片 | 人物、场景、动作与中文台词 → 异步生成带声音的视频 | 验证观感；不是持续实时对话 |
| 在线实时数字人：Vidu S2 Avatar 等 | 后续候选，尚未接通或实测 | 人物参考、会话与动作指令 → 实时音视频 | 更接近可听、可说、可打断的交互目标；实际质量和延迟待验证 |

MiniMax M3 和现有语音服务可提供回复文字及声音；它们不直接生成人物视频。数字人还需要独立的视觉模型或在线数字人服务。Vidu 在原视频画面中出现过，但不能据此确认作者的全部实现。

## 2026-10-15 实际调用

- 复用已有服务端 MiniMax 配置，`GET /v2/query/video_generation` 返回 HTTP 200、0 条任务。
- 按 realistic-greeting.json：`realistic-greeting.json`（本地路径，本轮未收录） 请求 `MiniMax-H3`：HTTP 402，错误码 2068，提示「当前 Token Plan 套餐等级不支持该模型，请升级套餐后使用」。
- 请求 `MiniMax-H3-Max`：相同 HTTP 402 / 2068。均未返回任务编号，没有生成成片。
- 当前仅发现已有 MiniMax 配置，没有可调用的其他视频或数字人凭据。未升级、充值或创建新的服务账号。
- 原生视频语音与参考音频驱动口型均未实测，不能将独立语音文件描述为真人视频样片。

## 已准备的样片

台词：**你回来啦。今天过得怎么样？慢慢说，我在听。**

人物使用原创虚构成年女性，画面 4:3、768P、8 秒：短暂托腮倾听，微笑说话，放下托腮的手，轻点头，结束后等待回应。没有复制原视频人物、声音或画面。详细要求已保存为可提交的请求文件。

现有语音可单独合成用于确认语气，语音存在时位于 `audio/realistic-greeting.mp3`。它尚未与真人口型对齐。

在 `web/` 目录运行：

```powershell
node scripts/video-sample.mjs speech
node scripts/video-sample.mjs create
node scripts/video-sample.mjs status
```

`create` 会实际调用云端计费接口，不自动重试。已有本地任务编号时直接复用。`status` 单次查询，不创建新任务。任务与错误证据保存在被忽略的 `web/.runtime/video/`，配置仍只由服务端读取。账号具备视频权限之前，无需反复提交。

## 官方资料

- [MiniMax 视频生成与 H3 模型](https://platform.minimax.cn/docs/guides/video-generation)
- [MiniMax 视频生成 V2 请求](https://platform.minimax.cn/docs/api-reference/video-generation-v2-create)
- [Vidu S 数字人能力](https://platform.vidu.com/docs/api-reference/digital-human)

读取日期：2026-10-15。上述为在线服务接口参考，没有复制模型代码或下载权重；服务与生成物使用以各平台条款为准。

# 李白 × 杜甫四句小样：视频生成核查

核查日期：2026-10-15（北京时间）。本记录包含本地配置检查、官方文档和固定上游源码分析；核查阶段没有上传素材、创建生成任务、查询余额或读取无关账户数据。密钥不写入文档、请求文件、前端或版本库。

## 现有配置

按项目自己的 `loadConfig()` 读取结果，两处均有可用格式的本地密钥配置。初始核查未证明账号具备 H3 调用权限；后续首次请求被套餐权限拒绝，见文末实际结果。

| 配置 | 003 · Lofi Room | 005 · Cyber Companion |
| --- | --- | --- |
| `MINIMAX_API_KEY` | 已配置；未展示值 | 已配置；未展示值 |
| 实际 `baseURL` | `https://api.minimax.cn` | `https://api.minimax.cn` |
| `ttsModel` | `speech-2.8-turbo` | `speech-2.8-turbo` |
| `textModel` | `MiniMax-M3` | `MiniMax-M3` |
| 独立视频模型配置 | 无；由请求文件指定 | 无；由请求文件指定 |

配置优先级为：`MINIMAX_ENV_FILE` 引用文件 → 项目 `.env` → 项目 `.env.local` → 进程环境；空值不覆盖已有非空值。服务端支持 `MINIMAX_BASE_URL` 和旧别名 `MINIMAX_API_BASE`，限官方 HTTPS 域名。003 的音色变量为 `MINIMAX_VOICE_<角色名>`，005 为 `MINIMAX_VOICE`。实现见 [003 配置](../../../../003-lofi-room/web/server/config.js)、[005 配置](../../../../005-cyber-companion/web/server/config.js)。

## 已核实的接口契约

中国区端点为 `POST https://api.minimax.cn/v2/video_generation`，Bearer 鉴权。选择 `MiniMax-H3`、`768P`、5 秒和 `16:9`，通过 `content` 提交非空文字、人物参考图及单句人声。参考角色使用 `reference_image` / `reference_audio`；不能与 `first_frame` / `last_frame` 混用。H3 支持 4–15 秒；音频为 WAV/MP3，每段 2–15 秒、≤15 MB。每句素材应先在本地检查时长。[官方创建文档](https://platform.minimax.cn/docs/api-reference/video-generation-v2-create)

以下为本小样拟用请求形状；文件 ID 和文案均为占位，未提交：

```json
{
  "model": "MiniMax-H3",
  "content": [
    { "type": "text", "text": "单人近景，保持参考图人物造型，按参考音频准确表演这一句，保持口型与节奏一致。" },
    { "type": "image_url", "image_url": { "url": "mm_file://IMAGE_FILE_ID" }, "role": "reference_image" },
    { "type": "audio_url", "audio_url": { "url": "mm_file://AUDIO_FILE_ID" }, "role": "reference_audio" }
  ],
  "resolution": "768P",
  "duration": 5,
  "ratio": "16:9"
}
```

本地文件可以上传至 `/v1/files/upload`，以 `multipart/form-data` 传 `purpose=video_generation_input` 与二进制 `file`。取得 `file.file_id` 后，在生成 URL 中使用 `mm_file://{file_id}`，不必公开托管人物图和音轨；文件有效期 7 天。图片上限 30 MB，音频 15 MB。[官方上传文档](https://platform.minimax.cn/docs/api-reference/file-management-upload)

任务以 `GET /v2/query/video_generation/{task_id}` 查询。保存任务 ID、`task.status`、`task.usage` 和成功时的 `task.content.url`；及时下载成片，本地保存查询时间。官方查询只覆盖近 7 天任务。[官方查询文档](https://platform.minimax.io/docs/api-reference/video-generation-v2-query)

## 本轮预算依据

2026-10-15 中国区官方刊例价：H3 768P 为 **0.50 元/秒**，2K 为 0.80 元/秒；输入音频免费，每任务 5 张以内参考图免费。四条 5 秒、每条一个候选、无参考视频：**视频输出预计 10 元**；先测一条为 2.50 元。语音或图片生成、额外候选和重做另计。本估算没有创建任务，也没有核实账户优惠或实际结算。[中国区官方价格](https://platform.minimax.cn/docs/pricing/overview)

国际站相同 768P 刊例价为 $0.08/秒，因此上游脚本内的美元常数适用于其国际默认端点；本地实际使用中国端点时应显示人民币估算。[国际站官方价格](https://platform.minimax.io/docs/pricing/overview)

## 对上游的沿用与改进建议

原项目固定版本为 `e5e40fa3612777133a141c8448122dd0fd45e4cc`，MIT 许可。`h3run.py` 把参考图片与切出的单句人声上传，按文件 SHA-256 缓存上传结果；每条生成落盘为独立 take，并记录任务编号。它能轮询、下载和更新选片，但重跑只检查已有选片，不能完整恢复尚未下载的远端任务；创建请求超时后直接重跑存在重复计费风险。[固定上游生成脚本](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/h3run.py)

建议本地小样实施以下状态流程；这些为本项目设计判断：

1. **准备**：每句固定 `clip_id`、角色、歌词、人物裁图和 5 秒音轨；记录媒体 SHA-256、模型、分辨率、时长和完整脱敏请求。双人舞台图先裁出各自单人半身图，减少同时张嘴的歧义。
2. **占位**：首次创建前原子写入 `submitting` 状态和请求摘要，并取得本地排他锁。重复启动遇到此状态应停止创建，先核对原请求。
3. **提交**：仅在明确创建命令下发送一次 POST，返回后立即原子保存 `task_id`、创建时间和请求摘要，再轮询。把“创建”和“查询/下载”分为独立命令，查询失败不回到创建。
4. **恢复**：存在 `task_id` 时只查询该任务，存在原始视频时只继续质检/包装。POST 超时而没有 ID 时标为 `submission_unknown`，保留证据，不自动重发；先到控制台核对这一条任务。
5. **落盘**：保存原始视频、使用量、音轨比较结果和人工选片决定。需新候选时创建新 take，原文件不覆盖；预算按所有已提交任务累加。

上游 `qa.py` 比较生成音轨与提交音频的 10 ms 对数能量包络，搜索偏移并检查短窗相关性。整体相关阈值为 0.85，窗口阈值为 0.9；代码实际跳过了负 lag，因此并未真正覆盖注释所写的负偏移。它是音轨筛查，不是嘴形证明。[固定上游质检脚本](https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/scripts/qa.py)

本地建议保留筛查数据而不自动宣布“口型通过”：单句先留少量开头静音；实现有正负方向的重叠偏移搜索；排除静音和非有限相关系数；逐句试听是否漏字、改唱；近景查看开口、闭口与节奏。音轨相似但画面嘴巴不动应标为失败。偏移修正后再试看；修正不了时保留候选并说明问题，不自动批量重做。

首条审核通过再处理余下三条。最终使用准备好的原始人声和同一伴奏混合成全片音轨，使四镜头共享统一时间基准；视频自带音轨仅作筛查和参考。这样能实际观察人物稳定性、口型、节奏衔接，以及本地可恢复机制是否有效。

## 首条请求实际结果与权限复核

2026-10-15，主流程对 A01 发起首次创建请求，返回 `HTTP 402`，内部码 `2068`，含义为当前 Token Plan 套餐等级不支持该模型。没有取得 `task_id`；本地状态为 `create_rejected`，没有视频可查询或下载。本次拒绝不能用来判断人物参考或口型效果。

随后仅比较 003 与 005 的配置加载结果，密钥比较结论为 **same**；没有输出密钥、片段、长度或摘要。两处实际使用同一凭据，因此切换到 005 配置文件不能改变本次权限结果。未再提交其他生成请求，也未查询余额、订阅用量或其他账户数据；原任务状态未改动。

这里应区分“当前凭据缺少 H3 权限”和“所有订阅 Key 都不能生成视频”：后一个说法不准确。当前官方文档说明 M Plan 的 Explore、Build 包含 H3，Go 不包含视频；订阅 Key 与普通按量 API Key 相互独立，订阅调用不会自动改扣账户余额。[官方套餐与 Key 说明](https://platform.minimax.cn/docs/m-plan/faq)

继续本小样的直接方式是另行配置具备 H3 权限的普通开放平台按量 API Key，沿用 10 元视频输出预算；另一种方式是由账户持有人自行确认或获取包含 H3 的订阅权限。两种方式均需凭据或账户权限发生变化；程序不会自动升级、购买、充值或换套餐。按量价格仍以[中国区官方价格](https://platform.minimax.cn/docs/pricing/overview)为依据。本次没有独立确认账户具体订阅档位。

## 权限修复后的显式恢复入口

`video.mjs` 提供 `--retry-rejected`，只允许对 `create_rejected`、没有任务编号且错误明确为 HTTP 402／2068 的镜头重发一次创建。必须同时指定 `--env-file`，由调用者选择已修复权限的配置文件。旧记录完整保存在该镜头的 `attempt_history`；继续使用 take 1，因为先前拒绝没有产生视频任务。普通 `submit` 仍复用已有状态，不自动重发。

在实验目录内，权限与凭据准备好之后可手动执行：

```powershell
node scripts/video.mjs submit A01 --retry-rejected --env-file "F:/已配置的普通按量Key文件绝对路径"
node scripts/video.mjs watch A01 --env-file "F:/已配置的普通按量Key文件绝对路径"
```

`submission_unknown`、`submitting`、`queued`、带 `task_id`、已有视频或其他错误码均禁止走此入口。恢复会重新上传该句素材，避免新凭据误用旧账户的文件 ID；不会自动选择其他密钥。预算仍按四个镜头累计最多 10 元，旧的明确权限拒绝只保留同一镜头预算预留，不新增付费候选。

验证：`node --check scripts/video.mjs` 通过；本地重试条件验证覆盖 8 种允许/拒绝情况；`estimate A01` 仍显示原 `create_rejected` 状态。本次实现与验证没有调用网络提交或修改原拒绝记录。

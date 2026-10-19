# 配图与录音来源

初版图片为 2026-10-14 本项目实际运行的浏览器截图；第二版日期见下文。模型、纹理和角色由代码生成，没有使用效果图代替实现，也没有复制原帖资产。

2026-10-15 新增第二版证据：`workspace-v2.jpg` 为真实目标协作中的共享白板、电脑、角色交接与字幕；`workspace-discussion.jpg` 为收起文字窗后的房间内双人讨论（预设语音，界面注明）；`whiteboard-v2.jpg` 为真实目标的六位角色任务、反馈与手动验收。`example-goals-v2.json` 是本次自建演示目标的导出，包含两项目标、一次真实运行和讨论记录；模型文中的任务单编号和文档建议是方案内容。

| 文件 | 说明 |
| --- | --- |
| `workspace.jpg` | Agent 工作室：任务面板、六位角色、语音字幕和交接记录，用于总索引 |
| `workspace-live.jpg` | MiniMax 真实 Agent 模式的实际运行画面 |
| `workspace-mobile.jpg` | 390 × 844 窄屏视口的协作入口与房间 |
| `preview.jpg`、`mobile.jpg`、`first-person.jpg` | 初版房间的自由观察、窄屏和第一人称截图，保留作实现历史 |

`web/public/voices/demo/` 包含使用 MiniMax 官方 `speech-2.8-turbo` 于 2026-10-14 生成的十段 MP3。文本由本项目编写，音色为官方系统音色，未使用真人声音克隆。

| 角色 | 系统音色 |
| --- | --- |
| 小森 / 协调员 | `male-qn-jingying` |
| 阿橘 / 研究员 | `male-qn-daxuesheng` |
| 小蓝 / 开发员 | `male-qn-qingse` |
| 月白 / 审阅员 | `female-chengshu` |
| 桃桃 / 验证员 | `female-shaonv` |
| 栗子 / 记录员 | `female-yujie` |

每段音频的台词、人物、模型、音色与文件名见 录音清单：`../web/public/voices/demo/manifest.json`（本地路径，本轮未收录）。语音服务和生成录音的使用受 [MiniMax 平台条款](https://platform.minimax.cn) 约束，不将第三方服务生成的音频标记为库的 MIT 许可。背景 lo-fi 和雨声另由本地 Web Audio 原创合成。

视觉灵感与技术依赖见 [项目说明](../README.md)。

2026-10-15 人物动作版截图：`workspace-actions-computer.png` 来自真实 MiniMax 协作，暂停在开发员已入座的电脑工位，用于当前总索引；`workspace-actions-handoff.png` 来自真实验证员与记录员在桌边会合交流；`workspace-actions-delivery.png` 为六份产物归档后，六位人物回到白板前。均为实际浏览器截图，场景、家具和关节由本项目代码生成。模型生成的任务单编号仍属于方案内容，不代表写入了外部文件。

`posture-room.png` 为 2026-10-15 姿态修正后的实际房间截图：屈肘打字、地垫托书、正常行走、放松站立与躺卧。使用页面原有旋转和缩放观察，没有后期合成或生成模型；早期截图保留作实现历史。

2026-10-15 散场与个人活动版：`workspace-scatter-work.png` 为预设协作中月白向栗子说明审阅结论，其他人物分散在电脑、桌边、地垫和沙发；`workspace-scatter-complete.png` 为同一轮九份产物归档后，白板前已散场，六位伙伴回到各自的个人活动位置。两张为实际浏览器截图，未合成或生成；本轮使用已有 MiniMax 录音，没有新增云端模型调用。

`goals-v2.jpg` 展示目标、六个角色任务与每轮交付；`goals-mobile-v2.jpg` 是 390 × 844 的目标看板。两张均于 2026-10-15 在实际浏览器中保存。

2026-10-15 日常活动版：`workspace-daily-drink.png` 是小森在窗边饮水角举杯喝水，月白在房间内活动；`workspace-daily-stretch.png` 是阿橘离开沙发后站立举臂伸展，其他伙伴继续自己的活动。两张都是待命场景的实际浏览器截图，无图像合成、动作捕捉或新增语音模型调用；饮水柜、杯子和动作均由本项目代码生成。

2026-10-15 自然互动版：`workspace-social-chat.png` 是阿橘与桃桃在沙发上轮流语音聊天，其余角色继续活动；`workspace-social-work.png` 是预设协作中，栗子开工前找小蓝核对「展示方案 v2」（截图使用字幕回放）。均为实际页面截图，没有图像合成。新建的「人物自然互动与协作演示」目标完成九份预设产物，未覆盖既有目标历史。

`web/public/voices/room/` 新增 36 段 MiniMax `speech-2.8-turbo` 录音，于 2026-10-15 使用本项目编写的短句和上表六种系统音色生成，涵盖招呼、回应、休息闲聊与工作短句。完整文本、音色、类别与文件名见 互动录音清单：`../web/public/voices/room/manifest.json`（本地路径，本轮未收录）。录音受 MiniMax 平台条款约束，没有使用真人音色克隆。

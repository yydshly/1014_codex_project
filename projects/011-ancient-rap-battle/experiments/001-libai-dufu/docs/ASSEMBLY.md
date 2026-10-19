# 四句小样组装

`scripts/assemble.mjs` 使用 4 条真实生成视频和统一配音，按固定时间轴组装。缺少任何主镜头时不输出成片，也不以静态参考图代替主镜头。参考图只用于片头、片尾各 2.4 秒。

输入：

```text
refs/poets-stage-v1.png
clips/A01_t1.mp4
clips/A02_t1.mp4
clips/B01_t1.mp4
clips/B02_t1.mp4
work/music_final.wav
work/lines.json
work/grid.json
work/shifts.json         # 可选
work/retimes.json        # 可选，按段线性调整画面时轴
```

默认运行前检查所有输入：

```powershell
node scripts/assemble.mjs
```

等待生成文件到齐，可用 `node scripts/assemble.mjs --wait`，最多等待 15 分钟。单独绘制包装图可用 `node scripts/assemble.mjs --prepare`，该操作不生成视频。需要 FFmpeg、FFprobe、Python、Pillow 与中文字体；默认使用 Windows 微软雅黑，可用 `CJK_FONT_PATH` 更换字体路径。

`shifts.json` 使用秒为单位，例如：

```json
{"A01":0.2,"A02":0,"B01":-0.1,"B02":0}
```

正值让画面提前，意味着多裁掉源片开头；负值让画面延后，以源片第一帧定格补入开头。源片剩余长度不足句槽时，末帧定格补齐。配音和伴奏时间轴保持固定，原视频音轨不进入成片。片头后四句的句槽依次为 2.4–7.2、7.2–12、12–16.8、16.8–21.6 秒；片尾到 24 秒。

`retimes.json` 可为单个镜头配置从源时间到目标时间的 `control_points`。启用后按段 `trim/setpts` 映射画面，不允许再叠加非零 shift。每段先保留在 100 fps 内部时间网格上，拼接后整体转换为 25 fps 句槽，最终全片输出 24 fps，避免 0.45/0.41 秒等分段被逐段舍入后累计漂移。报告仍引用原始视频路径和 SHA-256，并记录真实源出点与控制点，不将变速中间文件冒充原片。

当前 A02 使用「声学活动分组启发式，非逐词ASR/非口型证明」。这只尝试收拢口形活动区间，原片音轨筛查失败仍保留；不能拿回填参考音频后的音轨一致性证明口型通过。单句候选与限制见 [A02-RETIME.md](A02-RETIME.md)。

字幕使用 `heard_start` 到 `heard_end + 0.15`，限制在本句句槽内。画面左上标记说话角色，右上标记「AI 生成 · 娱乐演绎」，字幕置于底部，不覆盖参考构图中的嘴部。透明包装图单独保存在 `work/overlays`，不改动参考图本体。

输出：

- `final/libai-dufu-sample-v1.mp4`：1280×720、24 fps、H.264、AAC 192 kbps、48 kHz、总长 24 秒。
- `work/assembly-report.json`：每镜头源入点、源出点、首尾补帧秒数、输入哈希、输出参数、时长与验证结果。

只有片段真实到位、渲染成功并通过输出参数检查后，报告才会标记 `completed`。报告不代表歌词正确、角色一致或口型自然，这些必须结合真实视频和配音观看确认。重新调整 `shifts.json` 后可重跑组装，不会新增任何生成服务调用。

# 节奏预演

`final/libai-dufu-rhythm-preview-v1.mp4` 是 24 秒的节奏预演，画面采用三张已有参考静态图：片头片尾为双人舞台图，四句主段分别使用李白、杜甫的单人图，配以轻微推近和平移。视频的片头和全程角标均明确写有「节奏预演 · 静态图运镜 / 尚未生成口型」。

声音使用已成功生成并锁定的四句 MiniMax TTS 和本项目原创 100 BPM 合成伴奏。字幕从真实音频检测边界生成。此预演可以检查两位角色的声音区分、句子长度、节拍、切镜与字幕节奏，不能用来评价口型或人物动作。

本轮 H3 请求未获账号套餐支持，因此没有获得真实视频片段。预演不是 H3 视频，也没有口部运动或音画口型同步。真实视频组装器 `scripts/assemble.mjs` 仍要求四条真实生成片段到齐，不接受这些静态图主段。

运行：

```powershell
node scripts/preview.mjs
```

脚本独立读取参考图、`work/music_final.wav`、`lines.json`、`grid.json`，不会更改原音，不调用付费服务。中文透明包装图保存在 `work/preview-overlays`。成片包含 H.264 视频与 AAC 音频，1280×720、24 fps、576 帧、24.000 秒，已启用网页逐步播放所需的 faststart。

实际输出参数、输入与输出 SHA-256、使用方法及限制见 `work/preview-report.json`。片头、李白与杜甫的成片截图分别为 `final/preview-intro.jpg`、`preview-libai.jpg`、`preview-dufu.jpg`，已检查中文字形、标签和字幕位置。

# 第二版完整成片接口

本目录负责将重新生成的表演镜头组装成一部完整短片。四句原词必须全部有真实新视频，缺任一句即停止。当前计划用两条约10秒的原片，每条分别表演同一角色的两句，再映射四个独立歌词画面；同词重唱可以再次取用相同原片区间。报告会区分“生成原片数量”“独立歌词画面数量”和“演唱出现次数”，不会将本地切分或复用当成额外生成任务。器乐段使用本次原创人物或舞台图的缓慢程序运镜，持续显示“原创图像 · 程序运镜”，不会冒充视频模型生成的人物表演。

第一版的原片、预演视频、模型请求与音轨筛查结果不会被覆盖。第二版也不能把第一版原片复制后冒充重新定制，合成器会比较两版原片的SHA并拒绝重复输入。

## 输入约定

用户已提供真实歌曲`music/source-jing-feng-shuang.mp3`。解码约63.26858秒，长度按实测保留。基于用户确认的四句原词和ASR辅助边界，新剪辑计划保存在`work/timeline-edit-plan.json`，状态为`pending-video-review`；两个10秒H3任务已提交，尚待真实视频返回与人工复核，未写正式时间轴或成片。`work/timeline-plan.json`仍只保存最初28.8秒、100 BPM的目标草案，不是这首歌曲的实测时间表，不能直接用于合成。

用户提供真实音乐后，核查实际歌曲时长和歌词落点，再在`work/timeline.json`提供以下结构并设置`status:"confirmed"`。以下24秒版本仅说明接口，不代表采用该长度、不代表已生成或已完成。

```json
{
  "schema_version": 1,
  "experiment_id": "002-moon-and-earth",
  "status": "confirmed",
  "title": "月光与人间 · 李白 × 杜甫",
  "subtitle": "四句交锋 · 原创 AI 娱乐演绎",
  "duration": 24,
  "fps": 25,
  "size": { "width": 1280, "height": 720 },
  "poster": "refs/moon-and-earth-stage.png",
  "audio": {
    "path": "work/music_final.wav",
    "kind": "rhythmized-tts",
    "provider": "MiniMax TTS 人声＋代码编排原创伴奏"
  },
  "intro": { "duration": 2.4, "title": "月光与人间", "subtitle": "李白 × 杜甫 · 四句交锋" },
  "outro": { "duration": 2.4, "title": "月光入诗，人间回响。", "subtitle": "原创歌词 · 合成声音 · AI 画面" },
  "qa_reports": ["work/video-qa.json"],
  "lines": [
    { "id": "A01", "actor": "李白", "text": "酒杯一举，银河都来捧场", "start": 2.4, "end": 7.2, "heard_start": 2.862, "heard_end": 4.783, "clip": "clips/A-block_t1.mp4", "source_in": 0, "qa_id": "A-block", "name_subtitle": "自由月光 / ROUND 01", "color": "#F0CF8D" },
    { "id": "A02", "actor": "李白", "text": "你的工整，装不下我的月光", "start": 7.2, "end": 12, "heard_start": 7.655, "heard_end": 9.638, "clip": "clips/A-block_t1.mp4", "source_in": 4.8, "qa_id": "A-block", "name_subtitle": "自由月光 / ROUND 01", "color": "#F0CF8D" },
    { "id": "B01", "actor": "杜甫", "text": "月光再亮，也得照见风霜", "start": 12, "end": 16.8, "heard_start": 12.459, "heard_end": 14.316, "clip": "clips/B-block_t1.mp4", "source_in": 0, "qa_id": "B-block", "name_subtitle": "人间回响 / ROUND 02", "color": "#8DD6DF" },
    { "id": "B02", "actor": "杜甫", "text": "我把人间，写成压轴的回响", "start": 16.8, "end": 21.6, "heard_start": 17.269, "heard_end": 19.241, "clip": "clips/B-block_t1.mp4", "source_in": 4.8, "qa_id": "B-block", "name_subtitle": "人间回响 / ROUND 02", "color": "#8DD6DF" }
  ]
}
```

时间轴允许24–120秒、24或25fps、16:9且至少720p。默认建议25fps：4.8秒句槽恰好120帧，24秒整片600帧。若使用24fps，所有句槽先在100fps内时间轴拼接，再统一转为24fps；字幕按照完整时间轴计算，避免各段分别舍入累积漂移。

视频必须来自本实验的`clips`目录。可以使用四条单句原片，或使用`A-block_t1.mp4`与`B-block_t1.mp4`两条双句原片，并分别指定`source_in:0`和`source_in:4.8`。`source_in`是原片中的绝对取用起点，不是整个成片的起点。

至少需要两条SHA不同的独立新原片，且不能等于第一版原片；每条至少720p且有有效视频流。同一原片的同一区间只能为同一条canonical歌词再次出现而复用，不能重复一段动作冒充不同歌词，也不能复制同一文件冒充额外生成任务。短于句槽的尾帧补齐与开头定格合计默认最多0.25秒，不能用长时间静图填补缺失表演。

`heard_start/heard_end`是完整时间轴中的实际可听歌词时间，而不是单句文件的局部时间。字幕在实际人声开始时出现，结束后延长最多0.15秒，且不越过镜头。

统一音轨必须完整保留。脚本以实际解码的48kHz立体声样本数测量音乐长度，不自动裁歌、不改变原音频速度；若歌曲不能整除视频帧，只能将视频时长向上对齐到下一完整帧，并在歌曲结束后补最多一帧静音。补静音时长和原始解码样本数会写入`audio.alignment`。例如实际约63.2686秒的歌曲在25fps下可对齐至63.28秒，末尾约补0.0114秒静音，而不能裁成28.8秒。

收到真实歌曲后，应先核查完整歌曲长度及每句实际位置，再据此确定时间轴与镜头长度。`audio.kind`需据实区分`rhythmized-tts`（配音与代码伴奏）、`generated-song`（已核验的歌曲模型输出）或`user-supplied-song`（用户提供歌曲，本片来源）。用户自述Gemini生成的说法与已核验的模型调用记录分开标注。最终不直接拼接各视频原生声音，避免重复制乐、底噪或声线漂移。

`audio.gain_db`支持-12至0dB的恒定音量调整，默认0；当前待审计划为-1.5dB，用于保留重新编码的峰值余量。该调整不裁切、不变速，也不修改用户MP3原文件。报告在`inputs.audio`与`audio`中保存实际gain值。用于时长计数的s16解码不构成峰值或无削波证明；原音和最终AAC的电平必须另用浮点解码核验。

## 完整歌曲与重复演唱的视觉时间表

在正式`timeline.json`中提供`visual_timeline`数组，可支持四句之间的器乐、较长前奏尾奏，以及末尾同词重唱。每一段的`start/end`是完整成片秒数；全部段必须按顺序连续覆盖从0到`duration`，不允许缺画面、重叠或空洞。视觉切点取到0.01秒，实际听见的字幕时间可以更精细。

`lines`继续保存四句canonical原词及其首次出现的时间，依次为A01、A02、B01、B02；四句仅要求有序且互不重叠，不要求相邻。视觉表有两种段落：

| 类型 | 必填字段 | 表现与限制 |
| --- | --- | --- |
| `performance` | `id`、`line_id`、`start`、`end`、`heard_start`、`heard_end` | 真实新视频表演；`line_id`引用四句原词，可沿用canonical的`clip/source_in/retime/qa_id`，也可明确覆盖这些取用参数。 |
| `instrumental_art_motion` | `id`、`start`、`end`、`image` | 原创图程序运镜；`image`指向本实验内的原创人物或舞台图；`motion`为`slow-push`或`slow-pull`，默认前者。画面持续标明图像运镜属性。 |

所有视觉段的`id`必须唯一。每句首次出现必须与`lines`中的首次时间一致，且顺序仍为A01、A02、B01、B02。歌曲若再次唱B02，新增另一条唯一ID的`performance`并设置`line_id:"B02"`，登记这次真实听见的时间；字幕和名牌会随每次出现单独渲染。可以设置`expected_performance_occurrences:5`，确保经核查的五次演唱全部有镜头，漏一次就停止。

同词重唱可以复用同一生成原片的完全相同取用区间。如果两次唱长不同，分别提供明确的`retime.control_points`，将同一源区间映射到不同目标长度。不同歌词的原片取用区间必须互不重叠。该复用会据实记录为两次演唱出现，不增加独立原片数或独立歌词画面数。

`intro/outro`在提供视觉表时只控制片头片尾文字的显示时长；对应画面来自视觉表，不会额外插入画面或更改歌曲长度。不提供视觉表时，仍兼容旧的“前奏图＋连续四句表演＋尾奏图”接口。

报告`assembly`会分别给出`source_clips`、`unique_lyric_shots`、`performance_occurrences`和`instrumental_art_motion`（段数、总秒数、`is_model_performance:false`）。`visual_timeline`记录每次视觉出现的类型、原图/原片SHA和取用位置，`subtitles`也保留同词重唱的单独时间，不会省略或合并。

## 声画修正与质量记录

每句可选`advance_seconds`：正值裁掉原片开头，负值在原片前补第一帧。默认0，不凭音轨相关性盲目修口型。

若输出音频发生不均匀拉长，可为该句提供`retime: { "control_points": [[0,0],[...,...],[源取用段长度,句槽时长]], "reason": "实际判断依据" }`。每对`[source_elapsed,target_elapsed]`都是局部相对秒数：源秒数相对于该段`source_in`裁入之后的起点，目标秒数相对于该段在整片的`start`。它们不是整条原片或整片的绝对秒数。控制点须严格递增，目标边界精确到0.01秒；不能同时设置非零`advance_seconds`。该功能只修改画面速度，不重写原片、不修改统一混音、不把原始QA失败改成通过。

例如当前B02重唱待审计划从原片绝对5.4秒开始，控制点`[[0,0],[0.1,0.4],[3.76,4.4],[4.6,5.2]]`对应原片绝对`[5.4,5.5,9.16,10]`秒，映射到成片`[51.2,51.6,55.6,56.4]`秒。它只把约3.66秒主唱画面映射到4秒重唱声段，仍需见片复核，不是精确口型证明。

`qa_reports`指向本实验内的JSON，支持`clips.A01`等条目。双句原片可在行内设置`qa_id:"A-block"`，引用同一份完整原片的筛查记录；若另有逐句记录，可继续按A01等ID引用。已登记`video_sha256`时必须和当前原片一致。所有真实筛查结果（包括`audio_match:false`、负相关或“待人工复核”）原样放入最终报告。没有筛查记录会登记`not_run`，不会自动标为通过。自动筛查只是音轨或格式检查，不是逐音素口型证明。

## 运行和输出

```text
node scripts/assemble.mjs --prepare
node scripts/assemble.mjs --check
node scripts/assemble.mjs
```

`--prepare`只绘制中文名牌、字幕与AI说明的透明图层；`--check`只核查真实输入；无参数时才合成。缺素材或任何校验失败时退出码为2，具体原因记录在`work/final-report.json`，不会用静态预演替代正式视频。

成功时输出`final/moon-and-earth-v2.mp4`。成片为H.264、AAC 48kHz立体声；最终还会核查时长、分辨率、帧率、准确总帧数、音轨格式、至少两条独立新原片和四句完整映射。通过后才将临时视频改名为正式成片。

`work/final-report.json`记录时间轴、舞台图、统一音轨与每条原片的SHA，源分辨率、裁取范围、定格与重定时、原始QA、字幕时间、最终文件SHA及检查结果。它是本地制作证据，不会自动发布或替换网页，也不会触发任何付费生成请求。

依赖：Node.js 22、FFmpeg/ffprobe、Python、Pillow和中文字体。可用`FFMPEG_PATH`、`FFPROBE_PATH`、`PYTHON_PATH`、`CJK_FONT_PATH`指定现有程序或字体路径。

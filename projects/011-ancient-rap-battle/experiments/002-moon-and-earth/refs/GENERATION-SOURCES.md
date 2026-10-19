# 第二版人物与舞台生成记录

2026-10-15 使用内置 ImageGen，先新生成共同舞台，再分别从同一参考图编辑单人表演参考。不是从001酒馆人物图改色，也未使用上游图片、现实演员照片或人物训练。三张最终PNG已原字节复制进本实验，原始工具输出保留。

| 文件 | 用途 | SHA-256 |
| --- | --- | --- |
| `moon-and-earth-stage.png` | 月下屋顶共同舞台、封面和片头尾参考 | `807a064b780e0c12007e1e3469daad2e33eb004b2bafad247799bb4529f14d05` |
| `libai-v2.png` | 李白单人表演参考 | `3a4b6abcd7608beb02fb1bba82f6e0830237d11825a5f00404aae41e2ded9537` |
| `dufu-v2.png` | 杜甫单人表演参考 | `6bbd53c6ff1ed518c2c9a4536b1a9c068139aba21e134be5160328c3b87ad9d1` |

目视检查：共同舞台两位角色可区分，年轻李白为白袍青绿肩饰与高马尾，杜甫为深蓝铜金纹袍与短须；单人图只保留各自角色，服装、发型和脸部特征与共同图一致，麦克风位于嘴部下方，无文字与水印。参考图约束不等于视频逐帧身份锁定。第二版人物视频进度独立登记于`work/chatart-tasks.json`。

原始输出目录：`D:/codex/home/generated_images/01a13e1a-2f68-7943-b2a8-2e9c80fa7a78/`。

## 共同舞台：全新生成

原始文件：`exec-d1b7df6a-8178-4a5d-888c-20fe92d34a39.png`。`transparent_background=false`，无输入参考图。

```text
Use case: stylized-concept. Asset type: original character-and-stage reference artwork for a Chinese poetry rap short film titled 月光与人间. Generate a new polished 16:9 cinematic stylized 3D animated-film frame, not a photograph. Exactly TWO original fictional Chinese Tang-era male poet performers, recognizable as two distinct characters without resembling actors or celebrities. On the LEFT, Li Bai inspired poet: around 30, long angular face, clear bright eyes, clean-shaven, high black ponytail with a narrow silver ornament, flowing ivory-white robe with rich jade-teal shoulder panels, subtle silver cloud embroidery, jade sash. Airy confident romantic temperament. On the RIGHT, Du Fu inspired poet: around 45, broader square face, thick straight eyebrows, short neatly trimmed dark moustache and chin beard, black hair in a practical low topknot, deep ink-blue robe with muted copper-gold edging and woven geometric details, warm rust inner collar. Grounded resolute temperament. They stand separated on the SAME Tang-style rooftop performance terrace at night, facing mostly toward camera with a subtle glance toward each other. Both carry one simple bronze-and-dark-metal handheld microphone at chest level, well BELOW the chin; their entire mouths are unobstructed. Medium-wide waist-up two-shot, equally large faces, enough separation that each character can later be used as an identity reference. Moonlit ancient city rooftops behind them, a single large luminous full moon in the upper center, a few warm red-gold lanterns, dark indigo sky, subtle haze, jade-teal moonlight from left and warm amber practical light from right. Premium Chinese animated-film design, sculpted stylized faces, believable cloth, sophisticated restrained color, beautiful cinematic lighting, readable silhouettes, coherent shared space. No modern crowd, no DJ, no extra people, no instruments, no alcohol, no subtitles, no letters, no logos, no watermark. Preserve a calm stage rather than an action scene. This is an entertainment interpretation, not a reconstruction of historical appearances.
```

## 李白单人：保留身份编辑

原始文件：`exec-e065d056-c925-4cca-8bfb-0bc403085cb0.png`。输入为本实验`refs/moon-and-earth-stage.png`，`transparent_background=false`。

```text
Use case: identity-preserve. Edit the reference artwork into a single-character performance reference of ONLY THE LEFT YOUNG POET. Keep his EXACT original stylized 3D animated-film face, clean-shaven angular jaw, bright eyes, black high ponytail and silver ornament, ivory-white robe, jade-teal shoulder panels and silver cloud embroidery. Remove the entire right older man. Reframe as a centered medium close-up from mid-chest to above the head, both shoulders visible, head nearly frontal and slight glance toward camera-right. Keep the same moonlit Tang rooftop terrace, distant city lanterns, cool indigo sky and full moon glow in softly blurred background. Keep one bronze/dark-metal handheld microphone at low chest level, BELOW the chin; entire lips and jaw clearly visible. Natural relaxed closed-mouth expression, no dramatic arm reach, restrained confident posture. Preserve the refined original animated-film style, lighting and face identity; do not turn him into a photo or a different person. Exactly one man, no second face, no letters, subtitles, words, logos or watermark. Wide 16:9 cinematic composition.
```

## 杜甫单人：保留身份编辑

原始文件：`exec-2c7b5718-d643-4747-a650-854e2124dcf3.png`。输入为同一共同舞台图，`transparent_background=false`。

```text
Use case: identity-preserve. Edit the reference artwork into a single-character performance reference of ONLY THE RIGHT OLDER POET. Keep his EXACT original stylized 3D animated-film face, square mature jaw, thick straight eyebrows, short dark moustache and chin beard, practical black topknot with simple hairpin, ink-blue robe with copper-gold woven edging and warm rust inner collar. Remove the entire left young man. Reframe as a centered medium close-up from mid-chest to above the head, both shoulders visible, head nearly frontal and slight glance toward camera-left. Keep the same moonlit Tang rooftop terrace, distant city lanterns, cool indigo sky and warm amber practical light in softly blurred background. Keep one bronze/dark-metal handheld microphone at low chest level BELOW the chin, entire lips and beard clearly visible. Composed resolute relaxed closed-mouth expression, natural restrained posture. Preserve the refined original animated-film style, lighting and face identity; do not turn him into a photo or a different person. Exactly one man, no second face, no letters, subtitles, words, logos or watermark. Wide 16:9 cinematic composition.
```

## 完整歌曲新增空镜

收到用户的63秒歌曲后，新增两张同世界的场景图，用于非歌词段落的程序缓慢运镜。它们是静态原创图，不是视频模型生成的空镜，不会作为人物开口演唱的替代。两次均使用内置ImageGen、共同舞台为风格与环境参考、`transparent_background=false`。

| 文件 | 原始工具文件 | SHA-256 |
| --- | --- | --- |
| `moonlit-city-v2.png` | `exec-04e8274a-63f3-4c28-a90e-7e7ab9ae8fc1.png` | `c77d01d875aacc18ab83a3be9981d55619d8ec15da661abe3412b523548a58ca` |
| `frost-and-poetry-v2.png` | `exec-35215cb7-2ee1-474b-bbeb-d2d6bde2241d.png` | `6bc6e3d249b449b953ce91f3cad3233dd29fa0538e4fed6b8e438ea07c766c13` |

检查：均为宽幅月夜场景，无人物、文字或水印；第二张卷轴保持空白，霜、木桌、笔与青铜杯可辨。原图保留在上面的工具输出目录，项目中保存原字节副本。

### 月下城景完整提示词

```text
Use case: stylized-concept. Asset type: original instrumental interlude background for the Chinese poetry music film 敬风霜. Input image is a STYLE AND ENVIRONMENT reference only; do not copy the people. Generate a polished wide 16:9 cinematic Chinese 3D animated-film establishing frame of the same moonlit Tang-style riverside city seen behind the performers. NO PEOPLE. A rooftop terrace edge in the lower foreground, elegant layered curved tiled roofs stepping down toward the river, one large luminous full moon reflected on the dark water, tiny warm amber and red lanterns, distant bridge and pagoda, subtle indigo mist, refined jade-teal moonlight with restrained gold accents. Contemplative poetic atmosphere, beautiful depth and clear forms, physically believable cloth-free architecture, high-quality animated feature-film environment rather than photograph. Compose for a very slow camera push in postproduction; keep upper and lower center spacious enough for a small film title. No text, letters, logos, watermark, performers, microphones or modern objects.
```

### 风霜与诗完整提示词

```text
Use case: stylized-concept. Asset type: original visual bridge for the instrumental section of Chinese poetry music film 敬风霜. Reference image supplies the moonlit Tang rooftop world and cinematic 3D animated-film style only. Create a beautiful wide 16:9 close establishing composition on a weathered dark wooden writing table beside the terrace: a small plain bronze cup, a traditional brush resting over an open but COMPLETELY BLANK cream scroll, delicate pale frost along the tabletop edge. A few soft red-gold lanterns and the indigo ancient riverside city blur gently in the background. Cold silver moonlight and warm amber lantern light balance each other. This should evoke poetry, moonlight and worldly hardship with elegant restrained detail, premium animated feature-film lighting and tactile wood, paper and bronze. NO person, face, hands, microphones, modern objects or supernatural effects. Keep central area calm and visually legible for a gentle postproduction camera pull. NO writing, characters, letters, symbols, logo or watermark anywhere.
```

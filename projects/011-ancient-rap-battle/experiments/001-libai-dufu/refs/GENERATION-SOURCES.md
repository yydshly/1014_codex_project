# 原创舞台与单人角色参考图来源

## 共同舞台 poets-stage-v1.png

工具：内置`image_gen.imagegen`，2026-10-15新生成。默认输出`D:/codex/home/generated_images/01a13e1a-2f68-7943-b2a8-2e9c80fa7a78/exec-692aa214-b8af-4d48-9feb-7179eb4891ea.png`，本地保留原字节。设计简述（非逐字提示词副本）：横向电影感唐风木质酒馆舞台，暖灯笼和冷色轮廓光，两位原创男性诗人角色持麦克风对峙；左侧李白为白衣青襟、束长发与细髭，右侧杜甫为褐衣赭襟、深色头巾和胡须。无文字、标识或水印。没有使用上游人物图作为参考。

该图同时用于共同风格基准和节奏预演的片头/片尾；两张单人图分别从同一原图经编辑生成。

## 单人参考图

生成日期：2026-10-15。工具：内置 `image_gen.imagegen`，编辑模式 `identity-preserve`；两次均从共同原图 `poets-stage-v1.png` 分别生成，没有从另一张派生人像二次修改。

用途：H3 人物身份与造型参考，降低双人同时张嘴的风险。人物为原创 AI 历史角色演绎；不表示历史人物真实相貌或服饰考据。共同原图与工具默认输出均保留。没有使用裁图程序替代图像生成。

## 李白 libai-v1.png

- 输入：`poets-stage-v1.png` 左侧人物。
- 默认输出：`D:/codex/home/generated_images/01a13e46-5a83-7631-b60b-0669a5ccfe3c/exec-10280a48-3d41-458b-88a2-396554bb868b.png`
- 视觉核查：仅一人，脸型、长发与白衣青绿色襟带和共同原图一致；保留木质舞台、暖红灯笼与冷顶光；双眼、嘴唇和下颌可见；麦克风低于下唇，无嘴部遮挡；无文字/水印。半身构图到腰部，横向16:9。

```text
Use case: identity-preserve.
Asset type: single-character identity reference for a Chinese rap-battle video.
Input image: the supplied original two-person stage image is the edit target. Extract and recompose ONLY the LEFT man as a standalone portrait. He is our fictional Li Bai interpretation: young adult Chinese man, long partially tied black hair, narrow moustache and pointed goatee, confident expression, ivory-white textured Tang-inspired robe with muted blue-green collar/sash and dark teal belt.
Primary request: create one photorealistic, cinematic waist-up/half-body close portrait of this EXACT LEFT man alone in the SAME warm red lantern timber tavern performance stage, with the same cool overhead light and amber rim lighting. Keep his face, hair, facial hair, robe colors/materials and overall appearance faithful to the original. He faces almost front, head slightly angled toward camera, calm closed lips, mouth and jaw clearly visible. He holds the same wired handheld microphone at CHEST height, microphone head safely well below the lower lip, no hand or microphone overlapping mouth or chin. Both eyes visible.
Composition: horizontal 16:9 image, subject centered, full head with comfortable headroom, visible shoulders to just below belt. Background softly defocused, retaining the original wood architecture, red lanterns and subtle stage haze. ONLY ONE person visible, no other face, no crowd silhouettes, no right-hand man.
Constraints: preserve left man's identity and costume; no text, no logos, no watermark, no border. Do not replace him with a different person. Do not make a split-screen or collage. Maintain natural photorealistic anatomy and hands.
```

## 杜甫 dufu-v1.png

- 输入：`poets-stage-v1.png` 右侧人物。
- 默认输出：`D:/codex/home/generated_images/01a13e46-5a83-7631-b60b-0669a5ccfe3c/exec-f1867dca-d7ba-41ba-9bd7-b860090578f7.png`
- 视觉核查：仅一人，成熟脸型、黑色头巾、长须、深褐与赭色袍服和共同原图一致；同一木质舞台与冷暖灯光；双眼和嘴部轮廓可见；麦克风在胸前，无下唇遮挡；无文字/水印。长胡须为角色既有造型，实际口型可读性仍须视频小样验证。半身构图到腰部，横向16:9。

```text
Use case: identity-preserve.
Asset type: single-character identity reference for a Chinese rap-battle video.
Input image: the supplied original TWO-PERSON stage image is the edit target. Extract and recompose ONLY the RIGHT man as a standalone portrait. He is our fictional Du Fu interpretation: mature Chinese man, black cloth scholar cap and tied back hair, strong eyebrows, moustache and long salt-and-pepper beard, composed serious expression, textured dark brown outer robe with ochre-brown lapels and inner garment, dark brown cloth belt.
Primary request: create one photorealistic, cinematic waist-up/half-body close portrait of this EXACT RIGHT man alone in the SAME warm red lantern timber tavern performance stage, with the same cool overhead light and amber rim lighting. Keep his face, hair, beard, scholar cap, robe colors/materials and overall appearance faithful to the original. He faces almost front, head slightly angled toward camera, calm closed lips, mouth and jaw clearly visible above the beard. He holds the same wired handheld microphone at CHEST height, microphone head safely well below the lower lip, no hand or microphone overlapping mouth or chin. Both eyes visible.
Composition: horizontal 16:9 image, subject centered, full cap and head with comfortable headroom, visible shoulders to just below belt. Background softly defocused, retaining the original wood architecture, red lanterns and subtle stage haze. ONLY ONE person visible, no other face, no crowd silhouettes, no left-hand man.
Constraints: preserve right man's identity and costume; no text, no logos, no watermark, no border. Do not replace him with a different person. Do not make a split-screen or collage. Maintain natural photorealistic anatomy and hands.
```


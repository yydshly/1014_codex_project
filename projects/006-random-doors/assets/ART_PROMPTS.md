# 0.5.0 场景原画与提示词

2026-10-15 使用 **内置 ImageGen** 生成，未使用 CLI 或外部素材站。成品位于 [`web/public/art/`](../web/public/art/)，共 14 张 WebP，约 2.97 MB。图片在制作阶段生成，浏览器运行时不调用模型。

环境画用于表现空间、材质与氛围；人物身份、信件内容、雨、船灯、纸飞机和谜题反馈由原型中的独立图层与状态决定。主入口是二维原画与交互叠层，不是实时三维场景；原先 Three.js 候车亭仍在独立入口保留。

原始 PNG 的生成 ID 与编码映射保存在 [`scripts/prepare_art.py`](../scripts/prepare_art.py)。编码仅缩小人物图和透明手臂、转换 WebP，没有重新绘画或裁切。所有被页面引用的成品均已存入仓库。人物为虚构角色，未使用真实人物参考图片。

| 成品文件（均在 `web/public/art/`） | 用途 | 尺寸 |
| --- | --- | --- |
| `threshold.webp` | 夜色草地上的未知木门 | 1536 × 1024 |
| `seaside.webp` | 海边候车亭环境 | 1536 × 1024 |
| `rooftop.webp` | 风过的天台环境 | 1536 × 1024 |
| `postoffice.webp` | 打烊前的邮局环境 | 1536 × 1024 |
| `repair.webp` | 老街修补铺环境 | 1536 × 1024 |
| `greenhouse.webp` | 漂浮温室环境 | 1536 × 1024 |
| `observatory.webp` | 旧星图观测台环境 | 1536 × 1024 |
| `person-departure.webp` | 小屿，第一次离乡 | 640 × 640 |
| `person-homecoming.webp` | 阿岚，准备回家的厨师 | 640 × 640 |
| `person-apology.webp` | 小满，想向姐姐道歉的男学生 | 640 × 640 |
| `person-thanks.webp` | 周老师，想感谢老门卫的女教师 | 640 × 640 |
| `person-reconnect.webp` | 阿禾，想重新联系老朋友的花店店主 | 640 × 640 |
| `person-beginning.webp` | 林姨，退休后学画 | 640 × 640 |
| `rain-hand.webp` | 伸手接雨的前景，保留 alpha | 800 × 800 |

## 最终提示词集

下列公共前缀与对应场景/人物段落拼接即为最终生成提示词。候选中人物性别与既有文案不符的两张未被采用，最终小满与周老师使用修正后的单独提示词。

### 入口与四处环境的公共前缀

```text
Use case: illustration-story. Asset: full-bleed environment background for an interactive Chinese narrative game. Premium hand-painted animation-film background art, delicate gouache and oil brush texture, sophisticated cinematic composition and light, richly observed materials and small lived-in details, natural atmospheric depth. Beautiful and immersive, never flat vector art, never low-poly, never a UI screenshot. Landscape 1536x1024. No text, lettering, logo, border or watermark. No people. Palette: deep petrol blue, sage, warm amber highlights and subtle rose.
```

`threshold`：

```text
Scene: a solitary antique dark wooden door standing upright in a windswept field of silver grass under a vast midnight blue sky, distant hazy hills, a few soft fireflies. The door is slightly ajar, an inviting golden light pours from the narrow opening onto a mossy stone path. Door occupies the right-center third from 22% to 90% height; its upper arch and handle are clearly visible, believable worn wood and brass. Keep the left third dark and quiet for overlaid title. Poetic, mysterious, hopeful. Cinematic wide view, quiet magical realism, beautifully lit grass in foreground.
```

`rooftop`：

```text
Scene: a cozy old coastal town rooftop at blue hour, seen from one end of a terracotta tiled terrace. A simple wooden bench and potted herbs in foreground, rooftop parapet, a clothesline of small blank cream paper tags crosses the upper image, a small hanging glass wind chime near upper right. Layers of real old tiled roofs, balconies, warm windows and distant hazy sea. Huge soft dusk sky occupies upper half. Intimate and inviting, violet and dusky apricot sky, blue shadows, tiny amber window lights. The chime, tags and plants are carefully painted and tactile; their animated overlays will be added in code.
```

海边、邮局与修补铺调用的公共前缀中，材质句补充为 `with highly detailed realistic materials`，末尾调色板为 `deep petrol blue, sage, warm amber highlights`。

`seaside`：

```text
Scene: view from inside an old tiny wooden bus shelter right beside a quiet sea in light rain at blue hour. A weathered wooden bench across lower left foreground, two slim wooden posts frame edges, corrugated canopy along the top. Open panoramic view toward a misty sea and distant island headland, sea horizon at 48 percent height, the center and right sea must remain empty for an animated little boat. Rain-wet concrete reflecting soft warm overhead shelter light. A few grasses beside the shelter. A cozy dry refuge facing a vast sea. Dusk peach glow behind layered blue clouds. No boats, no birds, no hands. Rain itself will be animated in code.
```

`postoffice`：

```text
Scene: intimate little old town post office just before closing, warm brass desk lamp lighting an oak service counter in the lower third, paper envelopes, ink pad, fountain pen and a blank postcard under the lamp. Behind counter beautiful wooden pigeonhole mail shelves with many letters, a few twine parcels, a vintage wall clock, open door to a rainy cobblestone street in deep indigo dusk. Dark crimson canvas mail bag and a red postal slot at right lower middle. View from customer side, a place for a visitor at left. Rich wood grain, paper fibers, soft dust motes in lamp light, human warmth and gentle mystery. No humans and no readable letters or signs.
```

`repair`：

```text
Scene: tiny old street music-box repair workshop, warmly lit workbench fills lower third, a beautiful carved wooden bird music box sitting on the bench at lower center-left, little brass clockwork parts, tweezers, two small bells, tiny drawers and glass jars. Behind the desk shelves with old radios and clocks, plants in the window; window onto a blue rainy lane. Deep amber pool of lamplight and dusky teal shadows, tactile worn wood and gleaming brass, lovely handcrafted objects. A quiet place where beloved broken things are repaired. No people, no text.
```

### 温室与观测台的公共前缀

```text
Use case: illustration-story. Asset: full-bleed environment background for an interactive Chinese narrative game. Premium cinematic storybook realism, painterly atmospheric lighting, highly detailed tactile real materials, magical realism, beautiful lived-in details. Landscape 1536x1024. Deep petrol blue, sage, warm amber light. No text, logo, watermark, people, or UI.
```

`greenhouse`：

```text
Interior of an extraordinary antique glass conservatory floating above a sea of clouds at dawn, slender verdigris brass curved window ribs, abundant ferns and trailing plants around left and right edges, glowing apricot sun beyond glass, a central dark polished stone tabletop across lower half, wide empty space on tabletop for a light puzzle to be added later. Dew droplets, glass reflections, warm sun shafts. Keep center 65% uncluttered. No mirrors, no diagrams.
```

`observatory`：

```text
Inside an old domed astronomical observatory at midnight, open dome frames vast deep indigo sky with luminous Milky Way and stars. Antique brass telescope at far left edge, worn wood floor, low round brass star-chart table in center lower half, dark empty tabletop for luminous star rings added later. A warm small lamp at edge. Tranquil wonder, velvet blue and warm bronze, atmospheric depth. Keep central 65% dark and uncluttered. No diagrams or rings on table.
```

### 人物肖像公共前缀

```text
Use case: illustration-story. Asset: cinematic character portrait for an interactive story in a small old post office. A single fictional Chinese person, head and shoulders close portrait centered in square frame 1024x1024, facing slightly to our right as if talking to someone across a counter. Rich realistic painterly film still, warm amber brass desk lamp from lower right, deep blue rainy post office softly blurred behind, beautiful natural skin and tactile fabric. Quiet candid expression, unposed, intimate and humane. Match an old oak and brass post office in a coastal storybook town. No text, logo, UI, watermark or extra people. Subject:
```

小屿：

```text
a young man about 22, short black hair, tan canvas jacket over cream sweater, backpack strap on shoulder. His first journey away from home; thoughtful, a little hesitant, holding a cream postcard near chest.
```

阿岚：

```text
a woman about 32 who is a chef, short dark brown bob, muted terracotta work shirt and cream apron, warm thoughtful eyes, slight tired smile. She has worked far away for four years and is writing home before returning. Holding a cream postcard near chest.
```

阿禾与林姨的前缀中 `Subject:` 前还有 `Holding a cream postcard near chest.`。

阿禾：

```text
a woman florist about 29, softly tied up dark hair with a few loose strands, muted sage linen blouse and pale beige apron, small dried white flower pinned on apron. Slight tentative smile, wanting to reconnect with an old friend.
```

林姨：

```text
a woman about 62, softly curled short silver hair, terracotta shawl over warm cream knit cardigan, natural face with gentle wrinkles, lively kind eyes, optimistic small smile. Recently retired, she is learning painting and writing her old colleagues. A few subtle paint marks on fingers.
```

小满与周老师最终调用使用下列公共前缀：

```text
Use case: illustration-story. Square cinematic head-and-shoulders character portrait in a small antique oak and brass post office, realistic painterly film still, rich warm amber desk lamp light from right, deep blue rainy windows softly blurred behind. Natural textured skin, beautiful tactile fabric, intimate humane unposed expression. Centered figure facing slightly to our right across the counter. No text, logo, watermark, UI or extra people.
```

小满：

```text
A fictional young Chinese male student about 19, short straight black hair, muted dark sage cardigan over cream shirt, old camera strap at shoulder, holding a cream postcard in both hands. Shy regretful but hopeful expression, composing an apology to his sister.
```

周老师：

```text
A fictional Chinese woman teacher about 57, short softly waved salt and pepper hair, round thin wire glasses, muted charcoal and violet cardigan, holding a cream postcard. Gentle earnest grateful expression, thinking about thanking an old school gatekeeper before retirement.
```

### 透明接雨手臂（完整提示词）

```text
Use case: illustration-story. Asset: transparent foreground sprite for first-person interactive rainy seaside shelter scene. A single anatomically correct adult human right hand and forearm, palm facing upward to catch raindrops, fingers relaxed and gently cupped, five fingers, natural skin detail. Forearm enters diagonally from bottom right corner, hand reaches toward center left. Muted dark sage raincoat sleeve with soft fabric folds covers lower forearm. Warm amber rim light from upper left and soft cool blue sky fill. Rich realistic painterly cinematic game art, same visual language as a tactile old seaside shelter at blue hour. Crop only the sleeve at bottom-right, keep entire hand in frame. Actual transparent background, no scenery, no text, no other objects, no built-in rain. Square 1024x1024.
```

工具参数为 `transparent_background: true`，编码后检查 alpha 包含 0，未压平透明背景。

[返回素材索引](README.md) · [返回项目](../README.md)

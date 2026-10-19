# 古人说唱 Battle · 研究网页

中文静态网页，用于浏览上游能力、制作价值、实现原理、复现步骤与证据来源。页面交互在本地浏览器执行，不请求模型 API，也不调用 Suno、Midjourney、MiniMax 或其他付费生成服务。页面中的参数、路径和制作建议不代表已经运行过完整生成链路；具体核实状态见 [研究记录](../RESEARCH.md)。

## 本地预览

需要 Node.js 22 或更新版本；没有第三方依赖，无需执行 `npm install`。在本目录执行：

```powershell
npm run build
npm run check
npm run dev
```

`build` 将网页、配图、上游示例视频、来源登记与研究文档复制到本项目 `dist/`；任何必需文件缺失或 JSON 无效都会报错。`check` 验证 JavaScript 语法、静态资源、来源固定版本、MP4 文件签名，以及根路径和编号子路径的 HTTP 访问；视频通过首段、尾段和后缀字节范围验证，不重复下载整段视频。`dev` 重新构建并启动服务；已有构建时也可运行 `npm start`。

默认服务仅监听本机 `127.0.0.1:4184`：

- [根路径预览](http://127.0.0.1:4184/)
- [编号子路径预览](http://127.0.0.1:4184/1014_codex_project/011-ancient-rap-battle/)

按 `Ctrl+C` 停止服务。如端口已被其他项目占用，可先执行 `$env:ANCIENT_RAP_PORT = '4185'`，再启动，访问地址的端口随之改为 `4185`。

## 文件与构建产物

| 文件 | 用途 |
| --- | --- |
| `index.html`、`styles.css`、`app.js` | 页面内容、样式、歌词定位播放与本地交互 |
| `sample-report.mjs` | 浏览器、构建和HTTP检查共用的完整歌曲记录校验 |
| `stage-film-report.mjs` | 004普通视频完整舞台版的独立校验，不改旧精准口型试验结论 |
| `scripts/prepare-stage-film.mjs` | 对照004实际报告、源片、歌曲与预算SHA，将最终真实成片复制到网页 |
| `scripts/sync-stage-film.mjs` | 从真实编辑结果、原速整片浏览器证据与实际账本映射独立的004展示记录 |
| `public/data/004-stage-film.json` | 仅最终真实成片与审核通过后产生的独立舞台版记录；缺失时播放区隐藏 |
| `public/media/` | 已登记来源的配图及上游 `demo-github.mp4` 成片 |
| `public/history/001-*` | 首次三句过程版、四句完整基线、定妆图及各自原始记录；按固定 SHA-256 留档 |
| `public/history/002-*` | 第二版完整歌曲原片、封面与原始来源记录；按原字节及固定 SHA-256 留档 |
| `public/favicon.svg` | 本项目绘制的站点图标 |
| `scripts/build.mjs` | 复制确定的网页、图片、视频与研究材料，无需联网 |
| `scripts/check.mjs` | 语法、来源、资源、MP4 签名和本地 HTTP 范围检查 |
| `server.mjs` | GET/HEAD 静态预览；支持视频字节范围和拖动播放 |
| `dist/` | 可交给通用静态服务器的构建产物 |

构建后的 `docs/` 包含项目简介、研究记录和来源说明，`data/source-register.json` 包含来源登记，`licenses/UPSTREAM-MIT.txt` 保留上游许可原文。页面资源使用相对路径，可由 003 的通用目录服务读取，也可整体复制到站点的 `011-ancient-rap-battle/` 目录。

## 上游成片与下载校验

网页原生播放器读取本地 `media/demo-github.mp4`，视频随静态产物一起分发；这是固定提交中的上游原作，不是本项目调用付费服务生成的成果。原文件位于 `public/media/demo-github.mp4`，来源、大小及校验值见 [来源说明](../SOURCES.md) 和 `../data/source-register.json`。

重新下载时使用来源登记中固定提交的地址，先核对文件大小，再使用 `Get-FileHash public/media/demo-github.mp4 -Algorithm SHA256` 与登记的 SHA-256 比较；确认一致后重新构建。`check` 还会检查 MP4 的 `ftyp` 签名，避免把错误页当作视频。播放器支持暂停、音量、全屏及拖动进度；本地服务为有效单段请求返回 `206`、`Content-Range` 和 `Accept-Ranges: bytes`，无效范围返回 `416`，HEAD 只返回完整文件的响应头。

## 自制作品与历史基线

实验003舞台重剪版《敬风霜》已真实成片并接入本地网页主播放器：63.28秒、1280×720、25fps、1582帧、25,573,442字节，SHA-256为`011c49f6527f84ca834ac319ad14bb97dd4a410b75a37729b00bf025382970d6`。实际三件套状态以`public/data/own-sample-run.json`和[项目验证记录](../VERIFICATION.md)为准。沿用002两条真实原片映射四句歌词、五次演唱，表演取用24.6秒；新增四张舞台图，编排为十七段、38.68秒舞台运镜，共22个视觉段。全曲时长不视作独立生成表演量。

音乐为用户提供《敬风霜》，用户说明由Gemini生成，具体平台和模型未独立核验。约102 BPM明确标“估测”。整曲不裁切、不变速，原歌施恒定−1.5dB播放响度调整并补约0.011416667秒尾静音；开场、停拍与结尾另加少量本地合成掌声和空间声，非现场录音。主歌与重唱范围的氛围声严格静音。[003最终混音核验](../experiments/003-stage-edition/work/final-audio-verification.json)相对预期混音记录零偏移、全覆盖、相关性0.998536、浮点样本峰值−0.9149dBFS及未检出样本削波。音乐完整性不代表精准口型，浏览器实测另行记录。

003新增的是舞台场景、视角、场景切换和灯光，人物演唱沿用002两条原片，新增视频模型请求为0；002原片标价300钻石不是本轮新增消费，独立账单未核对。发布器[保存于003实验](../experiments/003-stage-edition/scripts/publish-stage.mjs)，已在真实成片、来源与检查全部通过后更新主播放器，[发布记录](../experiments/003-stage-edition/work/publish-report.json)为`published-local`。1582帧全解码完成、未检出黑场，16帧成片接触表人工接受舞台效果；浏览器实测统一见[项目验证记录](../VERIFICATION.md)。

实验002完整歌曲原版独立保留于历史区：同为63.28秒、1280×720、25fps、1582帧，18,110,087字节，SHA-256为`88c112607640aeaa960a4682aca4a533781d58b82e658af4ad2777fa1848871e`。该版使用002的五张人物和场景图、九段图像运镜，仅调整原歌音量，没有003新增氛围声；其[原曲核验](../experiments/002-moon-and-earth/work/final-audio-verification.json)与来源记录保持不变。

首次实验001的三句过程版为19.2秒，完整四句基线为24秒、24fps、576帧；两版都使用MiniMax TTS加代码合成100 BPM节拍。原片A01/B02音轨通过、A02/B01失败原样保留，A02画面按声学分组重定时，不宣称精准口型。该轮四任务网页标价285钻石、上限300、无重抽、总账单未核对，与002新歌两任务标价300分别记录。001两版留在历史区，不被主播放器更新覆盖。

页面从`public/data/own-sample-run.json`读取脱敏记录。`rhythm-preview`仅为四句静态预演；`partial-generated`允许1–3句真实已完成镜头；`completed`要求四句独立歌词具有真实生成表演。主播放器沿用稳定资源路径，标题、时长和实际制作范围读取记录，不把部分交付标成完整歌曲。

构建仅在视频、封面与相应状态记录三个文件通过校验后启用模块，并检查实际MP4/PNG字节的SHA与报告相等。新歌还必须通过源视频去重、逐次演唱、器乐段、完整视觉时间轴和整曲音轨的交叉检查，不能只把`status`改为`completed`。三句交付使用实验的`publish-demo.mjs`；001完整基线和002新作品各用独立合成/发布保护。首次实验详情见[实验说明](../experiments/001-libai-dufu/README.md)。网页播放不会新增模型请求。

首次三句成果另以原字节保存在 `public/history/001-three-line-demo.mp4`、`001-poets.png`、`001-run.json`，完整基线另用`001-full-four-line-demo.mp4`与`001-full-run.json`。第二版完整歌曲另存`002-jing-feng-shuang-v2.mp4`、`002-poets-v2.png`、`002-run.json`，视频SHA为`88c112607640aeaa960a4682aca4a533781d58b82e658af4ad2777fa1848871e`。网页折叠区可播放三版并看对应原始记录。构建和检查固定校验八个历史文件的SHA-256，后续更新主播放器时不得覆盖。001两版使用TTS加代码节拍；002使用用户提供歌曲，两次历史费用分别记录。

`003-stage-edition`舞台版沿用主播放器三个固定发布路径；[最终合成报告](../experiments/003-stage-edition/work/final-report.json)为completed，主视频、封面与脱敏记录经发布校验后同步，002三件套已先按原字节归档。实际报告须明确`production.music_provider`与`production.music_mode`：`minimax-song`表示实际调用MiniMax歌曲生成；`tts-code-beat`表示TTS人声加代码合成伴奏；`user-supplied-song`表示用户提供歌曲。三者在网页上分别说明；用户提供音乐时只显示记录中的实际来源，未确认平台就不得推测为MiniMax或Suno。不能把配音加节拍称为音乐模型生成的歌曲。

完整报告中四项`clips`表示四句独立歌词，不等于四次生成。每句`occurrences`记录每次演唱的完整镜头/可闻时间、出现编号和源视频SHA；同词重唱另列一次，网页提供相应定位播放按钮。`assembly.source_clips`按不同原片SHA计数，`unique_lyric_shots=4`表示四句独立歌词，`performance_occurrences`统计包括重唱的实际演唱次数，例如两条视频对应四句歌词、五次演唱。同词复用不算新增任务。

`source_files`与`visual_timeline`须交叉对应全部原片和演唱，视觉时间表从0连续覆盖整曲。器乐段注明`instrumental_art_motion`、图像SHA与`is_generated_video=false`，其秒数和段数须等于`assembly.instrumental_art_motion`统计；网页显示“原创图像 · 程序运镜”，不将全曲时长当作人物生成表演时长。

歌曲名取`production.music_title`，来源取`music_provider`；`bpm_is_estimate=true`时节拍标“估测”。`audio`记录统一原歌曲SHA、完整解码时长和`alignment`：不裁歌、不变速，仅允许末尾补不超过一帧静音；`gain_db`记录原歌播放响度调整。没有新增声音时页面说明“整曲保留，仅调整播放响度”，若存在批准的`audio.additions`则分别披露原歌和新增声效。未确认的生成平台/模型只作用户来源说明。

舞台版另要求`revision.kind=stage-reedit`，关联002原片SHA与四张实际使用的新场景图，并登记`new_video_generation_calls=0`及真实舞台改动。`source_files.source_experiment`指向002；`cost.new_video_credits_estimate=0`表示本轮无新增视频请求，`cost.reused_source_cost`单独保留002原视频网页标价300钻石及账单未核实状态，不重复计为本轮费用。`stage_ambience.enabled=true`时须登记批准状态、本地合成来源、SHA与实际增益，并用`audio.additions`单列新增声音；页面随之显示“原歌完整保留，开场、停拍与结尾补少量合成现场声”，同时说明非现场录音。

`video_service.created_tasks`只记录实际请求；ChatArt费用默认显示网页标价与额度，余额瞬时变化不作实际扣费证明。只有`invoice_verified=true`的实际消费才显示为已核对支出。

## 004舞台视觉样片：演唱口型未通过

用户验收反馈“口型一点不对应”，本版未达演唱目标。新增9条只提交图片与分镜提示，没有提交原曲音频驱动，现片为画面配回原曲。播放器上方明确标注未通过，不作为合格演唱成果；舞台与观众素材可复用，主角演唱须另外验证并重做。本次不新增生成，不使用MV或本地口型模型。

新播放区`#stage-film-004`独立于003主播放器，位于其之前；只有`public/data/004-stage-film.json`与视频、海报的真实字节、SHA全部一致且报告通过验证后，构建才启用。最终报告还须记录94.64秒、1280×720、25fps、2366帧，全曲原歌未裁切和未变速，仅−1.5dB一次及不足一帧尾静音；真实动态来源、连续剪辑表、观众/舞台/主角覆盖、预算上限和真实局限。不允许静态图运镜代替本版动态视频，也不能以已配回原曲宣称精准口型。

已导出视觉样片为94.64秒、11条动态来源、28个镜头，57,372,869字节，SHA-256`525c42dfe2bbe7bf0fe0dff77f122451464927e5aede6488a1b19f9691a0cb45`。`node scripts/sync-stage-film.mjs`从最新实际报告读取`user_acceptance`并同步网页快照，随后运行`npm run build`与`npm run check`；旧导出报告不能覆盖同一视频的用户拒收结论。播放区、首页与摘要均标演唱口型未通过。003及001/002、004早期两条试片和6参考原字节保留。

`public/data/004-pilot-demo.json`始终是最初225钻任务记录＋50钻未确认预留的历史快照，不是后续成片当前总费用；新费用取独立舞台版记录和其对应预算账本。网页本身不提交生成任务。

## H3明确音频参考小样

`#h3-audio-pilot`独立展示任务1027778：网页普通H3全能模式，两图＋5秒原曲“音频1”，一次75钻，实际返回1344×768、24fps、124帧、5.166667秒。用户已试听确认该条口型可用；validator要求可信用户反馈、原片SHA及验收文件SHA，不能以相关性或静帧替代。代理主观听音仍为false，08:56等待快照与旧样片拒收均保留。

新的整片修复版使用独立`#repaired-film-004`、`repaired-film-report.mjs`与`data/004-repaired-film.json`。当前状态为exported-awaiting-full-review，新94.64秒视频与实际首帧已接入；首页按钮和导航指向这一版。真实新片SHA为`97a08f79cdeba756fb35280652445343be25219b2cc1ded532e3c62e3ccad4a6`，45,964,902字节。整片验收与已确认5秒试片分开；全段解码、原曲和切口检查不代替用户带声听看。禁止将旧拒收文件改名当修复版；不改旧费用与历史文件。

## 发布状态

2026-10-19已通过现有GitHub Actions部署并完成公网核验：[研究网页与引导图](https://yydshly.github.io/1014_codex_project/011-ancient-rap-battle/) · [完整舞台版](https://yydshly.github.io/1014_codex_project/011-ancient-rap-battle/#repaired-film-004)。67份静态文件、163个唯一页内编号、25处锚点链接、新片完整SHA和全部媒体首尾分段请求核对通过，原有六个项目保留。详情见[发布记录](../deployment.json)。

统一发布入口为`node web/build.mjs`（在项目目录执行），只打包已有文件并运行检查；总构建器使用完整`web/pages.json`，不重新生成歌曲、图像或视频。引导图沿用已有PNG/SVG；首页使用同一图片的已有JPEG预览，可打开原始高清图。源码、公开媒体与精选文字证据进入Git；模型缓存、环境、账号配置和制作中间产物不发布。冻结资料保留原字节，防止跨平台换行转换破坏SHA校验。

本地路径和全量工作目录留在历史制作记录中用于追溯，不表示这些中间文件已全部随公开站点分发。网页不是远端视频生成服务，不会提交任务或扣费。5秒试片确认和整片效果验收保持独立，公网可播放不等于整片口型通过。

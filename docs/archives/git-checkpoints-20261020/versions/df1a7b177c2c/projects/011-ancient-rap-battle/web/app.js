"use strict";

const UPSTREAM = "https://github.com/10291124jcjc-dotcom/ancient-rap-battle";
const COMMIT = "e5e40fa3612777133a141c8448122dd0fd45e4cc";
const source = (path) => `${UPSTREAM}/blob/${COMMIT}/${path}`;
const byId = (id) => document.getElementById(id);
const playerIds = ["episode-video", "repaired-film-video", "stage-film-video", "h3-pilot-video", "h3-pilot-source-audio", "own-sample-video", "own-history-video", "own-history-full-video", "own-history-song-video", "own-history-stage-video", "pilot-stage-video", "pilot-singing-video", "pilot-song-audio"];
function pauseOtherPlayers(active) {
  playerIds.forEach(id => { const player = byId(id); if (player && player !== active) player.pause(); });
}

const episodeVideo = byId("episode-video");
const episodePlay = byId("play-episode");
const videoStatus = byId("video-status");
episodePlay.addEventListener("click", async () => {
  try {
    videoStatus.textContent = "正在打开本地视频…";
    await episodeVideo.play();
  } catch {
    episodePlay.hidden = false;
    videoStatus.textContent = "播放未能开始，请重试或单独打开视频。";
  }
});
episodeVideo.addEventListener("play", () => {
  pauseOtherPlayers(episodeVideo);
  episodePlay.hidden = true;
  videoStatus.textContent = "正在播放上游原作，支持拖动进度与全屏。";
});
episodeVideo.addEventListener("pause", () => {
  episodePlay.hidden = false;
  episodePlay.lastElementChild.textContent = episodeVideo.ended ? "再看一遍" : "继续播放";
  videoStatus.textContent = episodeVideo.ended ? "原作播放结束。" : "已暂停，可继续播放或拖动进度。";
});
episodeVideo.addEventListener("loadedmetadata", () => {
  const duration = episodeVideo.duration;
  if (Number.isFinite(duration) && episodeVideo.paused) {
    const length = `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}`;
    videoStatus.textContent = `视频已就绪 · ${length} · 可直接播放与全屏。`;
  }
});
episodeVideo.addEventListener("error", () => {
  videoStatus.textContent = "视频加载失败，可尝试刷新或单独打开视频。";
  episodePlay.hidden = false;
});

async function loadOwnSample() {
  const section = byId("own-sample");
  if (section?.dataset.ownSampleReady !== "true") return;
  try {
    const response = await fetch("./data/own-sample-run.json", { cache: "no-store" });
    if (!response.ok) return;
    const report = await response.json();
    const production = report.production;
    if (report.schema_version !== 1 || !["completed", "rhythm-preview", "partial-generated"].includes(report.status) || typeof report.title !== "string" || !report.title.trim() || !production || !Array.isArray(report.clips) || !Array.isArray(report.limitations)) return;
    const isPreview = report.status === "rhythm-preview";
    const isPartial = report.status === "partial-generated";
    const isNewExperiment = ["002-moon-and-earth", "003-stage-edition", "004-performance-film"].includes(report.provenance?.experiment_id);
    const isStageEdition = report.provenance?.experiment_id === "003-stage-edition";
    const isPerformanceFilm = report.provenance?.experiment_id === "004-performance-film";
    const song = isNewExperiment ? (await import("./sample-report.mjs")).validateSongReport(report) : null;
    const legacyBaselineArchived = isPartial && report.provenance?.experiment_id === "001-libai-dufu" && byId("own-sample-history")?.dataset.ownHistoryReady === "true";
    const musicMode = production.music_mode || (report.provenance?.experiment_id === "001-libai-dufu" ? "tts-code-beat" : "");
    if (isNewExperiment && (!["minimax-song", "tts-code-beat", "user-supplied-song"].includes(musicMode) || typeof production.music_provider !== "string" || !production.music_provider.trim())) return;
    const musicProvider = production.music_provider || "见制作记录";
    const musicModeLabel = musicMode === "minimax-song" ? "MiniMax 歌曲生成" : (musicMode === "tts-code-beat" ? "TTS 人声 + 代码伴奏" : (musicMode === "user-supplied-song" ? "用户提供歌曲" : "见制作记录"));
    const trackTitle = typeof production.music_title === "string" && production.music_title.trim() ? `《${production.music_title}》` : "";
    const musicDescription = musicMode === "minimax-song" ? `音乐${trackTitle}由 ${musicProvider} 生成，实际使用的人声与剪辑方式见制作记录。` : (musicMode === "tts-code-beat" ? `音乐采用 ${musicProvider}，人声使用 TTS；这是节奏化配音加伴奏。` : (musicMode === "user-supplied-song" ? `音乐${trackTitle}由用户提供；来源记录：${musicProvider}。` : `音乐来源：${musicProvider}。`));
    const bpmLabel = `${production.bpm} BPM${production.bpm_is_estimate === true ? "（估测）" : ""}`;
    const soundTreatment = song?.hasStageAmbience ? "原歌完整保留，开场、停拍与结尾补少量合成现场声；非现场录音" : "保留完整原歌，仅调整播放音量";
    const audioDescription = song ? (song.hasStageAmbience ? `${soundTreatment}。原歌播放响度 ${song.audioGainDb} dB，未裁切或变速。` : `整曲保留${song.audioGainDb !== 0 ? `，仅调整播放响度 ${song.audioGainDb} dB` : "，未裁切或变速"}；末尾补 ${Number(song.audioPadding.toFixed(4))} 秒静音对齐画面。`) : "";
    if (!isPerformanceFilm && (isPartial ? report.clips.length < 1 || report.clips.length > 3 : report.clips.length !== 4)) return;
    if (new Set(report.clips.map(clip => clip.id)).size !== report.clips.length) return;
    if (isPartial && report.clips.some(clip => clip.video_generated !== true)) return;
    if (report.clips.some(clip => typeof clip.actor !== "string" || !clip.actor.trim() || typeof clip.text !== "string" || !clip.text.trim())) return;
    const clipCount = report.clips.length;
    const missingClips = 4 - clipCount;
    const actors = [...new Set(report.clips.map(clip => clip.actor))].join("与");
    const clipIds = report.clips.map(clip => clip.id).join("、");
    const remote = report.remote_generation;
    const remotePending = !legacyBaselineArchived && (isPreview || isPartial) && remote?.status === "pending" && Number.isInteger(remote.submitted_clips) && remote.submitted_clips > 0;
    const remoteCount = remotePending ? (['', '一', '两', '三', '四'][remote.submitted_clips] || String(remote.submitted_clips)) : '';
    const remoteModels = remotePending && Array.isArray(remote.models) ? remote.models.map(model => typeof model === "string" ? model : (model?.model || model?.name || "")).filter(Boolean).join(" / ") : "";
    const outputsAvailable = remotePending && Number.isInteger(remote.outputs_available) ? Math.max(0, Math.min(remote.submitted_clips, remote.outputs_available)) : 0;
    const remainingOutputs = remotePending ? remote.submitted_clips - outputsAvailable : 0;
    const remoteProgress = outputsAvailable > 0 ? `已返回${outputsAvailable}条，${remainingOutputs > 0 ? `${remainingOutputs}条生成中` : "待全片验收"}` : `ChatArt${remoteCount}条镜头生成中`;
    const returnedOutputs = remotePending && Array.isArray(remote.outputs) ? remote.outputs : [];
    const firstOutput = returnedOutputs.find(output => output?.id === "A01") || returnedOutputs[0];
    let firstOutputUrl;
    if (isPreview && outputsAvailable > 0 && typeof firstOutput?.video_url === "string") {
      try {
        const url = new URL(firstOutput.video_url);
        if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) firstOutputUrl = url.href;
      } catch { /* An invalid output link stays hidden. */ }
    }
    const expectedClipStatus = isPreview ? "audio-ready" : "completed";
    const sampleLabel = isPreview ? "节奏预演" : (isPartial ? `${clipCount}句真实生成小样` : (song ? "歌曲成片" : "小样"));
    if (![production.bpm, production.total_duration].every(value => Number.isFinite(value) && value > 0) || ["image_provider", "voice_provider", "video_provider"].some(key => typeof production[key] !== "string" || !production[key].trim())) return;
    if (report.clips.some(clip => clip.status !== expectedClipStatus)) return;
    const video = byId("own-sample-video");
    const status = byId("own-sample-video-status");
    const duration = Number(production.total_duration);
    const length = seconds => `${String(Math.floor(Math.round(seconds) / 60)).padStart(2, "0")}:${String(Math.round(seconds) % 60).padStart(2, "0")}`;
    section.dataset.state = isPreview ? "preview" : (isPartial ? "partial" : "completed");
    section.dataset.production = isPerformanceFilm ? "performance-film" : "earlier-production";
    section.dataset.remoteGeneration = remotePending ? "pending" : "none";
    byId("own-sample-eyebrow").textContent = isPreview ? "RHYTHM PREVIEW / 节奏预演" : "OUR PRODUCTION / 制作实测";
    byId("own-sample-title").textContent = isPreview ? "先听这段节奏预演。" : (isNewExperiment ? `《${report.title}》` : "我们的制作小样。");
    byId("own-sample-episode-title").textContent = report.title;
    byId("own-sample-badge").textContent = isPreview ? "本项目预演 · 未生成口型" : (song ? "AI 人物演绎 · 完整歌曲" : "本项目制作 · AI 生成");
    if (isStageEdition) byId("own-sample-badge").textContent = "舞台重剪 · 沿用原表演";
    byId("own-sample-status").textContent = isPreview ? (remotePending ? (outputsAvailable > 0 ? remoteProgress : "静态预演 · 网页镜头生成中") : "节奏预演 · 非口型成片") : "成片已导出";
    byId("own-sample-duration").textContent = length(duration);
    byId("own-sample-intro").textContent = isPreview ? (remotePending ? `四句原创人声与 ${bpmLabel} 节拍已完成。${outputsAvailable > 0 ? `ChatArt 网页${remoteProgress}` : `ChatArt 网页的${remoteCount}条镜头仍在生成，尚无视频可下载`}；全片尚未完成，目前播放的约 ${Number(duration.toFixed(1))} 秒文件仍是静态参考图轻运镜预演。` : `四句原创人声与 ${bpmLabel} 节拍已完成。口型生成尚未完成：直接 API 的套餐不支持 H3。可以先听这约 ${Number(duration.toFixed(1))} 秒的预演，画面为静态参考图轻运镜。`) : (song ? `${clipCount}句原创歌词，${song.performanceCount}次演唱，完整保留约 ${Number(duration.toFixed(1))} 秒歌曲。人物表演来自 ${song.sourceCount} 条新视频，器乐段使用原创图像与程序运镜。` : `${clipCount}句原创歌词，${bpmLabel}，约 ${Number(duration.toFixed(1))} 秒。以下内容来自本次真实任务记录。`);
    byId("own-sample-method").textContent = isPreview ? `图像：${production.image_provider}；人声：${production.voice_provider}；画面：${production.video_provider}。直接 API 的 H3 首条请求被 HTTP 402 / code 2068 拒绝，Token Plan 等级不支持模型，未返回 task_id。${remotePending ? `ChatArt 网页另行提交${remoteCount}条任务${remoteModels ? `（${remoteModels}）` : ""}，${outputsAvailable > 0 ? `${remoteProgress}。已有单条原片可核验音轨与画面，全片尚未完成。` : "仍在生成、尚无输出。"}` : ""}当前播放器仍只呈现真实人声、原创节拍与静态图运镜，${outputsAvailable > 0 ? "未合入返回的原片" : "不包含生成的口型镜头"}。` : `图像：${production.image_provider}；人声：${production.voice_provider}；视频：${production.video_provider}。${musicDescription}${audioDescription}`;
    if (isNewExperiment) byId("own-sample-method").textContent = "先确定完整歌曲，再定制人物与舞台，用参考图和演唱音频生成两段表演，最后剪辑、加字幕。歌曲由用户提供，人物与场景图由 ImageGen 创作，表演模型为 ChatArt 网页标注的 MiniMax H3。";
    if (isStageEdition) {
      byId("own-sample-eyebrow").textContent = "STAGE EDITION / 舞台重剪";
      byId("own-sample-intro").textContent = `圆形舞台、双人对峙、观众反打与鼓阵特写，灯光随段落推进。完整保留${trackTitle}约${Number(duration.toFixed(1))}秒音乐，人物演唱沿用上一版两段视频。`;
      byId("own-sample-method").textContent = `这次重新设计${song.newSceneCount}张舞台场景图，调整观看视角、切换节奏与舞台氛围；人物表演沿用第二版素材，没有新增人物视频生成。第二版完整成片可在下方对照观看。`;
    }
    if (isPerformanceFilm) {
      byId("own-sample-eyebrow").textContent = "PERFORMANCE FILM / 新歌动态MV";
      byId("own-sample-badge").textContent = "新完整歌曲 · 全新动态镜头";
      byId("own-sample-intro").textContent = `${trackTitle}完整新歌，约${Number(duration.toFixed(1))}秒。从人物演唱到舞台、双人和观众，使用本轮${song.sourceCount}条新视频重新拍成一支MV。`;
      byId("own-sample-method").textContent = `先确定完整歌曲，再统一人物与电影感舞台，为演唱和过场分别生成动态镜头，最后按音乐剪辑、加字幕。歌曲来源：${musicProvider}。旧版完整保留，可在下方对照。`;
      byId("own-history-stage-figure").hidden = false;
    }
    const cost = report.cost || {};
    const estimate = cost.video_estimate_cny;
    const creditSpent = cost.video_credits_spent;
    const creditEstimate = cost.video_credits_estimate;
    const usesCredits = cost.provider === "ChatArt" || Number.isFinite(creditSpent) || Number.isFinite(creditEstimate);
    const videoCostText = usesCredits ? (cost.invoice_verified === true && Number.isFinite(creditSpent) && creditSpent >= 0 ? `${creditSpent} 钻石 · 账单已核对` : (Number.isFinite(creditEstimate) && creditEstimate >= 0 ? `${creditEstimate} 钻石 · 网页标价，实际扣减未核对` : "ChatArt 钻石用量待核对")) : (Number.isFinite(estimate) ? `¥${estimate.toFixed(2)} · 以实际账单为准` : "见任务记录");
    const inheritedCost = cost.reused_source_cost || {};
    const inheritedCredits = inheritedCost.video_credits_estimate;
    const facts = isPerformanceFilm ? [
      ["音乐", `用户提供${trackTitle} · 完整新歌`],
      ["人物与世界", production.image_provider],
      ["新动态镜头", `${song.sourceCount}条本轮新视频，演唱与舞台视角分别生成`],
      ["观看内容", `${clipCount}句歌词、${song.performanceCount}次演唱；完整人物表演与动态过场`],
      ["节拍 / 时长", `${bpmLabel} · ${Number(duration.toFixed(1))}秒`],
      ["素材预算 / 账单", `${cost.credits_committed}钻石承诺额度（图片${cost.image_credits_committed}／视频${cost.video_credits_committed}） · 未确认预留${cost.reserved_unconfirmed_credits} · 上限${cost.credit_cap}；独立账单未核对`],
    ] : isStageEdition ? [
      ["音乐", `用户提供${trackTitle} · 完整原歌保留`],
      ["这次改动", "全景建场、双人交锋、观众反打与鼓阵，配合灯光和现场氛围"],
      ["新场景", `${song.newSceneCount}张舞台图 · 配合音乐重新安排视角与场景`],
      ["人物演唱", `沿用第二版${song.sourceCount}条视频，${clipCount}句歌词、${song.performanceCount}次演唱`],
      ["声音处理", soundTreatment],
      ["新增视频生成", "0次 · 本轮没有新增视频积分请求"],
      ["沿用素材费用", `${Number.isFinite(inheritedCredits) ? `${inheritedCredits}钻石为第二版原视频网页标价` : "原视频费用见第二版历史记录"}，独立账单未核对`],
      ["节拍 / 时长", `${bpmLabel} · ${Number(duration.toFixed(1))}秒`],
    ] : isNewExperiment ? [
      ["音乐", `用户提供${trackTitle}；用户说明由 Gemini 生成，具体模型未核实`],
      ["人物与场景", "5张 ImageGen 原创图像"],
      ["人物表演", `${song.sourceCount}条 MiniMax H3 视频（ChatArt 网页标签）`],
      ["画面组成", `${Number(song.performanceDuration.toFixed(2))}秒表演取用 / ${Number(song.artDuration.toFixed(2))}秒原创图像运镜`],
      ["节拍 / 时长", `${bpmLabel} · ${Number(duration.toFixed(1))} 秒`],
      ["声音处理", "保留完整原歌，仅调整播放音量"],
      ["视频网页标价 / 账单", cost.invoice_verified === true ? videoCostText : `${Number.isFinite(creditEstimate) ? `${creditEstimate} 钻石（网页标价）` : "标价见任务记录"}${Number.isFinite(cost.credit_cap) ? ` · 上限 ${cost.credit_cap} 钻石` : ""}；独立账单未核对`],
    ] : [
      ["参考图", production.image_provider],
      ["人声", production.voice_provider],
      ["音乐", `${musicModeLabel}${trackTitle ? ` ${trackTitle}` : ""} · ${musicProvider}`],
      [isPreview ? "预演画面" : "生成视频", production.video_provider],
      ["节拍 / 时长", `${bpmLabel} · ${Number(duration.toFixed(1))} 秒`],
      [isPreview ? "直接 API 状态" : (isPartial ? "当前播放器" : (usesCredits ? "视频网页标价 / 账单" : "视频费用估算")), isPreview ? "HTTP 402 / code 2068 · 未返回任务 ID" : (isPartial ? (legacyBaselineArchived ? `${clipCount}句历史版本 · 四句完整基线另行归档` : `${clipCount}句已合入 · 完整四句未完成`) : videoCostText)],
    ];
    if (song && !isNewExperiment) {
      facts.push(["素材 / 歌词 / 演唱", `${song.sourceCount}条源视频 / ${clipCount}句歌词 / ${song.performanceCount}次演唱；同词重唱复用不算新增任务`]);
      facts.push(["画面组成", `${Number(song.performanceDuration.toFixed(2))}秒生成表演 / ${Number(song.artDuration.toFixed(2))}秒原创图像 · 程序运镜`]);
      facts.push(["整曲音轨", audioDescription]);
      if (Number.isFinite(cost.credit_cap)) facts.push(["本轮积分上限", `${cost.credit_cap} 钻石 · 页面标价与余额瞬时变化不作为实际扣费证明`]);
    } else if (!isNewExperiment && !isPreview && Number.isInteger(report.assembly?.source_clips) && Number.isInteger(report.assembly?.source_shots)) facts.push(["生成素材 / 成片段落", `${report.assembly.source_clips}条源视频 / ${report.assembly.source_shots}段歌词镜头`]);
    if (!isNewExperiment && !isPreview && Number.isInteger(report.video_service?.created_tasks)) facts.push(["视频生成请求", `${report.video_service.created_tasks}次 · 以实际任务记录为准`]);
    if (remotePending) {
      facts.push(["ChatArt 网页状态", `${isPartial ? `已回传 ${outputsAvailable} 条，完整四句尚未交付` : remoteProgress}${remoteModels ? ` · ${remoteModels}` : ""}`]);
      if (Number.isFinite(remote.planned_credits) && Number.isFinite(remote.credit_cap)) facts.push(["页面标价 / 本轮上限", `${remote.planned_credits} / ${remote.credit_cap} 钻石 · 计划标价，非实支，扣减未核对`]);
    }
    const details = byId("own-sample-facts");
    details.replaceChildren();
    facts.forEach(([name, value]) => {
      const item = document.createElement("div");
      const label = document.createElement("dt");
      const text = document.createElement("dd");
      label.textContent = name;
      text.textContent = value;
      item.append(label, text);
      details.append(item);
    });
    const limitations = byId("own-sample-limitations");
    limitations.replaceChildren();
    if (remotePending && !isPartial) {
      const item = document.createElement("li");
      item.textContent = outputsAvailable > 0 ? `ChatArt 网页${remoteProgress}；当前播放器尚未合入这些单句原片。全片未完成，不能把静态预演视为已经验收的口型成片。` : `ChatArt 网页的${remoteCount}条任务尚未返回可播放或下载文件；当前播放器展示静态预演，不能据此评价网页生成的画质、表演或口型。`;
      limitations.append(item);
    }
    const visibleLimitations = isPerformanceFilm ? [
      "人物与舞台为AI电影创作，不代表历史人物真实相貌或真实演出现场。",
      "本轮人物与动态镜头重新制作；旧版原片和图像运镜不计作本轮新视频。",
      "完整保留用户提供的新歌曲，音乐来源按实际记录说明。",
      "原片与成片分开查看，口型和人物细节仍可能有误差，完整检查见制作记录。",
    ] : isStageEdition ? [
      "新增的是舞台场景、视角与剪辑氛围，人物演唱沿用第二版原片。",
      "舞台图像与人物表演分别记录来源，不把新场景当作新增生成的人物动作。",
      `${soundTreatment}；歌曲出处按用户说明记录。`,
      "人物与歌词为AI娱乐演绎，口型仍有误差，可以继续打磨。",
    ] : isNewExperiment ? [
      "人物与歌词为 AI 娱乐演绎，不代表史实或历史人物的真实相貌。",
      "完整保留用户提供的原歌，仅调整播放音量。",
      `${song.sourceCount}条新视频与原创图像运镜组成全片；末句重唱复用同词表演画面。`,
      "口型与演唱仍有误差，可以继续打磨。",
      "音乐由 Gemini 生成是用户说明，视频模型按 ChatArt 网页的 H3 标签记录；具体模型未独立核验。",
    ] : report.limitations;
    visibleLimitations.forEach(text => {
      const item = document.createElement("li");
      item.textContent = legacyBaselineArchived && /尚未回传|完整四句.*未完成/.test(text) ? `当时的三句版本记录：${text}` : text;
      limitations.append(item);
    });
    const qaCount = report.clips.filter(clip => clip.qa && Object.keys(clip.qa).length > 0).length;
    byId("own-sample-result-title").textContent = isPreview ? (remotePending ? (outputsAvailable > 0 ? `${remoteProgress}，全片尚未完成。` : `人声与节拍已完成，${remoteCount}条网页镜头生成中。`) : "人声与节拍已完成，口型镜头尚未生成。") : (song ? "整曲完成，素材与处理方式一起留下。" : "小样完成，边界也一起留下。");
    byId("own-sample-qa-summary").textContent = isPreview ? (outputsAvailable > 0 ? `${report.clips.length} 句人声已就绪，已有单条原片可独立做音轨 QA 与抽帧检查，具体结果以任务记录为准。音轨相关性不代表口型准确，当前静态预演的音频检查也不作为口型评分；全片仍待素材到齐与逐条审片。` : `${report.clips.length} 句人声已就绪。${remotePending ? "网页任务尚无输出；" : ""}记录中的检测数据仅用于音频与节奏检查；当前没有可评估的口型视频，也没有口型评分。`) : `${report.clips.length} 条镜头留有任务记录，其中 ${qaCount} 条带有质检数据。音频相关性不代表口型准确；具体数值与任务状态可在记录中查看。`;
    if (song) {
      byId("own-sample-lyrics-title").textContent = `${clipCount}句歌词，${song.performanceCount}次演唱。`;
      byId("own-sample-qa-summary").textContent = `${song.sourceCount}条新源视频对应${clipCount}句歌词、${song.performanceCount}次演唱，重唱复用原片同词片段。器乐段另用原创图像与程序运镜，不能视作持续的人物演唱。原片筛查结果如实保留，音轨相似度不代表精准口型。`;
      if (isNewExperiment) byId("own-sample-qa-summary").textContent = "两段原片分别检查后用于演示，口型仍可打磨。完整任务、检查结果与费用记录可在下方打开。";
      if (isStageEdition) {
        byId("own-sample-result-title").textContent = "新舞台与原表演，重新剪成一场演出。";
        byId("own-sample-qa-summary").textContent = "本轮沿用已有的人物表演，把变化放在舞台场景、观看视角和灯光氛围。原片检查、整曲核验和本次剪辑分别记录，口型不作精准同步保证。";
      }
      if (isPerformanceFilm) {
        byId("own-sample-result-title").textContent = "一首完整新歌，一场重新制作的演出。";
        byId("own-sample-qa-summary").textContent = "新人物、新歌和动态舞台共同组成这次MV。生成原片、使用片段、音乐处理与实际费用分别留档，详细检查可在制作记录中查看。";
      }
    }
    const date = new Date(report.generated_at);
    if (!Number.isNaN(date.valueOf())) byId("own-sample-generated-at").textContent = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(date);
    byId("own-sample-open").href = "./media/own-libai-dufu-v1.mp4";
    byId("own-sample-open").textContent = `单独打开${sampleLabel} ↗`;
    byId("own-sample-evidence").href = "./data/own-sample-run.json";
    byId("own-sample-evidence").textContent = isPreview ? "查看请求结果、音频记录与费用 ↗" : "查看任务、逐条质检与费用记录 ↗";
    byId("own-sample-returned").hidden = true;
    byId("own-sample-returned-link").removeAttribute("href");
    if (firstOutputUrl && !isPartial) {
      byId("own-sample-returned-link").href = firstOutputUrl;
      byId("own-sample-returned").hidden = false;
    }
    video.setAttribute("aria-label", `本项目原创${sampleLabel}：李白 vs 杜甫${isPreview ? "，尚未生成口型镜头" : ""}`);
    video.poster = "./media/own-poets-v1.png";
    video.src = "./media/own-libai-dufu-v1.mp4";
    video.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(video.duration)) byId("own-sample-duration").textContent = length(video.duration);
      status.textContent = `${sampleLabel}已就绪，支持播放、拖动进度与全屏。`;
    });
    video.addEventListener("play", () => {
      pauseOtherPlayers(video);
      status.textContent = isPreview ? "正在播放人声与节拍预演；当前画面未做口型生成。" : (legacyBaselineArchived ? "正在播放三句历史实验版；四句完整基线可在下方打开。" : (isPartial ? `正在播放${clipCount}句真实生成小样；完整四句尚未完成。` : (song ? "正在播放完整歌曲成片。" : "正在播放本项目原创小样。")));
    });
    video.addEventListener("pause", () => { status.textContent = video.ended ? `${sampleLabel}播放结束。` : "已暂停，可继续播放或拖动进度。"; });
    video.addEventListener("error", () => { status.textContent = `${sampleLabel}暂时无法加载，可尝试单独打开视频。`; });
    byId("research-status").innerHTML = isPreview ? `<span class="status-dot" aria-hidden="true"></span> 原创节奏预演已完成 <span class="status-divider">·</span> ${remotePending ? remoteProgress : "H3口型生成受套餐限制"}` : '<span class="status-dot" aria-hidden="true"></span> 网页研究已整理 <span class="status-divider">·</span> 四句小样已生成';
    if (song) byId("research-status").innerHTML = `<span class="status-dot" aria-hidden="true"></span> 完整歌曲成片已导出 <span class="status-divider">·</span> ${clipCount}句歌词 / ${song.performanceCount}次演唱`;
    if (isStageEdition) byId("research-status").innerHTML = '<span class="status-dot" aria-hidden="true"></span> 《压轴人间》视觉样片 <span class="status-divider">·</span> 演唱口型未通过';
    byId("source-disclosure").textContent = isPreview ? `标为“上游原作”的视频、封面和截图来自上游固定版本，保留原文件与许可证。本项目节奏预演使用 ImageGen 参考图、MiniMax TTS 人声、原创节拍与静态图轻运镜；直接 API 的 H3 请求因套餐限制被拒绝。${remotePending ? `ChatArt 网页另行提交${remoteCount}条任务，${outputsAvailable > 0 ? remoteProgress : "仍待结果回传"}，当前播放的预演不含这些任务的输出。` : "尚未获得口型视频。"}预演与上游原作分别标注，原版完整制作链路仍待验证。外部服务可能收费，发布时应核对素材授权并声明 AI 生成。` : `标为“上游原作”的视频、封面和截图来自上游固定版本，保留原文件与许可证。本项目《${report.title}》使用 ${production.image_provider}、${production.voice_provider} 与 ${production.video_provider} 制作。${musicDescription}${audioDescription}任务记录与局限单独列出，首次三句实验及四句完整基线分别留档；上游 Suno / Midjourney 完整制作链路仍待验证。外部生成服务可能收费，发布时应核对素材授权并声明 AI 生成。`;
    if (isNewExperiment) byId("source-disclosure").textContent = "上游原作按固定版本保留来源与许可证。《敬风霜》采用用户歌曲、ImageGen 原创图像和 ChatArt 网页标注的 H3 表演制作。Gemini 来源是用户说明，具体模型未独立核验。完整制作记录可查，首次三句实验与四句完整基线另行留档。";
    if (isStageEdition) byId("source-disclosure").textContent = `舞台重剪版沿用第二版《敬风霜》原歌和两段人物表演，本轮新增四张舞台场景图与剪辑氛围，没有新增付费人物视频。${song.hasStageAmbience ? "原歌完整保留，开场、停拍与结尾补少量程序合成的掌声与空间声，非现场录音。" : ""}第二版歌曲原片、首版三句与24秒完整基线分别留档。歌曲由Gemini生成是用户说明，视频模型按ChatArt的H3标签记录；具体模型未独立核验。上游原作继续保留固定来源与许可证。`;
    if (isPerformanceFilm) byId("source-disclosure").textContent = `${trackTitle}由用户提供，来源记录：${musicProvider}。本轮人物与舞台参考由${production.image_provider}制作，${song.sourceCount}条动态原片的实际模型标签与费用见任务记录，不把平台标签当作后台模型独立验证。003舞台重剪、002歌曲原版与001两版过程成果均单独保留；它们的费用不重复计入本轮。上游原作继续保留固定来源与许可证。`;
    const lyrics = byId("own-sample-lyrics");
    lyrics.replaceChildren();
    lyrics.setAttribute("aria-label", `${clipCount}句原创歌词`);
    report.clips.forEach(clip => {
      const item = document.createElement("li");
      const actor = document.createElement("span");
      const text = document.createElement("p");
      actor.textContent = clip.actor;
      text.textContent = clip.text;
      if (song) {
        const timings = document.createElement("span");
        timings.className = "own-lyric-timing";
        clip.occurrences.forEach((occurrence, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = `${index === 0 ? "首唱" : `重唱${index}`} ${length(occurrence.heard_start)}–${length(occurrence.heard_end)}`;
          button.setAttribute("aria-label", `播放${clip.actor}的${clip.text}${index ? "重唱" : "首次演唱"}`);
          button.addEventListener("click", async () => {
            video.currentTime = Math.max(0, occurrence.heard_start - .15);
            try { await video.play(); } catch { status.textContent = "已定位到该句，请点击播放器开始。"; }
          });
          timings.append(button);
        });
        text.append(timings);
      }
      item.append(actor, text);
      lyrics.append(item);
    });
    if (isPartial) {
      const pendingLabel = outputsAvailable >= 4 ? "待补齐" : "待回传";
      const partialStatus = legacyBaselineArchived ? `${clipCount}句历史版 · 完整基线见下方` : `${clipCount}句已导出 · ${missingClips}句${pendingLabel}`;
      const failedAudioChecks = report.clips.filter(clip => clip.qa?.audio_match === false).length;
      const retimedClips = report.clips.filter(clip => clip.assembly?.retime).length;
      const adjustedNote = `${failedAudioChecks > 0 ? `有 ${failedAudioChecks} 条素材未通过原始音轨筛查，失败结果保留。` : "原始音轨检查见任务记录。"}${retimedClips > 0 ? `其中 ${retimedClips} 条调整了画面节奏。` : ""}当前为效果测试，口型仍需逐句打磨。`;
      byId("own-sample-eyebrow").textContent = "GENERATED SAMPLE / 真实小样";
      byId("own-sample-title").textContent = "先看这段真实生成小样。";
      byId("own-sample-badge").textContent = `真实生成 · ${clipCount}句片段`;
      byId("own-sample-status").textContent = partialStatus;
      byId("own-sample-intro").textContent = legacyBaselineArchived ? `主播放器保留${actors}的${clipCount}句历史实验版，约 ${Number(duration.toFixed(1))} 秒。首次实验的24秒四句完整基线已在下方另行归档，歌曲新版本尚未替换到这里。` : `${actors}的 ${clipCount} 句原创交锋，约 ${Number(duration.toFixed(1))} 秒，已经可以直接观看。另 ${missingClips} 句仍${pendingLabel}，完整四句尚未完成。`;
      byId("own-sample-method").textContent = `图像：${production.image_provider}；人声：${production.voice_provider}；生成画面：${production.video_provider}。${musicDescription}${adjustedNote}`;
      byId("own-sample-lyrics-title").textContent = `先看这 ${clipCount} 句。`;
      byId("own-sample-result-title").textContent = legacyBaselineArchived ? "三句过程版保留，完整基线另行留档。" : `${clipCount}句已经可看，完整四句仍待补齐。`;
      byId("own-sample-qa-summary").textContent = `${clipCount} 句均使用真实生成画面。${adjustedNote}原片、检测数值和修正过程可在任务记录中查看。`;
      byId("research-status").innerHTML = legacyBaselineArchived ? '<span class="status-dot" aria-hidden="true"></span> 首次四句基线已完成 <span class="status-divider">·</span> 主播放器保留三句历史版' : `<span class="status-dot" aria-hidden="true"></span> ${clipCount}句真实小样已导出 <span class="status-divider">·</span> ${missingClips}句${pendingLabel}`;
      byId("source-disclosure").textContent = `上游原作仍单独保留。本项目当前视频包含${actors}的 ${clipCount} 句真实生成片段，使用 ${production.image_provider}、${production.voice_provider} 与 ${production.video_provider} 制作。${musicDescription}不声明精准口型，完整四句尚未完成。ChatArt 页面标价是提交计划，不代表已经核对的实际支出。`;
      video.setAttribute("aria-label", `本项目${clipCount}句真实生成小样：${actors}，完整四句尚未完成`);
      if (legacyBaselineArchived) {
        byId("source-disclosure").textContent = `上游原作单独保留。主播放器仍是${clipCount}句历史实验版，完整四句基线已另行归档；两版都使用MiniMax TTS加代码节拍。${adjustedNote}歌曲新版本未替换到当前播放器，不把三句历史文件视作新歌成片。网页标价不代表已核对实际消费。`;
        video.setAttribute("aria-label", `首次实验三句历史版：${actors}，四句完整基线另行归档`);
      }
    }
    section.hidden = false;
    byId("own-sample-jump").textContent = isPreview ? "听原创节奏预演 ↓" : (isPartial ? `看${clipCount}句真实生成小样 ↓` : (isNewExperiment ? `看《${report.title}》↓` : "看我们的四句小样 ↓"));
    if (isStageEdition) {
      byId("own-sample-jump").textContent = "查看《压轴人间》试片留档 ↓";
      byId("own-sample-jump").href = "#pilot-004";
    }
    byId("own-sample-jump").hidden = false;
    video.load();
  } catch {
    // An absent or incomplete optional sample never blocks the research page.
    section.hidden = true;
  }
}

const ownHistory = byId("own-sample-history");
if (ownHistory?.dataset.ownHistoryReady === "true") {
  ownHistory.hidden = false;
  ["own-history-video", "own-history-full-video", "own-history-song-video", "own-history-stage-video"].forEach(id => byId(id).addEventListener("play", () => pauseOtherPlayers(byId(id))));
}

const capabilities = [
  { title: "选题与 Battle 歌词", mode: "human", label: "Claude 写 · 你确认", badge: "assist", description: "把双方典故写成有回应的歌词，明确人物、声线、服装与动作。", detail: "默认 A 先唱 16 句，B 用 18 句回击。典故是否准确、表达是否有趣，要由创作者确认；没有独立的史实自动核验模块。", file: "references/lyrics-guide.md" },
  { title: "歌曲提示词与选歌", mode: "human", label: "用户在 Suno 完成", badge: "human", description: "提供 Lyrics、Styles、Title 三栏提示词，帮助把歌词做成歌。", detail: "当前流程由用户在 Suno 生成、试听、挑选和下载 MP3。仓库没有实现 Suno 的自动生成接口。", file: "references/suno.md" },
  { title: "人声、节拍与字幕时间", mode: "auto", label: "本地脚本自动处理", badge: "auto", description: "分离人声，找歌词与节拍，裁剪歌曲并区分两人音高。", detail: "Demucs 分离人声；faster-whisper 提供时间信息；结合歌词匹配和小节网格定位段落，再用 FFmpeg 变调、重混。假设一句歌词对应一个小节。", file: "scripts/analyze_song.py" },
  { title: "人物与场景定妆", mode: "human", label: "用户在 Midjourney 完成", badge: "human", description: "给出 8 组参考图提示词，统一人物、舞台与观众的视觉设定。", detail: "用户生成并保存人物转面图、表情图、场地、DJ、气氛组和观众图。参考图用于约束一致性，并不能保证每一帧的脸与道具完全一致。", file: "references/midjourney.md" },
  { title: "分镜与剪辑表", mode: "auto", label: "模板与脚本自动处理", badge: "auto", description: "将歌词映射到景别、动作、参考图、提示词和镜头时间轴。", detail: "默认 34 句中，27 句生成说唱镜头，7 句切到反应或观众；加上 8 条过场，共生成 35 条、180 秒素材。它主要套用预设分镜，并非自由导演模型。", file: "scripts/make_clips.py" },
  { title: "逐句对口型视频", mode: "auto", label: "脚本调度付费服务", badge: "auto", description: "向 MiniMax H3 提交参考图、单句人声、动作和运镜描述。", detail: "支持预估、试跑、并发提交与下载。按 take 保存版本，已选素材可跳过。提交与重做前仍要确认费用；此处说明上游用法，具体实测结果以本页小样和任务记录为准。", file: "scripts/h3run.py" },
  { title: "质检与镜头修正", mode: "human", label: "脚本筛查 · 人工审片", badge: "assist", description: "比对音轨、估计延迟，辅助决定调整时间、替换素材或单句重做。", detail: "qa.py 比较音频能量包络相关性，间接筛查改唱与延迟；lipcheck.py 可选用面部关键点估计嘴部开合。两者都不能代替逐句看口型。", file: "scripts/qa.py" },
  { title: "剪辑与成片包装", mode: "auto", label: "本地脚本自动处理", badge: "auto", description: "拼接画面，加入金色字幕、名字卡、标题、水印和欢呼声。", detail: "FFmpeg 依据剪辑表拼接并重新挂载歌曲；Pillow 绘制文字图层。默认 768P 素材后期放大到 1080p，并导出手机预览版。", file: "scripts/package.py" },
  { title: "封面与发布文案", mode: "human", label: "脚本出图 · Claude 写文案", badge: "assist", description: "截取素材并排版竖版、横版封面，整理标题、正文与话题。", detail: "封面由 cover.py 生成；文案按操作手册由 Claude 撰写，用户决定是否采用。没有自动发布到短视频平台的功能。", file: "scripts/cover.py" },
];

function renderCapabilities(filter = "all") {
  const grid = byId("capability-grid");
  grid.replaceChildren();
  capabilities.forEach((item, index) => {
    if (filter !== "all" && item.mode !== filter) return;
    const card = document.createElement("article");
    card.className = "capability-card";
    const top = document.createElement("div");
    top.className = "capability-card-top";
    const number = document.createElement("span");
    number.className = "capability-index";
    number.textContent = String(index + 1).padStart(2, "0");
    const badge = document.createElement("span");
    badge.className = `pill ${item.badge}`;
    badge.textContent = item.label;
    top.append(number, badge);
    const heading = document.createElement("h3");
    heading.textContent = item.title;
    const description = document.createElement("p");
    description.textContent = item.description;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "实现与边界";
    const detail = document.createElement("p");
    detail.className = "capability-detail";
    detail.append(document.createTextNode(item.detail), document.createElement("br"));
    const link = document.createElement("a");
    link.href = source(item.file);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "查看固定版本依据 ↗";
    detail.append(link);
    details.append(summary, detail);
    card.append(top, heading, description, details);
    grid.append(card);
  });
  byId("capability-count").textContent = `显示 ${grid.children.length} 个环节`;
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderCapabilities(button.dataset.filter);
  });
});

const stages = [
  { title: "把创意写成所有环节共用的设定", description: "Claude 根据典故写词并给出角色动作，人确认后，把整期内容保存在一份配置里。下一步读取这些设定，不必反复重新描述。", image: "frame-1.jpg", caption: "上游成片截图 · 人物、道具与风格贯穿各个镜头", input: "两位古人、对立点、典故和栏目风格。", method: "按预设 Battle 结构写词，记录人设、服装、道具、变调与每句动作。", output: "episode.json；Suno 歌曲提示词。", boundary: "历史与文学典故要区分，歌词和创作取舍由人确认。", file: "examples/zhouyu-vs-zhugeliang/episode.json", label: "看完整一期的设定" },
  { title: "让歌词落在可剪辑的时间轴上", description: "先拆出人声与伴奏，再识别时间、测节拍、匹配歌词开头。按小节裁掉冗长段落，并给两位角色分别变调。", image: "frame-2.jpg", caption: "上游成片截图 · 字幕与镜头都需要对齐歌曲", input: "用户挑选的 song.mp3 与已知歌词。", method: "Demucs → faster-whisper → 节拍网格与歌词匹配 → FFmpeg 变调重混。", output: "vocals_final.wav、music_final.wav、lines.json、字幕.srt。", boundary: "节拍搜索范围约 70–120 BPM，并假设一句对应一小节；唱法改变时需检查和调整。", file: "scripts/analyze_song.py", label: "看歌曲分析脚本" },
  { title: "用参考图与镜头规则约束画面", description: "8 组参考图固定人物和环境。模板安排近景、双人、反应、观众等镜头，按句输出生成请求和剪辑表。", image: "frame-1.jpg", caption: "上游成片截图 · 说唱者面向镜头，另一人作反应", input: "人物与场景参考图、逐句时间和 actions。", method: "裁切半身参考；套用景别、站位、麦克风与道具规则，逐句生成提示词。", output: "clips.json（生成什么）、edl.json（何时播放）、分镜表.md。", boundary: "默认针对 16 + 18 句。换成短实验或不同叙事结构，需要调整模板或单独写时间轴。", file: "scripts/make_clips.py", label: "看镜头与时间轴怎样生成" },
  { title: "一句一条生成，再筛查声音是否漂移", description: "把参考图、单句人声和提示词交给 MiniMax H3，生成 5 秒级镜头。下载后比对音频，发现延迟可记录偏移；效果不合格时人工决定重做。", image: "frame-2.jpg", caption: "上游成片截图 · 音频通过筛查后，仍要人工看嘴型", input: "参考图、单句人声、镜头提示词、已确认的生成预算。", method: "上传 → 提交与轮询 → 下载 → 音频包络相关筛查 → 人工审片。", output: "clip_tN.mp4、picks.json、shifts.json、runs.jsonl。", boundary: "音轨相关不是口型证明。远端任务超时后先查日志；直接重新提交可能重复计费。", file: "scripts/h3run.py", label: "看生成调度与素材版本" },
  { title: "把通过审片的素材，剪成一条完整作品", description: "根据剪辑表选择素材和入点，以歌曲为总音轨完成拼接。后期叠加字幕、角色名、标题、水印和少量现场声音。", image: "cover-16x9.jpg", caption: "上游成片封面 · 本页引用原作，不代表本轮重新生成", input: "已选镜头、剪辑表、时间偏移、最终歌曲。", method: "FFmpeg 拼接、混音和轻调色；Pillow 绘制透明文字图层；截帧排版封面。", output: "1080p 成片、手机预览、字幕、3:4 与 16:9 封面，以及发布文案。", boundary: "默认源视频为 768P，1080p 为后期放大；导出前检查整片节奏、画面、字幕与授权。", file: "scripts/package.py", label: "看后期包装脚本" },
];

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function setStage(index) {
  const stage = stages[index];
  if (!stage) return;
  document.querySelectorAll("[data-stage]").forEach((button) => {
    const selected = Number(button.dataset.stage) === index;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  const panel = byId("stage-panel");
  panel.setAttribute("aria-labelledby", `stage-tab-${index}`);
  panel.innerHTML = `<div class="stage-visual"><img src="./media/${stage.image}" width="960" height="540" alt="${escapeHTML(stage.caption)}" loading="lazy"><p>${escapeHTML(stage.caption)}</p></div><div class="stage-description"><h3>${escapeHTML(stage.title)}</h3><p>${escapeHTML(stage.description)}</p><dl class="stage-details"><div><dt>输入 / INPUT</dt><dd>${escapeHTML(stage.input)}</dd></div><div><dt>做法 / PROCESS</dt><dd>${escapeHTML(stage.method)}</dd></div><div><dt>交接产物 / OUTPUT</dt><dd>${escapeHTML(stage.output)}</dd></div><div><dt>边界 / LIMIT</dt><dd>${escapeHTML(stage.boundary)}</dd></div></dl><a class="stage-source" href="${source(stage.file)}" target="_blank" rel="noopener noreferrer">${escapeHTML(stage.label)} ↗</a></div>`;
}

const mechanisms = [
  {
    title: "调度来自手册，状态落在文件里",
    summary: "Skill 把一次制作的步骤、规则和确认点交给 Claude。Claude 负责理解用户意图、写内容、执行命令和解释结果；独立脚本各自处理一个阶段。",
    steps: [["人确认创作与费用", "歌词、歌曲、参考图、首条镜头和重做预算，都保留人的判断。"], ["Claude 按协议调用脚本", "操作手册指定先分析歌曲，再编排镜头，随后生成、审片和导出。没有一个常驻的 Python 总调度器。"], ["产物成为下一步输入", "角色与歌词存 episode.json；逐句时间、镜头、选片和偏移分别存文件，下一步读取它们继续工作。"]],
    files: [{ label: "内容设定", paths: ["episode.json"] }, { label: "各阶段记录", paths: ["work/lines.json", "work/clips.json", "work/edl.json"] }],
    sampleTitle: "内容设定 · 字段节选",
    sample: JSON.stringify({ a: { name_cn: "人物 A", pitch: 1 }, b: { name_cn: "人物 B", pitch: -1 }, lyrics: { a: ["示例歌词"], b: ["回应歌词"] }, actions: { A1: "抬起麦克风，看向对手" } }, null, 2),
    explanation: "字段名沿用上游；内容和句数仅为说明而简写，不能作为完整一期直接运行。角色、歌词、动作共用同一份设定。",
    limit: "这些 JSON 是脚本之间的约定，还没有统一的强类型校验与持久任务状态机；文件存在也不代表对应阶段质量合格。",
    sources: [["SKILL.md", "SKILL.md"], ["示例设定", "examples/zhouyu-vs-zhugeliang/episode.json"]],
  },
  {
    title: "先找到段落，再用小节网格推每句位置",
    summary: "这一步把一首歌转成后续画面可遵循的时间轴。识别文字主要用于定位，最终字幕仍取预先写好的歌词。",
    steps: [["分出人声与伴奏", "Demucs 分离音轨。faster-whisper 从人声给出文字和时间，伴奏则用来分析节拍。"], ["估节拍、匹配段落", "根据频谱正向变化估计起音强度，搜索 70–120 BPM 与相位；用每段前 4 句歌词和识别窗口做文本匹配，找到段落锚点。"], ["按四拍小节映射每句", "一拍 = 60/BPM 秒，一小节 = 240/BPM 秒。从锚点逐句推进，再参考对应窗口内的识别起点修正。按小节裁剪后统一转换时间。"]],
    files: [{ label: "输入歌曲", paths: ["song.mp3"] }, { label: "分析结果", paths: ["work/asr.json", "work/grid.json", "work/lines.json"] }],
    sampleTitle: "逐句时间 · 说明用数据",
    sample: JSON.stringify({ who: "a", n: 1, text: "预先确认的歌词", start: 4.0, end: 6.5, bar: 3.9, heard: "识别到的文字" }, null, 2),
    explanation: "时间单位为秒。这里的 4.0、6.5、3.9 为解释性示例，不是对原作的测量；镜头与字幕都会使用 start/end。",
    limit: "它依赖四拍、相对稳定的节奏和“一句约一小节”，属于模板化定位；自由速度、漏唱、换拍或识别错误都可能让时间轴偏离。",
    sources: [["beat_grid / find_verse", "scripts/analyze_song.py"]],
  },
  {
    title: "素材清单决定生成什么，剪辑表决定怎样使用",
    summary: "同一句歌词同时进入两套安排：一套向模型要素材，一套告诉剪辑程序什么时候播放、从素材的哪一刻开始。两者靠镜头编号关联。",
    steps: [["拼装受约束的镜头描述", "根据角色、动作和运镜模板，加入景别、参考图、站位、道具与声音规则。近景参考先裁成半身，减少拍成远景的倾向。"], ["生成 clips.json", "每项记录 id、kind、dur、images、prompt；说唱镜头还记录单句 audio 区间与可选 lead 静音。一个请求只放一句人声。"], ["生成 edl.json", "t0/t1 是整片时间；clip 关联素材；in 是素材入点，null 表示按人声时间自动计算。7 句用反应切镜，故 34 句只生成 27 条说唱素材。"]],
    files: [{ label: "共同输入", paths: ["work/lines.json", "refs/*.png"] }, { label: "同时生成", paths: ["work/clips.json", "work/edl.json"] }],
    sampleTitle: "同一个编号，连接两种用途",
    sample: `// clips.json：生成什么（节选）\n{\n  "id": "A01", "kind": "rap", "dur": 5,\n  "audio": [4.0, 6.5], "lead": 0,\n  "images": ["人物半身.png", "人物表情.png"],\n  "prompt": "景别 + 动作 + 精确跟随人声"\n}\n\n// edl.json：何时使用（节选）\n{ "t0": 4.0, "t1": 6.5,\n  "clip": "A01", "in": null }`,
    explanation: "字段与用途来自源码；编号、路径、提示词与时间为简化示意。这里的 5 秒生成时长，不等于最终使用的 2.5 秒。",
    limit: "这套镜头排布围绕 16＋18 句设计。换人物容易，换叙事结构或句数则需要改模板、切镜位置与时间表。",
    sources: [["make_clips.py", "scripts/make_clips.py"], ["镜头模板", "references/shot-template.md"]],
  },
  {
    title: "先上传图和声音，再提交一个有编号的生成任务",
    summary: "真正生成嘴型、人物动作和镜头的是 MiniMax H3。脚本负责把素材准备成请求、等待远端任务，再把结果存回本地。",
    steps: [["准备这一个镜头的输入", "从最终人声截出这一句，按需加入开头静音；上传参考图与人声。上传缓存用文件 SHA-256 识别相同内容。"], ["提交与轮询", "以文本、reference_image 和 reference_audio 组成 content，提交 MiniMax-H3 任务，立即记录 task_id；每 15 秒查询，超过 30 分钟报超时。"], ["保存候选版本", "下载为 A01_t1.mp4 等文件。批量最多 10 个工作线程，按间隔提交；首个音频筛查通过的版本记入 picks.json。"]],
    files: [{ label: "镜头清单", paths: ["work/clips.json"] }, { label: "裁切的人声", paths: ["work/audio/A01.mp3"] }, { label: "日志与素材", paths: ["work/runs.jsonl", "clips/A01_t1.mp4"] }],
    sampleTitle: "生成请求 · 结构节选",
    sample: JSON.stringify({ model: "MiniMax-H3", content: [{ type: "text", text: "镜头提示词" }, { type: "image_url", image_url: { url: "mm_file://图像ID" }, role: "reference_image" }, { type: "audio_url", audio_url: { url: "mm_file://音频ID" }, role: "reference_audio" }], resolution: "768P", duration: 5, ratio: "16:9" }, null, 2),
    explanation: "请求结构来自 h3run.py；文件 ID 和内容是占位示意，没有发送这个请求。真实调用需要服务账号、凭据与费用确认。",
    limit: "日志和素材版本提供局部复用，但超时任务不会自动续查，也没有请求幂等保证；直接重跑可能产生另一个收费任务。",
    sources: [["upload / run_one", "scripts/h3run.py"]],
  },
  {
    title: "默认检查的是声音有没有变，并不直接看嘴",
    summary: "H3 可能把输入人声放晚，或重唱一部分。qa.py 比较两条音轨的能量变化，尝试筛出这些问题；它没有做音素与嘴部的逐项匹配。",
    steps: [["把波形变成能量包络", "两条音轨转为单声道、8kHz；每 10 毫秒计算 RMS 并取对数，获得随时间变化的响度序列。"], ["寻找偏移与局部漂移", "在可用的非负延迟中寻找相关性最高的位置；整体相关需 ≥0.85，再用每隔 0.5 秒的 1 秒窗口，检查是否跌到 0.9 以下。"], ["把检测结果交给选片与人审", "通过则记录候选版本；发现晚放时保存 shift。可选 lipcheck.py 再比较嘴部开合与音量，但麦克风遮挡、侧脸和小脸都影响结果。"]],
    files: [{ label: "比较两条音轨", paths: ["输入人声.mp3", "生成镜头.mp4"] }, { label: "记录选择与偏移", paths: ["work/picks.json", "work/shifts.json"] }],
    sampleTitle: "选片与偏移 · 说明用数据",
    sample: `// picks.json：选 A01 的第 2 个版本\n{ "A01": 2 }\n\n// shifts.json：这段画面提前 0.20 秒\n{ "A01": 0.20 }`,
    explanation: "文件结构来自源码，版本 2 和 0.20 秒为示意。QA 的相关阈值与可用片段规则只用于筛查，不是口型准确率。",
    limit: "通过筛查不要求整条 5 秒素材始终无漂移，声音相似也可能配错嘴型或人物。lipcheck 只是辅助建议，不自动改画面；任何修正都要重新观看。",
    sources: [["qa.analyze", "scripts/qa.py"], ["lipcheck.py", "scripts/lipcheck.py"]],
  },
  {
    title: "统一歌曲保持不动，镜头按入点拼接",
    summary: "最终成片并不是直接把所有生成镜头的声音首尾相接。剪辑程序围绕一条已经处理好的总音乐，计算每段画面应该取哪一部分。",
    steps: [["选素材、算取片位置", "EDL 指定播放区间，picks 选版本，shifts 修正延迟。说唱镜头结合 audio 起点与 lead 算入点；正 shift 增加源视频裁剪量。"], ["优先保持时间对应关系", "画面不足时定格末帧，缺片先显示占位；不为填长度而随意提前整段，避免破坏原来与人声的对应。"], ["按总音轨包装", "FFmpeg 拼接视频并挂上 music_final.wav；Pillow 做字幕与标题透明图层，包装阶段再混入少量过场欢呼，并放大输出到 1080p。"]],
    files: [{ label: "共同读取", paths: ["work/edl.json", "work/picks.json", "work/shifts.json"] }, { label: "组装与包装", paths: ["final/成片.mp4"] }],
    sampleTitle: "取片位置 · 源码计算的简写",
    sample: `// 说唱镜头；从 EDL 段落起点播放时\n源入点 = t0 - (audio起点 - lead) + shift\n\n// 加入 0.20 秒正偏移\n新源入点 = 原源入点 + 0.20\n\n// 源视频多跳过 0.20 秒；音乐保持原时间轴\n输出声音 = music_final.wav\n           + 包装阶段的少量现场声`,
    explanation: "公式对应 assemble.py 中 in:null 的分支；有显式 in 的过场镜头直接按给定源入点剪。时间都以秒计算。",
    limit: "平移只能修正整体偏移。逐渐失步、改唱或错误表演，需要换 take、切到反应画面，或再次生成素材。",
    sources: [["assemble.py", "scripts/assemble.py"], ["package.py", "scripts/package.py"]],
  },
];

function setMechanism(index) {
  const mechanism = mechanisms[index];
  if (!mechanism) return;
  document.querySelectorAll("[data-mechanism]").forEach((button) => {
    const selected = Number(button.dataset.mechanism) === index;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  const panel = byId("mechanism-panel");
  panel.setAttribute("aria-labelledby", `mechanism-tab-${index}`);
  panel.innerHTML = `<div class="mechanism-description"><h3>${escapeHTML(mechanism.title)}</h3><p>${escapeHTML(mechanism.summary)}</p><ol class="mechanism-steps">${mechanism.steps.map(([title, text], number) => `<li><span aria-hidden="true">${number + 1}</span><div><h4>${escapeHTML(title)}</h4><p>${escapeHTML(text)}</p></div></li>`).join("")}</ol><div class="mechanism-limit"><strong>实际边界</strong><p>${escapeHTML(mechanism.limit)}</p></div></div><div class="mechanism-evidence"><div class="file-chain" aria-label="关键文件的数据关系">${mechanism.files.map((group) => `<div class="file-group"><p>${escapeHTML(group.label)}</p><div>${group.paths.map((file) => `<span>${escapeHTML(file)}</span>`).join("")}</div></div>`).join('<i aria-hidden="true">↓</i>')}</div><details class="mechanism-code"><summary>${escapeHTML(mechanism.sampleTitle)}<span aria-hidden="true">＋</span></summary><pre><code>${escapeHTML(mechanism.sample)}</code></pre><p>${escapeHTML(mechanism.explanation)}</p></details><div class="mechanism-sources"><span>固定版本依据</span>${mechanism.sources.map(([label, file]) => `<a href="${source(file)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)} ↗</a>`).join("")}</div></div>`;
}

function updateSyncExample() {
  const shift = Number(byId("picture-shift").value);
  const remaining = 200 - shift;
  byId("picture-shift-output").textContent = `${shift} 毫秒`;
  byId("mouth-pulses").setAttribute("transform", `translate(${remaining * 0.2} 0)`);
  const result = remaining > 0 ? `嘴部动作仍晚 ${remaining} 毫秒` : remaining < 0 ? `补偿过多，嘴部动作提前 ${Math.abs(remaining)} 毫秒` : "两者已对齐（示意）";
  byId("sync-result").textContent = result;
  byId("sync-result").classList.toggle("aligned", remaining === 0);
  byId("sync-diagram").setAttribute("aria-label", `原歌曲和嘴部动作的时间对齐示意：${result}`);
}
byId("picture-shift").addEventListener("input", updateSyncExample);
byId("align-example").addEventListener("click", () => {
  byId("picture-shift").value = "200";
  updateSyncExample();
});

const routes = [
  { title: "先证明四条镜头能接起来", intro: "把试错限制在一个很小的范围，先看人设、声音和嘴型能否达到你想要的效果。短实验流程需要自己准备或改写。", deliverable: "一个由 3–4 句组成的短片段，加一份镜头与问题记录。", steps: [
    ["准备短歌与人物参考", "写 3–4 句歌词，用合规来源的歌曲或人声；准备两人的正面、半身图和同一场地参考。先听音频，再做画面。"],
    ["单独安排每句时间与镜头", "为每句标出起止，建立短实验的 clips.json 与 edl.json，或修改分镜脚本。不把 4 句歌词直接交给默认整期模板。"],
    ["只生成少量素材并审片", "例如四条各 5 秒。每次只给一句人声；先确认一条，再做剩余镜头。检查脸、道具、音轨、嘴型和侧脸遮挡。"],
    ["按歌曲拼接，记录能否接受", "用 FFmpeg 或熟悉的剪辑工具组装，加上字幕，记下需要偏移、重做或切反应镜头的位置，再决定是否扩大。"],
  ], note: "如果想尽量沿用原脚本，可先保留完整 16 + 18 句配置和歌曲，再只挑 A01、A02、B01、B02 测试；其余镜头不提交。", seconds: 20 },
  { title: "复用作者已经整理好的整套方法", intro: "适合愿意使用 Claude Code、Suno、Midjourney 和 MiniMax API，并按人工确认点推进的创作者。", deliverable: "一整期说唱短片、字幕、封面和文案；保留配置、素材版本与剪辑记录。", steps: [
    ["检查环境与账号", "准备 Claude Code、Suno 和 Midjourney 账号、MiniMax API Key、Python 与带 rubberband 的 FFmpeg。先运行 setup_check.py；本地模型首次使用需下载。"],
    ["确认歌词、歌曲与定妆图", "复制示例 episode.json，替换两位人物与典故。按 16 + 18 句写词，在 Suno 挑选歌曲，并在 Midjourney 完成 8 组参考图。"],
    ["分析音频，再确认分镜与预算", "运行 analyze_song.py，核对每句识别与时间；运行 make_clips.py 查看分镜。h3run.py --estimate 只做估算，先确认预算再提交一条。"],
    ["逐步生成、审片与包装", "测试镜头满意后再批量。用 assemble.py 出草稿，调整偏移、选片或单句重做，最后用 package.py、cover.py 输出成片与封面。"],
  ], note: "原仓库安装方式与命令以固定版本 SKILL.md 为准。本页未接入生成服务，也没有替你运行这些命令。", seconds: 180 },
  { title: "让每个模型都成为可替换的一环", intro: "适合想把相似内容做成内部制作工具的人。先定义素材如何交接、出错如何继续，再逐步接入服务。以下为本项目建议。", deliverable: "一个可追踪制作进度、审片、预算和素材版本的最小制作工具。", steps: [
    ["先定义制作对象", "Episode 保存人物与歌词；AudioLine 保存每句时间；Shot 保存参考图、动作与生成请求；Take 保存任务状态与素材；Edit 保存入点和偏移。"],
    ["把服务接入与创作模板分开", "歌曲、图像、视频都提供统一的输入输出约定。先保留手动上传歌曲和参考图，再按官方能力接入自动生成，避免绑定单一厂商。"],
    ["建立任务状态和人工确认点", "记录提交前后状态、远端 task_id、素材散列、预算与重试次数；超时先续查，重复请求去重。费用批准、歌词确认与审片都进入状态流转。"],
    ["用小实验验收整个闭环", "完成配置 → 生成一条 → 下载 → 审片 → 选中 → 导出。确认刷新后任务仍能恢复，再扩大批量与模板覆盖。"],
  ], note: "自动续查、请求去重、网页任务队列与多供应商切换属于扩展设计，上游仓库并未完整实现这些能力。", seconds: 20 },
];
let currentRoute = 0;

function setRoute(index, updateBudget = true) {
  const route = routes[index];
  if (!route) return;
  currentRoute = index;
  document.querySelectorAll("[data-route]").forEach((button) => {
    const selected = Number(button.dataset.route) === index;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  const panel = byId("route-panel");
  panel.setAttribute("aria-labelledby", `route-tab-${index}`);
  panel.innerHTML = `<div class="route-overview"><h3>${escapeHTML(route.title)}</h3><p>${escapeHTML(route.intro)}</p><div class="route-deliverable"><span>这条路线的交付物</span><p>${escapeHTML(route.deliverable)}</p></div></div><ol class="route-steps">${route.steps.map(([title, text], number) => `<li><span class="step-num" aria-hidden="true">${String(number + 1).padStart(2, "0")}</span><div><h4>${escapeHTML(title)}</h4><p>${escapeHTML(text)}</p></div></li>`).join("")}</ol><p class="route-footnote">↳ ${escapeHTML(route.note)}</p>`;
  byId("brief-route").value = String(index);
  if (updateBudget) {
    byId("material-seconds").value = String(route.seconds);
    updateEstimate();
  }
}

function wireTabs(attribute, handler) {
  const buttons = [...document.querySelectorAll(`[${attribute}]`)];
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => handler(index));
    button.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = buttons.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      handler(next);
      buttons[next].focus();
    });
  });
}

const prices = { "768P": 0.08, "2K": 0.13 };
const money = (number) => `$${number.toFixed(2)}`;

function estimate() {
  const seconds = Number(byId("material-seconds").value);
  const retry = Number(byId("retry-percent").value);
  const resolution = byId("resolution").value;
  const price = prices[resolution];
  const base = seconds * price;
  return { seconds, retry, resolution, price, base, extra: base * retry / 100, total: base * (1 + retry / 100) };
}

function updateEstimate() {
  const value = estimate();
  byId("seconds-output").textContent = `${value.seconds} 秒`;
  byId("retry-output").textContent = `${value.retry}%`;
  byId("base-cost").textContent = money(value.base);
  byId("retry-cost").textContent = money(value.extra);
  byId("estimate-total").textContent = money(value.total);
  document.querySelectorAll("[data-seconds]").forEach((button) => {
    const selected = Number(button.dataset.seconds) === value.seconds;
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("active", selected);
  });
}

["material-seconds", "retry-percent", "resolution"].forEach((id) => {
  byId(id).addEventListener("input", updateEstimate);
  byId(id).addEventListener("change", updateEstimate);
});
document.querySelectorAll("[data-seconds]").forEach((button) => {
  button.addEventListener("click", () => {
    byId("material-seconds").value = button.dataset.seconds;
    updateEstimate();
  });
});
byId("brief-route").addEventListener("change", (event) => setRoute(Number(event.target.value)));

function makeBrief(a, b) {
  const route = routes[currentRoute];
  const value = estimate();
  return `# ${a} vs ${b} · AI 说唱视频制作清单\n\n` +
    `生成日期：${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "long" }).format(new Date())}\n` +
    `制作路线：${["先做一个小实验", "按原版做完整一期", "搭建自己的制作系统"][currentRoute]}\n` +
    `选题：人物 A ${a}；人物 B ${b}\n\n` +
    `## 制作目标\n\n${route.title}。${route.deliverable}\n\n` +
    `## 逐步执行\n\n${route.steps.map(([title, text], index) => `${index + 1}. ${title}\n   ${text}`).join("\n\n")}\n\n` +
    `## 必备输入\n\n- 核查后的典故、歌词和每句动作，区分史实与文学设定。\n- 已挑选的歌曲或人声，以及每句起止时间。\n- 两位角色的脸、服装、道具与共同场景参考。\n- 逐句生成计划、剪辑表和明确的费用批准。\n\n` +
    `## 本次预算假设\n\n- 生成素材总时长：${value.seconds} 秒（不是成片时长）。\n- 规格：${value.resolution}；仓库参考单价：${money(value.price)} / 秒。\n- 基础生成：${money(value.base)}；额外重做预留：${value.retry}% / ${money(value.extra)}。\n- 视频规划预算：${money(value.total)} USD。\n- 仅为按仓库内置单价计算的本地估算，非实时价格，不含音乐、图片、Claude 与本地计算费用；实际以服务方当期计费为准。\n\n` +
    `## 审片与验收\n\n- [ ] 歌词、典故和双方回应已经确认。\n- [ ] 人物、服装、道具在镜头间保持可接受的一致性。\n- [ ] 每句人声未被模型改唱，延迟已检查。\n- [ ] 人工看过嘴型与遮挡；音轨相似不作为口型准确的充分证据。\n- [ ] 剪辑节奏、字幕与歌曲一致；重做前确认费用。\n- [ ] 超时任务先按 task_id 查询远端状态，避免重复计费。\n- [ ] 检查所用音乐、图片、视频的使用授权，发布时声明 AI 生成。\n\n` +
    `## 路线提醒\n\n${route.note}\n\n` +
    `## 来源与边界\n\n上游：${UPSTREAM}\n固定版本：${COMMIT}\n操作手册：${source("SKILL.md")}\n上游许可证：MIT。\n本清单只由 011 研究网页在浏览器本地生成，不会提交付费任务；上游完整 34 句制作流程仍待实测。\n`;
}

byId("brief-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const a = byId("rival-a").value.trim();
  const b = byId("rival-b").value.trim();
  const status = byId("download-status");
  if (!a || !b || a === b) {
    status.textContent = "请填写两位不同的历史人物。";
    byId(!a ? "rival-a" : "rival-b").focus();
    return;
  }
  const blob = new Blob([makeBrief(a, b)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${a}-vs-${b}-制作清单.md`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "");
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  status.textContent = `已下载「${a} vs ${b}」制作清单。未提交任何生成任务。`;
});

renderCapabilities();
wireTabs("data-stage", setStage);
wireTabs("data-mechanism", setMechanism);
wireTabs("data-route", setRoute);
setStage(0);
setMechanism(0);
updateSyncExample();
setRoute(0);
loadOwnSample().then(loadStageFilm).then(loadH3AudioPilot).then(loadRepairedFilm);
loadPilotDemo();

async function loadH3AudioPilot() {
  for (const id of ["h3-pilot-video", "h3-pilot-source-audio"]) byId(id).addEventListener("play", () => pauseOtherPlayers(byId(id)));
  try {
    const response = await fetch("./data/004-h3-audio-pilot.json", { cache: "no-store" });
    if (!response.ok) throw new Error("H3 record unavailable");
    const report = await response.json();
    const { validateH3PilotReport } = await import("./h3-pilot-report.mjs");
    validateH3PilotReport(report);
    const userAccepted = report.status === "pilot-accepted-by-user";
    if (!report.output) {
      const observed = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(report.task.official_query_observed_at));
      byId("h3-pilot-status").textContent = `截至${observed}，官方查询任务1027778仍在等待。网页进度连接报错不表示生成失败，没有重复提交。`;
    }
    if (report.output) {
      const video = byId("h3-pilot-video");
      video.src = `./${report.output.path}`;
      video.poster = `./${report.poster.path}`;
      video.width = report.output.width; video.height = report.output.height;
      video.hidden = false;
      byId("h3-pilot-output-pending").hidden = true;
      byId("h3-pilot-badge").textContent = "原片已返回 · 待带声验收";
      byId("h3-pilot-status").textContent = "同一任务的视频已返回，演唱效果待对照原曲验收；尚未据此重做整首。";
      if (userAccepted) {
        byId("h3-pilot-badge").textContent = "用户试听确认可用 · 仅此试片";
        byId("h3-pilot-badge").classList.add("h3-pilot-accepted");
        byId("h3-pilot-status").textContent = `用户试听反馈：“${report.evaluation.human_acceptance.feedback}”。确认只针对这条H3试片，整片仍在修复。`;
        video.setAttribute("aria-label", "H3真实原片，用户已试听确认此试片口型可用");
        byId("research-status").textContent = "H3试片口型由用户确认可用 · 整片修复中";
        byId("hero-production-note").textContent = "新的5秒H3试片已由用户试听确认口型可用，正在修复整片；此前94.64秒视觉样片的拒收结论保留。";
        byId("main-film-action").href = "#h3-audio-pilot";
        byId("main-film-action").textContent = "看已确认的5秒试片 ↓";
        byId("summary-progress").textContent = "新的H3试片口型已由用户试听确认可用。整片修复中，尚未展示新的完整成片；旧视觉样片拒收结论保留。";
        byId("summary-current-method-label").textContent = "这次如何修复";
        byId("summary-current-method").textContent = "普通H3全能模式明确提交人物图、舞台图和对应原曲音频。用户已试听确认5秒试片口型可用，正按原曲时间轴重做主角演唱，保留可复用的舞台与观众。";
      }
      const open = byId("h3-pilot-open");
      open.href = `./${report.output.path}`; open.hidden = false;
      byId("h3-pilot-model-note").textContent = `原片${report.output.width}×${report.output.height}、${report.output.fps}fps、${report.output.frames}帧，视频${report.output.duration}秒，比5秒输入约长${(report.output.duration - 5).toFixed(3)}秒；保留模型原声。`;
      if (report.diagnostic) {
        byId("h3-pilot-switch").hidden = false;
        for (const button of document.querySelectorAll("[data-h3-pilot-asset]")) button.addEventListener("click", async () => {
          const asset = report[button.dataset.h3PilotAsset];
          video.pause(); video.src = `./${asset.path}`; video.load(); open.href = `./${asset.path}`;
          for (const sibling of document.querySelectorAll("[data-h3-pilot-asset]")) sibling.setAttribute("aria-pressed", String(sibling === button));
          video.setAttribute("aria-label", button.dataset.h3PilotAsset === "output" ? (userAccepted ? "H3模型原片，用户确认此试片口型可用" : "H3模型原片，保留原声，演唱效果待验收") : "H3零偏移配原曲诊断，只替换声音，未修嘴部");
          byId("h3-pilot-status").textContent = button.dataset.h3PilotAsset === "output" ? (userAccepted ? "模型原片：用户已试听确认这一条口型可用；整片效果另行验收。" : "模型原片：保留生成时的原声，演唱效果待带声验收。") : "配原曲诊断：同一画面、零偏移替换声音，不是新生成；用户确认来自试听反馈，非换声或相关性分数。";
          try { await video.play(); } catch { byId("h3-pilot-status").textContent += " 请点击播放器开始。"; }
        });
      }
      video.load();
    }
  } catch {
    byId("h3-pilot-status").textContent = "试验状态记录暂未载入；不能据此判断任务生成失败或演唱效果。原曲片段仍可独立试听。";
  }
}

async function loadRepairedFilm() {
  const section = byId("repaired-film-004");
  if (!section) return;
  try {
    const response = await fetch("./data/004-repaired-film.json", { cache: "no-store" });
    if (!response.ok) throw new Error("repair report unavailable");
    const report = await response.json();
    const { validateRepairedFilmReport } = await import("./repaired-film-report.mjs");
    const assets = validateRepairedFilmReport(report);
    if (!assets.length) {
      const progress = report.production_progress;
      if (progress) byId("h3-pilot-production-status").textContent = `整片修复中：${progress.confirmed_tasks}条正式任务已确认，${progress.reviewed_source_keys.length}条已审可用，${progress.pending_source_keys.length}条演唱镜头等待生成。新的完整视频尚未到齐。`;
      return;
    }
    if (section.dataset.repairedFilmReady !== "true") return;
    const video = byId("repaired-film-video"), status = byId("repaired-film-status");
    video.src = `./${report.assets.video.path}`; video.poster = `./${report.assets.poster.path}`;
    byId("repaired-film-open").href = `./${report.assets.video.path}`;
    byId("repaired-film-duration").textContent = `${report.video.duration}秒`;
    for (const [id, value, unit] of [
      ["repair-metric-duration", report.video.duration, "秒"],
      ["repair-metric-shots", report.edit_summary.shots, "镜"],
      ["repair-metric-performance", report.edit_summary.corresponding_performance_seconds, "秒"],
      ["repair-metric-audience", report.edit_summary.audience_seconds, "秒"],
    ]) byId(id).replaceChildren(document.createTextNode(String(value)), Object.assign(document.createElement("small"), { textContent: unit }));
    if (report.budget) {
      const b = report.budget;
      byId("repair-budget-facts").replaceChildren(...[
        ["累计已提交", b.committed], ["未确认预留", b.unconfirmed_reserve],
        ["总预算敞口", `${b.exposure} / ${b.cap}`], ["剩余额度", b.remaining],
      ].map(([name, amount]) => {
        const item = document.createElement("div");
        item.append(Object.assign(document.createElement("dt"), { textContent: name }), Object.assign(document.createElement("dd"), { textContent: String(amount) }));
        return item;
      }));
      byId("repair-budget-note").textContent = `试片确认后的${b.production_tasks}条任务，官方费用回报合计${b.production_reported_credits}钻，已含在累计已提交中。预留${b.unconfirmed_reserve}钻保守计入额度；独立消费账单尚未核对，以上不是已核实实支。`;
    }
    const accepted = report.status === "user-accepted-final";
    const label = accepted ? "新修复版已由用户验收确认。" : "新修复版已导出，整片效果待验收；5秒试片确认不代表整片通过。";
    status.textContent = label;
    video.addEventListener("play", () => { pauseOtherPlayers(video); status.textContent = `正在播放新的原曲驱动修复版。${label}`; });
    video.addEventListener("pause", () => { status.textContent = video.ended ? `新修复版播放结束。${label}` : "已暂停，可继续播放。"; });
    section.hidden = false;
    byId("main-film-action").href = "#repaired-film-004";
    byId("main-film-action").textContent = "查看新的修复版 ↓";
    byId("stage-film-nav").href = "#repaired-film-004";
    byId("stage-film-nav").hidden = false;
    byId("pilot-back-to-film").href = "#repaired-film-004";
    document.querySelector('meta[name="description"]').content = "《压轴人间》94.64秒原曲驱动舞台版：人物演唱、舞台与观众镜头，完整原曲及真实制作记录；旧版本独立留档。";
    byId("research-status").textContent = label;
    byId("hero-production-note").textContent = `新的原曲驱动修复版已导出。${accepted ? "用户已确认整片效果。" : "整片效果仍待验收，不能以5秒试片确认代替。"}旧拒收样片独立保留。`;
    byId("summary-progress").textContent = label;
    byId("summary-stage-state").textContent = accepted ? "新修复版 · 用户已确认" : "新修复版已导出 · 待整片验收";
    byId("summary-stage-number").replaceChildren(document.createTextNode(String(report.video.duration)), Object.assign(document.createElement("span"), { textContent: "秒新修复版" }));
    byId("summary-stage-description").textContent = "保留完整原曲，演唱使用明确音频参考的远端镜头，配合舞台、观众与细节。旧94.64秒视觉样片的拒收结论保留，可在下方单独对照。";
    byId("summary-stage-link").href = "#repaired-film-004";
    byId("summary-stage-link").textContent = "查看新的修复版 ↓";
    byId("summary-current-method-label").textContent = "这次如何修复";
    byId("summary-current-method").textContent = "主角演唱镜头明确提交对应原曲音频，按同一歌曲时段剪入；舞台、观众与无脸细节交替呈现。完整原曲保留，未使用MV或本地口型模型。";
    byId("h3-pilot-production-status").textContent = "新的94.64秒修复版已导出，可在上方直接播放；这一句的用户确认与新整片效果分别记录。";
    byId("h3-pilot-intro").textContent = "ChatArt普通H3音频参考试片 · 用户确认仅限这一条；新的整片已在上方展示。";
    byId("h3-pilot-status").textContent = "这条5秒试片由用户试听确认可用；新的94.64秒整片已在上方展示，效果分别验收。";
    byId("repaired-film-method").textContent = `${report.edit_summary.corresponding_performance_seconds}秒主角演唱明确使用对应原曲音频驱动，配合舞台、观众与无脸细节，完整保留94.64秒歌曲时间轴；不声称整首均为正脸演唱或逐字精准口型。`;
    video.load();
    if (location.hash === "#repaired-film-004") section.scrollIntoView({ block: "start" });
  } catch { section.hidden = true; }
}

async function loadPilotDemo() {
  const notes = {
    "stage-original": "10秒模型原片，保留模型原声。舞台与动作已跑通；本条未测试原曲演唱口型。",
    "stage-song-preview": "配《压轴人间》0–9.4秒前奏。用于看人物与舞台，不是演唱口型测试。",
    "singing-original": "已把原曲片段随参考媒体提交，但后台是否识别为音频驱动未知；模型原声不一致，原曲口型尚未通过验证。",
    "singing-reference-diagnostic": "仅用原曲9.4–14.4秒替换声音，视频画面未改、嘴部未修。此版本用于对照，不代表口型通过。",
  };
  const status = byId("pilot-record-status");
  for (const id of ["pilot-stage-video", "pilot-singing-video", "pilot-song-audio"]) {
    const player = byId(id);
    player.addEventListener("play", () => pauseOtherPlayers(player));
    player.addEventListener("error", () => {
      const target = id === "pilot-stage-video" ? "pilot-stage-note" : id === "pilot-singing-video" ? "pilot-singing-note" : "pilot-song-status";
      byId(target).textContent = "播放暂未成功，可使用下方的单独打开链接。";
    });
  }
  try {
    const { validatePilotReport } = await import("./pilot-report.mjs");
    const response = await fetch("./data/004-pilot-demo.json");
    if (!response.ok) throw new Error("record unavailable");
    const report = await response.json();
    validatePilotReport(report);
    status.textContent = "早期历史快照 · 2条真实任务 / 4个播放版本 · 原曲口型未验证通过";
    for (const button of document.querySelectorAll("[data-pilot-asset]")) {
      button.addEventListener("click", async () => {
        const asset = report.assets.find(item => item.id === button.dataset.pilotAsset);
        const player = byId(button.dataset.pilotPlayer);
        const note = byId(player.id === "pilot-stage-video" ? "pilot-stage-note" : "pilot-singing-note");
        player.pause();
        player.src = `./${asset.path}`;
        player.setAttribute("aria-label", `${asset.title}，004真实试片`);
        player.load();
        for (const sibling of document.querySelectorAll(`[data-pilot-player="${player.id}"]`)) sibling.setAttribute("aria-pressed", String(sibling === button));
        note.textContent = notes[asset.id];
        try { await player.play(); } catch { note.textContent = `${notes[asset.id]} 点击视频播放按钮，或单独打开。`; }
      });
    }
  } catch {
    status.textContent = "早期制作记录暂未载入；下方真实试片仍可直接播放。";
  }
  const song = byId("pilot-song-audio");
  let compareEnd = null;
  byId("pilot-song-compare").addEventListener("click", async () => {
    compareEnd = 14.4;
    song.currentTime = 9.4;
    byId("pilot-song-status").textContent = "正在对照原曲9.4–14.4秒；到片段末尾自动暂停。";
    try { await song.play(); } catch { compareEnd = null; byId("pilot-song-status").textContent = "已定位9.4秒，请点击音频播放按钮。"; }
  });
  song.addEventListener("timeupdate", () => {
    if (compareEnd !== null && song.currentTime >= compareEnd) {
      song.pause();
      compareEnd = null;
      byId("pilot-song-status").textContent = "5秒原曲对照结束。可继续使用播放器试听完整歌曲。";
    }
  });
}

async function loadStageFilm() {
  const section = byId("stage-film-004");
  if (section?.dataset.stageFilmReady !== "true") return;
  try {
    const response = await fetch("./data/004-stage-film.json", { cache: "no-store" });
    if (!response.ok) throw new Error("stage film unavailable");
    const report = await response.json();
    const { validateStageFilmReport } = await import("./stage-film-report.mjs");
    const stats = validateStageFilmReport(report);
    const video = byId("stage-film-video"), status = byId("stage-film-status");
    const url = `./${report.assets.video.path}`;
    video.src = url;
    video.poster = `./${report.assets.poster.path}`;
    byId("stage-film-open").href = url;
    byId("stage-film-download").href = url;
    byId("stage-film-evidence").href = "./data/004-stage-film.json";
    const facts = [
      ["导出时长", "94.64秒 · 原曲完整保留"],
      ["舞台画面", `${stats.sourceCount}条动态视频 · ${stats.cutCount}个剪辑镜头`],
      ["人物", "李白 × 杜甫 · 同一组GPT参考"],
      ["生成方式", "ChatArt Skill · 普通视频 · 不用MV"],
      ["演唱结果", "嘴部不对应 · 口型未通过"],
      ["可复用素材", "统一人物参考、舞台与观众镜头"],
    ];
    const list = byId("stage-film-facts");
    list.replaceChildren();
    for (const [label, value] of facts) {
      const item = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = label; dd.textContent = value; item.append(dt, dd); list.append(item);
    }
    const technical = byId("stage-film-technical-facts");
    technical.replaceChildren();
    for (const [label, value] of [
      ["该视觉样片阶段费用", `${report.cost.credits_committed}钻任务费用＋${report.cost.reserved_unconfirmed_credits}钻未确认预留 / 2400钻上限；新H3试验另记`],
      ["实际成片格式", "1280×720 · 25fps · 2366帧"],
      ["原曲处理", `${report.audio.gain_db}dB一次，未裁切、未变速；末尾补不足一帧静音`],
      ["来源与生成", "仅远端动态视频，无静图覆盖；不用本地生成模型"],
    ]) {
      const item = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = label; dd.textContent = value; item.append(dt, dd); technical.append(item);
    }
    const chapters = byId("stage-film-chapters");
    chapters.replaceChildren();
    for (const chapter of report.chapters) {
      const button = document.createElement("button");
      button.type = "button";
      const time = `${Math.floor(chapter.start / 60)}:${String(Math.floor(chapter.start % 60)).padStart(2, "0")}`;
      button.textContent = `${time} ${chapter.title}`;
      button.addEventListener("click", async () => {
        video.currentTime = chapter.start;
        try { await video.play(); } catch { status.textContent = `已定位${chapter.title}，点击播放器开始。`; }
      });
      chapters.append(button);
    }
    const limitations = byId("stage-film-limitations");
    limitations.replaceChildren();
    for (const limitation of report.limitations) { const li = document.createElement("li"); li.textContent = limitation; limitations.append(li); }
    byId("stage-film-qa").textContent = "导出、整曲、来源和播放检查通过，只证明文件可播放；用户验收反馈演唱嘴部不对应，本版演唱效果未通过。费用记录保留，独立消费账单未核验。";
    video.addEventListener("loadedmetadata", () => { status.textContent = "94.64秒视觉样片已载入 · 演唱口型未通过。"; });
    video.addEventListener("play", () => { pauseOtherPlayers(video); status.textContent = "正在播放《压轴人间》舞台视觉样片，演唱口型未通过。"; });
    video.addEventListener("pause", () => { status.textContent = video.ended ? "视觉样片播放结束；演唱口型未通过。" : "已暂停，可继续播放或拖动进度。"; });
    video.addEventListener("error", () => { status.textContent = "视频暂未载入，可点击单独打开或下载成片。"; });
    section.hidden = false;
    byId("stage-film-nav").hidden = false;
    const mainAction = byId("main-film-action");
    mainAction.href = "#stage-film-004"; mainAction.textContent = "查看《压轴人间》样片 ↓";
    byId("stage-film-nav").textContent = "压轴样片";
    byId("hero-production-note").textContent = "《压轴人间》94.64秒视觉样片已导出，但嘴部不对应原曲，演唱目标未达成。舞台和观众素材继续保留。";
    byId("research-status").textContent = "《压轴人间》舞台视觉样片 · 演唱口型未通过";
    byId("own-sample-jump").textContent = "对照《敬风霜》舞台版 ↓";
    byId("own-sample-jump").href = "#own-sample";
    byId("summary-progress").textContent = "《压轴人间》视觉样片已导出，演唱口型未通过。文件播放正常不能代表演唱效果合格。";
    byId("summary-stage-state").textContent = "舞台视觉样片 · 演唱口型未通过";
    byId("summary-stage-state").classList.add("pending");
    byId("summary-stage-number").replaceChildren(document.createTextNode("94.64"), Object.assign(document.createElement("span"), { textContent: "秒已导出" }));
    byId("summary-stage-description").textContent = `${stats.sourceCount}条真实视频剪成${stats.cutCount}镜，但新增9条未提交原曲驱动，嘴部与歌曲不对应。舞台和观众可复用，主角演唱须另外验证并重做。`;
    byId("summary-stage-link").href = "#stage-film-004";
    byId("summary-stage-link").textContent = "查看未通过的视觉样片 ↓";
    byId("pilot-back-to-film").href = "#stage-film-004";
    byId("pilot-back-to-film").textContent = "返回视觉样片 ↑";
    byId("pilot-progress").textContent = "以下为此前两条口型试验的历史快照；上方94.64秒视觉样片同样未通过演唱口型验收。";
    byId("source-disclosure").textContent = "上游原作按固定版本保留来源与许可证。《压轴人间》94.64秒视觉样片使用用户完整原曲与ChatArt普通生成视频。新增9条没有提交原曲音频驱动，后期配回原曲，嘴部不对应，演唱目标未达成；保留舞台、观众、费用与失败记录。不用MV和本地生成模型。003《敬风霜》、002与001原字节留档均保留。";
    video.load();
    if (location.hash === "#stage-film-004") section.scrollIntoView({ block: "start" });
  } catch {
    section.hidden = true;
    byId("stage-film-nav").hidden = true;
  }
}

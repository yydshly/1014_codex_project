// One contract for build-time, local HTTP checks, and the browser's song display.
// No generation requests, filesystem access, or provider inference happens here.
import { validatePerformanceFilmReport } from './performance-report.mjs';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const close = (a, b) => Math.abs(a - b) < 1e-5;
const ids = ['A01', 'A02', 'B01', 'B02'];

export function validateSongReport(report) {
  const experiment = report.provenance?.experiment_id;
  if (experiment === '004-performance-film') return validatePerformanceFilmReport(report);
  if (!['002-moon-and-earth', '003-stage-edition'].includes(experiment)) return null;
  const isStage = experiment === '003-stage-edition';
  const fail = message => { throw new Error(`完整歌曲记录无效：${message}`); };
  const require = (condition, message) => { if (!condition) fail(message); };
  const production = report.production, assembly = report.assembly;
  require(report.status === 'completed', '新作品只在真实成片完成后接入主播放器。');
  require(production && ['minimax-song', 'tts-code-beat', 'user-supplied-song'].includes(production.music_mode), '缺少实际音乐模式。');
  require(typeof production.music_provider === 'string' && production.music_provider.trim(), '缺少实际音乐来源。');
  require(typeof production.music_title === 'string' && production.music_title.trim(), '缺少实际歌曲标题。');
  require(typeof production.bpm_is_estimate === 'boolean', '节拍须说明是否为估测值。');
  require(finite(production.bpm) && production.bpm > 0 && finite(production.total_duration) && production.total_duration > 0, '歌曲时长或节拍无效。');
  const duration = production.total_duration, fps = report.assets?.video?.fps;
  require([24, 25].includes(fps), '缺少真实成片帧率。');
  require(sha(report.assets?.video?.sha256) && sha(report.assets?.poster?.sha256), '成片和封面须有SHA-256。');
  require(assembly?.source_hashes_verified === true && assembly.final_hash_verified === true, '源素材和成片散列尚未核对。');
  require(assembly.unified_audio === true, '必须用统一整曲音轨。');
  require(Array.isArray(report.clips) && report.clips.length === 4 && ids.every(id => report.clips.some(clip => clip.id === id)), '必须包含四句独立歌词。');
  require(assembly.unique_lyric_shots === 4, '独立歌词镜头数须为4。');
  require(Number.isInteger(assembly.performance_occurrences) && assembly.performance_occurrences >= 4, '实际演唱次数缺失。');

  const sources = report.source_files;
  require(Array.isArray(sources) && sources.length >= 2 && sources.every(item => sha(item.sha256) && finite(item.duration) && item.duration > 0), '至少两条不同的真实源视频及其散列/时长须登记。');
  const sourceHashes = new Set(sources.map(item => item.sha256));
  require(sourceHashes.size === sources.length && assembly.source_clips === sources.length, '源视频数量须按不同散列统计，分切或复用不算新增素材。');
  const occurrences = [];
  for (const clip of report.clips) {
    require(clip.status === 'completed' && clip.video_generated === true && sha(clip.asset?.sha256), `${clip.id}没有真实生成画面来源。`);
    require(Array.isArray(clip.occurrences) && clip.occurrences.length > 0, `${clip.id}缺少首次或重唱出现记录。`);
    for (const occurrence of clip.occurrences) {
      require(typeof occurrence.id === 'string' && occurrence.id.trim(), `${clip.id}演唱出现缺少编号。`);
      require([occurrence.start, occurrence.end, occurrence.heard_start, occurrence.heard_end].every(finite), `${clip.id}演唱出现缺少完整时间。`);
      require(occurrence.start >= 0 && occurrence.end <= duration + 1e-5 && occurrence.end > occurrence.start && occurrence.heard_start >= occurrence.start && occurrence.heard_end > occurrence.heard_start && occurrence.heard_end <= occurrence.end, `${clip.id}演唱时间超出镜头范围。`);
      require(sourceHashes.has(occurrence.source_sha256) && occurrence.source_sha256 === clip.asset.sha256, `${clip.id}演唱出现未关联实际源视频。`);
      occurrences.push({ ...occurrence, line_id: clip.id });
    }
    const first = clip.occurrences[0];
    require(close(first.start, clip.start) && close(first.end, clip.end), `${clip.id}首次出现与歌词记录不一致。`);
  }
  require(new Set(occurrences.map(item => item.id)).size === occurrences.length && occurrences.length === assembly.performance_occurrences, '演唱出现编号重复或次数不符。');

  const visuals = report.visual_timeline;
  require(Array.isArray(visuals) && visuals.length >= occurrences.length, '缺少完整视觉时间表。');
  require(new Set(visuals.map(item => item.id)).size === visuals.length, '视觉时间表编号重复。');
  let cursor = 0, artDuration = 0, performanceDuration = 0, artSegments = 0, performanceCount = 0;
  const usedSources = new Set();
  for (const item of visuals) {
    require([item.slot_start, item.slot_end].every(finite) && close(item.slot_start, cursor) && item.slot_end > item.slot_start && item.slot_end <= duration + 1e-5, '视觉时间表须从0连续覆盖整曲，不能留空或重叠。');
    const length = item.slot_end - item.slot_start;
    if (item.type === 'performance') {
      const occurrence = occurrences.find(entry => entry.id === item.id);
      require(occurrence && occurrence.line_id === item.line_id && occurrence.source_sha256 === item.sha256 && close(occurrence.start, item.slot_start) && close(occurrence.end, item.slot_end), `${item.id}未与真实歌词演唱出现对应。`);
      require(item.is_generated_video !== false, `${item.id}不能用图像运镜代替人物演唱。`);
      usedSources.add(item.sha256); performanceDuration += length; performanceCount++;
    } else {
      require(item.type === 'instrumental_art_motion' && item.is_generated_video === false && sha(item.sha256), `${item.id}器乐图像须明确为图像运镜并有来源散列。`);
      artDuration += length; artSegments++;
    }
    cursor = item.slot_end;
  }
  require(close(cursor, duration) && performanceCount === occurrences.length && usedSources.size === sourceHashes.size, '视觉时间表没有覆盖整曲、全部演唱或全部源视频。');
  const art = assembly.instrumental_art_motion;
  require(art && art.is_model_performance === false && art.segments === artSegments && finite(art.duration) && close(art.duration, artDuration), '器乐图像运镜的段数/秒数与视觉时间表不同。');

  const audio = report.audio, alignment = audio?.alignment;
  require(audio && sha(audio.sha256) && finite(audio.duration) && audio.duration > 0 && audio.source_clip_audio_used === false, '整曲音轨缺少实际散列、时长或统一混音声明。');
  require(alignment?.original_audio_trimmed_seconds === 0 && alignment.original_audio_speed === 1 && finite(alignment.padding_seconds) && alignment.padding_seconds >= 0 && alignment.padding_seconds <= 1 / fps + 1 / 48000, '整曲必须保留，只允许末尾补不超过一帧静音。');
  require(close(audio.duration + alignment.padding_seconds, duration), '整曲解码时长及补静音不能对应成片时长。');
  require(audio.gain_db === undefined || finite(audio.gain_db), '播放响度增益须是有限dB值。');
  let stageChanges = [], newSceneCount = 0, hasStageAmbience = false;
  if (isStage) {
    const revision = report.revision;
    require(revision?.kind === 'stage-reedit' && revision.base_experiment_id === '002-moon-and-earth' && revision.base_video_sha256 === '88c112607640aeaa960a4682aca4a533781d58b82e658af4ad2777fa1848871e', '舞台版须关联已归档的第二版成果。');
    require(revision.new_video_generation_calls === 0 && report.video_service?.created_tasks === 0 && report.cost?.new_video_credits_estimate === 0, '舞台重剪不能被登记为新增人物视频生成。');
    require(sources.every(item => item.source_experiment === '002-moon-and-earth'), '舞台版人物表演须明确沿用第二版来源。');
    const scenes = revision.new_scene_assets;
    require(Array.isArray(scenes) && scenes.length === 4 && scenes.every(item => typeof item.id === 'string' && item.id && sha(item.sha256)), '舞台版须登记四张实际新场景图。');
    require(new Set(scenes.map(item => item.id)).size === scenes.length && new Set(scenes.map(item => item.sha256)).size === scenes.length, '新场景不能重复计数。');
    require(scenes.every(scene => visuals.some(item => item.type === 'instrumental_art_motion' && item.sha256 === scene.sha256)), '新场景必须实际出现在重剪中。');
    require(Array.isArray(revision.changes) && revision.changes.length > 0 && revision.changes.every(item => typeof item === 'string' && item.trim()), '舞台重剪须说明实际改变的视角、场景或灯光。');
    const ambience = report.stage_ambience;
    require(ambience && typeof ambience.enabled === 'boolean', '舞台版须明确是否另加氛围声音。');
    if (ambience.enabled) {
      require(ambience.approved === true && ambience.source === 'local-synthesis' && ambience.new_melody === false && sha(ambience.sha256) && typeof ambience.path === 'string' && ambience.path.trim() && finite(ambience.gain_db), '舞台氛围声音须记录已批准的本地合成来源、散列和实际增益。');
      require(Array.isArray(audio.additions) && audio.additions.length === 1 && audio.additions.some(item => item.sha256 === ambience.sha256 && item.source === 'local-synthesis' && item.path === ambience.path && item.gain_db === ambience.gain_db && item.start === 0 && close(item.end, duration)), '新增氛围声音须与原歌曲分开登记，时间和增益须与实际混音相同。');
      hasStageAmbience = true;
    } else require(!audio.additions?.length, '未启用舞台氛围时不能登记已混入的声音。');
    stageChanges = revision.changes;
    newSceneCount = scenes.length;
  }
  return { occurrences, sourceCount: sources.length, performanceCount, artSegments,
    artDuration, performanceDuration, audioDuration: audio.duration,
    audioPadding: alignment.padding_seconds, audioGainDb: audio.gain_db ?? 0,
    isStage, stageChanges, newSceneCount, hasStageAmbience };
}

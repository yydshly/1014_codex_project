// 网页、Markdown 与 JSON 共享同一份总览内容；不请求外部数据。
export function overviewMarkdown(model, sources){
  const reference=id=>{const s=sources.find(s=>s.id===id);if(!s)throw new Error(`总览缺少来源 ${id}`);return `[${id} ${s.title}](${s.url})`;};
  return [
    '## 一张图：从源产品到我们的核心理解',
    `整理日期：${model.updated_at}。状态：${model.status}。`,model.title,model.subtitle,
    `### ${model.source.title}`,...model.source.lines,...model.source.notes,
    `相关来源：${model.source.refs.map(reference).join('；')}`,
    `### ${model.trial.title}`,...model.trial.lines,...model.trial.notes,
    `运行：${model.trial.run_id}；合成资料 SHA-256：${model.trial.corpus_sha256}`,
    '### 引发的核心追问',...model.questions.map(q=>`- ${q.title} ${q.lines.join('')}`),
    `### ${model.essence.title}`,model.essence.formula,model.essence.note,
    `### ${model.core.title}`,...model.core.lines,model.core.boundary,
    `### ${model.pipeline_title}`,...model.pipeline.map((s,i)=>`${i+1}. ${s.title}：${s.note}`),model.feedback,
    ...model.extensions.flatMap(s=>[`### ${s.title}`,...s.lines]),
    model.conclusion,model.boundary,`配图说明：${model.figure_note}`,
    '配图原件：网页提供 SVG / PNG 下载；完整 JSON 导出同时保留结构化图源、SVG 原文和文件哈希。'
  ].join('\n\n');
}

/** 将声学分组控制点转为仅改视频时轴的分段线性FFmpeg图，不修改原片。 */
export function retimeFor(document,id,sourceDuration,targetDuration,advance=0){
  const entry=document?.clips?.[id]??document?.[id];
  if(!entry||entry.enabled===false)return null;
  if(Math.abs(advance)>1e-9)throw new Error(`${id} 已启用retime，advance必须为0，不能叠加任意shift。`);
  const points=entry.control_points;
  if(!Array.isArray(points)||points.length<2)throw new Error(`${id} 缺少retime控制点。`);
  for(let i=0;i<points.length;i++){
    const p=points[i];
    if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p.some(x=>x<0))throw new Error(`${id} retime控制点格式错误。`);
    if(i&&(p[0]<=points[i-1][0]||p[1]<=points[i-1][1]))throw new Error(`${id} retime控制点必须严格递增。`);
    if(Math.abs(p[1]*100-Math.round(p[1]*100))>1e-5)throw new Error(`${id} 目标控制点需精确到0.01秒以避免内部段长舍入。`);
  }
  if(points[0][0]!==0||points[0][1]!==0||Math.abs(points.at(-1)[1]-targetDuration)>1e-6||points.at(-1)[0]>sourceDuration+0.001)
    throw new Error(`${id} retime需从[0,0]开始、以目标句槽结束，且不能超出原片长度。`);
  return {method:entry.method||document.method||'声学活动分组启发式，非逐词ASR/非口型证明',reason:entry.reason||'按控制点仅调整画面时间轴。',
    control_points:points,internal_segment_fps:100,slot_fps:25,original_audio_screening_passed:entry.original_audio_screening_passed??false,sync_passed:false,
    segments:points.slice(1).map((p,i)=>({source_start:points[i][0],source_end:p[0],target_start:points[i][1],target_end:p[1],
      source_duration:p[0]-points[i][0],target_duration:Number((p[1]-points[i][1]).toFixed(6)),setpts_scale:(p[1]-points[i][1])/(p[0]-points[i][0])}))};
}

export function appendRetimeGraph(graph,input,output,retime,{size='',prefix='rt',duration=4.8}={}){
  const segments=retime.segments;
  graph.push(`[${input}]setpts=PTS-STARTPTS${size?','+size:''},split=${segments.length}${segments.map((_,i)=>`[${prefix}src${i}]`).join('')}`);
  for(let i=0;i<segments.length;i++){
    const s=segments[i];
    // 各目标边界都在0.01秒网格：100fps可保留精确段长，不逐段25fps舍入。
    // tpad仅重复边界帧填补抽帧取整造成的小间隙，不伪造人物动作。
    graph.push(`[${prefix}src${i}]trim=start=${s.source_start}:end=${s.source_end},setpts=(PTS-STARTPTS)*${s.setpts_scale},fps=100,tpad=stop_mode=clone:stop_duration=0.2,trim=duration=${s.target_duration},setpts=PTS-STARTPTS[${prefix}part${i}]`);
  }
  graph.push(`${segments.map((_,i)=>`[${prefix}part${i}]`).join('')}concat=n=${segments.length}:v=1:a=0,fps=25,tpad=stop_mode=clone:stop_duration=0.08,trim=duration=${duration},setpts=PTS-STARTPTS[${output}]`);
}

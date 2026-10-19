import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'work/chatart-tasks.json');
try { await fs.access(target); throw new Error('已有任务账本，禁止覆盖或重复提交'); } catch(e) { if(e.code!=='ENOENT') throw e; }
const shared='这是《敬风霜》音乐短片的单人连续演唱镜头。严格保持图片1的国风3D动画电影造型、面孔、发型、服装和月下唐风屋顶场景。全程只有参考图中的一个人，近正面的胸部以上中近景，轻微缓慢推近，不切镜。嘴唇与下颌始终清楚可见，青铜麦克风始终在胸前、下巴下方，不得遮挡嘴。音频1包含必须同步的原唱和伴奏，准确跟随现有中文发音、长音、节奏与停顿进行口型和克制的演唱表演；使用原音频，不重新作曲或配音，不改字、变速、移调或添加其他人声。仅在有演唱时张嘴，器乐或停顿时自然收嘴、眨眼、呼吸。保持脸部和手部稳定，不夸张甩头或挥手。不添加任何文字、字幕、Logo、水印、观众或第二个人。';
const specs=[
 {id:'A-block',actor:'李白',reference:'refs/libai-v2.png',audio:'music/candidates/A-main-mix-candidate.wav',source_in:18.2,source_out:28.2,prompt:shared+'年轻白袍青绿肩饰诗人，自信潇洒、带微笑，轻微点头。按音频顺序演唱两句：“酒杯一举，银河都来捧场”“你的工整，装不下我的月光”。第一句大约在0.5至4.5秒，保留其后原有词尾回声；第二句大约在5.5至9.3秒。以音频实际时序优先，不机械按提示词重新朗读。'},
 {id:'B-block',actor:'杜甫',reference:'refs/dufu-v2.png',audio:'music/candidates/B-main-mix-candidate.wav',source_in:27.6,source_out:37.6,prompt:shared+'成熟短须、深蓝铜金纹袍诗人，沉稳坚定，轻微点头、有力量地回应画外对手。按音频顺序演唱两句：“月光再亮，也得照见风霜”“我把人间，写成压轴的回响”。第一句大约在0.7至4.6秒，第二句大约在5.5至9.2秒；保留原有句间停顿和词尾长音。以音频实际时序优先，不机械按提示词重新朗读。'}
];
for(const s of specs) { for(const k of ['reference','audio']) {const bytes=await fs.readFile(path.join(root,s[k]));s[k+'_sha256']=crypto.createHash('sha256').update(bytes).digest('hex');} s.status='prepared_not_submitted';s.model_label='MiniMax H3';s.duration_requested=10;s.resolution_label='768p';s.aspect_ratio='16:9';s.credits_displayed=150;s.provider='ChatArt';s.clip=`clips/${s.id}_t1.mp4`; }
await fs.mkdir(path.join(root,'work'),{recursive:true});
await fs.writeFile(target,JSON.stringify({schema_version:1,experiment_id:'002-moon-and-earth',title:'敬风霜 · 李白 × 杜甫',status:'prepared',provider:'ChatArt',credit_cap:300,planned_credits:300,credit_balance_before:5415,actual_debit_verified:false,no_paid_rerolls:true,music_source:'用户提供《敬风霜》，用户说明由Gemini生成；具体模型未独立核验',source_song_sha256:'91f5993a91f49e455fe9c60f60cc799692a96a40afa78c6b80e0f35831dbe8c8',created_at:new Date().toISOString(),tasks:specs},null,2)+'\n');
console.log('已准备2条10秒任务，标价300钻，上限300；尚未提交。');

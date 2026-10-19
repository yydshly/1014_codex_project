"""Build the user-facing, offline ChatArt production packet. No external calls."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import csv
import hashlib
import html
import json
import shutil
import struct
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'handoff-source'
OUT = ROOT / 'delivery/ya-zhou-ren-jian-chatart'
ZIP = OUT.parent / '压轴人间-ChatArt制作包.zip'
EXPECTED_SHA = 'cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0'
existing_results = OUT / '04-生成结果放这里'
if existing_results.exists():
    assert not any(p.is_file() and p.name != '文件命名.txt' for p in existing_results.rglob('*')), '结果目录已有用户素材；请勿将回片混入待生成制作包。'


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def esc(s):
    return html.escape(str(s), quote=True)


def sec(s):
    return f'{float(s):.2f}'.rstrip('0').rstrip('.')


def window(a, b):
    return f'{sec(a)}–{sec(b)} 秒'


def dump(p, d):
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def write(p, text):
    p.write_text(text, encoding='utf-8-sig' if p.suffix == '.txt' else 'utf-8')


director = json.loads((SOURCE / 'director-package.json').read_text(encoding='utf-8'))
audio = json.loads((SOURCE / 'audio-manifest.json').read_text(encoding='utf-8'))
shots = director['video_tasks']
images = director['image_tasks']
segments = {s['id']: s for s in audio['segments']}
assert len(shots) == len(segments) == 13
assert len(images) == 4
assert len([s for s in shots if s['required']]) == 11
assert sha(ROOT / 'music/source-ya-zhou-ren-jian.mp3') == EXPECTED_SHA

for folder in ('00-参考图', '01-定妆提示词', '02-音频', '03-视频提示词', '04-生成结果放这里', '05-记录'):
    (OUT / folder).mkdir(parents=True, exist_ok=True)

# Reference files come from this run's GPT generation, never from the packet builder.
# Missing metadata is allowed; a supplied checksum must match the actual PNG.
reference_metadata_path = ROOT / 'refs/reference-images.json'
reference_metadata = json.loads(reference_metadata_path.read_text(encoding='utf-8-sig')) if reference_metadata_path.exists() else {}
reference_entries = reference_metadata if isinstance(reference_metadata, list) else reference_metadata.get('assets', reference_metadata.get('images', []))
if isinstance(reference_entries, dict):
    reference_entries = [dict(value, id=value.get('id', key)) for key, value in reference_entries.items() if isinstance(value, dict)]
assert isinstance(reference_entries, list), '参考图来源中的assets/images须为列表或字典'
reference_defaults = reference_metadata if isinstance(reference_metadata, dict) else {}
references = {}
for image in images:
    filename = image['filename']
    assert Path(filename).name == filename and filename.endswith('.png'), '参考图必须使用固定PNG文件名'
    src, dst = ROOT / 'refs' / filename, OUT / '00-参考图' / filename
    record = next((item for item in reference_entries if isinstance(item, dict) and (
        item.get('id') == image['id'] or Path(str(item.get('filename') or item.get('path') or '')).name == filename)), {})
    entry = {'id': image['id'], 'filename': filename, 'project_path': f'refs/{filename}',
             'status': 'pending-gpt-generation', 'provided': False,
             'provider': record.get('provider') or record.get('tool') or reference_defaults.get('provider') or reference_defaults.get('tool') or '本轮GPT图像生成；来源细节待补',
             'model': record.get('model') or reference_defaults.get('model'),
             'reference_images': record.get('reference_images', []),
             'note': record.get('note') or '由我们提供GPT参考图，ChatArt仅负责视频。'}
    if src.is_file():
        data = src.read_bytes()
        assert len(data) >= 24 and data[:8] == b'\x89PNG\r\n\x1a\n' and data[12:16] == b'IHDR', f'参考图不是有效PNG：{filename}'
        digest = hashlib.sha256(data).hexdigest()
        assert not record.get('sha256') or record['sha256'].lower() == digest, f'参考图来源SHA不符：{filename}'
        width, height = struct.unpack('>II', data[16:24])
        assert width > 0 and height > 0
        shutil.copyfile(src, dst)
        assert sha(dst) == digest
        entry.update(status='provided-gpt-reference', provided=True, path=f'00-参考图/{filename}',
                     sha256=digest, bytes=len(data), width=width, height=height,
                     metadata_record_present=bool(record))
    elif dst.exists():
        # Remove only a known prior packet copy, so a failed new run cannot show stale art.
        dst.unlink()
    references[filename] = entry
    image['asset_status'] = entry['status']
    image['provided_file'] = entry.get('path')
    image['prompt_role'] = 'GPT定妆设计依据，仅供参考，不是ChatArt图片生成任务'
provided_reference_count = sum(item['provided'] for item in references.values())
missing_reference_names = [name for name, item in references.items() if not item['provided']]
reference_status = f'已提供{provided_reference_count}/4张GPT参考图' if provided_reference_count else 'GPT参考图待生成，当前没有可上传的人物图'
reference_missing_note = ('待补齐：' + '、'.join(missing_reference_names) + '。不要启动依赖缺图的镜头，也无需去ChatArt重新定妆。') if missing_reference_names else '四张图已随包提供，直接按任务卡上传，无需在ChatArt生成图片。'
dump(OUT / '05-记录/GPT参考图来源.json', {'status': 'complete' if provided_reference_count == 4 else 'pending-gpt-references',
     'metadata_project_path': 'refs/reference-images.json', 'metadata_present': reference_metadata_path.exists(),
     'provided_count': provided_reference_count, 'required_count': 4, 'assets': list(references.values())})
execution_prompts_path = ROOT / 'refs/gpt-image-prompts.json'
if execution_prompts_path.is_file():
    execution_prompts = json.loads(execution_prompts_path.read_text(encoding='utf-8'))
    execution_prompts['master_design_prompt_file'] = '05-记录/director-package.json → image_tasks[id=R01-MASTER].original_design_prompt'
    dump(OUT / '05-记录/GPT图片生成提示词.json', execution_prompts)

required_seconds = sum(s['request_seconds'] for s in shots if s['required'])
all_seconds = sum(s['request_seconds'] for s in shots)
assert required_seconds == 104 and all_seconds == 114
for shot in shots:
    a = segments[shot['audio_id']]
    for k in ('song_in', 'song_out', 'use_song_in', 'use_song_out', 'request_seconds'):
        assert abs(shot[k] - a[k]) < 1e-5, (shot['id'], k, shot[k], a[k])
    assert shot['song_in'] <= shot['use_song_in'] < shot['use_song_out']
    assert shot['use_song_out'] <= shot['song_out'] + (0.025 if shot['id'] == 'END' else 1e-6)
    assert shot['request_seconds'] + 1e-6 >= shot['song_out'] - shot['song_in']
    for ext in ('wav', 'mp3'):
        src = SOURCE / a[ext]
        assert sha(src) == a[f'sha256_{ext}']
        target = OUT / '02-音频' / src.name
        shutil.copyfile(src, target)
        shot[f'upload_{ext}'] = f'02-音频/{src.name}'
        a[ext] = shot[f'upload_{ext}']
        a[f'{ext}_metadata']['path'] = shot[f'upload_{ext}']
    shot['audio_files'] = {
        'wav': {'path': shot['upload_wav'], 'sha256': a['sha256_wav'], 'bytes': a['bytes_wav']},
        'mp3': {'path': shot['upload_mp3'], 'sha256': a['sha256_mp3'], 'bytes': a['bytes_mp3']},
        'paths_relative_to': 'package-root',
    }
    shot['prompt_file'] = f"03-视频提示词/{shot['number']:02d}-{shot['id']}.txt"
    refs = '、'.join(f"00-参考图/{name}" for name in shot['reference_images'])
    missing_refs = [name for name in shot['reference_images'] if not references[name]['provided']]
    header = (f"{shot['number']:02d} · {shot['title']}（{shot['id']}）\n"
              f"{'主镜头' if shot['required'] else '可选补镜'}\n"
              f"参考图上传顺序：{refs}\n"
              f"参考图状态：{'已提供，可直接上传' if not missing_refs else 'GPT待生成：' + '、'.join(missing_refs)}\n"
              f"参考图用法：{shot.get('reference_usage', '使用素材/主体参考，不是首尾帧转换')}\n"
              f"音频：{Path(shot['upload_wav']).name}（WAV优先；MP3为同段备用，二选一）\n"
              f"上传音频对应原曲：{window(shot['song_in'], shot['song_out'])}\n"
              f"生成时长：{shot['request_seconds']} 秒；若不可选，选择不短于音频的最近可用时长\n"
              "建议16:9，先用现有积分可用的768p档；确认支持参考图+上传音频\n"
              f"后期建议取用原曲：{window(shot['use_song_in'], shot['use_song_out'])}\n"
              f"下载命名：{shot['expected_output_filename']}；重做改_t2/_t3，保留全部原文件\n\n"
              "将下面整段复制到视频提示词框（上面的文件说明不必粘贴）：\n\n")
    write(OUT / shot['prompt_file'], header + shot['prompt'] + '\n')

for image in images:
    image['prompt_file'] = f"01-定妆提示词/{Path(image['filename']).stem}.txt"
    refs = '、'.join(image['reference_images']) or '本轮GPT主图；其他参考从此图派生'
    write(OUT / image['prompt_file'],
          f"{image['title']} · GPT定妆设计依据（参考资料）\n文件：00-参考图/{image['filename']}\n参考关系设计：{refs}\n"
          "图由我们通过GPT生成并提供；本TXT保留设计依据，不是让你在ChatArt重新生成图片的任务。缺图时等待我们补齐。\n\n"
          f"本轮定妆提示词参考：\n\n{image['prompt']}\n")

shutil.copyfile(ROOT / 'music/source-ya-zhou-ren-jian.mp3', OUT / '02-音频/完整原曲-压轴人间.mp3')
shutil.copyfile(ROOT / 'docs/full-song-lyrics.txt', OUT / '05-记录/参考歌词-以实际音频为准.txt')

intro = f'''《压轴人间》ChatArt制作包

先打开「00-开始制作.html」。可以离线查看、试听、复制提示词。
{reference_status}。视频尚待你在ChatArt生成。
{reference_missing_note}

一、按这个顺序做
1. 先查看「00-参考图」中我们提供的GPT图：R01主图，以及从同一主图派生的R02李白、R03杜甫、R04场地。按每条任务卡顺序直接上传，ChatArt只做视频。缺图会明确标为GPT待生成，请等我们补齐，不要自行从零重画。01-定妆提示词仅保留设计依据。
2. 在ChatArt选择可同时上传人物/场景参考图与音频的视频模式。先前页面中MiniMax H3全能参考提供此类入口，具体以你当前页面可用功能为准。这里用身份/主体/素材参考，不要把人物图和空舞台图分别填成首帧与尾帧；如果只看到首尾帧入口，先切换模式。只有图片、没有音频输入的模式不适合本包的演唱镜头。
3. 先试02-A1（李白主唱10秒），再试01-OPEN（舞台开场10秒）。人物、演唱和舞台动作满意后，再生成03至11。12/13是推荐的可选气氛补镜，在主唱通过后再做。
4. 每条打开同编号视频提示词TXT，按顺序上传指定图片和一个对应音频，复制完整提示词，设16:9、指定时长、现有积分可用的768p档。WAV优先，MP3只是兼容备用，不要同时上传两份音频。
5. 下载平台原始完整视频，按01-OPEN_t1.mp4这类编号命名，放进「04-生成结果放这里」。保留原片声音；不要自己裁剪、变速、加字幕或重配音乐。失败/重做也保留，第二次用_t2。
6. 全部或首批完成后，把结果所在文件夹路径发给我。我会验片、选片、核对口型、接镜、统一铺回完整原曲、加字幕和调色，并接回网页。

二、整首歌与分镜
完整原曲约94.6155秒，最终视频预计94.64秒，原曲不裁切、不变速。以下「上传音频」有少量前后重叠，供模型起唱及后期接镜；不是让你把这些音频首尾拼成歌。模型多生成的尾部也不属于原曲。真正接镜位置会在收到素材后按画面和声音微调。
本包所有上传音频均源自你给的《压轴人间》，仅恒定降低1.5dB；没有补唱、分离人声或改词。源歌词中两句未可靠定位、一句疑似重复，以实际音频为准，提示词不强塞缺句。角色按创作中的李白/杜甫分配，不声称原歌已有人声分轨。

三、预算
用户原先给定本轮总上限2400钻。当前ChatArt只安排视频，包含已受理失败及重做，不再安排四张ChatArt定妆图的200钻估算；GPT图来源单独记录。视频参考价15钻/秒：11条主镜头请求{required_seconds}秒约{required_seconds * 15}钻；加两条补镜共{all_seconds}秒约{all_seconds * 15}钻。此前有50钻任务状态未确认，暂保守留出50钻，不能把它当成已扣费，也不能当成确定可用额度。
按此参考，主镜头+50预留约1610钻；含补镜约1760钻，剩640钻左右可留重做。价格与权限会变，每次以你提交页面显示的实际标价为准；若时长只能选5/10/15秒，应向上取整，11条将合计120秒，含补镜130秒，按15钻/秒加50预留约2000钻，余400钻。不可向下取整截断上传音频，也不要为某一档位直接购买订阅。
「05-记录/生成记录.csv」可记实际任务、标价和回片；重做单独新增一行。HTML中的勾选只是本机备忘，不会替你向ChatArt提交，也不证明任务已受理。

四、回片看什么
人物脸、发型、服装和左右站位应与定妆一致；身体、衣袖、观众、灯束应有真实运动与空间视差。主唱必须跟随对应上传音频，不另起一首歌，不改词、不替换歌声。先连续看片，再带声看一遍嘴部与手部。明显串脸、换衣、嘴不动、错人开口或人物长时间冻结的片子标记待重做。
即使平台只把音频用于节奏参考而未做好口型，也请保留原片并告诉我；提示词无法保证模型能力，不能用新配音乐掩盖原片问题。

文件夹
00-参考图：我们实际提供的GPT图；缺图请等待补齐，不显示伪造占位图。
01-定妆提示词：4份GPT定妆设计依据，仅供参考，不是ChatArt图片任务。
02-音频：13段WAV、13段同内容MP3备用，以及完整原曲。
03-视频提示词：11条主镜头、2条可选补镜，均为完整可独立复制的提示词。
04-生成结果放这里：ChatArt原始MP4，重做不覆盖；提供的GPT图留在00目录。
05-记录：完整分镜、歌词参考、生成记录模板、GPT参考图来源和文件清单。

来源记录：音乐由用户提供，用户说明由Gemini生成；GPT人物图由我们提供，实际文件状态和来源见「05-记录/GPT参考图来源.json」，视频待用户在ChatArt生成。工作流研究参考ancient-rap-battle，固定提交e5e40fa3612777133a141c8448122dd0fd45e4cc，上游代码MIT；本包不含上游视频或旧版演示片。
'''
write(OUT / '先读我.txt', intro)
write(OUT / '04-生成结果放这里/文件命名.txt',
      '参考图由我们生成，已提供图保存在00-参考图；缺图等待补齐，不是ChatArt出图任务。\n'
      '视频：按对应任务名下载，例如02-A1_t1.mp4，重做用02-A1_t2.mp4。\n'
      '请保留平台原始下载文件和声音，不提前裁剪、变速、加字幕或重配音。\n'
      '实际文件名不同也可保留，在生成记录中写清编号即可。\n')

with (OUT / '05-记录/生成记录.csv').open('w', encoding='utf-8-sig', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['编号', '任务', '重做次数', '模型与档位', '请求秒数', '页面标价钻石', '任务是否实际受理', '结果状态', '本地文件名', '备注'])
    for shot in shots:
        writer.writerow([shot['id'], shot['title'], 't1', '', shot['request_seconds'], '', '', '', shot['expected_output_filename'], '主镜头' if shot['required'] else '可选补镜'])

story_lines = ['《压轴人间》完整分镜与回片清单', '原曲完整保留，下面是拍摄/生成计划，最终取用待审片微调。', '']
for s in shots:
    story_lines.extend([f"{s['number']:02d} {s['title']} ({s['id']}) {'主镜头' if s['required'] else '可选补镜'}",
                        f"上传原曲 {window(s['song_in'], s['song_out'])}；请求 {s['request_seconds']} 秒；后期候选 {window(s['use_song_in'], s['use_song_out'])}",
                        s['shot_description'], f"参考图（00-参考图目录，按此顺序）：{'、'.join(s['reference_images'])}",
                        f"音频：{Path(s['upload_wav']).name}", f"歌词说明：{s['lyric_note']}",
                        f"视频文件：{s['expected_output_filename']}", ''])
write(OUT / '05-记录/完整分镜.txt', '\n'.join(story_lines))
director['package_paths_relative_to'] = 'package-root'
director['original_director_status'] = director['status']
director['status'] = 'ready-for-user-video-generation' if provided_reference_count == 4 else 'awaiting-gpt-reference-images'
director['provided_reference_images'] = list(references.values())
director['reference_image_workflow'] = 'GPT参考图由我们提供；ChatArt仅做视频；定妆提示词是设计参考，不是用户图片生成任务。'
director['original_generation_order'] = director.get('generation_order', [])
director['generation_order'] = [
    '查看00-参考图中我们提供的GPT主图及同主图派生的人物/场地图；缺图等待补齐，无需在ChatArt出图。',
    '先用02-A1试李白唱词，再用01-OPEN试舞台运动；按任务卡顺序上传提供的参考图与一个音频。',
    '两条通过后按03至11制作，12/13补镜可选；下载完整原片并按编号交回。',
]
director['original_budget_reference'] = director.get('budget_reference', {})
director['budget_reference'] = {
    'currency': 'ChatArt diamonds', 'user_cap': 2400, 'prices_are_reference_not_invoice': True,
    'reference_768p_credits_per_second': 15, 'required_requested_seconds': required_seconds,
    'total_requested_seconds': all_seconds, 'required_video_reference_credits': required_seconds * 15,
    'with_optional_video_reference_credits': all_seconds * 15,
    'chatart_image_tasks_required': False, 'planned_chatart_image_credits': 0,
    'gpt_reference_cost_policy': 'GPT图由我们提供，来源另列；不把ChatArt四张图200钻旧估算计入当前计划，不据此宣称GPT生成无成本。',
    'prior_unconfirmed_risk_credits': 50, 'with_optional_reference_exposure': all_seconds * 15 + 50,
    'remaining_reference_credits': 2400 - all_seconds * 15 - 50,
    'fallback_if_only_5_10_15_s': {'required_request_seconds': 120, 'total_seconds': 130,
        'video_reference_credits': 1950, 'prior_unconfirmed_risk_credits': 50,
        'total_reference_exposure': 2000, 'remaining_to_2400': 400},
    'note': '只安排ChatArt视频，已受理失败与重做仍计入2400；50仅为未确认风险，不能写成已扣费。每次以实际页面报价与权限为准。',
}
director['original_director_manifest_sha256'] = sha(SOURCE / 'director-package.json')
director['source_song']['original_project_path'] = director['source_song']['path']
director['source_song']['path'] = '02-音频/完整原曲-压轴人间.mp3'
audio['package_paths_relative_to'] = 'package-root'
audio['original_audio_manifest_sha256'] = sha(SOURCE / 'audio-manifest.json')
audio['source_song']['original_project_path'] = audio['source_song']['project_path']
audio['source_song']['project_path'] = '02-音频/完整原曲-压轴人间.mp3'
dump(OUT / '05-记录/director-package.json', director)
dump(OUT / '05-记录/audio-manifest.json', audio)

image_cards = []
for n, image in enumerate(images, 1):
    ref = references[image['filename']]
    if ref['provided']:
        preview_html = (f'<a href="{esc(ref["path"])}" target="_blank" rel="noopener"><img class="reference-preview" src="{esc(ref["path"])}" '
                        f'width="{ref["width"]}" height="{ref["height"]}" loading="lazy" alt="本轮GPT参考图：{esc(image["title"])}"></a>'
                        f'<p><a download href="{esc(ref["path"])}">下载 {esc(image["filename"])}</a> · {ref["width"]}×{ref["height"]}</p>'
                        f'<p class="muted">来源：{esc(ref["provider"])}{(" / " + esc(ref["model"])) if ref.get("model") else ""}<br>SHA-256：{esc(ref["sha256"])}</p>')
        status_html = 'GPT图已提供 · 直接上传，不用在ChatArt重新出图'
        checkbox = f'<label class="done"><input type="checkbox" data-check="{esc(image["id"])}"> 已查看参考图</label>'
    else:
        preview_html = '<p class="reference-pending">GPT参考图待生成。本包没有这张真实图片，不能预览或下载；请等待我们补齐，不要在ChatArt重新定妆。</p>'
        status_html = '待我们生成并补齐GPT图'
        checkbox = ''
    image_cards.append(f'''<article class="card image-card" id="{esc(image['id'])}">
<div class="card-head"><span class="num">R0{n}</span><div><h3>{esc(image['title'])}</h3><p class="muted"><b>{esc(image['filename'])}</b> · {esc(status_html)}</p></div></div>
{preview_html}<details><summary>查看GPT定妆设计依据 · 仅作参考</summary><p>这些提示词保留本轮设计依据，不是让你在ChatArt生成图片的任务。逐图来源见<a href="05-记录/GPT参考图来源.json">参考图来源记录</a>。</p><textarea readonly aria-label="{esc(image['title'])}设计参考">{esc(image['prompt'])}</textarea><div class="actions"><button class="copy" type="button">复制设计参考</button><a download href="{esc(image['prompt_file'])}">下载参考 TXT</a>{checkbox}</div></details></article>''')

shot_cards = []
rows = []
for s in shots:
    target = window(s['use_song_in'], s['use_song_out'])
    label = '主镜头' if s['required'] else '可选补镜'
    rows.append(f'''<tr><td><a href="#{esc(s['id'])}">{s['number']:02d} · {esc(s['id'])}</a></td><td>{esc(s['title'])}<small>{label}</small></td><td>{esc(window(s['song_in'], s['song_out']))}</td><td>{s['request_seconds']} 秒</td><td>{esc(target)}</td></tr>''')
    refs = '<br>'.join(f'图片{i + 1}：<b>' + (f'<a download href="{esc(references[r]["path"])}">{esc(r)}</a>' if references[r]['provided'] else f'{esc(r)}（GPT待生成）') + '</b>' for i, r in enumerate(s['reference_images']))
    missing_refs = [name for name in s['reference_images'] if not references[name]['provided']]
    missing_html = f'<p class="reference-pending">本条参考图尚未补齐：{esc("、".join(missing_refs))}。先等待GPT图，不要开始此镜头。</p>' if missing_refs else ''
    review = s.get('review_points', [])
    review_html = '<ul>' + ''.join(f'<li>{esc(r)}</li>' for r in review) + '</ul>' if review else ''
    shot_cards.append(f'''<article class="card video-card" id="{esc(s['id'])}">
<div class="card-head"><span class="num">{s['number']:02d}</span><div><p class="tag">{label} · {s['request_seconds']}秒生成 · 16:9</p><h3>{esc(s['title'])}</h3><p class="muted">{esc(s['id'])} · 下载命名 <b>{esc(s['expected_output_filename'])}</b></p></div></div>
<p class="direction">{esc(s['shot_description'])}</p>
{missing_html}
<div class="task-grid"><div><h4>上传的参考图 · 按此顺序</h4><p>{refs}</p></div><div><h4>上传一个音频</h4><p><b>{esc(Path(s['upload_wav']).name)}</b><br>原曲 {esc(window(s['song_in'], s['song_out']))}</p></div><div><h4>生成与后期取用</h4><p>生成 <b>{s['request_seconds']} 秒</b><br>后期候选：原曲 {esc(target)}</p></div></div>
<audio controls preload="none" aria-label="{esc(s['title'])}参考音频"><source src="{esc(s['upload_wav'])}" type="audio/wav"><source src="{esc(s['upload_mp3'])}" type="audio/mpeg">请下载本条音频试听。</audio>
<div class="audio-links"><a download href="{esc(s['upload_wav'])}">下载 WAV · 优先上传</a><a download href="{esc(s['upload_mp3'])}">下载 MP3 · 兼容备用</a><a download href="{esc(s['prompt_file'])}">下载本条完整 TXT</a></div>
<p class="note">{esc(s['lyric_note'])}</p>
<details><summary>查看 / 复制本条完整视频提示词</summary><textarea readonly aria-label="{esc(s['title'])}视频提示词">{esc(s['prompt'])}</textarea><div class="actions"><button class="copy" type="button">复制提示词</button><label class="done"><input type="checkbox" data-check="{esc(s['id'])}"> 已下载原片</label></div></details>
<details class="review"><summary>本条回片重点</summary>{review_html}</details></article>''')

page = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>压轴人间 · ChatArt 制作包</title><link rel="stylesheet" href="制作包.css"><script src="制作包.js" defer></script></head>
<body><header><div class="wrap"><p class="eyebrow">CHATART · 视频生成 / 后期交接</p><h1>压轴人间</h1><p class="lead">一场月光与人间的对唱。我们提供统一GPT人物与舞台参考，你在ChatArt生成视频，之后交回素材剪辑。</p><div class="badges"><span>完整原曲 94.6 秒</span><span>GPT参考图 {provided_reference_count}/4 张</span><span>11 条主镜头 + 2 条补镜</span><span>视频待生成</span></div><div class="hero-links"><a href="#start">开始制作 ↓</a><a id="download-package" download hidden href="../压轴人间-ChatArt制作包.zip">下载完整制作包 ZIP</a><a download href="先读我.txt">下载操作说明</a><a download href="05-记录/生成记录.csv">下载生成记录表</a></div></div></header>
<nav aria-label="制作包目录"><div class="wrap"><a href="#start">制作顺序</a><a href="#images">GPT参考图</a><a href="#storyboard">完整分镜</a><a href="#videos">逐段提示词与音频</a><a href="#budget">预算</a><a href="#return">交回素材</a></div></nav>
<main class="wrap"><section id="start"><p class="eyebrow">01 / 先小批试拍</p><h2>用提供的GPT图，拍李白与开场</h2><div class="steps"><article><b>1. 查看提供的图</b><p>{esc(reference_status)}。人物与场地由我们从统一主图派生，直接使用「00-参考图」，无需在ChatArt重新出图。</p></article><article><b>2. 试拍两条</b><p>参考图齐全后，先 <a href="#A1">02-A1 李白主唱</a>，再 <a href="#OPEN">01-OPEN 开场</a>。脸、演唱、身体动作与舞台空间满意后，才做其余主镜头。</p></article><article><b>3. 逐条生成视频</b><p>选择支持“参考图＋上传音频”的视频模式。按任务卡上传提供的图片和一个 WAV，复制提示词，设置16:9、指定长度。MP3只是同内容备用。</p></article><article><b>4. 交回原片</b><p>下载原始完整视频，按编号保存。保留声音、失败版与重做版；之后由我来选片、接镜、配回完整原曲与做字幕。</p></article></div><div class="callout"><b>{esc(reference_status)}</b><p>{esc(reference_missing_note)}</p></div><div class="callout"><b>ChatArt 只做视频</b><p>优先找 MiniMax H3 的全能参考或其他明确支持“图片＋音频”的入口，以你当前页面的能力为准。先用现有积分可用的768p档。若没有音频上传入口，先别批量生成；普通图生视频无法仅靠文字保证演唱口型。多图请放在素材/主体参考入口，不要将人物图和空舞台图分别当成首帧与尾帧。生成时长不得短于本条音频。</p></div></section>
<section id="images"><p class="eyebrow">02 / 统一身份与空间</p><h2>GPT人物与舞台参考图</h2><p>{esc(reference_status)}。{esc(reference_missing_note)}预览和下载只对实际提供的PNG开放，不使用占位图。参考图约束身份与场地，视频仍需生成自然表演和真实镜头运动。<a href="05-记录/GPT参考图来源.json">查看逐图来源与SHA</a>；定妆TXT仅作设计参考。</p>{''.join(image_cards)}</section>
<section id="storyboard"><p class="eyebrow">03 / 完整歌曲，完整故事</p><h2>分镜总览</h2><p>“上传区间”保留了少量重叠供生成与接镜；“后期取用”是候选剪辑位置，收到素材后会微调。最终只使用一遍完整原曲，不把音频切片重复拼接。</p><div class="table-scroll"><table><thead><tr><th>编号</th><th>镜头</th><th>上传音频 · 原曲位置</th><th>生成长度</th><th>后期候选 · 原曲位置</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div><p><a download href="05-记录/完整分镜.txt">下载完整分镜 TXT</a> · <a download href="02-音频/完整原曲-压轴人间.mp3">下载完整原曲</a> · <a download href="05-记录/参考歌词-以实际音频为准.txt">查看参考歌词</a></p><div class="callout"><b>歌词以实际音频为准</b><p>“鞋底沾着泥土，纸上落着风霜”“敬月光，也敬风霜”两句尚未可靠定位；“这一笔，敬担当”一处疑似发生重复。不要让视频模型补唱参考词，也不要自行补字幕。音频中的真实停顿、重复和长音全部保留。</p></div></section>
<section id="videos"><p class="eyebrow">04 / 一张任务卡，一次生成</p><h2>逐段提示词与对应音频</h2><p>每条提示词均可独立复制，已写入人物、服装、舞台、动作和镜头安排。上传同编号音频，按列出的顺序放参考图；不要重新生成音乐。</p>{''.join(shot_cards)}</section>
<section id="budget"><p class="eyebrow">05 / 为关键镜头留重做空间</p><h2>2400 钻总上限</h2><div class="budget-grid"><article><small>11 条主镜头 · 请求 {required_seconds} 秒</small><strong>约 {required_seconds * 15} 钻</strong></article><article><small>加 2 条补镜 · 请求 {all_seconds} 秒</small><strong>约 {all_seconds * 15} 钻</strong></article><article><small>GPT参考图 · 我们提供</small><strong>{'4张已提供' if provided_reference_count == 4 else '待补齐'}</strong></article></div><p>ChatArt只做视频，不再计入四张ChatArt图片的200钻估算。按15钻/秒，含全部补镜及此前50钻未确认预留，约1760钻，约留640钻重做。50钻是保守预留，实际扣费未核实；已受理失败和重做仍计入总额度，GPT图来源另行记录。</p><p>若页面仅提供5/10/15秒，就为每条向上选够长：主镜头共120秒，含补镜130秒；按同价加50预留约2000钻，重做余量约400钻。每次提交前以你页面的实际标价与可用权限为准，不能把估算当作报价。用生成记录表登记已受理视频任务，重做另加一行。</p></section>
<section id="return"><p class="eyebrow">06 / 原始素材交接</p><h2>生成后，把文件夹路径发给我</h2><div class="callout"><b>视频放进「04-生成结果放这里」</b><p>按 01-OPEN_t1.mp4、02-A1_t1.mp4 等任务名保存。重做使用_t2、_t3，保留全部版本。我们提供的GPT图保留在「00-参考图」，不需要你在ChatArt另做图片。</p></div><p>保留平台原始完整下载与原片声音，无须预先裁剪、变速、加字幕或重新配乐。你可先交回试拍的李白与开场两条，我会先判断是否值得继续生成其余镜头。</p><p>收到素材后，我会核对人物一致、动态表演、角色与口型，再做选片、接镜、完整原曲合成、字幕、调色和网页呈现。</p><p class="muted">本页勾选仅保存在当前浏览器中作备忘，不会提交生成，也不证明平台任务已完成。<button type="button" class="text-button" id="reset-checks">清除本页勾选</button></p></section>
</main><footer class="wrap"><p>制作资料 · 本地交接版 · {datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y-%m-%d')}<br>音乐为用户提供的《压轴人间》；GPT参考图实际提供 {provided_reference_count}/4 张，视频待在ChatArt生成。本包不调用生成服务，不自动扣费。</p></footer><p id="copy-status" role="status" aria-live="polite"></p></body></html>'''
write(OUT / '00-开始制作.html', page)

css = '''*{box-sizing:border-box}[hidden]{display:none!important}html{scroll-behavior:smooth;scroll-padding-top:84px}body{margin:0;color:#243149;background:#f6f5f1;font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;line-height:1.75}a{color:#86602d;text-decoration-thickness:1px;text-underline-offset:4px}a:hover{color:#503716}.wrap{width:min(1120px,calc(100% - 48px));margin:auto}header{background:#122337;color:#f8f4e9;padding:68px 0 54px;background-image:radial-gradient(circle at 90% 25%,#856b4244,transparent 38%)}h1{font-family:"Noto Serif SC","Songti SC","SimSun",serif;font-size:clamp(46px,6vw,76px);line-height:1.2;letter-spacing:.12em;margin:12px 0 24px}h2{font-size:30px;line-height:1.4;margin:8px 0 18px;color:#122337}h3{font-size:23px;line-height:1.45;margin:0 0 7px}h4{font-size:14px;margin:0 0 6px;color:#6d644f}p{margin:8px 0 16px}.lead{max-width:720px;color:#d8dfdf;font-size:18px}.eyebrow{font-size:12px;letter-spacing:.16em;font-weight:700;color:#a5814d}header .eyebrow{color:#d2b982}.badges,.hero-links,.actions,.audio-links{display:flex;flex-wrap:wrap;gap:12px}.badges{margin:24px 0}.badges span{border:1px solid #61707c;border-radius:30px;font-size:13px;padding:5px 13px}.hero-links a{color:#edd4a7}.hero-links{gap:24px}nav{position:sticky;top:0;z-index:5;background:#fbfaf7f2;border-bottom:1px solid #dcdedc;backdrop-filter:blur(10px)}nav .wrap{display:flex;gap:28px;overflow-x:auto;white-space:nowrap;padding-top:14px;padding-bottom:14px}nav a{font-size:14px;text-decoration:none;color:#354458}section{padding:52px 0 8px;scroll-margin-top:10px}section>p{max-width:960px}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:25px 0}.steps article{border-top:3px solid #b49159;background:#fff;padding:20px}.steps b{font-size:17px}.steps p{font-size:14px;color:#526070;margin:8px 0 0}.callout{background:#ebe8df;border-left:3px solid #b49159;padding:20px 24px;margin:24px 0}.callout p{margin:5px 0 0}.card{background:#fff;border:1px solid #dde1e1;border-radius:12px;margin:20px 0;padding:28px;scroll-margin-top:88px;box-shadow:0 5px 20px #172d4710}.card-head{display:flex;gap:18px;align-items:flex-start}.num{flex:0 0 52px;height:52px;display:grid;place-items:center;background:#172d43;color:#f3dfb7;border-radius:50%;font-size:18px;font-weight:650}.muted{font-size:13px;color:#67717b;overflow-wrap:anywhere}.tag{font-size:12px;letter-spacing:.06em;color:#9a7643;margin:0 0 5px}.task-grid{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:20px;background:#f5f6f4;padding:18px 20px;margin:20px 0}.task-grid p{font-size:14px;margin:0;overflow-wrap:anywhere}.direction{margin-top:16px;color:#465568}.note{font-size:13px;color:#6b6962;background:#faf7ef;padding:12px 16px;margin-top:18px}audio{width:100%;height:44px;display:block}.audio-links{font-size:13px;margin:10px 0 8px;gap:12px 22px}details{border-top:1px solid #e1e4e5;margin-top:18px;padding-top:16px}summary{cursor:pointer;font-weight:600;color:#263f53;line-height:1.6}textarea{display:block;width:100%;min-height:300px;resize:vertical;margin:18px 0 12px;padding:17px;background:#f7f8f8;border:1px solid #cdd4da;border-radius:7px;color:#283a4c;font:14px/1.85 system-ui,"Microsoft YaHei",sans-serif}button{font:inherit;cursor:pointer}button.copy{background:#233f54;color:white;border:0;border-radius:5px;padding:8px 17px;font-size:14px}.actions{align-items:center;font-size:13px}.done{margin-left:auto;color:#526577;display:flex;gap:8px;align-items:center}.done input{width:17px;height:17px;accent-color:#406a65}.review{font-size:13px}.review ul{padding-left:20px}.table-scroll{overflow-x:auto;border:1px solid #dce0df;border-radius:9px;background:#fff;margin:24px 0}table{border-collapse:collapse;min-width:780px;width:100%;font-size:14px}th,td{text-align:left;vertical-align:top;padding:13px 16px;border-bottom:1px solid #e6e8e7}th{background:#e8edec;font-size:12px;white-space:nowrap}td small{display:block;color:#899087;font-size:11px}tr:last-child td{border-bottom:0}.budget-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0}.budget-grid article{background:#e9eeed;padding:22px;border-radius:9px}.budget-grid small{color:#64716b;font-size:13px}.budget-grid strong{display:block;color:#1b423f;font-size:27px;margin-top:8px}.text-button{border:0;background:transparent;color:#86602d;padding:0 6px;font-size:13px;text-decoration:underline}.image-card textarea{min-height:260px}footer{font-size:12px;color:#84908d;padding-top:46px;padding-bottom:40px;border-top:1px solid #dce0df;margin-top:44px}#copy-status{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#132d41;color:#fff;border-radius:8px;padding:9px 20px;z-index:10;box-shadow:0 4px 20px #1234}#copy-status:empty{display:none}:focus-visible{outline:3px solid #c09f64;outline-offset:4px}@media(max-width:760px){.wrap{width:calc(100% - 32px)}header{padding:42px 0 36px}nav .wrap{gap:22px}h2{font-size:25px}.steps{grid-template-columns:repeat(2,1fr)}.task-grid{grid-template-columns:1fr;gap:14px}.card{padding:21px 18px}.num{flex-basis:43px;height:43px;font-size:15px}.card-head{gap:13px}h3{font-size:20px}.budget-grid{grid-template-columns:1fr}.done{margin-left:0}.callout{padding:17px 18px}textarea{min-height:360px;font-size:14px}}@media print{nav,.hero-links,.actions,.audio-links,audio,#copy-status{display:none}header{background:white;color:#123;padding:20px 0}header .lead{color:#456}.card{box-shadow:none;break-inside:avoid}details{display:block}details:not([open])>*:not(summary){display:block}textarea{height:auto;min-height:240px}.wrap{width:100%}}'''
css += '\n.reference-preview{display:block;width:100%;height:auto;max-height:540px;object-fit:contain;background:#122337;border-radius:8px;margin:20px 0 12px}.reference-pending{border-left:3px solid #b49159;background:#faf1e1;padding:12px 16px;color:#775320}\n'
write(OUT / '制作包.css', css)
js = ''''use strict';
if(/^https?:$/.test(location.protocol))document.getElementById('download-package').hidden=false;
const storageKey='ya-zhou-ren-jian-chatart-checks-v1';
const checks=[...document.querySelectorAll('[data-check]')];
let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{}
for(const box of checks){box.checked=saved[box.dataset.check]===true;box.addEventListener('change',()=>{saved[box.dataset.check]=box.checked;try{localStorage.setItem(storageKey,JSON.stringify(saved))}catch{}})}
let statusTimer;const announce=text=>{const s=document.getElementById('copy-status');s.textContent=text;clearTimeout(statusTimer);statusTimer=setTimeout(()=>s.textContent='',2600)};
for(const button of document.querySelectorAll('button.copy'))button.addEventListener('click',async()=>{const area=button.closest('details').querySelector('textarea');try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(area.value);announce('提示词已复制')}catch{area.focus();area.select();announce('已选中提示词，请按 Ctrl+C 复制')}});
document.getElementById('reset-checks').addEventListener('click',()=>{saved={};for(const box of checks)box.checked=false;try{localStorage.removeItem(storageKey)}catch{}announce('本页勾选已清除')});
'''
write(OUT / '制作包.js', js)

files = []
for p in sorted(OUT.rglob('*')):
    if p.is_file() and p.name != '文件清单.json':
        files.append({'path': p.relative_to(OUT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)})
package_manifest = {'title': '压轴人间 · GPT参考图与ChatArt视频制作包', 'status': 'ready-for-user-video-generation-not-a-completed-film' if provided_reference_count == 4 else 'awaiting-gpt-reference-images',
                    'source_song_sha256': EXPECTED_SHA, 'full_song_seconds': 4541545 / 48000,
                    'image_prompts': 4, 'provided_gpt_references': provided_reference_count, 'missing_gpt_references': missing_reference_names,
                    'required_video_tasks': 11, 'optional_video_tasks': 2,
                    'required_request_seconds': required_seconds, 'all_request_seconds': all_seconds,
                    'new_media_generated_by_this_package': 0, 'external_calls': 0, 'files': files}
dump(OUT / '文件清单.json', package_manifest)
with zipfile.ZipFile(ZIP, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for p in sorted(OUT.rglob('*')):
        if p.is_file():
            z.write(p, arcname='压轴人间-ChatArt制作包/' + p.relative_to(OUT).as_posix())

# Only the already-running loopback preview receives this temporary build output.
# No public/source-site assets or catalog entries are changed.
preview = ROOT.parent.parent / 'web/dist/handoff/ya-zhou-ren-jian'
shutil.copytree(OUT, preview, dirs_exist_ok=True)
for filename in missing_reference_names:
    stale_preview = preview / '00-参考图' / filename
    if stale_preview.exists():
        stale_preview.unlink()
shutil.copyfile(ZIP, preview.parent / '压轴人间-ChatArt制作包.zip')
print(json.dumps({'folder': str(OUT), 'zip': str(ZIP), 'zip_bytes': ZIP.stat().st_size,
                  'zip_sha256': sha(ZIP), 'files': len(files) + 1,
                  'preview': str(preview)}, ensure_ascii=False, indent=2))

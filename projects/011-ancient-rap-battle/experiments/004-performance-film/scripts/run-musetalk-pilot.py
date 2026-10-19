"""One real five-second single-face MuseTalk1.5 run; never autogrant visualQA.

Requires prepared isolatedruntime, pinnedmodels, and streamedFP16 conversion.
Preserves rawmedia. No paidAPI, audio upload, lyric alteration, or full-song run.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
TOOL = ROOT / 'local-tools/musetalk'
PYTHON = ROOT / 'local-tools/venv-musetalk/Scripts/python.exe'
PARENT = ROOT / 'clips/skill-lip-A1-t1-download/video_20261016003014.mp4'
AUDIO = ROOT / 'work/lip-pilot-A1/VA01-song-9.4-to-14.4.wav'
MODELS = ROOT / 'work/musetalk-models.json'
CONVERTED = ROOT / 'work/musetalk-fp16-conversion.json'
BASE = ROOT / 'work/lip-pilot-A1/musetalk'


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)],
                       capture_output=True, check=True)
    return json.loads(r.stdout)


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')


for p in [PARENT, AUDIO, PYTHON, MODELS, CONVERTED]:
    assert p.is_file(), f'Requiredactualinputmissing:{p}'
models = json.loads(MODELS.read_text(encoding='utf-8'))
conversion = json.loads(CONVERTED.read_text(encoding='utf-8'))
assert models['status'] == 'ready_all_hashes_checked'
assert conversion['status'] == 'derived_fp16_ready_not_inference'
unet = ROOT / conversion['output_path']
assert unet.is_file() and digest(unet) == conversion['output_sha256']
assert digest(AUDIO) == 'b98dfba5b2fa3b8e90aef1de239ba12f7287367bdcb24f07f4a090493a6d7104'
parent_probe = probe(PARENT)
audio_probe = probe(AUDIO)
assert abs(float(audio_probe['format']['duration']) - 5) < 1 / 48000
run_id = 'musetalk-v15-A1-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:6]
RUN = BASE / run_id
RUN.mkdir(parents=True, exist_ok=False)
RESULT = RUN / 'results'
RESULT.mkdir()
CONFIG = RUN / 'inference.yaml'
PREPARED = RUN / 'input-25fps-5s.mp4'
OUTPUT = RESULT / 'v15/pilot-A1-musetalk-v15.mp4'
FACE_REPORT = RUN / 'face-selection.json'
REPORT = RUN / 'run-report.json'
LATEST = BASE / 'run-report.json'
rel = lambda p: p.relative_to(ROOT).as_posix()
start = time.monotonic()
parent_hash = digest(PARENT)
audio_hash = digest(AUDIO)
config = {'video_path': PREPARED.as_posix(), 'audio_path': AUDIO.as_posix(),
          'result_name': 'pilot-A1-musetalk-v15.mp4'}
CONFIG.write_text('A1:\n' + ''.join(f'  {k}: {json.dumps(v)}\n' for k, v in config.items()), encoding='utf-8')
report = {'schema_version': 1, 'run_id': run_id, 'status': 'running',
          'created_at': datetime.now(timezone.utc).isoformat(),
          'source_kind': 'audio_driven_lip_correction',
          'parent_source': {'task_id': '1027559', 'path': rel(PARENT), 'sha256': parent_hash,
                            'bytes': PARENT.stat().st_size, 'probe': parent_probe,
                            'input_video_time_range': [0, 5], 'video_crop_xywh': None,
                            'raw_parent_preserved': True},
          'reference_audio': {'path': rel(AUDIO), 'sha256': audio_hash,
                              'source_song_sha256': 'cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0',
                              'song_in': 9.4, 'song_out': 14.4,
                              'duration_seconds': 5, 'gain_already_applied_db': -1.5,
                              'no_additional_gain': True, 'probe': audio_probe},
          'model': {'processor': 'MuseTalk', 'version': 'v15', 'repo': 'https://github.com/TMElyralab/MuseTalk',
                    'code_commit': '0a89dec45a0192b824e3cf4daf96c239440c5ed8',
                    'weights_manifest_path': rel(MODELS), 'weights_manifest_sha256': digest(MODELS),
                    'derived_weights_report_path': rel(CONVERTED), 'derived_weights_report_sha256': digest(CONVERTED),
                    'derived_unet_sha256': conversion['output_sha256'],
                    'local_patch_path': 'work/musetalk-low-memory.patch',
                    'local_patch_sha256': digest(ROOT / 'work/musetalk-low-memory.patch')},
          'config': {'path': rel(CONFIG), 'sha256': digest(CONFIG), 'fps': 25, 'batch_size': 1,
                     'use_float16': True, 'device': 'cuda:0', 'actor_ids': ['libai'],
                     'face_selection': 'single_largest_S3FD_face_reject_secondary_area_ratio_ge_0p5',
                     'face_region_model_resolution': [256, 256], 'DWPose_used': False,
                     'single_face_correction_only': True, 'decoded_frame_storage': 'disk_backed_memmap_identical_uint8pixels',
                     'source_body_and_stage_preserved_by_frame_compositing': True},
          'time_preservation': {'speed': 1, 'retimed': False, 'looped': False, 'frame_hold_seconds': 0,
                                'deliberate_motion_freeze_or_fill': False,
                                'selected_parent_video_seconds': 5, 'output_requested_seconds': 5,
                                'frame_rate_conversion': 'ffmpegfps24to25_forselected0to5seconds_noopticalflow_noaudiotimestretch',
                                'parent_extra_native_tail_not_selected_seconds': 1 / 24},
          'output': None,
          'visual_qa': {'visual_lip_sync_reviewed': False, 'accepted_for_lip_sync': False,
                        'full_clip_reviewed': False, 'mouth_unoccluded': None, 'identity_stable': None,
                        'no_obvious_lip_timing_drift': None, 'mouth_artifacts_acceptable': None,
                        'audio_correlation_used_as_lipsync_evidence': False,
                        'reason': 'Inferencecompletiondoesnotgrantvisualapproval;rootwillreviewnativeframeswithoriginalaudio.'},
          'audio_uploaded': False, 'paid_calls': 0, 'full_song_inference': False, 'errors': []}


def persist():
    save(REPORT, report)
    save(LATEST, report)


persist()
try:
    print(json.dumps({'stage': 'prepare_video', 'run_id': run_id}), flush=True)
    prep = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-i', str(PARENT),
            '-map', '0:v:0', '-an', '-t', '5', '-vf', 'fps=25', '-frames:v', '125',
            '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', '-threads', '1', str(PREPARED)]
    subprocess.run(prep, check=True, capture_output=True)
    prepared_probe = probe(PREPARED)
    v = next(s for s in prepared_probe['streams'] if s['codec_type'] == 'video')
    assert int(v['nb_frames']) == 125 and abs(float(v['duration']) - 5) < 1e-6
    report['prepared_video'] = {'path': rel(PREPARED), 'sha256': digest(PREPARED), 'probe': prepared_probe}
    env = os.environ.copy()
    env.update(MUSETALK_LOW_MEMORY='1', MUSETALK_SFD_ONLY='1', MUSETALK_FACE_REPORT=str(FACE_REPORT),
               MUSETALK_FRAME_CACHE=str(RUN / 'decoded-frame-cache.dat'),
               HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_IMPLICIT_TOKEN='1',
               HF_HUB_DISABLE_TELEMETRY='1', OMP_NUM_THREADS='2', MKL_NUM_THREADS='2', PYTHONIOENCODING='utf-8')
    args = [str(PYTHON), '-m', 'scripts.inference', '--inference_config', str(CONFIG),
            '--result_dir', str(RESULT), '--unet_model_path', str(unet),
            '--unet_config', str(TOOL / 'models/musetalkV15/musetalk.json'),
            '--version', 'v15', '--fps', '25', '--batch_size', '1', '--use_float16', '--saved_coord',
            '--output_vid_name', 'pilot-A1-musetalk-v15.mp4']
    report['command'] = args
    report['inference_log_path'] = rel(RUN / 'inference.log')
    persist()
    print(json.dumps({'stage': 'actual_model_inference', 'run_id': run_id, 'batch_size': 1}), flush=True)
    with (RUN / 'inference.log').open('w', encoding='utf-8', errors='replace') as log:
        result = subprocess.run(args, cwd=TOOL, env=env, stdout=log, stderr=subprocess.STDOUT)
    report['inference_exit_code'] = result.returncode
    if result.returncode:
        raise RuntimeError(f'MuseTalkexitcode{result.returncode};seerealstoredlog')
    if not OUTPUT.is_file():
        raise FileNotFoundError('Inferenceprocessdidnotproduceexpectedoutput;donotmarkcompleted')
    output_probe = probe(OUTPUT)
    ov = next(s for s in output_probe['streams'] if s['codec_type'] == 'video')
    assert ov['r_frame_rate'] == '25/1' and int(ov['nb_frames']) == 125
    assert abs(float(ov['duration']) - 5) <= 1 / 25
    subprocess.run(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(OUTPUT), '-f', 'null', '-'],
                   capture_output=True, check=True)
    report['output'] = {'path': rel(OUTPUT), 'sha256': digest(OUTPUT), 'bytes': OUTPUT.stat().st_size,
                        'fps': 25, 'frames': int(ov['nb_frames']), 'duration': float(ov['duration']),
                        'width': ov['width'], 'height': ov['height'], 'probe': output_probe,
                        'full_decode_passed': True,
                        'audio': {'present': any(s['codec_type'] == 'audio' for s in output_probe['streams']),
                                  'reference_audio_muxed_by_pipeline': True,
                                  'native_parent_audio_not_used': True,
                                  'not_independent_generated_audio_evidence': True}}
    if FACE_REPORT.is_file():
        report['face_selection_report'] = {'path': rel(FACE_REPORT), 'sha256': digest(FACE_REPORT)}
    assert digest(PARENT) == parent_hash and digest(AUDIO) == audio_hash
    report['status'] = 'completed'
except Exception as e:
    report['status'] = 'failed'
    report['errors'].append({'type': type(e).__name__, 'message': str(e)[:1000]})
finally:
    report['elapsed_seconds'] = round(time.monotonic() - start, 3)
    report['finished_at'] = datetime.now(timezone.utc).isoformat()
    persist()
    print(json.dumps({'status': report['status'], 'run_id': run_id, 'report': str(REPORT),
                      'output': report['output']['path'] if report['output'] else None,
                      'elapsed_seconds': report['elapsed_seconds']}, ensure_ascii=False), flush=True)
if report['status'] != 'completed':
    raise SystemExit(1)

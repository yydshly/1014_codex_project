"""Record the isolated inference environment and one tiny CUDA operation.

No model weights, user credentials, source audio, or external service is used.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import platform
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
REPORT = ROOT / 'work/musetalk-environment.json'
report = {'status': 'checking', 'created_at': datetime.now(timezone.utc).isoformat(),
          'python_executable': sys.executable, 'python_version': platform.python_version(),
          'platform': platform.platform(), 'isolated_venv_only': True,
          'torch_index': 'https://download.pytorch.org/whl/cu118',
          'other_dependency_index': 'https://pypi.org/simple',
          'audio_uploaded': False, 'model_inference': False, 'paid_calls': 0, 'errors': []}
try:
    import psutil
    import torch
    import numpy
    import cv2
    import diffusers
    import transformers
    import accelerate
    import librosa
    torch.set_num_threads(1)
    report['packages'] = {p: importlib.metadata.version(p) for p in [
        'torch', 'torchvision', 'torchaudio', 'numpy', 'opencv-python', 'diffusers',
        'transformers', 'accelerate', 'librosa', 'huggingface_hub', 'safetensors']}
    report['cuda'] = {'available': torch.cuda.is_available(), 'torch_build': torch.version.cuda}
    assert torch.cuda.is_available(), 'This pilot requires the authorized local CUDA GPU'
    report['cuda']['device'] = torch.cuda.get_device_name(0)
    tiny = torch.ones(1, device='cuda', dtype=torch.float16)
    report['cuda']['tiny_float16_operation_result'] = float((tiny + 1).cpu().item())
    assert report['cuda']['tiny_float16_operation_result'] == 2
    del tiny
    torch.cuda.empty_cache()
    free, total = torch.cuda.mem_get_info()
    report['cuda'].update(free_bytes_after_check=free, total_bytes=total)
    report['ram_available_bytes'] = psutil.virtual_memory().available
    report['disk_free_bytes'] = {str(p): psutil.disk_usage(p).free for p in ['F:/', 'D:/']}
    report['repo_commit'] = subprocess.check_output(
        ['git', '-C', str(ROOT / 'local-tools/musetalk'), 'rev-parse', 'HEAD'], text=True).strip()
    assert report['repo_commit'] == '0a89dec45a0192b824e3cf4daf96c239440c5ed8'
    freeze = subprocess.check_output([sys.executable, '-m', 'pip', 'freeze'], text=True)
    frozen = ROOT / 'work/musetalk-dependencies-freeze.txt'
    frozen.write_text(freeze, encoding='utf-8')
    report['dependency_freeze'] = {'path': frozen.relative_to(ROOT).as_posix(),
                                   'sha256': hashlib.sha256(frozen.read_bytes()).hexdigest()}
    report['status'] = 'ready_imports_and_tiny_cuda_checked_not_model_inference'
except Exception as error:
    report['status'] = 'failed'
    report['errors'].append({'type': type(error).__name__, 'message': str(error)[:1000]})
finally:
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False), flush=True)
if report['status'] == 'failed':
    raise SystemExit(1)

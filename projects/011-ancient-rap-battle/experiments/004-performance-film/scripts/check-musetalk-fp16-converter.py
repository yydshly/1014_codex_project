"""Small local serialization check before deriving the real official checkpoint.

Tests shared FloatStorage, offsets and non-contiguous strides against torch.half;
does not load the actual UNet or use the GPU.
"""
from collections import OrderedDict
from pathlib import Path
import importlib.util
import json
import torch

torch.set_num_threads(1)
ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / 'work/musetalk-serialization-check'
WORK.mkdir(exist_ok=True)
spec = importlib.util.spec_from_file_location('stream_converter', Path(__file__).with_name('convert-musetalk-fp16.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
source = WORK / 'local-fixture-fp32.pth'
target = WORK / 'local-fixture-fp16.pth'
assert not source.exists() and not target.exists(), 'Keep prior check evidence rather than overwrite it'
weight = torch.linspace(-2, 2, 24, dtype=torch.float32).reshape(4, 6)
fixture = OrderedDict(weight=weight, transposed=weight.T, offset_view=weight[1:, 2:], bias=torch.tensor([.1, -.2, 0.]))
torch.save(fixture, source)
conversion = module.convert(source, target, module.digest(source))
actual = torch.load(target, map_location='cpu', weights_only=True)
assert list(actual) == list(fixture)
checks = []
for key, expected in fixture.items():
    value = actual[key]
    assert value.dtype == torch.float16
    assert value.shape == expected.shape and value.stride() == expected.stride()
    assert value.storage_offset() == expected.storage_offset()
    assert torch.equal(value, expected.half())
    checks.append({'key': key, 'shape': list(value.shape), 'stride': list(value.stride()),
                   'storage_offset': value.storage_offset(), 'exact_equal_to_torch_half': True})
assert actual['weight'].untyped_storage().data_ptr() == actual['transposed'].untyped_storage().data_ptr()
assert actual['weight'].untyped_storage().data_ptr() == actual['offset_view'].untyped_storage().data_ptr()
report = {'status': 'passed_small_local_fixture_only', 'real_model_inference': False,
          'torch': torch.__version__, 'checks': checks, 'shared_storage_preserved': True,
          'conversion': conversion}
(ROOT / 'work/musetalk-fp16-converter-check.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report), flush=True)

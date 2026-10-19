"""Stream officialall-FloatStorage TorchZIP to localFP16, without fulltorch.load.

This only converts precision, never retrains or changes keys/shapes. The original
officialSHA-checkedFP32 checkpoint is preserved. Test with a smalllocalfixture
before use; runtime must still verify allparameterkeys whenloading the result.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import pickletools
import zipfile
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'local-tools/musetalk/models/musetalkV15/unet.pth'
TARGET = SOURCE.with_name('unet-fp16-local.pth')
SOURCE_SHA = '7ebf6c98c181e20838e4c0054e96e944ac60d5d692cc01db42839fe11b787007'


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def convert(source, target, expected_source_sha):
    assert digest(source) == expected_source_sha
    assert not target.exists(), f'Keep prior derived file: {target}'
    partial = target.with_suffix(target.suffix + '.partial')
    records = []
    with zipfile.ZipFile(source, 'r') as old, zipfile.ZipFile(partial, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as new:
        pickle_names = [n for n in old.namelist() if n.endswith('/data.pkl')]
        assert len(pickle_names) == 1
        pickle_name = pickle_names[0]
        assert old.getinfo(pickle_name).file_size < 4 * 1024 * 1024
        metadata = old.read(pickle_name)
        globals = sorted(set(arg for op, arg, pos in pickletools.genops(metadata) if op.name == 'GLOBAL'))
        assert globals == ['collections OrderedDict', 'torch FloatStorage', 'torch._utils _rebuild_tensor_v2'], globals
        needle = b'ctorch\nFloatStorage\n'
        assert metadata.count(needle) >= 1
        metadata = metadata.replace(needle, b'ctorch\nHalfStorage\n')
        prefix = pickle_name.removesuffix('data.pkl')
        for info in old.infolist():
            if info.filename == pickle_name:
                new.writestr(info.filename, metadata)
            elif info.filename.startswith(prefix + 'data/'):
                assert info.filename.removeprefix(prefix + 'data/').isdigit()
                assert info.file_size % 4 == 0
                count = 0
                with old.open(info) as reader, new.open(info.filename, 'w', force_zip64=True) as writer:
                    while True:
                        block = reader.read(4 * 1024 * 1024)
                        if not block:
                            break
                        assert len(block) % 4 == 0
                        floats = np.frombuffer(block, dtype='<f4')
                        assert np.all(np.isfinite(floats))
                        converted = floats.astype('<f2')
                        assert np.all(np.isfinite(converted))
                        writer.write(converted.tobytes())
                        count += len(block)
                assert count == info.file_size
                records.append({'storage': info.filename, 'elements': count // 4, 'source_bytes': count, 'derived_bytes': count // 2})
            else:
                assert info.file_size < 1024 * 1024
                data = old.read(info)
                if info.filename.endswith('/byteorder'):
                    assert data == b'little'
                new.writestr(info.filename, data)
    with zipfile.ZipFile(partial) as verified:
        assert verified.testzip() is None
        assert verified.namelist() == zipfile.ZipFile(source).namelist()
    partial.replace(target)
    return {'source_sha256': expected_source_sha, 'output_sha256': digest(target),
            'source_bytes': source.stat().st_size, 'output_bytes': target.stat().st_size,
            'storage_count': len(records), 'converted_elements': sum(x['elements'] for x in records),
            'all_source_float32_finite': True, 'all_derived_float16_finite': True,
            'pickle_global_whitelist_checked': globals, 'crc_stream_read_passed': True,
            'conversion': 'IEEE754float32tofloat16_viaNumPy_4MiBstreaming_keys_shapes_strides_unchanged',
            'new_training': False}


if __name__ == '__main__':
    import time
    started = time.monotonic()
    report = convert(SOURCE, TARGET, SOURCE_SHA)
    report.update(status='derived_fp16_ready_not_inference', created_at=datetime.now(timezone.utc).isoformat(),
                  source_path=SOURCE.relative_to(ROOT).as_posix(), output_path=TARGET.relative_to(ROOT).as_posix(),
                  elapsed_seconds=round(time.monotonic() - started, 3))
    (ROOT / 'work/musetalk-fp16-conversion.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report), flush=True)

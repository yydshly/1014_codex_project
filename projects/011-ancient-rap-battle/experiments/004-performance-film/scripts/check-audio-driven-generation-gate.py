"""Offline regression checks: no provider CLI, credentials, network or ledger writes.

Run with an existing Python interpreter. Temporary fixtures never accept a real
pilot; they are removed at exit. Existing paid requests remain unchanged.
"""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


EP = Path(__file__).resolve().parents[1]
WORK = EP / 'work/stage-film-20261016'
SPEC = importlib.util.spec_from_file_location('stage_batch_gate', WORK / 'batch-stage-runner.py')
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


def load_request(key):
    path = WORK / f'requests/STAGE_{key}_t1/request.json'
    value = json.loads(path.read_text(encoding='utf-8-sig'))
    value['_config'] = str(path)
    return value


class AudioDrivenGenerationGateChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='audio-driven-gate-offline-')
        self.addCleanup(self.temp.cleanup)
        self.fixture_root = Path(self.temp.name)
        self.policy_path = self.fixture_root / 'policy.json'
        self.policy = {
            'schema_version': 1,
            'require_audio_driven_singing': True,
            'original_song_sha256': 'cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0',
            'pilot_gate_path': 'pilot-not-accepted.json',
        }
        self.write_policy()
        self.addCleanup(patch.stopall)
        patch.object(runner, 'GENERATION_POLICY', self.policy_path).start()
        # Any accidental advance beyond the pure guard makes the check fail.
        self.validate = patch.object(runner, 'validate', side_effect=AssertionError('No provider estimate allowed in offline test')).start()
        self.reserve = patch.object(runner, 'reserve', side_effect=AssertionError('No ledger reservation allowed in offline test')).start()
        self.save = patch.object(runner, 'save', side_effect=AssertionError('No ledger or production state writes allowed in offline test')).start()
        self.popen = patch.object(runner.subprocess, 'Popen', side_effect=AssertionError('No provider process allowed in offline test')).start()
        self.process_run = patch.object(runner.subprocess, 'run', side_effect=AssertionError('No provider process allowed in offline test')).start()
        runner.STOP.clear()

    def tearDown(self):
        self.validate.assert_not_called()
        self.reserve.assert_not_called()
        self.save.assert_not_called()
        self.popen.assert_not_called()
        self.process_run.assert_not_called()

    def write_policy(self):
        self.policy_path.write_text(json.dumps(self.policy), encoding='utf-8')

    def test_all_existing_singer_requests_stop_before_any_subprocess_or_reservation(self):
        for key in ('LIBAI1', 'LIBAI2', 'DUFU1', 'DUFU2', 'DUET', 'FINALE'):
            with self.subTest(source=key):
                with self.assertRaisesRegex(runner.GenerationPolicyError, 'images-only'):
                    runner.run(load_request(key), False)

    def test_request_claims_and_relaxed_precision_cannot_invent_adapter_capability(self):
        config = load_request('LIBAI1')
        config.update(submit_audio=True, precise_lip_sync_required=False,
                      require_audio_driven_singing=False,
                      requires_passed_lip_pilot_before_submission=False,
                      accepted_for_singing=True,
                      audio_driver={'media_type': 'audio', 'path': 'pretend.wav', 'sha256': '0' * 64})
        with self.assertRaisesRegex(runner.GenerationPolicyError, 'images-only'):
            runner.run(config, False)

    def test_missing_policy_fails_closed(self):
        self.policy_path.unlink()
        with self.assertRaisesRegex(runner.GenerationPolicyError, 'policy missing'):
            runner.run(load_request('DUFU1'), False)

    def test_disabled_policy_does_not_reenable_unsupported_singing(self):
        self.policy['require_audio_driven_singing'] = False
        self.write_policy()
        with self.assertRaisesRegex(runner.GenerationPolicyError, 'must remain required'):
            runner.run(load_request('DUET'), False)

    def test_stage_and_audience_classification_remains_available(self):
        for key in ('WIDE', 'CROWD1', 'CROWD2'):
            with self.subTest(source=key):
                runner.preflight_generation_policy(load_request(key))

    def test_conflicting_stage_label_cannot_hide_a_known_singer(self):
        config = load_request('LIBAI1')
        config['shot_kind'] = 'stage'
        with self.assertRaisesRegex(runner.GenerationPolicyError, 'images-only'):
            runner.run(config, False)

    def test_unknown_kind_fails_closed(self):
        config = {'id': 'UNCLASSIFIED', 'shot_kind': 'misc', 'source_key': 'UNKNOWN'}
        with self.assertRaisesRegex(runner.GenerationPolicyError, 'Unknown shot kind'):
            runner.run(config, False)

    def test_future_audio_adapter_still_requires_a_typed_driver(self):
        with patch.object(runner, 'SAFE_RUNNER_INPUT_TYPES', frozenset({'image', 'audio'})):
            config = load_request('LIBAI1')
            with self.assertRaisesRegex(runner.GenerationPolicyError, 'audio input is required'):
                runner.run(config, False)
            config['submit_audio'] = True
            with self.assertRaisesRegex(runner.GenerationPolicyError, 'typed audio_driver'):
                runner.run(config, False)
            config['audio_driver'] = {'media_type': 'image', 'path': 'wrong.png'}
            with self.assertRaisesRegex(runner.GenerationPolicyError, 'typed audio_driver'):
                runner.run(config, False)

    def test_future_audio_adapter_cannot_skip_missing_or_unpassed_pilot(self):
        config = load_request('LIBAI1')
        config.update(submit_audio=True, audio_driver={'media_type': 'audio', 'path': 'driver.wav', 'sha256': '0' * 64})
        with patch.object(runner, 'SAFE_RUNNER_INPUT_TYPES', frozenset({'image', 'audio'})), patch.object(runner, 'EP', self.fixture_root):
            with self.assertRaisesRegex(runner.GenerationPolicyError, 'acceptance file is missing'):
                runner.run(config, False)
            # This is deliberately NOT a passed pilot, including audio-only evidence.
            gate = {'accepted_for_singing': False, 'visible_lip_sync_reviewed': False,
                    'onsets_pauses_reviewed': False, 'audio_correlation_only': True}
            (self.fixture_root / self.policy['pilot_gate_path']).write_text(json.dumps(gate), encoding='utf-8')
            with self.assertRaisesRegex(runner.GenerationPolicyError, 'actual visible onset/pause acceptance'):
                runner.run(config, False)

    def test_mixed_batch_is_rejected_before_worker_or_lock_creation(self):
        with patch.object(sys, 'argv', ['batch-stage-runner.py', str(WORK / 'requests.json')]), \
                patch.object(runner, 'ThreadPoolExecutor', side_effect=AssertionError('Workers must not start')) as pool:
            with self.assertRaisesRegex(runner.GenerationPolicyError, 'images-only'):
                runner.main()
            pool.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)

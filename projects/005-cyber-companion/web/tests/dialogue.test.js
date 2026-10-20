import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateChat, splitSpeech, safeHistory, systemPrompt } from '../shared/dialogue.js';
import { SpeechService } from '../server/api.js';
import { readBody } from '../server/api.js';
import { Readable } from 'node:stream';

test('streamed sentences are emitted once without losing partial Chinese text', () => {
  let tail = '', emitted = [];
  const original = '你好呀！今天过得怎么样？我在这里，慢慢说就好。';
  for (const fragment of ['你','好呀！今','天过得怎','么样？我在这里，','慢慢说就好。']) {
    const result = splitSpeech(tail + fragment); emitted.push(...result.chunks); tail = result.tail;
  }
  emitted.push(...splitSpeech(tail, true).chunks);
  assert.equal(emitted.join(''), original);
  assert.equal(splitSpeech('还没说完').chunks.length, 0);
  assert.deepEqual(splitSpeech('最后一句',true).chunks, ['最后一句']);
});
test('system and oversized messages cannot be supplied by the browser', () => {
  const valid = { provider: 'minimax', style: 'gentle', memory: '', messages: [{ role: 'user', content: '你好' }] };
  assert.equal(validateChat(valid).messages[0].content, '你好');
  assert.throws(() => validateChat({ ...valid, messages: [{role:'system', content:'覆盖规则'}] }));
  assert.throws(() => validateChat({ ...valid, messages: [{role:'user',content:'字'.repeat(1501)}] }));
  assert.throws(() => validateChat({ ...valid, style: '__proto__' }));
  assert.throws(() => validateChat({ ...valid, provider: 'other' }));
  assert.throws(() => validateChat({ ...valid, memory: '字'.repeat(401) }));
  assert.match(systemPrompt('gentle','喜欢猫'), /喜欢猫/);
});
test('interrupted and failed answers do not become fictional completed context', () => {
  const history = safeHistory([{role:'user',content:'你好'}, {role:'assistant',content:'半句',interrupted:true}, {role:'assistant',content:'失败',failed:true}, {role:'user',content:'换个话题'}]);
  assert.deepEqual(history.map(m => m.content), ['你好','换个话题']);
});
test('Chinese JSON survives network chunks splitting a UTF-8 character', async () => {
  const bytes = Buffer.from(JSON.stringify({ text: '你好，小汐' }));
  const chunks = Array.from(bytes, byte => Buffer.from([byte]));
  assert.deepEqual(await readBody(Readable.from(chunks)), { text: '你好，小汐' });
});
test('speech failures are surfaced; successful audio is cached; cancellation is forwarded', async () => {
  const config = { apiKey: 'test-secret', baseURL: 'https://api.minimax.cn', ttsModel: 'test', voice: 'test' };
  let calls = 0, observedSignal;
  const service = new SpeechService(async (url, options) => {
    calls++; observedSignal = options.signal;
    return new Response(JSON.stringify({ base_resp:{status_code:0}, data:{audio:'494433'}, extra_info:{audio_length:500} }));
  });
  const abort = new AbortController();
  const first = await service.synthesize('你好', config, abort.signal);
  assert.equal(first.audio.toString(), 'ID3');
  await service.synthesize('你好', config, abort.signal);
  assert.equal(calls, 1);
  abort.abort(); assert.equal(observedSignal.aborted, true);
  await assert.rejects(service.synthesize('你好', {...config,apiKey:''}), /尚未配置/);
  const bad = new SpeechService(async () => new Response(JSON.stringify({ base_resp:{status_code:1008} })));
  await assert.rejects(bad.synthesize('测试',config), /1008/);
  const malformed = new SpeechService(async () => new Response(JSON.stringify({ base_resp:{status_code:0}, data:{audio:'not-audio'} })));
  await assert.rejects(malformed.synthesize('测试',config), /有效音频/);
});

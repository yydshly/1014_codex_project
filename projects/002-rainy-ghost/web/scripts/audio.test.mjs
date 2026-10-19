import test from 'node:test';
import assert from 'node:assert/strict';
import { NightAudio } from '../src/audio.js';
import { renderGhostVoice, encodeWav, voiceKind } from '../src/ghost-voice.js';

class Param {
  constructor(value = 0) { this.value = value; }
  cancelScheduledValues() {}
  setTargetAtTime(value) { this.value = value; }
}
class Node {
  constructor() { this.gain = new Param(); this.pan = new Param(); this.frequency = new Param(); }
  connect(node) { return node; }
  disconnect() { this.disconnected = true; }
}
class Source extends Node {
  start(at = 0) { this.startedAt = at; }
  stop(at = 0) { this.stoppedAt = at; }
  finish() { this.onended?.(); }
}
class Context {
  constructor() { this.sampleRate = 8000; this.currentTime = 0; this.state = 'suspended'; this.destination = new Node(); this.sources = []; this.bufferCount = 0; }
  createGain() { return new Node(); }
  createStereoPanner() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createDynamicsCompressor() { return { ...new Node(), threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param(), connect: Node.prototype.connect }; }
  createBuffer(channels, length, sampleRate) {
    this.bufferCount++;
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { length, duration: length / sampleRate, getChannelData: channel => data[channel], copyToChannel: (samples, channel) => data[channel].set(samples) };
  }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  async resume() { this.state = 'running'; this.onstatechange?.(); }
  async suspend() { this.state = 'suspended'; this.onstatechange?.(); }
  async close() { this.state = 'closed'; }
}
function setup() {
  let at = 0, created = 0;
  const context = new Context();
  const audio = new NightAudio({ contextFactory: () => { created++; return context; }, now: () => at });
  return { audio, context, created: () => created, advance: milliseconds => {
    at += milliseconds; context.currentTime += milliseconds / 1000;
    context.sources.forEach(source => { if (source.stoppedAt <= context.currentTime || !source.loop && source.startedAt + source.buffer.duration <= context.currentTime) source.finish(); });
  } };
}

test('默认静音不创建音频上下文；角色与雨声分别主动开启', async () => {
  const { audio, context, created } = setup();
  assert.equal(await audio.playVoice('greet'), false);
  assert.equal(created(), 0);
  await audio.toggleVoice();
  assert.equal(created(), 1);
  assert.equal(audio.rainSource, undefined);
  assert.equal(await audio.playVoice('greet', { manual: true }), true);
  await audio.toggleRain();
  assert.equal(created(), 1);
  assert.equal(audio.rainSource.loop, true);
  assert.equal(audio.rainEnabled, true);
  await audio.toggleVoice();
  assert.equal(audio.rainEnabled, true);
  assert.equal(audio.voiceEnabled, false);
  assert.equal(context.state, 'running');
  audio.dispose();
});

test('暂停、后台和安静模式抑制自动回应，主动招呼在安静模式可用', async () => {
  const { audio, context, advance } = setup();
  await audio.toggleVoice();
  await audio.playVoice('greet', { manual: true });
  audio.setEnvironment({ paused: true });
  assert.equal(audio.voiceGain.gain.value, 0);
  assert.ok([...audio.voices].every(voice => voice.stopped));
  advance(3000);
  assert.equal(await audio.playVoice('greet', { manual: true }), false);
  await new Promise(resolve => setTimeout(resolve, 85));
  assert.equal(context.state, 'suspended');
  audio.setEnvironment({ paused: false, quiet: true });
  assert.equal(await audio.playVoice('return'), false);
  assert.equal(await audio.playVoice('nod', { manual: true }), true);
  audio.setEnvironment({ hidden: true });
  advance(10_000);
  assert.equal(await audio.playVoice('return', { manual: true }), false);
  audio.dispose();
});

test('连点不会堆叠鸣叫，缓存有上限，播放完释放节点', async () => {
  const { audio, advance } = setup();
  await audio.toggleVoice();
  const concurrent = await Promise.all([audio.playVoice('greet', { manual: true }), audio.playVoice('nod', { manual: true })]);
  assert.deepEqual(concurrent, [true, false]);
  assert.equal(audio.playCount, 1);
  for (let i = 0; i < 24; i++) {
    advance(700);
    await audio.playVoice(['greet', 'pet', 'settled', 'light', 'approach'][i % 5], { manual: true, preview: true });
    assert.ok(audio.voices.size <= 2);
    assert.ok(audio.buffers.size <= 9);
  }
  advance(3000);
  assert.equal(audio.voices.size, 0);
  audio.dispose();
});

test('异步恢复期间关闭声音，不会延迟播放旧回应', async () => {
  const { audio, context } = setup();
  await audio.toggleVoice();
  context.state = 'suspended';
  let resume;
  context.resume = () => new Promise(resolve => { resume = () => { context.state = 'running'; resolve(); }; });
  const pending = audio.playVoice('greet', { manual: true });
  await audio.toggleVoice();
  resume();
  assert.equal(await pending, false);
  assert.equal(audio.playCount, 0);
  audio.dispose();
});

test('音量限制与关闭有效，雨量改变仍能联动雨声', async () => {
  const { audio } = setup();
  await audio.toggleRain();
  const before = audio.rainGain.gain.value;
  audio.rain = 1; audio.update();
  assert.ok(audio.rainGain.gain.value > before);
  await audio.toggleVoice();
  audio.setVolume('voice', 2);
  assert.equal(audio.voiceVolume, 1);
  audio.setVolume('voice', 0);
  assert.equal(await audio.playVoice('greet', { manual: true }), false);
  audio.setVolume('rain', -2);
  assert.equal(audio.rainGain.gain.value, 0);
  audio.dispose();
});

test('不同设备采样率下的音色无削波、无异常样本，首尾平滑', () => {
  for (const rate of [8000, 44100, 48000]) {
    for (const kind of ['happy', 'shy', 'pet', 'settled', 'approach', 'light']) {
      const data = renderGhostVoice(kind, rate, 1);
      let sum = 0, squared = 0;
      for (const sample of data) { assert.ok(Number.isFinite(sample)); assert.ok(Math.abs(sample) < 0.76); sum += sample; squared += sample ** 2; }
      assert.equal(data[0], 0); assert.equal(Math.abs(data.at(-1)), 0);
      assert.ok(Math.abs(sum / data.length) < 0.002);
      assert.ok(Math.sqrt(squared / data.length) > 0.03);
      assert.ok(data.length / rate < 1.8);
    }
  }
});

test('打招呼总是开心，熟悉程度不再覆盖指定情绪', async () => {
  assert.equal(voiceKind('greet'), 'happy');
  assert.equal(voiceKind('return'), 'happy');
  assert.equal(voiceKind('nod'), 'shy');
  assert.equal(voiceKind('unknown'), 'approach');
  const { audio, advance } = setup();
  await audio.toggleVoice();
  await audio.playVoice('greet', { manual: true, familiar: true });
  assert.equal(audio.lastKind, 'happy');
  advance(3000);
  await audio.playVoice('happy', { manual: true, familiar: true, preview: true });
  assert.equal(audio.lastKind, 'happy');
  audio.dispose();
});

test('摸头和招呼共用三秒叫声间隔，自动回应更稀疏，试听仍可主动比较', async () => {
  const { audio, advance } = setup();
  await audio.toggleVoice();
  assert.equal(await audio.playVoice('pet', { manual: true }), true);
  const pet = [...audio.voices][0];
  assert.equal(audio.lastKind, 'pet');
  assert.ok(pet.source.buffer.duration < 0.9);
  advance(2200);
  assert.equal(await audio.playVoice('pet', { manual: true }), false);
  advance(800);
  assert.equal(await audio.playVoice('greet', { manual: true, familiar: true }), true);
  assert.equal(audio.lastKind, 'happy');
  advance(3000);
  assert.equal(await audio.playVoice('approach'), false);
  advance(5000);
  assert.equal(await audio.playVoice('approach'), true);
  advance(650);
  assert.equal(await audio.playVoice('shy', { manual: true, preview: true }), true);
  audio.dispose();
});

test('开心有两次柔软弹跳，害羞更轻，安心更长且更低', () => {
  const rate = 48_000;
  const [happy, shy, settled] = ['happy', 'shy', 'settled'].map(kind => renderGhostVoice(kind, rate, 1));
  const rms = (data, from = 0, to = data.length / rate) => {
    const segment = data.subarray(Math.floor(from * rate), Math.floor(to * rate));
    return Math.sqrt(segment.reduce((sum, value) => sum + value * value, 0) / segment.length);
  };
  const pitch = (data, from, to) => {
    const crossings = [];
    for (let i = Math.floor(from * rate); i < to * rate; i++) if (data[i - 1] <= 0 && data[i] > 0) crossings.push(i);
    return (crossings.length - 1) * rate / (crossings.at(-1) - crossings[0]);
  };
  assert.ok(rms(happy, 0.15, 0.28) > 0.16);
  assert.ok(rms(happy, 0.65, 0.8) > 0.16);
  assert.ok(rms(happy, 0.425, 0.465) < rms(happy, 0.15, 0.28) * 0.12, '两次叫声之间有真实的停顿');
  assert.ok(rms(shy) < rms(happy) * 0.7, '害羞无需用户调音量也会更轻');
  assert.ok(settled.length > happy.length && settled.length > shy.length);
  const pitches = [pitch(happy, 0.12, 0.28), pitch(shy, 0.12, 0.28), pitch(settled, 0.35, 0.55)];
  assert.ok(pitches[0] > pitches[1] + 40 && pitches[1] > pitches[2] + 20);
  for (const data of [happy, shy, settled]) {
    let air = 0, highEnergy = 0, energy = 0;
    const alpha = 1 - Math.exp(-Math.PI * 2 * 1800 / rate);
    for (const value of data) { air += (value - air) * alpha; highEnergy += (value - air) ** 2; energy += value ** 2; }
    assert.ok(highEnergy / energy < 0.08, '能量集中在柔和的低中频');
  }
});

test('音色微变可复现，试听导出为真实单声道 PCM WAV', () => {
  const first = renderGhostVoice('greet', 8000, 0);
  assert.deepEqual(renderGhostVoice('greet', 8000, 0), first);
  assert.notDeepEqual(renderGhostVoice('greet', 8000, 1), first);
  const wav = encodeWav(first, 8000), view = new DataView(wav.buffer);
  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), 'RIFF');
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 8000);
  assert.equal(view.getUint32(40, true), first.length * 2);
});

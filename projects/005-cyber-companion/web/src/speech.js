export class SpeechPlayer {
  epoch = 0; pending = 0; active = false; muted = false;
  constructor({ endpoint, onState, onLevel, onError, onFirstAudio }) {
    Object.assign(this, { endpoint, onState, onLevel, onError, onFirstAudio });
    this.queue = Promise.resolve(); this.preparation = Promise.resolve(); this.controllers = new Set();
  }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 256;
      this.analyser.connect(this.context.destination);
      const data = new Uint8Array(this.analyser.fftSize);
      const tick = () => {
        this.analyser.getByteTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((s,v) => s + ((v - 128) / 128) ** 2, 0) / data.length);
        this.onLevel(this.active ? Math.min(1, rms * 6) : 0);
        this.frame = requestAnimationFrame(tick);
      }; tick();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  enqueue(text, provider = 'minimax') {
    if (this.muted || !text.trim()) return;
    const epoch = this.epoch;
    this.pending++; this.onState(true, 'preparing');
    const controller = new AbortController(); this.controllers.add(controller);
    // Prefetch later sentences while the current one plays. Always settle the promise,
    // including while it waits in the playback queue, to avoid unhandled rejections.
    const load = async () => {
      if (epoch !== this.epoch) throw new DOMException('已停止', 'AbortError');
      const response = await fetch(this.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }), signal: controller.signal,
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || '语音生成失败。'); }
      return response.arrayBuffer();
    };
    const audio = provider === 'browser' ? Promise.resolve(null) : this.preparation.then(load).then(bytes => ({ bytes }), error => ({ error }));
    if (provider !== 'browser') this.preparation = audio.then(() => {});
    const play = async () => {
      try {
        const result = await audio;
        if (epoch !== this.epoch) return;
        if (result?.error) throw result.error;
        if (provider === 'browser') await this.playBrowser(text, epoch);
        else {
          const buffer = await this.context.decodeAudioData(result.bytes);
          if (epoch !== this.epoch) return;
          await new Promise(resolve => {
            this.finishCurrent = resolve;
            const source = this.context.createBufferSource(); this.source = source;
            source.buffer = buffer; source.connect(this.analyser);
            source.onended = () => { source.disconnect(); resolve(); };
            this.active = true; this.onState(true, 'playing'); this.onFirstAudio(); source.start();
          });
        }
      } catch (error) { if (epoch === this.epoch && error.name !== 'AbortError') this.onError(error.message); }
      finally {
        this.controllers.delete(controller);
        if (epoch === this.epoch) { this.active = false; this.pending--; this.onLevel(0); this.onState(this.pending > 0, this.pending ? 'preparing' : 'idle'); }
      }
    };
    this.queue = this.queue.then(play, play);
  }
  playBrowser(text, epoch) {
    if (!window.speechSynthesis) throw new Error('此浏览器没有语音朗读功能。');
    return new Promise((resolve, reject) => {
      this.finishCurrent = resolve;
      const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-CN'; utterance.rate = 1.05;
      const voice = speechSynthesis.getVoices().find(v => v.lang.startsWith('zh'));
      if (voice) utterance.voice = voice;
      const animate = () => { if (this.active && epoch === this.epoch) { this.onLevel(0.3 + Math.sin(performance.now() / 70) * 0.2); this.browserFrame = requestAnimationFrame(animate); } };
      utterance.onstart = () => { this.active = true; this.onState(true, 'playing'); this.onFirstAudio(); animate(); };
      utterance.onend = resolve;
      utterance.onerror = event => event.error === 'canceled' || event.error === 'interrupted' ? resolve() : reject(new Error('浏览器朗读失败，请切换语音服务。'));
      speechSynthesis.speak(utterance);
    });
  }
  stop() {
    this.epoch++; this.pending = 0; this.active = false;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    try { this.source?.stop(); } catch {}
    window.speechSynthesis?.cancel(); cancelAnimationFrame(this.browserFrame);
    this.finishCurrent?.(); this.finishCurrent = null; this.queue = Promise.resolve(); this.preparation = Promise.resolve();
    this.onLevel(0); this.onState(false, 'idle');
  }
}

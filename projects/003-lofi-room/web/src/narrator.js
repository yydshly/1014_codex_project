export class Narrator {
  constructor({
    onChange = () => {},
    onNotice = () => {},
    audioId = "agent-voice-audio",
  } = {}) {
    this.onChange = onChange;
    this.onNotice = onNotice;
    this.audio = new Audio();
    this.audio.id = audioId;
    this.audio.hidden = true;
    document.body.append(this.audio);
    this.audio.preload = "auto";
    this.audio.volume = 0.9;
    this.enabled = true;
    this.paused = false;
    this.current = null;
    this.context = null;
    this.analyser = null;
    this.finish = null;
    this.fetchController = null;
    this.generation = 0;
  }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      const source = this.context.createMediaElementSource(this.audio);
      source.connect(this.analyser);
      this.analyser.connect(this.context.destination);
      this.samples = new Uint8Array(this.analyser.frequencyBinCount);
    }
    await this.context.resume();
  }
  getLevel() {
    if (!this.current || this.audio.paused || !this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.samples);
    return Math.min(
      1,
      this.samples.reduce((sum, value) => sum + value, 0) /
        this.samples.length /
        75,
    );
  }
  setEnabled(value) {
    this.enabled = value;
    if (!value) this.skip();
  }
  async waitResumed(signal) {
    while (this.paused) {
      if (signal?.aborted) throw new DOMException("已停止", "AbortError");
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }
  async speak(event, signal) {
    await this.waitResumed(signal);
    signal?.throwIfAborted();
    const utterance = new AbortController();
    this.utterance = utterance;
    signal = AbortSignal.any([utterance.signal, ...(signal ? [signal] : [])]);
    const generation = this.generation;
    this.current = event;
    this.onChange(event);
    if (!this.enabled) {
      try {
        await this.captionDelay(event.text, signal);
      } catch (error) {
        if (utterance.signal.reason !== "skip") throw error;
      } finally {
        if (this.utterance === utterance) this.utterance = null;
        if (generation === this.generation) {
          this.current = null;
          this.onChange(null);
        }
      }
      return;
    }
    let url;
    let objectURL;
    try {
      if (event.clip)
        url = new URL(`voices/${event.collection === "room" ? "room" : "demo"}/${event.clip}.mp3`, document.baseURI).href;
      else {
        this.fetchController = new AbortController();
        const response = await fetch(new URL("api/speech", document.baseURI), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor: event.actor, text: event.text }),
          signal: AbortSignal.any([signal, this.fetchController.signal]),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "语音合成失败。");
        }
        objectURL = URL.createObjectURL(await response.blob());
        url = objectURL;
      }
      if (generation !== this.generation) return;
      await this.waitResumed(signal);
      signal?.throwIfAborted();
      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          this.audio.pause();
          this.audio.removeEventListener("ended", finish);
          this.audio.removeEventListener("error", fail);
          signal?.removeEventListener("abort", abort);
          this.finish = null;
          resolve();
        };
        const fail = () => {
          finish();
          this.onNotice("语音暂时无法播放，已保留字幕。");
        };
        const abort = () => {
          finish();
          reject(new DOMException("已停止", "AbortError"));
        };
        this.finish = finish;
        this.audio.addEventListener("ended", finish);
        this.audio.addEventListener("error", fail);
        signal?.addEventListener("abort", abort, { once: true });
        this.audio.src = url;
        this.audio.play().catch(() => {
          if (settled || generation !== this.generation) return;
          this.paused = true;
          this.onNotice("浏览器暂停了声音，请点击「继续回放」。");
        });
      });
    } catch (error) {
      if (utterance.signal.reason === "skip") return;
      if (signal?.aborted || generation !== this.generation)
        throw new DOMException("已停止", "AbortError");
      this.onNotice(error.message);
      try {
        await this.captionDelay(event.text, signal);
      } catch (captionError) {
        if (utterance.signal.reason !== "skip") throw captionError;
      }
    } finally {
      if (objectURL) URL.revokeObjectURL(objectURL);
      if (this.utterance === utterance) this.utterance = null;
      if (generation === this.generation) {
        this.current = null;
        this.onChange(null);
      }
    }
  }
  async captionDelay(text, signal) {
    let remaining = Math.min(1800, Math.max(650, text.length * 25));
    while (remaining > 0) {
      await this.waitResumed(signal);
      signal?.throwIfAborted();
      await new Promise((resolve) => setTimeout(resolve, 80));
      remaining -= 80;
    }
  }
  pause() {
    this.paused = true;
    this.audio.pause();
  }
  async resume() {
    await this.context?.resume();
    this.paused = false;
    if (this.current && this.audio.src && this.finish) {
      try {
        await this.audio.play();
      } catch {
        this.paused = true;
        this.onNotice("声音仍被浏览器暂停，请再次点击「继续回放」。");
      }
    }
  }
  skip() {
    this.utterance?.abort("skip");
  }
  stop() {
    this.generation++;
    this.paused = false;
    this.utterance?.abort("stop");
    this.fetchController?.abort();
    this.finish?.();
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.current = null;
    this.onChange(null);
  }
  dispose() {
    this.stop();
    if (this.context?.state !== "closed") this.context?.close();
    this.audio.remove();
  }
}

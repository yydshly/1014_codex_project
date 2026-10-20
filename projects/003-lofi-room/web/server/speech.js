import { createHash } from "node:crypto";
import { TEAM_BY_ID } from "../shared/team.js";

export class SpeechService {
  constructor({ fetchImpl = fetch, maxEntries = 100 } = {}) {
    this.fetch = fetchImpl;
    this.cache = new Map();
    this.inflight = new Map();
    this.maxEntries = maxEntries;
    this.active = 0;
  }
  async synthesize({ actor, text }, config) {
    if (!TEAM_BY_ID[actor])
      throw Object.assign(new Error("未知人物。"), { status: 400 });
    if (typeof text !== "string" || !text.trim() || text.length > 500)
      throw Object.assign(new Error("播报文本需为 1 至 500 字。"), {
        status: 400,
      });
    if (!config.apiKey)
      throw Object.assign(
        new Error("MiniMax 密钥尚未配置，字幕演示仍可使用。"),
        { status: 503 },
      );
    const voiceId = config.voices[actor];
    const id = createHash("sha256")
      .update(JSON.stringify([config.baseURL, config.ttsModel, voiceId, text]))
      .digest("hex");
    if (this.cache.has(id)) return { ...this.cache.get(id), cached: true };
    if (this.inflight.has(id)) return this.inflight.get(id);
    if (this.active >= 3)
      throw Object.assign(new Error("语音合成繁忙，请稍后重试。"), {
        status: 429,
      });
    this.active++;
    const request = this.request(text, voiceId, config)
      .then((result) => {
        if (this.cache.size >= this.maxEntries)
          this.cache.delete(this.cache.keys().next().value);
        this.cache.set(id, result);
        return { ...result, cached: false };
      })
      .finally(() => {
        this.active--;
        this.inflight.delete(id);
      });
    this.inflight.set(id, request);
    return request;
  }
  async request(text, voiceId, config) {
    let response;
    try {
      response = await this.fetch(`${config.baseURL}/v1/t2a_v2`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.ttsModel,
          text,
          stream: false,
          output_format: "hex",
          language_boost: "Chinese",
          voice_setting: { voice_id: voiceId, speed: 1.05, vol: 1, pitch: 0 },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: "mp3",
            channel: 1,
          },
        }),
        signal: AbortSignal.timeout(45000),
      });
    } catch {
      throw Object.assign(new Error("MiniMax 语音请求超时或网络不可达。"), {
        status: 502,
      });
    }
    if (!response.ok)
      throw Object.assign(
        new Error(`MiniMax 语音接口返回 HTTP ${response.status}。`),
        { status: 502 },
      );
    const payload = await response.json();
    const code = payload.base_resp?.status_code;
    if (code !== 0) {
      const descriptions = {
        1004: "接口密钥无效",
        1008: "语音账户余额不足",
        2013: "音色或参数不受支持",
        2038: "账户需完成认证",
      };
      throw Object.assign(
        new Error(
          `MiniMax 语音合成失败：${descriptions[code] || "上游服务返回错误"}（${code ?? "未知"}）。`,
        ),
        { status: 502 },
      );
    }
    const hex = payload.data?.audio;
    if (
      typeof hex !== "string" ||
      !hex.length ||
      hex.length % 2 ||
      !/^([0-9a-f]{2})+$/i.test(hex)
    )
      throw Object.assign(new Error("MiniMax 未返回有效音频。"), {
        status: 502,
      });
    return {
      audio: Buffer.from(hex, "hex"),
      duration: payload.extra_info?.audio_length || 0,
      voiceId,
      model: config.ttsModel,
    };
  }
}

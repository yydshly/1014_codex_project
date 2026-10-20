import { createHash } from 'node:crypto';
import { streamText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { loadConfig } from './config.js';
import { systemPrompt, validateChat } from '../shared/dialogue.js';

const BASE = '/1014_codex_project/005-cyber-companion';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
export async function readBody(req) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 48000) throw fail('请求内容过长。', 413);
    chunks.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail('请求必须是有效 JSON。'); }
}
export class SpeechService {
  cache = new Map(); inflight = new Map();
  constructor(fetchImpl = fetch) { this.fetch = fetchImpl; }
  async synthesize(text, config, signal) {
    if (typeof text !== 'string' || !text.trim() || text.length > 500) throw fail('朗读内容需为 1 至 500 字。');
    if (!config.apiKey) throw fail('语音服务尚未配置，可在设置中选择浏览器朗读。', 503);
    const id = createHash('sha256').update(JSON.stringify([config.baseURL, config.ttsModel, config.voice, text])).digest('hex');
    if (this.cache.has(id)) return this.cache.get(id);
    // Requests use their own abort signals: stopping one playback cannot cancel another user's audio.
    if (this.inflight.size >= 3) throw fail('语音正在处理，请稍后重试。', 429);
    const token = Symbol(); this.inflight.set(token, true);
    try {
      const response = await this.fetch(`${config.baseURL}/v1/t2a_v2`, {
        method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.ttsModel, text, stream: false, output_format: 'hex', language_boost: 'Chinese',
          voice_setting: { voice_id: config.voice, speed: 1.04, vol: 1, pitch: 0 },
          audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 } }),
        signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(35000)]),
      });
      if (!response.ok) throw fail(`语音服务返回 HTTP ${response.status}。`, 502);
      const data = await response.json();
      if (data.base_resp?.status_code !== 0) throw fail(`语音合成失败（${data.base_resp?.status_code ?? '未知状态'}），请检查语音权限和余额。`, 502);
      const hex = data.data?.audio;
      if (typeof hex !== 'string' || !hex.length || hex.length % 2 || !/^[0-9a-f]+$/i.test(hex)) throw fail('语音服务没有返回有效音频。', 502);
      const result = { audio: Buffer.from(hex, 'hex'), duration: data.extra_info?.audio_length || 0 };
      if (this.cache.size >= 64) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(id, result);
      return result;
    } finally { this.inflight.delete(token); }
  }
}

export function companionAPI() {
  const speech = new SpeechService();
  let chats = 0;
  function mount(server) {
    server.middlewares.use(async (req, res, next) => {
      const path = new URL(req.url || '/', 'http://localhost').pathname.replace(BASE, '');
      if (!path.startsWith('/api/companion/')) return next();
      const abort = new AbortController();
      res.on('close', () => { if (!res.writableEnded) abort.abort(); });
      try {
        const config = loadConfig(server.config.root);
        if (path === '/api/companion/config' && req.method === 'GET') {
          let localOnline = false; let localModel = config.localModel;
          try {
            const response = await fetch(`${config.localURL}/models`, { signal: AbortSignal.timeout(800) });
            const data = await response.json();
            localOnline = response.ok && Boolean(data.data?.length);
            if (localModel === 'local-model' && data.data?.[0]?.id) localModel = data.data[0].id;
          } catch {}
          return sendJSON(res, 200, {
            cloudConfigured: Boolean(config.apiKey), textModel: config.textModel,
            speechConfigured: Boolean(config.apiKey), speechModel: config.ttsModel,
            localOnline, localModel,
          });
        }
        if (req.method !== 'POST') throw fail('此接口仅支持 POST。', 405);
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw fail('仅接受本页面发起的请求。', 403);
        if (!req.headers['content-type']?.startsWith('application/json')) throw fail('请使用 application/json。', 415);
        const body = await readBody(req);
        if (path === '/api/companion/speech') {
          const result = await speech.synthesize(body.text, config, abort.signal);
          if (abort.signal.aborted) return;
          res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': result.audio.length, 'Cache-Control': 'no-store', 'X-Audio-Duration-Ms': result.duration });
          return res.end(result.audio);
        }
        if (path !== '/api/companion/chat') throw fail('接口不存在。', 404);
        let input;
        try { input = validateChat(body); } catch (error) { throw fail(error.message); }
        if (input.provider === 'minimax' && !config.apiKey) throw fail('尚未配置模型。请配置 MiniMax，或启动本地兼容模型服务。', 503);
        if (chats >= 2) throw fail('对话服务繁忙，请稍后重试。', 429);
        chats++;
        try {
          const isLocal = input.provider === 'local';
          let model = isLocal ? config.localModel : config.textModel;
          if (isLocal && model === 'local-model') {
            try {
              const response = await fetch(`${config.localURL}/models`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(2500)]) });
              const data = await response.json();
              if (!response.ok || !data.data?.[0]?.id) throw new Error();
              model = data.data[0].id;
            } catch { throw fail('本地模型尚未就绪。请先启动 llama.cpp / Ollama，并核对 .env.local 中的地址。', 503); }
          }
          const provider = createOpenAICompatible({ name: isLocal ? 'local' : 'minimax',
            baseURL: isLocal ? config.localURL : `${config.baseURL}/v1`, apiKey: isLocal ? 'local' : config.apiKey });
          const started = performance.now(); let first = null; let streamError = null; let count = 0;
          const result = streamText({
            model: provider.chatModel(model),
            system: systemPrompt(input.style, input.memory), messages: input.messages,
            maxOutputTokens: 400, maxRetries: 0,
            abortSignal: AbortSignal.any([abort.signal, AbortSignal.timeout(60000)]),
            ...(!isLocal && config.textModel === 'MiniMax-M3' ? { providerOptions: { minimax: { thinking: { type: 'disabled' } } } } : {}),
            ...(isLocal ? { providerOptions: { local: { chat_template_kwargs: { enable_thinking: false } } } } : {}),
            onError: ({ error }) => { streamError = error; },
          });
          res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
          const emit = event => { if (!res.destroyed) res.write(JSON.stringify(event) + '\n'); };
          emit({ type: 'start', model, provider: input.provider });
          for await (const text of result.textStream) {
            if (abort.signal.aborted) break;
            if (first === null) first = Math.round(performance.now() - started);
            count += text.length;
            emit({ type: 'delta', text });
          }
          if (abort.signal.aborted) return;
          if (streamError || !count) emit({ type: 'error', message: '模型没有完成回复，请检查网络、模型权限或本地服务。' });
          else emit({ type: 'done', firstTokenMs: first, totalMs: Math.round(performance.now() - started) });
          res.end();
        } finally { chats--; }
      } catch (error) {
        if (abort.signal.aborted || res.destroyed) return;
        const message = error.status ? error.message : '服务未能完成请求，请检查配置或网络。';
        if (res.headersSent) res.end(JSON.stringify({ type: 'error', message }) + '\n');
        else sendJSON(res, error.status || 502, { error: message });
      }
    });
  }
  return { name: 'companion-local-api', configureServer: mount, configurePreviewServer: mount };
}

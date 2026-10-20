import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const readEnv = path => existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
const nonempty = env => Object.fromEntries(Object.entries(env).filter(([,v]) => typeof v === 'string' && v.trim()).map(([k,v]) => [k,v.trim()]));
export function loadConfig(directory = process.cwd()) {
  const local = { ...nonempty(readEnv(resolve(directory, '.env'))), ...nonempty(readEnv(resolve(directory, '.env.local'))) };
  const file = process.env.MINIMAX_ENV_FILE || local.MINIMAX_ENV_FILE;
  const env = { ...(file ? nonempty(readEnv(resolve(directory, file))) : {}), ...local, ...nonempty(process.env) };
  const url = new URL(env.MINIMAX_BASE_URL || env.MINIMAX_API_BASE || 'https://api.minimax.cn');
  if (url.protocol !== 'https:' || !['api.minimax.cn','api.minimax.io','api.minimaxi.com'].includes(url.hostname) || url.username || url.password)
    throw new Error('MiniMax 请使用官方 HTTPS 地址。');
  const localURL = new URL(env.LOCAL_LLM_BASE_URL || 'http://127.0.0.1:8080/v1');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(localURL.hostname) || !['http:', 'https:'].includes(localURL.protocol) || localURL.username || localURL.password)
    throw new Error('本地模型接口仅允许本机地址。');
  return {
    apiKey: env.MINIMAX_API_KEY || '', baseURL: url.origin,
    textModel: env.MINIMAX_TEXT_MODEL || 'MiniMax-M3', ttsModel: env.MINIMAX_TTS_MODEL || 'speech-2.8-turbo',
    voice: env.MINIMAX_VOICE || 'female-shaonv',
    localURL: localURL.href.replace(/\/$/, ''), localModel: env.LOCAL_LLM_MODEL || 'local-model',
  };
}

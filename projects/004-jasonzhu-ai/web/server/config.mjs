import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = (file) => existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
export function loadConfig() {
  const local = { ...envFile(path.join(webRoot, '.env')), ...envFile(path.join(webRoot, '.env.local')) };
  const pointer = process.env.OPENAI_ENV_FILE || local.OPENAI_ENV_FILE;
  const env = { ...(pointer ? envFile(path.resolve(webRoot, pointer)) : {}), ...local, ...process.env };
  return {
    apiKey: env.OPENAI_API_KEY || '',
    model: env.OPENAI_MODEL || 'gpt-6-astra',
    runtimeRoot: path.join(webRoot, '.runtime'),
    codexBinary: env.CODEX_BIN || (process.platform === 'win32' ? 'codex.exe' : 'codex'),
    codexModel: env.CODEX_MODEL || '',
    researchTimeout: Math.max(60000, Math.min(600000, Number(env.RESEARCH_TIMEOUT_MS) || 240000)),
  };
}

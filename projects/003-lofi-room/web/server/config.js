import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { TEAM } from "../shared/team.js";

function readEnv(path) {
  return existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
}
function mergeNonempty(...sources) {
  const result = {};
  for (const source of sources)
    for (const [key, value] of Object.entries(source))
      if (typeof value === "string" && value.trim()) result[key] = value.trim();
  return result;
}
export function loadConfig(directory = process.cwd()) {
  const local = mergeNonempty(
    readEnv(resolve(directory, ".env")),
    readEnv(resolve(directory, ".env.local")),
  );
  const envFile = process.env.MINIMAX_ENV_FILE || local.MINIMAX_ENV_FILE;
  const env = mergeNonempty(
    envFile ? readEnv(resolve(directory, envFile)) : {},
    local,
    process.env,
  );
  const supplied =
    env.MINIMAX_BASE_URL || env.MINIMAX_API_BASE || "https://api.minimax.cn";
  const url = new URL(supplied);
  const allowed = ["api.minimax.cn", "api.minimax.io", "api.minimaxi.com"];
  if (
    url.protocol !== "https:" ||
    !allowed.includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("请使用 MiniMax 官方 HTTPS 接口地址。");
  const origin = url.origin;
  return {
    apiKey: env.MINIMAX_API_KEY || "",
    baseURL: origin,
    ttsModel: env.MINIMAX_TTS_MODEL || "speech-2.8-turbo",
    textModel: env.MINIMAX_TEXT_MODEL || "MiniMax-M3",
    voices: Object.fromEntries(
      TEAM.map((member) => [
        member.id,
        env[`MINIMAX_VOICE_${member.id.toUpperCase()}`] || member.voice,
      ]),
    ),
  };
}
export function publicConfig(config) {
  return {
    speech: {
      provider: "MiniMax",
      configured: Boolean(config.apiKey),
      model: config.ttsModel,
    },
    agents: { configured: Boolean(config.apiKey), model: config.textModel },
    voices: config.voices,
  };
}

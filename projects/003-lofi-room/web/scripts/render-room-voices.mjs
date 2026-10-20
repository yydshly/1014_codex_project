import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../server/config.js";
import { SpeechService } from "../server/speech.js";
import { ROOM_CLIPS } from "../shared/room-lines.js";
import { setTimeout as delay } from "node:timers/promises";

const config = loadConfig(), service = new SpeechService(), folder = resolve("public/voices/room");
await mkdir(folder, { recursive: true });
const entries = Object.entries(ROOM_CLIPS);
const clips = [];
for (let i = 0; i < entries.length; i += 2) await Promise.all(entries.slice(i, i + 2).map(async ([id, line]) => {
  const target = resolve(folder, `${id}.mp3`);
  let exists = false;
  try { await access(target); exists = true; } catch {}
  if (!exists) {
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { result = await service.synthesize(line, config); break; }
      catch (error) {
        if (attempt === 2 || !/1002|繁忙|超时/.test(error.message)) throw error;
        await delay(2500 * (attempt + 1));
      }
    }
    await writeFile(target, result.audio);
    console.log(`${id}: ${result.duration} ms, ${result.audio.length} bytes`);
  }
  clips.push({ id, ...line, voiceId: config.voices[line.actor], file: `${id}.mp3` });
}));
await writeFile(resolve(folder, "manifest.json"), JSON.stringify({
  provider: "MiniMax", model: config.ttsModel, generatedAt: new Date().toISOString(), clips,
}, null, 2) + "\n");
console.log(`房间互动语音就绪：${entries.length} 段，六种人物音色。`);

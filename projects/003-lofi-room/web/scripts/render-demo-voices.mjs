import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../server/config.js";
import { SpeechService } from "../server/speech.js";
import { DEMO_LINES } from "../shared/workflow.js";
const config = loadConfig(),
  service = new SpeechService();
const folder = resolve("public/voices/demo");
await mkdir(folder, { recursive: true });
const entries = Object.entries(DEMO_LINES);
const metadata = {
  provider: "MiniMax",
  model: config.ttsModel,
  generatedAt: new Date().toISOString(),
  clips: [],
};
for (let index = 0; index < entries.length; index += 2) {
  await Promise.all(
    entries.slice(index, index + 2).map(async ([id, line]) => {
      const target = resolve(folder, `${id}.mp3`);
      let already = false;
      try {
        await access(target);
        already = true;
      } catch {}
      if (!already) {
        const result = await service.synthesize(line, config);
        await writeFile(target, result.audio);
        console.log(
          `${id}: ${result.duration} ms, ${result.audio.length} bytes`,
        );
      }
      metadata.clips.push({
        id,
        ...line,
        voiceId: config.voices[line.actor],
        file: `${id}.mp3`,
      });
    }),
  );
}
await writeFile(
  resolve(folder, "manifest.json"),
  JSON.stringify(metadata, null, 2) + "\n",
);
console.log(`MiniMax 演示语音就绪：${entries.length} 段，六种人物音色。`);

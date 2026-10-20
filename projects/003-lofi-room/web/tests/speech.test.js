import test from "node:test";
import assert from "node:assert/strict";
import { SpeechService } from "../server/speech.js";
import { publicConfig } from "../server/config.js";
import { TEAM } from "../shared/team.js";
const config = {
  apiKey: "unit-test-secret",
  baseURL: "https://api.minimax.cn",
  ttsModel: "speech-2.8-turbo",
  textModel: "MiniMax-M3",
  voices: Object.fromEntries(TEAM.map((m) => [m.id, m.voice])),
};

test("MiniMax 请求使用角色音色，hex 解码，重复文本缓存", async () => {
  const requests = [];
  const service = new SpeechService({
    fetchImpl: async (url, init) => {
      requests.push(JSON.parse(init.body));
      return Response.json({
        base_resp: { status_code: 0 },
        data: { audio: "4944330102" },
        extra_info: { audio_length: 123 },
      });
    },
  });
  const first = await service.synthesize(
    { actor: "mori", text: "你好" },
    config,
  );
  assert.equal(first.audio.toString("hex"), "4944330102");
  assert.equal(first.voiceId, TEAM[0].voice);
  const cached = await service.synthesize(
    { actor: "mori", text: "你好" },
    config,
  );
  assert.equal(cached.cached, true);
  assert.equal(requests.length, 1);
  await service.synthesize({ actor: "luna", text: "你好" }, config);
  assert.equal(requests.length, 2);
  assert.notEqual(
    requests[0].voice_setting.voice_id,
    requests[1].voice_setting.voice_id,
  );
});
test("业务错误、无效音频和缺少密钥不能伪装为成功", async () => {
  const errorService = new SpeechService({
    fetchImpl: async () =>
      Response.json({
        base_resp: {
          status_code: 1008,
          status_msg: "private data must not be reflected",
        },
      }),
  });
  await assert.rejects(
    errorService.synthesize({ actor: "mori", text: "你好" }, config),
    /余额不足/,
  );
  const invalid = new SpeechService({
    fetchImpl: async () =>
      Response.json({
        base_resp: { status_code: 0 },
        data: { audio: "not-hex" },
      }),
  });
  await assert.rejects(
    invalid.synthesize({ actor: "mori", text: "你好" }, config),
    /有效音频/,
  );
  await assert.rejects(
    invalid.synthesize(
      { actor: "mori", text: "你好" },
      { ...config, apiKey: "" },
    ),
    /尚未配置/,
  );
  await assert.rejects(
    invalid.synthesize({ actor: "unknown", text: "你好" }, config),
    /未知人物/,
  );
  assert.ok(!JSON.stringify(publicConfig(config)).includes(config.apiKey));
});

# 小汐 Web 运行说明

技术栈：Vite 8.3.4、原生 JavaScript、PixiJS 6.5.10、pixi-live2d-display 0.4.0、AI SDK 7.0.140。Node.js >=22.12.0。全部版本以 `package-lock.json` 为准。

## 启动

```powershell
cd projects/005-cyber-companion/web
npm ci
npm run dev
```

访问 <http://127.0.0.1:4177/1014_codex_project/005-cyber-companion/>。`start.ps1` 会在缺少依赖或核心素材时自动准备，再启动服务。首次安装需要网络；已提交的角色素材由本地提供。

## 云端模型与声音

复制 `.env.example` 为 `.env.local`，填写 `MINIMAX_API_KEY`，或者只引用自己的配置文件：

```dotenv
MINIMAX_ENV_FILE=F:/codex_project/.env.minimax
```

默认文本模型为 `MiniMax-M3`，语音模型为 `speech-2.8-turbo`，音色为 `female-shaonv`。可通过 `MINIMAX_TEXT_MODEL`、`MINIMAX_TTS_MODEL`、`MINIMAX_VOICE` 覆盖。密钥仅由 Node 服务读取，不进入浏览器、静态构建或 Git。保留的配置文件路径是本机选择，不会在别的电脑自动生效。

没有凭据时仍能看到角色；真实聊天会提示未配置，不会用预设台词冒充模型回复。设置中可选择浏览器朗读作为语音备用方案，其音质、离线能力和嘴型精度取决于设备；浏览器朗读嘴型为近似动画，MiniMax 播放嘴型取自实际音频能量。

## 本地模型接入（待实测）

先自行运行 llama.cpp 或 Ollama 服务，再在 `.env.local` 设置：

```dotenv
LOCAL_LLM_BASE_URL=http://127.0.0.1:8080/v1
LOCAL_LLM_MODEL=local-model
```

Ollama 通常使用 `http://127.0.0.1:11434/v1`。`local-model` 表示通过 `/models` 自动选择首个可用模型，也可以填精确模型名。在页面「设置 → 对话模型」选择本地模型。

该模式只替换语言模型；若仍选 MiniMax 语音，则语音依然走云端。当前没有下载权重、配置本地 CosyVoice / SenseVoice，不能将这个版本描述为全本地离线方案。

## 操作

- Enter 发送，Shift+Enter 换行；发送新消息会打断上一轮。
- Esc 或「打断」取消模型请求和语音队列；「重听」可以重新播放已有回复。
- 麦克风按钮使用浏览器语音识别；不支持时按钮禁用。需要用户自行授权，不会自动录音。建议使用 Chrome / Edge；浏览器识别可能依赖在线服务。
- 偏好与最多 60 条聊天记录留在当前浏览器，模型请求仅取最近 12 条未失败、未打断的消息和主动保存的偏好。
- 「弹幕实验」只注入模拟评论，每次三条，最多十二条排队；上一轮生成和播放结束后再取下一条。暂停会停止取新评论，当前回复可用「打断」终止。
- 「纯净画面」隐藏聊天面板，可用于本地取景；不自动推流。

## 检查与构建

```powershell
npm run check
npm test
npm run build
npm run smoke
```

`check` 做 JavaScript 语法检查；测试覆盖中文流式断句、请求校验、打断历史、跨网络分块 UTF-8 与语音错误/缓存。`smoke` 需要本地服务正在运行，会实际调用已配置的模型及语音服务并产生费用，验证流式回复与有效音频；证据写入被忽略的 `.runtime/`。`npm run assets` 校验或恢复固定版本角色文件，恢复文件时核对 `asset-lock.json` 的 SHA-256。

静态构建在 `dist/`。`npm run preview` 同时挂载本地 API；单独将 `dist/` 放入 GitHub Pages 只能展示角色，模型和语音必须另配后端。基础路径固定为 `/1014_codex_project/005-cyber-companion/`，遵循[仓库部署约定](../../../docs/DEPLOYMENT.md)。本轮没有线上发布。

## 本地 API

| 路由（位于项目基础路径下） | 用途 |
| --- | --- |
| `GET api/companion/config` | 返回是否配置、公开模型名与本地服务状态，不返回密钥 |
| `POST api/companion/chat` | 接受对话与偏好，返回 NDJSON 的 start / delta / done / error 事件 |
| `POST api/companion/speech` | 接受待朗读文本，返回 MP3；最多 64 条内存缓存 |

服务仅绑定 127.0.0.1。写接口要求 JSON 和同源请求；不接受浏览器传入模型地址或密钥。最大请求 48KB，聊天最多 20 条、每条 1500 字，偏好最多 400 字，语音每次最多 500 字。模型及语音有并发限制、超时与取消处理，不应直接暴露为公共服务。

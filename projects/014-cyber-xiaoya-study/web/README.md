# 014 中文研究阅读页

原生HTML、CSS和JavaScript，Node.js 20+。无第三方运行依赖，不需要安装包、API密钥、模型权重或摄像头/麦克风权限。

## 运行

~~~powershell
cd F:\codex_project\1014_codex_project\projects\014-cyber-xiaoya-study\web
npm run check
npm run build
npm run dev
~~~

访问 http://127.0.0.1:4186/1014_codex_project/014-cyber-xiaoya-study/ 。服务只监听127.0.0.1，默认端口4186，可用PORT覆盖。

## 内容与构建

RESEARCH.md是正文来源。build.mjs将12章研究渲染成静态阅读页，复制assets、sources和项目说明到dist；构建不联网，不读任何环境凭据。修改研究后重新构建即可更新。

阅读页以原创能力图作引导，包含能力、原理、价值与扩展摘要、12章目录、8张研究表格、高清PNG/SVG入口、来源登记和按需原视频播放。原视频只有用户点击“加载原帖视频”时才从原帖媒体地址加载，默认videoSource为空；若源站不可达，显示原帖入口和失败提示。

图解生成器在../scripts/make-overview.mjs。它使用sharp将原创SVG导出为PNG，不运行图像或视频模型。可在具有sharp的环境中运行，或将ARTIFACT_NODE_MODULES设置为已有文档运行时的node_modules目录。原图保留原字节，图解中按完整比例内嵌。

## 能力边界

这是研究阅读页，不是实时数字人应用。没有ASR、LLM、TTS或人物推理接口，没有弹幕采集、充值、账号创建或自动录音；不把页面可访问当作原作部署成功。

## 部署

dist为完整静态产物，使用相对资源路径，基础路径为/1014_codex_project/014-cyber-xiaoya-study/。可将dist复制到同一Pages站点的014-cyber-xiaoya-study/目录，遵守仓库docs/DEPLOYMENT.md。发布清单为根web/pages.json，根目录执行node scripts/build_pages.mjs会生成完整_site，再由.github/workflows/pages.yml发布。2026-10-15已部署并验证公网入口，正式地址为https://yydshly.github.io/1014_codex_project/014-cyber-xiaoya-study/，demo_url已登记。

桌面与手机阅读、目录跳转、图片资源、来源文件和构建检查的结果见../sources/verification.json。手机中的宽表格可在表格区域横向滑动，不应使整页横向溢出。

## 本轮媒体限制

本轮已点击原片入口，但远端媒体在观察期间仍为readyState=0，没有成功解码，因此不宣称已验证嵌入视频播放。原帖链接和本地封面保留；原片15秒未就绪时显示网络限制提示。主体图解、12章内容和本地来源文件已验证可读。

# 图片与来源

| 文件 | 内容 | 来源和改动 |
| --- | --- | --- |
| original-video-poster.jpg | 1200×900原视频封面，真人角色、直播窗口与Vidu S2标注 | [原媒体](https://pbs.twimg.com/amplify_video_thumb/2109814066734940160/img/pQ61UIUdDlY9zC_G.jpg)，2026-10-15读取；原文件保留，不去水印、不修改人像 |
| overview.svg | 一张能力总览图：原作效果、模型层、实时闭环、工程价值与边界 | 本研究原创SVG布局，内嵌上面完整封面作为引用；不是本地复现 |
| overview.png | 高清总览图导出 | 从同一SVG渲染，内容一致 |
| preview.jpg | 桌面静态研究页运行截图 | 1265px内容视口实际验证，不是原作服务运行截图 |
| published.jpg | GitHub Pages公网阅读页实际截图 | 2026-10-15发布后浏览器验收；引导图为原有原创能力总览 |
| mobile.jpg | 手机阅读布局 | 390×844外层视口验证，内容宽375px，整页无横向溢出 |

原图SHA-256见[sources/original-post.json](../sources/original-post.json)。人像与视频仍归原权利人，未确认可再授权或商业复用，不对含引用人像的总览图整体宣称MIT许可。

图中区分画面可见、转帖说法、通用解释和待确认。静态图不能证明实时性、精确口型、显存或收益。scripts/make-overview.mjs只排版文字、连线和已保存原图，不调用图像或视频生成模型。

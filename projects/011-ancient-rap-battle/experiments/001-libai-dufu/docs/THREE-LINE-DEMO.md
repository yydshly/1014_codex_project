# 李白 × 杜甫三句实测小样

`final/libai-dufu-three-line-demo-v1.mp4` 使用已经取得的三条真实生成镜头，实际呈现李白两句、杜甫一句的交锋。第四条 B02 不在此文件中，不能称为四句完整成片。四片正式组装与发布闸门保持不变。

时长 19.200 秒：共同舞台参考图片头 2.4 秒、A01 4.8 秒、A02 4.8 秒、B01 4.8 秒、共同舞台参考图片尾 2.4 秒。片头写有「李白 × 杜甫 · 三句实测」，片尾为「片段测试 · AI娱乐演绎」，全程保留 AI 生成标记。A02 单独标记时轴调整。

声音从锁定混音 `work/music_final.wav` 截取 0–16.8 秒，再接原 21.6–24 秒尾奏，输出最后 0.8 秒淡出；正文字幕仍使用原 heard 时间。没有改动混音、人声参考或原片字节。

A02 使用已记录的声学活动分组画面重定时，B01 保持 shift 0。A02、B01 原片音轨筛查失败均保留，不能称为精准口型通过。tiny 对 B01 原片识别少「见」对应字，但原始参考识别本身置信低，不能确定真实漏字。相关诊断见 [A02-RETIME.md](A02-RETIME.md)、[B01-REVIEW.md](B01-REVIEW.md)。

输出为 1280×720、25 fps、480 帧、H.264/AAC、48 kHz 双声道，启用 faststart。25 fps 保证 19.2 秒及每个 4.8 秒句槽精确落帧；四句正式版仍约定 24 fps、24 秒。

重跑独立三句版：

```powershell
node work/build-three-line-demo.mjs
node scripts/publish-demo.mjs --check
node scripts/publish-demo.mjs --publish
```

生成脚本仅复用已有素材，无付费请求，不运行四片组装或发布。独立的`publish-demo`先核对三条原片、参考音频、最终文件SHA与媒体复核，再替换本地网页视频、海报和脱敏记录，状态始终为`partial-generated`；不执行公网部署。输入 SHA、源出点、A02 控制点、原始 QA、编码参数、输出 SHA 和媒体复核保存在 `work/three-line-demo-report.json`。抽帧联系表为 `work/three-line-demo-review.jpg`，封面为 `final/libai-dufu-three-line-demo-preview.jpg`。整段 480 帧可解码，未检出黑帧，音频峰值 −4.4 dB 无削波；12 张抽帧的中文、角色名字、字幕与片头尾已目视检查。文件质量检查不构成口型或逐词准确性验收。

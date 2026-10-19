import assert from 'node:assert/strict';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.SPECREEL_URL || 'http://127.0.0.1:4188/1014_codex_project/008-specreel/';
const captures = JSON.parse(await readFile(path.join(root, 'captures/baseline/results.json'), 'utf8'));
assert.equal(captures.results.length, 3);
assert.ok(captures.results.every((r) => !r.failed && !r.errors.length && !r.postRequests.length));
const variants = {};
for (const variant of ['native', 'zh']) {
  const manifest = JSON.parse(await readFile(path.join(root, 'web', variant, 'manifest.json'), 'utf8'));
  assert.equal(manifest.flows.length, 3);
  const flows = [];
  for (const flow of manifest.flows) {
    assert.equal(flow.failed, false);
    assert.equal(flow.capture_ok, true);
    const html = await readFile(path.join(root, 'web', variant, flow.demo), 'utf8');
    const match = /const STEPS=([\s\S]*?);let cur=0/.exec(html);
    assert.ok(match);
    const steps = JSON.parse(match[1]);
    assert.equal(steps.length, flow.steps);
    assert.ok(steps.every((s) => s.img?.startsWith('data:image/') && !s.failed));
    if (variant === 'zh') {
      assert.ok(steps[0].caption.startsWith('打开 004'));
      assert.equal(steps.at(-1).caption, '保存本轮页面结果');
    }
    const mp4 = path.join(root, 'web', variant, flow.slug, 'demo.mp4');
    const media = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration,size:stream=codec_name,codec_type,width,height','-of','json',mp4], { encoding:'utf8' }));
    assert.ok(media.streams.some((s) => s.codec_type === 'video' && s.codec_name === 'h264'));
    assert.ok(!media.streams.some((s) => s.codec_type === 'audio'));
    assert.equal((await fetch(new URL(`${variant}/${flow.demo}`, base))).status, 200);
    flows.push({ ...flow, htmlBytes:(await stat(path.join(root,'web',variant,flow.demo))).size, videoSeconds:Number(media.format.duration), videoBytes:Number(media.format.size), videoSize:`${media.streams[0].width} × ${media.streams[0].height}`, uniqueFrames:new Set(steps.map((s) => s.img)).size });
  }
  variants[variant] = { flows, bundleBytes:(await stat(path.join(root,'web',variant,'gallery.html'))).size };
}
const range = await fetch(new URL('zh/02-search-plan/demo.mp4',base), { headers:{ Range:'bytes=0-31' } });
assert.equal(range.status,206);
assert.equal((await range.arrayBuffer()).byteLength,32);
const updated = JSON.parse(await readFile(path.join(root,'artifacts/update-check/manifest.json'),'utf8')).flows[0];
assert.equal(updated.healed,true);
assert.notEqual(updated.sig,variants.native.flows.find((f) => f.slug === updated.slug).sig);
const repoRoot = path.resolve(root,'..','..');
const hashes = {};
for (const file of ['projects/004-jasonzhu-ai/web/index.html','projects/004-jasonzhu-ai/web/app.js','projects/004-jasonzhu-ai/web/reddit.js','projects/004-jasonzhu-ai/web/styles.css','projects/004-jasonzhu-ai/web/data/reddit-latest.json','projects/004-jasonzhu-ai/demand-sources.json']) hashes[file] = createHash('sha256').update(await readFile(path.join(repoRoot,file))).digest('hex');
const report = { verifiedAt:new Date().toISOString(), sourceUrl:captures.sourceUrl, captureResults:captures.results, variants, updatedFlow:{slug:updated.slug,healed:updated.healed,signature:updated.sig},mp4RangeRequest:'206 / 32 bytes',sourceSha256:hashes,browserReview:'另见 assets/preview.png 与 RESEARCH.md；浏览器回放单独检查' };
await writeFile(path.join(root,'artifacts/verification.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({ flows:3,steps:variants.native.flows.reduce((n,f) => n+f.steps,0),checks:variants.native.flows.reduce((n,f) => n+f.checks,0),nativeBundleBytes:variants.native.bundleBytes,allCapturesPassed:true,externalPostRequests:0,updatedBadge:true,videoRangeRequests:true },null,2));

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const revision = '992309c0aa19845960228f880013d4685fde93b5';
const upstream = `https://raw.githubusercontent.com/Open-LLM-VTuber/Open-LLM-VTuber/${revision}`;
const modelRoot = `${upstream}/live2d-models/mao_pro`;
const manifestPath = resolve(root, 'asset-lock.json');
let old = {};
try { old = JSON.parse(await readFile(manifestPath, 'utf8')); } catch {}
const records = [];
async function save(url, relative) {
  const path = resolve(root, relative);
  let bytes;
  try { bytes = await readFile(path); } catch {}
  const expected = old.files?.find(f => f.path === relative)?.sha256;
  if (!bytes || (expected && createHash('sha256').update(bytes).digest('hex') !== expected)) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error(`素材下载失败 ${response.status}: ${url}`);
        bytes = Buffer.from(await response.arrayBuffer());
        break;
      } catch (error) { if (attempt === 3) throw error; }
    }
    if (expected && createHash('sha256').update(bytes).digest('hex') !== expected)
      throw new Error(`素材与已锁定版本不同：${relative}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }
  records.push({ path: relative, url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  return bytes;
}
const model = JSON.parse(await save(`${modelRoot}/runtime/mao_pro.model3.json`, 'public/avatar/mao_pro.model3.json'));
const refs = model.FileReferences;
const files = [refs.Moc, refs.Physics, refs.Pose, refs.DisplayInfo, ...refs.Textures,
  ...(refs.Expressions || []).map(x => x.File), ...Object.values(refs.Motions || {}).flat().map(x => x.File)].filter(Boolean);
for (let i = 0; i < files.length; i += 3)
  await Promise.all(files.slice(i, i + 3).map(file => save(`${modelRoot}/runtime/${file}`, `public/avatar/${file}`)));
await save(`${modelRoot}/ReadMe.txt`, 'licenses/mao-pro-ReadMe.txt');
await save(`${upstream}/LICENSE`, 'licenses/Open-LLM-VTuber-LICENSE.txt');
await save(`${upstream}/LICENSE-Live2D.md`, 'licenses/Live2D-terms.md');
await save('https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js', 'public/vendor/live2dcubismcore.min.js');
await writeFile(manifestPath, JSON.stringify({ upstream: 'Open-LLM-VTuber/Open-LLM-VTuber', revision, files: records.sort((a,b) => a.path.localeCompare(b.path)) }, null, 2) + '\n');
console.log(`已校验并准备 ${records.length} 个角色与运行时素材。`);

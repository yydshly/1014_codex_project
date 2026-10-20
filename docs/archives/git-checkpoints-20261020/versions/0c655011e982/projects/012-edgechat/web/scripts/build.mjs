import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
const web = new URL('../', import.meta.url);
const dist = new URL('dist/', web);
await mkdir(dist, { recursive: true });
for (const name of ['index.html', 'styles.css', 'app.js', 'data.js', 'favicon.svg']) {
  await copyFile(new URL(name, web), new URL(name, dist));
}
for (const name of ['edgechat-summary.png', 'edgechat-summary.svg']) {
  await copyFile(new URL(`../assets/${name}`, web), new URL(name, dist));
}
const [summaryPng, summarySvg] = await Promise.all(['png', 'svg'].map((extension) => readFile(new URL(`../assets/edgechat-summary.${extension}`, web))));
const [html, css, data, app] = await Promise.all(['index.html', 'styles.css', 'data.js', 'app.js'].map((name) => readFile(new URL(name, web), 'utf8')));
const standalone = html
  .replace('  <link rel="icon" href="./favicon.svg" type="image/svg+xml">\n', '')
  .replace('<link rel="stylesheet" href="./styles.css">', () => `<style>${css}</style>`)
  .replace('<script type="module" src="./app.js"></script>', () => `<script type="module">\n${data.replace(/^export /gm, '')}\n${app.replace(/^import .*\n/, '')}\n</script>`)
  .replace('<a class="back-link" href="/1014_codex_project/">← 项目研究集</a>', '<a class="back-link" href="#evidence">查看研究来源 ↓</a>')
  .replace('src="./edgechat-summary.png"', () => `src="data:image/png;base64,${summaryPng.toString('base64')}"`)
  .replace('href="./edgechat-summary.svg"', () => `href="data:image/svg+xml;base64,${summarySvg.toString('base64')}"`);
await writeFile(new URL('standalone.html', dist), standalone);
console.log('012 研究页已构建：web/dist/；standalone.html 可直接离线打开。');

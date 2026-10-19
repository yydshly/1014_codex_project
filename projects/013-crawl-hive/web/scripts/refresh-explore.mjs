import { fileURLToPath } from 'node:url';
import { refreshExplorer, SOURCE_DEFINITIONS } from '../explore/server.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const ids = process.argv.slice(2);
if (ids.some(id => !SOURCE_DEFINITIONS.some(source => source.id === id))) {
  console.error(`仅支持预设来源：${SOURCE_DEFINITIONS.map(source => source.id).join(', ')}`);
  process.exitCode = 1;
} else {
  let lastProgress = '';
  const state = await refreshExplorer({ webRoot, sourceIds: ids, writeSnapshot: true, onProgress(progress) {
    const message = `${progress.done}/${progress.total} ${progress.sources.map(source => `${source.id}:${source.status}${source.count !== undefined ? `(${source.count})` : ''}`).join(' ')}`;
    if (message !== lastProgress) { console.log(message); lastProgress = message; }
  } });
  for (const source of state.sources) {
    console.log(`${source.name}: ${source.status} / ${source.itemCount} 条${source.error ? ` / ${source.error}` : ''}`);
  }
  console.log(`快照：${state.items.length} 条，最近成功采集：${state.lastUpdated || '尚未成功'}。`);
  if (state.runs[0]?.status === 'error') process.exitCode = 1;
}

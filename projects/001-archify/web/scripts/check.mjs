import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodes, revision } from '../data/project.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const language of ['zh', 'en']) {
  const receipt = JSON.parse(fs.readFileSync(path.join(root, `dist/diagrams/archify-${language}.checks.json`), 'utf8'));
  assert.equal(receipt.ok, true, `The ${language} diagram must pass upstream gates`);
  const spec = JSON.parse(fs.readFileSync(path.join(root, `dist/diagrams/archify-${language}.json`), 'utf8'));
  assert.equal(spec.meta.repository.revision, revision);
  assert.equal(spec.components.length, nodes.length);
  const html = fs.readFileSync(path.join(root, `dist/diagrams/archify-${language}.html`), 'utf8');
  assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html), 'Generated reader must not depend on an external script');
  for (const node of nodes) {
    assert.ok(html.includes(node.id));
    const lines = fs.readFileSync(path.join(root, '.cache/upstream', node.source.path), 'utf8').split('\n');
    assert.ok(node.source.end_line <= lines.length, `Invalid source range: ${node.source.path}`);
  }
}
for (const asset of ['index.html', 'app.js', 'styles.css', 'project.json', 'ARCHIFY-LICENSE.txt', 'THIRD_PARTY_NOTICES.md']) {
  assert.ok(fs.existsSync(path.join(root, 'dist', asset)), `Missing static asset ${asset}`);
}
console.log('Static artifacts, source ranges, pinned version and upstream receipts verified.');

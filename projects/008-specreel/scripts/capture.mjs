import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DEMAND_PAGE_URL || 'http://127.0.0.1:4176/1014_codex_project/004-jasonzhu-ai/';
const run = process.argv[2] || 'baseline';
const selectedSlug = process.argv[3];
const output = path.join(root, 'captures', run);
await mkdir(output, { recursive: true });
const executable = process.env.CHROME_PATH || chromium.executablePath();
await access(executable);
const browser = await chromium.launch({ executablePath: executable, headless: true });
const previous = selectedSlug ? await readFile(path.join(output, 'results.json'), 'utf8').then((text) => JSON.parse(text).results).catch((error) => { if (error.code === 'ENOENT') return []; throw error; }) : [];
const results = previous.filter((result) => result.slug !== selectedSlug);
const taskWord = run === 'updated' ? 'client feedback approval' : 'client feedback revisions';
const pause = async (page, milliseconds = 1100) => page.waitForTimeout(milliseconds);

async function record(slug, title, perform) {
  if (selectedSlug && slug !== selectedSlug) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, locale: 'zh-CN', reducedMotion: 'reduce' });
  const folder = path.join(output, slug);
  await mkdir(folder, { recursive: true });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true, title });
  const started = Date.now();
  let failed;
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.reddit-card')).toHaveCount(2);
    await pause(page);
    await perform(page);
    await pause(page, 1600);
    expect(errors, '页面没有报错或失败请求').toEqual([]);
    await page.screenshot({ path: path.join(folder, 'end-state.png') });
  } catch (error) {
    failed = error.message;
    await page.screenshot({ path: path.join(folder, 'failure.png') });
  } finally {
    await context.tracing.stop({ path: path.join(folder, 'trace.zip') });
    results.push({ slug, title, run, failed: failed || null, errors, requestCount: requests.length, postRequests: requests.filter((request) => request.method === 'POST'), recordedSeconds: +( (Date.now() - started) / 1000).toFixed(2) });
    console.log(`${slug}: ${failed ? 'failed' : 'passed'} (${results.at(-1).recordedSeconds}s)`);
    await context.close();
  }
}

try {
  await record('01-reddit-evidence', '看真实问题、原话和已有办法', async (page) => {
    await page.getByRole('link', { name: '查看 Reddit 实际样本' }).click();
    await pause(page);
    await expect(page.locator('#reddit-report-meta')).toContainText('2 条独立帖子');
    const first = page.locator('.reddit-card').first();
    await first.getByRole('heading', { name: '问题原话与证据' }).scrollIntoViewIfNeeded();
    await pause(page);
    await expect(first.locator('.reddit-quote').first()).toBeVisible();
    await first.getByRole('heading', { name: '还不能确定什么' }).scrollIntoViewIfNeeded();
    await pause(page);
    await expect(first.locator('.reddit-next-step')).toBeVisible();
    await first.getByText('查看采集片段与来源条件', { exact: true }).click();
    await pause(page);
    await expect(first.locator('.reddit-raw')).toHaveAttribute('open', '');
    await first.getByText('查看采集片段与来源条件', { exact: true }).click();
  });

  await record('02-search-plan', '从观察对象到下一轮采集指令', async (page) => {
    await page.getByRole('link', { name: '从搜索词开始' }).click();
    await pause(page);
    await page.getByLabel('观察什么任务', { exact: false }).fill(taskWord);
    await pause(page, 700);
    await page.getByRole('button', { name: '更新搜索入口' }).click();
    await pause(page);
    await expect(page.locator('.query-list')).toContainText(taskWord);
    await page.getByRole('tab', { name: 'App 评论 使用障碍与能力缺口' }).click();
    await pause(page);
    await expect(page.locator('.query-list')).toContainText('apps.apple.com');
    await page.getByRole('tab', { name: 'Reddit 求助与手工补救' }).click();
    await pause(page);
    await page.getByRole('link', { name: '带入采集计划' }).click();
    await pause(page);
    await expect(page.getByLabel('准备观察谁？', { exact: false })).toHaveValue('自由职业设计师');
    await page.getByLabel('已知工具与替代办法').fill('邮件、微信、手工汇总修改');
    await pause(page, 700);
    await page.getByLabel('这一轮最想核实什么？').fill('反馈是否分散？已有办法是否够用？');
    await page.getByRole('button', { name: '生成采集指令' }).click();
    await pause(page);
    await expect(page.getByLabel('生成的 AI 采集指令')).toHaveValue(new RegExp(taskWord));
    await page.getByRole('tab', { name: '提取证据', exact: true }).click();
    await pause(page);
    await expect(page.getByLabel('生成的 AI 采集指令')).toHaveValue(/原话/);
    await page.getByRole('tab', { name: '去重筛选', exact: true }).click();
    await pause(page);
    await expect(page.getByLabel('生成的 AI 采集指令')).toHaveValue(/独立/);
  });

  await record('03-source-filter', '筛选历史线索并查看来源详情', async (page) => {
    await page.getByRole('link', { name: '怎样采集', exact: true }).click();
    await pause(page);
    await page.getByRole('tab', { name: '03 采集原始内容' }).click();
    await pause(page);
    await page.getByRole('button', { name: '查看这条原始线索' }).click();
    await pause(page);
    await expect(page.locator('#source-dialog')).toBeVisible();
    await expect(page.locator('#dialog-title')).toContainText('CSV');
    await expect(page.locator('#dialog-channel')).toContainText('R07');
    await page.getByRole('button', { name: '关闭来源详情' }).click();
    await page.locator('#source-search').scrollIntoViewIfNeeded();
    await pause(page);
    await page.getByRole('button', { name: 'Reddit 8', exact: true }).click();
    await page.getByRole('searchbox', { name: '搜索需求线索' }).fill('CSV');
    await pause(page);
    await expect(page.locator('#evidence-grid')).toContainText('CSV');
    await expect(page.locator('#evidence-grid [data-open-record="R07"]')).toBeVisible();
  });
} finally {
  await browser.close();
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ sourceUrl: url, viewport: '1440 × 960', capturedAt: new Date().toISOString(), playwright: '1.62.1', results }, null, 2) + '\n', 'utf8');
}
console.log(JSON.stringify(results.map(({ slug, failed, errors, postRequests, recordedSeconds }) => ({ slug, failed, errors, postRequestCount: postRequests.length, recordedSeconds })), null, 2));
if (results.some((result) => result.failed)) process.exitCode = 1;

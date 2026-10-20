// Auto-scaffolded by `specreel recommend`. Edit the TODOs, then:
//   node this_file.mjs && specreel test-results -o site --bundle
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4176/1014_codex_project/004-jasonzhu-ai/';
// scheme+host of BASE — other pages are ORIGIN + path, never BASE + path
const ORIGIN = new URL(BASE).origin;

const FLOWS = [
  // Fill the 如何发现需求、采集需求｜004 实践手记 form
  ['fill-the-004-form', async (page) => {
    await page.goto("http://127.0.0.1:4176/1014_codex_project/004-jasonzhu-ai/")
    await expect(page).toHaveTitle(new RegExp("\u5982\u4f55\u53d1\u73b0\u9700\u6c42\u3001\u91c7\u96c6\u9700\u6c42\uff5c004\\ \u5b9e\u8df5\u624b\u8bb0", "i"))
    await page.locator("#reddit-query").first().fill("Sample text")
    await page.waitForTimeout(350);
    await page.getByPlaceholder("\u4f8b\u5982\uff1afreelance").first().fill("Sample text")
    await page.waitForTimeout(350);
    # TODO: click submit / assert the result you care about
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);
  }],
  // Fill the 如何发现需求、采集需求｜004 实践手记 form
  ['fill-the-004-form-2', async (page) => {
    await page.goto("http://127.0.0.1:4176/1014_codex_project/004-jasonzhu-ai/")
    await expect(page).toHaveTitle(new RegExp("\u5982\u4f55\u53d1\u73b0\u9700\u6c42\u3001\u91c7\u96c6\u9700\u6c42\uff5c004\\ \u5b9e\u8df5\u624b\u8bb0", "i"))
    await page.getByPlaceholder("\u4f8b\u5982\uff1a\u81ea\u7531\u804c\u4e1a\u8bbe\u8ba1\u5e08").first().fill("Sample text")
    await page.waitForTimeout(350);
    await page.getByPlaceholder("\u4f8b\u5982\uff1aclient feedback").first().fill("Sample text")
    await page.waitForTimeout(350);
    # TODO: click submit / assert the result you care about
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);
  }],
  // Fill the 如何发现需求、采集需求｜004 实践手记 form
  ['fill-the-004-form-3', async (page) => {
    await page.goto("http://127.0.0.1:4176/1014_codex_project/004-jasonzhu-ai/")
    await expect(page).toHaveTitle(new RegExp("\u5982\u4f55\u53d1\u73b0\u9700\u6c42\u3001\u91c7\u96c6\u9700\u6c42\uff5c004\\ \u5b9e\u8df5\u624b\u8bb0", "i"))
    await page.getByPlaceholder("\u4f8b\u5982\uff1a\u9700\u8981\u6279\u91cf\u4e0a\u67b6\u5546\u54c1\u7684\u5c0f\u5546\u5bb6").first().fill("Sample text")
    await page.waitForTimeout(350);
    await page.getByPlaceholder("\u4f8b\u5982\uff1a\u6536\u96c6\u5ba2\u6237\u53cd\u9988\u3001\u6838\u5bf9\u5e93\u5b58\u6216\u6574\u7406\u521b\u4f5c\u7d20\u6750").first().fill("Sample text")
    await page.waitForTimeout(350);
    await page.getByPlaceholder("\u53ef\u4f5c\u4e3a\u68c0\u7d22\u8bcd\uff1b\u5b9e\u9645\u4f7f\u7528\u6548\u679c\u4ecd\u9700\u6838\u5b9e").first().fill("Sample text")
    await page.waitForTimeout(350);
    await page.getByPlaceholder("\u4f8b\u5982\uff1a\u91cd\u590d\u624b\u5de5\u3001\u8fd4\u5de5\u3001\u5bfb\u627e\u66ff\u4ee3\u5de5\u5177\u3001\u5916\u5305").first().fill("Sample text")
    await page.waitForTimeout(350);
    await page.getByPlaceholder("\u4f8b\u5982\uff1a\u4e24\u4e2a\u76f8\u5173\u793e\u533a\u3001\u540c\u7c7b App \u8bc4\u8bba\u4e0e\u5916\u5305\u4efb\u52a1\uff1b\u8bb0\u5f55\u8fd1\u671f\u4e0e\u5386\u53f2\u6837\u672c\u5dee\u5f02").first().fill("Sample text")
    await page.waitForTimeout(350);
    await page.getByPlaceholder("\u4f8b\u5982\uff1a\u76f8\u540c\u969c\u788d\u662f\u5426\u91cd\u590d\u51fa\u73b0\uff1f\u5df2\u6709\u5de5\u5177\u662f\u5426\u5df2\u7ecf\u89e3\u51b3\uff1f").first().fill("Sample text")
    await page.waitForTimeout(350);
    # TODO: click submit / assert the result you care about
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);
  }],
  // Search on 如何发现需求、采集需求｜004 实践手记
  ['search-on-004', async (page) => {
    await page.goto("http://127.0.0.1:4176/1014_codex_project/004-jasonzhu-ai/")
    await expect(page).toHaveTitle(new RegExp("\u5982\u4f55\u53d1\u73b0\u9700\u6c42\u3001\u91c7\u96c6\u9700\u6c42\uff5c004\\ \u5b9e\u8df5\u624b\u8bb0", "i"))
    await page.getByPlaceholder("\u641c\u7d22\u95ee\u9898\u3001\u5e73\u53f0\u6216\u4f5c\u8005\u2026").first().fill("test")
    await page.waitForTimeout(350);
    await page.getByPlaceholder("\u641c\u7d22\u95ee\u9898\u3001\u5e73\u53f0\u6216\u4f5c\u8005\u2026").first().press("Enter")
    # TODO: click submit / assert the result you care about
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);
  }],
];

for (const [name, fn] of FLOWS) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);  // fail fast, not 30s/step
  try { await fn(page); console.log('ok  ', name); }
  catch (e) { console.log('FAIL', name, '-', String(e).split('\n')[0]); }
  fs.mkdirSync(`test-results/${name}`, { recursive: true });
  await ctx.tracing.stop({ path: `test-results/${name}/trace.zip` });
  await browser.close();
}

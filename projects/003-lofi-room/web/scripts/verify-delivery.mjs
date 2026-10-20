import { RepositoryRun } from "../server/repository.js";
import { testDemo } from "../server/demo-tests.js";

if (!process.argv[2])
  throw new Error(
    "用法：node scripts/verify-delivery.mjs <任务 UUID> [复验说明]",
  );
const run = new RepositoryRun(process.cwd(), process.argv[2]);
const previous = JSON.parse(await run.read("delivery.json"));
const result = await testDemo(run);
if (!result.passed) {
  console.error(
    `复验失败：${result.passedCount}/${result.total}，交付保持不可访问；详见 tests.log。`,
  );
  process.exitCode = 1;
} else {
  const note = process.argv.slice(3).join(" ").slice(0, 3000);
  const delivery = {
    ...previous,
    tests: result,
    verifiedAt: result.testedAt,
    acceptance: {
      source: "local-verification",
      notes: note,
      baseDigest:
        previous.acceptance?.baseDigest ||
        previous.acceptance?.previousDigest ||
        previous.tests.digest,
    },
  };
  const readme = (await run.read("README.md")).split("\n## 本地复验\n")[0];
  await run.write(
    "README.md",
    `${readme}\n## 本地复验\n\n当前交付版本：${result.testedAt}\n${result.passedCount}/${result.total} 通过；摘要 ${result.digest}。\n\n${note}\n\n验证范围是本轮结构、语法、核心逻辑断言与记录的浏览器操作；未做上游完整构建、完整浏览器自动化或逐字节一致性比对。角色原文中的比较措辞不作为额外的验证结论。\n`,
  );
  const { demoUrl, downloadUrl, manifestUrl, ...provenance } = delivery;
  await run.write("provenance.json", JSON.stringify(provenance, null, 2));
  await run.write("delivery.json", JSON.stringify(delivery, null, 2));
  console.log(
    `复验通过：${result.passedCount}/${result.total}，交付摘要和来源记录已更新。`,
  );
}

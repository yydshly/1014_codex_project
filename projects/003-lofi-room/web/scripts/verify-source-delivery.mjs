// Re-verify an edited local delivery without inventing an agent run or replacing
// its immutable conversation. Existing HTTP service must still be reachable.
import { SourceRun, SourceProject, sourcePath } from "../server/source-project.js";
import { LocalGuest } from "../server/local-runner.js";
import { SANDBOX_TTL } from "../server/sandbox.js";
const [id, notes] = process.argv.slice(2);
if (!id || !notes) throw new Error('用法：node scripts/verify-source-delivery.mjs <UUID> "本地修订与验收说明"');
const run = new SourceRun(process.cwd(), id);
const original = JSON.parse(await run.read("delivery.json"));
if (original.provider !== "local" || !original.tests?.passed) throw new Error("仅可复验已有通过记录的本机目录交付。");
const url = new URL(original.demoUrl);
if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port) throw new Error("只能复验该任务的本机Demo地址。");
const signal = AbortSignal.timeout(900000), guest = new LocalGuest(process.cwd(), id);
await guest.init(signal);
guest.port = Number(url.port); guest.env.PORT = url.port;
const repo = { url: original.repository, commit: original.commit, license: original.license,
  owner: new URL(original.repository).pathname.split("/")[1], repo: new URL(original.repository).pathname.split("/")[2] };
const project = new SourceProject(process.cwd(), repo, run);
project.guest = guest; project.root = guest.root + "/repo";
project.projectDirectory = sourcePath(original.projectDirectory, { directory: true });
project.commands = JSON.parse(await run.read("commands.json"));
const baselineCode = `const cp=require('node:child_process');const sha=process.argv[1];const names=cp.execFileSync('git',['ls-tree','-r','--name-only',sha]).toString().trim().split('\\n');const files={};for(const path of names){files[path]=cp.execFileSync('git',['show',sha+':'+path],{maxBuffer:20000000}).toString('base64')}console.log(JSON.stringify(files));`;
const baseline = await project.checked("复验：读取固定commit的原始文件", "node", ["-e", baselineCode, original.commit], { signal });
project.baseline = JSON.parse(baseline.stdout);
const packagePath = project.projectDirectory === "." ? "package.json" : project.projectDirectory + "/package.json";
project.initialPackage = { path: packagePath, scripts: JSON.parse(Buffer.from(project.baseline[packagePath], "base64").toString()).scripts };
project.package = JSON.parse(await project.read(packagePath, signal));
await guest.configureProjectRuntime(project.package, { signal, onProgress: console.log });
project.runtime = original.runtime;
project.demo = original.demo; project.demoUrl = original.demoUrl;
project.createdAt = Date.parse(original.expiresAt) - SANDBOX_TTL;
project.installed = await project.dependenciesKey(signal);
project.startDemo = async () => {
  const response = await fetch(original.demoUrl, { redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html") || (await response.text()).length < 30)
    throw new Error("现有Demo服务未通过HTTP复验，请重新运行任务。");
  return original.demoUrl;
};
await project.progress.run(console.log, async () => {
  const tests = await project.verify(signal);
  if (!tests.passed) throw new Error("复验失败；原交付清单未更新，请查看命令日志。");
  const delivery = await project.deliver(signal, { acceptance: {
    method: "manual-browser-acceptance-and-original-build-test", notes,
    previousDigest: original.tests.digest, verifiedAt: new Date().toISOString(),
  } });
  console.log(JSON.stringify({ runId: id, passed: delivery.tests.passed, checks: delivery.tests.total, demoUrl: delivery.demoUrl }));
});

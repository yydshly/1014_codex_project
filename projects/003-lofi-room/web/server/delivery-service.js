import { SourceRun, SourceProject, sourcePath } from "./source-project.js";
import { LocalGuest } from "./local-runner.js";
import { createHash } from "node:crypto";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

// Start existing verified work; do not clone, call a model or claim new tests.
export async function restartDelivery(directory, id, { guestFactory = (...args) => new LocalGuest(...args), fetcher = fetch } = {}) {
  const run = new SourceRun(directory, id);
  const delivery = JSON.parse(await run.read("delivery.json"));
  if (delivery.provider !== "local" || !delivery.tests?.passed) throw new Error("仅支持重启通过验证的本机目录成果。");
  const signal = AbortSignal.timeout(60000), guest = guestFactory(directory, id);
  await guest.init(signal);
  const project = new SourceProject(directory, { url: delivery.repository, commit: delivery.commit, license: delivery.license }, run, { fetcher });
  project.guest = guest; project.root = guest.root + "/repo";
  project.projectDirectory = sourcePath(delivery.projectDirectory, { directory: true });
  project.commands = JSON.parse(await run.read("commands.json"));
  try {
    const files = await project.snapshot(signal);
    const digest = createHash("sha256").update(JSON.stringify(files)).digest("hex");
    if (digest !== delivery.tests.digest) throw new Error("交付源码发生变化，请先重新构建和验证，不能直接启动旧成果。");
    project.baseline = files;
    const packagePath = project.projectDirectory === "." ? "package.json" : project.projectDirectory + "/package.json";
    project.package = JSON.parse(Buffer.from(files[packagePath], "base64").toString("utf8"));
    await guest.configureProjectRuntime(project.package, { signal });
    project.demo = delivery.demo;
    const demoUrl = await project.startDemo(signal);
    const refreshed = { ...delivery, demoUrl, expiresAt: new Date(project.createdAt + 40 * 60 * 1000).toISOString(), serviceRestartedAt: new Date().toISOString() };
    const archive = unzipSync(await run.read("source.zip"));
    archive["evidence/delivery.json"] = strToU8(JSON.stringify(refreshed, null, 2));
    archive["evidence/commands.json"] = strToU8(JSON.stringify(project.commands, null, 2));
    if (archive["README-交付.md"]) archive["README-交付.md"] = strToU8(strFromU8(archive["README-交付.md"]).replaceAll(delivery.demoUrl, demoUrl).replaceAll(delivery.expiresAt, refreshed.expiresAt));
    await run.write("source.zip", Buffer.from(zipSync(archive)));
    await run.write("delivery.json", refreshed);
    await run.write("state.json", { ...refreshed, status: "complete" });
    return refreshed;
  } catch (error) { await guest.stop(); throw error; }
}

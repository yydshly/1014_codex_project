import { readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
for (const directory of ["src", "shared", "server", "scripts", "tests"])
  for (const file of await readdir(directory))
    if (/\.(js|mjs)$/.test(file))
      execFileSync(process.execPath, ["--check", `${directory}/${file}`], {
        stdio: "pipe",
      });
console.log("语法检查通过：场景、协作、语音、服务端与测试模块。");

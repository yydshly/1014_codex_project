// Trusted launcher keeps service expiry independent of the Vite API process.
import { readFileSync, createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
const spec = JSON.parse(readFileSync(process.argv[2], "utf8"));
const log = createWriteStream(spec.logPath, { flags: "a" });
const child = spawn(spec.binary, spec.args, { cwd: spec.cwd, env: spec.env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
child.on("error", (error) => { log.end(error.message); process.exitCode = 1; });
const timer = setTimeout(() => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    killer.on("error", () => { child.kill(); });
  } else child.kill("SIGTERM");
}, spec.ttl);
child.on("close", (code) => { clearTimeout(timer); log.end(); process.exitCode = code || 0; });

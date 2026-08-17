// Boot the production server, run the given browser test scripts against it,
// then shut it down. Usage:
//   node test/with-server.mjs test/ui.test.mjs test/share.test.mjs
// Assumes the app is already built (`next build`); the npm script does that.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { PORT, BASE, findChromium } from "./lib.mjs";

const scripts = process.argv.slice(2);
if (scripts.length === 0) {
  console.error("usage: node test/with-server.mjs <script.mjs> [...]");
  process.exit(2);
}

// No browser -> the suites would skip anyway; don't bother starting a server.
if (!findChromium()) {
  console.log("SKIP: no Chromium found; skipping browser suites.");
  process.exit(0);
}

const nextBin = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next",
);

const server = spawn(nextBin, ["start", "-p", String(PORT)], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

function shutdown() {
  if (!server.killed) server.kill("SIGTERM");
}
process.on("exit", shutdown);
process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function runScript(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const up = await waitForServer();
if (!up) {
  console.error(`Server did not come up at ${BASE} within timeout.`);
  shutdown();
  process.exit(1);
}

let worst = 0;
for (const script of scripts) {
  const code = await runScript(script);
  if (code > worst) worst = code;
}

shutdown();
process.exit(worst);

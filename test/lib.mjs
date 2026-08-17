// Shared helpers for the browser-driven tests.
//
// The suites talk to a running production server and drive a real Chromium.
// Neither is bundled, so we resolve both from the environment and skip
// gracefully (exit 0) when no browser is available, rather than failing a CI
// job that simply has no browser installed.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const PORT = process.env.PORT || "3123";
export const BASE = process.env.BASE_URL || `http://localhost:${PORT}/`;

const SKIP = 0;

/** Locate a Chromium executable, or return null if none can be found. */
export function findChromium() {
  const explicit =
    process.env.PLAYWRIGHT_CHROMIUM_PATH || process.env.PW_CHROMIUM;
  if (explicit && existsSync(explicit)) return explicit;

  // Pre-installed browsers (e.g. PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers).
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    "/opt/pw-browsers",
  ].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root)
      .filter((d) => d.startsWith("chromium-"))
      .sort()
      .reverse();
    for (const d of dirs) {
      for (const rel of [
        "chrome-linux/chrome",
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "chrome-win/chrome.exe",
      ]) {
        const exe = join(root, d, rel);
        if (existsSync(exe)) return exe;
      }
    }
  }
  return null;
}

/** Launch Chromium, or print a skip notice and exit 0 when unavailable. */
export async function launchOrSkip(chromium) {
  const exe = findChromium();
  if (!exe) {
    console.log(
      "SKIP: no Chromium found. Set PLAYWRIGHT_CHROMIUM_PATH or install a browser.",
    );
    process.exit(SKIP);
  }
  return chromium.launch({ executablePath: exe });
}

/** Tiny assertion collector shared by the browser suites. */
export function makeChecker() {
  const state = { pass: 0, fail: 0, fails: [] };
  const ok = (cond, msg) => {
    if (cond) state.pass++;
    else {
      state.fail++;
      state.fails.push(msg);
    }
  };
  const report = (label) => {
    console.log(`\n${label} PASS ${state.pass}  FAIL ${state.fail}`);
    if (state.fail) {
      console.log("Failures:");
      for (const f of state.fails) console.log("  ✗ " + f);
    }
    return state.fail === 0;
  };
  return { ok, report };
}

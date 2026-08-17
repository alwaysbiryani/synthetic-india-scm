// Browser smoke test: every metric, scenario toggle and dropdown wires
// through to the chart and the stat ledger. Needs a running server (see
// test/with-server.mjs) and a Chromium (auto-detected by test/lib.mjs).
import { chromium } from "playwright-core";
import { BASE, launchOrSkip, makeChecker } from "./lib.mjs";

const { ok, report } = makeChecker();
const browser = await launchOrSkip(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: "networkidle" });

// Chart renders
ok(await page.locator("svg.recharts-surface").first().isVisible(), "chart svg not visible");

// Helper: read the four ledger stat values (labels are uppercased via CSS,
// so innerText returns them uppercased — normalise to lower-case keys).
async function stats() {
  const cells = page.locator('[aria-label="Shortfall and fit"] > div');
  const n = await cells.count();
  const out = {};
  for (let i = 0; i < n; i++) {
    const label = (await cells.nth(i).locator("p").first().innerText())
      .trim()
      .toLowerCase();
    const value = (await cells.nth(i).locator("p").nth(1).innerText()).trim();
    out[label] = value;
  }
  return out;
}

const s0 = await stats();
ok(Object.keys(s0).length === 4, `expected 4 stat cells, got ${Object.keys(s0).length}`);
ok(/\$/.test(s0["gap"] || ""), `Gap not a $ value: ${s0["gap"]}`);
ok(/^0\.\d\d$|^1\.00$/.test(s0["placebo p"] || ""), `Placebo p unexpected: ${s0["placebo p"]}`);

// --- Metric radios switch outcome + rescale chart ---
for (const label of ["Polyarchy", "Freedom of religion", "GDP per capita"]) {
  await page.getByRole("radio", { name: label }).click();
  await page.waitForTimeout(120);
  const checked = await page.getByRole("radio", { name: label }).getAttribute("aria-checked");
  ok(checked === "true", `metric ${label} did not become checked`);
}

// --- Stacking a scenario reveals its knobs ---
await page.getByRole("button", { name: "2 · GDP accounting", exact: true }).click();
await page.waitForTimeout(150);
ok(await page.getByText("Scenario knobs").isVisible(), "knobs panel did not appear after stacking s2");

// s2 Accounting dropdown: cycle every option, Gap must change on haircut
const acct = page.locator("select").filter({ hasText: "Raw PWT 11.0" }).first();
ok(await acct.isVisible(), "accounting dropdown not visible");
const gapRaw = (await stats())["gap"];
await acct.selectOption("backcast");
await page.waitForTimeout(150);
const gapBack = (await stats())["gap"];
ok(gapBack !== gapRaw, `Gap did not change on 75% back-cast (${gapRaw} -> ${gapBack})`);
await acct.selectOption("proxy");
await page.waitForTimeout(150);
const gapProxy = (await stats())["gap"];
ok(gapProxy !== gapBack, `Gap did not change on 55% proxy (${gapBack} -> ${gapProxy})`);

// --- s3 governance dropdown (needs a non-GDP metric to bite) ---
await page.getByRole("radio", { name: "Polyarchy" }).click();
await page.getByRole("button", { name: "3 · V-Dem vs statute", exact: true }).click();
await page.waitForTimeout(150);
const gov = page.locator("select").filter({ hasText: "V-Dem raw" }).first();
ok(await gov.isVisible(), "governance dropdown not visible");
const gapVdem = (await stats())["gap"];
await gov.selectOption("statutory");
await page.waitForTimeout(150);
const gapStat = (await stats())["gap"];
ok(gapStat !== gapVdem, `Gap did not change V-Dem->statutory (${gapVdem} -> ${gapStat})`);
await gov.selectOption("dif");
await page.waitForTimeout(150);
ok((await stats())["gap"] !== gapStat, "Gap did not change statutory->DIF blend");

// --- s4 COVID dropdown: 'Through 2019' truncates the figure caption ---
await page.getByRole("button", { name: "4 · COVID window", exact: true }).click();
await page.waitForTimeout(150);
const covid = page.locator("select").filter({ hasText: "Full window" }).first();
ok(await covid.isVisible(), "covid dropdown not visible");
await covid.selectOption("preCovid");
await page.waitForTimeout(150);
const caption = await page.locator("figcaption").innerText();
ok(/2019/.test(caption), `caption should show 2019 end after preCovid: "${caption}"`);
await covid.selectOption("ife");
await page.waitForTimeout(120);

// --- Placebos <details> opens and shows India's ratio line ---
await page.getByText("Placebos", { exact: true }).click();
await page.waitForTimeout(120);
const placeboText = await page.locator("details", { hasText: "Placebo unit" }).innerText();
ok(/post\/pre RMSPE ratio is/.test(placeboText), "placebo caption missing India ratio line");
ok((await page.locator("table.ledger-table tbody tr").count()) > 0, "placebo table has no rows");

// --- Edge case: window end before treatment -> graceful, no 'Infinity'/'NaN' ---
await page.getByRole("button", { name: "Reset to paper" }).click();
await page.waitForTimeout(120);
await page.getByText("Window", { exact: true }).click();
await page.waitForTimeout(120);
// The 'Window end' <label> wraps its range input as a descendant.
const winEnd = page.locator("label", { hasText: "Window end" }).locator('input[type="range"]');
await winEnd.evaluate((el) => {
  const set = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  ).set;
  set.call(el, "2005");
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.waitForTimeout(180);
const body = await page.locator("body").innerText();
ok(!/Infinity/.test(body), "page shows 'Infinity' after empty post-window");
ok(!/NaN/.test(body), "page shows 'NaN' after empty post-window");
const sEdge = await stats();
ok(sEdge["placebo p"] === "—", `Placebo p should be '—' when unscored, got ${sEdge["placebo p"]}`);

await browser.close();

if (errors.length) {
  console.log("\nConsole/page errors:");
  for (const e of errors.slice(0, 10)) console.log("  ! " + e);
}
ok(errors.length === 0, "console/page errors present");
process.exit(report("UI") ? 0 : 1);

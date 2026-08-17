// Browser test for the shareable-URL feature and the knobs-under-Stack
// layout. Needs a running server (see test/with-server.mjs) and a Chromium.
import { chromium } from "playwright-core";
import { BASE, launchOrSkip, makeChecker } from "./lib.mjs";

const { ok, report } = makeChecker();
const browser = await launchOrSkip(chromium);

// ---- Part A: interacting updates the URL ----
const p = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
const errA = [];
p.on("console", (m) => m.type() === "error" && errA.push(m.text()));
p.on("pageerror", (e) => errA.push(String(e)));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForTimeout(300);

// fresh load: clean URL (no query)
ok(new URL(p.url()).search === "", `fresh load should have empty query, got "${new URL(p.url()).search}"`);

// switch metric + stack two scenarios + pick dropdowns
await p.getByRole("radio", { name: "Polyarchy" }).click();
await p.getByRole("button", { name: "3 · V-Dem vs statute", exact: true }).click();
await p.getByRole("button", { name: "4 · COVID window", exact: true }).click();
await p.waitForTimeout(200);
await p.locator("select").filter({ hasText: "V-Dem raw" }).first().selectOption("statutory");
await p.locator("select").filter({ hasText: "Full window" }).first().selectOption("preCovid");
await p.waitForTimeout(250);

const q = new URLSearchParams(new URL(p.url()).search);
ok(q.get("m") === "polyarchy", `URL m expected polyarchy, got ${q.get("m")}`);
ok((q.get("s") || "").includes("s3") && (q.get("s") || "").includes("s4"), `URL s expected s3+s4, got ${q.get("s")}`);
ok(q.get("gov") === "statutory", `URL gov expected statutory, got ${q.get("gov")}`);
ok(q.get("cov") === "preCovid", `URL cov expected preCovid, got ${q.get("cov")}`);
const sharedUrl = p.url();
ok(errA.length === 0, "console errors during interaction: " + JSON.stringify(errA.slice(0, 3)));

// ---- Part B: knobs sit ABOVE the chart (near the Stack selector) ----
const knobsBox = await p.locator(".workbench-knobs").boundingBox();
const figureBox = await p.locator(".workbench-stage figure").boundingBox();
ok(knobsBox && figureBox && knobsBox.y < figureBox.y,
  `knobs should be above the figure (knobs.y=${knobsBox?.y} figure.y=${figureBox?.y})`);
const toolbarBox = await p.locator(".workbench-toolbar").boundingBox();
ok(knobsBox && toolbarBox && knobsBox.y >= toolbarBox.y, "knobs should sit just below the toolbar");

// ---- Part C: opening the shared URL restores state, no hydration error ----
const p2 = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
const errB = [];
p2.on("console", (m) => m.type() === "error" && errB.push(m.text()));
p2.on("pageerror", (e) => errB.push(String(e)));
await p2.goto(sharedUrl, { waitUntil: "networkidle" });
await p2.waitForTimeout(400);
ok(await p2.getByRole("radio", { name: "Polyarchy" }).getAttribute("aria-checked") === "true",
  "shared link did not restore Polyarchy metric");
ok(await p2.getByRole("button", { name: "3 · V-Dem vs statute", exact: true }).getAttribute("aria-pressed") === "true",
  "shared link did not restore s3");
ok(await p2.getByRole("button", { name: "4 · COVID window", exact: true }).getAttribute("aria-pressed") === "true",
  "shared link did not restore s4");
const gov2 = await p2.locator("select").filter({ hasText: "V-Dem raw" }).first().inputValue();
ok(gov2 === "statutory", `shared gov not restored, got ${gov2}`);
const cov2 = await p2.locator("select").filter({ hasText: "Full window" }).first().inputValue();
ok(cov2 === "preCovid", `shared cov not restored, got ${cov2}`);
ok(/2019/.test(await p2.locator("figcaption").innerText()), "shared link caption should end 2019");
ok(errB.length === 0, "console errors on shared link (hydration?): " + JSON.stringify(errB.slice(0, 4)));

// ---- Part D: Reset clears the URL back to clean ----
await p2.getByRole("button", { name: "Reset to paper" }).click();
await p2.waitForTimeout(250);
ok(new URL(p2.url()).search === "", `reset should clear query, got "${new URL(p2.url()).search}"`);

await browser.close();
process.exit(report("SHARE") ? 0 : 1);

// Pure engine / dropdown coverage — no server or browser needed.
// Run with:  npx tsx test/engine.test.ts   (from the repo root, so the "@/"
// path alias in tsconfig resolves).
import {
  runEngine,
  eligibleDonors,
  emptyWeights,
  setDonorWeight,
  sumWeights,
  COUNTRIES,
} from "@/lib/engine";
import type {
  AccountingMode,
  CovidMode,
  GovSource,
  HorizonMode,
  MetricId,
  ScenarioId,
} from "@/lib/types";

let pass = 0;
let fail = 0;
const fails: string[] = [];
function check(cond: boolean, msg: string) {
  if (cond) pass++;
  else {
    fail++;
    fails.push(msg);
  }
}
const finite = (v: number | null | undefined) =>
  v != null && Number.isFinite(v);

const metrics: MetricId[] = ["rgdppc", "polyarchy", "relig"];
const accountings: AccountingMode[] = ["raw", "backcast", "proxy"];
const govs: GovSource[] = ["vdem", "statutory", "dif"];
const covids: CovidMode[] = ["full", "preCovid", "ife"];
const horizons: HorizonMode[] = ["gdp", "capital"];
const allScen: ScenarioId[] = ["s1", "s2", "s3", "s4", "s5"];

function base(metric: MetricId) {
  return {
    metric,
    treatmentYear: 2014,
    range: [1984, 2023] as [number, number],
    weights: emptyWeights(),
    scenarios: [] as ScenarioId[],
    maxWeight: 0.15,
    excludeNondem: false,
    accounting: "raw" as AccountingMode,
    govSource: "vdem" as GovSource,
    covidMode: "full" as CovidMode,
    lagYears: 0,
    horizon: "gdp" as HorizonMode,
  };
}

function validate(
  tag: string,
  input: ReturnType<typeof base>,
  mustScore = true,
) {
  const out = runEngine(input);
  // stats finite
  check(finite(out.postGap), `${tag}: postGap not finite (${out.postGap})`);
  check(finite(out.postGapPct), `${tag}: postGapPct not finite`);
  check(finite(out.preRmspe), `${tag}: preRmspe not finite`);
  const scored = finite(out.indiaRatio);
  if (mustScore) {
    check(scored, `${tag}: indiaRatio not finite (expected a scored window)`);
  }
  if (scored) {
    // A real placebo test: p in [0,1], placebos present and finite.
    check(
      out.pValue >= 0 && out.pValue <= 1,
      `${tag}: pValue out of [0,1] (${out.pValue})`,
    );
  } else {
    // Unscored window (no pre or no post): test undefined, must be flagged.
    check(
      Number.isNaN(out.pValue),
      `${tag}: unscored window should have NaN pValue (got ${out.pValue})`,
    );
    check(
      out.placebos.length === 0,
      `${tag}: unscored window should have no placebos`,
    );
    check(
      out.notes.some((n) => /no (pre|post)-treatment years/i.test(n)),
      `${tag}: unscored window missing explanatory note`,
    );
  }
  // weights sum ~1 when there are eligible donors
  const wsum = sumWeights(out.appliedWeights);
  check(
    out.eligible.length === 0 || Math.abs(wsum - 1) < 1e-6,
    `${tag}: weights sum ${wsum} != 1 (eligible ${out.eligible.length})`,
  );
  // no negative weights
  check(
    Object.values(out.appliedWeights).every((w) => w >= -1e-9),
    `${tag}: negative weight present`,
  );
  // chart rows: within-window rows should not be all-null for india
  const drawn = out.rows.filter((r) => r.india != null);
  check(drawn.length > 0, `${tag}: no India points drawn`);
  // no NaN leaking into rows
  const nan = out.rows.some((r) =>
    [r.india, r.baseline, r.custom, r.lower, r.spread].some(
      (v) => v != null && Number.isNaN(v),
    ),
  );
  check(!nan, `${tag}: NaN in chart rows`);
  // placebos ratios finite
  check(
    out.placebos.every((p) => finite(p.ratio) && finite(p.postGap)),
    `${tag}: placebo NaN`,
  );
  // endYear sanity
  check(
    out.endYear <= input.range[1] && out.endYear >= input.range[0],
    `${tag}: endYear ${out.endYear} outside range`,
  );
  return out;
}

// 1) Baseline for each metric
for (const m of metrics) validate(`base/${m}`, base(m));

// 2) Each scenario individually, each metric
for (const m of metrics) {
  for (const s of allScen) {
    const inp = base(m);
    inp.scenarios = [s];
    validate(`solo/${m}/${s}`, inp);
  }
}

// 3) Every dropdown value (with the owning scenario ON)
for (const m of metrics) {
  for (const a of accountings) {
    const inp = base(m);
    inp.scenarios = ["s2"];
    inp.accounting = a;
    validate(`s2/${m}/acct=${a}`, inp);
  }
  for (const g of govs) {
    const inp = base(m);
    inp.scenarios = ["s3"];
    inp.govSource = g;
    validate(`s3/${m}/gov=${g}`, inp);
  }
  for (const c of covids) {
    const inp = base(m);
    inp.scenarios = ["s4"];
    inp.covidMode = c;
    validate(`s4/${m}/covid=${c}`, inp);
  }
  for (const h of horizons) {
    const inp = base(m);
    inp.scenarios = ["s5"];
    inp.horizon = h;
    validate(`s5/${m}/horizon=${h}`, inp);
  }
  for (let lag = 0; lag <= 7; lag++) {
    const inp = base(m);
    inp.scenarios = ["s5"];
    inp.lagYears = lag;
    const o = validate(`s5/${m}/lag=${lag}`, inp);
    check(
      o.effectiveTreatment === 2014 + lag,
      `s5/${m}/lag=${lag}: effectiveTreatment ${o.effectiveTreatment} != ${2014 + lag}`,
    );
  }
}

// 4) Weight cap slider sweep + exclude one-party, all metrics
for (const m of metrics) {
  for (let capPct = 10; capPct <= 50; capPct += 5) {
    const inp = base(m);
    inp.scenarios = ["s1"];
    inp.maxWeight = capPct / 100;
    const o = validate(`s1/${m}/cap=${capPct}`, inp);
    const effCap = o.capRelaxedTo ?? inp.maxWeight;
    const maxW = Math.max(...o.eligible.map((iso) => o.appliedWeights[iso] ?? 0));
    check(
      maxW <= effCap + 1e-6,
      `s1/${m}/cap=${capPct}: a weight ${maxW} exceeds cap ${effCap}`,
    );
  }
  const ex = base(m);
  ex.scenarios = ["s1"];
  ex.excludeNondem = true;
  const oe = validate(`s1/${m}/excludeNondem`, ex);
  check(
    !oe.eligible.some((iso) => COUNTRIES[iso]?.nondem),
    `s1/${m}/excludeNondem: a one-party state remained eligible`,
  );
}

// 5) Full stack, all knobs pushed, each metric
for (const m of metrics) {
  const inp = base(m);
  inp.scenarios = [...allScen];
  inp.excludeNondem = true;
  inp.accounting = "proxy";
  inp.govSource = "dif";
  inp.covidMode = "ife";
  inp.horizon = "capital";
  inp.lagYears = 4;
  inp.maxWeight = 0.2;
  validate(`stack-all/${m}`, inp);
}

// 6) preCovid truncation actually caps endYear at 2019
{
  const inp = base("rgdppc");
  inp.scenarios = ["s4"];
  inp.covidMode = "preCovid";
  const o = runEngine(inp);
  check(o.endYear === 2019, `preCovid: endYear ${o.endYear} != 2019`);
}

// 7) Window sliders: narrow ranges. A window is only "scored" if it spans the
// treatment year (needs both pre and post observations).
for (const r of [[1995, 2005], [2000, 2023], [1984, 2010]] as [number, number][]) {
  const inp = base("rgdppc");
  inp.range = r;
  const spansTreatment = r[0] < 2014 && r[1] >= 2014;
  validate(`window/${r[0]}-${r[1]}`, inp, spansTreatment);
}

// 8) setDonorWeight keeps the vector normalized & capped
{
  const elig = eligibleDonors({ ...base("rgdppc"), scenarios: ["s1"] });
  let w = emptyWeights();
  for (const iso of ["CHN", "ETH", "PHL"]) {
    w = setDonorWeight(w, iso, 80, elig, 0.15); // push one hard against 15% cap
    const capped = elig.every((k) => (w[k] ?? 0) <= 0.15 + 1e-6);
    check(capped, `setDonorWeight: ${iso} push broke 15% cap`);
  }
  const s = sumWeights(w, elig);
  check(Math.abs(s - 1) < 1e-6, `setDonorWeight: sum ${s} != 1 after pushes`);
}

// 9) Sanity: with the paper's default GDP weights the synthetic sits above
// India, so the default gap is negative.
{
  const o = runEngine(base("rgdppc"));
  check(
    Number.isFinite(o.postGap) && o.postGap < 0,
    `paper GDP: expected negative gap (synthetic above India), got ${o.postGap}`,
  );
}

console.log(`\nENGINE PASS ${pass}  FAIL ${fail}`);
if (fail) {
  console.log("\nFailures:");
  for (const f of fails) console.log("  ✗ " + f);
  process.exit(1);
}
console.log("All engine / dropdown paths behave as expected.");

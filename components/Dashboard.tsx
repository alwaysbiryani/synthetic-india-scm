"use client";

import { useMemo, useState } from "react";
import SynthChart from "@/components/SynthChart";
import {
  COUNTRIES,
  EVENTS,
  METRIC_META,
  SLIDER_DONORS,
  YEARS,
  emptyWeights,
  eligibleDonors,
  formatPct,
  formatValue,
  runEngine,
  setDonorWeight,
  sumWeights,
} from "@/lib/engine";
import type {
  AccountingMode,
  CovidMode,
  GovSource,
  HorizonMode,
  MetricId,
  ScenarioId,
  Weights,
} from "@/lib/types";

const SCENARIOS: {
  id: ScenarioId;
  n: number;
  title: string;
  blurb: string;
  critique: string;
  does: string;
  real: string;
}[] = [
  {
    id: "s1",
    n: 1,
    title: "Weight penalization",
    blurb: "Cap outliers (Ethiopia 38%, China 28%) and optionally drop one-party states.",
    critique:
      "The income synthetic leans on Ethiopia (38%) and China (28%) — a concentrated recipe plus a one-party growth outlier.",
    does: "Clip any one donor at a chosen cap (default 15%) and/or drop China and Vietnam, redistributing their mass.",
    real: "Uses the actual PWT/V-Dem series. Only the weights change.",
  },
  {
    id: "s2",
    n: 2,
    title: "GDP accounting",
    blurb: "Haircut India’s post-2015 official series for the base-year revision critique.",
    critique:
      "India’s 2015 GDP base-year revision is accused of inflating official growth. A haircut asks whether the gap is an artifact of measurement.",
    does: "Keep raw PWT 11.0, or chain India’s post-2015 growth at 75% (back-cast) or 55% (physical-proxy analogue).",
    real: "A transparent haircut of India’s official path — not independent satellite or credit microdata.",
  },
  {
    id: "s3",
    n: 3,
    title: "Institutional scoring",
    blurb: "Swap V-Dem expert scores for a statutory or DIF-adjusted series.",
    critique:
      "V-Dem is expert-coded. Critics argue coder/media bias can pull India down after 2014 even if statutes moved less.",
    does: "Keep V-Dem raw, replace India’s post-2013 path with mild statutory drift, or blend the two (DIF-style).",
    real: "Only V-Dem is observed. Statutory and DIF series are constructed alternatives.",
  },
  {
    id: "s4",
    n: 4,
    title: "COVID isolation",
    blurb: "Truncate at 2019 or interpolate 2020–21 (interactive fixed-effects analogue).",
    critique:
      "India’s 2020 lockdown was among the strictest. Part of the late gap may be a pandemic shock, not the 2014 treatment.",
    does: "Stop scoring in 2019, or linearly interpolate 2020–21 between 2019 and 2022 for every country.",
    real: "Truncation uses the real panel. Interpolation is a common-shock strip, not a full Bai IFE estimator.",
  },
  {
    id: "s5",
    n: 5,
    title: "Policy lag / capital",
    blurb: "Delay scoring by 0–7 years or replace flow GDP with a Solow capital stock.",
    critique:
      "Infrastructure and DPI take years to show up in GDP. Scoring from 2014 may be too impatient.",
    does: "Move the treatment line 0–7 years later, and/or replace GDP with a perpetual-inventory capital stock scaled to 2013.",
    real: "Lag only changes when the gap is measured. Capital is a Solow transform of the same PWT series.",
  },
];

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function pTone(p: number): string {
  if (p <= 0.1) return "text-rose-400";
  if (p <= 0.25) return "text-amber-300";
  return "text-emerald-400";
}

export default function Dashboard() {
  const [metric, setMetric] = useState<MetricId>("rgdppc");
  const [treatmentYear, setTreatmentYear] = useState(2014);
  const [range, setRange] = useState<[number, number]>([1984, 2023]);
  const [weights, setWeights] = useState<Weights>(emptyWeights);
  const [scenarios, setScenarios] = useState<ScenarioId[]>([]);
  const [maxWeight, setMaxWeight] = useState(0.15);
  const [excludeNondem, setExcludeNondem] = useState(false);
  const [accounting, setAccounting] = useState<AccountingMode>("raw");
  const [govSource, setGovSource] = useState<GovSource>("vdem");
  const [covidMode, setCovidMode] = useState<CovidMode>("full");
  const [lagYears, setLagYears] = useState(0);
  const [horizon, setHorizon] = useState<HorizonMode>("gdp");

  const capOn = scenarios.includes("s1");
  const eligible = useMemo(
    () =>
      eligibleDonors({
        metric,
        treatmentYear,
        range,
        weights,
        scenarios,
        maxWeight,
        excludeNondem,
        accounting,
        govSource,
        covidMode,
        lagYears,
        horizon,
      }),
    [
      metric,
      scenarios,
      excludeNondem,
      treatmentYear,
      range,
      weights,
      maxWeight,
      accounting,
      govSource,
      covidMode,
      lagYears,
      horizon,
    ],
  );
  const out = useMemo(
    () =>
      runEngine({
        metric,
        treatmentYear,
        range,
        weights,
        scenarios,
        maxWeight,
        excludeNondem,
        accounting,
        govSource,
        covidMode,
        lagYears,
        horizon,
      }),
    [
      metric,
      treatmentYear,
      range,
      weights,
      scenarios,
      maxWeight,
      excludeNondem,
      accounting,
      govSource,
      covidMode,
      lagYears,
      horizon,
    ],
  );
  const meta = METRIC_META[metric];
  const displayedCap = out.capRelaxedTo ?? maxWeight;

  const onSlide = (iso: string, pct: number) => {
    setWeights(
      setDonorWeight(
        out.appliedWeights,
        iso,
        pct,
        eligible,
        capOn ? displayedCap : null,
      ),
    );
  };

  const reset = () => {
    setWeights(emptyWeights());
    setScenarios([]);
    setExcludeNondem(false);
    setMaxWeight(0.15);
    setAccounting("raw");
    setGovSource("vdem");
    setCovidMode("full");
    setLagYears(0);
    setHorizon("gdp");
    setTreatmentYear(2014);
    setRange([1984, 2023]);
    setMetric("rgdppc");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-400">
                Grier & Grier replication · stress test
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
                Synthetic India: Econometric Sensitivity & Stress-Testing Suite
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">
                Re-weight the donor pool, stack standard SCM critiques, and recompute
                India minus Synthetic India live. Paper baseline stays amber; your
                specification is emerald.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Reset to paper
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((s) => {
              const on = scenarios.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenarios(toggle(scenarios, s.id))}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/60"
                      : "bg-slate-800 text-slate-300 ring-1 ring-slate-700 hover:ring-slate-500"
                  }`}
                >
                  Scenario {s.n}: {s.title}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Metric
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as MetricId)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              >
                <option value="rgdppc">GDP per capita PPP</option>
                <option value="polyarchy">V-Dem Polyarchy</option>
                <option value="relig">Freedom of Religion</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Baseline year (treatment)
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1995}
                  max={2018}
                  value={treatmentYear}
                  onChange={(e) => setTreatmentYear(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
                <span className="w-12 text-sm text-slate-200">{treatmentYear}</span>
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Window start
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1984}
                  max={2018}
                  value={range[0]}
                  onChange={(e) =>
                    setRange([Math.min(Number(e.target.value), range[1] - 5), range[1]])
                  }
                  className="w-full accent-cyan-400"
                />
                <span className="w-12 text-sm text-slate-200">{range[0]}</span>
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Window end
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={2005}
                  max={2023}
                  value={range[1]}
                  onChange={(e) =>
                    setRange([range[0], Math.max(Number(e.target.value), range[0] + 5)])
                  }
                  className="w-full accent-cyan-400"
                />
                <span className="w-12 text-sm text-slate-200">{range[1]}</span>
              </div>
            </label>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)_320px] lg:px-6">
        <aside className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Donor pool weights</h2>
            <span className="text-[11px] tabular-nums text-slate-400">
              Σ {(sumWeights(out.appliedWeights) * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mb-3 text-[11px] leading-4 text-slate-500">
            Moving a slider renormalizes the rest so weights sum to 100%. Zeros stay
            zero until you raise them.
          </p>
          <label className="mb-3 flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={capOn}
              onChange={() => setScenarios(toggle(scenarios, "s1"))}
              className="accent-emerald-400"
            />
            Cap any single country
            <span className="text-slate-500">({(displayedCap * 100).toFixed(0)}%)</span>
          </label>
          <ul className="flex flex-col gap-3">
            {SLIDER_DONORS.map((iso) => {
              const live = out.appliedWeights[iso] ?? 0;
              const on = eligible.includes(iso);
              const name = COUNTRIES[iso]?.name ?? iso;
              const imputed = metric === "rgdppc" && COUNTRIES[iso]?.gdpImputed;
              return (
                <li key={iso} className={on ? "" : "opacity-40"}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-200">
                      {name}
                      {COUNTRIES[iso]?.nondem ? (
                        <span className="ml-1 text-[10px] uppercase text-amber-400">
                          one-party
                        </span>
                      ) : null}
                      {imputed ? (
                        <span className="ml-1 text-[10px] text-slate-500">imputed</span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1 tabular-nums text-slate-300">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        disabled={!on}
                        value={Number((live * 100).toFixed(1))}
                        onChange={(e) => onSlide(iso, Number(e.target.value))}
                        className="w-14 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-right text-xs"
                      />
                      %
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    disabled={!on}
                    value={Math.round(live * 1000)}
                    onChange={(e) => onSlide(iso, Number(e.target.value) / 10)}
                    className="w-full accent-emerald-400"
                  />
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{meta.label}</h2>
              <p className="text-[11px] text-slate-500">
                Cyan = Real India · Amber = paper synthetic · Emerald = your synthetic ·
                Shade = |India − custom| after {out.effectiveTreatment}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
              {EVENTS.map((e) => (
                <span key={e.year}>
                  <span className="text-slate-300">{e.year}</span> {e.label}
                </span>
              ))}
            </div>
          </div>
          <SynthChart
            rows={out.rows}
            metric={metric}
            treatmentYear={treatmentYear}
            effectiveTreatment={out.effectiveTreatment}
          />
        </section>

        <aside className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-100">
            Scenario engine
          </h2>
          <p className="mb-3 text-[11px] leading-4 text-slate-500">
            Stack critiques from the pill bar. Pipeline: filter pool → cap weights →
            accounting → truncate / IFE → lag & capital.
          </p>
          {scenarios.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-800 p-3 text-xs text-slate-500">
              No critiques active. Custom synthetic equals a re-weighted version of
              the paper donor recipe. Turn on Scenario 1 to break the 38/28/25
              concentration.
            </p>
          ) : null}
          <div className="flex flex-col gap-3">
            {SCENARIOS.filter((s) => scenarios.includes(s.id)).map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-xs font-semibold text-emerald-300">
                  S{s.n} · {s.title}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">{s.blurb}</p>
                {s.id === "s1" ? (
                  <div className="mt-3 space-y-2">
                    <label className="block text-[11px] text-slate-400">
                      Max allowed donor weight ({(maxWeight * 100).toFixed(0)}%)
                      <input
                        type="range"
                        min={10}
                        max={50}
                        value={Math.round(maxWeight * 100)}
                        onChange={(e) => setMaxWeight(Number(e.target.value) / 100)}
                        className="mt-1 w-full accent-emerald-400"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={excludeNondem}
                        onChange={(e) => setExcludeNondem(e.target.checked)}
                        className="accent-emerald-400"
                      />
                      Exclude one-party / non-democratic states (China, Vietnam)
                    </label>
                  </div>
                ) : null}
                {s.id === "s2" ? (
                  <label className="mt-3 block text-[11px] text-slate-400">
                    Accounting adjustment
                    <select
                      value={accounting}
                      onChange={(e) => setAccounting(e.target.value as AccountingMode)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-100"
                    >
                      <option value="raw">Raw Penn World Table 11.0</option>
                      <option value="backcast">
                        Back-cast post-2015 methodology to 1984
                      </option>
                      <option value="proxy">
                        Physical proxy (night-lights / power / credit analogue)
                      </option>
                    </select>
                  </label>
                ) : null}
                {s.id === "s3" ? (
                  <label className="mt-3 block text-[11px] text-slate-400">
                    Governance source
                    <select
                      value={govSource}
                      onChange={(e) => setGovSource(e.target.value as GovSource)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-100"
                    >
                      <option value="vdem">V-Dem expert raw index</option>
                      <option value="statutory">
                        Objective statutory metric (bills / decrees analogue)
                      </option>
                      <option value="dif">Bias-adjusted DIF score</option>
                    </select>
                    {metric === "rgdppc" ? (
                      <span className="mt-1 block text-[11px] text-amber-400">
                        Switch the metric selector to Polyarchy or Religion to apply this.
                      </span>
                    ) : null}
                  </label>
                ) : null}
                {s.id === "s4" ? (
                  <label className="mt-3 block text-[11px] text-slate-400">
                    Timeline truncation
                    <select
                      value={covidMode}
                      onChange={(e) => setCovidMode(e.target.value as CovidMode)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-100"
                    >
                      <option value="full">Full sample (through window end)</option>
                      <option value="preCovid">Pre-COVID only (1984–2019)</option>
                      <option value="ife">
                        Augmented SCM / IFE (2020–21 interpolated)
                      </option>
                    </select>
                  </label>
                ) : null}
                {s.id === "s5" ? (
                  <div className="mt-3 space-y-2">
                    <label className="block text-[11px] text-slate-400">
                      Time-lag offset ({lagYears} year{lagYears === 1 ? "" : "s"})
                      <input
                        type="range"
                        min={0}
                        max={7}
                        value={lagYears}
                        onChange={(e) => setLagYears(Number(e.target.value))}
                        className="mt-1 w-full accent-emerald-400"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={horizon === "capital"}
                        onChange={(e) =>
                          setHorizon(e.target.checked ? "capital" : "gdp")
                        }
                        className="accent-emerald-400"
                      />
                      Solow–Swan capital stock instead of short-term GDP
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </aside>
      </main>

      <section className="mx-auto max-w-[1600px] px-4 pb-8 lg:px-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-100">
            Shortfall, fit, and placebo permutation
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              label="Final-year gap (India − custom)"
              value={formatValue(metric, out.postGap)}
              hint={
                metric === "rgdppc"
                  ? "Negative = India poorer than the counterfactual"
                  : "Negative = India below the counterfactual"
              }
              danger={out.postGap < 0}
            />
            <MetricCard
              label="Gap vs custom level"
              value={formatPct(out.postGapPct)}
              hint={`Custom ${formatValue(metric, out.customLast)} · India ${formatValue(metric, out.indiaLast)}`}
              danger={out.postGapPct < 0}
            />
            <MetricCard
              label="Paper baseline gap"
              value={formatValue(metric, out.indiaLast - out.baselineLast)}
              hint="Same India series vs paper donor recipe (raw data)"
            />
            <MetricCard
              label="Pre-treatment RMSPE"
              value={
                metric === "rgdppc"
                  ? formatValue(metric, out.preRmspe)
                  : out.preRmspe.toFixed(3)
              }
              hint="Average miss of custom synthetic before treatment"
            />
            <MetricCard
              label="Placebo p-value"
              value={out.pValue.toFixed(2)}
              hint={`Leave-one-out RMSPE ratios · ${out.placebos.length} donors · p = (1+#extreme)/(1+J)`}
              className={pTone(out.pValue)}
            />
          </div>

          {out.notes.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-slate-500">
              {out.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 font-medium">Placebo unit</th>
                  <th className="py-2 font-medium">Post/pre RMSPE ratio</th>
                  <th className="py-2 font-medium">Mean post gap</th>
                </tr>
              </thead>
              <tbody>
                {out.placebos.map((p) => (
                  <tr key={p.iso} className="border-t border-slate-800">
                    <td className="py-1.5 text-slate-200">{p.name}</td>
                    <td className="py-1.5 tabular-nums text-slate-300">
                      {p.ratio.toFixed(2)}
                    </td>
                    <td className="py-1.5 tabular-nums text-slate-300">
                      {formatValue(metric, p.postGap)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-4 text-slate-500">
            Source: {YEARS[0]}–{YEARS[YEARS.length - 1]} analysis panels in this
            replication package (PWT 11.0 + V-Dem). Accounting, statutory, DIF, IFE,
            and Solow paths are transparent transforms of those series — not new
            microdata — so you can see whether a standard critique can overturn the
            paper’s sign. Nested Stata `synth` re-estimation is not re-run here;
            the paper baseline uses the published donor recipe.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 pb-10 lg:px-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-100">
            What this suite is doing
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Synthetic control builds a counterfactual India as a weighted average of
            comparison countries that tracked India before {treatmentYear}. Amber is
            the paper’s published recipe. Emerald is your specification. Stack the
            pills above; they apply in a fixed order: filter the pool, cap weights,
            adjust India’s accounting or governance series, truncate or strip COVID,
            then lag or switch to capital.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {SCENARIOS.map((s) => {
              const on = scenarios.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenarios(toggle(scenarios, s.id))}
                  className={`rounded-xl border p-3 text-left transition ${
                    on
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                  }`}
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Scenario {s.n}
                    {on ? <span className="ml-2 text-emerald-400">active</span> : null}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{s.title}</p>
                  <p className="mt-2 text-[12px] leading-5 text-slate-400">{s.critique}</p>
                  <p className="mt-2 text-[12px] leading-5 text-slate-300">{s.does}</p>
                  <p className="mt-2 text-[11px] leading-4 text-slate-500">{s.real}</p>
                </button>
              );
            })}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                How to read the p-value
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                Placebo permutation
              </p>
              <p className="mt-2 text-[12px] leading-5 text-slate-400">
                Each donor is treated as if it were India, using your current weights
                with that country left out. The p-value is the share of those placebos
                whose post/pre RMSPE ratio is at least as large as India’s. Small p
                means India’s post-{out.effectiveTreatment} miss is unusual in this
                pool — under the constraints you turned on, not in the abstract.
              </p>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                Grier & Grier (2026). Data: PWT 11.0 and V-Dem. This page does not
                re-run nested Stata synth.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-[11px] text-slate-500">{props.label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          props.className ?? (props.danger ? "text-rose-400" : "text-slate-50")
        }`}
      >
        {props.value}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{props.hint}</p>
    </div>
  );
}

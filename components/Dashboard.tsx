"use client";

import { useEffect, useState } from "react";
import SynthChart from "@/components/SynthChart";
import { decodeState, encodeState } from "@/lib/urlState";
import {
  COUNTRIES,
  EVENTS,
  METRIC_META,
  SLIDER_DONORS,
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
  criticism: string;
  data: string;
  does: string;
}[] = [
  {
    id: "s1",
    n: 1,
    title: "Weight cap",
    blurb: "Cap outliers; optionally drop one-party states.",
    criticism:
      "The income synthetic leans on Ethiopia (38%) and China (28%) — a concentrated recipe, plus a one-party growth outlier that may not be a fair no-Modi India.",
    data: "Published donor weights on the PWT 11.0 / V-Dem pool. Moving a slider only re-weights those series; it does not re-run nested Stata synth.",
    does: "Clip any one country at a chosen cap (default 15%) and/or drop China and Vietnam, redistributing their mass across the rest of the pool.",
  },
  {
    id: "s2",
    n: 2,
    title: "GDP accounting",
    blurb: "Haircut India’s post-2015 official series.",
    criticism:
      "India’s 2015 GDP base-year revision is accused of inflating official growth, so a post-2014 income gap might be measurement, not treatment.",
    data: "Raw Penn World Table 11.0 real GDP per capita. This page has no independent satellite, night-lights, or credit microdata.",
    does: "Keep raw PWT, or chain India’s post-2015 growth at 75% (back-cast) or 55% (physical-proxy analogue). A transparent haircut of the official path.",
  },
  {
    id: "s3",
    n: 3,
    title: "V-Dem vs statute",
    blurb: "Swap expert scores for a statutory or DIF series.",
    criticism:
      "V-Dem is expert-coded. Critics argue coder or media bias can pull India down after 2014 even if statutes and decrees moved less.",
    data: "Only V-Dem polyarchy and freedom of religion are observed in the replication panels. Statutory and DIF paths are not in the .dta files.",
    does: "Keep V-Dem raw, replace India’s post-2013 path with mild statutory drift, or blend the two (DIF-style). Switch Outcome off GDP for this to bite.",
  },
  {
    id: "s4",
    n: 4,
    title: "COVID window",
    blurb: "Stop in 2019, or interpolate 2020–21.",
    criticism:
      "India’s 2020 lockdown was among the strictest. Part of the late gap may be a pandemic shock rather than the 2014 treatment.",
    data: "The full 1984–2023 panel for every country in the pool. Truncation uses those real years; interpolation does not add new observations.",
    does: "Stop scoring in 2019, or linearly interpolate 2020–21 between 2019 and 2022 for every country. A common-shock strip, not a full Bai IFE estimator.",
  },
  {
    id: "s5",
    n: 5,
    title: "Lag / capital",
    blurb: "Delay scoring, or use a Solow stock.",
    criticism:
      "Infrastructure and digital public goods take years to show up in GDP. Scoring from 2014 may be too impatient for the policy to have worked.",
    data: "The same PWT GDP series. Capital is a perpetual-inventory transform scaled to 2013, not a separate investment dataset.",
    does: "Move the treatment line 0–7 years later, and/or replace flow GDP with that Solow stock. Lag only changes when the gap is measured.",
  },
];

const METRICS: { id: MetricId; label: string }[] = [
  { id: "rgdppc", label: "GDP per capita" },
  { id: "polyarchy", label: "Polyarchy" },
  { id: "relig", label: "Freedom of religion" },
];

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function recipeLine(weights: Weights): string {
  return Object.entries(weights)
    .filter(([, w]) => w >= 0.01)
    .sort((a, b) => b[1] - a[1])
    .map(([iso, w]) => `${Math.round(w * 100)}% ${COUNTRIES[iso]?.name ?? iso}`)
    .join(" · ");
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
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // Hydrate from the URL once, after mount. The static markup is rendered with
  // default state, so applying the URL here (rather than in a lazy initialiser)
  // keeps server and client markup identical and avoids a hydration mismatch.
  // This is the "sync with an external system" case, so the set-state-in-effect
  // rule is intentionally relaxed for this block only.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const s = decodeState(window.location.search);
    if (s.metric) setMetric(s.metric);
    if (s.treatmentYear != null) setTreatmentYear(s.treatmentYear);
    if (s.range) setRange(s.range);
    if (s.weights) setWeights(s.weights);
    if (s.scenarios) setScenarios(s.scenarios);
    if (s.maxWeight != null) setMaxWeight(s.maxWeight);
    if (s.excludeNondem != null) setExcludeNondem(s.excludeNondem);
    if (s.accounting) setAccounting(s.accounting);
    if (s.govSource) setGovSource(s.govSource);
    if (s.covidMode) setCovidMode(s.covidMode);
    if (s.lagYears != null) setLagYears(s.lagYears);
    if (s.horizon) setHorizon(s.horizon);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Mirror state into the URL (replace, not push, so we don't spam history).
  useEffect(() => {
    if (!ready) return;
    const qs = encodeState({
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
    });
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [
    ready,
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
  ]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const capOn = scenarios.includes("s1");
  const eligible = eligibleDonors({
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
  });
  const out = runEngine({
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
  });
  const meta = METRIC_META[metric];
  const displayedCap = out.capRelaxedTo ?? maxWeight;
  const recipe = recipeLine(out.appliedWeights);

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
    <div className="min-h-screen bg-paper text-ink">
      <a href="#workspace" className="skip-link">
        Skip to the chart
      </a>

      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-2 px-4 py-2.5 font-mono text-[0.72rem] tracking-wide text-faint sm:px-6">
          <span>Unofficial playground · not affiliated with the authors</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Source links">
            <a href="https://rgrier88.github.io/modi-promises/">Authors’ companion</a>
            <a href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7248338">
              Paper (SSRN)
            </a>
            <a href="https://github.com/alwaysbiryani/synthetic-india-scm">This site’s code</a>
          </nav>
        </div>
      </header>

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 sm:py-10">
          <p className="eyebrow">Unofficial playground</p>
          <h1 className="max-w-4xl font-serif text-[clamp(2.4rem,6vw,4.4rem)] font-medium italic leading-[0.98] tracking-[-0.01em]">
            Kick the tires
          </h1>
          <p className="mt-4 max-w-xl text-[1.12rem] leading-7">
            Stack the usual objections to Grier &amp; Grier (2026) and watch India vs
            Synthetic India move. Not their analysis or site.
          </p>
          <p className="mt-2 font-mono text-[0.8rem] text-faint">
            Black = real India · dashed = paper synthetic · red = stacked scenario
          </p>
          <div className="btns mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn-ghost btn" onClick={reset}>
              Reset to paper
            </button>
            <button type="button" className="btn-ghost btn" onClick={copyLink}>
              {copied ? "Link copied ✓" : "Copy link to this view"}
            </button>
            <a className="btn-ghost btn" href="#workspace">
              Skip to the chart
            </a>
          </div>
        </div>
      </section>

      <section id="how" className="how-panel">
        <div className="mx-auto max-w-[1120px] px-4 py-7 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <p className="eyebrow">How to read this</p>
              <h2 className="max-w-3xl font-serif text-[clamp(1.5rem,3vw,2.1rem)] font-medium leading-tight">
                Five objections. Stack them.
              </h2>
            </div>
            <a className="more-link" href="#notes">
              Full notes ↓
            </a>
          </div>
          <div className="scenario-grid">
            {SCENARIOS.map((s) => {
              const on = scenarios.includes(s.id);
              return (
                <div
                  key={s.id}
                  className={`scenario-card${on ? " is-on" : ""}`}
                >
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setScenarios(toggle(scenarios, s.id))}
                  >
                    <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ledger">
                      0{s.n} · {s.title}
                    </p>
                    <p className="mt-1.5 text-[0.95rem] leading-snug">{s.blurb}</p>
                  </button>
                  <a className="more-link" href={`#note-${s.id}`}>
                    Why this ↓
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div id="workspace" className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
        <section className="workbench" aria-label="Outcome workbench">
          <div className="workbench-toolbar">
            <fieldset>
              <legend className="mb-1.5 font-mono text-[0.68rem] font-medium uppercase tracking-[0.12em] text-faint">
                Outcome
              </legend>
              <div className="flex flex-wrap" role="radiogroup" aria-label="Outcome metric">
                {METRICS.map((m, i) => {
                  const on = metric === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setMetric(m.id)}
                      className={`border border-ink px-3 py-1.5 font-mono text-[0.75rem] ${
                        i > 0 ? "-ml-px" : ""
                      } ${on ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-wash"}`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 font-mono text-[0.68rem] font-medium uppercase tracking-[0.12em] text-faint">
                Stack
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {SCENARIOS.map((s) => {
                  const on = scenarios.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setScenarios(toggle(scenarios, s.id))}
                      className={`border px-2.5 py-1.5 font-mono text-[0.72rem] ${
                        on
                          ? "border-ledger bg-ledger-soft text-ledger"
                          : "border-ink bg-paper text-ink hover:bg-wash"
                      }`}
                    >
                      {s.n} · {s.title}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {scenarios.length > 0 ? (
            <div className="workbench-knobs" aria-labelledby="engine-h">
              <p id="engine-h" className="eyebrow !mb-0">
                Scenario knobs
              </p>
              <div className="workbench-knobs-grid">
                {SCENARIOS.filter((s) => scenarios.includes(s.id)).map((s) => (
                  <div key={s.id} className="knob-card">
                    <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ledger">
                      {s.n} · {s.title}
                    </p>
                    {s.id === "s1" ? (
                      <div className="mt-2 space-y-2">
                        <label className="block font-mono text-[0.75rem]">
                          Max donor weight ({(maxWeight * 100).toFixed(0)}%)
                          <input
                            type="range"
                            min={10}
                            max={50}
                            className="mt-1"
                            value={Math.round(maxWeight * 100)}
                            onChange={(e) => setMaxWeight(Number(e.target.value) / 100)}
                          />
                        </label>
                        <label className="flex items-center gap-2 font-mono text-[0.75rem]">
                          <input
                            type="checkbox"
                            checked={excludeNondem}
                            onChange={(e) => setExcludeNondem(e.target.checked)}
                          />
                          Exclude one-party states
                        </label>
                      </div>
                    ) : null}
                    {s.id === "s2" ? (
                      <label className="mt-2 block font-mono text-[0.75rem]">
                        Accounting
                        <select
                          className="mt-1 w-full"
                          value={accounting}
                          onChange={(e) =>
                            setAccounting(e.target.value as AccountingMode)
                          }
                        >
                          <option value="raw">Raw PWT 11.0</option>
                          <option value="backcast">75% back-cast after 2015</option>
                          <option value="proxy">55% physical-proxy analogue</option>
                        </select>
                      </label>
                    ) : null}
                    {s.id === "s3" ? (
                      <label className="mt-2 block font-mono text-[0.75rem]">
                        Governance source
                        <select
                          className="mt-1 w-full"
                          value={govSource}
                          onChange={(e) => setGovSource(e.target.value as GovSource)}
                        >
                          <option value="vdem">V-Dem raw</option>
                          <option value="statutory">Statutory analogue</option>
                          <option value="dif">DIF blend</option>
                        </select>
                        {metric === "rgdppc" ? (
                          <span className="mt-1 block text-ledger">
                            Use Polyarchy or Religion for this knob.
                          </span>
                        ) : null}
                      </label>
                    ) : null}
                    {s.id === "s4" ? (
                      <label className="mt-2 block font-mono text-[0.75rem]">
                        Sample
                        <select
                          className="mt-1 w-full"
                          value={covidMode}
                          onChange={(e) => setCovidMode(e.target.value as CovidMode)}
                        >
                          <option value="full">Full window</option>
                          <option value="preCovid">Through 2019</option>
                          <option value="ife">Interpolate 2020–21</option>
                        </select>
                      </label>
                    ) : null}
                    {s.id === "s5" ? (
                      <div className="mt-2 space-y-2">
                        <label className="block font-mono text-[0.75rem]">
                          Policy lag ({lagYears} year{lagYears === 1 ? "" : "s"})
                          <input
                            type="range"
                            min={0}
                            max={7}
                            className="mt-1"
                            value={lagYears}
                            onChange={(e) => setLagYears(Number(e.target.value))}
                          />
                        </label>
                        <label className="flex items-center gap-2 font-mono text-[0.75rem]">
                          <input
                            type="checkbox"
                            checked={horizon === "capital"}
                            onChange={(e) =>
                              setHorizon(e.target.checked ? "capital" : "gdp")
                            }
                          />
                          Solow capital instead of GDP
                        </label>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="workbench-stage">
        <figure>
          <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-4 py-2.5">
            <span>
              <span className="eyebrow !mb-0 inline">Figure</span>
              <span className="ml-2 font-serif text-lg">{meta.short}</span>
            </span>
            <span className="font-mono text-[0.72rem] text-faint">
              {range[0]}–{out.endYear} · treatment {out.effectiveTreatment}
            </span>
          </figcaption>
          <div className="px-2 pb-2 pt-1 sm:px-4">
            <SynthChart
              rows={out.rows}
              metric={metric}
              treatmentYear={treatmentYear}
              effectiveTreatment={out.effectiveTreatment}
            />
          </div>
          <p className="border-t border-rule px-4 py-2 font-mono text-[0.72rem] leading-5 text-faint">
            {recipe || "No eligible donors for this metric."}
          </p>
          <ul className="event-key" aria-label="Event marks on the figure">
            {EVENTS.map((e) => (
              <li
                key={e.year}
                className={e.year === treatmentYear ? "is-treatment" : undefined}
              >
                <b>{e.year}</b>
                {e.label}
              </li>
            ))}
          </ul>
        </figure>

        <section className="donor-panel" aria-labelledby="donors-h">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 id="donors-h" className="font-serif text-xl font-medium">
                Weights
              </h2>
              <span className="font-mono text-[0.72rem] text-faint">
                Σ {(sumWeights(out.appliedWeights) * 100).toFixed(0)}%
              </span>
            </div>
            <label className="mb-2 flex items-center gap-2 font-mono text-[0.75rem]">
              <input
                type="checkbox"
                checked={capOn}
                onChange={() => setScenarios(toggle(scenarios, "s1"))}
              />
              Cap any single country at {(displayedCap * 100).toFixed(0)}%
            </label>
            <ul className="mt-3 flex flex-col gap-2">
              {SLIDER_DONORS.map((iso) => {
                const live = out.appliedWeights[iso] ?? 0;
                const on = eligible.includes(iso);
                const name = COUNTRIES[iso]?.name ?? iso;
                const pct = live * 100;
                return (
                  <li key={iso} className={on ? "" : "opacity-40"}>
                    <div className="mb-0.5 flex items-baseline justify-between gap-2 font-mono text-[0.75rem]">
                      <label htmlFor={`w-${iso}`}>
                        {name}
                        {COUNTRIES[iso]?.nondem ? (
                          <span className="ml-1.5 text-[0.62rem] uppercase tracking-wide text-ledger">
                            one-party
                          </span>
                        ) : null}
                        {metric === "rgdppc" && COUNTRIES[iso]?.gdpImputed ? (
                          <span className="ml-1.5 text-[0.62rem] text-faint">imputed</span>
                        ) : null}
                      </label>
                      <span className="flex items-center gap-1">
                        <input
                          id={`w-${iso}-num`}
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          disabled={!on}
                          aria-label={`${name} weight percent`}
                          value={Number(pct.toFixed(1))}
                          onChange={(e) => onSlide(iso, Number(e.target.value))}
                          className="w-14 text-right"
                        />
                        %
                      </span>
                    </div>
                    <input
                      id={`w-${iso}`}
                      type="range"
                      min={0}
                      max={1000}
                      disabled={!on}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Number(pct.toFixed(1))}
                      aria-label={`${name} weight`}
                      value={Math.round(live * 1000)}
                      onChange={(e) => onSlide(iso, Number(e.target.value) / 10)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

          <div className="workbench-ledger" aria-label="Shortfall and fit">
            <StatCell
              label="Gap"
              value={formatValue(metric, out.postGap)}
              hint={String(out.endYear)}
              explain={`Real India minus your stacked Synthetic India in ${out.endYear}. Positive = India above its counterfactual.`}
              alert
            />
            <StatCell
              label="% of stacked"
              value={formatPct(out.postGapPct)}
              hint={`${formatValue(metric, out.indiaLast)} vs ${formatValue(metric, out.customLast)}`}
              explain="The gap expressed as a share of the stacked synthetic value — how big the effect is in relative terms."
              alert
            />
            <StatCell
              label="Paper gap"
              value={formatValue(metric, out.indiaLast - out.baselineLast)}
              hint="Published weights"
              explain="The same end-year gap using the paper's original published donor recipe, for comparison with your stacked scenario."
            />
            <StatCell
              label="Placebo p"
              value={Number.isFinite(out.pValue) ? out.pValue.toFixed(2) : "—"}
              hint={
                Number.isFinite(out.pValue)
                  ? `${out.placebos.length} donors`
                  : "needs pre + post years"
              }
              explain="Share of donor countries whose own post/pre fit ratio is at least as extreme as India's. Lower means India's gap stands out from placebo noise (≤ 0.10 highlighted)."
              alert={out.pValue <= 0.1}
            />
          </div>

          <div className="workbench-more">
            <details>
              <summary>Window</summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <label className="font-mono text-[0.75rem] text-faint">
                  Treatment year
                  <div className="mt-1 flex items-center gap-2 text-ink">
                    <input
                      type="range"
                      min={1995}
                      max={2018}
                      value={treatmentYear}
                      onChange={(e) => setTreatmentYear(Number(e.target.value))}
                    />
                    <span className="w-10">{treatmentYear}</span>
                  </div>
                </label>
                <label className="font-mono text-[0.75rem] text-faint">
                  Window start
                  <div className="mt-1 flex items-center gap-2 text-ink">
                    <input
                      type="range"
                      min={1984}
                      max={2018}
                      value={range[0]}
                      onChange={(e) =>
                        setRange([
                          Math.min(Number(e.target.value), range[1] - 5),
                          range[1],
                        ])
                      }
                    />
                    <span className="w-10">{range[0]}</span>
                  </div>
                </label>
                <label className="font-mono text-[0.75rem] text-faint">
                  Window end
                  <div className="mt-1 flex items-center gap-2 text-ink">
                    <input
                      type="range"
                      min={2005}
                      max={2023}
                      value={range[1]}
                      onChange={(e) =>
                        setRange([
                          range[0],
                          Math.max(Number(e.target.value), range[0] + 5),
                        ])
                      }
                    />
                    <span className="w-10">{range[1]}</span>
                  </div>
                </label>
              </div>
            </details>
            <details>
              <summary>Placebos</summary>
              <p className="mt-3 font-mono text-[0.72rem] leading-5 text-faint">
                {Number.isFinite(out.indiaRatio) ? (
                  <>
                    India&apos;s own post/pre RMSPE ratio is{" "}
                    <b className="text-ink">{out.indiaRatio.toFixed(2)}</b>. Each donor
                    is re-fit the same way; rows in red match or beat India, and the
                    placebo <i>p</i> = {out.pValue.toFixed(2)} is their share.
                  </>
                ) : (
                  "The placebo test needs both a pre- and a post-treatment period in the window. Widen the window so it spans the treatment year."
                )}
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="ledger-table min-w-[480px]">
                  <thead>
                    <tr>
                      <th>Placebo unit</th>
                      <th className="text-right">Post/pre RMSPE</th>
                      <th className="text-right">Mean post gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {out.placebos.map((p) => {
                      const extreme = p.ratio >= out.indiaRatio;
                      return (
                        <tr key={p.iso} className={extreme ? "text-ledger" : undefined}>
                          <td>{p.name}</td>
                          <td className="num">{p.ratio.toFixed(2)}</td>
                          <td className="num">{formatValue(metric, p.postGap)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
            {out.notes.length > 0 ? (
              <ul className="list-disc space-y-1 px-4 py-3 pl-8 font-mono text-[0.72rem] text-faint">
                {out.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
            <p className="px-4 py-3">
              <a className="more-link" href="#notes">
                Critique notes ↓
              </a>
            </p>
          </div>
        </section>
      </div>

      <section id="notes" className="notes-panel">
        <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6">
          <p className="eyebrow">The critiques in full</p>
          <h2 className="max-w-3xl font-serif text-[clamp(1.6rem,3vw,2.3rem)] font-medium leading-tight">
            Criticism, data, and what the knob does
          </h2>
          <p className="mt-3 max-w-2xl text-[1.05rem] leading-7 text-faint">
            Unofficial notes, not the authors’. Haircuts, DIF scores, interpolation,
            and Solow capital are transforms of the public panels — not new
            microdata, and not a claim that Grier &amp; Grier ran these specs.
          </p>
          {SCENARIOS.map((s) => (
            <article key={s.id} id={`note-${s.id}`} className="notes-article">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ledger">
                  0{s.n} · {s.title}
                </p>
                <button
                  type="button"
                  className="more-link"
                  aria-pressed={scenarios.includes(s.id)}
                  onClick={() => setScenarios(toggle(scenarios, s.id))}
                >
                  {scenarios.includes(s.id) ? "Stacked — click to drop" : "Stack this ↑"}
                </button>
              </div>
              <h3 className="mt-2 font-serif text-xl font-medium leading-snug">
                {s.blurb}
              </h3>
              <div className="notes-cols">
                <div>
                  <p className="notes-kicker">Criticism</p>
                  <p>{s.criticism}</p>
                </div>
                <div>
                  <p className="notes-kicker">What data</p>
                  <p>{s.data}</p>
                </div>
                <div>
                  <p className="notes-kicker">What this page does</p>
                  <p>{s.does}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-rule">
        <div className="mx-auto max-w-[1120px] px-4 py-6 font-mono text-[0.72rem] leading-5 text-faint sm:px-6">
          Unofficial · not Grier &amp; Grier. PWT 11.0 and V-Dem from their public
          files. Dashed line = published recipe, not a re-run of Stata{" "}
          <span className="text-ink">synth</span>.{" "}
          <a href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7248338">Paper</a>
          {" · "}
          <a href="https://rgrier88.github.io/modi-promises/">Authors’ companion</a>.
        </div>
      </footer>
    </div>
  );
}

function StatCell(props: {
  label: string;
  value: string;
  hint: string;
  explain?: string;
  alert?: boolean;
}) {
  return (
    <div className="bg-paper px-3 py-3 sm:px-4" title={props.explain}>
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-faint">
        {props.label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
          props.alert ? "text-ledger" : "text-ink"
        }`}
      >
        {props.value}
      </p>
      <p className="mt-1 font-mono text-[0.7rem] text-faint">{props.hint}</p>
    </div>
  );
}

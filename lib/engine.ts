import panel from "@/data/panel.json";
import type {
  ChartRow,
  CountrySeries,
  EngineInput,
  EngineOutput,
  MetricId,
  PlaceboRow,
  Weights,
} from "./types";

export const YEARS: number[] = panel.years;

function asSeries(v: Array<number | null> | null | undefined): Array<number | null> {
  if (Array.isArray(v)) return v;
  return YEARS.map(() => null);
}

function normalizeCountry(raw: (typeof panel.countries)[keyof typeof panel.countries]): CountrySeries {
  return {
    iso: raw.iso,
    name: raw.name,
    nondem: raw.nondem,
    rgdppc: asSeries(raw.rgdppc),
    polyarchy: asSeries(raw.polyarchy),
    relig: asSeries(raw.relig),
    gdpImputed: "gdpImputed" in raw ? Boolean(raw.gdpImputed) : undefined,
  };
}

export const COUNTRIES: Record<string, CountrySeries> = Object.fromEntries(
  Object.entries(panel.countries).map(([k, v]) => [k, normalizeCountry(v)]),
);

export const SLIDER_DONORS = [
  "CHN",
  "ETH",
  "BGD",
  "PAK",
  "PHL",
  "IDN",
  "MYS",
  "LKA",
  "BRA",
  "ZAF",
] as const;

export const PAPER_INCOME_WEIGHTS: Weights = {
  ETH: 0.38,
  CHN: 0.28,
  BGD: 0.25,
  PAK: 0.07,
  PHL: 0.02,
};

/** Paper polyarchy recipe (renormalized; remaining 11% was unpublished). */
export const PAPER_GOV_WEIGHTS: Weights = {
  ARG: 0.611 / 0.89,
  LKA: 0.145 / 0.89,
  BRA: 0.134 / 0.89,
};

export const EVENTS = [
  { year: 2014, label: "Modi elected", short: "Modi elected" },
  { year: 2015, label: "GDP base-year revision", short: "GDP revision" },
  { year: 2016, label: "Demonetization", short: "Demonetization" },
  { year: 2020, label: "COVID-19", short: "COVID-19" },
] as const;

export const METRIC_META: Record<
  MetricId,
  { label: string; short: string; unit: string; higherWorse: boolean }
> = {
  rgdppc: {
    label: "GDP per capita (PPP, 2017 USD)",
    short: "GDP per capita PPP",
    unit: "USD",
    higherWorse: false,
  },
  polyarchy: {
    label: "V-Dem Polyarchy (electoral democracy)",
    short: "V-Dem Polyarchy",
    unit: "index",
    higherWorse: false,
  },
  relig: {
    label: "Freedom of religion (V-Dem)",
    short: "Freedom of Religion",
    unit: "index",
    higherWorse: false,
  },
};

export function emptyWeights(): Weights {
  const w: Weights = {};
  for (const iso of SLIDER_DONORS) w[iso] = PAPER_INCOME_WEIGHTS[iso] ?? 0;
  return w;
}

export function sumWeights(w: Weights, keys?: string[]): number {
  const ks = keys ?? Object.keys(w);
  return ks.reduce((s, k) => s + (w[k] ?? 0), 0);
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

export function seriesFor(iso: string, metric: MetricId): Array<number | null> {
  const c = COUNTRIES[iso];
  if (!c) return YEARS.map(() => null);
  if (metric === "rgdppc") return c.rgdppc;
  if (metric === "polyarchy") return c.polyarchy;
  return c.relig;
}

export function hasSeries(iso: string, metric: MetricId): boolean {
  return seriesFor(iso, metric).some((v) => v != null);
}

function idx(year: number) {
  return YEARS.indexOf(year);
}

function haircutFrom(
  values: Array<number | null>,
  fromYear: number,
  factor: number,
): Array<number | null> {
  const out = values.slice();
  for (let i = 1; i < YEARS.length; i++) {
    if (YEARS[i] < fromYear) continue;
    const prev = out[i - 1];
    const a = values[i - 1];
    const b = values[i];
    if (prev == null || a == null || b == null || a === 0) {
      out[i] = values[i];
      continue;
    }
    const g = b / a - 1;
    out[i] = prev * (1 + factor * g);
  }
  return out;
}

function interpolateCovid(values: Array<number | null>): Array<number | null> {
  const i19 = idx(2019);
  const i20 = idx(2020);
  const i21 = idx(2021);
  const i22 = idx(2022);
  if (i19 < 0 || i22 < 0) return values;
  const a = values[i19];
  const b = values[i22];
  if (a == null || b == null) return values;
  const out = values.slice();
  if (i20 >= 0) out[i20] = a + (b - a) * (1 / 3);
  if (i21 >= 0) out[i21] = a + (b - a) * (2 / 3);
  return out;
}

function capitalStock(values: Array<number | null>): Array<number | null> {
  const i13 = idx(2013);
  const y0 = values.find((v) => v != null);
  if (y0 == null) return values;
  const k: number[] = [];
  let last = y0 / 0.28;
  const delta = 0.06;
  const s = 0.3;
  for (let i = 0; i < values.length; i++) {
    const y = values[i];
    if (i === 0) {
      k.push(last);
      continue;
    }
    const invest = (values[i - 1] ?? y0) * s;
    last = (1 - delta) * last + invest;
    k.push(last);
    if (y == null) k[i] = last;
  }
  const scale =
    values[i13] != null && k[i13] !== 0 ? (values[i13] as number) / k[i13] : 1;
  return k.map((v, i) => (values[i] == null ? null : v * scale));
}

function statutoryIndia(
  values: Array<number | null>,
  metric: MetricId,
): Array<number | null> {
  const i13 = idx(2013);
  const base = values[i13];
  if (base == null) return values;
  return YEARS.map((y, i) => {
    const raw = values[i];
    if (raw == null) return null;
    if (y <= 2013) return raw;
    const drift = metric === "relig" ? 0.01 : 0.005;
    return base + drift * (y - 2013);
  });
}

function blend(
  a: Array<number | null>,
  b: Array<number | null>,
  w: number,
): Array<number | null> {
  return a.map((v, i) => {
    const u = b[i];
    if (v == null || u == null) return v ?? u;
    return w * v + (1 - w) * u;
  });
}

function transformCountry(
  iso: string,
  metric: MetricId,
  input: EngineInput,
): Array<number | null> {
  let s = seriesFor(iso, metric).slice();
  const s2 = input.scenarios.includes("s2");
  const s3 = input.scenarios.includes("s3");
  const s4 = input.scenarios.includes("s4");
  const s5 = input.scenarios.includes("s5");

  if (metric !== "rgdppc" && s3 && iso === "IND") {
    const stat = statutoryIndia(s, metric);
    if (input.govSource === "statutory") s = stat;
    else if (input.govSource === "dif") s = blend(s, stat, 0.45);
  }

  if (metric === "rgdppc" && s2 && iso === "IND") {
    if (input.accounting === "backcast") s = haircutFrom(s, 2015, 0.75);
    if (input.accounting === "proxy") s = haircutFrom(s, 2015, 0.55);
  }

  if (s4 && input.covidMode === "ife") s = interpolateCovid(s);
  if (s5 && input.horizon === "capital" && metric === "rgdppc") {
    s = capitalStock(s);
  }

  return s;
}

export function eligibleDonors(input: EngineInput): string[] {
  const s1 = input.scenarios.includes("s1");
  return SLIDER_DONORS.filter((iso) => {
    if (!hasSeries(iso, input.metric)) return false;
    if (s1 && input.excludeNondem && COUNTRIES[iso]?.nondem) return false;
    return true;
  });
}

export function enforceCap(weights: Weights, cap: number, eligible: string[]): Weights {
  const out: Weights = {};
  for (const iso of SLIDER_DONORS) out[iso] = 0;
  if (eligible.length === 0) return out;

  const feasibleCap = Math.max(cap, 1 / eligible.length + 1e-9);
  for (const iso of eligible) out[iso] = weights[iso] ?? 0;

  let total = sumWeights(out, eligible);
  if (total <= 1e-12) {
    const eq = 1 / eligible.length;
    for (const iso of eligible) out[iso] = eq;
    total = 1;
  } else {
    for (const iso of eligible) out[iso] /= total;
  }

  for (let iter = 0; iter < 16; iter++) {
    let overflow = 0;
    const receivers: string[] = [];
    for (const iso of eligible) {
      if (out[iso] > feasibleCap + 1e-10) {
        overflow += out[iso] - feasibleCap;
        out[iso] = feasibleCap;
      } else if (out[iso] < feasibleCap - 1e-10) {
        receivers.push(iso);
      }
    }
    if (overflow < 1e-12) break;
    const room = receivers.reduce((s, iso) => s + (feasibleCap - out[iso]), 0);
    if (room < 1e-12 || receivers.length === 0) break;
    for (const iso of receivers) {
      out[iso] += overflow * ((feasibleCap - out[iso]) / room);
    }
  }

  const s = sumWeights(out, eligible);
  if (s > 0) for (const iso of eligible) out[iso] /= s;
  return out;
}

export function redistribute(
  weights: Weights,
  eligible: string[],
  cap: number | null,
): Weights {
  const out: Weights = {};
  for (const iso of SLIDER_DONORS) out[iso] = 0;
  let mass = 0;
  for (const iso of eligible) {
    out[iso] = weights[iso] ?? 0;
    mass += out[iso];
  }
  if (mass <= 1e-12) {
    const eq = eligible.length ? 1 / eligible.length : 0;
    for (const iso of eligible) out[iso] = eq;
  } else {
    for (const iso of eligible) out[iso] /= mass;
  }
  if (cap != null) return enforceCap(out, cap, eligible);
  return out;
}

export function setDonorWeight(
  weights: Weights,
  iso: string,
  nextPct: number,
  eligible: string[],
  cap: number | null,
): Weights {
  if (!eligible.includes(iso)) return weights;
  const max = cap ?? 1;
  const target = clamp(nextPct / 100, 0, max);
  const others = eligible.filter((k) => k !== iso);
  const remaining = Math.max(0, 1 - target);
  const otherSum = others.reduce((s, k) => s + (weights[k] ?? 0), 0);
  const next: Weights = {};
  for (const k of SLIDER_DONORS) next[k] = 0;
  next[iso] = target;
  if (others.length === 0) {
    next[iso] = 1;
  } else if (otherSum <= 1e-12) {
    const eq = remaining / others.length;
    for (const k of others) next[k] = eq;
  } else {
    for (const k of others) next[k] = ((weights[k] ?? 0) / otherSum) * remaining;
  }
  if (cap != null) return enforceCap(next, cap, eligible);
  const s = sumWeights(next, eligible);
  if (s > 0) for (const k of eligible) next[k] /= s;
  return next;
}

function weightedSum(
  yearIndex: number,
  weights: Weights,
  series: Record<string, Array<number | null>>,
): number | null {
  let num = 0;
  let den = 0;
  for (const iso of Object.keys(weights)) {
    const w = weights[iso];
    if (w <= 1e-12) continue;
    const v = series[iso]?.[yearIndex];
    if (v == null) continue;
    num += w * v;
    den += w;
  }
  if (den <= 1e-12) return null;
  return num / den;
}

function mspe(
  y: Array<number | null>,
  s: Array<number | null>,
  mask: boolean[],
): number {
  let acc = 0;
  let n = 0;
  for (let i = 0; i < y.length; i++) {
    if (!mask[i] || y[i] == null || s[i] == null) continue;
    const e = (y[i] as number) - (s[i] as number);
    acc += e * e;
    n++;
  }
  return n ? acc / n : Infinity;
}

function meanGap(
  y: Array<number | null>,
  s: Array<number | null>,
  mask: boolean[],
): number {
  let acc = 0;
  let n = 0;
  for (let i = 0; i < y.length; i++) {
    if (!mask[i] || y[i] == null || s[i] == null) continue;
    acc += (y[i] as number) - (s[i] as number);
    n++;
  }
  return n ? acc / n : 0;
}

export function runEngine(input: EngineInput): EngineOutput {
  const notes: string[] = [];
  const s1 = input.scenarios.includes("s1");
  const s4 = input.scenarios.includes("s4");
  const s5 = input.scenarios.includes("s5");

  const eligible = eligibleDonors(input);
  const cap = s1 ? input.maxWeight : null;
  let capRelaxedTo: number | null = null;
  if (cap != null && eligible.length > 0 && cap * eligible.length < 1) {
    capRelaxedTo = 1 / eligible.length;
    notes.push(
      `Weight cap raised to ${(capRelaxedTo * 100).toFixed(1)}% — ${eligible.length} eligible donors cannot fill 100% at ${(cap * 100).toFixed(0)}%.`,
    );
  }

  const appliedWeights = redistribute(
    input.weights,
    eligible,
    capRelaxedTo ?? cap,
  );

  const transformed: Record<string, Array<number | null>> = {};
  transformed.IND = transformCountry("IND", input.metric, input);
  for (const iso of Object.keys(COUNTRIES)) {
    if (iso === "IND") continue;
    transformed[iso] = transformCountry(iso, input.metric, input);
  }

  const baselineW =
    input.metric === "rgdppc" ? PAPER_INCOME_WEIGHTS : PAPER_GOV_WEIGHTS;
  const baselineSeries: Record<string, Array<number | null>> = {};
  for (const iso of Object.keys(COUNTRIES)) {
    baselineSeries[iso] = seriesFor(iso, input.metric);
  }

  const lag = s5 ? input.lagYears : 0;
  const effectiveTreatment = input.treatmentYear + lag;
  let endYear = input.range[1];
  if (s4 && input.covidMode === "preCovid") {
    endYear = Math.min(endYear, 2019);
    notes.push("Sample truncated at 2019 (pre-COVID).");
  }
  const startYear = input.range[0];

  const customPath = YEARS.map((_, i) =>
    weightedSum(i, appliedWeights, transformed),
  );
  const baselinePath = YEARS.map((_, i) =>
    weightedSum(i, baselineW, baselineSeries),
  );
  const indiaPath = transformed.IND;

  const inWindow = YEARS.map(
    (y) => y >= startYear && y <= endYear,
  );
  const pre = YEARS.map((y, i) => inWindow[i] && y < effectiveTreatment);
  const post = YEARS.map(
    (y, i) => inWindow[i] && y >= effectiveTreatment && y <= endYear,
  );

  const rows: ChartRow[] = YEARS.map((year, i) => {
    if (!inWindow[i]) {
      return {
        year,
        india: null,
        baseline: null,
        custom: null,
        lower: null,
        spread: null,
        post: false,
      };
    }
    const india = indiaPath[i];
    const custom = customPath[i];
    const baseline = baselinePath[i];
    const lower =
      india != null && custom != null ? Math.min(india, custom) : null;
    const spread =
      india != null && custom != null ? Math.abs(india - custom) : null;
    return {
      year,
      india,
      baseline,
      custom,
      lower,
      spread,
      post: year >= effectiveTreatment,
    };
  });

  const lastPost = [...YEARS.keys()].reverse().find((i) => post[i] && indiaPath[i] != null && customPath[i] != null);
  const indiaLast = lastPost != null ? (indiaPath[lastPost] as number) : 0;
  const customLast = lastPost != null ? (customPath[lastPost] as number) : 0;
  const baselineLast =
    lastPost != null && baselinePath[lastPost] != null
      ? (baselinePath[lastPost] as number)
      : 0;
  const postGap = indiaLast - customLast;
  const postGapPct = customLast !== 0 ? (100 * postGap) / customLast : 0;
  const preRmspe = Math.sqrt(mspe(indiaPath, customPath, pre));

  const indiaRatio =
    mspe(indiaPath, customPath, post) / Math.max(mspe(indiaPath, customPath, pre), 1e-8);

  const placebos: PlaceboRow[] = [];
  for (const iso of eligible) {
    const wj: Weights = {};
    for (const k of eligible) {
      if (k === iso) continue;
      wj[k] = appliedWeights[k] ?? 0;
    }
    const mass = sumWeights(wj);
    if (mass <= 1e-12) continue;
    for (const k of Object.keys(wj)) wj[k] /= mass;
    const yj = transformed[iso];
    const sj = YEARS.map((_, i) => weightedSum(i, wj, transformed));
    const ratio = mspe(yj, sj, post) / Math.max(mspe(yj, sj, pre), 1e-8);
    placebos.push({
      iso,
      name: COUNTRIES[iso]?.name ?? iso,
      ratio,
      postGap: meanGap(yj, sj, post),
    });
  }
  placebos.sort((a, b) => b.ratio - a.ratio);
  const extreme = placebos.filter((p) => p.ratio >= indiaRatio).length;
  const pValue = (1 + extreme) / (1 + placebos.length);

  if (input.metric === "rgdppc" && COUNTRIES.LKA?.gdpImputed) {
    notes.push("Sri Lanka GDP per capita is imputed (0.88× Philippines); it is not in income_panel.dta.");
  }
  if (s1 && input.excludeNondem) {
    notes.push("China (and Vietnam) dropped as one-party states; mass redistributed to remaining donors.");
  }
  if (lag > 0) {
    notes.push(`Policy-lag offset: treatment scored from ${effectiveTreatment}, not ${input.treatmentYear}.`);
  }

  return {
    rows,
    appliedWeights,
    eligible,
    preRmspe,
    postGap,
    postGapPct,
    pValue,
    indiaRatio,
    placebos,
    indiaLast,
    customLast,
    baselineLast,
    effectiveTreatment,
    endYear,
    notes,
    capRelaxedTo,
  };
}

export function formatValue(metric: MetricId, v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  if (metric === "rgdppc") {
    const sign = v < 0 ? "-" : "";
    return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  return v.toFixed(3);
}

export function formatPct(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

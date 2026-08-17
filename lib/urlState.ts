import { SLIDER_DONORS, emptyWeights } from "./engine";
import type {
  AccountingMode,
  CovidMode,
  GovSource,
  HorizonMode,
  MetricId,
  ScenarioId,
  Weights,
} from "./types";

/**
 * Serialise the dashboard state into a compact query string and back, so a
 * stacked scenario can be shared by URL. Only browser APIs are used by the
 * caller; this module is pure. Keys that sit at their default are omitted, so
 * a fresh/reset dashboard produces an empty query (clean URL).
 */
export type ShareState = {
  metric: MetricId;
  treatmentYear: number;
  range: [number, number];
  weights: Weights;
  scenarios: ScenarioId[];
  maxWeight: number;
  excludeNondem: boolean;
  accounting: AccountingMode;
  govSource: GovSource;
  covidMode: CovidMode;
  lagYears: number;
  horizon: HorizonMode;
};

const YEAR_MIN = 1984;
const YEAR_MAX = 2023;

const METRICS = new Set<MetricId>(["rgdppc", "polyarchy", "relig"]);
const ACCT = new Set<AccountingMode>(["raw", "backcast", "proxy"]);
const GOV = new Set<GovSource>(["vdem", "statutory", "dif"]);
const COV = new Set<CovidMode>(["full", "preCovid", "ife"]);
const HOR = new Set<HorizonMode>(["gdp", "capital"]);
const SCEN = new Set<ScenarioId>(["s1", "s2", "s3", "s4", "s5"]);

function permille(w: Weights): number[] {
  return SLIDER_DONORS.map((iso) => Math.round((w[iso] ?? 0) * 1000));
}

const DEFAULT_PERMILLE = permille(emptyWeights());

export function encodeState(s: ShareState): string {
  const p = new URLSearchParams();
  if (s.metric !== "rgdppc") p.set("m", s.metric);
  if (s.treatmentYear !== 2014) p.set("t", String(s.treatmentYear));
  if (s.range[0] !== YEAR_MIN || s.range[1] !== YEAR_MAX) {
    p.set("r", `${s.range[0]}-${s.range[1]}`);
  }
  if (s.scenarios.length) p.set("s", [...s.scenarios].sort().join(""));
  if (s.maxWeight !== 0.15) p.set("cap", String(Math.round(s.maxWeight * 100)));
  if (s.excludeNondem) p.set("nd", "1");
  if (s.accounting !== "raw") p.set("acc", s.accounting);
  if (s.govSource !== "vdem") p.set("gov", s.govSource);
  if (s.covidMode !== "full") p.set("cov", s.covidMode);
  if (s.lagYears) p.set("lag", String(s.lagYears));
  if (s.horizon !== "gdp") p.set("hor", s.horizon);

  const pm = permille(s.weights);
  if (pm.some((v, i) => v !== DEFAULT_PERMILLE[i])) p.set("w", pm.join("."));

  return p.toString();
}

function toInt(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function inYear(y: number | null): y is number {
  return y != null && y >= YEAR_MIN && y <= YEAR_MAX;
}

/** Parse a query string into a partial state; only valid keys are returned. */
export function decodeState(qs: string): Partial<ShareState> {
  const p = new URLSearchParams(qs);
  const out: Partial<ShareState> = {};

  const m = p.get("m");
  if (m && METRICS.has(m as MetricId)) out.metric = m as MetricId;

  const t = toInt(p.get("t"));
  if (t != null && t >= 1995 && t <= 2018) out.treatmentYear = t;

  const r = p.get("r");
  if (r) {
    const [a, b] = r.split("-").map((x) => toInt(x));
    if (inYear(a) && inYear(b) && b - a >= 5) out.range = [a, b];
  }

  const s = p.get("s");
  if (s != null) {
    const found = (s.match(/s[1-5]/g) ?? []).filter((x) =>
      SCEN.has(x as ScenarioId),
    ) as ScenarioId[];
    out.scenarios = [...new Set(found)];
  }

  const cap = toInt(p.get("cap"));
  if (cap != null && cap >= 10 && cap <= 50) out.maxWeight = cap / 100;

  if (p.get("nd") === "1") out.excludeNondem = true;

  const acc = p.get("acc");
  if (acc && ACCT.has(acc as AccountingMode)) out.accounting = acc as AccountingMode;

  const gov = p.get("gov");
  if (gov && GOV.has(gov as GovSource)) out.govSource = gov as GovSource;

  const cov = p.get("cov");
  if (cov && COV.has(cov as CovidMode)) out.covidMode = cov as CovidMode;

  const lag = toInt(p.get("lag"));
  if (lag != null && lag >= 0 && lag <= 7) out.lagYears = lag;

  const hor = p.get("hor");
  if (hor && HOR.has(hor as HorizonMode)) out.horizon = hor as HorizonMode;

  const w = p.get("w");
  if (w) {
    const parts = w.split(".").map((x) => Number(x));
    if (
      parts.length === SLIDER_DONORS.length &&
      parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)
    ) {
      const weights: Weights = {};
      SLIDER_DONORS.forEach((iso, i) => {
        weights[iso] = parts[i] / 1000;
      });
      out.weights = weights;
    }
  }

  return out;
}

export type MetricId = "rgdppc" | "polyarchy" | "relig";
export type ScenarioId = "s1" | "s2" | "s3" | "s4" | "s5";
export type AccountingMode = "raw" | "backcast" | "proxy";
export type GovSource = "vdem" | "statutory" | "dif";
export type CovidMode = "full" | "preCovid" | "ife";
export type HorizonMode = "gdp" | "capital";

export type CountrySeries = {
  iso: string;
  name: string;
  nondem: boolean;
  rgdppc: Array<number | null>;
  polyarchy: Array<number | null>;
  relig: Array<number | null>;
  gdpImputed?: boolean;
};

export type Panel = {
  years: number[];
  source: string;
  countries: Record<string, CountrySeries>;
};

export type Weights = Record<string, number>;

export type EngineInput = {
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

export type ChartRow = {
  year: number;
  india: number | null;
  baseline: number | null;
  custom: number | null;
  lower: number | null;
  spread: number | null;
  post: boolean;
};

export type PlaceboRow = {
  iso: string;
  name: string;
  ratio: number;
  postGap: number;
};

export type EngineOutput = {
  rows: ChartRow[];
  appliedWeights: Weights;
  eligible: string[];
  preRmspe: number;
  postGap: number;
  postGapPct: number;
  pValue: number;
  indiaRatio: number;
  placebos: PlaceboRow[];
  indiaLast: number;
  customLast: number;
  baselineLast: number;
  effectiveTreatment: number;
  endYear: number;
  notes: string[];
  capRelaxedTo: number | null;
};

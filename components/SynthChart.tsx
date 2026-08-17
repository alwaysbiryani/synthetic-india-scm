"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EVENTS, METRIC_META, formatValue } from "@/lib/engine";
import type { ChartRow, MetricId } from "@/lib/types";

const INK = "#121008";
const FAINT = "#4E4A42";
const RULE = "#DCD7CB";
const LEDGER = "#A31621";
const SOFT = "#F7E9E9";
const PAPER = "#FFFEFB";

type Props = {
  rows: ChartRow[];
  metric: MetricId;
  treatmentYear: number;
  effectiveTreatment: number;
};

export default function SynthChart({
  rows,
  metric,
  treatmentYear,
  effectiveTreatment,
}: Props) {
  const plot = rows.filter(
    (r) => r.india != null || r.baseline != null || r.custom != null,
  );
  const meta = METRIC_META[metric];
  const visibleEvents = EVENTS.filter((e) =>
    plot.some((r) => r.year === e.year),
  );
  const showScoring =
    effectiveTreatment !== treatmentYear &&
    plot.some((r) => r.year === effectiveTreatment);

  return (
    <div className="h-[min(64vh,540px)] w-full min-h-[320px]" role="img" aria-label={meta.label}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={plot}
          margin={{ top: 12, right: 12, left: 4, bottom: showScoring ? 18 : 4 }}
        >
          <CartesianGrid stroke={RULE} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="year"
            stroke={FAINT}
            tick={{ fill: FAINT, fontSize: 11, fontFamily: "IBM Plex Mono, ui-monospace, monospace" }}
            tickLine={false}
            axisLine={{ stroke: RULE }}
          />
          <YAxis
            stroke={FAINT}
            tick={{ fill: FAINT, fontSize: 11, fontFamily: "IBM Plex Mono, ui-monospace, monospace" }}
            tickLine={false}
            axisLine={false}
            width={metric === "rgdppc" ? 52 : 44}
            tickFormatter={(v: number) => {
              if (metric !== "rgdppc") return Number(v).toFixed(1);
              // Keep a decimal on sub-10k ticks so narrow windows don't round
              // two adjacent ticks to the same "k" label.
              const k = v / 1000;
              return `${Number.isInteger(k) ? k : k.toFixed(k < 10 ? 1 : 0)}k`;
            }}
          />
          <Tooltip
            contentStyle={{
              background: PAPER,
              border: `1px solid ${INK}`,
              borderRadius: 0,
              fontSize: 12,
              fontFamily: "IBM Plex Mono, ui-monospace, monospace",
              color: INK,
            }}
            labelStyle={{ color: INK }}
            formatter={(value, name) => [
              formatValue(metric, typeof value === "number" ? value : null),
              String(name),
            ]}
          />
          <Legend
            wrapperStyle={{
              fontSize: 12,
              fontFamily: "IBM Plex Mono, ui-monospace, monospace",
              color: INK,
            }}
            iconType="plainline"
          />
          <Area
            type="monotone"
            dataKey="lower"
            stackId="gap"
            fill="transparent"
            stroke="none"
            legendType="none"
            tooltipType="none"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="spread"
            stackId="gap"
            fill={SOFT}
            stroke="none"
            legendType="none"
            tooltipType="none"
            isAnimationActive={false}
          />
          {visibleEvents.map((e) => (
            <ReferenceLine
              key={e.year}
              x={e.year}
              stroke={e.year === treatmentYear ? LEDGER : FAINT}
              strokeDasharray={e.year === treatmentYear ? "4 3" : "2 4"}
            />
          ))}
          {showScoring ? (
            <ReferenceLine
              x={effectiveTreatment}
              stroke={LEDGER}
              strokeDasharray="6 3"
              label={{
                value: `Scoring from ${effectiveTreatment}`,
                fill: LEDGER,
                fontSize: 10,
                fontFamily: "IBM Plex Mono, ui-monospace, monospace",
                position: "insideBottomLeft",
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="india"
            name="Real India"
            stroke={INK}
            strokeWidth={2.6}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="baseline"
            name="Synthetic India (paper)"
            stroke={FAINT}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="custom"
            name="Synthetic India (stacked scenario)"
            stroke={LEDGER}
            strokeWidth={2.2}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

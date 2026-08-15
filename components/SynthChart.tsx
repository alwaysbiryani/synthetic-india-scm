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

const CYAN = "#22d3ee";
const AMBER = "#fbbf24";
const EMERALD = "#34d399";

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

  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={plot} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis
            dataKey="year"
            stroke="#64748b"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            width={metric === "rgdppc" ? 56 : 48}
            tickFormatter={(v: number) =>
              metric === "rgdppc"
                ? `${Math.round(v / 1000)}k`
                : Number(v).toFixed(1)
            }
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e2e8f0" }}
            formatter={(value, name) => [
              formatValue(metric, typeof value === "number" ? value : null),
              String(name),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }}
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
            name="India − custom |gap|"
            stackId="gap"
            fill={EMERALD}
            fillOpacity={0.16}
            stroke="none"
            isAnimationActive={false}
          />
          {visibleEvents.map((e) => (
            <ReferenceLine
              key={e.year}
              x={e.year}
              stroke={e.year === treatmentYear ? "#e2e8f0" : "#64748b"}
              strokeDasharray={e.year === treatmentYear ? "4 3" : "2 4"}
              label={{
                value: e.label,
                fill: "#94a3b8",
                fontSize: 10,
                position: "insideTopRight",
                angle: -90,
                offset: 8,
              }}
            />
          ))}
          {effectiveTreatment !== treatmentYear &&
          plot.some((r) => r.year === effectiveTreatment) ? (
            <ReferenceLine
              x={effectiveTreatment}
              stroke={EMERALD}
              strokeDasharray="6 3"
              label={{
                value: `Lagged scoring ${effectiveTreatment}`,
                fill: EMERALD,
                fontSize: 10,
                position: "insideTopLeft",
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="india"
            name="Real India"
            stroke={CYAN}
            strokeWidth={2.4}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="baseline"
            name="Synthetic India (paper)"
            stroke={AMBER}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="custom"
            name="Custom Synthetic India"
            stroke={EMERALD}
            strokeWidth={2.4}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="sr-only">{meta.label}</p>
    </div>
  );
}

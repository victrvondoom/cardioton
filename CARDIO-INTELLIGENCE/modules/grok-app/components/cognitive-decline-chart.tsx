"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type {
  DashboardKpiEntry,
  DashboardMedicationStatus,
  DashboardMood,
} from "@/lib/dashboard-kpi";
import { cn } from "@/lib/grok_app__lib__utils";

const BASELINE_WINDOW = 7;
const RANGE_OPTIONS = [14, 30, 60] as const;
type Range = (typeof RANGE_OPTIONS)[number];

const clamp = (n: number) => Math.max(0, Math.min(100, n));

// Daily Cognitive Signal Index weights (memento_overview.md §7).
const WEIGHTS = {
  fluency: 0.25, // Semantic verbal fluency
  story: 0.25, // Delayed story recall
  naming: 0.15, // Object naming accuracy + word-finding failures
  recallOrient: 0.15, // Immediate word recall + temporal orientation
  function: 0.1, // Daily function (medication adherence)
  moodPara: 0.1, // Mood + stop-word fraction (paralinguistic)
} as const;

// Categorical KPIs mapped to a 0–100 score (null when not assessed).
const MED_SCORE: Record<DashboardMedicationStatus, number | null> = {
  Confirmed: 100,
  Uncertain: 50,
  Missed: 0,
  "Not assessed": null,
};
const MOOD_SCORE: Record<DashboardMood, number | null> = {
  Cheerful: 100,
  Neutral: 80,
  Flat: 40,
  Anxious: 40,
  Agitated: 20,
  "Not assessed": null,
};

const config = {
  average: { label: "Average", color: "var(--chart-1)" },
} satisfies ChartConfig;

type ChartDatum = {
  date: string;
  average: number | null;
};

function average(values: Array<number | null>): number | null {
  const numeric = values.filter((value): value is number => value != null);
  if (numeric.length === 0) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function normalizeScore(value: number | null, max: number): number | null {
  if (value == null) return null;
  return clamp((value / max) * 100);
}

// Weighted average over only the buckets that were assessed this call: missing
// buckets drop out and the remaining weights are renormalised to sum to 1.
function weightedAverage(parts: Array<[number, number | null]>): number | null {
  const present = parts.filter(
    (part): part is [number, number] => part[1] != null,
  );
  const totalWeight = present.reduce((sum, [w]) => sum + w, 0);
  if (totalWeight === 0) return null;
  const weighted = present.reduce((sum, [w, v]) => sum + w * v, 0);
  return weighted / totalWeight;
}

function buildChartData(data: DashboardKpiEntry[]): ChartDatum[] {
  return data.map((d) => {
    // Each metric/bucket normalised to 0–100 (higher = better), or null when
    // the task didn't happen this call.
    const fluency = normalizeScore(d.verbalFluency, 20);
    const story = normalizeScore(d.storyRecallDetails, 10);

    // Naming bucket: accuracy % paired with word-finding failures (0 fails → 100).
    const wordFinding =
      d.wordFindingFailures == null
        ? null
        : clamp(100 - d.wordFindingFailures * 20);
    const naming = average([d.namingAccuracy, wordFinding]);

    // Recall + orientation bucket.
    const recallOrient = average([
      normalizeScore(d.immediateWordRecall, 3),
      normalizeScore(d.temporalOrientation, 4),
    ]);

    // Daily function: medication adherence.
    const fn = MED_SCORE[d.medicationAdherence];

    // Mood + paralinguistic: stop-word fraction inverted over a 0.30–0.50 range.
    const stopWord =
      d.stopWordFraction == null
        ? null
        : clamp(100 - ((d.stopWordFraction - 0.3) / (0.5 - 0.3)) * 100);
    const moodPara = average([MOOD_SCORE[d.mood], stopWord]);

    const composite = weightedAverage([
      [WEIGHTS.fluency, fluency],
      [WEIGHTS.story, story],
      [WEIGHTS.naming, naming],
      [WEIGHTS.recallOrient, recallOrient],
      [WEIGHTS.function, fn],
      [WEIGHTS.moodPara, moodPara],
    ]);

    return {
      date: d.date,
      average: composite == null ? null : Math.round(composite),
    };
  });
}

function baselineBounds(allChartData: ChartDatum[]) {
  const baselineAverages = allChartData
    .slice(0, BASELINE_WINDOW)
    .map((d) => d.average)
    .filter((value): value is number => value != null);

  if (baselineAverages.length === 0) return null;

  const baselineMean =
    baselineAverages.reduce((a, b) => a + b, 0) / baselineAverages.length;
  const baselineVariance =
    baselineAverages.length > 1
      ? baselineAverages.reduce((s, v) => s + (v - baselineMean) ** 2, 0) /
        (baselineAverages.length - 1)
      : 0;
  const baselineSd = Math.sqrt(baselineVariance);

  return {
    mean: Math.round(baselineMean),
    upper: Math.round(baselineMean + 2 * baselineSd),
    lower: Math.round(baselineMean - 2 * baselineSd),
  };
}

export function CognitiveDeclineChart({ data }: { data: DashboardKpiEntry[] }) {
  const [range, setRange] = useState<Range>(30);

  const allChartData = buildChartData(data);
  const chartData = allChartData.slice(-range);
  const bounds = baselineBounds(allChartData);
  const hasDomainData = allChartData.some((d) => d.average != null);
  const baselineVisible =
    allChartData.length >= BASELINE_WINDOW &&
    chartData.some((d) => d.date === allChartData[0].date);
  const baselineLastDate = allChartData[BASELINE_WINDOW - 1]?.date;
  const monitoringFirstDate =
    allChartData[BASELINE_WINDOW]?.date ?? allChartData[0]?.date;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card text-card-foreground shadow">
      <div className="p-4 pb-2 shrink-0 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Cognitive Decline</h2>
          <p className="text-sm text-muted-foreground">
            Weighted cognitive index 0–100 · green band = personal baseline ±2σ
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded px-2 py-1 text-sm font-medium transition-colors",
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 pt-0 flex-1 min-h-0">
        {hasDomainData ? (
          <ChartContainer config={config} className="h-full w-full">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            >
              {baselineVisible && baselineLastDate && (
                <ReferenceArea
                  x1={chartData[0].date}
                  x2={baselineLastDate}
                  fill="hsl(var(--muted))"
                  fillOpacity={0.4}
                />
              )}
              {bounds && monitoringFirstDate && chartData.length > 0 && (
                <ReferenceArea
                  x1={monitoringFirstDate}
                  x2={chartData[chartData.length - 1].date}
                  y1={bounds.lower}
                  y2={bounds.upper}
                  fill="hsl(142 72% 29%)"
                  fillOpacity={0.12}
                />
              )}
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 14 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fontSize: 14 }}
                tickFormatter={(v) => `${v}`}
              />
              {bounds && (
                <ReferenceLine
                  y={bounds.mean}
                  stroke="hsl(142 72% 29%)"
                  strokeDasharray="4 3"
                  strokeOpacity={0.7}
                />
              )}
              <ChartTooltip
                content={<ChartTooltipContent formatter={(v) => `${v}`} />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                connectNulls
                dataKey="average"
                type="monotone"
                stroke="var(--chart-1)"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No assessed cognitive tasks yet.
          </div>
        )}
      </div>
    </div>
  );
}

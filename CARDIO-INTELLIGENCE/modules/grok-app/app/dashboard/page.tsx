"use client";

import { AnimatePresence, motion } from "motion/react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { CognitiveDeclineChart } from "@/components/cognitive-decline-chart";
import { DashboardChat } from "@/components/dashboard-chat";
import { useDashboardChat } from "@/components/dashboard-chat-provider";
import { Badge } from "@/components/ui/grok_app__components_ui__badge";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/grok_app__components_ui__tabs";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/grok_app__components_ui__tooltip";
import {
  buildTabContext,
  getTabDisplayName,
} from "@/lib/dashboard-chat-context";
import type {
  DashboardKpiEntry,
  DashboardKpiPayload,
} from "@/lib/dashboard-kpi";
import { BASELINES } from "@/lib/mock-kpi-data";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/grok_app__lib__utils";

const chartTick = { fontSize: 14 };
const barConfig = {
  steps: { label: "Steps", color: "var(--chart-1)" },
  activeMin: { label: "Active Min", color: "var(--chart-2)" },
} satisfies ChartConfig;

const fluencyConfig = {
  verbalFluency: { label: "Animals Named", color: "var(--chart-1)" },
} satisfies ChartConfig;
const storyConfig = {
  storyRecallDetails: { label: "Details Recalled", color: "var(--chart-2)" },
  storyRecallSpeakingTime: {
    label: "Speaking Time (s)",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;
const namingConfig = {
  namingAccuracy: { label: "Accuracy %", color: "var(--chart-1)" },
  wordFindingFailures: {
    label: "Word-Finding Failures",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;
const wordRecallConfig = {
  immediateWordRecall: { label: "Immediate", color: "var(--chart-1)" },
  delayedWordRecall: { label: "Delayed", color: "var(--chart-2)" },
} satisfies ChartConfig;
const orientationConfig = {
  temporalOrientation: { label: "Orientation Score", color: "var(--chart-3)" },
} satisfies ChartConfig;
const stopWordConfig = {
  stopWordFraction: { label: "Stop Word Fraction", color: "var(--chart-4)" },
} satisfies ChartConfig;
const lexicalConfig = {
  lexicalDiversity: { label: "Lexical Diversity", color: "var(--chart-3)" },
} satisfies ChartConfig;
const speakingTimeConfig = {
  speakingTimeFluency: { label: "Fluency Task", color: "var(--chart-1)" },
  speakingTimeStoryRecall: { label: "Story Recall", color: "var(--chart-2)" },
} satisfies ChartConfig;
const repetitionConfig = {
  repetitionCount: { label: "Repetitions", color: "var(--chart-5)" },
} satisfies ChartConfig;

// Semantic status colors — real green/yellow/red/gray so the dots actually
// match the legend (the theme's --chart-* vars are all shades of purple). The
// vars are defined in grok_app__app__globals.css with brighter values in dark mode.
const STATUS_COLORS = {
  green: "var(--status-green)",
  yellow: "var(--status-yellow)",
  orange: "var(--status-orange)",
  red: "var(--status-red)",
  darkRed: "var(--status-dark-red)",
  gray: "var(--status-gray)",
} as const;

const medColorMap: Record<string, string> = {
  Confirmed: STATUS_COLORS.green,
  Uncertain: STATUS_COLORS.yellow,
  Missed: STATUS_COLORS.red,
  "Not assessed": STATUS_COLORS.gray,
};
const moodColorMap: Record<string, string> = {
  Cheerful: STATUS_COLORS.green,
  Neutral: STATUS_COLORS.yellow,
  Flat: STATUS_COLORS.orange,
  Anxious: STATUS_COLORS.red,
  Agitated: STATUS_COLORS.darkRed,
  "Not assessed": STATUS_COLORS.gray,
};

type NumericKpiKey = {
  [K in keyof DashboardKpiEntry]: DashboardKpiEntry[K] extends number | null
    ? K
    : never;
}[keyof DashboardKpiEntry];

function hasAnyValue(data: DashboardKpiEntry[], keys: NumericKpiKey[]) {
  return data.some((entry) =>
    (keys as (keyof DashboardKpiEntry)[]).some(
      (key) => typeof entry[key] === "number",
    ),
  );
}

function chartInterval(data: DashboardKpiEntry[]) {
  return data.length > 16 ? Math.ceil(data.length / 8) : 0;
}

function currentColor(map: Record<string, string>, value: string) {
  return map[value] ?? "var(--muted-foreground)";
}

function ChartCard({
  title,
  subtitle,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-72 flex-col rounded-xl border bg-card text-card-foreground shadow">
      <div className="shrink-0 p-4 pb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="min-h-0 flex-1 p-4 pt-0">
        {empty ? (
          <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No assessed values yet.
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  current,
  currentColor,
  legend,
  dots,
}: {
  title: string;
  current: string;
  currentColor: string;
  legend: { color: string; label: string }[];
  dots: { color: string; date: string; status: string }[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div>
        <span className="text-2xl font-bold" style={{ color: currentColor }}>
          {current}
        </span>
        <p className="mt-0.5 text-sm text-muted-foreground">Most recent call</p>
      </div>

      {/* Key: what each dot color means */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {legend.map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {/* Call history: one dot per call */}
      <div className="flex flex-col gap-1">
        <TooltipProvider>
          <div className="flex flex-wrap gap-1.5">
            {dots.map((d, index) => (
              <Tooltip key={`${d.date}-${index}`}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="size-3.5 rounded-full"
                    style={{ backgroundColor: d.color }}
                    aria-label={`${d.date}: ${d.status}`}
                  />
                </TooltipTrigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content
                    sideOffset={6}
                    className="z-50 grid min-w-32 items-start gap-1.5 rounded-xl bg-popover px-2.5 py-1.5 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 dark:ring-foreground/10"
                  >
                    <div className="font-medium">{d.date}</div>
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-muted-foreground">{d.status}</span>
                    </div>
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
        <p className="text-sm text-muted-foreground">
          Each dot is one call · oldest left, newest right · hover for date
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [actualData, setActualData] = useState<DashboardKpiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storedName, setStoredName] = useState("");
  const [trendSummary, setTrendSummary] = useState<string | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activityData, setActivityData] = useState<
    { day: string; steps: number; activeMin: number }[]
  >([]);
  const [activityDay, setActivityDay] = useState("");
  const [activitySteps, setActivitySteps] = useState("");
  const [activityMinutes, setActivityMinutes] = useState("");
  const { open: chatOpen, close, openChat } = useDashboardChat();

  useEffect(() => {
    openChat();
  }, [openChat]);

  useEffect(() => {
    let ignore = false;

    async function loadKpis() {
      const phone = storage.getPhone();
      const name = storage.getName();
      setStoredName(name);

      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/kpi/history?refresh=${refreshKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            name,
            patientId: phone ? undefined : "mary-demo",
            limit: 60,
          }),
        });

        if (!res.ok) {
          throw new Error(`KPI history returned ${res.status}`);
        }

        const payload = (await res.json()) as DashboardKpiPayload;
        if (!ignore) setActualData(payload.rows);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load KPIs");
          setActualData([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadKpis();

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const data = actualData;
  const latest = data.at(-1);
  const patientName = latest?.patientName ?? (storedName || "Current patient");
  const patientDetail = "Cognitive health tracking";

  useEffect(() => {
    if (data.length === 0) {
      setTrendSummary(null);
      return;
    }
    let ignore = false;
    setTrendLoading(true);
    fetch("/api/trend-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: data, patientName }),
    })
      .then((r) => r.json())
      .then((d: { summary?: string | null }) => {
        if (!ignore) setTrendSummary(d.summary ?? null);
      })
      .catch(() => {
        if (!ignore) setTrendSummary(null);
      })
      .finally(() => {
        if (!ignore) setTrendLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [data, patientName]);
  const safetyFlagCount = data.filter((d) => d.safetyFlag).length;
  const medCurrent = latest?.medicationAdherence ?? "Not assessed";
  const moodCurrent = latest?.mood ?? "Not assessed";
  const medCurrentColor = currentColor(medColorMap, medCurrent);
  const moodCurrentColor = currentColor(moodColorMap, moodCurrent);
  const xInterval = chartInterval(data);

  function logActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const steps = Number(activitySteps);
    const activeMin = Number(activityMinutes);
    if (
      !activityDay ||
      !Number.isInteger(steps) ||
      steps < 0 ||
      !Number.isInteger(activeMin) ||
      activeMin < 0
    )
      return;
    setActivityData((entries) =>
      [
        ...entries.filter((entry) => entry.day !== activityDay),
        { day: activityDay, steps, activeMin },
      ].sort((a, b) => a.day.localeCompare(b.day)),
    );
    setActivitySteps("");
    setActivityMinutes("");
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold">
              {patientName} - {patientDetail}
            </h1>
            <p className="text-sm text-muted-foreground">
              Last call {latest?.date ?? "not available"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={loading}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh readings"}
            </button>
            {safetyFlagCount > 0 && (
              <Badge variant="destructive">
                {safetyFlagCount} safety flag{safetyFlagCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
          >
            Call readings are unavailable: {error}. Use Refresh readings to
            retry.
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-[25px] flex min-h-0 flex-1 flex-col gap-4"
        >
          <TabsList className="w-fit shrink-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="memory">Language & Memory</TabsTrigger>
            <TabsTrigger value="speech">Speech & Behavior</TabsTrigger>
            <TabsTrigger value="wellness">Wellness</TabsTrigger>
          </TabsList>

          <TabsContent
            value="overview"
            className="mt-0 flex flex-col flex-1 min-h-0"
          >
            <CognitiveDeclineChart data={data} />
          </TabsContent>

          <TabsContent
            value="memory"
            className="mt-0 flex min-h-0 flex-1 flex-col gap-4"
          >
            <div className="grid flex-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              <ChartCard
                title="Verbal Fluency"
                subtitle="Unique animals named in 60 s (baseline 14)"
                empty={!hasAnyValue(data, ["verbalFluency"])}
              >
                <ChartContainer
                  config={fluencyConfig}
                  className="h-full w-full"
                >
                  <LineChart data={data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={chartTick}
                      interval={xInterval}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 20]}
                      tick={chartTick}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceLine
                      y={BASELINES.verbalFluency}
                      stroke="var(--chart-2)"
                      strokeDasharray="4 2"
                      label={{
                        value: "baseline",
                        position: "right",
                        fontSize: 14,
                        fill: "var(--chart-2)",
                      }}
                    />
                    <ReferenceLine
                      y={BASELINES.verbalFluency * 0.8}
                      stroke="var(--chart-4)"
                      strokeDasharray="2 2"
                      label={{
                        value: "-20% alert",
                        position: "right",
                        fontSize: 14,
                        fill: "var(--chart-4)",
                      }}
                    />
                    <Line
                      connectNulls
                      dataKey="verbalFluency"
                      type="monotone"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard
                title="Story Recall"
                subtitle="Details recalled (0-10) plus speaking time when available"
                empty={
                  !hasAnyValue(data, [
                    "storyRecallDetails",
                    "storyRecallSpeakingTime",
                  ])
                }
              >
                <ChartContainer config={storyConfig} className="h-full w-full">
                  <LineChart data={data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={chartTick}
                      interval={xInterval}
                    />
                    <YAxis tickLine={false} axisLine={false} tick={chartTick} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceLine
                      y={BASELINES.storyRecallDetails}
                      stroke="var(--chart-2)"
                      strokeDasharray="4 2"
                    />
                    <Line
                      connectNulls
                      dataKey="storyRecallDetails"
                      type="monotone"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      connectNulls
                      dataKey="storyRecallSpeakingTime"
                      type="monotone"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </LineChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard
                title="Object Naming"
                subtitle="Accuracy percent and word-finding failures"
                empty={
                  !hasAnyValue(data, ["namingAccuracy", "wordFindingFailures"])
                }
              >
                <ChartContainer config={namingConfig} className="h-full w-full">
                  <LineChart data={data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={chartTick}
                      interval={xInterval}
                    />
                    <YAxis tickLine={false} axisLine={false} tick={chartTick} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceLine
                      y={BASELINES.namingAccuracy}
                      stroke="var(--chart-1)"
                      strokeDasharray="4 2"
                    />
                    <Line
                      connectNulls
                      dataKey="namingAccuracy"
                      type="monotone"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      connectNulls
                      dataKey="wordFindingFailures"
                      type="monotone"
                      stroke="var(--chart-4)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </LineChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard
                title="Word Recall"
                subtitle="Immediate and delayed recall (0-3)"
                empty={
                  !hasAnyValue(data, [
                    "immediateWordRecall",
                    "delayedWordRecall",
                  ])
                }
              >
                <ChartContainer
                  config={wordRecallConfig}
                  className="h-full w-full"
                >
                  <LineChart data={data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={chartTick}
                      interval={xInterval}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 3]}
                      ticks={[0, 1, 2, 3]}
                      tick={chartTick}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      connectNulls
                      dataKey="immediateWordRecall"
                      type="monotone"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      connectNulls
                      dataKey="delayedWordRecall"
                      type="monotone"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </LineChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard
                title="Temporal Orientation"
                subtitle="Day, date, month, and year (0-4)"
                empty={!hasAnyValue(data, ["temporalOrientation"])}
              >
                <ChartContainer
                  config={orientationConfig}
                  className="h-full w-full"
                >
                  <LineChart data={data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={chartTick}
                      interval={xInterval}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 4]}
                      ticks={[0, 1, 2, 3, 4]}
                      tick={chartTick}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceLine
                      y={4}
                      stroke="var(--chart-3)"
                      strokeDasharray="4 2"
                    />
                    <Line
                      connectNulls
                      dataKey="temporalOrientation"
                      type="monotone"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ChartContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent
            value="speech"
            className="mt-0 flex min-h-0 flex-1 flex-col gap-4"
          >
            <div className="grid flex-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              <ChartCard
                title="Stop Word Fraction"
                subtitle="Filler and function words as a proportion of speech"
                empty={!hasAnyValue(data, ["stopWordFraction"])}
              >
                <ChartContainer
                  config={stopWordConfig}
                  className="h-full w-full"
                >
                  <LineChart data={data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={chartTick}
                      interval={xInterval}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={[0.25, 0.55]}
                      tick={chartTick}
                      tickFormatter={(v) => v.toFixed(2)}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(v) => (v as number).toFixed(2)}
                        />
                      }
                    />
                    <ReferenceLine
                      y={BASELINES.stopWordFraction}
                      stroke="var(--chart-3)"
                      strokeDasharray="4 2"
                      label={{
                        value: "baseline",
                        position: "right",
                        fontSize: 14,
                        fill: "var(--chart-3)",
                      }}
                    />
                    <ReferenceLine
                      y={BASELINES.stopWordFraction + 0.15}
                      stroke="var(--chart-2)"
                      strokeDasharray="2 2"
                      label={{
                        value: "+15% alert",
                        position: "right",
                        fontSize: 14,
                        fill: "var(--chart-2)",
                      }}
                    />
                    <Line
                      connectNulls
                      dataKey="stopWordFraction"
                      type="monotone"
                      stroke="var(--chart-4)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard
                title="Lexical Diversity"
                subtitle="Type-token ratio from patient speech"
                empty={!hasAnyValue(data, ["lexicalDiversity"])}
              >
                <ChartContainer
                  config={lexicalConfig}
                  className="h-full w-full"
                >
                  <LineChart data={data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={chartTick}
                      interval={xInterval}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 1]}
                      tick={chartTick}
                      tickFormatter={(v) => v.toFixed(2)}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(v) => (v as number).toFixed(2)}
                        />
                      }
                    />
                    <Line
                      connectNulls
                      dataKey="lexicalDiversity"
                      type="monotone"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard
                title="Repetition Within Call"
                subtitle="Times patient repeated a phrase or question"
                empty={!hasAnyValue(data, ["repetitionCount"])}
              >
                <ChartContainer
                  config={repetitionConfig}
                  className="h-full w-full"
                >
                  <BarChart data={data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={chartTick}
                      interval={xInterval}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 5]}
                      ticks={[0, 1, 2, 3, 4, 5]}
                      tick={chartTick}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceLine
                      y={3}
                      stroke="var(--chart-4)"
                      strokeDasharray="4 2"
                      label={{
                        value: "flag >=3",
                        position: "right",
                        fontSize: 14,
                        fill: "var(--chart-4)",
                      }}
                    />
                    <Bar
                      dataKey="repetitionCount"
                      fill="var(--chart-5)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard
                title="Speaking Time per Task"
                subtitle="Fluency and story recall windows in seconds"
                empty={
                  !hasAnyValue(data, [
                    "speakingTimeFluency",
                    "speakingTimeStoryRecall",
                  ])
                }
              >
                <ChartContainer
                  config={speakingTimeConfig}
                  className="h-full w-full"
                >
                  <BarChart data={data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={chartTick}
                      interval={xInterval}
                    />
                    <YAxis tickLine={false} axisLine={false} tick={chartTick} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceLine
                      y={BASELINES.speakingTimeFluency}
                      stroke="var(--chart-1)"
                      strokeDasharray="4 2"
                    />
                    <ReferenceLine
                      y={BASELINES.speakingTimeStoryRecall}
                      stroke="var(--chart-2)"
                      strokeDasharray="4 2"
                    />
                    <Bar
                      dataKey="speakingTimeFluency"
                      fill="var(--chart-1)"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="speakingTimeStoryRecall"
                      fill="var(--chart-2)"
                      radius={[3, 3, 0, 0]}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </BarChart>
                </ChartContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent
            value="wellness"
            className="mt-0 flex min-h-0 flex-1 flex-col gap-4"
          >
            <div className="grid shrink-0 gap-4 lg:grid-cols-3">
              <StatCard
                title="Medication adherence"
                current={medCurrent}
                currentColor={medCurrentColor}
                legend={[
                  { color: STATUS_COLORS.green, label: "Confirmed" },
                  { color: STATUS_COLORS.yellow, label: "Uncertain" },
                  { color: STATUS_COLORS.red, label: "Missed" },
                  { color: STATUS_COLORS.gray, label: "Not assessed" },
                ]}
                dots={data.map((d) => ({
                  color:
                    medColorMap[d.medicationAdherence] ?? STATUS_COLORS.gray,
                  date: d.date,
                  status: d.medicationAdherence,
                }))}
              />
              <StatCard
                title="Mood & affect"
                current={moodCurrent}
                currentColor={moodCurrentColor}
                legend={[
                  { color: STATUS_COLORS.green, label: "Cheerful" },
                  { color: STATUS_COLORS.yellow, label: "Neutral" },
                  { color: STATUS_COLORS.orange, label: "Flat" },
                  { color: STATUS_COLORS.red, label: "Anxious" },
                  { color: STATUS_COLORS.darkRed, label: "Agitated" },
                  { color: STATUS_COLORS.gray, label: "Not assessed" },
                ]}
                dots={data.map((d) => ({
                  color: moodColorMap[d.mood] ?? STATUS_COLORS.gray,
                  date: d.date,
                  status: d.mood,
                }))}
              />
              <StatCard
                title="Safety flags"
                current={
                  safetyFlagCount === 0
                    ? "None"
                    : `${safetyFlagCount} flag${safetyFlagCount > 1 ? "s" : ""}`
                }
                currentColor={
                  safetyFlagCount === 0
                    ? STATUS_COLORS.green
                    : STATUS_COLORS.red
                }
                legend={[
                  { color: STATUS_COLORS.green, label: "Clear" },
                  {
                    color: STATUS_COLORS.red,
                    label: "Flagged (fall, wandering, distress, help request)",
                  },
                ]}
                dots={data.map((d) => ({
                  color: d.safetyFlag ? STATUS_COLORS.red : STATUS_COLORS.green,
                  date: d.date,
                  status: d.safetyFlag ? "Flagged" : "Clear",
                }))}
              />
            </div>

            <div className="grid flex-1 gap-4 lg:grid-cols-2">
              <div className="flex min-h-72 flex-col rounded-xl border bg-card text-card-foreground shadow">
                <div className="shrink-0 p-4 pb-2">
                  <h2 className="text-sm font-semibold">Daily Activity</h2>
                  <p className="text-sm text-muted-foreground">
                    Self-reported activity in this session. No wearable is
                    connected.
                  </p>
                  <form
                    onSubmit={logActivity}
                    className="mt-3 flex flex-wrap gap-2"
                  >
                    <input
                      aria-label="Activity date"
                      type="date"
                      required
                      value={activityDay}
                      onChange={(event) => setActivityDay(event.target.value)}
                      className="rounded-md border bg-background px-2 py-1 text-sm"
                    />
                    <input
                      aria-label="Steps"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={activitySteps}
                      onChange={(event) => setActivitySteps(event.target.value)}
                      placeholder="Steps"
                      className="w-24 rounded-md border bg-background px-2 py-1 text-sm"
                    />
                    <input
                      aria-label="Active minutes"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={activityMinutes}
                      onChange={(event) =>
                        setActivityMinutes(event.target.value)
                      }
                      placeholder="Minutes"
                      className="w-28 rounded-md border bg-background px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-md border px-3 py-1 text-sm"
                    >
                      Log activity
                    </button>
                  </form>
                </div>
                <div className="min-h-0 flex-1 p-4 pt-0">
                  {activityData.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Log a day to see an activity chart.
                    </p>
                  ) : (
                    <ChartContainer
                      config={barConfig}
                      className="h-full w-full"
                    >
                      <BarChart data={activityData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="day"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tick={chartTick}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tick={chartTick}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar
                          dataKey="steps"
                          fill="var(--chart-1)"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="activeMin"
                          fill="var(--chart-2)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ChartContainer>
                  )}
                </div>
              </div>

              <ChartCard
                title="Call Duration"
                subtitle="Minutes per completed call when available"
                empty={!hasAnyValue(data, ["callDurationMinutes"])}
              >
                <ChartContainer
                  config={{
                    callDurationMinutes: {
                      label: "Duration (min)",
                      color: "var(--chart-1)",
                    },
                  }}
                  className="h-full w-full"
                >
                  <BarChart data={data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={chartTick}
                      interval={xInterval}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 12]}
                      tick={chartTick}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="callDurationMinutes"
                      fill="var(--chart-1)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </ChartCard>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <AnimatePresence>
        {chatOpen && (
          <DashboardChat
            key={activeTab}
            tabName={getTabDisplayName(activeTab)}
            context={buildTabContext(activeTab, data, latest)}
            patientName={patientName}
            trendSummary={trendSummary}
            trendLoading={trendLoading}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

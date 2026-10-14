import type { DashboardKpiEntry } from "@/lib/dashboard-kpi";

const TAB_NAMES: Record<string, string> = {
  overview: "Overview",
  memory: "Language & Memory",
  speech: "Speech & Behavior",
  wellness: "Wellness",
};

export function getTabDisplayName(tab: string): string {
  return TAB_NAMES[tab] ?? tab;
}

type ColDef = {
  label: string;
  key: keyof DashboardKpiEntry;
  unit?: string;
};

function csv(data: DashboardKpiEntry[], cols: ColDef[]): string {
  const header = ["Date", ...cols.map((c) => c.label)].join(",");
  const rows = data.map((entry) => {
    const cells = cols.map((c) => {
      const v = entry[c.key];
      if (v == null) return "";
      if (typeof v === "number") return v.toString();
      return String(v);
    });
    return [entry.date, ...cells].join(",");
  });
  return [header, ...rows].join("\n");
}

// Baselines documented in the dashboard for reference
const BASELINES = `
Baselines:
- Verbal fluency (animals): baseline ~14, alert if <11
- Story recall details: baseline ~7
- Naming accuracy: baseline ~93%
- Word recall (immediate/delayed): max 3 each
- Temporal orientation: max 4 (one point per: day of week, date, month, year)
- Stop-word fraction: baseline ~0.34, alert if >0.39
- Lexical diversity: 0–1 scale (higher = more varied vocabulary)
- Repetitions: alert if ≥3 in one call
`.trim();

function overviewContext(
  data: DashboardKpiEntry[],
  latest: DashboardKpiEntry | undefined,
): string {
  if (!latest || data.length === 0) return "No call data available.";

  const cols: ColDef[] = [
    { label: "Verbal Fluency", key: "verbalFluency" },
    { label: "Story Recall", key: "storyRecallDetails" },
    { label: "Naming Accuracy %", key: "namingAccuracy" },
    { label: "Immediate Recall /3", key: "immediateWordRecall" },
    { label: "Delayed Recall /3", key: "delayedWordRecall" },
    { label: "Orientation /4", key: "temporalOrientation" },
    { label: "Stop-Word Fraction", key: "stopWordFraction" },
    { label: "Lexical Diversity", key: "lexicalDiversity" },
    { label: "Repetitions", key: "repetitionCount" },
    { label: "Mood", key: "mood" },
    { label: "Medication", key: "medicationAdherence" },
    { label: "Safety Flag", key: "safetyFlag" },
  ];

  return `
TAB: Overview — Cognitive Decline (Weighted Index)
Shows a weighted composite of all cognitive metrics over time.
Patient: ${latest.patientName ?? "unknown"} | Call range: ${data[0].date} to ${latest.date} | Total calls: ${data.length}
${BASELINES}

Full call history (all metrics, chronological):
${csv(data, cols)}
`.trim();
}

function memoryContext(
  data: DashboardKpiEntry[],
  latest: DashboardKpiEntry | undefined,
): string {
  if (!latest || data.length === 0) return "No call data available.";

  const cols: ColDef[] = [
    { label: "Verbal Fluency (animals)", key: "verbalFluency" },
    { label: "Story Recall (details)", key: "storyRecallDetails" },
    { label: "Story Recall (speaking time s)", key: "storyRecallSpeakingTime" },
    { label: "Naming Accuracy %", key: "namingAccuracy" },
    { label: "Word-Finding Failures", key: "wordFindingFailures" },
    { label: "Immediate Word Recall /3", key: "immediateWordRecall" },
    { label: "Delayed Word Recall /3", key: "delayedWordRecall" },
    { label: "Temporal Orientation /4", key: "temporalOrientation" },
  ];

  return `
TAB: Language & Memory
Five charts: Verbal Fluency, Story Recall, Object Naming, Word Recall, Temporal Orientation.
Patient: ${latest.patientName ?? "unknown"} | Call range: ${data[0].date} to ${latest.date} | Total calls: ${data.length}
${BASELINES}

Full call history:
${csv(data, cols)}
`.trim();
}

function speechContext(
  data: DashboardKpiEntry[],
  latest: DashboardKpiEntry | undefined,
): string {
  if (!latest || data.length === 0) return "No call data available.";

  const cols: ColDef[] = [
    { label: "Stop-Word Fraction", key: "stopWordFraction" },
    { label: "Lexical Diversity", key: "lexicalDiversity" },
    { label: "Repetitions in Call", key: "repetitionCount" },
    { label: "Speaking Time Fluency (s)", key: "speakingTimeFluency" },
    { label: "Speaking Time Story Recall (s)", key: "speakingTimeStoryRecall" },
  ];

  return `
TAB: Speech & Behavior
Four charts: Stop-Word Fraction, Lexical Diversity, Repetition Within Call, Speaking Time per Task.
Patient: ${latest.patientName ?? "unknown"} | Call range: ${data[0].date} to ${latest.date} | Total calls: ${data.length}
${BASELINES}

Full call history:
${csv(data, cols)}
`.trim();
}

function wellnessContext(
  data: DashboardKpiEntry[],
  latest: DashboardKpiEntry | undefined,
): string {
  if (!latest || data.length === 0) return "No call data available.";

  const cols: ColDef[] = [
    { label: "Mood", key: "mood" },
    { label: "Medication", key: "medicationAdherence" },
    { label: "Safety Flag", key: "safetyFlag" },
    { label: "Safety Flag Type", key: "safetyFlagType" },
    { label: "Call Duration (min)", key: "callDurationMinutes" },
  ];

  return `
TAB: Wellness
Stat cards: Medication Adherence, Mood & Affect, Safety Flags. Charts: Daily Activity (steps/active minutes), Call Duration.
Patient: ${latest.patientName ?? "unknown"} | Call range: ${data[0].date} to ${latest.date} | Total calls: ${data.length}

Full call history:
${csv(data, cols)}
`.trim();
}

export function buildTabContext(
  tab: string,
  data: DashboardKpiEntry[],
  latest: DashboardKpiEntry | undefined,
): string {
  switch (tab) {
    case "overview":
      return overviewContext(data, latest);
    case "memory":
      return memoryContext(data, latest);
    case "speech":
      return speechContext(data, latest);
    case "wellness":
      return wellnessContext(data, latest);
    default:
      return "No chart data available for this view.";
  }
}

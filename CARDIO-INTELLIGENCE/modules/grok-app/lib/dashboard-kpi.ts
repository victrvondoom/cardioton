export type DashboardMood =
  | "Cheerful"
  | "Neutral"
  | "Flat"
  | "Anxious"
  | "Agitated"
  | "Not assessed";

export type DashboardMedicationStatus =
  | "Confirmed"
  | "Uncertain"
  | "Missed"
  | "Not assessed";

export type DashboardKpiEntry = {
  id?: string;
  date: string;
  iso: string;
  patientName: string | null;
  summary: string | null;
  observations: string[];
  verbalFluency: number | null;
  storyRecallDetails: number | null;
  storyRecallSpeakingTime: number | null;
  namingAccuracy: number | null;
  wordFindingFailures: number | null;
  immediateWordRecall: number | null;
  delayedWordRecall: number | null;
  temporalOrientation: number | null;
  stopWordFraction: number | null;
  lexicalDiversity: number | null;
  speakingTimeFluency: number | null;
  speakingTimeStoryRecall: number | null;
  repetitionCount: number | null;
  medicationAdherence: DashboardMedicationStatus;
  mood: DashboardMood;
  sleepQuality: string | null;
  safetyFlag: boolean;
  safetyFlagType: string | null;
  callCompleted: boolean | null;
  callDurationMinutes: number | null;
};

export type DashboardKpiPayload = {
  patientId: string;
  rows: DashboardKpiEntry[];
};

export type RawDashboardKpiRow = {
  id: string;
  patient_name: string | null;
  call_date: string;
  mood: string | null;
  sleep_quality: string | null;
  fluency_count: number | null;
  naming_accuracy: number | string | null;
  word_finding_failures: number | null;
  immediate_recall: number | null;
  delayed_recall_words: number | null;
  story_recall_details: number | null;
  orientation_score: number | null;
  stop_word_fraction: number | string | null;
  lexical_diversity: number | string | null;
  repetition_count: number | null;
  medication_status: string | null;
  safety_flag: boolean;
  safety_flag_type: string | null;
  engagement: string | null;
  summary: string | null;
  observations_json: unknown;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function toNumber(value: number | string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatCallDate(value: string): { iso: string; label: string } {
  const iso = value.includes("T") ? value.slice(0, 10) : value;
  return {
    iso,
    label: DATE_FORMATTER.format(new Date(`${iso}T00:00:00.000Z`)),
  };
}

function normalizeMood(value: string | null): DashboardMood {
  if (
    value === "Cheerful" ||
    value === "Neutral" ||
    value === "Flat" ||
    value === "Anxious" ||
    value === "Agitated"
  ) {
    return value;
  }
  return "Not assessed";
}

function normalizeMedication(value: string | null): DashboardMedicationStatus {
  if (value === "Confirmed" || value === "Uncertain" || value === "Missed") {
    return value;
  }
  return "Not assessed";
}

function normalizeObservations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (observation): observation is string =>
      typeof observation === "string" && observation.trim().length > 0,
  );
}

export function toDashboardKpiEntry(
  row: RawDashboardKpiRow,
): DashboardKpiEntry {
  const callDate = formatCallDate(row.call_date);
  const namingAccuracy = toNumber(row.naming_accuracy);

  return {
    id: row.id,
    date: callDate.label,
    iso: callDate.iso,
    patientName: row.patient_name,
    summary: row.summary,
    observations: normalizeObservations(row.observations_json),
    verbalFluency: row.fluency_count,
    storyRecallDetails: row.story_recall_details,
    storyRecallSpeakingTime: null,
    namingAccuracy:
      namingAccuracy == null
        ? null
        : namingAccuracy <= 1
          ? Math.round(namingAccuracy * 100)
          : namingAccuracy,
    wordFindingFailures: row.word_finding_failures,
    immediateWordRecall: row.immediate_recall,
    delayedWordRecall: row.delayed_recall_words,
    temporalOrientation: row.orientation_score,
    stopWordFraction: toNumber(row.stop_word_fraction),
    lexicalDiversity: toNumber(row.lexical_diversity),
    speakingTimeFluency: null,
    speakingTimeStoryRecall: null,
    repetitionCount: row.repetition_count,
    medicationAdherence: normalizeMedication(row.medication_status),
    mood: normalizeMood(row.mood),
    sleepQuality: row.sleep_quality,
    safetyFlag: row.safety_flag,
    safetyFlagType: row.safety_flag_type,
    callCompleted: row.engagement == null ? null : row.engagement !== "Partial",
    callDurationMinutes: null,
  };
}

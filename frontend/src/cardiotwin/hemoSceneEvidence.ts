import type { HemoEvidence } from "./hemoTypes";

export interface SceneHeartRateSelection {
  value: number | null;
  unit: "bpm";
  evidenceIds: string[];
  observedAt: string | null;
  status: "observed" | "unknown";
  reason: string;
}

const DAY_MS = 86_400_000;
const HEART_RATE_UNITS = new Set(["bpm", "/min", "{beats}/min"]);

/** Select a dated source quantity; this does not measure or infer cardiac motion. */
export function selectSceneHeartRate(evidence: HemoEvidence[], asOf: string, recentDays = 14): SceneHeartRateSelection {
  const unknown = (reason: string, records: HemoEvidence[] = []): SceneHeartRateSelection => ({
    value: null,
    unit: "bpm",
    evidenceIds: [...new Set(records.map(record => record.id))].sort(),
    observedAt: records[0]?.event_at ?? null,
    status: "unknown",
    reason,
  });
  const boundary = Date.parse(asOf);
  if (!Number.isFinite(boundary)) return unknown("The selected replay time is unavailable.");
  if (!Number.isFinite(recentDays) || recentDays < 0) return unknown("The heart-rate freshness window is unavailable.");

  // Filter both clocks before selecting the latest event or inspecting conflicts.
  const available = evidence.filter(record => {
    if (record.kind !== "heart_rate") return false;
    const event = Date.parse(record.event_at), arrival = Date.parse(record.available_at);
    return Number.isFinite(event) && Number.isFinite(arrival) && event <= boundary && arrival <= boundary;
  });
  if (!available.length) return unknown("No heart-rate source is available at the selected replay time.");

  const latestEvent = Math.max(...available.map(record => Date.parse(record.event_at)));
  const latest = available.filter(record => Date.parse(record.event_at) === latestEvent)
    .sort((left, right) => Date.parse(right.available_at) - Date.parse(left.available_at) || left.id.localeCompare(right.id));
  if (boundary - latestEvent > recentDays * DAY_MS) {
    return unknown(`The latest heart-rate source is outside the ${recentDays}-day evidence window.`, latest);
  }

  // A newer unusable source must not silently revive an older valid quantity.
  const supported = latest.every(record => record.classification === "OBSERVED"
    && typeof record.value === "number" && Number.isFinite(record.value)
    && record.value >= 10 && record.value <= 350
    && HEART_RATE_UNITS.has((record.unit ?? "").toLowerCase().replace(/\s/g, "")));
  if (!supported) return unknown("The latest sources do not agree on a supported observed heart-rate quantity.", latest);
  if (new Set(latest.map(record => record.value)).size !== 1) {
    return unknown("The latest heart-rate sources contain conflicting values.", latest);
  }

  return {
    value: latest[0].value as number,
    unit: "bpm",
    evidenceIds: [...new Set(latest.map(record => record.id))].sort(),
    observedAt: latest[0].event_at,
    status: "observed",
    reason: "Observed source value at the selected replay time; motion remains illustrative.",
  };
}

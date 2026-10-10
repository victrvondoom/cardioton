import { VESSELS, type Prediction, type VesselId } from "../types";

export interface CoronaryModelContext {
  probabilities: Record<VesselId, number>;
  generatedAt: string;
  model: string;
  artifactSha256: string;
  scenario: string | null;
  researchScenario: boolean;
}

/** Transfer only the current model summary, without patient inputs or identifiers. */
export function coronaryContextFromPrediction(prediction: Prediction, researchScenario: boolean): CoronaryModelContext {
  return {
    probabilities: Object.fromEntries(VESSELS.map(vessel => [vessel, prediction.vessels[vessel].probability])) as Record<VesselId, number>,
    generatedAt: prediction.provenance.prediction_timestamp,
    model: `${prediction.provenance.model_id} / ${prediction.provenance.version}`,
    artifactSha256: prediction.provenance.artifact_sha256,
    scenario: prediction.provenance.scenario_id,
    researchScenario,
  };
}

/** Route state is optional and may be stale or malformed. Never carry it back in time. */
export function visibleCoronaryContext(value: unknown, asOf: string): CoronaryModelContext | null {
  if (!value || typeof value !== "object") return null;
  const context = value as Partial<CoronaryModelContext>;
  if (typeof context.generatedAt !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(context.generatedAt) || !Number.isFinite(Date.parse(context.generatedAt)) || Date.parse(context.generatedAt) > Date.parse(asOf) || !Number.isFinite(Date.parse(asOf))) return null;
  if (typeof context.model !== "string" || typeof context.artifactSha256 !== "string" || typeof context.researchScenario !== "boolean" || (context.scenario !== null && typeof context.scenario !== "string")) return null;
  if (!context.probabilities || VESSELS.some(vessel => typeof context.probabilities?.[vessel] !== "number" || !Number.isFinite(context.probabilities[vessel]) || context.probabilities[vessel] < 0 || context.probabilities[vessel] > 1)) return null;
  return context as CoronaryModelContext;
}

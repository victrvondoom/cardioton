// CardioTwin API client — same auth + 401 behaviour as lib/api.ts and the OncoTwin / AquaHealth clients.
import { authHeader, clearAuth } from "../lib/auth";
import { readFetch } from "../lib/readFetch";
import type { HemoFhirInput, HemoReconstructInput, HemoResult } from "./hemoTypes";
import type {
  CounterfactualResult,
  EvaluationReport,
  FeatureCatalog,
  Overview,
  PatientValues,
  Prediction,
  Scenario,
} from "./types";

const BASE = "/api/v1/cardiotwin";

export class CardioTwinError extends Error {
  constructor(
    public status: number,
    message: string,
    public problems: string[] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await readFetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeader() },
  });
  if (res.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new CardioTwinError(401, "Session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const d = body?.detail;
    const problems: string[] = Array.isArray(d?.problems) ? d.problems : [];
    const message =
      typeof d === "string" ? d : problems.length ? problems.join("; ") : JSON.stringify(d ?? body);
    throw new CardioTwinError(res.status, message || `Request failed (${res.status})`, problems);
  }
  return res.json() as Promise<T>;
}

const post = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

/** Drop empty / null entries so the backend imputes them and reports completeness honestly. */
export function cleanValues(v: PatientValues): PatientValues {
  const out: PatientValues = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === null || val === undefined || val === "") continue;
    out[k] = val;
  }
  return out;
}

export const cardio = {
  overview: () => request<Overview>("/overview"),
  features: () => request<FeatureCatalog>("/features"),
  scenarios: () => request<{ note: string; scenarios: Scenario[] }>("/scenarios"),
  predict: (features: PatientValues, scenarioId?: string | null) =>
    post<Prediction>("/predict", { features: cleanValues(features), scenario_id: scenarioId ?? null }),
  counterfactual: (features: PatientValues, perturbations: Record<string, number | string>) =>
    post<CounterfactualResult>("/counterfactual", { features: cleanValues(features), perturbations }),
  sensitivity: (features: PatientValues, feature: string, points = 15) =>
    post<{
      feature: string;
      label: string;
      unit: string;
      current_value: number | string;
      curve: ({ value: number | string } & Record<string, number | string>)[];
      note: string;
    }>("/sensitivity", { features: cleanValues(features), feature, points }),
  model: () => request<Record<string, unknown>>("/model"),
  evaluation: () => request<EvaluationReport>("/evaluation"),
  hemoDemo: (asOf?: string) => request<HemoResult>(`/hemo/demo${asOf ? `?as_of=${encodeURIComponent(asOf)}` : ""}`),
  hemoReconstruct: (input: HemoReconstructInput) => post<HemoResult>("/hemo/reconstruct", input),
  hemoFhir: (input: HemoFhirInput) => post<HemoResult>("/hemo/fhir", input),
  hemoFhirPassport: (input: HemoFhirInput) => post<Record<string, unknown>>("/hemo/fhir/passport", input),
  hemoPassport: (input: HemoReconstructInput) => post<Record<string, unknown>>("/hemo/passport", input),
  hemoDemoPassport: (asOf?: string) => request<Record<string, unknown>>(`/hemo/demo/passport${asOf ? `?as_of=${encodeURIComponent(asOf)}` : ""}`),

  // ── Evidence Passport (Pillar A) ──
  createPassport: (features: PatientValues, caseId?: string, parentId?: string) =>
    post<Record<string, unknown>>("/evidence/passports", {
      case_id: caseId ?? "CASE-SYNTH-DEMO",
      features: cleanValues(features),
      parent_passport_id: parentId ?? null,
      synthetic_demo: true,
    }),
  getPassport: (id: string) => request<Record<string, unknown>>(`/evidence/passports/${id}`),
  verifyPassport: (id: string) => post<Record<string, unknown>>(`/evidence/passports/${id}/verify`, {}),
  passportHistory: (id: string) => request<Record<string, unknown>>(`/evidence/passports/${id}/history`),
  signOffPassport: (id: string, scope?: string, notes?: string) =>
    post<Record<string, unknown>>(`/evidence/passports/${id}/sign-off`, { scope: scope ?? "Clinical Review", notes }),
  tamperTest: (id: string) =>
    post<Record<string, unknown>>(`/evidence/passports/${id}/tamper-test`, {
      modified_field: "data_quality",
      new_value: { completeness_score_pct: 100, tampered: true },
    }),

  // ── FHIR Round-Trip (Pillar D) ──
  exportFhir: (passportId: string) =>
    post<Record<string, unknown>>(`/evidence/passports/${passportId}/export-fhir`, {}),
  fhirRoundtrip: (passportId: string) =>
    post<Record<string, unknown>>(`/evidence/passports/${passportId}/roundtrip`, {}),

  // ── Counterfactual Lab (Pillar B) ──
  counterfactualParams: () => request<Record<string, unknown>>("/hemo/counterfactual/parameters"),
  counterfactualSweep: (vesselId: string, sweepParam: string, steps?: number, baselineParams?: Record<string, number>) =>
    post<Record<string, unknown>>("/hemo/counterfactual/sweep", {
      vessel_id: vesselId,
      sweep_param: sweepParam,
      sweep_steps: steps ?? 12,
      baseline_params: baselineParams ?? {},
    }),
  counterfactualSensitivity: (vesselId: string, baselineParams?: Record<string, number>, target?: string) =>
    post<Record<string, unknown>>("/hemo/counterfactual/sensitivity", {
      vessel_id: vesselId,
      baseline_params: baselineParams ?? {},
      target_output: target ?? "ffr",
    }),
  counterfactualCompare: (vesselId: string, baselineParams: Record<string, number>, interventionParams: Record<string, number>) =>
    post<Record<string, unknown>>("/hemo/counterfactual/compare", {
      vessel_id: vesselId,
      baseline_params: baselineParams,
      intervention_params: interventionParams,
    }),
};

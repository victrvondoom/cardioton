// IIT Mandi Track A API client — synthetic patients, real CAD prediction, multimodal fusion.
import { authHeader, clearAuth } from "../lib/auth";
import { readFetch } from "../lib/readFetch";

const BASE = "/api/v1/iit_mandi";

export class IitMandiError extends Error {
  constructor(public status: number, message: string) {
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
    throw new IitMandiError(401, "Session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const d = body?.detail;
    throw new IitMandiError(res.status, typeof d === "string" ? d : JSON.stringify(d ?? body));
  }
  return res.json() as Promise<T>;
}

export interface IitMandiScenario {
  id: string;
  name: string;
  description: string;
  metadata: { age: number; sex: string };
  ehr_data: Record<string, number | string>;
  ecg: { scenario: string; heart_rate: number };
  wearable: { scenario: string; duration: number };
  expected_outcomes: { cad_probability: number; afib_probability: number };
  focus_areas: string[];
  visualization: Record<string, unknown>;
}

export interface ModalPrediction {
  modality: "ehr" | "ecg" | "wearable";
  cad_probability: number;
  lad_probability: number;
  lcx_probability: number;
  rca_probability: number;
  afib_probability: number;
  vtach_probability: number;
  confidence: string;
  data_present: boolean;
  contributing_features: Record<string, unknown>;
  uncertainty: number;
}

export interface FusedPrediction {
  individual_predictions: Record<"ehr" | "ecg" | "wearable", ModalPrediction>;
  fused_predictions: {
    cad_probability: number;
    lad_probability: number;
    lcx_probability: number;
    rca_probability: number;
    afib_probability: number;
    vtach_probability: number;
  };
  confidence: string;
  uncertainty: { fused: number; modality_disagreement: number };
  available_modalities: string[];
  missing_modalities: string[];
}

export interface IitMandiDemonstration {
  scenario: IitMandiScenario;
  prediction: FusedPrediction;
  visualization: {
    cad_probability: number;
    vessels: Record<"LAD" | "LCX" | "RCA", number>;
    afib_probability: number;
    confidence: string;
  };
  demonstration_complete: boolean;
}

export const iitMandiApi = {
  scenarios: () => request<{ scenarios: IitMandiScenario[]; total: number }>("/scenarios"),
  demonstration: (scenarioId: string) =>
    request<IitMandiDemonstration>("/demonstration", {
      method: "POST",
      body: JSON.stringify({ scenario_id: scenarioId, include_ehr: true, include_ecg: true, include_wearable: true }),
    }),
  evaluation: () => request<{ cardiotwin_model: Record<string, unknown>; multimodal_capabilities: Record<string, string>; visualization_capabilities: Record<string, string> }>("/evaluation"),
};

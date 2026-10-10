import type { HemoAxisKey, HemoClassification, HemoEvidence, HemoResult } from "../hemoTypes";

export type AtlasModalityId = "ecg" | "imaging" | "labs" | "symptoms" | "wearables" | "fhir" | "environment" | "interventions" | "clinical_text" | "voice";
export interface AtlasObservation { kind: string; value: number | string | null; unit?: string | null }
export interface AtlasModalityInput {
  id: string; modality: AtlasModalityId; event_at: string; available_at: string;
  provider_mode: "REAL" | "SYNTHETIC" | "DEMO" | "UNAVAILABLE";
  status: "AVAILABLE" | "PROCESSING" | "UNAVAILABLE" | "FAILED";
  provider?: string; version?: string; evidence_refs?: string[]; text?: string;
  observations?: AtlasObservation[];
  waveform?: { samples: number[]; sampling_rate_hz: number; lead: string };
  media?: { kind: "image" | "video" | "metadata"; filename: string; mime_type?: string; description?: string };
  uncertainties?: string[];
}
export interface AtlasInput {
  as_of: string; patient_ref?: string; evidence?: HemoEvidence[]; bundle?: Record<string, unknown>;
  modalities?: AtlasModalityInput[]; spatial?: Record<string, unknown>; demo?: boolean; received_at?: string;
}
export interface AtlasGraphNode {
  id: string; type: string; label: string; classification: HemoClassification;
  modality: string; confidence?: string; source_ref?: string; event_at?: string;
  available_at?: string; transformation?: string; provenance?: Record<string, unknown>;
  review_status?: string; evidence_refs?: string[]; dependencies?: string[];
  value?: unknown; unit?: string | null; source_record?: unknown; uncertainties?: string[];
  axis?: HemoAxisKey;
}
export interface AtlasGraphEdge { id?: string; source: string; target: string; relationship?: string; label?: string }
export interface AtlasModality {
  id: string; label: string; status: string; provider_mode: string; provider: string;
  version: string; evidence_refs: string[]; uncertainties: string[];
  waveform?: AtlasModalityInput["waveform"]; media?: AtlasModalityInput["media"];
  text?: string; observations?: AtlasObservation[];
  sources?: (AtlasModalityInput & { review_status?: string; transformation?: string })[];
}
export interface AtlasSpatial {
  location?: Record<string, unknown> | null;
  events: Record<string, unknown>[];
  facilities: Record<string, unknown>[];
  environment: Record<string, unknown>[];
  context_only: true; synthetic: boolean;
  [key: string]: unknown;
}
export interface AtlasDimension {
  axis: HemoAxisKey; label?: string; state?: string; confidence?: string;
  trend?: string; evidence_count?: number; last_updated?: string | null;
  uncertainties?: string[]; review_status?: string;
}
export interface AtlasSensitivity {
  modality: string; original_stage: string; withheld_stage: string; original_confidence: string;
  withheld_confidence: string; evidence_refs: string[];
  changed_axes: { axis: string; with_all_evidence: string; with_modality_withheld: string }[];
  [key: string]: unknown;
}
export interface AtlasResult {
  as_of: string; twin: HemoResult;
  evidence_graph: { nodes: AtlasGraphNode[]; edges: AtlasGraphEdge[] };
  modalities: AtlasModality[]; spatial: AtlasSpatial;
  dimensions?: AtlasDimension[];
  system_twin?: { groups: { id: string; label: string; axes: HemoAxisKey[]; evidence_refs: string[] }[]; notice: string; relationships: {source:string;target:string;relationship:string}[] }; sensitivity?: AtlasSensitivity[];
  review: { status: string; clinical_approval: false; [key: string]: unknown };
  processing?: Record<string, unknown>[] | Record<string, unknown>;
  demo?: { label?: string; start_at?: string; end_at?: string; replay_dates?: string[]; guide?: string[] };
  [key: string]: unknown;
}
export interface AtlasScenarioResult {
  current: AtlasResult; simulated: AtlasResult; scenario_status?: string; safety_notice?: string;
  [key: string]: unknown;
}
export interface AtlasAnswer {
  answer: string; evidence_refs: string[]; provider?: string; mode?: string;
  [key: string]: unknown;
}

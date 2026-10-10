/** Research hemodynamic twin contract. Qualitative states are never raw measurements. */
export type HemoLevel = "LOW" | "NORMAL" | "ELEVATED" | "HIGH" | "UNKNOWN";
export type HemoClassification = "OBSERVED" | "DERIVED" | "INFERRED" | "UNKNOWN";
export type HemoConfidence = "LOW" | "MODERATE" | "HIGH";
export type HemoStage = "UNKNOWN" | "STABLE" | "MILD_SIGNAL" | "INCREASING_CONCERN" | "HIGH_CONCERN" | "INTERVENTION" | "IMPROVING" | "PERSISTENT_INSTABILITY";
export const HEMO_AXES = [
  ["pump_function", "Pump function"],
  ["volume_status", "Volume status"],
  ["filling_pressure_proxy", "Filling pressure proxy"],
  ["rhythm_stability", "Rhythm stability"],
  ["vascular_load", "Vascular load"],
  ["renal_interaction", "Renal interaction"],
  ["respiratory_interaction", "Respiratory interaction"],
  ["functional_capacity", "Functional capacity"],
] as const;
export type HemoAxisKey = typeof HEMO_AXES[number][0];
export interface HemoAxis {
  level: HemoLevel;
  classification: HemoClassification;
  confidence: HemoConfidence;
  evidence_refs: string[];
  explanation: string;
  uncertainties: string[];
}
export interface HemoCongestion {
  stage: HemoStage;
  confidence: HemoConfidence;
  evidence_refs: string[];
  explanation: string;
}
export type HemoSnapshot = Record<HemoAxisKey, HemoAxis> & {
  timestamp: string;
  confidence: HemoConfidence;
  evidence_refs: string[];
  uncertainties: string[];
  congestion: HemoCongestion;
  confidence_details?: { known_axes: number; total_axes: number; congestion_modalities: string[]; conflicting_kinds: string[]; unknown_axes: string[]; meaning: string };
};
export interface HemoEvidence {
  id: string;
  patient_ref: string;
  kind: string;
  value: unknown;
  unit?: string | null;
  event_at: string;
  available_at: string;
  source_ref: string;
  original_record: unknown;
  provenance: Record<string, unknown>;
  classification: HemoClassification;
}
export interface HemoTransition {
  id: string;
  timestamp: string;
  axis: HemoAxisKey | "congestion" | string;
  from_level: string;
  to_level: string;
  evidence_refs: string[];
  explanation: string;
  confidence: HemoConfidence;
  review_required: true;
}
export interface HemoDerivedMeasure {
  id: string;
  kind: string;
  classification: "DERIVED";
  value: number;
  unit: string | null;
  percent_change: number | null;
  timestamp: string;
  evidence_refs: string[];
  transformation: string;
  baseline: number;
  latest: number;
  window_days: number;
}
export interface HemoInterventionChange {
  kind: string;
  before: unknown;
  after: unknown;
  unit: string | null;
  delta: number | null;
  classification: HemoClassification;
  before_at: string;
  after_at: string;
  evidence_refs: string[];
  transformation: string;
  uncertainties?: string[];
}
export interface HemoInterventionResponse {
  intervention_ref: string;
  timestamp: string;
  label: string;
  changes: HemoInterventionChange[];
  evidence_refs: string[];
  interpretation: string;
  status: string;
  review_required: true;
}
export interface HemoResult {
  engine_version: string;
  as_of: string;
  patient_ref: string;
  safety_notice: string;
  research_label: string;
  review: { status: string; clinical_approval: false };
  snapshot: HemoSnapshot;
  timeline: HemoSnapshot[];
  transitions: HemoTransition[];
  evidence: HemoEvidence[];
  issues: (string | Record<string, unknown>)[];
  derived_measures: HemoDerivedMeasure[];
  intervention_responses: HemoInterventionResponse[];
  evidence_sensitivity?: { modality: string; withheld_kinds: string[]; evidence_refs: string[]; changed_axes: { axis: string; with_all_evidence: string; with_modality_withheld: string }[]; original_stage: string; withheld_stage: string; original_confidence: HemoConfidence; withheld_confidence: HemoConfidence; stage_changed: boolean; classification: "DERIVED"; review_required: true }[];
  knowledge_frontier?: { id: string; kind: string; event_at: string; available_at: string; delay_hours: number; evidence_refs: string[]; changes_at_release: { axis: string; from_level: string; to_level: string }[]; classification: "DERIVED"; explanation: string }[];
  sensitivity_notice?: string;
  rules?: Record<string, unknown>;
  demo?: { label: string; start_at: string; end_at: string; replay_dates: string[]; guide: string[] };
}
export interface HemoReconstructInput {
  patient_ref: string;
  evidence: HemoEvidence[];
  as_of: string;
}
export interface HemoFhirInput {
  bundle: Record<string, unknown>;
  patient_ref?: string;
  as_of: string;
  received_at?: string;
}

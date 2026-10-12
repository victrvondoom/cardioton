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

// =============================================================================
// Evidence Continuity Engine Types
// =============================================================================

export interface EvidenceNode {
  id: string;
  cardiac_case_id: string;
  node_type: string;
  entity_type: string;
  entity_id: string;
  data: Record<string, unknown>;
  summary: string;
  observation_time: string;
  source: string;
  confidence: number;
  quality_score: number;
  provenance: string;
  clinical_relevance: number;
  version: string;
  created_at: string;
  updated_at: string;
}

export interface EvidenceEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship: string;
  consistency_status: string | null;
  confidence: number;
  created_at: string;
}

export interface EvidenceGraph {
  id: string;
  cardiac_case_id: string;
  name: string;
  description: string;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  created_at: string;
  updated_at: string;
  version: string;
}

export interface EvidenceValidationResult {
  cardiac_case_id: string;
  is_valid: boolean;
  issues: Array<{
    type: string;
    severity: string;
    message: string;
    node_id?: string;
    edge_id?: string;
    details: Record<string, unknown>;
  }>;
  consistency_score: number;
  statistics: Record<string, unknown>;
}

export interface TemporalAlignmentIssue {
  type: string;
  severity: string;
  description: string;
  node_ids: string[];
  time_differences: Record<string, number>;
  suggested_resolution: string;
}

export interface CrossModalityContradiction {
  type: string;
  severity: string;
  description: string;
  node_ids: string[];
  modalities: string[];
  conflicting_values: Record<string, unknown>;
  suggested_resolution: string;
}

export interface ProvenanceChain {
  evidence_id: string;
  chain: Array<{
    step: number;
    description: string;
    timestamp: string;
    source: string;
    transformation: string;
    metadata: Record<string, unknown>;
  }>;
  is_complete: boolean;
  gaps: string[];
}

// =============================================================================
// Clinical Extraction Types
// =============================================================================

export interface ClinicalExtractionResult {
  patient_id: string;
  case_id?: string;
  extraction_timestamp: string;
  text: string;
  findings: {
    ecg_findings: Array<{
      finding: string;
      severity: string;
      confidence: number;
      location: string;
      timestamp?: string;
    }>;
    echo_findings: Array<{
      finding: string;
      severity: string;
      confidence: number;
      measurement?: Record<string, number>;
      view: string;
    }>;
    cardiac_symptoms: Array<{
      symptom: string;
      severity: string;
      duration: string;
      onset: string;
      confidence: number;
    }>;
    cardiac_categories: Array<{
      category: string;
      confidence: number;
      findings: string[];
    }>;
    icd10_codes: string[];
    urgent_conditions: Array<{
      condition: string;
      confidence: number;
      icd10: string;
      recommendation: string;
    }>;
  };
  structured_data: Record<string, unknown>;
  quality_score: number;
  warnings: string[];
  processing_time_ms: number;
}

// =============================================================================
// Workflow Orchestration Types
// =============================================================================

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  workflow_type: string;
  stages: Array<{
    id: string;
    name: string;
    description: string;
    order: number;
    required: boolean;
    dependencies: string[];
    agent: string;
    tool: string;
    input_schema: Record<string, unknown>;
    output_schema: Record<string, unknown>;
  }>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstance {
  id: string;
  definition_id: string;
  cardiac_case_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled' | 'awaiting_review';
  current_stage: string;
  progress: number;
  started_at: string;
  completed_at?: string;
  error?: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  events: Array<{
    id: string;
    type: string;
    timestamp: string;
    stage: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    metadata: Record<string, unknown>;
  }>;
}

export interface WorkflowEvent {
  workflow_id: string;
  type: string;
  timestamp: string;
  stage?: string;
  message: string;
  severity?: 'info' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Vector Search / Case Similarity Types
// =============================================================================

export interface SimilarCase {
  case_id: string;
  similarity_score: number;
  patient_id: string;
  demographics: {
    age: number;
    sex: string;
    ethnicity?: string;
  };
  clinical_summary: string;
  findings: string[];
  modalities: string[];
  tags: string[];
  source: string;
  matching_features: Array<{
    feature: string;
    similarity: number;
  }>;
}

export interface CaseSearchRequest {
  query_case_id?: string;
  query_text?: string;
  query_features?: Record<string, number>;
  modality?: string;
  limit?: number;
  threshold?: number;
}

export interface CaseSearchResult {
  query_id: string;
  results: SimilarCase[];
  search_time_ms: number;
  total_results: number;
  threshold_used: number;
}

// =============================================================================
// Imaging Embedding Types
// =============================================================================

export interface ImagingEmbeddingRequest {
  patient_id: string;
  study_id?: string;
  file: File | string; // File object or base64 string
  file_name: string;
  file_type: 'nifti' | 'dicom' | 'nrrd' | 'nii';
  study_date?: string;
  metadata?: Record<string, unknown>;
}

export interface ImagingEmbeddingResult {
  id: string;
  patient_id: string;
  study_id: string;
  file_name: string;
  file_type: string;
  embedding: number[];
  embedding_dim: number;
  processing_time_ms: number;
  metadata: Record<string, unknown>;
  quality_score: number;
  warnings: string[];
  created_at: string;
}

export interface ImagingStudyUpload {
  patient_id: string;
  study_instance_uid: string;
  study_description: string;
  modality: string;
  series: Array<{
    series_instance_uid: string;
    series_description: string;
    files: string[];
  }>;
  metadata: Record<string, unknown>;
}

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

  // =============================================================================
  // Evidence Continuity Engine API
  // =============================================================================

  // Evidence Graph Management
  listEvidenceNodes: (cardiacCaseId: string) =>
    request<{ nodes: EvidenceNode[] }>(`/evidence-continuity/nodes?cardiac_case_id=${cardiacCaseId}`),

  createEvidenceNode: (node: Omit<EvidenceNode, 'id' | 'created_at' | 'updated_at'>) =>
    post<EvidenceNode>("/evidence-continuity/nodes", node),

  getEvidenceNode: (nodeId: string) =>
    request<EvidenceNode>(`/evidence-continuity/nodes/${nodeId}`),

  updateEvidenceNode: (nodeId: string, updates: Partial<EvidenceNode>) =>
    request<EvidenceNode>(`/evidence-continuity/nodes/${nodeId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  deleteEvidenceNode: (nodeId: string) =>
    request<void>(`/evidence-continuity/nodes/${nodeId}`, { method: "DELETE" }),

  listEvidenceEdges: (cardiacCaseId: string) =>
    request<{ edges: EvidenceEdge[] }>(`/evidence-continuity/edges?cardiac_case_id=${cardiacCaseId}`),

  createEvidenceEdge: (edge: Omit<EvidenceEdge, 'id' | 'created_at'>) =>
    post<EvidenceEdge>("/evidence-continuity/edges", edge),

  getEvidenceEdge: (edgeId: string) =>
    request<EvidenceEdge>(`/evidence-continuity/edges/${edgeId}`),

  deleteEvidenceEdge: (edgeId: string) =>
    request<void>(`/evidence-continuity/edges/${edgeId}`, { method: "DELETE" }),

  getEvidenceGraph: (cardiacCaseId: string) =>
    request<EvidenceGraph>(`/evidence-continuity/graph?cardiac_case_id=${cardiacCaseId}`),

  // Validation Endpoints
  validateEvidence: (cardiacCaseId: string, validationType?: string) =>
    post<EvidenceValidationResult>("/evidence-continuity/validate", {
      cardiac_case_id: cardiacCaseId,
      validation_type: validationType ?? "full",
    }),

  validateTemporalAlignment: (cardiacCaseId: string) =>
    post<{
      cardiac_case_id: string;
      is_consistent: boolean;
      issues: TemporalAlignmentIssue[];
      consistency_score: number;
      statistics: Record<string, unknown>;
    }>("/evidence-continuity/temporal/align", { cardiac_case_id: cardiacCaseId }),

  detectContradictions: (cardiacCaseId: string) =>
    post<{
      cardiac_case_id: string;
      is_consistent: boolean;
      contradictions: CrossModalityContradiction[];
      consistency_score: number;
      statistics: Record<string, unknown>;
    }>("/evidence-continuity/contradictions/detect", { cardiac_case_id: cardiacCaseId }),

  checkConstraints: (cardiacCaseId: string, constraints?: Record<string, unknown>) =>
    post<EvidenceValidationResult>("/evidence-continuity/constraints/check", {
      cardiac_case_id: cardiacCaseId,
      constraints: constraints ?? {},
    }),

  // Provenance Tracking
  getProvenance: (evidenceId: string, cardiacCaseId: string) =>
    post<{
      cardiac_case_id: string;
      evidence_id: string;
      chain: ProvenanceChain | null;
      is_valid: boolean;
      validation_notes: string[];
    }>("/evidence-continuity/provenance", { evidence_id: evidenceId, cardiac_case_id: cardiacCaseId }),

  // Digital Twin Synchronization
  validateDigitalTwinSync: (cardiacCaseId: string) =>
    post<{
      cardiac_case_id: string;
      is_synced: boolean;
      inconsistencies: Array<{
        type: string;
        severity: string;
        description: string;
        twin_version: string;
        evidence_version: string;
        resolution: string;
      }>;
      sync_score: number;
      recommendations: string[];
    }>("/evidence-continuity/digital-twin/sync", { cardiac_case_id: cardiacCaseId }),

  // Inconsistency Detection
  detectInconsistencies: (cardiacCaseId: string) =>
    post<{
      cardiac_case_id: string;
      inconsistencies: Array<{
        id: string;
        type: string;
        severity: string;
        description: string;
        involved_nodes: string[];
        involved_edges: string[];
        evidence_type: string;
        suggested_resolution: string;
        confidence: number;
      }>;
      detection_timestamp: string;
      stats: Record<string, unknown>;
    }>("/evidence-continuity/inconsistencies/detect", { cardiac_case_id: cardiacCaseId }),

  // Confidence Scoring
  computeConfidenceScore: (cardiacCaseId: string, method?: string, weights?: Record<string, number>) =>
    post<{
      cardiac_case_id: string;
      confidence_score: number;
      method: string;
      components: Record<string, number>;
      interpretation: string;
      recommendations: string[];
    }>("/evidence-continuity/confidence", {
      cardiac_case_id: cardiacCaseId,
      method: method ?? "composite",
      weights: weights ?? {},
    }),

  // =============================================================================
  // Clinical Extraction API
  // =============================================================================

  extractClinicalText: (text: string, patientId?: string, caseId?: string) =>
    post<ClinicalExtractionResult>("/clinical-extraction/extract", {
      text,
      patient_id: patientId,
      case_id: caseId,
    }),

  batchExtractClinical: (requests: Array<{ text: string; patient_id?: string; case_id?: string }>) =>
    post<{ results: ClinicalExtractionResult[]; processing_time_ms: number }>(
      "/clinical-extraction/batch",
      { requests }
    ),

  getClinicalExtractionStatus: () =>
    request<{ status: string; version: string; last_processed: string; queue_size: number }>(
      "/clinical-extraction/status"
    ),

  // =============================================================================
  // Workflow Orchestration API
  // =============================================================================

  // Workflow Definitions
  listWorkflows: () => request<{ workflows: WorkflowDefinition[] }>("/workflows"),

  getWorkflow: (workflowId: string) =>
    request<WorkflowDefinition>(`/workflows/${workflowId}`),

  createWorkflow: (definition: Omit<WorkflowDefinition, 'id' | 'created_at' | 'updated_at'>) =>
    post<WorkflowDefinition>("/workflows", definition),

  // Workflow Instances
  listWorkflowInstances: (cardiacCaseId?: string, status?: string) =>
    request<{ instances: WorkflowInstance[] }>(
      `/workflows/instances${cardiacCaseId ? `?cardiac_case_id=${cardiacCaseId}` : ""}${status ? `&status=${status}` : ""}`
    ),

  getWorkflowInstance: (workflowId: string) =>
    request<WorkflowInstance>(`/workflows/instances/${workflowId}`),

  startWorkflow: (definitionId: string, cardiacCaseId: string, inputs?: Record<string, unknown>) =>
    post<WorkflowInstance>("/workflows/instances/start", {
      definition_id: definitionId,
      cardiac_case_id: cardiacCaseId,
      inputs: inputs ?? {},
    }),

  startCardiacCaseWorkflow: (cardiacCaseId: string, inputs?: Record<string, unknown>) =>
    post<WorkflowInstance>("/workflows/cardiac-case/start", {
      cardiac_case_id: cardiacCaseId,
      inputs: inputs ?? {},
    }),

  cancelWorkflow: (workflowId: string) =>
    post<WorkflowInstance>(`/workflows/instances/${workflowId}/cancel`, {}),

  // Events
  getWorkflowEvents: (workflowId: string) =>
    request<{ events: WorkflowEvent[] }>(`/workflows/instances/${workflowId}/events`),

  emitWorkflowEvent: (event: Omit<WorkflowEvent, 'timestamp'>) =>
    post<WorkflowEvent>("/workflows/events", event),

  // =============================================================================
  // Vector Search / Case Similarity API
  // =============================================================================

  searchSimilarCases: (request: CaseSearchRequest) =>
    post<CaseSearchResult>("/cases/search", request),

  getSimilarCasesForCase: (caseId: string, limit?: number) =>
    request<{ case_id: string; similar_cases: SimilarCase[] }>(
      `/cases/${caseId}/similar${limit ? `?limit=${limit}` : ""}`
    ),

  compareCases: (caseId1: string, caseId2: string) =>
    post<{
      case1: string;
      case2: string;
      similarity_score: number;
      common_features: Array<{ feature: string; similarity: number }>;
      differences: string[];
    }>(`/cases/compare`, { case1: caseId1, case2: caseId2 }),

  getCaseDetails: (caseId: string) =>
    request<{
      id: string;
      patient_id: string;
      demographics: Record<string, unknown>;
      clinical_summary: string;
      findings: string[];
      modalities: string[];
      studies: Array<Record<string, unknown>>;
      created_at: string;
      updated_at: string;
    }>(`/cases/${caseId}`),

  // =============================================================================
  // Imaging Embedding API
  // =============================================================================

  generateImagingEmbedding: (request: ImagingEmbeddingRequest) =>
    post<ImagingEmbeddingResult>("/imaging/embedding", request),

  uploadImagingStudy: (study: ImagingStudyUpload) =>
    post<{
      id: string;
      status: string;
      processing_status: string;
      embeddings_generated: number;
      warnings: string[];
    }>("/imaging/upload", study),

  getImagingStatus: () =>
    request<{ status: string; version: string; queue_size: number; processing_time_avg_ms: number }>(
      "/imaging/status"
    ),

  // =============================================================================
  // Health Checks
  // =============================================================================

  evidenceContinuityHealth: () =>
    request<{ status: string; version: string; last_checked: string }>(
      "/evidence-continuity/health"
    ),

  clinicalExtractionHealth: () =>
    request<{ status: string; version: string; last_checked: string }>(
      "/clinical-extraction/health"
    ),

  workflowHealth: () =>
    request<{ status: string; version: string; active_workflows: number; last_checked: string }>(
      "/workflows/health"
    ),

  imagingHealth: () =>
    request<{ status: string; version: string; queue_size: number; last_checked: string }>(
      "/imaging/health"
    ),

  caseSearchHealth: () =>
    request<{ status: string; version: string; index_status: string; last_checked: string }>(
      "/cases/health"
    ),
};

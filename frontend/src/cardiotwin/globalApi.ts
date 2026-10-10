/** Typed client for the existing global research endpoints. */
import { authHeader } from "../lib/auth";

const API_BASE = "/api/cardiotwin/global";

export interface SourceConfiguration {
  name?: string;
  source_name?: string;
  status: string;
  last_successful_refresh?: string | null;
  last_successful_refresh_at?: string | null;
  notes?: string;
  reason?: string;
}
export interface OverviewMetrics {
  indexed_research_records: number;
  evidence_sources_connected: number;
  clinical_trials_discovered: number;
  interventions_mapped: number;
  indications_represented: number;
  unresolved_mappings: number;
  awaiting_verification: number;
  open_safety_events: number | null;
  agent_tasks_running: number | null;
  last_updated_at: string | null;
  data_mode: string;
  source_configuration?: SourceConfiguration[];
  limitations?: string[];
  metric_definitions?: Record<string, string>;
}
export interface EvidenceFilters {
  query?: string;
  clinical_area?: string;
  modality?: string;
  task_category?: string;
  validation_grade?: string;
  intervention?: string;
  study_type?: string;
  date_from?: string;
  date_to?: string;
}
export interface EvidenceNode {
  id: string;
  label: string;
  category: string;
  count: number;
  description?: string;
}
export interface EvidenceEdge {
  source: string;
  target: string;
  value: number;
  flow_category: string;
  evidence_ids: string[];
  mapping_rationale?: string;
  verification_status?: string;
}
export interface EvidenceRecord {
  id: string;
  source_name: string;
  source_identifier: string;
  source_url: string;
  title: string;
  authors_or_sponsor: string;
  publication_or_start_date: string | null;
  clinical_area: string;
  modality: string;
  task_category: string;
  target_indication: string;
  intervention_or_device?: string | null;
  study_design: string;
  validation_grade?: string;
  sample_size?: number | null;
  reported_endpoints: string[];
  summary_findings: string;
  data_mode: string;
  record_type?: string;
  retrieved_at?: string;
  mapping_status?: string;
  human_verified?: boolean;
  provenance?: Record<string, unknown>;
  quality?: Record<string, unknown>;
  phase?: string | string[] | null;
  recruitment_status?: string | null;
  status?: string | null;
  enrollment?: number | null;
  primary_outcomes?: unknown[];
  dates?: Record<string, unknown>;
  trial_metadata?: Record<string, unknown>;
  mapping_rationale?: string[];
  history?: Array<{snapshot_hash: string; parent_hash: string | null; record: EvidenceRecord; field_changes?: Record<string, unknown>}>;
}
export type TrialRecord = EvidenceRecord;
export interface EvidenceMapResponse {
  graph: {
    nodes: EvidenceNode[];
    edges: EvidenceEdge[];
    total_records: number;
    data_mode: string;
    as_of: string | null;
    filter_summary: Record<string, string | null>;
    counting_rule?: string;
  };
  screening_stats: Record<string, unknown>;
  records: EvidenceRecord[];
  counting_rule?: string;
}
export interface PipelineItem {
  program: string;
  indication: string;
  phase: string;
  sponsor: string;
  modality: string;
  evidence_count: number;
  validation_grade?: string;
  evidence_gap: string;
  last_milestone?: string;
  evidence_ids?: string[];
  data_mode?: string;
}
export interface SafetyAlert {
  id: string;
  source: string;
  event_type: string;
  target_intervention: string;
  summary: string;
  first_observed: string;
  last_observed: string;
  severity: string;
  status: string;
  source_url: string;
  data_mode: string;
}
export interface AgentInfo { role: string; status: string; active_tasks: number }
export interface TaskTrace {
  task_id: string;
  agent_role: string;
  step_description: string;
  timestamp: string;
  tool_invoked?: string | null;
  status?: string;
  input_snapshot?: Record<string, unknown> | null;
  output_snapshot?: Record<string, unknown> | null;
}
export interface ResearchTask {
  task_id: string;
  task_type: string;
  agent_role: string;
  status: string;
  inputs: Record<string, unknown>;
  allowed_tools: string[];
  timeout_seconds: number;
  max_retries: number;
  retry_count: number;
  result_artifacts: unknown;
  error_message?: string | null;
  error?: unknown;
  started_at?: string | null;
  completed_at?: string | null;
  authorization_context?: Record<string, unknown>;
  trace_logs?: TaskTrace[];
}
export interface AgentMonitorResponse { agents: AgentInfo[]; tasks: ResearchTask[]; trace_logs: TaskTrace[] }
export interface EvidenceGap {
  id?: string;
  record_id?: string;
  category?: string;
  description?: string;
  reason?: string;
  next_action?: string;
  priority?: number | string;
  [key: string]: unknown;
}
export interface CopilotResponse {
  query: string;
  summary_response: string;
  factual_claims: string[];
  model_interpretations: string[];
  evidence_citations: Array<{ title: string; source_id: string; url: string; grade?: string }>;
  passport_hash: string;
  verified: boolean;
  timestamp: string;
  task_id: string;
  evidence_records: EvidenceRecord[];
  identified_gaps: (EvidenceGap | string)[];
  data_mode: string;
  limitations?: string[];
}
export interface PassportArtifact { passport_hash: string; payload: Record<string, unknown> }
export interface PassportVerification {
  passport_hash: string;
  status: string;
  integrity_check: string;
  tamper_detected: boolean | null;
  verified: boolean;
  verified_at: string;
  notes: string;
}
function queryString(params?: EvidenceFilters & { phase?: string; indication?: string; limit?: number; offset?: number }): string {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.size ? `?${query}` : "";
}
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeader(), ...options.headers },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sign in to run research tasks and access your task traces or passports.");
    if (response.status === 403) throw new Error("Your account does not have permission to access this research artifact.");
    throw new Error(`Research API request failed (HTTP ${response.status}). Try refreshing or check the backend connection.`);
  }
  return response.json() as Promise<T>;
}
export const globalApi = {
  getOverview: (signal?: AbortSignal) => apiFetch<OverviewMetrics>("/overview", { signal }),
  getEvidenceMap: (params?: EvidenceFilters, signal?: AbortSignal) => apiFetch<EvidenceMapResponse>(`/evidence-map${queryString(params)}`, { signal }),
  getRecords: (params?: EvidenceFilters, signal?: AbortSignal) => apiFetch<{ records: EvidenceRecord[]; total: number; data_mode: string }>(`/records${queryString({ ...params, limit: 500 })}`, { signal }),
  getRecord: async (id: string, signal?: AbortSignal) => {
    const detail = await apiFetch<{record: EvidenceRecord; history: EvidenceRecord["history"]}>(`/records/${encodeURIComponent(id)}`, { signal });
    return {...detail.record, ...detail.record.trial_metadata, history: detail.history} as EvidenceRecord;
  },
  reviewMapping: (id: string, payload: {decision: "approve" | "reject"; expected_snapshot_hash: string; rationale: string}, signal?: AbortSignal) => apiFetch<Record<string, unknown>>(`/records/${encodeURIComponent(id)}/mapping-review`, {method: "POST", body: JSON.stringify(payload), signal}),
  exportRecords: (params?: EvidenceFilters, signal?: AbortSignal) => apiFetch<Record<string, unknown>>(`/records/export${queryString(params)}`, { signal }),
  askCopilot: (query: string, signal?: AbortSignal, idempotencyKey?: string) => apiFetch<CopilotResponse>("/copilot", {
    method: "POST", body: JSON.stringify({ query, idempotency_key: idempotencyKey }), signal,
  }),
  getTrials: (params?: { query?: string; phase?: string; indication?: string }, signal?: AbortSignal) => apiFetch<TrialRecord[]>(`/trials${queryString(params)}`, { signal }),
  getPipeline: (signal?: AbortSignal) => apiFetch<PipelineItem[]>("/pipeline", { signal }),
  getSafety: (signal?: AbortSignal) => apiFetch<SafetyAlert[]>("/safety", { signal }),
  getAgents: (signal?: AbortSignal) => apiFetch<AgentMonitorResponse>("/agents", { signal }),
  getTask: (id: string, signal?: AbortSignal) => apiFetch<ResearchTask>(`/tasks/${encodeURIComponent(id)}`, { signal }),
  getPassport: (hash: string, signal?: AbortSignal) => apiFetch<PassportArtifact>(`/passport/${encodeURIComponent(hash)}`, { signal }),
  verifyPassport: (hash: string, signal?: AbortSignal) => apiFetch<PassportVerification>(`/passport/verify?hash=${encodeURIComponent(hash)}`, { signal }),
  verifySuppliedPassport: (artifact: PassportArtifact, signal?: AbortSignal) => apiFetch<PassportVerification>("/passport/verify", {
    method: "POST", body: JSON.stringify(artifact), signal,
  }),
};

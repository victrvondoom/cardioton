// Typed API client. Vite proxies /api to localhost:8000 in dev.
// Auto-attaches the JWT from localStorage; 401 → clear storage + redirect to /login.
import { authHeader, clearAuth } from "./core__src_lib__auth";
import { readFetch } from "./readFetch";
import { isCaseStorageRead, requireCaseStorage } from "./serviceHealth";
import type {
  AgentRun,
  CaseComparison,
  CaseTwin,
  CohortReport,
  PolicyCatalog,
  PolicyDetail,
  ReviewQueueReport,
  DemoFixture,
  RunResult,
} from "./core__src_lib__types";

const BASE = "/api/v1";

// Backend deployed without RDS returns a fail-soft synthetic verdict whose
// shape predates the strict TypeScript contract. Normalize to canonical RunResult.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeRunResult(raw: any): RunResult {
  const looseSnap = raw?.clinical_snapshot;
  const looseDecision = raw?.decision;
  const looseExcerpts = raw?.policy_excerpts ?? [];
  const looseNecessity = raw?.necessity_assessment;

  let snapshot = raw?.clinical_snapshot;
  if (looseSnap && !looseSnap.primary_diagnosis) {
    const icd = Array.isArray(looseSnap.icd10_codes) ? String(looseSnap.icd10_codes[0] ?? "—") : "—";
    snapshot = {
      patient_age: looseSnap.patient_age ?? null,
      patient_sex: looseSnap.patient_sex ?? null,
      primary_diagnosis: {
        icd10_code: icd,
        description: "(diagnosis from ICD-10)",
        stage: typeof looseSnap.stage === "string" ? looseSnap.stage : null,
        onset_date: null,
        source_resource_id: looseSnap.source_resource_id ?? "",
      },
      additional_diagnoses: [],
      prior_therapies: looseSnap.prior_treatments ?? [],
      biomarkers: looseSnap.biomarkers ?? [],
      comorbidities: looseSnap.comorbidities ?? [],
      performance_status: looseSnap.ecog_performance_status != null
        ? String(looseSnap.ecog_performance_status)
        : null,
      requested_treatment: {
        name: looseSnap.requested_treatment?.name ?? raw.requested_treatment ?? "Not supplied",
        hcpcs_code: null,
        j_code: looseSnap.requested_treatment?.j_code ?? null,
        dose: null,
        frequency: null,
        intent: null,
      },
      free_text_summary: looseSnap.free_text_summary ?? "No clinical summary supplied by the service.",
    };
  }

  let decision = raw?.decision;
  if (looseDecision) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const citations = ((looseDecision.citations as any[]) ?? []).map((c) => ({
      kind: c.kind ?? "policy",
      text: c.text ?? c.quote ?? "",
      pointer: c.pointer ?? `${c.source ?? ""} p.${c.page ?? "?"}`.trim(),
    }));
    decision = {
      verdict: looseDecision.verdict,
      rationale: looseDecision.rationale ?? looseDecision.rationale_summary ?? "",
      citations,
      confidence: looseDecision.confidence ?? 0,
      risk_flags: looseDecision.risk_flags ?? [],
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policy_excerpts = (looseExcerpts as any[]).map((e) => ({
    payer_id: e.payer_id ?? "Not supplied",
    policy_id: e.policy_id ?? "—",
    policy_title: e.policy_title ?? `Policy ${e.policy_id ?? ""}`,
    section_heading: e.section ?? e.section_heading ?? "",
    excerpt_text: e.text ?? e.excerpt_text ?? "",
    source_url: e.source_url ?? null,
    page_number: e.page ?? e.page_number ?? null,
    relevance_score: e.score ?? e.relevance_score ?? 0,
  }));

  let necessity_assessment = raw?.necessity_assessment;
  if (looseNecessity && !looseNecessity.criteria) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evaluated = (looseNecessity.criteria_evaluated as any[]) ?? [];
    necessity_assessment = {
      criteria: evaluated.map((c) => ({
        criterion_text: c.criterion ?? c.criterion_text ?? "",
        criterion_type: c.criterion_type ?? "inclusion",
        policy_excerpt_index: 0,
        status: c.met === true ? "MET" : c.met === false ? "NOT_MET" : "AMBIGUOUS",
        supporting_evidence: c.evidence ? [String(c.evidence)] : [],
        missing_evidence: null,
        confidence: c.confidence ?? 0,
        rationale: c.rationale ?? c.evidence ?? "",
      })),
      overall_confidence: looseNecessity.overall_confidence ?? 0,
      summary: looseNecessity.rationale ?? looseNecessity.summary ?? "",
    };
  }

  return {
    case_id: raw.case_id,
    clinical_snapshot: snapshot,
    policy_excerpts,
    necessity_assessment,
    decision,
    provisional_decision: raw.provisional_decision ?? null,
    human_review_required: raw.human_review_required,
    documents_draft: raw.documents_draft,
    pause_kind: raw.pause_kind,
    denial_forecast: raw.denial_forecast ?? null,
    appeal_draft: raw.appeal_draft ?? null,
    patient_communication: raw.patient_communication ?? null,
    paused_for_review: raw.paused_for_review,
    pause_reason: raw.pause_reason,
  };
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearAuth();
    if (window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const text = await res.text();
    let detail: unknown = null;
    try {
      detail = JSON.parse(text)?.detail;
    } catch {}
    const message = typeof detail === "string" ? detail : text || res.statusText;
    throw new Error(`HTTP ${res.status}: ${message}`);
  }
  return res.json();
}

async function authedFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = {
    ...(init?.headers as Record<string, string> | undefined),
    ...authHeader(),
  };
  if ((init?.method ?? "GET").toUpperCase() === "GET" && isCaseStorageRead(input)) await requireCaseStorage(headers);
  return readFetch(input, { ...init, headers });
}

/** Response of POST /cases/{id}/run-async. */
export interface CaseJobRef {
  job_id: string;
  case_id: string;
  status: string;
  idempotency_key: string;
  created_at: string;
  poll_url: string;
  stream_url: string;
}

/** Response of GET /jobs/{job_id}. */
export interface CaseJobStatus {
  job_id: string;
  case_id: string;
  job_type: string;
  status: "queued" | "running" | "done" | "error" | string;
  attempts: number;
  max_attempts: number;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  /** Null until a worker claims it — see api.getJob(). */
  claimed_at: string | null;
  finished_at: string | null;
}

export interface AgentsManifest {
  agents?: Array<{ name: string; display_name?: string; description?: string; sub_agents?: unknown[] }>;
  [k: string]: unknown;
}

export interface CaseListItem {
  case_id: string;
  payer_id: string;
  patient_initials: string;
  status: string;
  treatment: string;
  j_code: string | null;
  verdict: "APPROVE" | "DENY" | "REFER" | null;
  confidence: number | null;
  created_at: string | null;
}

export const api = {
  async listFixtures(): Promise<DemoFixture[]> {
    const res = await readFetch(`${BASE}/demo-fixtures`);
    const data = await jsonOrThrow<{ fixtures: DemoFixture[] }>(res);
    return data.fixtures;
  },

  async createFromFixture(name: string): Promise<{ case_id: string; fixture: DemoFixture }> {
    const res = await authedFetch(`${BASE}/demo-fixtures/${name}/create-case`, {
      method: "POST",
    });
    return jsonOrThrow(res);
  },

  async listCases(params: {
    limit?: number;
    status?: string;
    payer_id?: string;
    search?: string;
  } = {}): Promise<{ cases: CaseListItem[]; total: number }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.status) qs.set("status", params.status);
    if (params.payer_id) qs.set("payer_id", params.payer_id);
    if (params.search) qs.set("search", params.search);
    const url = qs.toString() ? `${BASE}/cases?${qs}` : `${BASE}/cases`;
    const res = await authedFetch(url);
    return jsonOrThrow(res);
  },

  async getCase(caseId: string): Promise<{
    case_id: string;
    payer_id: string;
    patient_initials: string;
    status: string;
    physician_note: string | null;
    requested_treatment: { name: string; j_code: string | null };
    created_at: string | null;
    pending_review?: RunResult | null;
    latest_result?: RunResult | null;
    continuation?: { status: string; can_retry: boolean } | null;
  }> {
    const res = await authedFetch(`${BASE}/cases/${caseId}`);
    return jsonOrThrow(res);
  },

  async runFull(caseId: string): Promise<RunResult> {
    const res = await authedFetch(`${BASE}/cases/${caseId}/run`, { method: "POST" });
    const raw = await jsonOrThrow<RunResult & Record<string, unknown>>(res);
    return normalizeRunResult(raw);
  },
  /**
   * Enqueue the full 7-agent DAG and return immediately.
   *
   * The backend keys the job on an idempotency hash, so calling this twice for
   * the same case returns the *same* job_id rather than starting a second run
   * (202 = newly enqueued, 200 = idempotent replay). That makes it safe to
   * retry on a flaky network and safe to double-click.
   */
  async runAsync(caseId: string): Promise<CaseJobRef> {
    const res = await authedFetch(`${BASE}/cases/${caseId}/run-async`, { method: "POST" });
    return jsonOrThrow(res);
  },

  /**
   * Poll a queued job. `claimed_at` is the signal that a worker process has
   * actually picked the job up — a job that stays unclaimed means no
   * `app.workers.case_runner` is running, which the pipeline console uses to
   * decide whether to fall back to the synchronous run endpoint.
   */
  async getJob(jobId: string): Promise<CaseJobStatus> {
    const res = await authedFetch(`${BASE}/jobs/${jobId}`);
    return jsonOrThrow(res);
  },

  /** The canonical 7-agent / 21-sub-agent manifest, used to lay out the DAG. */
  async getAgentsManifest(): Promise<AgentsManifest> {
    const res = await authedFetch(`${BASE}/agents/manifest`);
    return jsonOrThrow(res);
  },


  async submitReview(
    caseId: string,
    body: {
      action: "approve" | "override_to_approve" | "override_to_deny" | "escalate" | "add_note";
      note?: string;
    },
  ): Promise<{
    case_id: string;
    action: string;
    old_status: string;
    new_status: string;
  }> {
    const res = await authedFetch(`${BASE}/cases/${caseId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return jsonOrThrow(res);
  },

  /**
   * Resume a HITL-paused case with a reviewer's verdict. Backed by the
   * LangGraph review_gate node which routes the DAG here when Necessity
   * Reasoner overall_confidence drops below HITL_CONFIDENCE_THRESHOLD.
   * Per CMS-0057-F § IV.C and CA SB 1120, adverse determinations require
   * human clinician sign-off — this is the endpoint they sign off on.
   */
  async resumeCase(
    caseId: string,
    body: { verdict: "APPROVE" | "DENY" | "REFER"; reviewer_note?: string; continuation_mode?: "inline" | "worker" },
  ): Promise<{
    case_id: string;
    verdict: string;
    status: string;
    reviewer_id: string;
    result?: RunResult | null;
    continuation?: { mode: string; completed: boolean; error: string | null; queued: boolean };
  }> {
    const res = await authedFetch(`${BASE}/cases/${caseId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return jsonOrThrow(res);
  },

  async retryCaseLetters(caseId: string): Promise<{ status: string }> {
    const res = await authedFetch(`${BASE}/cases/${caseId}/resume/retry?continuation_mode=inline`, { method: "POST" });
    return jsonOrThrow(res);
  },

  async getAudit(caseId: string): Promise<{ case_id: string; agent_runs: AgentRun[] }> {
    const res = await authedFetch(`${BASE}/cases/${caseId}/audit`);
    return jsonOrThrow(res);
  },

  // ---- Admin: user management ----
  async listOrgUsers(): Promise<{
    users: {
      id: string; email: string; full_name: string | null; role: string;
      created_at: string | null; last_login_at: string | null;
    }[];
  }> {
    const res = await authedFetch(`${BASE}/auth/users`);
    return jsonOrThrow(res);
  },

  async createOrgUser(req: {
    email: string; password: string; full_name: string;
    role: "coordinator" | "reviewer" | "admin";
  }): Promise<{ id: string; email: string; full_name: string; role: string }> {
    const res = await authedFetch(`${BASE}/auth/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return jsonOrThrow(res);
  },

  // ---- Eval harness: cohort accuracy vs. gold labels ----
  async getCohortEval(): Promise<EvalReport> {
    const res = await authedFetch(`${BASE}/eval/cohort`);
    return jsonOrThrow(res);
  },

  // ===========================================================================
  // Impact Pack — backend in app/{compliance,business_value,integrations}
  // Each block fronts one /api/v1/<area>/* surface; the UI components below
  // call these to render live business-value evidence (no mocks).
  // ===========================================================================

  // ---- CMS-0057-F + state-AI-law live scorecard ----
  async getCaseCompliance(caseId: string): Promise<CaseComplianceScorecard> {
    const res = await authedFetch(`${BASE}/compliance/case/${caseId}`);
    return jsonOrThrow(res);
  },
  async getOrgCompliance(): Promise<OrgComplianceScorecard> {
    const res = await authedFetch(`${BASE}/compliance/org`);
    return jsonOrThrow(res);
  },

  // ---- Business value calculator ----
  async getCaseValue(caseId: string): Promise<CaseROI> {
    const res = await authedFetch(`${BASE}/business-value/case/${caseId}`);
    return jsonOrThrow(res);
  },
  async getReviewQueue(limit = 50): Promise<ReviewQueueReport> {
    const res = await authedFetch(`${BASE}/reviewer/queue?limit=${limit}`);
    return jsonOrThrow(res);
  },
  async getPolicyCatalog(): Promise<PolicyCatalog> {
    const res = await authedFetch(`${BASE}/policy-catalog`);
    return jsonOrThrow(res);
  },
  async getPolicyDetail(policyId: string): Promise<PolicyDetail> {
    const res = await authedFetch(`${BASE}/policy-catalog/${encodeURIComponent(policyId)}`);
    return jsonOrThrow(res);
  },
  async getCaseComparison(caseId: string): Promise<CaseComparison> {
    const res = await authedFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/compare`);
    return jsonOrThrow(res);
  },
  async createComparisonCase(caseId: string, payerId: string): Promise<{ case_id: string; created: boolean; payer_id: string }> {
    const res = await authedFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/compare/${encodeURIComponent(payerId)}`, { method: "POST" });
    return jsonOrThrow(res);
  },
  async getCaseTwin(caseId: string): Promise<CaseTwin> {
    const res = await authedFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/twin`);
    return jsonOrThrow(res);
  },
  async getCohorts(days = 90): Promise<CohortReport> {
    const res = await authedFetch(`${BASE}/cohorts?days=${days}`);
    return jsonOrThrow(res);
  },
  async getOrgValue(): Promise<OrgValueRollup> {
    const res = await authedFetch(`${BASE}/business-value/org`);
    return jsonOrThrow(res);
  },
  async getStarImpact(params: {
    member_count?: number;
    current_star?: number;
  } = {}): Promise<StarImpactProjection> {
    const qs = new URLSearchParams();
    if (params.member_count !== undefined) qs.set("member_count", String(params.member_count));
    if (params.current_star !== undefined) qs.set("current_star", String(params.current_star));
    const url = qs.toString() ? `${BASE}/business-value/star-impact?${qs}` : `${BASE}/business-value/star-impact`;
    const res = await authedFetch(url);
    return jsonOrThrow(res);
  },
  async getProviderAbrasion(params: { days?: number; rendering_npi?: string } = {}): Promise<ProviderAbrasionScore> {
    const qs = new URLSearchParams();
    if (params.days !== undefined) qs.set("days", String(params.days));
    if (params.rendering_npi) qs.set("rendering_npi", params.rendering_npi);
    const url = qs.toString() ? `${BASE}/business-value/provider-abrasion?${qs}` : `${BASE}/business-value/provider-abrasion`;
    const res = await authedFetch(url);
    return jsonOrThrow(res);
  },

  // ---- TriZetto AI Gateway adapter ----
  async submitToTrizetto(req: {
    case_id: string;
    target?: "facets" | "qnxt" | "both";
    rendering_npi?: string;
  }): Promise<TrizettoSubmitResponse> {
    const res = await authedFetch(`${BASE}/integrations/trizetto/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "both", ...req }),
    });
    return jsonOrThrow(res);
  },
  async getTrizettoMockInbox(): Promise<TrizettoMockInbox> {
    const res = await authedFetch(`${BASE}/integrations/trizetto/_mock/inbox`);
    return jsonOrThrow(res);
  },
  async clearTrizettoMockInbox(): Promise<{ status: string }> {
    const res = await authedFetch(`${BASE}/integrations/trizetto/_mock/inbox`, { method: "DELETE" });
    return jsonOrThrow(res);
  },
  async getTrizettoInfo(): Promise<TrizettoInfo> {
    const res = await authedFetch(`${BASE}/integrations/trizetto/info`);
    return jsonOrThrow(res);
  },

  // ---- Kiro IDE spec exporter ----
  async exportKiroSpecs(): Promise<{ ok: boolean; summary: KiroExportSummary; next_step: string }> {
    const res = await authedFetch(`${BASE}/integrations/kiro/export`, { method: "POST" });
    return jsonOrThrow(res);
  },
  async getKiroSpec(parent: string, sub?: string): Promise<{ agent: string; files: Record<string, string> }> {
    const path = sub ? `${parent}/${sub}` : parent;
    const res = await authedFetch(`${BASE}/integrations/kiro/spec/${path}`);
    return jsonOrThrow(res);
  },

  // ---- Auditor-grade evidence pack (single-bundle export per case) ----
  async getEvidencePack(caseId: string): Promise<EvidencePack> {
    const res = await authedFetch(`${BASE}/cases/${caseId}/evidence-pack`);
    return jsonOrThrow(res);
  },

  // ---- Neuro / Agent Foundry compatibility ----
  async getFoundryManifest(): Promise<FoundryManifest> {
    const res = await authedFetch(`${BASE}/foundry/manifest`);
    return jsonOrThrow(res);
  },

  // ---- Responsible AI model card ----
  async getModelCard(): Promise<ResponsibleAIModelCard> {
    const res = await authedFetch(`${BASE}/responsible-ai/model-card`);
    return jsonOrThrow(res);
  },

  // ---- 5-layer enterprise architecture descriptor (live introspection) ----
  async getArchitectureLayers(): Promise<ArchitectureDescriptor> {
    const res = await authedFetch(`${BASE}/architecture/layers`);
    return jsonOrThrow(res);
  },
};

// =============================================================================
// Impact Pack — TypeScript shape mirrors of the backend dataclasses
// =============================================================================

export interface ClauseResult {
  clause_id: string;
  title: string;
  satisfied: boolean;
  severity: "info" | "warning" | "critical";
  evidence: string;
  in_force_today: boolean;
}

export interface CaseComplianceScorecard {
  case_id: string;
  organization_id: string;
  asof_iso: string;
  overall_satisfied: boolean;
  in_force_satisfied: boolean;
  n_clauses_total: number;
  n_clauses_in_force: number;
  n_satisfied: number;
  n_satisfied_in_force: number;
  clauses: ClauseResult[];
}

export interface OrgComplianceScorecard {
  db_unavailable?: boolean;
  organization_id: string;
  asof_iso: string;
  totals: {
    cases_total: number;
    cases_decided: number;
    denies: number;
    denies_with_review: number;
    audit_complete_cases: number;
  };
  headline_metrics: {
    tat_compliance_pct: number;
    sb1120_compliance_pct: number;
    audit_completeness_pct: number;
    mean_tat_seconds: number;
    max_tat_seconds: number;
  };
  clauses: {
    clause_id: string;
    title: string;
    summary: string;
    effective_date: string;
    in_force_today: boolean;
    days_until_effective: number;
  }[];
  deadlines: Record<string, { iso: string; days_until: number; passed?: boolean }>;
}

export interface CaseROI {
  case_id: string;
  organization_id: string;
  verdict: string | null;
  manual_cost_usd: number;
  clincase_cost_usd: number;
  savings_usd: number;
  minutes_saved: number;
  decision_seconds: number | null;
  speedup_factor: number | null;
  annual_extrapolation_usd: number | null;
  citations: string[];
  /** manual-PA baseline in minutes used for the savings / speed-up numbers */
  manual_minutes?: number;
  /** USD per 1M tokens by model family (same table the backend bills against) */
  token_pricing_usd_per_m?: Record<string, { in: number; out: number }>;
}

export interface OrgValueRollup {
  organization_id: string;
  asof_iso: string;
  cases_total: number;
  cases_decided: number;
  verdict_breakdown: Record<string, number>;
  direct_savings_mtd_usd: number;
  direct_savings_annual_projection_usd: number;
  avg_decision_seconds: number | null;
  avg_speedup_factor: number | null;
  citations: string[];
  /** cases created per UTC day, last 7 days, oldest first */
  daily_cases_7d?: number[];
  /** % change in mean time-to-decision vs previous calendar month (negative = faster) */
  avg_decision_change_pct?: number | null;
  /** baselines the savings / speed-up maths use */
  assumptions?: { manual_pa_cost_usd: number; manual_pa_minutes: number };
  db_unavailable?: boolean;
}

export interface StarImpactProjection {
  case_activity_90d?: number | null;
  db_unavailable?: boolean;
  organization_id: string;
  member_count_assumed: number;
  current_star_assumption: number;
  projected_lift_low: number;
  projected_lift_high: number;
  revenue_lift_low_usd: number;
  revenue_lift_high_usd: number;
  notes: string[];
  citations: string[];
}

export interface ProviderAbrasionScore {
  rendering_npi: string | null;
  n_cases: number;
  n_denied: number;
  n_with_appeal: number;
  clincase_score: number;
  manual_baseline_score: number;
  abrasion_reduction_pct: number;
  minutes_returned_to_practice: number;
  estimated_turnover_risk_basis_points_reduction: number;
  citations: string[];
}

export interface TrizettoSubmitResponse {
  accepted: boolean;
  gateway_id: string | null;
  fanout_targets: string[];
  received_at: string;
  is_mock: boolean;
  facets_event: Record<string, unknown> | null;
  qnxt_event: Record<string, unknown> | null;
  case_id: string;
}

export interface TrizettoMockInboxItem {
  gateway_id: string;
  received_at: string;
  envelope: Record<string, unknown>;
  fanout_targets: string[];
}

export interface TrizettoMockInbox {
  is_mock: boolean;
  count: number;
  items: TrizettoMockInboxItem[];
  note: string;
}

export interface TrizettoInfo {
  platform: string;
  launched: string;
  stack: Record<string, string>;
  fanout_targets_supported: string[];
  configured_url: string | null;
  running_in: "mock" | "real";
  why_this_exists: string;
  mock_inbox_size: number;
  issuer: string;
  asof_utc: string;
}

export interface KiroExportSummary {
  n_parents: number;
  n_sub_agents: number;
  files_written: number;
  kiro_root: string;
}

export interface EvidencePack {
  case_id: string;
  generated_at_iso: string;
  bundle_sha256: string;
  case: Record<string, unknown>;
  decision: Record<string, unknown> | null;
  appeal: Record<string, unknown> | null;
  agent_runs: AgentRun[];
  reviewer_actions: Record<string, unknown>[];
  compliance: CaseComplianceScorecard;
  business_value: CaseROI;
  trizetto_envelope: Record<string, unknown> | null;
  model_card_ref: string;
  foundry_manifest_ref: string;
  clincase_version: string;
}

export interface FoundryManifest {
  artifact_kind: string;
  schema_version: string;
  clincase_version: string;
  neuro_san_compatibility: {
    multi_agent_orchestration: boolean;
    agent_sdk: string;
    mcp_server_endpoint: string;
    mcp_protocol_version: string;
    claude_models_used?: string[];
    compatible_neuro_components?: string[];
  };
  agent_foundry_compatibility: {
    agents_total: number;
    sub_agents_total: number;
    agent_contract: string;
    deployment_targets: string[];
  };
  bedrock: {
    region: string;
    primary_model: string;
    fallback_model: string;
    provisioned_throughput_terraform: string;
    guardrails_id: string | null;
  };
  trizetto_integration: {
    facets_event_schema: string;
    qnxt_event_schema: string;
    gateway_url_env_var: string;
    submit_endpoint?: string;
    mock_inbox_endpoint?: string;
    tamper_evident_hash?: string;
  };
  observability: {
    metrics_endpoint: string;
    sse_endpoint: string;
    audit_endpoint: string;
  };
  governance: {
    cms_0057f_clauses_tracked: number;
    state_ai_laws_tracked: string[];
    model_card_endpoint: string;
    evidence_pack_endpoint: string;
  };
}

export interface ArchitectureLayerComponent {
  name: string;
  path: string;
}

export interface ArchitectureLayer {
  id: string;
  name: string;
  purpose: string;
  components: ArchitectureLayerComponent[];
  endpoints?: string[];
  business_outcome: string;
  agents?: {
    parents: number;
    sub_agents: number;
    llm_backed_sub_agents: number;
    deterministic_sub_agents: number;
    reflection_enabled_sub_agents: number;
  };
  active_backend?: string;
  configured_backends?: Record<string, unknown>;
  active_provider?: string;
  models?: { primary: string; fallback: string; region: string };
  guardrail?: { guardrail_id: string | null; version: string };
  compliance?: {
    cms_0057f_clauses_tracked: number;
    state_ai_laws_tracked: string[];
    in_force_today: number;
  };
}

export interface ArchitecturePrimaryKPI {
  id: string;
  name: string;
  baseline: string;
  target_range: string;
  measurement_endpoint: string;
}

export interface ArchitectureDescriptor {
  asof_iso: string;
  clincase_version: string;
  doc_path: string;
  business_use_case_doc: string;
  primary_kpis: ArchitecturePrimaryKPI[];
  layers: ArchitectureLayer[];
  aws_foundation: {
    id: string;
    name: string;
    purpose: string;
    services: string[];
    region_primary: string;
    terraform_modules: string[];
  };
  platform_alignment: {
    ai_velocity_gap_addressed: boolean;
    vector_strategy_classification: string[];
    agent_foundry_stage: string;
    neuro_san_compatible: boolean;
    trizetto_ai_gateway_native: boolean;
    anthropic_partnership_alignment: string;
  };
}

export interface ResponsibleAIModelCard {
  artifact: string;
  schema: string;
  clincase_version: string;
  intended_use: {
    primary: string;
    out_of_scope: string[];
  };
  models: {
    name: string;
    role: string;
    bedrock_model_id: string;
    provider: string;
    last_validated_iso: string;
  }[];
  data: {
    training_data: string;
    inference_data: string;
    phi_handling: string;
    retention_days: number;
  };
  performance: {
    f1_macro: number | null;
    accuracy_pct: number | null;
    last_eval_iso: string | null;
  };
  fairness: {
    monitored_dimensions: string[];
    bias_evaluation_method: string;
    last_bias_audit_iso: string | null;
  };
  human_oversight: {
    hitl_policy: string;
    sb1120_compliance: boolean;
    review_gate_threshold: number;
  };
  risk_register: {
    id: string;
    risk: string;
    mitigation: string;
  }[];
  standards: {
    nist_ai_rmf: string;
    iso_42001: string;
    eu_ai_act: string;
    cms_0057f: string;
  };
  contacts: {
    accountable_owner: string;
    safety_contact: string;
  };
}

export interface EvalReport {
  method: string;
  labeled_at: string | null;
  n_cohort_total: number;
  n_evaluated: number;
  overall_accuracy_pct: number;
  macro_f1: number;
  weighted_f1: number;
  per_class: Record<
    "APPROVE" | "DENY" | "REFER",
    { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number }
  >;
  confusion_matrix: Record<"APPROVE" | "DENY" | "REFER", Record<"APPROVE" | "DENY" | "REFER", number>>;
  disagreement_taxonomy: {
    conservative_clincase_more_decisive: number;
    conservative_clincase_more_cautious: number;
    aggressive_opposite_verdict: number;
    other: number;
  };
  per_payer: Record<string, { n: number; agree: number; accuracy_pct: number }>;
  per_treatment_top5: Record<string, { n: number; agree: number; accuracy_pct: number }>;
}

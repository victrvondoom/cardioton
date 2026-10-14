import { authHeader, clearAuth } from "../../lib/core__src_lib__auth";
import { readFetch } from "../../lib/readFetch";

export interface ReportFinding {
  id: string;
  source_excerpt: string;
  original_observation: Record<string, unknown>;
  normalized: { kind: string; label: string; structure_id: string | null; segment: string | null; value: number | null; unit: string | null };
  certainty: "documented" | "uncertain" | "negated" | "conflicting" | "unsupported";
  status: "pending" | "approved" | "rejected";
  event_at?: string | null;
  available_at?: string;
  reviewed_at?: string | null;
  reviewer_id?: string | null;
  mapping: { version: string; structure_id: string | null; structure_ids?: string[]; label: string; rationale: string; explanation?: string; location_status: string; no_lesion_geometry: true };
  active_annotation: boolean;
}
export interface CardiovascularReport {
  id: string; version: number; case_ref: string; patient_ref: string;
  source: { filename: string; media_type: string; sha256: string; size_bytes: number; page_count: number | null; report_type: string; author?: string | null; study_at?: string | null; date_precision?: string };
  event_at: string | null; available_at: string; synthetic: boolean;
  findings: ReportFinding[]; audit: Record<string, unknown>[]; warnings: string[]; storage_mode: string;
}
export interface ReportsResponse { reports: CardiovascularReport[]; as_of: string; storage_mode: string; limitations: string[] }
export interface ReviewDecision { finding_id: string; action: "approve" | "reject" | "correct"; expected_version: number; normalized?: ReportFinding["normalized"]; note?: string }
const BASE = "/api/v1/cardiotwin/anatomy";
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await readFetch(BASE + path, { ...init, headers: { ...authHeader(), ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init.headers } });
  if (response.status === 401) { clearAuth(); window.location.assign("/login"); throw new Error("Session expired"); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "Report service unavailable" }));
    throw new Error(typeof body.detail === "string" ? body.detail : "Report request rejected. Check the file, references and reviewer permissions.");
  }
  return response.json() as Promise<T>;
}
export const reportsApi = {
  list: (caseRef: string, asOf?: string, signal?: AbortSignal) => request<ReportsResponse>(`/reports?case_ref=${encodeURIComponent(caseRef)}${asOf ? `&as_of=${encodeURIComponent(asOf)}` : ""}`, { signal }),
  upload: (form: FormData) => request<CardiovascularReport>("/reports", { method: "POST", body: form }),
  review: (id: string, decision: ReviewDecision) => request<CardiovascularReport>(`/reports/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify(decision) }),
  passport: (id: string, asOf: string) => request<Record<string, unknown>>(`/reports/${encodeURIComponent(id)}/passport?as_of=${encodeURIComponent(asOf)}`),
  remove: (id: string) => request<{ deleted: boolean }>(`/reports/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

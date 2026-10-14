// SlicerHeart integration API client — same auth + error conventions as cardiotwin/core__src_cardiotwin__api.ts.
import { authHeader, clearAuth } from "../../lib/core__src_lib__auth";
import { readFetch } from "../../lib/readFetch";

const BASE = "/api/v1/integrations/slicerheart";

export class SlicerHeartError extends Error {
  constructor(
    public status: number,
    message: string,
    public reason?: string,
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
    throw new SlicerHeartError(401, "Session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const d = body?.detail;
    const message = typeof d === "string" ? d : d?.message ?? JSON.stringify(d ?? body);
    throw new SlicerHeartError(res.status, message || `Request failed (${res.status})`, d?.reason);
  }
  return res.json() as Promise<T>;
}

export interface SlicerHeartProvenance {
  upstream_repository: string;
  snapshot: string;
  authors: string;
  citation: string;
  license: string;
  license_file: string;
  snapshot_source_fingerprint: string;
  adapted_components: string[];
  notice: string;
  vendor_present: boolean;
}

export interface CatalogEntry {
  module: string;
  upstream_capability: string;
  classification: "reuse_directly" | "adapt" | "bridge" | "convert" | "reference_only" | "exclude";
  runtime: string;
  status: "wired" | "available_via_bridge" | "documented_only" | "not_integrated";
  cardiotwin_touchpoints: string[];
  notes: string;
}

export interface CatalogSummary {
  modules_classified: number;
  by_classification: Record<string, number>;
  wired_into_cardioton: string[];
  runtime_requirements: Record<string, string>;
}

export interface BridgeStatus {
  configured: boolean;
  available: boolean;
  slicer_home: string | null;
  bridge_dir: string;
  reason: string | null;
  setup_instructions: string | null;
}

export interface ValveMetric {
  id: string;
  name: string;
  unit: string;
  definition: string;
  valve?: string;
  notice?: string;
}

export interface ValveMetricCatalog {
  notice: string;
  valve_types: Record<string, { shortname: string; annulus_labels: string[] }>;
  probe_positions: { id: string; name: string; description: string }[];
  metrics_by_valve: Record<string, ValveMetric[]>;
  all_metric_ids: string[];
}

export interface AnnulusPhaseResult {
  phase: string;
  cases: number;
  skipped_cases: string[];
  mean_contour_points: number[][];
  std_contour_points: number[][];
  landmark_positions: { label: string; position: number[] }[];
  mean_contour_centroid_mm: number[];
}

export interface AnnulusShapeResult {
  valve_type: string;
  label_order: string[];
  points_per_segment: number;
  size_normalized: boolean;
  scale_factors: Record<string, number> | null;
  phases: AnnulusPhaseResult[];
  skipped_cases: string[];
  units: string;
}

export const slicerheartApi = {
  overview: () =>
    request<{
      upstream_repository: string;
      snapshot: string;
      citation: string;
      license: string;
      snapshot_source_fingerprint: string;
      notice: string;
      vendor_present: boolean;
      catalog: CatalogSummary;
      bridge: BridgeStatus;
    }>("/overview"),
  catalog: () => request<{ summary: CatalogSummary; matrix: CatalogEntry[] }>("/catalog"),
  valveMetrics: () => request<ValveMetricCatalog>("/valve-metrics"),
  bridgeStatus: () =>
    request<BridgeStatus & { jobs: { job_types: Record<string, { description: string; allowed_outputs: string[] }>; setup_instructions: string } }>(
      "/bridge/status",
    ),
  annulusShape: (payload: {
    csv_text: string;
    label_order: string[];
    valve_type?: string;
    points_per_segment?: number;
    normalize_size?: boolean;
  }) =>
    request<{
      notice: string;
      provenance: { upstream: string; adapted_from: string; license: string };
      cases_requested: number;
      result: AnnulusShapeResult;
    }>("/research/annulus-shape", { method: "POST", body: JSON.stringify(payload) }),
};

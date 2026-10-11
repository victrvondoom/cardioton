// CROSS-5 API client — five-frame multiscale intelligence. Same auth/error conventions as cardiotwin/api.ts.
import { authHeader, clearAuth } from "../lib/auth";
import { readFetch } from "../lib/readFetch";

const BASE = "/api/v1/cross5";

export class Cross5Error extends Error {
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
    throw new Cross5Error(401, "Session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const d = body?.detail;
    const message = typeof d === "string" ? d : d?.message ?? JSON.stringify(d ?? body);
    throw new Cross5Error(res.status, message || `Request failed (${res.status})`, d?.reason);
  }
  return res.json() as Promise<T>;
}

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

// ---- frames & intersections ----

export interface FrameInfo {
  id: string;
  number: number;
  name: string;
  title: string;
  scale: string;
  coordinate_reference: string;
  primary_data: string[];
  claims_policy: string;
}

export interface IntersectionInfo {
  frames: string[];
  link?: string;
  description?: string;
  mechanism?: string;
  caution?: string;
  reason?: string;
}

export const cross5Api = {
  frames: () => request<{ frames: FrameInfo[]; notice: string }>("/frames"),
  intersections: (frames: string[]) =>
    request<{
      selected_frames: string[];
      supported: IntersectionInfo[];
      unsupported: IntersectionInfo[];
      notice: string;
    }>(`/intersections?frames=${frames.join(",")}`),

  // ---- CardioFlow ----
  flowVessels: () =>
    request<{
      vessels: Record<string, { nominal_length_mm: number; reference_diameter_mm: number }>;
      notice: string;
    }>("/flow/vessels"),
  flowSimulate: (payload: { vessel_id: string; stenosis_pct: number }) =>
    post<FlowSimulation>("/flow/simulate", payload),
  flowCompare: (payload: { vessel_id: string; stenosis_values: number[] }) =>
    post<{ vessel_id: string; scenarios: FlowScenarioPoint[]; notice: string }>("/flow/compare", payload),

  // ---- CardioChronos ----
  chronosTimeline: (hours = 48) =>
    request<ChronosTimeline>(`/chronos/timeline?hours=${hours}`),
  chronosReplay: (payload: { scenario: string; hours: number; as_of: string }) =>
    post<ChronosReplay>("/chronos/replay", payload),

  // ---- CardioEarth ----
  earthCountries: () => request<{ countries: EarthCountry[]; notice: string }>("/earth/countries"),
  earthEnvironment: (latitude: number, longitude: number, day?: string) =>
    request<Record<string, unknown>>(
      `/earth/environment?latitude=${latitude}&longitude=${longitude}${day ? `&day=${day}` : ""}`,
    ),

  // ---- CardioCity ----
  city: () =>
    request<{
      nodes: CityNode[];
      edges: CityEdge[];
      facilities: CityFacility[];
      baseline_access: Record<string, CityCategoryStats>;
      notice: string;
    }>("/city"),
  cityAccess: (payload: { from_node?: string; closed_edges?: [string, string][]; added_facility?: Record<string, string> }) =>
    post<CityAccessResult>("/city/access", payload),

  // ---- experiments ----
  experiments: () =>
    request<{ experiments: ExperimentInfo[]; notice: string }>("/experiments"),
  runExperiment: (id: string, payload: Record<string, unknown> = {}) =>
    post<Record<string, unknown>>(`/experiments/${id}/run`, payload),
};

// ---- payload types ----

export interface FlowSteadyState {
  ffr_index: number;
  flow_rate_ml_min: number;
  translesional_dp_mmhg: number;
  reynolds_number: number;
  wall_shear_stress_pa: number;
  flow_regime: string;
  ischemic_threshold_flag: boolean;
}

export interface FlowSimulation {
  vessel_id: string;
  stenosis_pct: number;
  steady_state: FlowSteadyState;
  waveform: {
    cycle_seconds: number;
    time_series: { t_s: number; p_aortic_mmhg: number; p_distal_mmhg: number; q_ml_min: number; translesional_dp_mmhg: number }[];
    model: string;
  };
  centreline: {
    samples: { x_mm: number; diameter_mm: number; area_mm2: number }[];
    min_diameter_mm: number;
    min_area_mm2: number;
  };
  notice: string;
}

export interface FlowScenarioPoint {
  stenosis_pct: number;
  ffr_index: number;
  flow_rate_ml_min: number;
  translesional_dp_mmhg: number;
  ischemic_threshold_flag: boolean;
}

export interface ChronosTimeline {
  hours: number;
  bands: {
    ecg_excerpt: { sampling_rate_hz: number; n_samples: number; duration_s: number; label: string };
    hrv_windows: { timestamp: string; mean_heart_rate_bpm: number; sdnn_ms: number; rmssd_ms: number; n_beats: number }[];
    hourly_wearable: { timestamp: string; heart_rate_bpm: number; spo2_pct: number | null; activity: number; sleep_stage: string | null }[];
    daily_aggregates: { date: string; mean_heart_rate_bpm: number; sleep_samples: number; label: string }[];
    monthly_history: { month: string; ldl_mg_dl: number; systolic_bp_mmhg: number; label: string }[];
  };
  alignment: { hourly_coverage_samples: number; gaps: unknown[]; missing_data_policy: string };
  notice: string;
}

export interface ChronosReplay {
  as_of: string;
  available: Record<string, number>;
  available_rows: Record<string, unknown[]>;
  excluded_future: Record<string, string[]>;
  notice: string;
}

export interface EarthCountry {
  iso: string;
  country: string;
  region: string;
  cvd_mortality_per_100k: number;
  year: number;
  status: string;
  population_level: boolean;
  unit: string;
  source: string;
  source_url: string;
  uncertainty: string;
}

export interface CityNode {
  id: string;
  x: number;
  y: number;
  residents: number;
}

export interface CityEdge {
  a: string;
  b: string;
  length_m: number;
  speed_mps: number;
  travel_minutes: number;
}

export interface CityFacility {
  id: string;
  name: string;
  category: string;
  node: string;
}

export interface CityCategoryStats {
  facilities: number;
  population_weighted_mean_minutes: number | null;
  residents_within_20min: number;
  share_within_20min: number | null;
  worst_served_node: string | null;
  worst_travel_minutes: number | null;
}

export interface CityAccessResult {
  from_node?: string;
  facilities?: { facility: CityFacility; travel_minutes: number | null }[];
  nearest?: { facility: CityFacility; travel_minutes: number | null } | null;
  city_wide?: Record<string, CityCategoryStats>;
  scenario_label?: string;
  notice: string;
}

export interface ExperimentInfo {
  id: string;
  title: string;
  frames: string[];
  description: string;
}

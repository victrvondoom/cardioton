import { authHeader, clearAuth } from "../../lib/core__src_lib__auth";

export interface ContextLocation { id: string; name: string; country: string; region: string; latitude: number; longitude: number }
export interface EnvironmentalPoint { time: string; value: number | null; classification: "MODELLED" | "FORECAST" }
export interface EnvironmentalSeries {
  variable: string; label: string; unit: string; source_id: string;
  points: EnvironmentalPoint[]; ingested_at: string | null; original_available_at: null; original_availability: "UNKNOWN";
  summary: { hours_present: number; hours_expected: number; complete_past_day: boolean; mean_24h: number | null; min: number | null; max: number | null;
    reference: { value: number; unit: string; averaging_period: string; ratio: number; url: string; note: string } | null };
  warnings: string[];
}
export interface EnvironmentalSource {
  id: string; provider: string; url: string; endpoint: string; status: "available" | "unavailable"; ingested_at: string | null; cached: boolean;
  original_available_at: null; model_issued_at: null; grid_latitude: number | null; grid_longitude: number | null; resolution: string; error: string | null;
}
export interface EnvironmentSnapshot {
  date: string; requested_location: { latitude: number; longitude: number }; time_basis: "UTC"; retrieved_at: string;
  sources: EnvironmentalSource[]; series: EnvironmentalSeries[]; context_only: true; personal_exposure_established: false; warnings: string[];
}
export interface EnvironmentLayer {
  date: string; variable: string; unit: string;
  samples: { latitude: number; longitude: number; points: EnvironmentalPoint[] }[];
  ingested_at: string; cached: boolean; source_url: string; note: string;
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/v1/cardiotwin/environment${path}`, { headers: authHeader(), signal });
  if (response.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : `Environmental service unavailable (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const environmentApi = {
  locations: (q: string, signal?: AbortSignal) => request<{ results: ContextLocation[] }>(`/locations?${new URLSearchParams({ q })}`, signal),
  observations: (location: ContextLocation, date: string, signal?: AbortSignal) =>
    request<EnvironmentSnapshot>(`/observations?${new URLSearchParams({ lat: String(location.latitude), lon: String(location.longitude), date })}`, signal),
  layer: (location: ContextLocation, date: string, variable: string, signal?: AbortSignal) =>
    request<EnvironmentLayer>(`/layer?${new URLSearchParams({ lat: String(location.latitude), lon: String(location.longitude), date, variable })}`, signal),
};

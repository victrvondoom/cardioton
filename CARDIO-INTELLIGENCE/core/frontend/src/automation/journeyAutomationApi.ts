import { authHeader, clearAuth } from "../lib/core__src_lib__auth";
import { readFetch } from "../lib/readFetch";
import type { JourneyView } from "../journey/core__src_journey__api";

export interface JourneyAutomationState {
  job_id: string; job_version: number;
  status: "running" | "waiting_review" | "ready_for_exchange" | "blocked" | "complete";
  next_step: "map" | "generate" | "validate" | null;
  steps: { id: string; label: string; status: "pending" | "complete" | "blocked" }[];
  message: string;
  view: JourneyView;
}

async function request(jobId: string, expectedVersion?: number): Promise<JourneyAutomationState> {
  const response = await readFetch(`/api/v1/journey/${encodeURIComponent(jobId)}/automation`, {
    method: expectedVersion === undefined ? "GET" : "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    ...(expectedVersion === undefined ? {} : { body: JSON.stringify({ expected_version: expectedVersion }) }),
  });
  if (response.status === 401) clearAuth();
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof value?.detail === "string" ? value.detail : `Automation could not continue (${response.status}). Refresh the saved journey and try again.`);
  return value as JourneyAutomationState;
}

export const journeyAutomationApi = { get: (jobId: string) => request(jobId), advance: (jobId: string, version: number) => request(jobId, version) };

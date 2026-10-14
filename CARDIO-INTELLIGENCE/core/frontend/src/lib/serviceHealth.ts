import { authHeader } from "./core__src_lib__auth";
import { getRefreshRevision } from "./liveUpdates";
import { readFetch } from "./readFetch";

export interface ServiceHealth {
  status: string;
  db: string;
  case_storage_configured?: boolean;
}

const TTL_MS = 30_000;
const PROBE_TIMEOUT_MS = 3_000;
let cached: {
  at: number; revision: number; authorization: string | undefined; transport: typeof fetch;
  promise: Promise<ServiceHealth | null>;
} | null = null;

/** Liveness is public; readiness is reused briefly and rechecked on a manual refresh. */
export function fetchServiceHealth(headers = authHeader()): Promise<ServiceHealth | null> {
  const now = Date.now();
  const revision = getRefreshRevision();
  const authorization = headers.Authorization;
  if (cached && cached.transport === fetch && cached.revision === revision &&
      cached.authorization === authorization && now - cached.at < TTL_MS) return cached.promise;
  const controller = new AbortController();
  const read = readFetch("/api/v1/healthz", { signal: controller.signal }).then(async response => {
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("status" in value) || !("db" in value) ||
        typeof value.status !== "string" || typeof value.db !== "string") return null;
    return value as ServiceHealth;
  }).catch(() => null);
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<null>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve(null); }, PROBE_TIMEOUT_MS);
  });
  const promise = Promise.race([read, deadline]).finally(() => clearTimeout(timer));
  cached = { at: now, revision, authorization, transport: fetch, promise };
  return promise;
}

export class CaseStorageUnavailableError extends Error {
  readonly status = 503;
  constructor() {
    super("Case storage is not connected. Case records and agent metrics are unavailable. Connect the case database and refresh.");
    this.name = "CaseStorageUnavailableError";
  }
}

/** Unknown/older health responses must retain the endpoint's own failure signal. */
export async function requireCaseStorage(headers: Record<string, string>): Promise<void> {
  if ((await fetchServiceHealth(headers))?.case_storage_configured === false) throw new CaseStorageUnavailableError();
}

export function isCaseStorageRead(url: string): boolean {
  const path = url.split("?")[0];
  return path === "/api/v1/cases" || path.startsWith("/api/v1/cases/") ||
    path === "/api/v1/cohorts" || path === "/api/v1/reviewer/queue" ||
    path === "/api/v1/business-value/provider-abrasion" || path === "/api/v1/agents/metrics" ||
    /^\/api\/v1\/agents\/[^/]+\/runs$/.test(path);
}

/** test hook */
export function resetServiceHealthCache(): void { cached = null; }

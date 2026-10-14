/** Deployment observations for the architecture scene. No patient data is requested. */
import { authHeader } from "../lib/core__src_lib__auth";
import type { ProbeStatus, RuntimeService, RuntimeTopology } from "../runtime/core__src_runtime__api";

export type ArchitectureNodeStatus = "up" | "degraded" | "unknown" | "embedded" | "down";

export interface ArchitectureNodeLive {
  status: ArchitectureNodeStatus;
  label: string;
  detail: string;
  checkedAt: string | null;
  probeMs: number | null;
  to: string;
}

export interface ArchitectureLive {
  checkedAt: string;
  nodes: Record<string, ArchitectureNodeLive>;
  errors: string[];
}

interface Health {
  status: string;
  case_storage_configured?: boolean;
}

interface CardioOverview {
  model: { integrity_verified: boolean; version: string };
}

interface InteropMeta {
  persistence: string;
  receiver_mode: string;
}

type Observation<T> = { value: T | null; checkedAt: string; error: string | null };

/** Fixed first-party paths only; error bodies and deployment endpoints stay private. */
async function observe<T>(path: string, name: string, headers: Record<string, string>): Promise<Observation<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`/api/v1/${path}`, {
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const reason = response.status === 403 ? "Access restricted" : response.status === 401 ? "Sign-in required" : `HTTP ${response.status}`;
      return { value: null, checkedAt: new Date().toISOString(), error: `${name}: ${reason}` };
    }
    return { value: await response.json() as T, checkedAt: new Date().toISOString(), error: null };
  } catch {
    return { value: null, checkedAt: new Date().toISOString(), error: `${name}: ${controller.signal.aborted ? "Request timed out" : "Unavailable"}` };
  } finally {
    clearTimeout(timeout);
  }
}

function statusOf(status: ProbeStatus): ArchitectureNodeStatus {
  if (status === "up" || status === "down" || status === "embedded") return status;
  return status === "misconfigured" ? "degraded" : "unknown";
}

function timing(service: RuntimeService | undefined) {
  return {
    checkedAt: service?.checked_at ?? null,
    probeMs: typeof service?.probe_ms === "number" && Number.isFinite(service.probe_ms) ? service.probe_ms : null,
  };
}

function unknown(to: string, detail: string): ArchitectureNodeLive {
  return { status: "unknown", label: "Status unavailable", detail, checkedAt: null, probeMs: null, to };
}

export async function fetchArchitectureLive(): Promise<ArchitectureLive> {
  const headers = authHeader();
  const [runtime, cardio, health, interop] = await Promise.all([
    observe<RuntimeTopology>("runtime", "Deployment probes", headers),
    observe<CardioOverview>("cardiotwin/overview", "CardioTwin", headers),
    observe<Health>("healthz", "API liveness", {}),
    observe<InteropMeta>("interop/meta", "Interoperability", headers),
  ]);
  const checkedAt = new Date().toISOString();
  const services = Array.isArray(runtime.value?.services) ? runtime.value.services : [];
  const apiService = services.find(service => service.id === "api");
  const database = services.find(service => service.id === "database");
  const receiver = services.find(service => service.id === "receiver");
  const nodes: ArchitectureLive["nodes"] = {
    experience: {
      status: "up",
      label: "Browser connected",
      detail: "This workspace is loaded in your browser. Backend availability is checked separately.",
      checkedAt,
      probeMs: null,
      to: "/dashboard",
    },
    api: unknown("/runtime", "API liveness could not be checked."),
    cardiotwin: unknown("/cardiotwin", "Model integrity and version could not be checked."),
    evidence: unknown("/runtime", "Evidence persistence could not be checked."),
    receiver: unknown("/interop", "Receiver deployment and availability could not be checked."),
  };

  if (health.value && typeof health.value.status === "string") {
    const available = health.value.status === "ok";
    nodes.api = {
      status: available ? "up" : "degraded",
      label: available ? "API reachable" : "API degraded",
      detail: available ? "The API answered its liveness check. Storage readiness is shown separately." : "The API liveness response reports a degraded state.",
      checkedAt: health.checkedAt,
      probeMs: null,
      to: "/runtime",
    };
  } else if (apiService) {
    const available = apiService.status === "up";
    nodes.api = { status: statusOf(apiService.status), label: available ? "API reachable" : "API unavailable", detail: available ? "The API answered the deployment request." : "The deployment probe did not confirm API availability.", ...timing(apiService), to: "/runtime" };
  }

  if (typeof cardio.value?.model?.integrity_verified === "boolean") {
    const verified = cardio.value.model.integrity_verified;
    const version = typeof cardio.value.model.version === "string" ? cardio.value.model.version : "unknown";
    nodes.cardiotwin = {
      status: verified ? "up" : "down",
      label: verified ? "Model integrity verified" : "Model integrity failed",
      detail: `Model v${version}. ${verified ? "The backend verified the model artifact; clinical interpretation is required." : "Do not rely on model outputs until the artifact is restored."}`,
      checkedAt: cardio.checkedAt,
      probeMs: null,
      to: "/cardiotwin",
    };
  }

  const persistence = interop.value?.persistence ?? database?.engine;
  if (database?.status === "down" || database?.status === "misconfigured") {
    nodes.evidence = { status: statusOf(database.status), label: "Evidence store unavailable", detail: "The deployment probe could not verify the configured store.", ...timing(database), to: "/runtime" };
  } else if (persistence === "volatile_synthetic_demo_only" || persistence === "sqlite_synthetic_demo_only") {
    const volatile = persistence === "volatile_synthetic_demo_only";
    nodes.evidence = {
      status: "degraded",
      label: volatile ? "Volatile demo storage" : "SQLite demo storage",
      detail: volatile ? "Synthetic evidence uses memory in this API process and is lost on restart. PostgreSQL case storage is not connected." : "Synthetic evidence uses a local SQLite store. PostgreSQL case storage is not connected.",
      checkedAt: database?.checked_at ?? interop.checkedAt,
      probeMs: timing(database).probeMs,
      to: "/runtime",
    };
  } else if (database && persistence === "postgresql") {
    const available = database.status === "up";
    nodes.evidence = { status: statusOf(database.status), label: available ? "PostgreSQL verified" : "PostgreSQL unverified", detail: available ? "The configured database answered SELECT 1 for this deployment probe." : "The configured database has not passed a reachability probe.", ...timing(database), to: "/runtime" };
  } else if (health.value?.case_storage_configured === false) {
    nodes.evidence = { status: "degraded", label: "Case storage disconnected", detail: "The API reports no configured case-storage pool. Evidence persistence is unverified.", checkedAt: health.checkedAt, probeMs: null, to: "/runtime" };
  }

  if (receiver) {
    const embedded = receiver.status === "embedded";
    nodes.receiver = {
      status: statusOf(receiver.status),
      label: embedded ? "Embedded System B" : receiver.status === "up" ? "Receiver reachable" : receiver.status === "down" ? "Receiver unavailable" : "Receiver unverified",
      detail: embedded ? "An independent ASGI receiver is configured in this process with separate SQLite storage. Remote network availability is not being claimed." : receiver.status === "up" ? "The configured remote receiver answered its health check." : "The configured remote receiver has not passed its health check.",
      ...timing(receiver),
      to: "/interop",
    };
  } else if (interop.value?.receiver_mode?.includes("in-process")) {
    nodes.receiver = { status: "embedded", label: "Embedded System B", detail: "An independent receiver is configured in this process. Its availability has not been probed.", checkedAt: interop.checkedAt, probeMs: null, to: "/interop" };
  }

  return { checkedAt, nodes, errors: [runtime.error, cardio.error, health.error, interop.error].filter((error): error is string => error !== null) };
}

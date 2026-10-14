/**
 * Live shell data — feeds the top ticker and the sidebar chips from real endpoints.
 *
 * Every source is fetched independently and fails soft: a source that errors simply contributes nothing (no stale or
 * invented text). `buildTickerItems` and `buildNavChips` are pure so the wording rules are unit-testable.
 */
import { authHeader } from "./core__src_lib__auth";
import { getRefreshRevision } from "./liveUpdates";
import { readFetch } from "./readFetch";
import { fetchServiceHealth, resetServiceHealthCache } from "./serviceHealth";

export type Tone = "emerald" | "amber" | "cyan" | "brand" | "red";
export type TickerIcon = "activity" | "alert" | "check" | "heart" | "shield" | "spark" | "zap";
export interface TickerItem { tone: Tone; icon: TickerIcon; text: string }

export interface FeedSnapshot {
  health: { status: string; db: string; case_storage_configured?: boolean } | null;
  cases: { total: number; awaiting: number } | null;
  onco: { open_alerts: number; patients: number; ledger_valid: boolean } | null;
  cardio: { integrity: boolean; version: string; cad_auc: number | null } | null;
  agents: { invocations: number; errors: number; hours: number } | null;
  policies: { n: number; with_change: number } | null;
  evalF1: number | null;
  roiAnnualUsd: number | null;
  archLayers: number | null;
}

export const EMPTY_SNAPSHOT: FeedSnapshot = {
  health: null, cases: null, onco: null, cardio: null, agents: null, policies: null, evalF1: null, roiAnnualUsd: null, archLayers: null,
};

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function isHealthDegraded(health: FeedSnapshot["health"]): boolean {
  return !!health && (health.status !== "ok" || health.case_storage_configured === false);
}

export function buildTickerItems(s: FeedSnapshot): TickerItem[] {
  const out: TickerItem[] = [];
  if (s.health) {
    const ok = !isHealthDegraded(s.health);
    const text = s.health.status !== "ok" ? `API reports status "${s.health.status}"`
      : s.health.case_storage_configured === false ? "API reachable · case storage is not connected · counts and agent metrics unknown"
      : `API healthy · database ${s.health.db.replace(/_/g, " ")}`;
    out.push({ tone: ok ? "emerald" : "red", icon: ok ? "check" : "alert", text });
  }
  if (s.cases) {
    out.push({
      tone: s.cases.awaiting > 0 ? "amber" : "brand",
      icon: s.cases.awaiting > 0 ? "alert" : "activity",
      text: `${plural(s.cases.total, "case")} in your organisation · ${s.cases.awaiting} awaiting human review`,
    });
  }
  if (s.agents && s.agents.invocations > 0) {
    out.push({
      tone: s.agents.errors > 0 ? "amber" : "emerald",
      icon: "zap",
      text: `${plural(s.agents.invocations, "agent run")} in the last ${s.agents.hours} h · ${plural(s.agents.errors, "error")}`,
    });
  }
  if (s.onco) {
    out.push({
      tone: s.onco.ledger_valid ? "emerald" : "red",
      icon: "heart",
      text: `OncoTwin: ${plural(s.onco.patients, "twin patient")} · ${plural(s.onco.open_alerts, "open alert")} · audit ledger ${s.onco.ledger_valid ? "verified" : "FAILED verification"}`,
    });
  }
  if (s.cardio) {
    out.push({
      tone: s.cardio.integrity ? "cyan" : "red",
      icon: "shield",
      text: `CardioTwin model v${s.cardio.version} ${s.cardio.integrity ? "integrity verified" : "INTEGRITY CHECK FAILED"}${s.cardio.cad_auc != null ? ` · held-out CAD AUC ${s.cardio.cad_auc.toFixed(2)}` : ""}`,
    });
  }
  if (s.policies) {
    out.push({ tone: "brand", icon: "spark", text: `Policy corpus: ${plural(s.policies.n, "policy", "policies")} · ${s.policies.with_change} with a recorded change` });
  }
  return out;
}

export interface Notification {
  /** stable id; combined with `count` to form the read-state signature */
  key: string;
  count: number;
  tone: Tone;
  icon: TickerIcon;
  title: string;
  body: string;
  to?: string;
}

/** Notifications the user can act on, derived from real state. Nothing is emitted for a healthy, idle system. */
export function buildNotifications(s: FeedSnapshot): Notification[] {
  const out: Notification[] = [];
  if (s.health && s.health.status !== "ok") {
    out.push({ key: "health", count: 1, tone: "red", icon: "alert", title: "API is not healthy", body: `Status "${s.health.status}", database ${s.health.db}.`, to: "/architecture" });
  } else if (s.health?.case_storage_configured === false) {
    out.push({ key: "health", count: 1, tone: "red", icon: "alert", title: "Case storage is not connected", body: "Case counts and agent metrics are unknown. Database-backed workflows are unavailable.", to: "/architecture" });
  }
  if (s.cases && s.cases.awaiting > 0) {
    out.push({ key: "awaiting", count: s.cases.awaiting, tone: "amber", icon: "alert", title: `${plural(s.cases.awaiting, "case")} awaiting human review`, body: "Paused at the review gate for a clinician decision.", to: "/reviewer" });
  }
  if (s.onco && s.onco.open_alerts > 0) {
    out.push({ key: "onco-alerts", count: s.onco.open_alerts, tone: "amber", icon: "heart", title: `${plural(s.onco.open_alerts, "open OncoTwin alert")}`, body: "Twin patients with early-warning alerts to triage.", to: "/twin" });
  }
  if (s.onco && !s.onco.ledger_valid) {
    out.push({ key: "onco-ledger", count: 1, tone: "red", icon: "shield", title: "OncoTwin audit ledger failed verification", body: "The hash chain does not verify — investigate before relying on the audit trail.", to: "/twin/ops" });
  }
  if (s.cardio && !s.cardio.integrity) {
    out.push({ key: "cardio-integrity", count: 1, tone: "red", icon: "shield", title: "CardioTwin model failed its integrity check", body: "Predictions should not be trusted until the artifact is restored.", to: "/cardiotwin" });
  }
  if (s.agents && s.agents.errors > 0) {
    out.push({ key: "agent-errors", count: s.agents.errors, tone: "amber", icon: "zap", title: `${plural(s.agents.errors, "agent error")} in the last ${s.agents.hours} h`, body: "Review failing agents and their recent runs.", to: "/agents" });
  }
  return out;
}

export const notifSignature = (n: Pick<Notification, "key" | "count">) => `${n.key}:${n.count}`;

/** Sidebar chips keyed by route. `null`/absent = nothing to show (never a placeholder number). */
export function buildNavChips(s: FeedSnapshot): Record<string, string | null> {
  const usd = s.roiAnnualUsd;
  const compact = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : `${Math.round(v)}`);
  return {
    "/eval": s.evalF1 != null && s.evalF1 > 0 ? `F1 ${s.evalF1.toFixed(2).replace(/^0/, "")}` : null,
    "/roi": usd != null && usd > 0 ? `$${compact(usd)}` : null,
    "/architecture": s.archLayers ? `${s.archLayers}-LAYER` : null,
  };
}

async function get<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  try {
    const res = await readFetch(url, { headers: { Accept: "application/json", ...headers } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function loadSnapshot(headers: Record<string, string>): Promise<FeedSnapshot> {
  const healthRequest = fetchServiceHealth(headers);
  // Liveness is not database readiness. Only an explicit unconfigured pool suppresses
  // case-storage requests; configured/older servers retain their own failure signals.
  const fromCaseStorage = async <T,>(url: string): Promise<T | null> =>
    (await healthRequest)?.case_storage_configured === false ? null : get<T>(url, headers);
  const [health, cases, awaiting, onco, cardio, agents, policies, ev, roi, arch] = await Promise.all([
    healthRequest,
    fromCaseStorage<{ total: number }>("/api/v1/cases?limit=1"),
    fromCaseStorage<{ total: number }>("/api/v1/cases?limit=1&status=awaiting_review"),
    get<{ open_alerts: number; patients: number; ledger: { valid: boolean } }>("/api/v1/oncotwin/overview", headers),
    get<{ model: { integrity_verified: boolean; version: string }; headline_metrics: { CAD?: { roc_auc: number } } }>("/api/v1/cardiotwin/overview", headers),
    fromCaseStorage<{ window_hours: number; agents: Record<string, { errors: number }>; totals: { invocations: number } }>("/api/v1/agents/metrics?hours=24"),
    get<{ n: number; n_with_recent_change: number }>("/api/v1/policy-catalog", headers),
    get<{ macro_f1: number; n?: number }>("/api/v1/eval/cohort", headers),
    get<{ direct_savings_annual_projection_usd: number; db_unavailable?: boolean }>("/api/v1/business-value/org", headers),
    get<{ layers: unknown[] }>("/api/v1/architecture/layers", headers),
  ]);
  return {
    health,
    cases: cases && awaiting ? { total: cases.total, awaiting: awaiting.total } : null,
    onco: onco ? { open_alerts: onco.open_alerts, patients: onco.patients, ledger_valid: !!onco.ledger?.valid } : null,
    cardio: cardio ? { integrity: cardio.model.integrity_verified, version: cardio.model.version, cad_auc: cardio.headline_metrics.CAD?.roc_auc ?? null } : null,
    agents: agents ? { invocations: agents.totals.invocations, errors: Object.values(agents.agents).reduce((n, a) => n + a.errors, 0), hours: agents.window_hours } : null,
    policies: policies ? { n: policies.n, with_change: policies.n_with_recent_change } : null,
    evalF1: ev && typeof ev.macro_f1 === "number" && (ev.n ?? 1) > 0 ? ev.macro_f1 : null,
    roiAnnualUsd: roi && !roi.db_unavailable ? roi.direct_savings_annual_projection_usd : null,
    archLayers: arch && Array.isArray(arch.layers) ? arch.layers.length : null,
  };
}

// One shared round of requests for the whole shell (ticker + sidebar): concurrent callers share the in-flight
// promise and results are reused for a short TTL, so the shell never doubles its polling.
const TTL_MS = 30_000;
let cached: { at: number; revision: number; authorization: string | undefined; promise: Promise<FeedSnapshot> } | null = null;

export function fetchSnapshot(): Promise<FeedSnapshot> {
  const now = Date.now();
  // Capture one identity for the whole round, including requests deferred until health
  // resolves. Never reuse another signed-in organisation's cached snapshot.
  const headers = authHeader();
  const authorization = headers.Authorization;
  const revision = getRefreshRevision();
  if (cached && cached.revision === revision && cached.authorization === authorization && now - cached.at < TTL_MS) return cached.promise;
  const promise = loadSnapshot(headers);
  cached = { at: now, revision, authorization, promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}

/** test hook */
export function resetSnapshotCache(): void {
  cached = null;
  resetServiceHealthCache();
}

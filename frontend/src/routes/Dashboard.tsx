/**
 * Dashboard — operational clinic overview.
 *
 * Every number shown is read from a backend endpoint (org value rollup, live
 * snapshot, agent metrics); nothing is typed in. Sections map to the clinic
 * workflow: case load, review queue, recent cases and outstanding issues.
 */
import clsx from "clsx";
import { AlertTriangle, ArrowRight, CheckCircle2, Plus, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { RecentCasesRibbon } from "../components/RecentCasesRibbon";
import { StatTile } from "../components/StatTile";
import { api } from "../lib/api";
import {
  buildNotifications,
  EMPTY_SNAPSHOT,
  fetchSnapshot,
  isHealthDegraded,
  type Notification,
} from "../lib/liveFeed";
import { useLive } from "../lib/useLive";
import { WORKSPACES } from "../workflow/workspaces";

const VERDICT_TINT: Record<string, string> = {
  APPROVE: "bg-accent-green/10 text-accent-green border-accent-green/30",
  DENY:    "bg-accent-red/10   text-accent-red   border-accent-red/30",
  REFER:   "bg-accent-amber/10 text-accent-amber border-accent-amber/30",
};

function StatusItem({
  label,
  state,
  detail,
}: {
  label: string;
  state: "ok" | "down" | "loading";
  detail: string;
}) {
  const Icon = state === "ok" ? CheckCircle2 : state === "down" ? XCircle : AlertTriangle;
  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px]",
        state === "ok" && "border-surface-border bg-surface-raised text-ink-body",
        state === "down" && "border-accent-red/30 bg-accent-red/5 text-accent-red",
        state === "loading" && "border-surface-border bg-surface-raised text-ink-muted",
      )}
      role="status"
    >
      <Icon size={13} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        <span className="text-ink-muted"> — {detail}</span>
      </span>
    </div>
  );
}

function AttentionPanel({ items, loading }: { items: Notification[]; loading: boolean }) {
  return (
    <div className="bg-surface-raised border border-surface-border rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border">
        <h3 className="text-sm font-semibold text-ink-primary">Needs attention</h3>
        <span className="text-[10px] text-mono-tech text-ink-muted" data-testid="attention-count">
          {items.length === 0 ? (loading ? "checking…" : "all clear") : `${items.length} item${items.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <ul className="flex-1 divide-y divide-surface-border" data-testid="attention-list">
        {items.length === 0 && (
          <li className="px-5 py-8 text-center text-[12px] text-ink-muted" data-testid="attention-empty">
            {loading ? "Checking system state…" : "No outstanding issues. Cases awaiting review appear here."}
          </li>
        )}
        {items.map((n) => (
          <li key={n.key} data-testid={`attention-${n.key}`}>
            <Link to={n.to ?? "/dashboard"} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-raised-hi">
              <span
                aria-hidden="true"
                className={clsx(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  n.tone === "red" ? "bg-accent-red" : n.tone === "amber" ? "bg-accent-amber" : "bg-accent-brand",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-ink-primary">{n.title}</span>
                <span className="block text-[11px] text-ink-muted">{n.body}</span>
              </span>
              <ArrowRight size={12} aria-hidden="true" className="mt-1 shrink-0 text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const fixtureFeed = useLive(api.listFixtures);
  const fixtures = fixtureFeed.data;
  const [creating, setCreating] = useState<string | null>(null);
  const valueFeed = useLive(api.getOrgValue);
  const orgValue = valueFeed.data?.db_unavailable ? null : valueFeed.data;
  const snapshotFeed = useLive(fetchSnapshot, [], 60_000);
  const snapshot = snapshotFeed.data ?? EMPTY_SNAPSHOT;
  const navigate = useNavigate();

  // Real activity series from the org's own cases (last 7 UTC days); hidden until there is any activity.
  const sparkActive = useMemo(() => {
    const d = orgValue?.daily_cases_7d;
    return d && d.some((n) => n > 0) ? d : undefined;
  }, [orgValue]);
  const attention = useMemo(() => buildNotifications(snapshot), [snapshot]);
  const health = snapshot.health;
  const healthState: "ok" | "down" | "loading" =
    snapshotFeed.loading ? "loading" : !health ? "down" : isHealthDegraded(health) ? "down" : "ok";

  async function startDemo(name: string) {
    setCreating(name);
    try {
      const { case_id } = await api.createFromFixture(name);
      navigate(`/cases/${case_id}`);
    } catch {
      setCreating(null);
    }
  }

  return (
    <div className="workspace-page px-6 py-6">
      <nav aria-label="Clinic workspaces" className="workspace-launcher">
        {WORKSPACES.map((workspace) => (
          <Link key={workspace.id} to={workspace.href} title={workspace.summary}>
            <workspace.icon size={16} aria-hidden="true" />
            <span>{workspace.label}</span>
          </Link>
        ))}
      </nav>

      {(valueFeed.error || fixtureFeed.error || valueFeed.data?.db_unavailable) && (
        <p role="status" className="mb-4 rounded-lg border border-accent-amber/30 bg-accent-amber/5 px-3 py-2 text-xs text-ink-muted">
          {valueFeed.error
            ? `Business metrics unavailable: ${valueFeed.error}`
            : valueFeed.data?.db_unavailable
              ? "Case storage is unavailable. Business metrics cannot be calculated."
              : `Demo fixtures unavailable: ${fixtureFeed.error}`}
        </p>
      )}

      {/* Page header: one plain title, one primary action. */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight text-ink-primary">Clinic overview</h1>
          <p className="mt-1 max-w-[62ch] text-[13px] text-ink-muted">
            Case load, review queue and outstanding issues across the organisation.
          </p>
        </div>
        <Link
          to="/intake"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-brand px-3.5 py-2 text-[13px] font-medium text-ink-invert hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
        >
          <Plus size={14} aria-hidden="true" />
          New patient case
        </Link>
      </header>

      {/* Operational status — measured deployment state, not decoration. */}
      <section aria-label="System status" className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatusItem
          label="API"
          state={healthState}
          detail={
            snapshotFeed.loading
              ? "checking…"
              : health
                ? health.status === "ok"
                  ? `healthy · database ${health.db.replace(/_/g, " ")}`
                  : `reports status "${health.status}"`
                : "unreachable"
          }
        />
        <StatusItem
          label="Case storage"
          state={snapshotFeed.loading ? "loading" : health?.case_storage_configured === false ? "down" : "ok"}
          detail={
            snapshotFeed.loading
              ? "checking…"
              : health?.case_storage_configured === false
                ? "not connected — case counts unknown"
                : "connected"
          }
        />
        <StatusItem
          label="CardioTwin model"
          state={snapshotFeed.loading ? "loading" : !snapshot.cardio ? "down" : snapshot.cardio.integrity ? "ok" : "down"}
          detail={
            snapshotFeed.loading
              ? "checking…"
              : snapshot.cardio
                ? `v${snapshot.cardio.version} · integrity ${snapshot.cardio.integrity ? "verified" : "FAILED"}${snapshot.cardio.cad_auc != null ? ` · held-out CAD AUC ${snapshot.cardio.cad_auc.toFixed(2)}` : ""}`
                : "model status unavailable"
          }
        />
        <StatusItem
          label="Agent runs"
          state={snapshotFeed.loading ? "loading" : !snapshot.agents ? "down" : snapshot.agents.errors > 0 ? "down" : "ok"}
          detail={
            snapshotFeed.loading
              ? "checking…"
              : snapshot.agents
                ? `${snapshot.agents.invocations.toLocaleString()} in the last ${snapshot.agents.hours} h · ${snapshot.agents.errors.toLocaleString()} ${snapshot.agents.errors === 1 ? "error" : "errors"}`
                : "agent metrics unavailable"
          }
        />
      </section>

      {/* KPI row — computed from org value and the live snapshot; "—" while unavailable. */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile
          eyebrow="Patient cases · MTD"
          value={orgValue ? String(orgValue.cases_total) : "—"}
          spark={sparkActive}
          hint={orgValue ? `${orgValue.cases_decided} decided MTD` : valueFeed.loading ? "loading…" : "metrics unavailable"}
        />
        <StatTile
          eyebrow="Awaiting human review"
          value={snapshot.cases ? String(snapshot.cases.awaiting) : "—"}
          hint={snapshot.cases ? (snapshot.cases.awaiting > 0 ? "paused at the review gate" : "review queue is clear") : snapshotFeed.loading ? "loading…" : "count unavailable"}
        />
        <StatTile
          eyebrow="Avg time-to-decision"
          value={orgValue?.avg_decision_seconds != null ? `${orgValue.avg_decision_seconds.toFixed(1)}s` : "—"}
          trend={orgValue?.avg_decision_change_pct != null ? { value: orgValue.avg_decision_change_pct, goodDirection: "down" } : undefined}
          hint={
            orgValue?.avg_speedup_factor != null
              ? `${orgValue.avg_speedup_factor.toFixed(1)}× faster than the ${orgValue.assumptions?.manual_pa_minutes ?? "—"}-min manual baseline`
              : `vs ${orgValue?.assumptions?.manual_pa_minutes ?? "—"}-min manual baseline`
          }
        />
        <StatTile
          eyebrow="Agent runs · 24 h"
          value={snapshot.agents ? snapshot.agents.invocations.toLocaleString() : "—"}
          hint={snapshot.agents ? (snapshot.agents.errors > 0 ? `${snapshot.agents.errors} ${snapshot.agents.errors === 1 ? "error" : "errors"} in the window` : "no errors in the window") : snapshotFeed.loading ? "loading…" : "agent metrics unavailable"}
        />
      </section>

      {/* Recent cases + outstanding issues. */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 mb-6">
        <RecentCasesRibbon />
        <AttentionPanel items={attention} loading={snapshotFeed.loading} />
      </section>

      {/* Synthetic demo cases — creates a real case from a fixture, then opens it. */}
      {fixtures && fixtures.length > 0 && (
        <section className="bg-surface-raised border border-surface-border rounded-2xl px-5 py-4" aria-label="Synthetic demo cases">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-ink-primary">Synthetic demo cases</span>
            <span className="text-[11px] text-ink-muted">Creates a real case from a fixture record, then opens it.</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {fixtures.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => startDemo(f.name)}
                disabled={creating !== null}
                className={`text-xs text-mono-tech px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${VERDICT_TINT[f.expected_verdict] ?? ""}`}
                title={f.label}
              >
                {creating === f.name ? "starting…" : f.expected_verdict}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

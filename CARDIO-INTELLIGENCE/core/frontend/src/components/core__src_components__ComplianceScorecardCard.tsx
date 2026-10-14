/**
 * Per-case CMS-0057-F + state-AI-law live scorecard card.
 *
 * Renders the LIVE response from GET /api/v1/compliance/case/{id}.
 * Each clause shows: id (e.g. "§ IV.B.1"), title, satisfied? badge, and a
 * one-line "evidence" pointer (TAT seconds, agent_runs count, etc).
 *
 * Replaces the hardcoded mock readiness table that was on the Compliance
 * route. Auditor-facing — this is what proves the case is reproducible
 * to a CMS-0057-F § IV.D auditor.
 */
import {
  AlertTriangle,
  CheckCircle2,
  ScrollText,
  XCircle,
} from "lucide-react";
import { useLive } from "../lib/core__src_lib__useLive";

import { api, type ClauseResult } from "../lib/core__src_lib__api";

interface Props {
  caseId: string;
  refreshKey?: number;
}

export function ComplianceScorecardCard({ caseId, refreshKey = 0 }: Props) {
  const scorecard = useLive(() => api.getCaseCompliance(caseId), [caseId, refreshKey]);
  const data = scorecard.data?.case_id === caseId ? scorecard.data : null;
  const loading = scorecard.loading && !data;
  const error = scorecard.error;

  return (
    <div className="bg-surface-raised border border-surface-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] text-compact text-ink-muted mb-0.5 flex items-center gap-1.5">
            <ScrollText size={11} className="text-accent-amber" />
            CMS-0057-F + state AI law live scorecard
          </div>
          <div className="text-sm font-semibold text-ink-primary">
            {data
              ? `${data.n_satisfied_in_force} of ${data.n_clauses_in_force} in-force clauses satisfied`
              : error ? "Scorecard unavailable" : "Computing…"}
          </div>
        </div>
        {data && (
          <Badge
            ok={data.in_force_satisfied}
            label={data.in_force_satisfied ? "AUDIT-READY" : "GAP"}
          />
        )}
      </div>

      {loading && (
        <div className="text-xs text-ink-muted">Computing live scorecard…</div>
      )}
      {error && (
        <div role="status" className="text-xs text-accent-red">Could not compute scorecard: {error}{data ? " Showing the last successful scorecard." : ""}</div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.clauses.map((c) => (
            <ClauseRow key={c.clause_id} clause={c} />
          ))}
        </div>
      )}

      {data && (
        <div className="mt-3 pt-3 border-t border-surface-border text-[10px] text-ink-faint text-mono-tech">
          Generated {new Date(data.asof_iso).toLocaleString()} · org{" "}
          <code className="bg-surface-panel px-1 py-0.5 rounded">{data.organization_id}</code>
        </div>
      )}
    </div>
  );
}

function ClauseRow({ clause }: { clause: ClauseResult }) {
  return (
    <div
      className={`border rounded-lg p-2.5 ${
        !clause.in_force_today
          ? "border-surface-border bg-surface-panel/40 opacity-60"
          : clause.satisfied
          ? "border-accent-green/30 bg-accent-green/5"
          : clause.severity === "critical"
          ? "border-accent-red/40 bg-accent-red/5"
          : "border-accent-amber/30 bg-accent-amber/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[10px] text-mono-tech text-ink-muted whitespace-nowrap">
            {clause.clause_id}
          </span>
          <span className="text-xs font-medium text-ink-primary truncate">
            {clause.title}
          </span>
        </div>
        <ClauseBadge clause={clause} />
      </div>
      <div className="text-[10px] text-ink-muted leading-snug">
        {clause.evidence}
      </div>
    </div>
  );
}

function ClauseBadge({ clause }: { clause: ClauseResult }) {
  if (!clause.in_force_today) {
    return (
      <span className="text-[9px] text-mono-tech px-1 py-0.5 rounded bg-surface-border text-ink-muted">
        UPCOMING
      </span>
    );
  }
  if (clause.satisfied) {
    return <CheckCircle2 size={14} className="text-accent-green shrink-0" />;
  }
  if (clause.severity === "critical") {
    return <XCircle size={14} className="text-accent-red shrink-0" />;
  }
  return <AlertTriangle size={14} className="text-accent-amber shrink-0" />;
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`text-[10px] text-mono-tech px-2 py-1 rounded ${
        ok
          ? "bg-accent-green/15 text-accent-green"
          : "bg-accent-amber/15 text-accent-amber"
      }`}
    >
      {label}
    </span>
  );
}

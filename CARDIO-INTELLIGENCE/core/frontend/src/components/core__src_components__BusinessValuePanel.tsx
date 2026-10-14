/**
 * Per-case Business Value panel.
 *
 * Renders the LIVE response from GET /api/v1/business-value/case/{id}:
 *   • $$ saved vs the AMA $1,500 manual baseline
 *   • Minutes returned to the clinician's day
 *   • Decision speedup factor
 *   • Annualized projection at the org's current 30-day rate
 *
 * This is the strip that lets a CFO walk away from the demo with a single
 * dollar figure they can take to procurement.
 */
import { Citrus, Clock, DollarSign, TrendingUp } from "lucide-react";
import { useLive } from "../lib/core__src_lib__useLive";

import { api } from "../lib/core__src_lib__api";

interface BusinessValuePanelProps {
  caseId: string;
  refreshKey?: number;
}

export function BusinessValuePanel({ caseId, refreshKey = 0 }: BusinessValuePanelProps) {
  const value = useLive(() => api.getCaseValue(caseId), [caseId, refreshKey]);
  const roi = value.data?.case_id === caseId ? value.data : null;
  const loading = value.loading && !roi;
  const error = value.error;

  return (
    <div className="bg-surface-raised border border-surface-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] text-compact text-ink-muted mb-0.5">
            Business value
          </div>
          <div className="text-sm font-semibold text-ink-primary">
            Live ROI vs {roi ? `$${roi.manual_cost_usd.toLocaleString()} manual baseline` : "configured manual baseline"}
          </div>
        </div>
        <div className="text-[10px] text-mono-tech text-ink-faint">
          /business-value/case
        </div>
      </div>

      {loading && (
        <div className="text-xs text-ink-muted">Computing live ROI…</div>
      )}
      {error && (
        <div role="status" className="text-xs text-accent-red">Could not compute ROI: {error}{roi ? " Showing the last successful result." : ""}</div>
      )}

      {roi && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile
              icon={<DollarSign size={14} />}
              label="Saved this case"
              value={`$${roi.savings_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              accent="green"
              footer={`CARDIOTON $${roi.clincase_cost_usd.toFixed(2)} vs $${roi.manual_cost_usd.toLocaleString()} manual`}
            />
            <Tile
              icon={<Clock size={14} />}
              label="Minutes returned"
              value={roi.minutes_saved.toFixed(1)}
              accent="cyan"
              footer={
                roi.decision_seconds != null
                  ? `Decision in ${roi.decision_seconds.toFixed(1)}s`
                  : "Awaiting decision"
              }
            />
            <Tile
              icon={<TrendingUp size={14} />}
              label="Speedup factor"
              value={roi.speedup_factor != null ? `${roi.speedup_factor.toFixed(1)}×` : "—"}
              accent="brand"
              footer={`vs ${roi.manual_minutes ?? "—"}-min manual baseline`}
            />
            <Tile
              icon={<Citrus size={14} />}
              label="Annualized at org rate"
              value={
                roi.annual_extrapolation_usd != null
                  ? `$${(roi.annual_extrapolation_usd / 1000).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}K`
                  : "—"
              }
              accent="amber"
              footer="Last 30d × 12 × per-case savings"
            />
          </div>

          {roi.citations.length > 0 && (
            <div className="mt-3 text-[10px] text-ink-faint text-mono-tech">
              Sources: {roi.citations.join(" · ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface TileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "green" | "amber" | "cyan" | "brand";
  footer: string;
}

const TILE_TINT: Record<TileProps["accent"], string> = {
  green: "bg-accent-green/5 border-accent-green/30 text-accent-green",
  amber: "bg-accent-amber/5 border-accent-amber/30 text-accent-amber",
  cyan: "bg-accent-cyan/5 border-accent-cyan/30 text-accent-cyan",
  brand: "bg-accent-brand-soft/40 border-accent-brand/30 text-accent-brand",
};

function Tile({ icon, label, value, accent, footer }: TileProps) {
  return (
    <div className={`border rounded-xl p-3 ${TILE_TINT[accent]}`}>
      <div className="flex items-center gap-1.5 text-[10px] text-compact mb-1.5 opacity-90">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold nums-tabular leading-none">{value}</div>
      <div className="text-[10px] text-ink-faint mt-1">{footer}</div>
    </div>
  );
}

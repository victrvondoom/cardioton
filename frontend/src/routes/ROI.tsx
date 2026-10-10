/**
 * /roi — Interactive Star Ratings + business-value calculator.
 *
 * The CFO-facing tool. Sliders for member count + current Star Rating;
 * the page calls /api/v1/business-value/star-impact live as you move
 * them, plus an org rollup tile with MTD savings and annual projection.
 *
 * The numbers are anchored to public sources cited inline (Lilac 2025,
 * KFF MA Quality Bonus, AMA / CAQH for the per-case baseline).
 */
import {
  ArrowUpRight,
  CalculatorIcon,
  Citrus,
  Coins,
  Stars,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLive } from "../lib/useLive";

import { api } from "../lib/api";

const PRESETS: Array<{ label: string; member_count: number; note: string }> = [
  { label: "100,000 members", member_count: 100_000, note: "Illustrative scenario size" },
  { label: "1.5 million members", member_count: 1_500_000, note: "Illustrative scenario size" },
  { label: "6 million members", member_count: 6_000_000, note: "Illustrative scenario size" },
  { label: "7.8 million members", member_count: 7_800_000, note: "Illustrative scenario size" },
];

export default function ROI() {
  const [memberCount, setMemberCount] = useState(6_000_000);
  const [currentStar, setCurrentStar] = useState(3.98);
  const [assumptions, setAssumptions] = useState({ member_count: memberCount, current_star: currentStar });
  const projectionFeed = useLive(() => api.getStarImpact(assumptions), [assumptions]);
  const orgFeed = useLive(api.getOrgValue);
  const abrasionFeed = useLive(() => api.getProviderAbrasion({ days: 90 }));
  const proj = projectionFeed.data;
  const orgRollup = orgFeed.data?.db_unavailable ? null : orgFeed.data;
  const abrasion = abrasionFeed.data;

  // Debounced re-fetch of star-impact whenever the sliders move
  useEffect(() => {
    const t = setTimeout(() => {
      setAssumptions({ member_count: memberCount, current_star: currentStar });
    }, 200);
    return () => clearTimeout(t);
  }, [memberCount, currentStar]);

  const formattedMembers = useMemo(
    () => memberCount.toLocaleString(undefined, { maximumFractionDigits: 0 }),
    [memberCount],
  );

  return (
    <div className="px-6 py-6">
      <header className="mb-5">
        <div className="text-[10px] text-compact text-accent-brand mb-1">
          CARDIOTON · BUSINESS VALUE CALCULATOR
        </div>
        <h1 className="text-2xl font-semibold text-ink-primary leading-tight">
          Star Ratings + per-case ROI projection
        </h1>
        <p className="text-sm text-ink-muted mt-1 max-w-2xl">
          Drag the sliders. Numbers update live from{" "}
          <code className="text-mono-tech text-xs">/api/v1/business-value/star-impact</code>.
          Anchored to <strong>Lilac Software 2025</strong> ($2.1M / 10K members / 0.5 stars)
          and <strong>KFF MA Quality Bonus 2025/2026</strong>.
        </p>
      </header>

      <section className="bg-surface-raised border border-surface-border rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <CalculatorIcon size={14} className="text-accent-brand" />
          <span className="text-sm font-semibold text-ink-primary">Inputs</span>
          <span className="text-xs text-ink-muted">Scenario assumptions · enter your own figures</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="flex items-center gap-1 text-[11px] text-compact text-ink-muted mb-1.5">
              <Users size={11} /> MA member count
            </label>
            <div className="text-2xl font-bold text-ink-primary nums-tabular mb-2">
              {formattedMembers}
            </div>
            <input
              type="range"
              min={10_000}
              max={10_000_000}
              step={10_000}
              value={memberCount}
              onChange={(e) => setMemberCount(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setMemberCount(p.member_count)}
                  className={`text-[11px] px-2 py-1 rounded border ${
                    memberCount === p.member_count
                      ? "border-accent-brand bg-accent-brand-soft/40 text-accent-brand"
                      : "border-surface-border text-ink-body hover:bg-surface-raised-hi"
                  }`}
                  title={p.note}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[11px] text-compact text-ink-muted mb-1.5">
              <Stars size={11} /> Current Star Rating
            </label>
            <div className="text-2xl font-bold text-ink-primary nums-tabular mb-2">
              {currentStar.toFixed(2)} <span className="text-xs text-ink-muted">stars</span>
            </div>
            <input
              type="range"
              min={2.0}
              max={5.0}
              step={0.01}
              value={currentStar}
              onChange={(e) => setCurrentStar(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-[11px] text-ink-faint mt-2">
              <span className="text-mono-tech">Starting assumption: 3.98 stars</span> · Adjust to your plan's current rating.
            </div>
          </div>
        </div>
      </section>

      {(projectionFeed.error || orgFeed.error || abrasionFeed.error || orgFeed.data?.db_unavailable) && <p role="status" className="mb-4 rounded-lg border border-accent-amber/30 bg-accent-amber/5 px-3 py-2 text-xs text-ink-muted">{[projectionFeed.error, orgFeed.error, abrasionFeed.error].filter(Boolean).join(" · ") || "Case storage is unavailable. Organization savings cannot be calculated."}{proj || orgRollup || abrasion ? " Last successful data remains visible." : ""}</p>}
      {projectionFeed.loading && <p role="status" className="mb-3 text-xs text-ink-muted">Updating projection…</p>}
      {/* Projected revenue lift */}
      {proj && (
        <section className="bg-surface-raised border border-surface-border rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-accent-green" />
            <span className="text-sm font-semibold text-ink-primary">
              Projected Star Ratings revenue lift
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border-2 border-accent-green/40 rounded-xl p-4 bg-accent-green/5">
              <div className="text-[10px] text-compact text-ink-muted mb-1">
                Conservative (+{proj.projected_lift_low.toFixed(1)} stars)
              </div>
              <div className="text-3xl font-bold text-accent-green nums-tabular leading-none">
                ${(proj.revenue_lift_low_usd / 1_000_000).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
                M / yr
              </div>
              <div className="text-[11px] text-ink-faint mt-1">
                {(proj.revenue_lift_low_usd / proj.member_count_assumed).toFixed(2)} per member
                per year
              </div>
            </div>
            <div className="border-2 border-accent-cyan/40 rounded-xl p-4 bg-accent-cyan/5">
              <div className="text-[10px] text-compact text-ink-muted mb-1">
                Optimistic (+{proj.projected_lift_high.toFixed(1)} stars)
              </div>
              <div className="text-3xl font-bold text-accent-cyan nums-tabular leading-none">
                ${(proj.revenue_lift_high_usd / 1_000_000).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
                M / yr
              </div>
              <div className="text-[11px] text-ink-faint mt-1">
                {(proj.revenue_lift_high_usd / proj.member_count_assumed).toFixed(2)} per member
                per year
              </div>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-ink-faint text-mono-tech">
            {proj.notes.map((n, i) => (
              <div key={i}>· {n}</div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-ink-faint">
            Sources: {proj.citations.join(" · ")}
          </div>
        </section>
      )}

      {/* Org direct savings rollup */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <RollupTile
          icon={<Coins size={14} />}
          label="MTD direct savings"
          value={
            orgRollup
              ? `$${orgRollup.direct_savings_mtd_usd.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`
              : "—"
          }
          hint={
            orgRollup
              ? `${orgRollup.cases_decided}/${orgRollup.cases_total} cases decided`
              : ""
          }
          accent="green"
        />
        <RollupTile
          icon={<Citrus size={14} />}
          label="Annualized projection"
          value={
            orgRollup
              ? `$${(orgRollup.direct_savings_annual_projection_usd / 1_000_000).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 2 },
                )}M`
              : "—"
          }
          hint="Last 30d × 12 × per-case savings"
          accent="amber"
        />
        <RollupTile
          icon={<ArrowUpRight size={14} />}
          label="Avg speedup factor"
          value={
            orgRollup?.avg_speedup_factor != null ? `${orgRollup.avg_speedup_factor.toFixed(1)}×` : "—"
          }
          hint={`vs ${orgRollup?.assumptions?.manual_pa_minutes ?? "—"}-min manual baseline`}
          accent="brand"
        />
      </section>

      {/* Provider abrasion */}
      {abrasion && abrasion.n_cases > 0 && (
        <section className="bg-surface-raised border border-surface-border rounded-2xl p-5">
          <div className="text-[10px] text-compact text-ink-muted mb-1">
            Provider abrasion (last 90 days)
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Cases" value={abrasion.n_cases.toLocaleString()} />
            <Stat label="Denied" value={abrasion.n_denied.toLocaleString()} />
            <Stat
              label="Abrasion reduction"
              value={`${abrasion.abrasion_reduction_pct.toFixed(0)}%`}
              accent
            />
            <Stat
              label="Minutes returned to clinic"
              value={abrasion.minutes_returned_to_practice.toLocaleString()}
              accent
            />
          </div>
          <div className="mt-2 text-[10px] text-ink-faint">
            Sources: {abrasion.citations.join(" · ")}
          </div>
        </section>
      )}
    </div>
  );
}

function RollupTile({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent: "green" | "amber" | "brand";
}) {
  const TINT: Record<typeof accent, string> = {
    green: "bg-accent-green/5 border-accent-green/30 text-accent-green",
    amber: "bg-accent-amber/5 border-accent-amber/30 text-accent-amber",
    brand: "bg-accent-brand-soft/40 border-accent-brand/30 text-accent-brand",
  };
  return (
    <div className={`border-2 rounded-xl p-4 ${TINT[accent]}`}>
      <div className="flex items-center gap-1.5 text-[10px] text-compact mb-1.5 opacity-90">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold nums-tabular leading-none">{value}</div>
      <div className="text-[10px] text-ink-faint mt-1">{hint}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-surface-border rounded-lg p-3">
      <div className="text-[10px] text-compact text-ink-muted mb-1">
        {label}
      </div>
      <div
        className={`text-xl font-bold nums-tabular ${
          accent ? "text-accent-green" : "text-ink-primary"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

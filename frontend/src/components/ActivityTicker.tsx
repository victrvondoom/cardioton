/** Live activity feed, available inline in the shared status menu.
 * The standalone fixed variant remains available to existing consumers. */
import { Activity, AlertCircle, CheckCircle, Heart, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EMPTY_SNAPSHOT, buildTickerItems, fetchSnapshot, isHealthDegraded, type TickerIcon, type Tone } from "../lib/liveFeed";
import { useLive } from "../lib/useLive";

const ICONS: Record<TickerIcon, LucideIcon> = {
  activity: Activity, alert: AlertCircle, check: CheckCircle, heart: Heart, shield: ShieldCheck, spark: Sparkles, zap: Zap,
};

const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-accent-green",
  amber:   "text-accent-amber",
  cyan:    "text-accent-cyan",
  brand:   "text-accent-brand-glow",
  red:     "text-accent-red",
};

const REFRESH_MS = 60_000;

export function ActivityTicker({ oneHealth = false, inline = false }: { oneHealth?: boolean; inline?: boolean }) {
  const { data, error, loading } = useLive(fetchSnapshot, [], REFRESH_MS);
  const snapshot = data ?? EMPTY_SNAPSHOT;
  const items = buildTickerItems(oneHealth ? { ...EMPTY_SNAPSHOT, health: snapshot.health } : snapshot);
  const degraded = isHealthDegraded(snapshot.health);
  // Duplicate so the marquee loop is seamless.
  const all = items.length ? [...items, ...items] : [];

  return (
    <div className={inline ? "relative h-8 overflow-hidden border-b border-surface-border bg-surface-raised/95" : "fixed top-0 inset-x-0 z-40 h-7 overflow-hidden border-b border-surface-border bg-surface-raised/95 hidden sm:block"}>
      {/* LIVE badge anchored left with solid backdrop above the marquee */}
      <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center gap-1.5 pl-3 pr-4 bg-surface-raised">
        <span className="relative flex h-1.5 w-1.5">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-70 ${degraded || !data?.health ? "" : "animate-ping"} ${degraded ? "bg-accent-red" : data?.health ? "bg-accent-green" : "bg-ink-faint"}`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${degraded ? "bg-accent-red" : data?.health ? "bg-accent-green" : "bg-ink-faint"}`} />
        </span>
        <span className="text-[9px] text-compact text-ink-muted">Status</span>
      </div>

      <div className={all.length ? "marquee-track flex items-center gap-10 h-full whitespace-nowrap pl-28" : "flex items-center h-full pl-28"} data-testid="ticker">
        {all.length === 0 && (
          <span className="text-[11px] text-mono-tech text-ink-muted" role="status">
            {loading ? "Connecting to live status…" : error ? "Live status unavailable" : "No live status reported"}
          </span>
        )}
        {all.map((it, i) => {
          const Icon = ICONS[it.icon];
          return (
            <span key={i} data-testid="ticker-item" className="inline-flex items-center gap-2 text-[11px] text-mono-tech text-ink-body">
              <Icon size={11} className={TONE_TEXT[it.tone]} />
              <span>{it.text}</span>
              <span className="text-ink-faint">—</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

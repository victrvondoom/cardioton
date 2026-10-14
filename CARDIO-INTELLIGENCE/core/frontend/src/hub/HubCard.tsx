/** Shared glass building blocks for the Intelligence Hub. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, Boxes, Brain, Database, HeartPulse, Image as ImageIcon, Layers, Radar, ScanLine, Sparkles, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { headlineMetric, type HubMetric, type HubModuleSummary } from "./hubApi";
import { useHubBlobUrl } from "./hubAssets";

export const CATEGORY_STYLE: Record<string, { icon: LucideIcon; tint: string }> = {
  "Risk Prediction": { icon: Activity, tint: "56 189 248" },
  "3D Anatomy & Visualization": { icon: Boxes, tint: "167 139 250" },
  "Digital Twins & Hemodynamics": { icon: HeartPulse, tint: "236 72 153" },
  "Imaging & Signals": { icon: ScanLine, tint: "45 212 191" },
  "Clinical AI & Workflow": { icon: Workflow, tint: "250 204 21" },
};

export function categoryStyle(category: string) {
  return CATEGORY_STYLE[category] ?? { icon: Sparkles, tint: "148 163 184" };
}

export function GlassPanel({ children, className = "", interactive = false }: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return <div className={`ci-glass ${interactive ? "ci-glass-interactive" : ""} ${className}`}>{children}</div>;
}

export function StatTile({ label, value, icon: Icon, tint = "56 189 248" }: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tint?: string;
}) {
  return (
    <GlassPanel className="overflow-hidden p-4">
      <div className="ci-orb -right-6 -top-6 h-20 w-20" style={{ background: `rgb(${tint} / 0.45)` }} />
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
        <Icon className="h-3.5 w-3.5" style={{ color: `rgb(${tint})` }} aria-hidden />
        {label}
      </div>
      <div className="ci-neon-number mt-2 text-3xl font-semibold">{value}</div>
    </GlassPanel>
  );
}

/** Image fetched with the user's token, loaded only once it scrolls near the viewport. */
export function HubImage({ slug, path, alt, className = "" }: {
  slug: string;
  path: string | null;
  alt: string;
  className?: string;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = holder.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible(true);
    }, { rootMargin: "200px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);
  const { url } = useHubBlobUrl(visible ? slug : undefined, visible ? path : null);
  return (
    <div ref={holder} className={`relative overflow-hidden bg-gradient-to-br from-sky-500/10 via-indigo-500/10 to-fuchsia-500/10 ${className}`}>
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-ink-faint">
          <ImageIcon className="h-6 w-6" aria-hidden />
        </div>
      )}
    </div>
  );
}

export function MetricBadge({ metric }: { metric: HubMetric | null }) {
  if (!metric) return null;
  const label = metric.name.split(/[.[]/).pop() ?? metric.name;
  return (
    <span className="ci-chip" title={`${metric.name} · ${metric.source}`}>
      <Radar className="h-3 w-3 text-sky-300" aria-hidden />
      {label.toUpperCase()} {metric.value.toFixed(3)}
    </span>
  );
}

export function ModuleCard({ module }: { module: HubModuleSummary }) {
  const { icon: Icon, tint } = categoryStyle(module.category);
  return (
    <Link to={`/hub/${module.slug}`} className="block focus:outline-none" aria-label={`Open ${module.title}`}>
      <GlassPanel interactive className="flex h-full flex-col overflow-hidden">
        <HubImage slug={module.slug} path={module.hero_image} alt={`${module.title} preview`} className="h-36 w-full" />
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em]" style={{ color: `rgb(${tint})` }}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {module.category}
            {module.live_app && <span className="ci-chip ml-auto shrink-0 whitespace-nowrap !py-0.5" data-active="true">LIVE APP</span>}
          </div>
          <h3 className="text-base font-semibold leading-snug text-ink-primary">{module.title}</h3>
          <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-muted">{module.tagline}</p>
          <div className="mt-auto flex flex-wrap gap-1.5">
            {module.tech.slice(0, 4).map((t) => (
              <span key={t} className="ci-chip">{t}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 border-t border-white/5 pt-3 text-[11px] text-ink-faint">
            <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" aria-hidden />{module.counts.features} features</span>
            <span className="inline-flex items-center gap-1"><Boxes className="h-3 w-3" aria-hidden />{module.counts.models3d} 3D</span>
            <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" aria-hidden />{module.counts.images} images</span>
            <span className="inline-flex items-center gap-1"><Database className="h-3 w-3" aria-hidden />{module.counts.datasets} datasets</span>
            <span className="inline-flex items-center gap-1"><Brain className="h-3 w-3" aria-hidden />{module.counts.ml_models} models</span>
          </div>
        </div>
      </GlassPanel>
    </Link>
  );
}

export { headlineMetric };

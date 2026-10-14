/** Evaluation metrics reported by each inherited project, side by side. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { headlineMetric, hubApi, type HubMetric, type HubModuleDetail } from "../hub/hubApi";
import { GlassPanel, categoryStyle } from "../hub/HubCard";

interface Row {
  module: HubModuleDetail;
  headline: HubMetric;
}

export default function HubModelBenchmarks() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    hubApi.modules()
      .then((all) => Promise.all(all.filter((m) => m.counts.metrics > 0).map((m) => hubApi.module(m.slug))))
      .then((details) => {
        if (cancelled) return;
        const result = details
          .map((module) => ({ module, headline: headlineMetric(module.metrics) }))
          .filter((r): r is Row => r.headline !== null)
          .sort((a, b) => b.headline.value - a.headline.value);
        setRows(result);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 px-4 py-6 md:px-6">
      <div>
        <h1 className="ci-gradient-text text-3xl font-semibold">Model Benchmarks</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          The headline metric each project reports in its own evaluation files (discrimination such as ROC-AUC first).
          Projects evaluate on different splits and tasks, so read this as a map of reported results, not a head-to-head ranking.
        </p>
      </div>
      <GlassPanel className="p-5">
        {loading && <p className="text-sm text-ink-muted">Reading evaluation files…</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-ink-muted">No project reports a comparable metric.</p>}
        <div className="space-y-3">
          {rows.map(({ module, headline }) => {
            const { tint } = categoryStyle(module.category);
            return (
              <div key={module.slug} className="grid grid-cols-[minmax(0,220px)_1fr_auto] items-center gap-4">
                <Link to={`/hub/${module.slug}`} className="truncate text-sm text-ink-primary hover:text-sky-300" title={module.title}>{module.title}</Link>
                <div className="h-3 overflow-hidden rounded-full bg-white/5" title={`${headline.name} · ${headline.source}`}>
                  <div className="h-full rounded-full" style={{ width: `${headline.value * 100}%`, background: `linear-gradient(90deg, rgb(${tint} / 0.55), rgb(${tint}))`, boxShadow: `0 0 14px rgb(${tint} / 0.6)` }} />
                </div>
                <div className="w-40 text-right">
                  <span className="ci-neon-number font-mono text-sm">{headline.value.toFixed(3)}</span>
                  <div className="truncate text-[10px] uppercase tracking-wider text-ink-faint" title={`${headline.name} · ${headline.source}`}>{headline.name.replace(/\]/g, "").split(/[.[]/).slice(-2).join(" · ")}</div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
}

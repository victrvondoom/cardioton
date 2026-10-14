/** Intelligence Hub: every absorbed cardiovascular project, in one glass dashboard. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppWindow, BarChart3, Boxes, Brain, Database, Image as ImageIcon, Layers, Search, Sparkles } from "lucide-react";
import { hubApi, type HubModuleSummary, type HubOverview } from "../hub/hubApi";
import { CATEGORY_STYLE, GlassPanel, ModuleCard, StatTile } from "../hub/HubCard";

export default function HubOverviewPage() {
  const [overview, setOverview] = useState<HubOverview | null>(null);
  const [modules, setModules] = useState<HubModuleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([hubApi.overview(), hubApi.modules()])
      .then(([o, m]) => {
        if (!cancelled) {
          setOverview(o);
          setModules(m);
        }
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Hub unavailable"));
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return modules.filter((m) =>
      (category === "All" || m.category === category)
      && (!q || `${m.title} ${m.tagline} ${m.tech.join(" ")} ${m.slug}`.toLowerCase().includes(q)));
  }, [modules, category, query]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-6">
      <GlassPanel className="overflow-hidden p-6 md:p-8">
        <div className="ci-orb -left-10 -top-10 h-56 w-56 bg-sky-500/40" />
        <div className="ci-orb -bottom-16 right-10 h-64 w-64 bg-fuchsia-500/30" />
        <div className="ci-scanline" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-sky-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> CARDIO INTELLIGENCE · Intelligence Hub
          </div>
          <h1 className="ci-gradient-text mt-3 text-3xl font-semibold leading-tight md:text-5xl">
            Every cardiovascular project, one living system.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-muted md:text-base">
            {overview
              ? `${overview.modules} inherited projects with their features, ${overview.models3d} 3D anatomy models, ${overview.images} screenshots, ${overview.datasets} datasets and ${overview.metrics} evaluation metrics, read from the projects themselves.`
              : "Loading the inherited projects…"}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/hub/anatomy" className="ci-chip hover:border-sky-400/60"><Boxes className="h-3.5 w-3.5" aria-hidden /> 3D Anatomy Gallery</Link>
            <Link to="/hub/benchmarks" className="ci-chip hover:border-sky-400/60"><BarChart3 className="h-3.5 w-3.5" aria-hidden /> Model Benchmarks</Link>
            <Link to="/hub/apps" className="ci-chip hover:border-sky-400/60"><AppWindow className="h-3.5 w-3.5" aria-hidden /> Live Module Apps</Link>
          </div>
        </div>
      </GlassPanel>

      {error && <GlassPanel className="p-4 text-sm text-red-300">{error}</GlassPanel>}

      {overview && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Projects" value={overview.modules} icon={Layers} />
          <StatTile label="3D models" value={overview.models3d} icon={Boxes} tint="167 139 250" />
          <StatTile label="Screenshots" value={overview.images} icon={ImageIcon} tint="236 72 153" />
          <StatTile label="Datasets" value={overview.datasets} icon={Database} tint="45 212 191" />
          <StatTile label="ML models" value={overview.ml_models} icon={Brain} tint="250 204 21" />
          <StatTile label="Metrics" value={overview.metrics} icon={BarChart3} tint="96 165 250" />
        </div>
      )}

      <GlassPanel className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-2">
          {["All", ...Object.keys(CATEGORY_STYLE)].map((c) => (
            <button key={c} type="button" className="ci-chip" data-active={category === c} onClick={() => setCategory(c)}>
              {c}
              {overview && c !== "All" && <span className="text-ink-faint">{overview.categories[c] ?? 0}</span>}
            </button>
          ))}
        </div>
        <label className="relative md:ml-auto md:w-72">
          <span className="sr-only">Search projects</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, tech, features…"
            className="w-full rounded-full border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-ink-primary placeholder:text-ink-faint focus:border-sky-400/60"
          />
        </label>
      </GlassPanel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visible.map((m) => (
          <ModuleCard key={m.slug} module={m} />
        ))}
      </div>
      {overview && visible.length === 0 && (
        <GlassPanel className="p-6 text-center text-sm text-ink-muted">No project matches this filter.</GlassPanel>
      )}

      {overview && (
        <GlassPanel className="p-5">
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Technology across the hub</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(overview.tech).map(([tech, count]) => (
              <span key={tech} className="ci-chip">{tech}<span className="text-sky-300">{count}</span></span>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

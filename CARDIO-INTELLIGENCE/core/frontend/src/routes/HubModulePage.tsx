/** One inherited project: its features, docs, screenshots, 3D anatomy, metrics, data and live app. */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppWindow, ArrowLeft, BarChart3, Boxes, Database, FileCode2, Image as ImageIcon, Layers, Terminal, X } from "lucide-react";
import { formatBytes, headlineMetric, hubApi, type HubDatasetPreview, type HubModuleDetail } from "../hub/hubApi";
import { GlassPanel, HubImage, MetricBadge, categoryStyle } from "../hub/HubCard";
import { HubMarkdown } from "../hub/HubMarkdown";
import { HubModelViewer } from "../hub/HubModelViewer";
import { useHubBlobUrl } from "../hub/hubAssets";

type Tab = "overview" | "gallery" | "anatomy" | "metrics" | "data" | "files" | "live";

function Lightbox({ slug, path, onClose }: { slug: string; path: string; onClose: () => void }) {
  const { url } = useHubBlobUrl(slug, path);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white" aria-label="Close" onClick={onClose}>
        <X className="h-5 w-5" />
      </button>
      {url && <img src={url} alt={path} className="max-h-[88vh] max-w-[92vw] rounded-2xl border border-white/10 object-contain" />}
    </div>
  );
}

function DatasetTable({ slug, path }: { slug: string; path: string }) {
  const [preview, setPreview] = useState<HubDatasetPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    hubApi.dataset(slug, path, 30)
      .then((p) => !cancelled && setPreview(p))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Unavailable"));
    return () => {
      cancelled = true;
    };
  }, [slug, path]);
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!preview) return <p className="text-sm text-ink-muted">Loading preview…</p>;
  return (
    <div>
      <p className="mb-2 text-xs text-ink-muted">{preview.total_rows.toLocaleString()} rows · {preview.columns.length} columns · first {preview.rows.length} shown</p>
      <div className="max-h-[420px] overflow-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900/90 backdrop-blur">
            <tr>{preview.columns.map((c, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-medium text-sky-200">{c}</th>)}</tr>
          </thead>
          <tbody>
            {preview.rows.map((row, r) => (
              <tr key={r} className="border-t border-white/5 odd:bg-white/[0.02]">
                {row.map((cell, c) => <td key={c} className="whitespace-nowrap px-3 py-1.5 text-ink-body">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HubModulePage() {
  const { slug = "" } = useParams();
  const [module, setModule] = useState<HubModuleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [modelIndex, setModelIndex] = useState(0);
  const [datasetPath, setDatasetPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setModule(null);
    setError(null);
    setTab("overview");
    setModelIndex(0);
    hubApi.module(slug)
      .then((m) => {
        if (cancelled) return;
        setModule(m);
        setDatasetPath(m.datasets[0]?.path ?? null);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Unknown project"));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const metricsBySource = useMemo(() => {
    const groups: Record<string, HubModuleDetail["metrics"]> = {};
    for (const m of module?.metrics ?? []) (groups[m.source] ??= []).push(m);
    return groups;
  }, [module]);

  if (error) return <div className="p-6"><GlassPanel className="p-6 text-sm text-red-300">{error}</GlassPanel></div>;
  if (!module) return <div className="p-6 text-sm text-ink-muted">Loading project…</div>;

  const { icon: Icon, tint } = categoryStyle(module.category);
  const tabs: { id: Tab; label: string; count?: number; icon: typeof Layers; show: boolean }[] = [
    { id: "overview", label: "Overview", icon: Layers, show: true },
    { id: "gallery", label: "Gallery", count: module.images.length, icon: ImageIcon, show: module.images.length > 0 },
    { id: "anatomy", label: "3D Anatomy", count: module.models3d.length, icon: Boxes, show: module.models3d.length > 0 },
    { id: "metrics", label: "Metrics", count: module.metrics.length, icon: BarChart3, show: module.metrics.length > 0 },
    { id: "data", label: "Data", count: module.datasets.length, icon: Database, show: module.datasets.length > 0 },
    { id: "files", label: "Files & Run", icon: Terminal, show: true },
    { id: "live", label: "Live App", icon: AppWindow, show: module.live_app },
  ];
  const model = module.models3d[modelIndex];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 md:px-6">
      <Link to="/hub" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-sky-300">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Intelligence Hub
      </Link>

      <GlassPanel className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.3fr_1fr]">
          <div className="relative p-6 md:p-8">
            <div className="ci-orb -left-10 -top-10 h-48 w-48" style={{ background: `rgb(${tint} / 0.4)` }} />
            <div className="relative">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: `rgb(${tint})` }}>
                <Icon className="h-3.5 w-3.5" aria-hidden /> {module.category}
              </div>
              <h1 className="ci-gradient-text mt-3 text-3xl font-semibold leading-tight md:text-4xl">{module.title}</h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{module.tagline}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {module.tech.map((t) => <span key={t} className="ci-chip">{t}</span>)}
                <MetricBadge metric={headlineMetric(module.metrics)} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
                {([["Files", module.counts.files], ["Features", module.counts.features], ["3D", module.counts.models3d],
                  ["Images", module.counts.images], ["Datasets", module.counts.datasets], ["ML models", module.counts.ml_models]] as const)
                  .map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/5 bg-black/20 px-2 py-2">
                      <div className="ci-neon-number text-lg font-semibold">{value}</div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <HubImage slug={module.slug} path={module.hero_image} alt={`${module.title} preview`} className="min-h-[220px]" />
        </div>
      </GlassPanel>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Project sections">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ci-chip !px-3.5 !py-1.5 !text-xs" data-active={tab === t.id} onClick={() => setTab(t.id)}>
            <t.icon className="h-3.5 w-3.5" aria-hidden /> {t.label}{t.count !== undefined && <span className="text-ink-faint">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
          <GlassPanel className="h-fit p-5">
            <h2 className="text-sm font-semibold text-ink-primary">Features inherited</h2>
            {module.features.length ? (
              <ul className="mt-3 space-y-2">
                {module.features.map((f, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-body">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-ink-muted">The original project lists no features; see its files and data.</p>
            )}
          </GlassPanel>
          <GlassPanel className="p-6">
            {module.readme ? <HubMarkdown slug={module.slug} markdown={module.readme} readmePath={module.readme_path} /> : (
              <p className="text-sm text-ink-muted">This project shipped without a README.</p>
            )}
          </GlassPanel>
        </div>
      )}

      {tab === "gallery" && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {module.images.map((img) => (
            <button key={img.path} type="button" onClick={() => setLightbox(img.path)} className="text-left">
              <GlassPanel interactive className="overflow-hidden">
                <HubImage slug={module.slug} path={img.path} alt={img.name} className="h-40 w-full" />
                <div className="truncate px-3 py-2 text-[11px] text-ink-muted" title={img.path}>{img.path}</div>
              </GlassPanel>
            </button>
          ))}
        </div>
      )}

      {tab === "anatomy" && model && (
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <GlassPanel className="p-3">
            <HubModelViewer key={model.path} slug={module.slug} path={model.path} format={model.format ?? "stl"} className="h-[520px]" />
          </GlassPanel>
          <GlassPanel className="max-h-[560px] overflow-auto p-3">
            {module.models3d.map((m, i) => (
              <button key={m.path} type="button" onClick={() => setModelIndex(i)}
                className={`mb-1.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs ${i === modelIndex ? "bg-sky-500/15 text-sky-100 ring-1 ring-sky-400/50" : "text-ink-body hover:bg-white/5"}`}>
                <Boxes className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate" title={m.path}>{m.name}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] uppercase text-ink-faint">{m.format} · {formatBytes(m.size)}</span>
              </button>
            ))}
          </GlassPanel>
        </div>
      )}

      {tab === "metrics" && (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(metricsBySource).map(([source, items]) => (
            <GlassPanel key={source} className="p-5">
              <div className="truncate font-mono text-[11px] text-sky-300" title={source}>{source}</div>
              <div className="mt-3 space-y-2.5">
                {items.slice(0, 12).map((m) => {
                  const pct = m.value >= 0 && m.value <= 1 ? m.value * 100 : null;
                  return (
                    <div key={m.name}>
                      <div className="flex justify-between gap-3 text-xs">
                        <span className="truncate text-ink-body" title={m.name}>{m.name}</span>
                        <span className="ci-neon-number font-mono">{m.value.toFixed(3)}</span>
                      </div>
                      {pct !== null && (
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
          ))}
          <p className="text-[11px] text-ink-faint md:col-span-2">Metrics are read from the project's own evaluation files; they have not been re-validated by CARDIO INTELLIGENCE.</p>
        </div>
      )}

      {tab === "data" && (
        <GlassPanel className="p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {module.datasets.slice(0, 30).map((d) => (
              <button key={d.path} type="button" className="ci-chip" data-active={datasetPath === d.path} onClick={() => setDatasetPath(d.path)} title={d.path}>
                <Database className="h-3 w-3" aria-hidden />{d.name}<span className="text-ink-faint">{formatBytes(d.size)}</span>
              </button>
            ))}
          </div>
          {datasetPath && <DatasetTable slug={module.slug} path={datasetPath} />}
        </GlassPanel>
      )}

      {tab === "files" && (
        <div className="grid gap-4 md:grid-cols-2">
          <GlassPanel className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-primary"><Terminal className="h-4 w-4 text-sky-300" aria-hidden />Run it</h2>
            {module.run_commands.length ? (
              <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[12px] leading-6 text-sky-100">
                {`cd CARDIO-INTELLIGENCE/modules/${module.slug}\n${module.run_commands.join("\n")}`}
              </pre>
            ) : <p className="mt-3 text-[13px] text-ink-muted">No run commands documented by the original project.</p>}
            <div className="mt-4 text-[11px] text-ink-faint">Languages: {Object.entries(module.languages).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"}</div>
          </GlassPanel>
          <GlassPanel className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-primary"><FileCode2 className="h-4 w-4 text-sky-300" aria-hidden />Models & notebooks</h2>
            <ul className="mt-3 space-y-1.5 text-xs">
              {[...module.ml_models, ...module.notebooks].slice(0, 40).map((f) => (
                <li key={f.path} className="flex justify-between gap-3 text-ink-body">
                  <span className="truncate" title={f.path}>{f.path}</span>
                  <span className="shrink-0 font-mono text-ink-faint">{formatBytes(f.size)}</span>
                </li>
              ))}
              {!module.ml_models.length && !module.notebooks.length && <li className="text-ink-muted">None in this project.</li>}
            </ul>
          </GlassPanel>
        </div>
      )}

      {tab === "live" && module.live_app && (
        <GlassPanel className="overflow-hidden p-2">
          <iframe title={`${module.title} live app`} src={hubApi.liveAppUrl(module.slug)} className="h-[78vh] w-full rounded-xl border-0 bg-black" />
        </GlassPanel>
      )}

      {lightbox && <Lightbox slug={module.slug} path={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

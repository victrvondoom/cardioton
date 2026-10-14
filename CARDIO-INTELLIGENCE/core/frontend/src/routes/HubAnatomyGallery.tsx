/** Every 3D anatomy model shipped by the inherited projects, in one viewer. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, Search } from "lucide-react";
import { formatBytes, hubApi, type HubFile, type HubModuleDetail } from "../hub/hubApi";
import { GlassPanel } from "../hub/HubCard";
import { HubModelViewer } from "../hub/HubModelViewer";

interface GalleryModel extends HubFile {
  slug: string;
  moduleTitle: string;
}

export default function HubAnatomyGallery() {
  const [models, setModels] = useState<GalleryModel[]>([]);
  const [selected, setSelected] = useState<GalleryModel | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    hubApi.modules()
      .then((all) => Promise.all(all.filter((m) => m.counts.models3d > 0).map((m) => hubApi.module(m.slug))))
      .then((details: HubModuleDetail[]) => {
        if (cancelled) return;
        const list = details.flatMap((d) => d.models3d.map((f) => ({ ...f, slug: d.slug, moduleTitle: d.title })));
        setModels(list);
        setSelected(list.find((m) => m.format === "glb") ?? list[0] ?? null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? models.filter((m) => `${m.name} ${m.moduleTitle} ${m.path}`.toLowerCase().includes(q)) : models;
  }, [models, query]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 md:px-6">
      <div>
        <h1 className="ci-gradient-text text-3xl font-semibold">3D Anatomy Gallery</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {loading ? "Collecting models…" : `${models.length} hearts, vessels and valves from ${new Set(models.map((m) => m.slug)).size} projects. Drag to orbit, scroll to zoom.`}
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <GlassPanel className="p-3">
          {selected ? (
            <>
              <HubModelViewer key={`${selected.slug}/${selected.path}`} slug={selected.slug} path={selected.path} format={selected.format ?? "stl"} className="h-[600px]" />
              <div className="flex items-center justify-between px-2 pt-3 text-xs">
                <span className="text-ink-body">{selected.name}</span>
                <Link to={`/hub/${selected.slug}`} className="text-sky-300 hover:underline">{selected.moduleTitle} →</Link>
              </div>
            </>
          ) : <div className="flex h-[600px] items-center justify-center text-sm text-ink-muted">{loading ? "Loading…" : "No 3D models found."}</div>}
        </GlassPanel>
        <GlassPanel className="flex max-h-[680px] flex-col p-3">
          <label className="relative mb-3">
            <span className="sr-only">Filter models</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter models…"
              className="w-full rounded-full border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-ink-primary placeholder:text-ink-faint" />
          </label>
          <div className="overflow-auto">
            {visible.map((m) => {
              const active = selected?.slug === m.slug && selected.path === m.path;
              return (
                <button key={`${m.slug}/${m.path}`} type="button" onClick={() => setSelected(m)}
                  className={`mb-1.5 flex w-full flex-col rounded-xl px-3 py-2 text-left ${active ? "bg-sky-500/15 ring-1 ring-sky-400/50" : "hover:bg-white/5"}`}>
                  <span className="flex items-center gap-2 text-xs text-ink-primary"><Boxes className="h-3.5 w-3.5 text-sky-300" aria-hidden />{m.name}</span>
                  <span className="mt-0.5 truncate pl-5 text-[10px] text-ink-faint">{m.moduleTitle} · {m.format?.toUpperCase()} · {formatBytes(m.size)}</span>
                </button>
              );
            })}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

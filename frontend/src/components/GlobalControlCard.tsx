import { Activity, ArrowUpRight, Globe2, Layers3, Map as MapIcon, Radio, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useLive } from "../lib/useLive";
import { Link } from "react-router-dom";

import { aqua } from "../aquahealth/api";
import type { EcosystemStatus, MapPoint } from "../aquahealth/types";

const ObservationGlobe = lazy(() => import("../globe/ObservationGlobe"));
const AquaHealthMapLibre = lazy(() => import("../globe/AquaHealthMapLibre"));

type RegionId = "all" | "north-america" | "europe" | "asia-pacific" | "africa" | "latin-america";
type MacroRegion = "amer" | "emea" | "apac";
type GlobalControlCardProps = {
  /** Current regional selection. Omit to let the card own its selection. */
  region?: RegionId;
  /** Fires immediately whenever the selection changes, including map clicks. */
  onRegionChange?: (region: RegionId | MacroRegion) => void;
};
type Region = {
  id: RegionId;
  label: string;
  bounds?: [[number, number], [number, number]];
  center: [number, number];
  contains: (longitude: number, latitude: number) => boolean;
};

const REGIONS: Region[] = [
  { id: "all", label: "All regions", bounds: [[-170, -55], [175, 75]], center: [15, 20], contains: () => true },
  { id: "north-america", label: "North America", bounds: [[-168, 7], [-50, 72]], center: [-105, 42], contains: (lon, lat) => lon >= -168 && lon <= -50 && lat >= 7 && lat <= 72 },
  { id: "europe", label: "Europe", bounds: [[-25, 34], [45, 72]], center: [12, 52], contains: (lon, lat) => lon >= -25 && lon <= 45 && lat >= 34 && lat <= 72 },
  { id: "asia-pacific", label: "Asia-Pacific", bounds: [[45, -48], [179, 72]], center: [115, 15], contains: (lon, lat) => lon >= 45 && lon <= 179 && lat >= -48 && lat <= 72 },
  { id: "africa", label: "Africa", bounds: [[-20, -36], [52, 38]], center: [20, 1], contains: (lon, lat) => lon >= -20 && lon <= 52 && lat >= -36 && lat <= 38 },
  { id: "latin-america", label: "Latin America", bounds: [[-118, -56], [-30, 33]], center: [-72, -12], contains: (lon, lat) => lon >= -118 && lon <= -30 && lat >= -56 && lat <= 33 },
];

const STATUS_HEX: Record<EcosystemStatus, string> = {
  critical_signal: "#F0442B",
  potential_stress: "#FFB400",
  watch: "#39A9E8",
  healthy_signal: "#59DFA6",
  insufficient_data: "#96979E",
};

function regionAtCoordinate(longitude: number, latitude: number): RegionId {
  // Use the smallest matching land-region envelope first to resolve overlaps
  // around Africa, Europe and Latin America consistently.
  const order: RegionId[] = ["europe", "africa", "latin-america", "north-america", "asia-pacific"];
  return order.find((id) => REGIONS.find((region) => region.id === id)?.contains(longitude, latitude)) ?? "all";
}

function Metric({ label, value, icon, accent = "text-ink-primary" }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="min-w-0 rounded border border-surface-border bg-surface-panel px-3 py-2.5 transition-colors hover:border-accent-cyan/30">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${accent}`}>{value}</div>
    </div>
  );
}

/** Data-backed regional context card for the AquaHealth overview dashboard. */
export default function GlobalControlCard({ region: controlledRegion, onRegionChange }: GlobalControlCardProps) {
  const mapFeed = useLive(aqua.map);
  const data = mapFeed.data;
  const error = mapFeed.error;
  const [internalRegion, setInternalRegion] = useState<RegionId>(controlledRegion ?? "all");
  const regionId = controlledRegion ?? internalRegion;
  const [query, setQuery] = useState("");
  const [macro, setMacro] = useState<MacroRegion | null>(null);
  const [view, setView] = useState<"map" | "globe">("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const region = REGIONS.find((item) => item.id === regionId) ?? REGIONS[0];
  const scopeLabel = macro ? ({ amer: "Americas", emea: "Europe, Middle East & Africa", apac: "Asia-Pacific" } as const)[macro] : region.label;
  const regionPoints = useMemo(() => {
    const points = data?.points ?? [];
    const regional = points.filter((point) => {
      if (macro) {
        if (macro === "amer") return point.longitude >= -170 && point.longitude <= -30 && point.latitude >= -56 && point.latitude <= 72;
        if (macro === "emea") return point.longitude >= -25 && point.longitude <= 60 && point.latitude >= -36 && point.latitude <= 72;
        return point.longitude > 60 && point.longitude <= 180 && point.latitude >= -48 && point.latitude <= 72;
      }
      return regionId === "all" || region.contains(point.longitude, point.latitude);
    });
    const needle = query.trim().toLocaleLowerCase();
    return needle ? regional.filter((point) => `${point.waterbody_name} ${point.reference}`.toLocaleLowerCase().includes(needle)) : regional;
  }, [data, region, regionId, query, macro]);
  const globeMarkers = useMemo(() => regionPoints.map((point) => ({
    id: point.observation_id,
    latitude: point.latitude,
    longitude: point.longitude,
    label: `${point.reference} · ${point.waterbody_name}`,
    color: STATUS_HEX[point.status],
  })), [regionPoints]);
  const selectedPoint = regionPoints.find((point) => point.observation_id === selectedId) ?? null;
  const focus = useMemo(() => ({ latitude: region.center[1], longitude: region.center[0], key: region.id }), [region]);
  const changeRegion = useCallback((next: RegionId) => {
    setMacro(null);
    setInternalRegion(next);
    setSelectedId(null);
    onRegionChange?.(next);
  }, [onRegionChange]);
  const changeMacro = (next: MacroRegion) => {
    setMacro(next);
    setInternalRegion("all");
    setSelectedId(null);
    onRegionChange?.(next);
  };
  const handleMapClick = useCallback((longitude: number, latitude: number) => {
    changeRegion(regionAtCoordinate(longitude, latitude));
  }, [changeRegion]);
  const handleGlobeSurfaceSelect = useCallback((latitude: number, longitude: number) => {
    changeRegion(regionAtCoordinate(longitude, latitude));
  }, [changeRegion]);
  const selectPoint = useCallback((point: MapPoint) => setSelectedId(point.observation_id), []);

  const needingReview = regionPoints.filter((point) => point.review_status !== "completed").length;
  const elevatedSignals = regionPoints.filter((point) => point.status === "critical_signal" || point.status === "potential_stress").length;

  return (
    <section aria-labelledby="global-control-title" className="relative mb-6 overflow-hidden rounded border border-surface-border bg-surface-raised p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-cyan">AquaHealth · Network overview</span>
            <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${error ? "border-accent-amber/40 bg-accent-amber/10 text-accent-amber" : "border-accent-green/40 bg-accent-green/10 text-accent-green"}`}>
              <span className={`h-1.5 w-1.5 rounded ${error ? "bg-accent-amber" : "bg-accent-green"}`} />{error ? data ? "Last known data" : "Unavailable" : mapFeed.loading ? data ? "Refreshing" : "Connecting" : "Data current"}
            </span>
          </div>
          <h2 id="global-control-title" className="mt-1.5 text-xl font-semibold tracking-tight text-ink-primary sm:text-2xl">Global Control</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-body">Explore mapped freshwater observations by region. Choose a region, or tap a location on the map or globe to update this view.</p>
        </div>
        <div className="flex shrink-0 rounded border border-surface-border bg-surface-panel p-1" role="group" aria-label="Visualization mode">
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs text-ink-body transition-colors hover:text-ink-primary aria-pressed:bg-accent-cyan/15 aria-pressed:text-ink-primary"><MapIcon size={13} aria-hidden="true" />Map</button>
          <button type="button" aria-pressed={view === "globe"} onClick={() => setView("globe")} className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs text-ink-body transition-colors hover:text-ink-primary aria-pressed:bg-accent-cyan/15 aria-pressed:text-ink-primary"><Globe2 size={13} aria-hidden="true" />3D Globe</button>
        </div>
      </div>

      {error && <p role="status" className="mt-3 text-xs text-accent-amber">Observation refresh unavailable: {error}{data ? ". Last successful observations remain visible." : ""}</p>}

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" aria-label="Regional controls">
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter observations by macro-region">
          {([ ["amer", "AMER"], ["emea", "EMEA"], ["apac", "APAC"] ] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={macro === id} onClick={() => changeMacro(id)} className="shrink-0 rounded border border-surface-border bg-surface-panel px-3 py-1.5 text-[11px] text-ink-body transition-colors hover:border-accent-cyan/40 hover:bg-accent-cyan/[0.08] hover:text-ink-primary aria-pressed:border-accent-cyan/50 aria-pressed:bg-accent-cyan/15 aria-pressed:text-ink-primary">{label}</button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter observations by region">
          {REGIONS.map((item) => (
            <button key={item.id} type="button" aria-pressed={regionId === item.id} onClick={() => changeRegion(item.id)} className="shrink-0 rounded border border-surface-border bg-surface-panel px-3 py-1.5 text-[11px] text-ink-body transition-colors hover:border-accent-cyan/40 hover:bg-accent-cyan/[0.08] hover:text-ink-primary aria-pressed:border-accent-cyan/50 aria-pressed:bg-accent-cyan/15 aria-pressed:text-ink-primary">
              {item.label}
            </button>
          ))}
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[190px] flex-1 lg:max-w-[250px]">
            <Search size={13} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search waterbody or reference" aria-label="Search observations" className="w-full rounded border border-surface-border bg-surface-bg py-2 pl-8 pr-3 text-xs text-ink-primary placeholder:text-ink-faint outline-none transition-colors focus:border-accent-cyan/60" />
          </label>
          <button type="button" onClick={() => { setQuery(""); changeRegion("all"); }} className="inline-flex min-h-9 items-center gap-1.5 rounded border border-accent-cyan/30 bg-accent-cyan/10 px-3 text-[11px] font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-cyan"><RotateCcw size={12} aria-hidden="true" />Reset to global</button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-muted"><Radio size={12} className="text-accent-cyan" aria-hidden="true" /><span>{scopeLabel}</span><span className="text-ink-faint">/</span><span>{regionPoints.length} mapped observation{regionPoints.length === 1 ? "" : "s"}</span></div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(250px,0.8fr)]">
        <div className="min-w-0 overflow-hidden rounded border border-surface-border bg-surface-bg">
          <Suspense fallback={<div className="h-[300px] animate-pulse bg-surface-panel p-4 text-xs text-ink-muted" role="status">Loading visualization…</div>}>
            {view === "map" ? (
              <AquaHealthMapLibre points={regionPoints} selectedId={selectedId} onSelect={selectPoint} viewBounds={region.bounds} onCoordinateClick={handleMapClick} />
            ) : (
              <ObservationGlobe markers={globeMarkers} selectedId={selectedId} onSelect={setSelectedId} focus={focus} onSurfaceSelect={handleGlobeSurfaceSelect} />
            )}
          </Suspense>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Observations" value={data ? String(regionPoints.length) : "—"} icon={<Activity size={11} />} />
            <Metric label="Needs review" value={data ? String(needingReview) : "—"} icon={<ShieldCheck size={11} />} accent={needingReview ? "text-accent-amber" : "text-ink-primary"} />
            <Metric label="Elevated signals" value={data ? String(elevatedSignals) : "—"} icon={<Radio size={11} />} accent={elevatedSignals ? "text-accent-red" : "text-ink-primary"} />
            <Metric label="Data presence" value={data ? (regionPoints.length ? "Mapped" : "No data") : "—"} icon={<Layers3 size={11} />} accent="text-accent-cyan" />
          </div>

          <div className="flex min-h-[76px] flex-1 flex-col justify-center rounded border border-surface-border bg-surface-panel p-3">
            {selectedPoint ? (
              <>
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Selected observation</div>
                <div className="mt-1 truncate text-sm font-medium text-ink-primary">{selectedPoint.waterbody_name}</div>
                <div className="mt-0.5 text-[10px] text-ink-faint">{selectedPoint.reference} · {selectedPoint.status.replaceAll("_", " ")}</div>
                <Link to={`/aquahealth/observations/${selectedPoint.observation_id}`} className="mt-1.5 inline-flex w-fit items-center gap-1 text-[10px] text-accent-cyan hover:text-ink-primary">Open record <ArrowUpRight size={11} aria-hidden="true" /></Link>
              </>
            ) : (
              <>
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Regional context</div>
                <div className="mt-1 text-xs leading-relaxed text-ink-body">{regionPoints.length ? `${regionPoints.filter((point) => point.is_demo).length} demonstration · ${regionPoints.filter((point) => !point.is_demo).length} contributor records` : "No mapped observations in this region yet."}</div>
                <p className="mt-1 text-[9px] text-ink-faint">Signals are informational and require human review.</p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[9px] text-ink-faint">
        <span>Regional totals reflect mapped observations available to this account.</span>
        <Link to="/aquahealth/map" className="inline-flex items-center gap-1 text-ink-body transition-colors hover:text-accent-cyan">Open full map <ArrowUpRight size={11} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

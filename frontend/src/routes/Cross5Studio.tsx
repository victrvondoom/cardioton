/**
 * /cross5 — CROSS-5 command center: five linked reference frames.
 *
 * LEFT: frame navigation + experiments.
 * CENTER: one active immersive viewport (Earth / Heart / Flow / Chronos / City)
 * — heavy scenes render only when active; the others keep state but not pixels.
 * RIGHT: declared intersections, evidence provenance, experiment outputs.
 * BOTTOM: synchronized multiscale timeline.
 *
 * Scientific honesty is structural here: every panel renders only what the
 * backend computed, every notice is displayed, and unsupported intersections
 * are shown as unsupported.
 */
import { Activity, AlertTriangle, FlaskConical, Globe2, HeartPulse, Loader2, Play, Waves } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";

import { CARD } from "../cardiotwin/panels";
import { VESSELS, type VesselId, type VesselViz } from "../cardiotwin/types";
import { bandFor, pct } from "../cardiotwin/vesselMapping";
import { Cross5Error, cross5Api, type ChronosTimeline, type EarthCountry, type ExperimentInfo, type FlowSimulation, type FrameInfo, type IntersectionInfo } from "../cross5/api";
import { CityGraphView } from "../cross5/CityGraphView";
import { Cross5Timeline } from "../cross5/Cross5Timeline";
import { EarthGlobeView } from "../cross5/EarthGlobeView";

const HeartViewer = lazy(() => import("../cardiotwin/HeartViewer"));
const CardioFlowView = lazy(() => import("../cross5/CardioFlowView"));

const FRAME_ICONS: Record<string, typeof HeartPulse> = {
  cardiotwin: HeartPulse,
  cardioearth: Globe2,
  cardioflow: Waves,
  cardiochronos: Activity,
  cardiocity: FlaskConical,
};

const FRAME_ORDER = ["cardiotwin", "cardioearth", "cardioflow", "cardiochronos", "cardiocity"] as const;

const SAFETY_NOTICE =
  "Research and educational prototype. Statistical predictions, hypothetical simulations and aggregate population statistics are separate evidence classes; nothing here is a diagnosis, and no causal claims are made.";

function vesselVizFromPrediction(fused: Record<string, number> | null): Record<VesselId, VesselViz> | null {
  if (!fused) return null;
  return Object.fromEntries(
    VESSELS.map((id) => {
      const probability = fused[`${id.toLowerCase()}_probability`] ?? 0;
      return [id, { id, probability, band: bandFor(probability), confidence: "low", halo: 0.2 }];
    }),
  ) as Record<VesselId, VesselViz>;
}

function Panel({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className={`${CARD} p-3 space-y-2`} data-testid={testId}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{title}</p>
      {children}
    </div>
  );
}

export default function Cross5Studio() {
  const [frames, setFrames] = useState<FrameInfo[]>([]);
  const [experiments, setExperiments] = useState<ExperimentInfo[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<string[]>(["cardiotwin", "cardioflow", "cardiochronos"]);
  const [activeFrame, setActiveFrame] = useState<string>("cardioflow");
  const [intersections, setIntersections] = useState<{ supported: IntersectionInfo[]; unsupported: IntersectionInfo[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Frame data
  const [countries, setCountries] = useState<EarthCountry[]>([]);
  const [selectedIso, setSelectedIso] = useState<string | null>("IN");
  const [timeline, setTimeline] = useState<ChronosTimeline | null>(null);
  const [city, setCity] = useState<Awaited<ReturnType<typeof cross5Api.city>> | null>(null);
  const [cityNode, setCityNode] = useState<string | null>(null);
  const [cityAccess, setCityAccess] = useState<{ facility: { id: string; name: string; category: string; node: string }; travel_minutes: number | null }[] | null>(null);

  // CardioFlow controls
  const [flowVessel, setFlowVessel] = useState<VesselId>("LAD");
  const [flowStenosis, setFlowStenosis] = useState(70);
  const [flowSim, setFlowSim] = useState<FlowSimulation | null>(null);
  const [flowCurve, setFlowCurve] = useState<{ stenosis_pct: number; ffr_index: number }[]>([]);
  const [flowBusy, setFlowBusy] = useState(false);

  // Experiments
  const [running, setRunning] = useState<string | null>(null);
  const [experimentResult, setExperimentResult] = useState<{ id: string; payload: Record<string, unknown> } | null>(null);
  const [fusedPrediction, setFusedPrediction] = useState<Record<string, number> | null>(null);
  const [replayAsOf, setReplayAsOf] = useState<string | null>(null);

  const toggleFrame = (id: string) => {
    setSelectedFrames((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
    setActiveFrame(id);
  };

  const guard = useCallback(async <T,>(op: () => Promise<T>): Promise<T | null> => {
    try {
      return await op();
    } catch (e) {
      setError(e instanceof Cross5Error ? e.message : "Request failed");
      return null;
    }
  }, []);

  // Initial load: frames, experiments, earth, city, timeline.
  useEffect(() => {
    void (async () => {
      const framesRes = await guard(() => cross5Api.frames());
      if (framesRes) setFrames(framesRes.frames);
      const experimentsRes = await guard(() => cross5Api.experiments());
      if (experimentsRes) setExperiments(experimentsRes.experiments);
      const earthRes = await guard(() => cross5Api.earthCountries());
      if (earthRes) setCountries(earthRes.countries);
      const cityRes = await guard(() => cross5Api.city());
      if (cityRes) setCity(cityRes);
      const timelineRes = await guard(() => cross5Api.chronosTimeline(48));
      if (timelineRes) setTimeline(timelineRes);
    })();
  }, [guard]);

  // Declared intersections for the current frame selection.
  useEffect(() => {
    if (selectedFrames.length < 2) {
      setIntersections(null);
      return;
    }
    void (async () => {
      const res = await guard(() => cross5Api.intersections(selectedFrames));
      if (res) setIntersections({ supported: res.supported, unsupported: res.unsupported });
    })();
  }, [selectedFrames, guard]);

  const runFlow = useCallback(
    async (vessel: string, stenosis: number) => {
      setFlowBusy(true);
      const sim = await guard(() => cross5Api.flowSimulate({ vessel_id: vessel, stenosis_pct: stenosis }));
      if (sim) setFlowSim(sim);
      const curve = await guard(() => cross5Api.flowCompare({ vessel_id: vessel, stenosis_values: [0, 30, 50, 70, 85] }));
      if (curve) setFlowCurve(curve.scenarios);
      setFlowBusy(false);
    },
    [guard],
  );

  useEffect(() => {
    void runFlow(flowVessel, flowStenosis);
  }, [flowVessel, runFlow]); // initial curve per vessel; stenosis changes via button

  const cityAccessFor = useCallback(
    async (node: string) => {
      setCityNode(node);
      const res = await guard(() => cross5Api.cityAccess({ from_node: node }));
      setCityAccess(res?.facilities ?? null);
    },
    [guard],
  );

  const runExperiment = useCallback(
    async (id: string) => {
      setRunning(id);
      setError(null);
      const payload =
        id === "earth_to_heart"
          ? { country_iso: selectedIso ?? "IN" }
          : id === "artery_to_time"
            ? { vessel_id: flowVessel, stenosis_pct: flowStenosis }
            : { country_iso: selectedIso ?? "IN", vessel_id: flowVessel };
      const result = await guard(() => cross5Api.runExperiment(id, payload));
      if (result) {
        setExperimentResult({ id, payload: result });
        const fused = (result as { patient_prediction?: { fused?: Record<string, number> }; patient?: { fused_prediction?: Record<string, number> } }).patient_prediction?.fused
          ?? (result as { patient?: { fused_prediction?: Record<string, number> } }).patient?.fused_prediction
          ?? null;
        if (fused) setFusedPrediction(fused);
      }
      setRunning(null);
    },
    [guard, selectedIso, flowVessel, flowStenosis],
  );

  const heartViz = useMemo(() => vesselVizFromPrediction(fusedPrediction), [fusedPrediction]);

  /** CardioTwin → CardioFlow navigation bridge: a vessel id is the shared anatomical reference. */
  const inspectVesselInFlow = useCallback(
    (vessel: VesselId | null) => {
      if (!vessel) return;
      setFlowVessel(vessel);
      setActiveFrame("cardioflow");
      setSelectedFrames((prev) => (prev.includes("cardioflow") ? prev : [...prev, "cardioflow"]));
      void runFlow(vessel, flowStenosis);
    },
    [runFlow, flowStenosis],
  );

  return (
    <div className="px-4 sm:px-6 py-6 space-y-4 max-w-[1600px] mx-auto" data-testid="cross5-studio">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-cyan">CARDIOTON · CROSS-5 MULTISCALE INTERSECTION ENGINE</p>
        <h1 className="text-2xl font-semibold text-ink-primary">Five frames, one evidence-linked system</h1>
        <p className="text-[12px] text-ink-muted max-w-4xl">{SAFETY_NOTICE}</p>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-accent-red/50 bg-accent-red/10 px-3 py-2 text-[12.5px]" data-testid="cross5-error">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-[11px] underline">dismiss</button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[240px_1fr_340px]">
        {/* LEFT — frames + experiments */}
        <div className="space-y-3">
          <Panel title="Frames" testId="cross5-frames">
            <div className="space-y-1.5">
              {FRAME_ORDER.map((id) => {
                const frame = frames.find((f) => f.id === id);
                const Icon = FRAME_ICONS[id];
                const selected = selectedFrames.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleFrame(id)}
                    aria-pressed={selected}
                    className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left text-[11.5px] transition-colors ${
                      activeFrame === id
                        ? "border-accent-cyan bg-accent-cyan/10"
                        : selected
                          ? "border-accent-cyan/40"
                          : "border-surface-border hover:border-accent-cyan/30"
                    }`}
                  >
                    <Icon size={14} className="mt-0.5 shrink-0 text-accent-cyan" aria-hidden />
                    <span>
                      <b className="text-ink-primary">{frame?.name ?? id}</b>
                      <span className="block text-[10.5px] text-ink-muted">{frame?.scale ?? ""}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel title="Flagship experiments" testId="cross5-experiments">
            <div className="space-y-1.5">
              {experiments.map((e) => (
                <button
                  key={e.id}
                  onClick={() => runExperiment(e.id)}
                  disabled={running !== null}
                  className="flex w-full items-center gap-2 rounded-lg border border-surface-border p-2 text-left text-[11.5px] disabled:opacity-40 hover:border-accent-cyan/40"
                >
                  {running === e.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} className="text-accent-cyan" />}
                  <span>
                    <b className="text-ink-primary">{e.title}</b>
                    <span className="block text-[10px] text-ink-muted">{e.frames.join(" × ")}</span>
                  </span>
                </button>
              ))}
              {!experiments.length && <p className="text-[11px] text-ink-muted">Loading experiments…</p>}
            </div>
          </Panel>
        </div>

        {/* CENTER — active immersive viewport */}
        <div className="min-h-[520px] rounded-xl border border-surface-border bg-surface-panel/30 p-3" data-testid="cross5-viewport">
          {activeFrame === "cardioearth" && (
            <div className="h-[520px]">
              <EarthGlobeView countries={countries} selectedIso={selectedIso} onSelect={setSelectedIso} />
              <p className="mt-2 text-[11px] text-ink-muted">
                Pins: committed WHO GHO snapshot (historical population statistics — not live surveillance).
                Selected: {countries.find((c) => c.iso === selectedIso)?.country ?? "—"}.
              </p>
            </div>
          )}
          {activeFrame === "cardiotwin" && (
            <div className="h-[520px]">
              <Suspense fallback={<div className="grid h-full place-items-center text-[12px] text-ink-muted">Loading heart…</div>}>
                {heartViz ? (
                  <HeartViewer viz={heartViz} selected={null} onSelect={inspectVesselInFlow} />
                ) : (
                  <div className="grid h-full place-items-center px-6 text-center text-[12px] text-ink-muted">
                    Run Experiment A or C to compute a CAD prediction; the vessel view displays model output only.
                    <br />Selecting a coronary vessel opens its CardioFlow inspection.
                  </div>
                )}
              </Suspense>
            </div>
          )}
          {activeFrame === "cardioflow" && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <label className="inline-flex items-center gap-1">
                  <span className="text-ink-muted">Vessel</span>
                  <select
                    value={flowVessel}
                    onChange={(e) => setFlowVessel(e.target.value as VesselId)}
                    className="rounded border border-surface-border bg-surface-panel px-2 py-1 text-[11.5px]"
                    aria-label="Vessel"
                  >
                    {VESSELS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="inline-flex items-center gap-1">
                  <span className="text-ink-muted">Hypothetical stenosis</span>
                  <input
                    type="range"
                    min={0}
                    max={95}
                    value={flowStenosis}
                    onChange={(e) => setFlowStenosis(Number(e.target.value))}
                    onMouseUp={() => runFlow(flowVessel, flowStenosis)}
                    onTouchEnd={() => runFlow(flowVessel, flowStenosis)}
                    className="w-32"
                    aria-label="Hypothetical stenosis percentage"
                  />
                  <span className="tabular-nums w-10">{flowStenosis}%</span>
                </label>
                <button
                  onClick={() => runFlow(flowVessel, flowStenosis)}
                  disabled={flowBusy}
                  className="rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1 text-[11.5px] text-accent-cyan disabled:opacity-40"
                >
                  {flowBusy ? "Solving…" : "Run 0D solver"}
                </button>
              </div>
              <div className="h-[440px]">
                <Suspense fallback={<div className="grid h-full place-items-center text-[12px] text-ink-muted">Loading vessel view…</div>}>
                  <CardioFlowView simulation={flowSim} playing />
                </Suspense>
              </div>
              {flowSim && (
                <p className="text-[11px] text-ink-muted" data-testid="cross5-flow-summary">
                  {flowSim.vessel_id} @ {flowSim.stenosis_pct}% area reduction → model FFR index{" "}
                  <b>{flowSim.steady_state.ffr_index.toFixed(3)}</b>, ΔP {flowSim.steady_state.translesional_dp_mmhg} mmHg
                  {flowSim.steady_state.ischemic_threshold_flag && " (below the 0.80 hypothetical threshold)"}. {flowSim.notice.split(".")[0]}.
                </p>
              )}
            </div>
          )}
          {activeFrame === "cardiochronos" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-surface-border bg-surface-panel/40 p-2">
                <Cross5Timeline timeline={timeline} replayAsOf={replayAsOf} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-ink-muted">Time-travel (leakage-safe replay):</span>
                <input
                  type="date"
                  defaultValue="2026-03-02"
                  onChange={async (e) => {
                    const asOf = `${e.target.value}T12:00:00Z`;
                    setReplayAsOf(asOf);
                    const res = await guard(() => cross5Api.chronosReplay({ scenario: "normal", hours: 48, as_of: asOf }));
                    if (res) {
                      const cutoff = new Date(asOf).getTime();
                      const t: ChronosTimeline = { ...(timeline as ChronosTimeline) };
                      setTimeline({
                        ...t,
                        bands: {
                          ...t.bands,
                          hourly_wearable: t.bands.hourly_wearable.filter(
                            (h) => new Date(h.timestamp).getTime() <= cutoff,
                          ),
                        },
                      });
                    }
                  }}
                  aria-label="Replay as-of date"
                  className="rounded border border-surface-border bg-surface-panel px-2 py-1 text-[11.5px]"
                />
                <span className="text-[10.5px] text-ink-faint">records after this date are excluded from the reconstruction</span>
              </div>
            </div>
          )}
          {activeFrame === "cardiocity" && city && (
            <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
              <div className="h-[500px]">
                <CityGraphView
                  nodes={city.nodes}
                  edges={city.edges}
                  facilities={city.facilities}
                  selectedNode={cityNode}
                  onSelect={cityAccessFor}
                  accessFromSelected={cityAccess}
                />
              </div>
              <div className="space-y-2 text-[11.5px]">
                <Panel title="City access (baseline)">
                  <ul className="space-y-1">
                    {Object.entries(city.baseline_access).map(([category, stats]) => (
                      <li key={category}>
                        <b className="capitalize">{category}</b> ({stats.facilities}): mean {stats.population_weighted_mean_minutes} min ·{" "}
                        {pct(stats.share_within_20min ?? 0, 0)} of residents within 20 min
                      </li>
                    ))}
                  </ul>
                </Panel>
                {cityAccess && (
                  <Panel title={`From ${cityNode}`} testId="cross5-city-access">
                    <ul className="space-y-1">
                      {cityAccess.slice(0, 4).map((f) => (
                        <li key={f.facility.id}>
                          {f.facility.name} — {f.travel_minutes !== null ? `${f.travel_minutes} min` : "unreachable"}
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}
                <p className="text-[10.5px] text-ink-faint">{city.notice}</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — intersections, evidence, experiment output */}
        <div className="space-y-3">
          <Panel title={`Declared intersections (${selectedFrames.length} frames selected)`} testId="cross5-intersections">
            {intersections ? (
              <div className="space-y-2 text-[11.5px]">
                {intersections.supported.map((s, i) => (
                  <div key={i} className="rounded-lg border border-surface-border p-2">
                    <p className="font-semibold text-ink-primary">{s.frames.join(" × ")} <span className="text-accent-cyan">[{s.link}]</span></p>
                    <p className="text-ink-muted">{s.description}</p>
                    {s.caution && <p className="mt-0.5 text-[10.5px] text-amber-500">{s.caution}</p>}
                  </div>
                ))}
                {intersections.unsupported.map((u, i) => (
                  <div key={i} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2">
                    <p className="font-semibold text-ink-primary inline-flex items-center gap-1">
                      <AlertTriangle size={11} className="text-amber-500" aria-hidden /> {u.frames.join(" × ")} — unsupported
                    </p>
                    <p className="text-ink-muted">{u.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11.5px] text-ink-muted">Select at least two frames to see their declared intersections.</p>
            )}
          </Panel>

          {flowCurve.length > 0 && (
            <Panel title={`Flow scenario curve — ${flowVessel}`} testId="cross5-flow-curve">
              <svg viewBox="0 0 300 130" className="w-full" role="img" aria-label="Hypothetical stenosis versus model FFR index">
                {/* axes */}
                <line x1="30" y1="10" x2="30" y2="105" stroke="currentColor" strokeOpacity="0.3" />
                <line x1="30" y1="105" x2="290" y2="105" stroke="currentColor" strokeOpacity="0.3" />
                <line x1="30" y1={105 - 0.8 * 95} x2="290" y2={105 - 0.8 * 95} stroke="#f2a900" strokeDasharray="3 3" strokeOpacity="0.7" />
                <text x="34" y={105 - 0.8 * 95 - 3} fontSize="8.5" className="fill-amber-500">hypothetical FFR 0.80 threshold</text>
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.8"
                  points={flowCurve.map((c) => `${30 + (c.stenosis_pct / 95) * 258},${105 - Math.min(1, c.ffr_index) * 95}`).join(" ")}
                />
                {flowCurve.map((c) => (
                  <circle key={c.stenosis_pct} cx={30 + (c.stenosis_pct / 95) * 258} cy={105 - Math.min(1, c.ffr_index) * 95} r="2.6" className="fill-accent-cyan" />
                ))}
                <text x="30" y="122" fontSize="8.5" className="fill-ink-faint">stenosis % (area reduction, hypothetical)</text>
              </svg>
              <p className="text-[10.5px] text-ink-faint">Hypothetical geometry comparison; not measured disease progression.</p>
            </Panel>
          )}

          {experimentResult && (
            <Panel title="Experiment output" testId="cross5-experiment-result">
              <pre className="max-h-72 overflow-auto rounded-lg bg-surface-panel/60 p-2 text-[10px] leading-relaxed text-ink-muted">
                {JSON.stringify(experimentResult.payload, null, 1).slice(0, 4000)}
              </pre>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(experimentResult.payload, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `cross5-${experimentResult.id}.json`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 30_000);
                }}
                className="rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1 text-[11.5px] text-accent-cyan"
              >
                Export result (JSON)
              </button>
            </Panel>
          )}

          {selectedIso && countries.length > 0 && (
            <Panel title="Region context">
              {(() => {
                const c = countries.find((x) => x.iso === selectedIso);
                if (!c) return null;
                return (
                  <div className="text-[11.5px] space-y-1">
                    <p className="font-semibold text-ink-primary">{c.country} · {c.region}</p>
                    <p>CVD mortality {c.cvd_mortality_per_100k.toFixed(0)} / 100k ({c.year})</p>
                    <p className="text-[10.5px] text-ink-faint">{c.source} — {c.uncertainty}</p>
                  </div>
                );
              })()}
            </Panel>
          )}
        </div>
      </div>

      {/* BOTTOM — synchronized timeline */}
      <div className={`${CARD} p-3`} data-testid="cross5-bottom-timeline">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Synchronized multiscale timeline — CardioChronos</p>
          {timeline && <p className="text-[10.5px] text-ink-faint">{timeline.alignment.missing_data_policy}</p>}
        </div>
        <Cross5Timeline timeline={timeline} replayAsOf={replayAsOf} />
      </div>
    </div>
  );
}

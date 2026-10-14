import { Component, lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, HeartPulse, Layers3, Maximize2, Pause, Play, RotateCcw, Rotate3D, Scan, Waves } from "lucide-react";
import { HEMO_AXES, type HemoAxisKey, type HemoEvidence, type HemoSnapshot } from "./hemoTypes";
import { selectSceneHeartRate } from "./hemoSceneEvidence";
import "./hemo-scene.css";

const HemoHeartCanvas = lazy(() => import("./HemoHeartCanvas"));
const STRUCTURES = [
  ["LEFT_VENTRICLE", "Left ventricle"], ["RIGHT_VENTRICLE", "Right ventricle"],
  ["LEFT_ATRIUM", "Left atrium"], ["RIGHT_ATRIUM", "Right atrium"],
  ["AORTA", "Aorta"], ["PULMONARY_ARTERY", "Pulmonary artery"],
  ["LAD", "LAD coronary artery"], ["RCA", "Right coronary artery"], ["LCX", "Circumflex artery"],
  ["VENA_CAVA", "Vena cava"], ["PULMONARY_VEINS", "Pulmonary veins"], ["CORONARY_VEINS", "Coronary veins"],
  ["INTERVENTRICULAR_SEPTUM", "Interventricular septum"], ["PAPILLARY_MUSCLE", "Papillary muscle"],
  ["MITRAL_VALVE", "Mitral valve"], ["TRICUSPID_VALVE", "Tricuspid valve"],
  ["AORTIC_VALVE", "Aortic valve"], ["PULMONARY_VALVE", "Pulmonary valve"],
] as const;
export type HeartCameraView = "anterior" | "posterior" | "left";

function supportsWebGL() {
  if (typeof window === "undefined" || (!window.WebGLRenderingContext && !window.WebGL2RenderingContext)) return false;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch { return false; }
}

class HeartSceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Anatomy is generic; qualitative evidence states never deform the reference organ. */
export default function HemoStateScene({ snapshot, onSelect, evidence = [], asOf = snapshot.timestamp, recentDays = 14, pending = false }: {
  snapshot: HemoSnapshot; onSelect: (axis: HemoAxisKey) => void; evidence?: HemoEvidence[]; asOf?: string; recentDays?: number; pending?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const viewport = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const [supported] = useState(supportsWebGL);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(() => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== "hidden");
  const [motion, setMotion] = useState(true);
  const [rotate, setRotate] = useState(false);
  const [cutaway, setCutaway] = useState(false);
  const [vessels, setVessels] = useState(true);
  const [flow, setFlow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<HeartCameraView>("anterior");
  const [reset, setReset] = useState(0);
  const [structure, setStructure] = useState<string | null>(null);
  const [axisSelection, setAxisSelection] = useState<HemoAxisKey | null>(null);
  const heartRate = useMemo(() => selectSceneHeartRate(evidence, asOf, recentDays), [evidence, asOf, recentDays]);
  const usable = supported && !failed;
  const animated = motion && !reduced && visible && pageVisible;
  const spinning = rotate && !reduced && visible && pageVisible;
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => { setFailed(true); setReady(false); }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener?.("change", change);
    return () => media.removeEventListener?.("change", change);
  }, []);
  useEffect(() => {
    const change = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    if (!viewport.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .01)), { threshold: .01 });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [expanded]);
  useLayoutEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (!expanded) {
      if (!modal.open) {
        if (typeof modal.show === "function") modal.show();
        else modal.setAttribute("open", "");
      }
      return;
    }
    if (typeof modal.showModal === "function") {
      if (modal.open) modal.close();
      modal.showModal();
    } else modal.setAttribute("open", "");
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (modal.open && typeof modal.close === "function") modal.close();
      window.requestAnimationFrame(() => expandButton.current?.focus());
    };
  }, [expanded]);

  const preview = <div className="hemo-scene__preview">
    <img src="/models/heart-reference-preview.png" alt="Detailed human heart reference anatomy, with illustrative vessels" />
    <span>{usable ? "Loading detailed 3D anatomy…" : "Reference render · 3D interaction unavailable in this browser"}</span>
  </div>;

  const content = <figure className={`hemo-scene${expanded ? " hemo-scene--expanded" : ""}`} aria-labelledby={`${id}-title`} data-testid="hemo-realistic-scene">
    <figcaption className="hemo-scene__caption">
      <div><span className="hemo-scene__eyebrow"><Layers3 size={13} aria-hidden /> Cardiovascular state / anatomy studio</span><h3 id={`${id}-title`}>Explore the heart. Follow the evidence.</h3></div>
      <div className="hemo-scene__caption-actions"><span className="hemo-scene__tag">HUMAN REFERENCE ANATOMY</span><button ref={expandButton} type="button" onClick={() => setExpanded(value => !value)} aria-pressed={expanded} aria-label={expanded ? "Reduce heart viewer" : "Expand heart viewer"}><Maximize2 size={14} aria-hidden /> {expanded ? "Compact" : "Expand"}</button></div>
    </figcaption>

    <div className="hemo-scene__toolbar" role="group" aria-label="Heart presentation controls">
      <button type="button" onClick={() => setMotion(value => !value)} disabled={!usable || reduced} aria-pressed={motion && !reduced} aria-label={motion && !reduced ? "Pause illustrative heartbeat" : "Play illustrative heartbeat"}>{motion && !reduced ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />} {reduced ? "Reduced motion" : motion ? "Pause pulse" : "Play pulse"}</button>
      <button type="button" onClick={() => setRotate(value => !value)} disabled={!usable || reduced} aria-pressed={rotate && !reduced}><Rotate3D size={14} aria-hidden /> Auto rotate</button>
      <button type="button" onClick={() => setCutaway(value => !value)} disabled={!usable} aria-pressed={cutaway}><Scan size={14} aria-hidden /> Cutaway</button>
      <button type="button" onClick={() => setVessels(value => !value)} disabled={!usable} aria-pressed={vessels}><Layers3 size={13} aria-hidden /> Vessels</button>
      <button type="button" onClick={() => setFlow(value => !value)} disabled={!usable || reduced || !vessels} aria-pressed={flow}><Waves size={14} aria-hidden /> Illustrative flow</button>
      <button type="button" onClick={() => { setView("anterior"); setReset(value => value + 1); setStructure(null); }} disabled={!usable}><RotateCcw size={13} aria-hidden /> Reset view</button>
    </div>

    <div className="hemo-scene__space">
      <div ref={viewport} className="hemo-scene__viewport" role="region" aria-label="Interactive 3D reference heart">
        <div className="hemo-scene__studio-glow" aria-hidden="true" />
        {(!usable || !ready) && preview}
        {usable && <HeartSceneBoundary fallback={preview} onFailure={onFailure}><Suspense fallback={null}>
          <HemoHeartCanvas animated={animated} rotate={spinning} cutaway={cutaway} vesselsVisible={vessels} flowVisible={flow && vessels} view={view} reset={reset} selectedStructure={structure} onSelectStructure={setStructure} onReady={onReady} onFailure={onFailure} />
        </Suspense></HeartSceneBoundary>}
        <div className="hemo-scene__model-caption"><span>{ready && usable ? "3D ANATOMY / HRA" : "HRA REFERENCE"}</span><p>{structure ? structure.replace(/_/g, " ").toLowerCase() : "Drag to orbit · Scroll or pinch to zoom"}</p></div>
      </div>
      <ul className="hemo-scene__axes" aria-label="Spatial cardiovascular state">
        {HEMO_AXES.map(([key, label], index) => {
          const axis = snapshot[key];
          return <li key={key} className={`hemo-scene__axis hemo-scene__axis--${index % 2 === 0 ? "left" : "right"}`} style={{ gridRow: Math.floor(index / 2) + 1 }}>
            {pending ? <div className="hemo-scene__node hemo-scene__node--unknown"><span className="hemo-scene__node-label">{label}</span><strong>Reconstructing…</strong></div> : <button type="button" className={`hemo-scene__node hemo-scene__node--${axis.level.toLowerCase()}`} onClick={() => {
              setAxisSelection(key); onSelect(key);
              if (expanded) {
                setExpanded(false);
                window.requestAnimationFrame(() => document.getElementById("hemo-why")?.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "start" }));
              }
            }} aria-pressed={axisSelection === key} aria-label={`Inspect ${label} state: ${axis.level}. ${axis.classification}. ${axis.confidence} confidence.`}>
              <span className="hemo-scene__node-label">{label}<ArrowUpRight size={12} aria-hidden /></span><strong>{axis.level}</strong><span className="hemo-scene__node-meta">{axis.classification} · {axis.confidence}</span><small>{axis.evidence_refs.length} linked {axis.evidence_refs.length === 1 ? "record" : "records"}</small>
            </button>}
          </li>;
        })}
      </ul>
    </div>

    <div className="hemo-scene__view-controls">
      <div role="group" aria-label="Anatomical camera views">{(["anterior", "posterior", "left"] as const).map(direction => <button key={direction} type="button" onClick={() => { setView(direction); setReset(value => value + 1); }} aria-pressed={view === direction} disabled={!usable}>{direction === "left" ? "Left lateral" : direction.charAt(0).toUpperCase() + direction.slice(1)}</button>)}</div>
      <label>Inspect anatomy<select aria-label="Inspect reference anatomy" value={structure ?? ""} onChange={event => setStructure(event.target.value || null)} disabled={!usable}><option value="">Whole heart</option>{STRUCTURES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    </div>

    {!pending && axisSelection && <aside className="hemo-scene__selection" aria-label="Selected cardiovascular evidence">
      <div><strong>{HEMO_AXES.find(([key]) => key === axisSelection)?.[1]} · {snapshot[axisSelection].level}</strong><p>{snapshot[axisSelection].explanation}</p><small>{snapshot[axisSelection].classification} · {snapshot[axisSelection].confidence} confidence · {snapshot[axisSelection].evidence_refs.length} source references</small></div>
      <button type="button" onClick={() => {
        onSelect(axisSelection);
        setExpanded(false);
        window.requestAnimationFrame(() => document.getElementById("hemo-why")?.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "start" }));
      }}>Open linked evidence <ArrowUpRight size={12} aria-hidden /></button>
    </aside>}

    {pending ? <p role="status" className="hemo-scene__note">Loading the selected evidence window. Anatomy controls remain available; source readouts are withheld until reconstruction completes.</p> : <dl className="hemo-scene__readouts" aria-label="Current reconstruction context">
      <div><dt><HeartPulse size={12} aria-hidden /> Dated heart-rate observation</dt><dd>{heartRate.value === null ? "UNKNOWN" : `${heartRate.value} bpm`}</dd><small>{heartRate.status === "observed" && heartRate.observedAt ? `${new Date(heartRate.observedAt).toISOString().slice(0, 10)} · OBSERVED source; not live telemetry` : heartRate.reason}</small></div>
      <div><dt>Reconstructed state</dt><dd>{snapshot.congestion.stage.replace(/_/g, " ")}</dd><small>{snapshot.congestion.confidence} confidence · human interpretation required</small></div>
      <div><dt>Evidence available</dt><dd>{snapshot.evidence_refs.length} linked records</dd><small>As of {asOf.slice(0, 10)} · both time boundaries applied</small></div>
    </dl>}
    <p className="hemo-scene__note">Generic human reference anatomy, with illustrative vessels and presentation motion. Spatial position is schematic; shape, pulse and flow do not represent patient imaging or measured hemodynamics. UNKNOWN means evidence is missing, stale or conflicting.</p>
    <details className="hemo-scene__credit"><summary>Reference model and attribution</summary><p>HRA / HuBMAP Visible Human Male heart · Kristen Browne and the Human Reference Atlas contributors · CC BY 4.0. Display materials and vessel additions are illustrative.</p></details>
  </figure>;
  return <dialog ref={dialog} open role={expanded ? "dialog" : "region"} aria-modal={expanded ? true : undefined} className={`hemo-scene-host${expanded ? " hemo-scene-dialog" : ""}`} aria-label={expanded ? "Expanded heart viewer" : "Heart anatomy viewer"} onCancel={event => { event.preventDefault(); setExpanded(false); }}>{content}</dialog>;
}

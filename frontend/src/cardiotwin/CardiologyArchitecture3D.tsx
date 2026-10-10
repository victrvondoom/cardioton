import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Activity, ArrowUpRight, Database, Globe2, HeartPulse, Layers3, MousePointer2, Pause, Play, RefreshCw, RotateCcw, ShieldCheck, Stethoscope, ZoomIn } from "lucide-react";
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import RealisticHeart from "./RealisticHeart";
import { Link } from "react-router-dom";
import { useLive } from "../lib/useLive";
import { fetchArchitectureLive, type ArchitectureNodeLive } from "./architectureLive";
import "./cardiology-architecture.css";

type NodeSpec = { id: string; label: string; detail: string; color: string; description: string };

const NODES: NodeSpec[] = [
  { id: "experience", label: "Clinical workspace", detail: "Reviewer workflow · React", color: "#54d8e8", description: "The clinician's review workspace brings the case, its evidence, and the next governed action together." },
  { id: "api", label: "Clinical API", detail: "FastAPI · auth · review gates", color: "#78a9ff", description: "The clinical API connects the workspace to authenticated services and clinician review gates." },
  { id: "cardiotwin", label: "CardioTwin", detail: "Model output · clinician interpretation required", color: "#ff6781", description: "CardioTwin produces cardiac risk estimates from supplied patient features for qualified clinician interpretation." },
  { id: "evidence", label: "Evidence store", detail: "Case evidence and provenance", color: "#efb755", description: "Case information and its provenance remain connected to the evidence used during review." },
  { id: "receiver", label: "System B", detail: "FHIR/OAH receiver · governed exchange", color: "#69d29b", description: "The configured receiver participates in approved FHIR/OAH exchange across the care workflow." },
];

const EDGES: [string, string, string][] = [
  ["experience", "api", "HTTPS / same origin"],
  ["api", "cardiotwin", "cardiac risk estimates"],
  ["api", "evidence", "persist + provenance"],
  ["api", "receiver", "approved FHIR/OAH transfer"],
];

const NODE_ICONS = { experience: Stethoscope, api: Layers3, cardiotwin: HeartPulse, evidence: Database, receiver: Globe2 };

class SceneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function ContextMonitor({ onUnavailable }: { onUnavailable: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.domElement.addEventListener("webglcontextlost", onUnavailable);
    return () => gl.domElement.removeEventListener("webglcontextlost", onUnavailable);
  }, [gl, onUnavailable]);
  return null;
}

function CameraControls({ resetKey, touchOrbit }: { resetKey: number; touchOrbit: boolean }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useRef<ThreeOrbitControls | null>(null);
  useEffect(() => {
    const orbit = new ThreeOrbitControls(camera, gl.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.07;
    orbit.enablePan = false;
    orbit.minDistance = 4.8;
    orbit.maxDistance = 9;
    orbit.minPolarAngle = 0.6;
    orbit.maxPolarAngle = 2.3;
    orbit.rotateSpeed = 0.65;
    orbit.zoomSpeed = 0.75;
    orbit.target.set(0, 0.12, 0);
    orbit.update();
    orbit.saveState();
    gl.domElement.tabIndex = 0;
    gl.domElement.setAttribute("aria-label", "Heart anatomy viewer. Arrow keys rotate, plus and minus zoom, Home resets the view.");
    const keyboard = (event: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_", "Home"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Home") { orbit.reset(); return; }
      const offset = camera.position.clone().sub(orbit.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      const step = Math.PI / 18;
      if (event.key === "ArrowLeft") spherical.theta -= step;
      if (event.key === "ArrowRight") spherical.theta += step;
      if (event.key === "ArrowUp") spherical.phi -= step;
      if (event.key === "ArrowDown") spherical.phi += step;
      if (event.key === "+" || event.key === "=") spherical.radius *= .9;
      if (event.key === "-" || event.key === "_") spherical.radius /= .9;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, orbit.minPolarAngle, orbit.maxPolarAngle);
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, orbit.minDistance, orbit.maxDistance);
      camera.position.copy(orbit.target).add(offset.setFromSpherical(spherical));
      orbit.update();
      invalidate();
    };
    gl.domElement.addEventListener("keydown", keyboard);
    const refresh = () => invalidate();
    orbit.addEventListener("change", refresh);
    controls.current = orbit;
    return () => {
      controls.current = null;
      gl.domElement.removeEventListener("keydown", keyboard);
      orbit.removeEventListener("change", refresh);
      orbit.dispose();
    };
  }, [camera, gl, invalidate]);
  useEffect(() => {
    if (!controls.current) return;
    controls.current.touches.ONE = touchOrbit ? THREE.TOUCH.ROTATE : null;
    controls.current.touches.TWO = touchOrbit ? THREE.TOUCH.DOLLY_ROTATE : null;
    gl.domElement.style.touchAction = touchOrbit ? "none" : "pan-y";
  }, [gl, touchOrbit]);
  useEffect(() => { controls.current?.reset(); }, [resetKey]);
  useFrame(() => controls.current?.update());
  return null;
}

function ContactShadow() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: "varying vec2 vUv; void main(){vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);}",
    fragmentShader: "varying vec2 vUv; void main(){vec2 p=(vUv-0.5)*2.0; float a=exp(-dot(p,p)*4.6)*0.52; gl_FragColor=vec4(0.005,0.01,0.018,a);}",
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh position={[0, -1.75, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}><planeGeometry args={[4.5, 2.8]} /></mesh>;
}

function ArchitectureScene({ animated, resetKey, touchOrbit, onReady }: { animated: boolean; resetKey: number; touchOrbit: boolean; onReady: (ready: boolean) => void }) {
  useEffect(() => { onReady(true); }, [onReady]);
  return <>
    <hemisphereLight args={["#e7f1f3", "#182331", 0.75]} />
    <directionalLight position={[-3.5, 5, 5]} intensity={3.1} color="#fff2e7" />
    <directionalLight position={[4, 0.8, 4]} intensity={0.8} color="#b4d6e0" />
    <spotLight position={[2, 4, -3]} intensity={65} angle={0.6} penumbra={0.8} color="#bfdce5" />
    <spotLight position={[-4, 0, 0]} intensity={12} angle={0.7} penumbra={1} color="#deb5a7" />
    <RealisticHeart animated={animated} />
    <ContactShadow />
    <CameraControls resetKey={resetKey} touchOrbit={touchOrbit} />
  </>;
}

function StaticHeart({ unavailable = false }: { unavailable?: boolean }) {
  return <div className="cardio-anatomy-fallback">
    <img className="cardio-anatomy-fallback__organ" src="/models/heart-reference-preview.png" width="762" height="457" alt="Reference human heart anatomy with illustrative vessels" />
    {unavailable && <p className="cardio-anatomy-fallback__message">Static anatomy preview · 3D rendering unavailable</p>}
  </div>;
}

function ComponentCard({ node, selected, observation, onSelect }: { node: NodeSpec; selected: boolean; observation?: ArchitectureNodeLive; onSelect: () => void }) {
  const Icon = NODE_ICONS[node.id as keyof typeof NODE_ICONS];
  const number = String(NODES.indexOf(node) + 1).padStart(2, "0");
  return <button type="button" data-node={node.id} className={`cardio-component${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={onSelect} style={{ "--component-accent": node.color } as CSSProperties}>
    <span className="cardio-component__top"><span className="cardio-component__icon"><Icon size={17} strokeWidth={1.5} aria-hidden="true" /></span><span className="cardio-component__number">{number}</span></span>
    <span className="cardio-component__name">{node.label}</span>
    <span className="cardio-component__detail">{observation?.label ?? "Checking service…"}</span>
    <span className={`cardio-component__status cardio-status--${observation?.status ?? "unknown"}`}><span />{observation?.probeMs != null ? `${observation.probeMs} ms probe` : selected ? "Selected · open details below" : "Select to explore"}</span>
  </button>;
}

function Connections({ selectedId, animated, revision }: { selectedId: string; animated: boolean; revision: string | undefined }) {
  const svg = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<{ id: string; d: string; color: string; related: boolean }[]>([]);
  useEffect(() => {
    const stage = svg.current?.parentElement;
    if (!stage) return;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      const center = stage.querySelector(".cardio-anatomy-stage__canvas")?.getBoundingClientRect();
      if (!center) return;
      const cy = center.top - bounds.top + center.height * .54;
      setPaths(EDGES.map(([a, b], index) => {
        const card = stage.querySelector(`[data-node="${b === "api" ? a : b}"]`)?.getBoundingClientRect();
        if (!card) return { id: b, d: "", color: "", related: false };
        const left = card.left < center.left;
        const x = (left ? card.right : card.left) - bounds.left;
        const y = card.top - bounds.top + card.height * .5;
        const endX = center.left - bounds.left + center.width * (left ? .31 : .69);
        const endY = cy + (index - 1.5) * 18;
        return { id: `${a}-${b}`, d: `M${x},${y} C${(x + endX) / 2},${y} ${(x + endX) / 2},${endY} ${endX},${endY}`, color: NODES.find(node => node.id === b)!.color, related: selectedId === a || selectedId === b };
      }));
      svg.current?.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    return () => observer.disconnect();
  }, [selectedId, revision]);
  return <svg ref={svg} className={`cardio-live-connections${animated ? " is-animated" : ""}`} aria-hidden="true">{paths.map(path => <g key={path.id} className={path.related ? "is-related" : ""} style={{ "--connection-color": path.color } as CSSProperties}><path d={path.d} /><path className="cardio-live-connections__flow" d={path.d} /></g>)}</svg>;
}

export default function CardiologyArchitecture3D() {
  const [selected, setSelected] = useState(NODES[2]);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [motion, setMotion] = useState(true);
  const [touchOrbit, setTouchOrbit] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const live = useLive(fetchArchitectureLive, [], 15_000);
  const reportContextLost = useCallback(() => setWebgl(false), []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    const canvas = document.createElement("canvas");
    try {
      const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
      setWebgl(Boolean(context));
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch { setWebgl(false); }
    return () => preference.removeEventListener("change", update);
  }, []);

  const animated = motion && !reducedMotion;
  const fallback = <StaticHeart unavailable />;
  const renderNode = (id: string) => {
    const node = NODES.find((item) => item.id === id)!;
    return <ComponentCard key={id} node={node} selected={selected.id === id} observation={live.data?.nodes[id]} onSelect={() => setSelected(node)} />;
  };

  return <section className="cardio-architecture" aria-labelledby="cardio-architecture-title">
    <header className="cardio-architecture__header">
      <div>
        <p className="cardio-architecture__eyebrow"><Activity size={14} aria-hidden="true" /> Cardiology · clinical architecture</p>
        <h2 id="cardio-architecture-title">Cardiac signal. Connected care.</h2>
        <p className="cardio-architecture__subtitle">Explore the services surrounding a clinician-governed cardiac workflow.</p>
      </div>
      <span className="cardio-review-badge"><ShieldCheck size={15} aria-hidden="true" /> Decision support · clinician review required</span>
    </header>

    <div className="cardio-live-toolbar">
      <span><span className="cardio-live-toolbar__dot" />{live.loading ? "Checking live services…" : live.data ? `Services checked ${new Date(live.data.checkedAt).toLocaleTimeString()}` : "Service checks unavailable"}</span>
      <button type="button" onClick={live.reload} disabled={live.loading}><RefreshCw size={12} aria-hidden />Recheck services</button>
    </div>
    {(live.error || !!live.data?.errors.length) && <p className="cardio-live-error" role="status">{live.error ?? live.data?.errors.join(" · ")}. Unverified components remain marked unavailable.</p>}

    <div className="cardio-architecture__stage">
      <div className="cardio-stage-grid" aria-hidden="true" />
      <Connections selectedId={selected.id} animated={animated} revision={live.data?.checkedAt} />
      <aside className="cardio-component-rail cardio-component-rail--left" aria-label="Clinical workflow components">
        <p className="cardio-rail-label">Clinical workflow</p>
        {["experience", "api", "evidence"].map(renderNode)}
      </aside>

      <div className="cardio-anatomy-stage">
        <div className="cardio-anatomy-stage__caption"><span className="cardio-anatomy-stage__mark" /> Anatomical visualization<span className="cardio-anatomy-stage__code">CV / 01</span></div>
        <div className="cardio-anatomy-stage__reticle" aria-hidden="true" />
        <div className="cardio-anatomy-stage__canvas" role="group" aria-label={webgl === false ? "Static reference heart anatomy" : "Interactive reference heart anatomy"}>
          {webgl === null ? <StaticHeart /> : webgl ? <SceneErrorBoundary fallback={fallback} onError={() => setWebgl(false)}>
            <Canvas camera={{ position: [0, 0.35, 7.2], fov: 34 }} dpr={[1, 1.75]} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0);
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 0.9;
            }}><ContextMonitor onUnavailable={reportContextLost} /><Suspense fallback={null}><ArchitectureScene animated={animated} resetKey={resetKey} touchOrbit={touchOrbit} onReady={setSceneReady} /></Suspense></Canvas>
            {!sceneReady && <div className="cardio-anatomy-loading" role="status"><StaticHeart /><p>Preparing reference anatomy…</p></div>}
          </SceneErrorBoundary> : fallback}
        </div>
        <div className="cardio-anatomy-stage__controls">
          <div className="cardio-anatomy-stage__gestures"><span><MousePointer2 size={12} aria-hidden="true" /> Drag to orbit</span><span><ZoomIn size={12} aria-hidden="true" /> Scroll to zoom</span></div>
          <p className="cardio-anatomy-stage__keyboard">Keyboard: arrows to orbit · + / − to zoom</p>
          <div className="cardio-anatomy-stage__buttons">
            <button type="button" onClick={() => setResetKey((key) => key + 1)} disabled={!webgl} aria-label="Reset heart viewing angle" title="Reset view"><RotateCcw size={14} aria-hidden="true" /><span>Reset view</span></button>
            <button type="button" onClick={() => setMotion((value) => !value)} disabled={reducedMotion} aria-pressed={animated} title={reducedMotion ? "Motion disabled by your reduced motion preference" : animated ? "Pause scene motion" : "Resume scene motion"}>{animated ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}<span>{reducedMotion ? "Reduced motion" : animated ? "Pause motion" : "Resume motion"}</span></button>
          </div>
          <button className="cardio-touch-toggle" type="button" onClick={() => setTouchOrbit(value => !value)} disabled={!webgl} aria-pressed={touchOrbit}>{touchOrbit ? "Turn off touch orbit" : "Enable touch orbit"}</button>
        </div>
        <p className="cardio-anatomy-stage__disclaimer">Illustrative anatomy · not patient imaging</p>
      </div>

      <aside className="cardio-component-rail cardio-component-rail--right" aria-label="Model and interoperability components">
        <p className="cardio-rail-label">Analysis & exchange</p>
        {["cardiotwin", "receiver"].map(renderNode)}
        <div className="cardio-stage-note"><ShieldCheck size={17} aria-hidden="true" /><p>Evidence follows the case.<br /><span>Decisions remain with the clinician.</span></p></div>
      </aside>
    </div>

    <div className="cardio-architecture__details">
      <div className="cardio-selected" aria-live="polite">
        <p className="cardio-section-label">Selected component <span style={{ background: selected.color }} /></p>
        <h3>{selected.label}</h3>
        <p className="cardio-selected__detail">{selected.detail}</p>
        <p className="cardio-selected__description">{selected.description}</p>
        {live.data?.nodes[selected.id] && <div className="cardio-selected__live" aria-live="polite">
          <strong className={`cardio-status--${live.data.nodes[selected.id].status}`}>{live.data.nodes[selected.id].label}</strong>
          <p>{live.data.nodes[selected.id].detail}</p>
          <span>{live.data.nodes[selected.id].checkedAt ? `Checked ${new Date(live.data.nodes[selected.id].checkedAt!).toLocaleTimeString()}` : "No successful check"}</span>
          <Link to={live.data.nodes[selected.id].to}>Open {selected.id === "evidence" || selected.id === "api" ? "service details" : selected.label}<ArrowUpRight size={12} aria-hidden /></Link>
        </div>}
        <p className="cardio-clinical-limitation"><ShieldCheck size={15} aria-hidden="true" /><span>CardioTwin outputs estimates from supplied patient features. They do not identify or localize coronary lesions; interpretation and decisions remain with qualified clinicians.</span></p>
      </div>
      <div className="cardio-connections">
        <p className="cardio-section-label">Care system connections</p>
        <ul>{EDGES.map(([a, b, label]) => {
          const source = NODES.find((node) => node.id === a)!;
          const target = NODES.find((node) => node.id === b)!;
          return <li key={`${a}-${b}`} className={selected.id === a || selected.id === b ? "is-related" : ""}><span className="cardio-connection-dot" style={{ backgroundColor: target.color }} /><div><p>{source.label}<span aria-hidden="true">→</span>{target.label}</p><span className="cardio-connection-detail">{label}</span></div></li>;
        })}</ul>
      </div>
    </div>
    <footer className="cardio-architecture__attribution">Reference anatomy: <a href="https://humanatlas.io/3d-reference-library" target="_blank" rel="noreferrer">Human Reference Atlas · CC BY 4.0</a><span>Visual reference, not a physiological simulation</span></footer>
  </section>;
}

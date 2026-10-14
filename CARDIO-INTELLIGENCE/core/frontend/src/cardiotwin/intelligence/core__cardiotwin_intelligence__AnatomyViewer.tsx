import { AdaptiveDpr, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ElementRef, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { HEMO_AXES } from "../hemoTypes";
import { approvedStructureFindings, normalizeStructureId, REFERENCE_STRUCTURES, type AnatomyViewerProps } from "./anatomyTypes";
import "./anatomy.css";

type Point = [number, number, number];
type Part = { id: string; key: string; geometry: THREE.BufferGeometry; anchor: THREE.Vector3; source: boolean; interior: boolean; color: string; inner?: THREE.BufferGeometry };

const MODEL_URL = "/models/hra-human-heart.glb";
const NODE_IDS: Record<string, string> = {
  VH_M_left_cardiac_atrium: "LA", VH_M_right_cardiac_atrium: "RA",
  VH_M_heart_left_ventricle: "LV", VH_M_heart_right_ventricle: "RV",
  VH_M_interventricular_septum: "SEPTUM", VH_M_mitral_valve: "MITRAL",
  VH_M_tricuspid_valve: "TRICUSPID", VH_M_pulmonary_valve: "PULMONARY_VALVE", VH_M_aortic_valve: "AORTIC_VALVE",
  VH_M_papillary_muscle_of_heart_anterior: "LV", VH_M_papillary_muscle_of_heart_anterolateral: "LV",
  VH_M_papillary_muscle_of_heart_posteromedial: "LV", VH_M_papillary_muscle_of_heart_medial: "RV", VH_M_papillary_muscle_of_heart_posterior: "RV",
};
const COLORS: Record<string, string> = {
  LA: "#bc8e9b", RA: "#ac8394", LV: "#b8636e", RV: "#bc7780", SEPTUM: "#be8a8d",
  MITRAL: "#e6cfb3", TRICUSPID: "#d8d0c0", PULMONARY_VALVE: "#c0d3d4", AORTIC_VALVE: "#e3c1ab",
  AORTA: "#bb7265", PULMONARY_ARTERY: "#6a96a6", VENA_CAVA: "#6f839e", PULMONARY_VEINS: "#b48a87",
  LAD: "#d7ac80", LCX: "#c9a27c", RCA: "#d7b18c",
};
const INTERIOR = new Set(["SEPTUM", "MITRAL", "TRICUSPID", "PULMONARY_VALVE", "AORTIC_VALVE"]);

/** Subscribe to changes, not just the preference at first mount. */
export function useReducedAnatomyMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function anatomyWebglAvailable() {
  try {
    if (typeof window.WebGLRenderingContext === "undefined" && typeof window.WebGL2RenderingContext === "undefined") return false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const supported = Boolean(context);
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return supported;
  } catch { return false; }
}

class AnatomyBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function tissueTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // Deterministic micro-surface detail, independent of any clinical data.
    const noise = ((Math.imul(x + 31, 374761393) ^ Math.imul(y + 7, 668265263)) >>> 0) / 4294967295;
    const fiber = Math.sin(x * .62 + Math.sin(y * .1) * 3 + y * .15);
    const level = 122 + noise * 30 + fiber * 20;
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = level;
    data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Clone geometry only; never mutate or dispose the loader's cached asset. */
function referenceParts(source: THREE.Group) {
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source);
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 2.35 / bounds.getSize(new THREE.Vector3()).y;
  const parts: Part[] = [];
  const surfaceMeshes: THREE.Mesh[] = [];
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const id = NODE_IDS[object.name];
    if (!id) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    geometry.translate(-center.x, -center.y, -center.z).scale(scale, scale, scale);
    const pos = geometry.getAttribute("position");
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = Math.atan2(pos.getZ(i), pos.getX(i)) / (2 * Math.PI) + .5;
      uv[i * 2 + 1] = (pos.getY(i) + 1.175) / 2.35;
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geometry.computeBoundingBox();
    const anchor = geometry.boundingBox!.getCenter(new THREE.Vector3());
    const interior = INTERIOR.has(id) || object.name.includes("papillary");
    parts.push({ id, key: object.name, geometry, anchor, source: true, interior, color: COLORS[id] });
    if (!interior) surfaceMeshes.push(new THREE.Mesh(geometry));
  });
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3(0, 0, -1);
  surfaceMeshes.forEach(mesh => mesh.updateMatrixWorld());
  const vessel = (id: string, points: Point[], radius: number, key: string, coronary = false) => {
    let curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, "centripetal");
    if (coronary) {
      const path = Array.from({ length: 54 }, (_, index) => {
        const point = curve.getPoint(index / 53);
        raycaster.set(new THREE.Vector3(point.x, point.y, 5), direction);
        const hit = raycaster.intersectObjects(surfaceMeshes, false)[0];
        return hit ? hit.point.clone().add(new THREE.Vector3(0, 0, radius * .8)) : null;
      }).filter((point): point is THREE.Vector3 => point !== null);
      if (path.length < 4) return;
      curve = new THREE.CatmullRomCurve3(path, false, "centripetal");
    }
    const geometry = new THREE.TubeGeometry(curve, coronary ? 64 : 38, radius, 10, false);
    // Independent, fixed layers illustrate a wall and lumen context; never stenosis geometry.
    const inner = new THREE.TubeGeometry(curve, coronary ? 64 : 38, radius * .64, 8, false);
    parts.push({ id, key, geometry, inner, anchor: curve.getPoint(.46), source: false, interior: false, color: COLORS[id] });
  };
  vessel("AORTA", [[-.25,.57,-.17],[-.29,1.1,-.19],[-.17,1.48,-.27],[.21,1.64,-.38],[.63,1.48,-.58],[.81,1.12,-.68]], .16, "aorta");
  vessel("AORTA", [[-.16,1.45,-.28],[-.3,1.75,-.27],[-.38,1.95,-.25]], .055, "aortic-branch-1");
  vessel("AORTA", [[.16,1.62,-.37],[.2,1.85,-.37],[.22,2.04,-.34]], .045, "aortic-branch-2");
  vessel("AORTA", [[.51,1.55,-.51],[.64,1.79,-.55],[.78,1.9,-.56]], .05, "aortic-branch-3");
  vessel("PULMONARY_ARTERY", [[.03,.6,.24],[-.06,1.02,.31],[-.22,1.34,.18],[-.55,1.44,.02],[-.86,1.37,-.06]], .145, "pulmonary-left");
  vessel("PULMONARY_ARTERY", [[-.2,1.28,.2],[.15,1.38,-.03],[.54,1.32,-.28],[.88,1.25,-.42]], .1, "pulmonary-right");
  vessel("VENA_CAVA", [[-.9,.6,-.09],[-.98,1.12,-.13],[-.87,1.67,-.17]], .105, "superior-vena-cava");
  vessel("VENA_CAVA", [[-.95,.18,-.21],[-1.13,-.28,-.3],[-1.1,-.68,-.36]], .09, "inferior-vena-cava");
  vessel("PULMONARY_VEINS", [[.03,.56,-.7],[.44,.62,-.93],[.71,.7,-1.01]], .07, "pulmonary-vein-1");
  vessel("PULMONARY_VEINS", [[.08,.25,-.73],[.47,.27,-.99],[.74,.34,-1.04]], .065, "pulmonary-vein-2");
  vessel("PULMONARY_VEINS", [[-.06,.61,-.64],[-.47,.68,-.81],[-.7,.78,-.86]], .065, "pulmonary-vein-3");
  vessel("PULMONARY_VEINS", [[-.1,.33,-.7],[-.46,.29,-.88],[-.7,.35,-.98]], .06, "pulmonary-vein-4");
  vessel("LAD", [[-.18,.73,0],[-.1,.5,0],[.12,.22,0],[.33,-.15,0],[.54,-.51,0],[.73,-.91,0]], .032, "LAD-main", true);
  vessel("LAD", [[.1,.25,0],[.52,.21,0],[.85,.03,0],[1.02,-.3,0]], .018, "LAD-diagonal", true);
  vessel("LCX", [[-.18,.73,0],[.25,.5,0],[.64,.38,0],[.98,.12,0],[1.05,-.2,0]], .03, "LCX-main", true);
  vessel("LCX", [[.64,.38,0],[.83,.05,0],[.95,-.26,0],[.9,-.5,0]], .018, "LCX-marginal", true);
  vessel("RCA", [[-.14,.57,0],[-.55,.43,0],[-.86,.18,0],[-1.01,-.14,0],[-.79,-.44,0]], .03, "RCA-main", true);
  return parts;
}

type RenderOptions = { selected: string | null; cutaway: boolean; cut: number; opacity: number; labels: boolean; isolate: boolean; motion: boolean; focus: number; reset: number; light: number; reduced: boolean };

function ReferenceScene({ findings, onSelect, mode, options }: AnatomyViewerProps & { options: RenderOptions }) {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  const parts = useMemo(() => referenceParts(gltf.scene), [gltf.scene]);
  const texture = useMemo(tissueTexture, []);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const heart = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const { camera, invalidate } = useThree();
  const planes = useMemo(() => options.cutaway ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), options.cut)] : [], [options.cutaway, options.cut]);
  const approved = useMemo(() => new Set(findings.filter(finding => finding.review_status === "approved").map(finding => normalizeStructureId(finding.structure_id)).filter(Boolean)), [findings]);
  const anchors = useMemo(() => REFERENCE_STRUCTURES.map(structure => ({ ...structure, anchor: parts.find(part => part.id === structure.id && !part.key.includes("papillary"))?.anchor })), [parts]);

  useEffect(() => () => { parts.forEach(part => { part.geometry.dispose(); part.inner?.dispose(); }); texture.dispose(); }, [parts, texture]);
  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    const anchor = parts.find(part => part.id === options.selected)?.anchor;
    const target = options.focus > 0 && anchor ? anchor.clone().add(new THREE.Vector3(0, -.43, 0)) : new THREE.Vector3(0, .15, 0);
    control.target.copy(target);
    camera.position.copy(target).add(new THREE.Vector3(.3, .25, options.focus > 0 && anchor ? 3.5 : 6.1));
    camera.lookAt(target);
    control.update();
    invalidate();
    // Selection does not unexpectedly move the user's camera; Focus is explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.focus, options.reset, camera, invalidate, parts]);
  useFrame((_state, dt) => {
    if (!heart.current) return;
    if (!options.motion || options.reduced || document.visibilityState === "hidden") {
      heart.current.scale.setScalar(1);
      return;
    }
    elapsed.current += Math.min(dt, .05);
    const beat = Math.exp(-Math.pow(((elapsed.current % .88) / .88 - .18) / .07, 2));
    heart.current.scale.set(1 - beat * .012, 1 + beat * .006, 1 - beat * .008);
    invalidate();
  });
  useEffect(() => invalidate(), [options, invalidate]);
  return <>
    <ambientLight intensity={.7 * options.light} />
    <hemisphereLight intensity={.65} color="#d8eef5" groundColor="#232433" />
    <directionalLight position={[3, 5, 6]} intensity={2.5 * options.light} color="#fff0df" />
    <directionalLight position={[-4, 2, -3]} intensity={1.8 * options.light} color="#8dc3d6" />
    <group ref={heart} position={[0, -.43, 0]}>
      {parts.map(part => {
        if (options.isolate && options.selected && options.selected !== part.id) return null;
        const selected = part.id === options.selected;
        const hasEvidence = mode !== "anatomy" && approved.has(part.id);
        const coronary = ["LAD", "LCX", "RCA"].includes(part.id);
        const wallOpacity = !part.source ? (options.cutaway ? .65 : 1) : part.interior ? 1 : options.opacity;
        const color = selected ? "#96dae2" : hasEvidence ? "#e8b567" : part.color;
        return <group key={part.key}>
          <mesh geometry={part.geometry} onClick={event => { event.stopPropagation(); onSelect(part.id); }}>
            <meshPhysicalMaterial color={color} bumpMap={texture} bumpScale={part.source ? .012 : .006} roughness={part.interior ? .51 : .64}
              metalness={0} clearcoat={.16} clearcoatRoughness={.45} sheen={part.source ? .25 : .08}
              sheenColor="#d4acaa" emissive={selected ? "#5fbdc5" : hasEvidence ? "#ba8546" : "#000000"}
              emissiveIntensity={selected ? .17 : hasEvidence ? .12 : 0}
              side={THREE.DoubleSide} transparent={wallOpacity < 1} opacity={wallOpacity}
              depthWrite={wallOpacity > .85} clippingPlanes={planes} />
          </mesh>
          {part.inner && options.cutaway && <mesh geometry={part.inner} raycast={() => null}><meshStandardMaterial color={coronary ? "#633d32" : "#493741"} roughness={.9} side={THREE.DoubleSide} clippingPlanes={planes} /></mesh>}
        </group>;
      })}
      {anchors.filter(structure => structure.anchor && (options.labels && (structure.group === "Coronaries" || structure.id === options.selected) || structure.id === options.selected || mode !== "anatomy" && approved.has(structure.id))).map(structure => {
        if (options.isolate && structure.id !== options.selected) return null;
        const linked = approvedStructureFindings(findings, structure.id);
        const count = linked.length;
        const primary = structure.id === options.selected && mode !== "anatomy" ? linked[0] : null;
        return <Html key={structure.id} position={structure.anchor!} center zIndexRange={[15, 0]}>
          <button type="button" className={`anatomy-anchor ${structure.id === options.selected ? "is-selected" : ""}`} aria-label={`Inspect ${structure.label}${count ? `, ${count} approved finding${count === 1 ? "" : "s"}` : ""}`} onClick={() => onSelect(structure.id)}>
            <span>{structure.shortLabel}</span>{count > 0 && <b>{count} evidence</b>}
            {primary && <small>{primary.label}{primary.observed_at ? ` · ${primary.observed_at.slice(0, 10)}` : ""}<em>Source-linked vessel / structure association</em></small>}
          </button>
        </Html>;
      })}
    </group>
    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
    <OrbitControls ref={controls} makeDefault target={[0, .15, 0]} {...{enablePan:true,enableZoom:true} as any} enableDamping={!options.reduced} dampingFactor={.12} minDistance={2.3} maxDistance={11} rotateSpeed={.65} regress />
    <AdaptiveDpr pixelated />
  </>;
}

function ContextGuard({ onUnavailable }: { onUnavailable: () => void }) {
  const gl = useThree(state => state.gl);
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onUnavailable(); };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onUnavailable]);
  return null;
}

const MODE_LABELS = { anatomy: "Reference anatomy", evidence: "Reviewed evidence", coronary: "Coronary explorer", hemo: "Hemodynamic context", section: "Cross-section", replay: "Evidence replay" };

export default function AnatomyViewer({ mode = "anatomy", findings, selectedStructure, onSelect, snapshot, comparisonLabel }: AnatomyViewerProps) {
  const reduced = useReducedAnatomyMotion();
  const [supported, setSupported] = useState(anatomyWebglAvailable);
  const [summary, setSummary] = useState(false);
  const [cutaway, setCutaway] = useState(mode === "section");
  const [cut, setCut] = useState(.12);
  const [opacity, setOpacity] = useState(.95);
  const [light, setLight] = useState(1);
  const [labels, setLabels] = useState(true);
  const [isolate, setIsolate] = useState(false);
  const [motion, setMotion] = useState(false);
  const [focus, setFocus] = useState(0);
  const [reset, setReset] = useState(0);
  const selected = normalizeStructureId(selectedStructure);
  const structure = REFERENCE_STRUCTURES.find(item => item.id === selected);
  const related = selected ? approvedStructureFindings(findings, selected) : [];
  const pending = findings.filter(finding => finding.review_status === "pending").length;
  const unresolved = findings.filter(finding => !normalizeStructureId(finding.structure_id) && finding.review_status !== "rejected");
  const options = { selected, cutaway, cut, opacity, labels, isolate, motion, focus, reset, light, reduced };
  useEffect(() => { setCutaway(mode === "section"); }, [mode]);
  const fallback = <div className="anatomy-fallback" role="status">
    <img src="/models/heart-reference-preview.png" alt="Preview of the generic HRA heart reference" />
    <div><strong>3D rendering unavailable</strong><p>Explore every structure and its approved evidence using the structure controls below.</p></div>
  </div>;
  return <figure className="anatomy-workstation" aria-label={`${comparisonLabel ? `${comparisonLabel}: ` : ""}Interactive cardiovascular reference anatomy`}>
    <figcaption className="anatomy-heading"><div><span className="anatomy-eyebrow">CARDIOVASCULAR REFERENCE ATLAS</span><h3>{comparisonLabel ?? MODE_LABELS[mode]}</h3></div><span className="anatomy-reference-badge">GENERIC REFERENCE</span></figcaption>
    <div className="anatomy-control-bar" role="group" aria-label="Anatomy display controls">
      <button type="button" aria-pressed={cutaway} onClick={() => setCutaway(value => !value)}>Cutaway</button>
      <button type="button" aria-pressed={isolate} disabled={!selected} onClick={() => setIsolate(value => !value)}>Isolate selection</button>
      <button type="button" disabled={!selected || !supported || summary} onClick={() => setFocus(value => value + 1)}>Focus</button>
      <button type="button" aria-pressed={labels} onClick={() => setLabels(value => !value)}>Labels</button>
      <button type="button" aria-pressed={motion && !reduced} disabled={reduced} onClick={() => setMotion(value => !value)}>Illustrative motion</button>
      <button type="button" onClick={() => { setFocus(0); setReset(value => value + 1); setIsolate(false); }}>Reset view</button>
      <button type="button" aria-pressed={summary} onClick={() => setSummary(value => !value)}>Text view</button>
    </div>
    <div className="anatomy-viewport">
      {supported && !summary ? <AnatomyBoundary key={reset} fallback={fallback}>
        <Canvas frameloop={motion && !reduced ? "always" : "demand"} dpr={[1, window.innerWidth < 768 ? 1.15 : 1.5]} camera={{ position: [.3, .4, 6.1], fov: 38 }}
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          onCreated={({ gl }) => { gl.localClippingEnabled = true; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; }}
          aria-label="Rotate, zoom and pan the generic reference heart. Equivalent keyboard structure controls follow the canvas.">
          <ContextGuard onUnavailable={() => setSupported(false)} />
          <Suspense fallback={<Html center><span className="anatomy-loading" role="status">Loading reference anatomy…</span></Html>}><ReferenceScene findings={findings} onSelect={onSelect} mode={mode} options={options} /></Suspense>
        </Canvas>
      </AnatomyBoundary> : summary ? <div className="anatomy-text-view"><span className="anatomy-eyebrow">ACCESSIBLE STRUCTURE EXPLORER</span><h4>{structure?.label ?? "Select a cardiovascular structure"}</h4><p>{structure?.description ?? "The structure directory provides the same selection and evidence connections as the 3D scene."}</p><p>Approved findings: {related.length}. Pending findings are not anatomical highlights.</p></div> : fallback}
      <div className="anatomy-scale-note"><i /> HRA chamber, septum &amp; valve surfaces <span>·</span> Illustrative vessels</div>
      <div className="anatomy-orbit-note">Drag: orbit <span>·</span> Scroll / pinch: zoom <span>·</span> Right drag: pan</div>
    </div>
    <div className="anatomy-adjustments">
      <label>Tissue opacity <output>{Math.round(opacity * 100)}%</output><input type="range" min=".16" max="1" step=".02" value={opacity} onChange={event => setOpacity(Number(event.target.value))} aria-label="Tissue opacity" /></label>
      <label>Lighting <output>{light.toFixed(1)}×</output><input type="range" min=".5" max="1.6" step=".1" value={light} onChange={event => setLight(Number(event.target.value))} aria-label="Anatomy lighting" /></label>
      {cutaway && <label>Section depth <output>{cut.toFixed(2)}</output><input type="range" min="-.9" max="1.1" step=".02" value={cut} onChange={event => setCut(Number(event.target.value))} aria-label="Section depth in generic display coordinates" /></label>}
    </div>
    <div className="anatomy-legend"><span><i className="anatomy-legend-selection" />Selected structure</span><span><i className="anatomy-legend-evidence" />Approved evidence association</span><span>Geometry and motion remain reference illustrations</span></div>
    <div className="anatomy-directory" aria-label="Cardiovascular structures" role="group">
      {(["Chambers", "Interior", "Great vessels", "Coronaries"] as const).map(group => <div className="anatomy-directory-group" key={group}><h4>{group}</h4><div>{REFERENCE_STRUCTURES.filter(item => item.group === group).map(item => {
        const count = approvedStructureFindings(findings, item.id).length;
        return <button key={item.id} type="button" onClick={() => onSelect(item.id)} aria-pressed={selected === item.id} aria-label={`Select ${item.label}${count ? `: ${count} approved finding${count === 1 ? "" : "s"}` : ""}`} data-origin={item.origin} className={count && mode !== "anatomy" ? "has-evidence" : ""}><span>{item.shortLabel}</span>{count > 0 && <b aria-label={`${count} approved findings`}>{count}</b>}</button>;
      })}</div></div>)}
    </div>
    {structure && <div className="anatomy-selection-detail" aria-live="polite"><div><span className="anatomy-eyebrow">SELECTED STRUCTURE</span><h4>{structure.label}</h4></div><p>{structure.description}</p><small>{structure.origin}{structure.ontology ? ` · ${structure.ontology}` : ""}</small>{related.length > 0 && <ul aria-label="Approved findings for selected structure">{related.map(finding => <li key={finding.id}><strong>{finding.label}</strong>{finding.observed_at && <time dateTime={finding.observed_at}>{finding.observed_at.slice(0, 10)}</time>}<span>{finding.source_ref ?? "Source reference in evidence panel"}</span></li>)}</ul>}</div>}
    {(mode === "hemo" || mode === "replay") && snapshot && <div className="anatomy-hemo-context" aria-label="Eight hemodynamic research states"><span className="anatomy-eyebrow">QUALITATIVE CONTEXT · {snapshot.timestamp.slice(0, 10)}</span><div>{HEMO_AXES.map(([key, label]) => <p key={key}><span>{label}</span><b>{snapshot[key].level}</b><small>{snapshot[key].classification} · {snapshot[key].confidence}</small></p>)}</div><p>These evidence-derived states are explanatory context. They do not alter reference geometry or simulate measured pressure, flow or contractility.</p></div>}
    {pending > 0 && <p className="anatomy-review-note">{pending} finding{pending === 1 ? " is" : "s are"} pending human review; proposed mappings are not highlighted as approved evidence.</p>}
    {unresolved.length > 0 && <div className="anatomy-unresolved"><strong>Location not established from supplied evidence</strong><ul>{unresolved.map(finding => <li key={finding.id}>{finding.label} <span>· {finding.review_status}</span></li>)}</ul></div>}
    <p className="anatomy-safety-note">Generic HRA reference surfaces with illustrative coronary and great-vessel overlays. Selection is an evidence association, not proof of a physical lesion. Reported severity never changes vessel shape. {reduced ? "Reduced-motion preference is active." : "Heartbeat motion is optional and illustrative."}</p>
    <details className="anatomy-attribution"><summary>Reference asset, provenance and limitations</summary><p>Human Reference Atlas / HuBMAP CCF 3D Reference Object Library v1.2 (2022), male heart based on Visible Human Male data. Kristen Browne, Heidi Schlehlein, Bruce W. Herr II, Ellen M. Quardokus, Andreas Bueckle and Katy Börner. Licensed <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. <a href="https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html" target="_blank" rel="noreferrer">Official source and citation</a>.</p><p>Original chamber, valve, septal and papillary surfaces are rescaled and given procedural surface materials. All vessels are added illustrative overlays. Tissue layers, patient imaging reconstruction, precise coronary segments and clinical validation of these overlays are not supplied by this asset. Cutaway is an uncapped display clipping plane, not a measured anatomical slice.</p></details>
  </figure>;
}

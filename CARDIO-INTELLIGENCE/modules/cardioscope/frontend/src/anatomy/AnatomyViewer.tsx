import { Component, useEffect, useReducer, useRef, useState } from 'react';
import type { ComponentRef, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { AnatomyManifest } from '../api';
import { api } from '../api';
import { LABELS, NEUTRAL_STATES, VESSELS, vesselColor } from './contract';
import type { Vessel, VesselStates } from './contract';
import { loadAnatomy } from './assets';
import type { AnatomyAssets } from './assets';
import { INITIAL_STATE, viewerReducer, visibleGroups } from './state';
import type { ViewerAction, ViewerState } from './state';

export function webGLAvailable(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

class RenderBoundary extends Component<{ children: ReactNode; onError: (message: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

interface SceneProps {
  manifest: AnatomyManifest;
  assets: AnatomyAssets;
  state: ViewerState;
  vesselStates: VesselStates;
  onSelect: (vessel: Vessel) => void;
  onReady: () => void;
  onFPS: (fps: number) => void;
  onCamera: (position: string) => void;
}
function Scene({ manifest, assets, state, vesselStates, onSelect, onReady, onFPS, onCamera }: SceneProps) {
  const { camera, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const frame = useRef({ elapsed: 0, count: 0, ready: false });
  useFrame((_render, delta) => {
    const counter = frame.current;
    if (!counter.ready) { counter.ready = true; onReady(); }
    counter.elapsed += delta;
    counter.count++;
    if (counter.elapsed >= 1) {
      onFPS(Math.round(counter.count / counter.elapsed));
      counter.elapsed = 0; counter.count = 0;
    }
  });
  useEffect(() => {
    if (!controls.current) return;
    const target = state.focus && state.selected
      ? assets.bounds[state.selected].getCenter(new Vector3()) : new Vector3();
    // Preset directions are source axes; Z is superior and negative Y anterior.
    // LCX focus uses the posterior surface observed in the verified source assembly.
    const direction = new Vector3(0, state.view === 'anterior' ? -1 : 1, 0);
    camera.up.set(0, 0, 1);
    camera.position.copy(target.clone().addScaledVector(direction, state.focus ? 3.2 : 4));
    controls.current.target.copy(target);
    controls.current.update();
    onCamera(camera.position.toArray().map(value => value.toFixed(3)).join(','));
    invalidate();
    // Orbit changes must not cause this command to replay; revisions are explicit.
  }, [state.cameraRevision, assets, camera, invalidate]);
  const center = manifest.assembly.center;
  const scale = manifest.assembly.scale;
  const labelPosition = state.selected ? assets.bounds[state.selected].getCenter(new Vector3()) : null;
  return <>
    <ambientLight intensity={1.4} />
    <directionalLight position={[3, -4, 5]} intensity={2} />
    <directionalLight position={[-3, 4, 2]} intensity={1.3} />
    <group scale={scale}>
      <group position={[-center[0], -center[1], -center[2]]}>
        {visibleGroups(state).map(group => <group key={group} name={group}>
          {assets.groups[group].map(({ leaf, geometry }, index) => <mesh
            key={`${leaf}-${index}`} name={`${group}/${leaf}`} geometry={geometry} dispose={null}
            onClick={group === 'heart' ? undefined : event => {
              if (event.delta > 4) return; // An orbit drag is not a vessel click.
              event.stopPropagation(); onSelect(group);
            }}>
            <meshStandardMaterial
              color={group === 'heart' ? '#c5b5ad' :
                state.selected === group && vesselStates[group].status !== 'prediction'
                  ? '#e9ac42' : vesselColor(vesselStates[group])}
              roughness={0.85}
              emissive={state.selected === group ? '#ad640a' : '#000000'}
              emissiveIntensity={state.selected === group ? 0.2 : 0}
            />
          </mesh>)}
        </group>)}
      </group>
    </group>
    {state.selected && labelPosition && <Html position={labelPosition} center style={{ pointerEvents: 'none' }}>
      <span className="vessel-label">{state.selected}</span>
    </Html>}
    <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping={false} minDistance={1.4} maxDistance={8}
      onChange={() => onCamera(camera.position.toArray().map(value => value.toFixed(3)).join(','))} />
  </>;
}

export function AnatomyViewer({ vesselStates = NEUTRAL_STATES, viewerState, onAction, active = true }: {
  vesselStates?: VesselStates; viewerState?: ViewerState; onAction?: (action: ViewerAction) => void;
  active?: boolean;
}) {
  const [localState, localDispatch] = useReducer(viewerReducer, INITIAL_STATE);
  const state = viewerState ?? localState, dispatch = onAction ?? localDispatch;
  const [supported] = useState(webGLAvailable);
  const [manifest, setManifest] = useState<AnatomyManifest | null>(null);
  const [assets, setAssets] = useState<AnatomyAssets | null>(null);
  const [progress, setProgress] = useState({ loaded: 0, total: 83 });
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const [fps, setFPS] = useState<number | null>(null);
  const [cameraPosition, setCameraPosition] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!supported) return;
    const controller = new AbortController();
    let prepared: AnatomyAssets | undefined;
    setError(null); setAssets(null); setManifest(null); setRendered(false); setFPS(null);
    setProgress({ loaded: 0, total: 83 });
    async function load() {
      try {
        const result = await api.anatomy(controller.signal);
        controller.signal.throwIfAborted();
        const meshes = await loadAnatomy(result, controller.signal,
          (loaded, total) => { if (!controller.signal.aborted) setProgress({ loaded, total }); });
        prepared = meshes;
        if (controller.signal.aborted) { meshes.dispose(); return; }
        setManifest(result); setAssets(meshes);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Anatomy request failed');
      }
    }
    void load();
    return () => { controller.abort(); prepared?.dispose(); };
  }, [supported, attempt]);

  const available = supported && !error && rendered;
  const selectedData = state.selected ? vesselStates[state.selected] : null;
  const hasPredictions = VESSELS.some(vessel => vesselStates[vessel].status === 'prediction');
  const select = (vessel: Vessel) => dispatch({ type: 'select', vessel });
  const failure = !supported ? 'WebGL 2 is unavailable. The 3D anatomy could not be rendered.'
    : error ? `3D anatomy unavailable: ${error}. No partial anatomy is displayed.` : null;
  return <section aria-labelledby="anatomy-heading">
    <h2 id="anatomy-heading">Coronary anatomy</h2>
    <p>Reference anatomy, not a reconstruction of a patient. {!hasPredictions && 'Neutral vessel colors: predictions unavailable.'}</p>
    <p>{hasPredictions ? 'Vessel colors represent model-estimated probability, not measured stenosis severity. Selection is highlighted.' :
      'Blue marks unselected vessels; amber marks the selection. These colors do not indicate risk.'}</p>
    <div className="viewer-controls" role="group" aria-label="Anatomy controls">
      {VESSELS.map(vessel => <button key={vessel} aria-pressed={state.selected === vessel}
        disabled={!available} onClick={() => select(vessel)}>{vessel}</button>)}
      <button disabled={!available} onClick={() => dispatch({ type: 'view', view: 'anterior' })}>Anterior view</button>
      <button disabled={!available} onClick={() => dispatch({ type: 'view', view: 'posterior' })}>Posterior view</button>
      <button disabled={!available || !state.selected} aria-pressed={state.isolated}
        onClick={() => dispatch({ type: 'isolate' })}>Isolate selected vessel</button>
      <button disabled={!available} onClick={() => dispatch({ type: 'show-all' })}>Show all</button>
      <button disabled={!available} onClick={() => dispatch({ type: 'reset' })}>Reset view</button>
    </div>
    <p className="orientation-note">Source orientation: top is superior in the anterior/posterior presets. Last preset: <strong>{state.view}</strong>. Dragging changes the viewpoint.</p>
    {failure ? <div role="alert"><p>{failure}</p><p>Use the numerical model outputs below when available. This device has not rendered the anatomy.</p>
      {supported && <button onClick={() => setAttempt(value => value + 1)}>Retry anatomy</button>}</div>
      : <>
        <p role="status">{rendered ? 'Anatomy loaded and renderer ready: 83 verified source meshes.' :
          `Loading anatomy: ${progress.loaded}/${progress.total} meshes verified${assets ? '; starting renderer' : ''}…`}</p>
        <div className="anatomy-canvas" role="img" aria-label={`Reference heart and coronary anatomy${state.selected ? `; ${state.selected} selected` : ''}. Vessel selection and view presets are available using the buttons above.`}
          data-selected={state.selected ?? ''} data-isolated={state.isolated}
          data-camera={cameraPosition} data-rendered={rendered}>
          {assets && manifest && <RenderBoundary key={attempt} onError={setError}>
            <Canvas frameloop={active ? 'always' : 'never'} camera={{ position: [0, -4, 0], up: [0, 0, 1], fov: 40, near: 0.1, far: 30 }}
              dpr={[1, 1.5]} gl={{ antialias: true }}
              onCreated={({ gl }) => {
                gl.setClearColor('#edf1f3');
                gl.domElement.addEventListener('webglcontextlost', event => {
                  event.preventDefault(); setError('WebGL rendering context was lost. Retry to reload the renderer');
                }, { once: true });
              }}>
              <Scene manifest={manifest} assets={assets} state={state} vesselStates={vesselStates}
                onSelect={select} onReady={() => setRendered(true)} onFPS={setFPS} onCamera={setCameraPosition} />
            </Canvas>
          </RenderBoundary>}
        </div>
        <p>Drag to rotate; scroll or pinch to zoom. {rendered ?
          state.isolated ? 'Only the selected vessel is shown.' : 'Heart and all three vessels are shown.'
          : 'Controls will be enabled after the complete anatomy renders.'}</p>
        <p aria-live="polite">{state.selected ? `Selected: ${state.selected} — ${LABELS[state.selected]}` : 'Select LAD, LCX or RCA in the model or controls.'}</p>
        {state.selected && <p>{selectedData?.status === 'prediction'
          ? `Model-estimated stenosis probability: ${(selectedData.probability * 100).toFixed(1)}%`
          : selectedData?.status === 'pending' ? 'Selected vessel prediction: pending.'
          : selectedData?.status === 'error' ? `Selected vessel prediction unavailable: ${selectedData.message}`
          : 'Selected vessel probability: unavailable.'}</p>}
        {fps !== null && <p className="performance">Approximate render cadence: {fps} FPS. This is a local measurement, not a hardware guarantee.</p>}
      </>}
    {manifest && <small>{manifest.source_records.attribution}. Shared source coordinates preserved.</small>}
  </section>;
}

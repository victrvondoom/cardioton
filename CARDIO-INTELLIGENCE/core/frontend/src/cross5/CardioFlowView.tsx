/**
 * CardioFlow — interactive coronary microphysics view (React Three Fiber).
 *
 * Renders the hypothetical 0D-solver simulation returned by the backend:
 * a vessel tube whose radius follows the simulated centreline luminal
 * profile, with particle markers whose motion represents the SIMULATED flow
 * from the reduced-order model (never a CFD result, never patient data).
 *
 * Performance posture mirrors HeartViewer: on-demand rendering, capped DPR,
 * no shadows/textures, lazily loaded by the route, WebGL fallback message.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { webglAvailable } from "../cardiotwin/core__src_cardiotwin__HeartViewer";
import type { FlowSimulation } from "./core__src_cross5__api";

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Colour ramp for simulated pressure (blue → red over 60–120 mmHg model range). */
function pressureColor(p_mmhg: number): string {
  const t = Math.min(1, Math.max(0, (p_mmhg - 60) / 60));
  const r = Math.round(60 + 195 * t);
  const b = Math.round(230 - 200 * t);
  const g = Math.round(120 + 40 * Math.min(1, t * 2) - 60 * t);
  return `rgb(${r},${Math.max(20, g)},${b})`;
}

function VesselTube({ simulation }: { simulation: FlowSimulation }) {
  const samples = simulation.centreline.samples;
  const scale = 14 / Math.max(...samples.map((s) => s.x_mm), 1); // map mm → scene units
  const radiusScale = 3.2; // exaggerate luminal radius for visibility (display only)

  const geometry = useMemo(() => {
    const points = samples.map((s) => new THREE.Vector3(s.x_mm * scale, 0, 0));
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    // Per-ring radii from the simulated luminal profile.
    const radii = samples.map((s) => Math.max(0.12, (s.diameter_mm / 2) * scale * radiusScale * 3));
    const segments = 96;
    const sides = 20;
    const tube = new THREE.TubeGeometry(curve, segments, 1, sides, false);
    const position = tube.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();
    for (let ring = 0; ring <= segments; ring++) {
      const t = ring / segments;
      const center = curve.getPointAt(t);
      const sampleIndex = Math.min(samples.length - 1, Math.round(t * (samples.length - 1)));
      const radius = radii[sampleIndex];
      const p = simulation.waveform.time_series[0]?.p_distal_mmhg ?? 80;
      color.set(pressureColor(p));
      for (let side = 0; side <= sides; side++) {
        const index = ring * (sides + 1) + side;
        const v = new THREE.Vector3().fromBufferAttribute(position, index).sub(center);
        v.setLength(radius).add(center);
        position.setXYZ(index, v.x, v.y, v.z);
        colors.set([color.r, color.g, color.b], index * 3);
      }
    }
    tube.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    tube.computeVertexNormals();
    return tube;
  }, [samples, scale, simulation.waveform.time_series]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.45} metalness={0.05} />
    </mesh>
  );
}

/** Particles whose motion represents the SIMULATED flow (reduced-order model output). */
function FlowParticles({ simulation, playing }: { simulation: FlowSimulation; playing: boolean }) {
  const group = useRef<THREE.Group>(null);
  const count = 90;
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        offset: i / count,
        lane: (i % 3) - 1,
      })),
    [count],
  );

  useFrame((state) => {
    if (!group.current || !playing) return;
    const cycle = simulation.waveform.cycle_seconds;
    const phase = (state.clock.elapsedTime % cycle) / cycle;
    // Coronary phasicity: slower advective motion in systole, faster in diastole (display only).
    const speed = phase <= 0.35 ? 0.45 : 1.2;
    group.current.children.forEach((child, i) => {
      const p = particles[i];
      const x = (((p.offset + state.clock.elapsedTime * 0.06 * speed) % 1)) * 14 - 0;
      child.position.set(x, 0, p.lane * 0.22);
    });
  });

  return (
    <group ref={group}>
      {particles.map((p, i) => (
        <mesh key={i} position={[-20, 0, p.lane * 0.22]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color="#ffb35c" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function HeartbeatWalls({ simulation, playing }: { simulation: FlowSimulation; playing: boolean }) {
  const { invalidate } = useThree();
  const series = simulation.waveform.time_series;
  const idx = useRef(0);
  const last = useRef(0);
  const wallRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const step = (t: number) => {
      if (t - last.current > 16) {
        last.current = t;
        idx.current = (idx.current + 1) % series.length;
        invalidate();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, series.length, invalidate]);

  const point = series[idx.current] ?? series[0];
  return (
    <group>
      <mesh ref={wallRef} position={[0, 5.2, 0]}>
        <planeGeometry args={[16, 1]} />
        <meshBasicMaterial color={pressureColor(point?.p_aortic_mmhg ?? 90)} transparent opacity={0.25} />
      </mesh>
      <Html position={[0, 6.2, 0]} center>
        <div className="text-center text-[10.5px] leading-tight text-ink-primary whitespace-nowrap" style={{ textShadow: "0 1px 4px rgba(255,255,255,0.8)" }}>
          <div>aortic {point?.p_aortic_mmhg.toFixed(1)} mmHg · distal {point?.p_distal_mmhg.toFixed(1)} mmHg</div>
          <div className="text-ink-muted">ΔP {point?.translesional_dp_mmhg.toFixed(1)} mmHg · Q {point?.q_ml_min.toFixed(0)} mL/min (model)</div>
        </div>
      </Html>
    </group>
  );
}

export interface CardioFlowViewProps {
  simulation: FlowSimulation | null;
  playing: boolean;
}

export default function CardioFlowView({ simulation, playing }: CardioFlowViewProps) {
  if (!simulation) {
    return (
      <div className="grid h-full place-items-center text-[12px] text-ink-muted">
        Run a simulation to display the vessel.
      </div>
    );
  }
  if (!webglAvailable()) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-[12px] text-ink-muted">
        WebGL is unavailable in this browser — the interactive vessel view is disabled.
        The numeric simulation results remain available in the side panels.
      </div>
    );
  }
  return (
    <SceneBoundary
      fallback={
        <div className="grid h-full place-items-center text-[12px] text-ink-muted">
          The 3D vessel view failed to initialize on this device.
        </div>
      }
    >
      <Canvas
        frameloop={playing ? "always" : "demand"}
        dpr={[1, 1.6]}
        camera={{ position: [4, 6, 16], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
        }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 10, 8]} intensity={1.6} />
        <directionalLight position={[-6, 4, -6]} intensity={0.5} color="#9ebdd2" />
        <VesselTube simulation={simulation} />
        <FlowParticles simulation={simulation} playing={playing} />
        <HeartbeatWalls simulation={simulation} playing={playing} />
        <OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={40} target={[7, 0, 0]} enableDamping dampingFactor={0.08} />
      </Canvas>
    </SceneBoundary>
  );
}

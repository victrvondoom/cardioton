import React, { useRef, useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { 
  Activity, 
  RotateCw, 
  Eye, 
  EyeOff, 
  Layers, 
  Sun, 
  Moon, 
  Heart, 
  Compass, 
  Lock, 
  Unlock,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Info
} from 'lucide-react';

// Exact Risk-based color threshold mapping:
// Low risk (< 30%): Medical Emerald (#059669)
// Moderate risk (30% - 70%): Amber Gold (#d97706)
// High risk (> 70%): Clinical Crimson (#dc2626)
export const getRiskColor = (prob) => {
  if (prob === undefined || prob === null || isNaN(prob)) return '#94a3b8';
  if (prob < 0.30) return '#059669'; // Medical Emerald
  if (prob <= 0.70) return '#d97706'; // Amber Gold
  return '#dc2626'; // Clinical Crimson
};

export const getRiskTier = (prob) => {
  if (prob === undefined || prob === null || isNaN(prob)) return 'Pending';
  if (prob < 0.30) return 'Low';
  if (prob <= 0.70) return 'Moderate';
  return 'High';
};

// Controlled Semantic Vessel Colors:
// LAD = coral/red (#f43f5e)
// LCX = teal/emerald (#0d9488)
// RCA = orange (#f97316)
// CAD = rose-crimson (#e11d48)
export const VESSEL_COLORS = {
  LAD: '#f43f5e',
  LCX: '#0d9488',
  RCA: '#f97316',
  CAD: '#e11d48'
};

// Explicit vessel-to-anatomy mapping conforming to project requirements
export const VESSEL_MAPPING = {
  LAD: {
    id: 'LAD',
    label: 'Left Anterior Descending',
    target: 'LAD',
    view: 'anterior',
    color: VESSEL_COLORS.LAD,
    course: 'Originates from Left Main Coronary Artery (LMCA) and courses along the anterior interventricular sulcus to the apex.',
    perfusion: 'Supplies anterior left ventricular myocardium, apex, and anterior 2/3 of interventricular septum.',
    significance: 'Critical vascular conduit. Model predicts probability of ≥50% lumen stenosis.'
  },
  LCX: {
    id: 'LCX',
    label: 'Left Circumflex',
    target: 'LCX',
    view: 'lateral',
    color: VESSEL_COLORS.LCX,
    course: 'Arises from LMCA and runs along the left atrioventricular groove around the left cardiac border to the posterior surface.',
    perfusion: 'Supplies posterolateral myocardial walls of the left ventricle via obtuse marginal branches.',
    significance: 'Stenosis can precipitate lateral wall ischemia and localized hypokinesis.'
  },
  RCA: {
    id: 'RCA',
    label: 'Right Coronary Artery',
    target: 'RCA',
    view: 'rightav',
    color: VESSEL_COLORS.RCA,
    course: 'Originates from right aortic sinus and travels along the right atrioventricular sulcus to the cardiac crux.',
    perfusion: 'Supplies right ventricular free wall, inferior myocardial wall, and conduction system.',
    significance: 'Stenosis frequently triggers inferior wall ischemia and conduction delay.'
  }
};

// Smooth Camera Controller that transitions to presets and releases control to user
function CameraFocusController({
  targetPos,
  targetLookAt,
  isTransitioning,
  onTransitionEnd,
  controlsRef,
  isInteractingRef,
  isLocked
}) {
  useFrame((state, delta) => {
    if (!isTransitioning || isInteractingRef.current || isLocked || !controlsRef.current) {
      return;
    }

    const t = Math.min(1.0, delta * 3.6);
    state.camera.position.lerp(targetPos, t);
    controlsRef.current.target.lerp(targetLookAt, t);
    controlsRef.current.update();

    // End transition when close enough so user can freely orbit/zoom without snapback
    if (
      state.camera.position.distanceTo(targetPos) < 0.025 &&
      controlsRef.current.target.distanceTo(targetLookAt) < 0.025
    ) {
      state.camera.position.copy(targetPos);
      controlsRef.current.target.copy(targetLookAt);
      controlsRef.current.update();
      onTransitionEnd();
    }
  });

  return null;
}

// 3D Anatomical Organ Model with MeshPhysicalMaterial & Post-processing Bloom
function AnatomicalHeartScene({
  ladProb = null,
  lcxProb = null,
  rcaProb = null,
  selectedVessel,
  onSelectVessel,
  isPulsing = true,
  heartRate = 72,
  showLabels = true,
  xrayMode = false,
  isLightTheme = true,
}) {
  const groupRef = useRef();
  const [hoveredVessel, setHoveredVessel] = useState(null);

  // Load high-fidelity anatomical GLTF/GLB heart model
  const { scene } = useGLTF('/models/cardiovision_3d__public_models__heart.glb');

  // Vessel base colors: semantic colors when prediction exists, neutral gray when pending
  const ladBaseColor = useMemo(() => new THREE.Color(ladProb != null ? VESSEL_COLORS.LAD : '#94a3b8'), [ladProb]);
  const lcxBaseColor = useMemo(() => new THREE.Color(lcxProb != null ? VESSEL_COLORS.LCX : '#94a3b8'), [lcxProb]);
  const rcaBaseColor = useMemo(() => new THREE.Color(rcaProb != null ? VESSEL_COLORS.RCA : '#94a3b8'), [rcaProb]);

  // Determine bloom-triggering emission intensity based on live prediction probability and selection state
  // Visual intensity represents model-predicted probability, not measured anatomical severity
  const getVesselEmissive = (prob, isSelected, isHovered) => {
    if (prob == null) {
      return isSelected ? 0.45 : 0.0;
    }
    // Live probability available:
    if (isSelected) {
      return 1.25 + prob * 0.75; // Highlighted vessel blooms visibly
    }
    if (isHovered) {
      return 0.95 + prob * 0.45;
    }
    if (selectedVessel) {
      // Non-selected vessels return to calm state while selected vessel is emphasized
      return 0.12 + prob * 0.22;
    }
    // Neutral overview: subtle emissive proportional to model probability
    return 0.22 + prob * 0.65;
  };

  // High-Gloss PBR materials with clearcoat and specular sheen
  const materials = useMemo(() => {
    return {
      LAD: new THREE.MeshStandardMaterial({
        color: ladBaseColor,
        roughness: 0.15,
        metalness: 0.25,
        emissive: ladBaseColor,
        emissiveIntensity: getVesselEmissive(ladProb, selectedVessel === 'LAD', hoveredVessel === 'LAD'),
        wireframe: xrayMode,
      }),
      LCX: new THREE.MeshStandardMaterial({
        color: lcxBaseColor,
        roughness: 0.15,
        metalness: 0.25,
        emissive: lcxBaseColor,
        emissiveIntensity: getVesselEmissive(lcxProb, selectedVessel === 'LCX', hoveredVessel === 'LCX'),
        wireframe: xrayMode,
      }),
      RCA: new THREE.MeshStandardMaterial({
        color: rcaBaseColor,
        roughness: 0.15,
        metalness: 0.25,
        emissive: rcaBaseColor,
        emissiveIntensity: getVesselEmissive(rcaProb, selectedVessel === 'RCA', hoveredVessel === 'RCA'),
        wireframe: xrayMode,
      }),

      // Hyper-Realistic Biological Material (MeshPhysicalMaterial) for Living Heart Muscle
      Myocardium: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#991b1b'),
        roughness: 0.25,
        metalness: 0.08,
        transmission: 0.4,
        thickness: 1.5,
        ior: 1.45,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
        attenuationColor: new THREE.Color('#b91c1c'),
        attenuationDistance: 1.2,
        transparent: true,
        opacity: xrayMode ? 0.35 : 1.0,
      }),

      Atria: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#881337'),
        roughness: 0.28,
        metalness: 0.08,
        transmission: 0.35,
        thickness: 1.3,
        ior: 1.45,
        clearcoat: 0.5,
        transparent: true,
        opacity: xrayMode ? 0.35 : 1.0,
      }),

      // Ascending Aorta Arch
      Aorta: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#fecdd3'),
        roughness: 0.22,
        metalness: 0.12,
        transmission: 0.25,
        thickness: 0.8,
        ior: 1.40,
        clearcoat: 0.4,
        transparent: true,
        opacity: xrayMode ? 0.45 : 1.0,
      }),

      // Pulmonary Trunk
      PulmonaryArtery: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#0284c7'),
        roughness: 0.24,
        metalness: 0.12,
        transmission: 0.25,
        thickness: 0.8,
        ior: 1.40,
        clearcoat: 0.4,
        transparent: true,
        opacity: xrayMode ? 0.45 : 1.0,
      }),

      VenaCava: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1e3a8a'),
        roughness: 0.32,
        metalness: 0.10,
        transparent: xrayMode,
        opacity: xrayMode ? 0.45 : 1.0,
      }),

      EpicardialFat: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fef08a'),
        roughness: 0.65,
        metalness: 0.05,
        transparent: true,
        opacity: xrayMode ? 0.15 : 0.85,
      }),
    };
  }, [ladBaseColor, lcxBaseColor, rcaBaseColor, ladProb, lcxProb, rcaProb, selectedVessel, hoveredVessel, xrayMode]);

  // Clone scene for clean material mapping
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Traverse scene graph to assign hyper-realistic materials
  useEffect(() => {
    clonedScene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        const name = (node.name || '').toUpperCase();
        const parentName = (node.parent?.name || '').toUpperCase();

        if (name.includes('LAD') || parentName.includes('LAD')) {
          node.material = materials.LAD;
          node.userData = { vessel: 'LAD' };
        } else if (name.includes('LCX') || parentName.includes('LCX')) {
          node.material = materials.LCX;
          node.userData = { vessel: 'LCX' };
        } else if (name.includes('RCA') || parentName.includes('RCA')) {
          node.material = materials.RCA;
          node.userData = { vessel: 'RCA' };
        } else if (name.includes('AORTA') || name.includes('CAROTID') || name.includes('SUBCLAVIAN')) {
          node.material = materials.Aorta;
        } else if (name.includes('PULMONARY')) {
          node.material = materials.PulmonaryArtery;
        } else if (name.includes('VENACAVA')) {
          node.material = materials.VenaCava;
        } else if (name.includes('ATRI') || name.includes('AURICLE')) {
          node.material = materials.Atria;
        } else if (name.includes('FAT')) {
          node.material = materials.EpicardialFat;
        } else {
          node.material = materials.Myocardium;
        }
      }
    });
  }, [clonedScene, materials]);

  // Subtle organic systolic/diastolic pulsing in useFrame to simulate living heartbeat
  useFrame((state) => {
    if (!groupRef.current || !isPulsing) return;
    const t = state.clock.getElapsedTime();
    const freq = (heartRate / 60) * Math.PI * 2;
    const pulse = 1.0 + (Math.sin(t * freq) + Math.sin(t * freq * 2) * 0.3) * 0.022;
    groupRef.current.scale.set(0.92 * pulse, 0.92 * pulse, 0.92 * pulse);
  });

  const handlePointerOver = (e) => {
    e.stopPropagation();
    const vessel = e.object.userData?.vessel;
    if (vessel) {
      setHoveredVessel(vessel);
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHoveredVessel(null);
    document.body.style.cursor = 'auto';
  };

  const handleClick = (e) => {
    e.stopPropagation();
    const vessel = e.object.userData?.vessel;
    if (vessel && onSelectVessel) {
      onSelectVessel(vessel);
    }
  };

  return (
    <group ref={groupRef} position={[0, -0.05, 0]} scale={[0.92, 0.92, 0.92]}>
      <primitive
        object={clonedScene}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />

      {/* Floating 3D HTML Annotation Badges (pinned cleanly to anatomical vessel sulci) */}
      {showLabels && (
        <>
          {/* LAD Floating Badge (Anterior Interventricular Sulcus) */}
          <Html position={[0.1, -0.42, 0.95]} center distanceFactor={4.0}>
            <div
              onClick={() => onSelectVessel && onSelectVessel('LAD')}
              className={`cursor-pointer transition-all duration-200 select-none ${
                selectedVessel === 'LAD'
                  ? 'scale-110 z-30 ring-2 ring-rose-500 rounded-full'
                  : 'hover:scale-105 opacity-90 hover:opacity-100 z-10'
              }`}
            >
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-md border transition-all ${
                  isLightTheme
                    ? 'bg-white/95 text-slate-800 shadow-slate-200/90 border-slate-200/90'
                    : 'bg-slate-900/95 text-white shadow-black/60 border-slate-700/80'
                }`}
                style={{
                  borderColor: selectedVessel === 'LAD' ? VESSEL_COLORS.LAD : `${getRiskColor(ladProb)}66`,
                  boxShadow: `0 2px 10px ${ladProb != null ? `${VESSEL_COLORS.LAD}44` : 'rgba(0,0,0,0.1)'}`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                  style={{ backgroundColor: ladProb != null ? VESSEL_COLORS.LAD : '#94a3b8' }}
                />
                <span className="font-mono font-bold text-[11px] tracking-tight">LAD</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                  style={{
                    backgroundColor: ladProb != null ? `${getRiskColor(ladProb)}18` : 'rgba(148,163,184,0.15)',
                    color: ladProb != null ? getRiskColor(ladProb) : '#64748b',
                  }}
                >
                  {ladProb != null ? `${(ladProb * 100).toFixed(0)}% ${getRiskTier(ladProb)}` : 'Pending'}
                </span>
              </div>
            </div>
          </Html>

          {/* LCX Floating Badge (Left Circumflex Sulcus) */}
          <Html position={[-1.25, 0.22, 0.35]} center distanceFactor={4.0}>
            <div
              onClick={() => onSelectVessel && onSelectVessel('LCX')}
              className={`cursor-pointer transition-all duration-200 select-none ${
                selectedVessel === 'LCX'
                  ? 'scale-110 z-30 ring-2 ring-teal-500 rounded-full'
                  : 'hover:scale-105 opacity-90 hover:opacity-100 z-10'
              }`}
            >
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-md border transition-all ${
                  isLightTheme
                    ? 'bg-white/95 text-slate-800 shadow-slate-200/90 border-slate-200/90'
                    : 'bg-slate-900/95 text-white shadow-black/60 border-slate-700/80'
                }`}
                style={{
                  borderColor: selectedVessel === 'LCX' ? VESSEL_COLORS.LCX : `${getRiskColor(lcxProb)}66`,
                  boxShadow: `0 2px 10px ${lcxProb != null ? `${VESSEL_COLORS.LCX}44` : 'rgba(0,0,0,0.1)'}`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                  style={{ backgroundColor: lcxProb != null ? VESSEL_COLORS.LCX : '#94a3b8' }}
                />
                <span className="font-mono font-bold text-[11px] tracking-tight">LCX</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                  style={{
                    backgroundColor: lcxProb != null ? `${getRiskColor(lcxProb)}18` : 'rgba(148,163,184,0.15)',
                    color: lcxProb != null ? getRiskColor(lcxProb) : '#64748b',
                  }}
                >
                  {lcxProb != null ? `${(lcxProb * 100).toFixed(0)}% ${getRiskTier(lcxProb)}` : 'Pending'}
                </span>
              </div>
            </div>
          </Html>

          {/* RCA Floating Badge (Right AV Sulcus) */}
          <Html position={[1.25, 0.12, 0.45]} center distanceFactor={4.0}>
            <div
              onClick={() => onSelectVessel && onSelectVessel('RCA')}
              className={`cursor-pointer transition-all duration-200 select-none ${
                selectedVessel === 'RCA'
                  ? 'scale-110 z-30 ring-2 ring-orange-500 rounded-full'
                  : 'hover:scale-105 opacity-90 hover:opacity-100 z-10'
              }`}
            >
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-md border transition-all ${
                  isLightTheme
                    ? 'bg-white/95 text-slate-800 shadow-slate-200/90 border-slate-200/90'
                    : 'bg-slate-900/95 text-white shadow-black/60 border-slate-700/80'
                }`}
                style={{
                  borderColor: selectedVessel === 'RCA' ? VESSEL_COLORS.RCA : `${getRiskColor(rcaProb)}66`,
                  boxShadow: `0 2px 10px ${rcaProb != null ? `${VESSEL_COLORS.RCA}44` : 'rgba(0,0,0,0.1)'}`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                  style={{ backgroundColor: rcaProb != null ? VESSEL_COLORS.RCA : '#94a3b8' }}
                />
                <span className="font-mono font-bold text-[11px] tracking-tight">RCA</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                  style={{
                    backgroundColor: rcaProb != null ? `${getRiskColor(rcaProb)}18` : 'rgba(148,163,184,0.15)',
                    color: rcaProb != null ? getRiskColor(rcaProb) : '#64748b',
                  }}
                >
                  {rcaProb != null ? `${(rcaProb * 100).toFixed(0)}% ${getRiskTier(rcaProb)}` : 'Pending'}
                </span>
              </div>
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

// Preload the GLB model in Three.js cache
useGLTF.preload('/models/cardiovision_3d__public_models__heart.glb');

// Main HeartCanvas Component
export default function HeartCanvas({
  ladProb = null,
  lcxProb = null,
  rcaProb = null,
  selectedVessel = 'LAD',
  onSelectVessel,
  heartRate = 72,
}) {
  const controlsRef = useRef();
  const isInteractingRef = useRef(false);

  // States
  const [isLightTheme, setIsLightTheme] = useState(true);
  const [isLocked, setIsLocked] = useState(false); // Static View lock toggle
  const [autoRotate, setAutoRotate] = useState(false);
  const [isPulsing, setIsPulsing] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [xrayMode, setXrayMode] = useState(false);
  const [viewPreset, setViewPreset] = useState('anterior');

  // Camera transition targets
  const [targetPos, setTargetPos] = useState(() => new THREE.Vector3(0.12, 0.08, 4.9));
  const [targetLookAt, setTargetLookAt] = useState(() => new THREE.Vector3(0.0, -0.20, 0.35));
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Smooth Camera View Presets
  const focusOnPreset = (presetName, vesselToSelect = undefined) => {
    isInteractingRef.current = false;
    setAutoRotate(false);
    setViewPreset(presetName);

    const pos = new THREE.Vector3(0, 0, 5.8);
    const target = new THREE.Vector3(0, -0.05, 0);

    if (presetName === 'anterior') {
      pos.set(0.12, 0.08, 4.9);
      target.set(0.0, -0.20, 0.35);
    } else if (presetName === 'lateral') {
      pos.set(-3.2, 0.20, 3.2);
      target.set(-0.35, -0.05, 0.05);
    } else if (presetName === 'inferior') {
      pos.set(0.0, -2.5, -4.5);
      target.set(0.0, -0.2, 0.0);
    } else if (presetName === 'rightav') {
      pos.set(3.2, 0.15, 3.4);
      target.set(0.35, -0.05, 0.05);
    } else if (presetName === 'default') {
      pos.set(0, 0, 5.8);
      target.set(0, -0.05, 0);
    }

    setTargetPos(pos);
    setTargetLookAt(target);
    setIsTransitioning(true);

    if (vesselToSelect !== undefined && onSelectVessel) {
      onSelectVessel(vesselToSelect);
    }
  };

  // Sync camera when selectedVessel changes from parent
  useEffect(() => {
    if (selectedVessel === 'LAD') {
      focusOnPreset('anterior');
    } else if (selectedVessel === 'LCX') {
      focusOnPreset('lateral');
    } else if (selectedVessel === 'RCA') {
      focusOnPreset('rightav');
    } else if (!selectedVessel) {
      focusOnPreset('default');
    }
  }, [selectedVessel]);

  // Reset Framing: Smoothly returns camera to default overview without deleting patient prediction
  const resetCamera = () => {
    focusOnPreset('default', null);
  };

  const handleZoom = (direction) => {
    if (controlsRef.current && !isLocked) {
      setIsTransitioning(false);
      const zoomFactor = direction === 'in' ? 0.85 : 1.15;
      controlsRef.current.object.position.multiplyScalar(zoomFactor);
      controlsRef.current.update();
    }
  };

  const hasLivePredictions = ladProb != null || lcxProb != null || rcaProb != null;

  return (
    <div
      className={`relative w-full h-full min-h-[480px] rounded-2xl overflow-hidden transition-colors duration-500 shadow-sm flex flex-col border ${
        isLightTheme
          ? 'bg-gradient-to-b from-slate-50 via-slate-100/90 to-slate-200/80 border-slate-200 text-slate-800'
          : 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-slate-800 text-slate-100'
      }`}
    >
      {/* Top Left Anatomical Header Bar */}
      <div
        className={`absolute top-3.5 left-3.5 z-20 flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-xs transition-colors ${
          isLightTheme
            ? 'bg-white/90 border-slate-200 text-slate-800'
            : 'bg-slate-900/85 border-slate-700/80 text-slate-200'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-rose-500 animate-pulse fill-current" />
          <span className="text-[11px] font-bold tracking-wide uppercase">
            3D Coronary Anatomy
          </span>
        </div>
        <div className={`h-3 w-px ${isLightTheme ? 'bg-slate-300' : 'bg-slate-700'}`} />
        <div className="flex items-center gap-1 text-[11px] font-mono font-medium text-sky-700 dark:text-sky-400">
          <Activity className="w-3 h-3" />
          <span>{isPulsing ? `${heartRate} BPM` : 'PAUSED'}</span>
        </div>
        <div className={`h-3 w-px ${isLightTheme ? 'bg-slate-300' : 'bg-slate-700'}`} />
        <div className="flex items-center gap-1 text-[10px] font-mono font-semibold">
          {hasLivePredictions ? (
            <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Prediction Active
            </span>
          ) : (
            <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Run AI Assessment to view model predictions
            </span>
          )}
        </div>
      </div>

      {/* Persistent Plaque Localization Disclaimer Badge */}
      <div className="absolute top-12 left-3.5 z-20 max-w-sm px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-[10px] font-medium backdrop-blur-md flex items-center gap-1.5 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        <span>Prediction mapped to anatomical vessel; this does not represent measured plaque location.</span>
      </div>

      {/* Floating Toolbar: Static View Lock, Views, Zoom, Display Controls */}
      <div
        className={`absolute top-3.5 right-3.5 z-20 flex flex-wrap items-center gap-1 p-1 rounded-xl border backdrop-blur-md shadow-xs transition-colors ${
          isLightTheme
            ? 'bg-white/95 border-slate-200 text-slate-700'
            : 'bg-slate-900/90 border-slate-700/80 text-slate-300'
        }`}
      >
        {/* Static / Lock View Toggle Button */}
        <button
          onClick={() => {
            setIsLocked(!isLocked);
            if (!isLocked) setAutoRotate(false);
          }}
          title={isLocked ? 'Unlock 3D Camera & Interaction' : 'Lock / Static View (Prevents Movement)'}
          className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
            isLocked
              ? 'bg-sky-100 text-sky-800 border border-sky-300 font-semibold shadow-2xs'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          {isLocked ? <Lock className="w-3.5 h-3.5 text-sky-600" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
          <span className="text-[11px] hidden sm:inline">{isLocked ? 'Static View' : 'Orbit'}</span>
        </button>

        <div className={`h-3.5 w-px mx-0.5 ${isLightTheme ? 'bg-slate-200' : 'bg-slate-700'}`} />

        {/* View Presets */}
        <button
          onClick={() => focusOnPreset('anterior', 'LAD')}
          title="Anterior Interventricular View (LAD Focus)"
          className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            viewPreset === 'anterior' && selectedVessel === 'LAD'
              ? 'bg-slate-800 text-white shadow-xs dark:bg-white dark:text-slate-900'
              : 'hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300'
          }`}
        >
          Anterior
        </button>
        <button
          onClick={() => focusOnPreset('lateral', 'LCX')}
          title="Left Circumflex Sulcus (LCX Focus)"
          className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            viewPreset === 'lateral' && selectedVessel === 'LCX'
              ? 'bg-slate-800 text-white shadow-xs dark:bg-white dark:text-slate-900'
              : 'hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300'
          }`}
        >
          Lateral
        </button>
        <button
          onClick={() => focusOnPreset('inferior', 'RCA')}
          title="Inferior / Posterior Diaphragmatic Surface (RCA/PDA)"
          className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            viewPreset === 'inferior'
              ? 'bg-slate-800 text-white shadow-xs dark:bg-white dark:text-slate-900'
              : 'hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300'
          }`}
        >
          Inferior
        </button>
        <button
          onClick={() => focusOnPreset('rightav', 'RCA')}
          title="Right AV Sulcus (RCA Trunk)"
          className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            viewPreset === 'rightav' && selectedVessel === 'RCA'
              ? 'bg-slate-800 text-white shadow-xs dark:bg-white dark:text-slate-900'
              : 'hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300'
          }`}
        >
          Right AV
        </button>

        <div className={`h-3.5 w-px mx-0.5 ${isLightTheme ? 'bg-slate-200' : 'bg-slate-700'}`} />

        {/* Zoom Controls */}
        <button
          disabled={isLocked}
          onClick={() => handleZoom('in')}
          title="Zoom In"
          className="p-1 rounded-md text-xs hover:bg-slate-100 text-slate-500 disabled:opacity-40"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          disabled={isLocked}
          onClick={() => handleZoom('out')}
          title="Zoom Out"
          className="p-1 rounded-md text-xs hover:bg-slate-100 text-slate-500 disabled:opacity-40"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <div className={`h-3.5 w-px mx-0.5 ${isLightTheme ? 'bg-slate-200' : 'bg-slate-700'}`} />

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={() => setIsLightTheme(!isLightTheme)}
          title={isLightTheme ? 'Switch to Dark Theme' : 'Switch to Clean Light Theme'}
          className="p-1 rounded-md text-xs hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        >
          {isLightTheme ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
        </button>

        {/* Orbit Auto-Rotation */}
        <button
          disabled={isLocked}
          onClick={() => setAutoRotate(!autoRotate)}
          title={isLocked ? 'Unlock view to enable rotation' : autoRotate ? 'Stop Slow Orbit' : 'Start Slow Orbit'}
          className={`p-1 rounded-md text-xs transition-colors ${
            autoRotate
              ? 'bg-sky-100 text-sky-700'
              : 'hover:bg-slate-100 text-slate-500 disabled:opacity-40'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* Floating Labels Toggle */}
        <button
          onClick={() => setShowLabels(!showLabels)}
          title={showLabels ? 'Hide Floating Badges' : 'Show Floating Badges'}
          className={`p-1 rounded-md text-xs transition-colors ${
            showLabels ? 'text-sky-700 bg-sky-50' : 'hover:bg-slate-100 text-slate-500'
          }`}
        >
          {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>

        {/* X-Ray Mode Toggle */}
        <button
          onClick={() => setXrayMode(!xrayMode)}
          title={xrayMode ? 'Opaque Anatomy' : 'Translucent X-Ray'}
          className={`p-1 rounded-md text-xs transition-colors ${
            xrayMode ? 'text-sky-700 bg-sky-50' : 'hover:bg-slate-100 text-slate-500'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        {/* Reset Camera Button */}
        <button
          onClick={resetCamera}
          title="Reset Framing (Restores neutral overview without clearing patient prediction)"
          className="p-1 rounded-md text-xs hover:bg-slate-100 text-slate-500 hover:text-slate-800"
        >
          <Compass className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3D Canvas with Post-Processing Bloom & Studio Medical Lighting */}
      <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing">
        <Canvas
          shadows
          camera={{ position: [0.12, 0.08, 4.9], fov: 40 }}
          className="w-full h-full"
        >
          {/* Studio Medical Lighting System */}
          {isLightTheme ? (
            <>
              <ambientLight intensity={1.15} color="#ffffff" />
              <directionalLight
                position={[6, 9, 6]}
                intensity={1.6}
                color="#ffffff"
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-bias={-0.0001}
              />
              <directionalLight
                position={[-6, 4, -5]}
                intensity={0.9}
                color="#38bdf8"
              />
              <directionalLight
                position={[0, -5, 3]}
                intensity={0.45}
                color="#f1f5f9"
              />
              <pointLight position={[0, 1.0, 2.2]} intensity={0.5} color="#ffffff" distance={6} />
            </>
          ) : (
            <>
              <ambientLight intensity={0.65} color="#94a3b8" />
              <directionalLight
                position={[5, 8, 5]}
                intensity={1.6}
                color="#ffffff"
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-bias={-0.0001}
              />
              <directionalLight
                position={[-5, 4, -4]}
                intensity={1.2}
                color="#38bdf8"
              />
              <directionalLight
                position={[0, -5, 2]}
                intensity={0.4}
                color="#cbd5e1"
              />
              <pointLight position={[0, 1.2, 1.8]} intensity={0.8} color="#38bdf8" distance={5} />
            </>
          )}

          <Suspense
            fallback={
              <Html center>
                <div
                  className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border shadow-sm ${
                    isLightTheme ? 'bg-white/95 text-slate-800 border-slate-200' : 'bg-slate-900/95 text-slate-200 border-slate-700'
                  }`}
                >
                  <div className="w-5 h-5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono">Loading 3D Anatomy...</span>
                </div>
              </Html>
            }
          >
            <AnatomicalHeartScene
              ladProb={ladProb}
              lcxProb={lcxProb}
              rcaProb={rcaProb}
              selectedVessel={selectedVessel}
              onSelectVessel={(vessel) => focusOnPreset(vessel === 'LAD' ? 'anterior' : vessel === 'LCX' ? 'lateral' : 'rightav', vessel)}
              isPulsing={isPulsing}
              heartRate={heartRate}
              showLabels={showLabels}
              xrayMode={xrayMode}
              isLightTheme={isLightTheme}
            />

            <CameraFocusController
              targetPos={targetPos}
              targetLookAt={targetLookAt}
              isTransitioning={isTransitioning}
              onTransitionEnd={() => setIsTransitioning(false)}
              controlsRef={controlsRef}
              isInteractingRef={isInteractingRef}
              isLocked={isLocked}
            />
          </Suspense>

          {/* Cinematic Post-Processing Bloom for High-Probability Highlighted Vessels */}
          <EffectComposer multisampling={4} disableNormalPass>
            <Bloom
              luminanceThreshold={0.55}
              luminanceSmoothing={0.35}
              intensity={0.75}
              mipmapBlur
            />
          </EffectComposer>

          <OrbitControls
            ref={controlsRef}
            enableRotate={!isLocked}
            enableZoom={!isLocked}
            enablePan={!isLocked}
            enableDamping
            dampingFactor={0.06}
            minDistance={3.2}
            maxDistance={8.5}
            maxPolarAngle={Math.PI / 1.55}
            autoRotate={!isLocked && autoRotate}
            autoRotateSpeed={0.85}
            onStart={() => {
              isInteractingRef.current = true;
              setIsTransitioning(false); // Stop lerping immediately when user interacts
            }}
            onEnd={() => {
              isInteractingRef.current = false;
            }}
          />
        </Canvas>
      </div>

      {/* Bottom Color Risk Legend & Interactive Quick-Focus Bar */}
      <div
        className={`absolute bottom-3.5 left-3.5 right-3.5 z-20 flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border backdrop-blur-md shadow-xs transition-colors ${
          isLightTheme
            ? 'bg-white/95 border-slate-200 text-slate-800'
            : 'bg-slate-900/90 border-slate-700 text-slate-200'
        }`}
      >
        {/* Anatomical Semantic Legend & Plaque Disclaimers */}
        <div className="flex flex-col gap-1 text-xs max-w-xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: VESSEL_COLORS.LAD }} />
              <span className="font-bold text-slate-800 dark:text-slate-200">LAD</span>
              <span className="text-[11px] text-slate-500">Left Anterior Descending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: VESSEL_COLORS.LCX }} />
              <span className="font-bold text-slate-800 dark:text-slate-200">LCX</span>
              <span className="text-[11px] text-slate-500">Left Circumflex</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: VESSEL_COLORS.RCA }} />
              <span className="font-bold text-slate-800 dark:text-slate-200">RCA</span>
              <span className="text-[11px] text-slate-500">Right Coronary Artery</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>• Vessel emphasis reflects model-predicted probability.</span>
            <span>• Not direct plaque localization.</span>
            <span>• Visual intensity represents model-predicted probability, not measured anatomical severity.</span>
          </div>
        </div>

        {/* Selected Vessel Diagnostic Quick Tabs */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-slate-500 text-xs font-medium hidden lg:inline">Focus:</span>
          {[
            { id: 'LAD', label: 'LAD', prob: ladProb, color: VESSEL_COLORS.LAD, preset: 'anterior' },
            { id: 'LCX', label: 'LCX', prob: lcxProb, color: VESSEL_COLORS.LCX, preset: 'lateral' },
            { id: 'RCA', label: 'RCA', prob: rcaProb, color: VESSEL_COLORS.RCA, preset: 'rightav' }
          ].map((v) => {
            const isSel = selectedVessel === v.id;
            return (
              <button
                key={v.id}
                onClick={() => focusOnPreset(v.preset, v.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                  isSel
                    ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
                style={{
                  borderColor: isSel ? v.color : undefined,
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                <span>{v.label}</span>
                <span className="text-[10px] opacity-90 font-mono">
                  {v.prob != null ? `${(v.prob * 100).toFixed(0)}%` : 'Pending'}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => focusOnPreset('default', null)}
            title="Reset to Neutral Anatomy Overview"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
              !selectedVessel
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
          >
            Overview
          </button>
        </div>
      </div>
    </div>
  );
}

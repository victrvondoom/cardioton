import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { VesselPrediction } from '../types/cv_risk_viz_prediction__src_types__api'

interface Props {
  predictions: VesselPrediction[] | null
  selected: string | null
  onSelect: (t: string | null) => void
}

function probColor(p: number | undefined) {
  if (p === undefined) return '#334155'
  if (p >= 0.7) return '#ef4444'
  if (p >= 0.4) return '#f59e0b'
  return '#22d3ee'
}


const META: Record<string, { label: string }> = {
  cad: { label: 'Overall CAD' },
  lad: { label: 'LAD (anterior descending)' },
  lcx: { label: 'LCX (left circumflex)' },
  rca: { label: 'RCA (right coronary)' },
}

type V3 = [number, number, number]

function Segments({ path, radius, color }: { path: V3[], radius: number, color: string }) {
  return (
    <>
      {path.slice(0, -1).map((p, i) => {
        const q = path[i + 1]
        const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2]
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
        const mid: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]
        const dir: V3 = [dx / len, dy / len, dz / len]
        const axis: V3 = [
          1 * dir[2] - 0 * dir[1],
          0 * dir[0] - 0 * dir[2],
          0 * dir[1] - 1 * dir[0],
        ]
        const angle = Math.acos(Math.max(-1, Math.min(1, dir[1])))
        const axLen = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2)
        const safeAxis: V3 = axLen > 1e-6 ? [axis[0] / axLen, axis[1] / axLen, axis[2] / axLen] : [0, 0, 1]
        return (
          <mesh
            key={i}
            position={mid}
            quaternion={[safeAxis[0], safeAxis[1], safeAxis[2], angle]}
          >
            <cylinderGeometry args={[radius, radius, len, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} />
          </mesh>
        )
      })}
    </>
  )
}

const LAD_PATH: V3[] = [
  [0.08, 0.32, 0.5], [0.02, 0.2, 0.62], [-0.04, 0.02, 0.66], [-0.02, -0.22, 0.6], [0.02, -0.44, 0.48],
]
const LCX_PATH: V3[] = [
  [0.12, 0.28, 0.42], [0.34, 0.18, 0.28], [0.42, -0.02, 0.12], [0.3, -0.22, 0.02],
]
const RCA_PATH: V3[] = [
  [-0.1, 0.3, 0.42], [-0.36, 0.24, 0.2], [-0.5, 0.05, 0.0], [-0.36, -0.12, -0.16], [-0.1, -0.24, -0.2],
]

function Heart({ predictions, onSelect }: Props) {
  const bodyColor = '#7f1d3a'
  const getProb = (t: string) =>
    predictions?.find(p => p.target === (t as VesselPrediction['target']))
  const lcxProb = getProb('lcx')?.probability
  const rcaProb = getProb('rca')?.probability
  const lcxColor = probColor(lcxProb)
  const rcaColor = probColor(rcaProb)

  return (
    <group rotation={[0, 0.4, 0]}>
      <mesh position={[0, -0.05, 0]} scale={[1, 1.25, 0.85]}>
        <sphereGeometry args={[0.55, 48, 48]} />
        <meshStandardMaterial color={bodyColor} roughness={0.55} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0.28, 0.28, 0.12]} scale={[0.7, 0.8, 0.7]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#a52a4a" roughness={0.6} transparent opacity={0.8} />
      </mesh>
      <mesh position={[-0.28, 0.3, 0.1]} scale={[0.7, 0.8, 0.7]}>
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshStandardMaterial color="#8e2340" roughness={0.6} transparent opacity={0.8} />
      </mesh>

      <Segments key={'lad' + probColor(getProb('lad')?.probability)} path={LAD_PATH} radius={0.035} color={probColor(getProb('lad')?.probability)} />
      <Segments key={'lcx' + lcxColor} path={LCX_PATH} radius={0.03} color={lcxColor} />
      <Segments key={'rca' + rcaColor} path={RCA_PATH} radius={0.03} color={rcaColor} />

      <mesh position={LAD_PATH[2]} onClick={() => onSelect('lad')}>
        <sphereGeometry args={[0.1]} /><meshBasicMaterial transparent opacity={0} />
      </mesh>
      <mesh position={LCX_PATH[2]} onClick={() => onSelect('lcx')}>
        <sphereGeometry args={[0.1]} /><meshBasicMaterial transparent opacity={0} />
      </mesh>
      <mesh position={RCA_PATH[2]} onClick={() => onSelect('rca')}>
        <sphereGeometry args={[0.1]} /><meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}

export default function Heart3DScene({ predictions }: { predictions: VesselPrediction[] | null }) {
  const [selected, setSelected] = useState<string | null>(null)
  const sel = predictions?.find(p => p.target === selected)
  // force one re-render shortly after mount so R3F material props sync with
  // prediction data restored from localStorage (some props change without
  // R3F noticing on the very first reconciled frame)
  const [, setTick] = useState(0)
  useEffect(() => { const t = setTimeout(() => setTick(v => v + 1), 400); return () => clearTimeout(t) }, [])

  return (
    <div className="relative h-[560px] rounded-xl overflow-hidden panel">
      <Canvas camera={{ position: [0, 0, 3.6], fov: 40 }} gl={{ preserveDrawingBuffer: true }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 5]} intensity={1} />
        <Heart predictions={predictions} selected={null} onSelect={setSelected} />
        <OrbitControls enablePan enableZoom makeDefault />
      </Canvas>

      <div className="absolute top-3 left-3 panel px-3 py-2 text-xs space-y-1 bg-[#0b1120]/80">
        <div className="text-slate-400 uppercase tracking-wider text-[10px] mb-1">Legend — P(stenosis)</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: '#22d3ee' }} /> &lt; 40%</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: '#f59e0b' }} /> 40–70%</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: '#ef4444' }} /> ≥ 70%</div>
        <div className="flex items-center gap-2 text-slate-500"><span className="w-3 h-3 rounded" style={{ background: '#334155' }} /> no inference yet</div>
      </div>

      {sel && (
        <div className="absolute bottom-3 left-3 panel px-4 py-3 text-xs max-w-xs bg-[#0b1120]/85">
          <div className="text-cyan-300 font-semibold mb-1">{META[sel.target].label}</div>
          <div className="text-slate-300">P(stenosis) = <strong style={{ color: probColor(sel.probability) }}>{(sel.probability * 100).toFixed(1)}%</strong></div>
          <div className="text-slate-400 mt-1">model: {sel.model_name} · threshold {sel.threshold.toFixed(2)} · {sel.prediction === 1 ? 'positive' : 'negative'}</div>
          <div className="text-slate-500 mt-1">Schematic coronary map — predicted risk is NOT a measured
          anatomical blockage and is not patient-specific lesion localization.</div>
        </div>
      )}
    </div>
  )
}

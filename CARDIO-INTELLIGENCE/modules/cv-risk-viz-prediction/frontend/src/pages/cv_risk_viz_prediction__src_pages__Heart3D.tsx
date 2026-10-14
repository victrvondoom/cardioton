import { Link } from 'react-router-dom'
import { MousePointer2 } from 'lucide-react'
import Heart3DScene from '../three/HeartMesh'
import { usePrediction } from '../state/PredictionContext'
import ClinicalDisclaimer from '../components/ClinicalDisclaimer'

export default function Heart3D() {
  const { prediction } = usePrediction()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Interactive 3D Heart</h1>
        <div className="text-xs text-slate-400 flex items-center gap-4">
          <span><MousePointer2 size={12} className="inline" /> click a vessel to select</span>
          <span>drag to rotate · scroll to zoom · right-drag to pan</span>
        </div>
      </div>
      {prediction ? (
        <Heart3DScene predictions={prediction.predictions} />
      ) : (
        <div className="panel p-8 text-center text-sm text-slate-400">
          No prediction yet in this session.{' '}
          <Link to="/input" className="text-cyan-400 underline">Submit patient features</Link> and the coronaries
          will re-color from live model inference.
        </div>
      )}
      <ClinicalDisclaimer />
    </div>
  )
}

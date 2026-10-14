import { Link } from 'react-router-dom'
import { HeartPulse, Stethoscope, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useHealth } from '../api/cv_risk_viz_prediction__src_api__hooks'
import { usePrediction } from '../state/PredictionContext'
import ClinicalDisclaimer from '../components/ClinicalDisclaimer'

const TARGET_META: Record<string, { name: string; color: string }> = {
  cad: { name: 'Overall CAD', color: 'text-cyan-300' },
  lad: { name: 'LAD', color: 'text-teal-300' },
  lcx: { name: 'LCX', color: 'text-emerald-300' },
  rca: { name: 'RCA', color: 'text-sky-300' },
}

function probColor(p: number) {
  if (p >= 0.7) return '#ef4444'
  if (p >= 0.4) return '#f59e0b'
  return '#22d3ee'
}

export default function Dashboard() {
  const { health, error, loading, reload } = useHealth()
  const { prediction, features } = usePrediction()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <HeartPulse className="text-cyan-400" size={28} />
        <h1 className="text-2xl font-bold text-slate-100">Clinical Intelligence Dashboard</h1>
      </div>
      <ClinicalDisclaimer />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Model Health</div>
          {loading ? (
            <Loader2 className="animate-spin text-cyan-400" />
          ) : error ? (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <XCircle size={16} /> Backend unreachable
              <button onClick={reload} className="glow-btn px-2 py-1 rounded text-xs text-white">Retry</button>
            </div>
          ) : health?.models_loaded ? (
            <div className="text-sm text-emerald-400 flex items-center gap-2">
              <CheckCircle2 size={16} /> 4 models loaded · v{health.model_version}
            </div>
          ) : (
            <div className="text-amber-400 text-sm">Degraded: {health?.error ?? 'artifacts unavailable'}</div>
          )}
          <div className="mt-2 text-xs text-slate-500">
            {health && `status: ${health.status} · readiness: ${health.readiness}`}
          </div>
        </div>

        <div className="panel p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Input Completeness</div>
          {prediction ? (
            <div className="text-sm">
              <span className="text-cyan-300 font-semibold">{Math.round(prediction.input_completeness.fraction * 100)}%</span>
              <span className="text-slate-400"> of schema fields supplied
                ({prediction.input_completeness.supplied}/{prediction.input_completeness.total})</span>
            </div>
          ) : (
            <div className="text-sm text-slate-400">No prediction yet — <Link className="text-cyan-400 underline" to="/input">enter a patient</Link>.</div>
          )}
        </div>

        <div className="panel p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Model Version</div>
          <div className="text-sm font-mono text-teal-300">{prediction?.model_version ?? health?.model_version ?? '—'}</div>
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Stethoscope size={16} /> Risk Predictions
        </h2>
        {prediction ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {prediction.predictions.map(p => (
              <div key={p.target} className="panel p-4">
                <div className={`text-xs uppercase tracking-wider ${TARGET_META[p.target].color}`}>{TARGET_META[p.target].name}</div>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-4xl font-bold" style={{ color: probColor(p.probability) }}>
                    {(p.probability * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400 mb-1">P(stenosis)</span>
                </div>
                <div className="mt-2 h-2 rounded bg-slate-800 overflow-hidden">
                  <div className="h-full rounded transition-all duration-500"
                    style={{ width: `${p.probability * 100}%`, background: probColor(p.probability) }} />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span>{p.model_name}</span>
                  <span>thr {p.threshold.toFixed(2)} · {p.prediction === 1 ? 'positive' : 'negative'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel p-8 text-center text-slate-400 text-sm">
            No inference has been performed in this session yet.{' '}
            <Link to="/input" className="text-cyan-400 underline">Submit patient features</Link> to run the four trained classifiers.
          </div>
        )}
      </section>

      {Object.keys(features).length > 0 && (
        <section className="panel p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Session Patient Snapshot</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-300">
            {Object.entries(features).slice(0, 24).map(([k, v]) => (
              <div key={k} className="bg-white/5 rounded px-2 py-1 flex justify-between">
                <span className="text-slate-500">{k.replace('_', ' ')}</span><span>{String(v)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

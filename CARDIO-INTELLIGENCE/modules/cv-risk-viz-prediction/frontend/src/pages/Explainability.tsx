import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Loader2, TriangleAlert } from 'lucide-react'
import { api } from '../api/cv_risk_viz_prediction__src_api__client'
import { usePrediction } from '../state/PredictionContext'
import type { ExplainResponse, TargetKey } from '../types/cv_risk_viz_prediction__src_types__api'

const TARGETS: TargetKey[] = ['cad', 'lad', 'lcx', 'rca']

export default function Explainability() {
  const { features, prediction } = usePrediction()
  const [target, setTarget] = useState<TargetKey>('cad')
  const [expl, setExpl] = useState<ExplainResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (target: TargetKey) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.explain(features, target)
      setExpl(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'explanation failed')
    } finally {
      setLoading(false)
    }
  }, [features])

  useEffect(() => {
    if (Object.keys(features).length === 0) return
    void load(target)
  }, [target, features, load])

  if (Object.keys(features).length === 0 && !prediction) {
    return <div className="panel p-8 text-center text-slate-400 text-sm">Submit a patient first — explanations correspond to that exact feature row.</div>
  }

  const data = (expl?.contributions ?? []).map(c => ({
    name: c.feature,
    contribution: Number(c.contribution.toFixed(4)),
  }))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Explainable AI — Patient-Specific SHAP</h1>
      <div className="flex gap-2">
        {TARGETS.map(t => (
          <button key={t} onClick={() => setTarget(t)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${target === t
              ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300'
              : 'border-slate-700 text-slate-400 hover:bg-white/5'}`}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" /> Computing TreeExplainer contributions…</div>}
      {error && (
        <div className="panel border-amber-500/40 p-4 text-sm text-amber-300 flex items-center gap-2">
          <TriangleAlert size={16} /> {error}
          <button onClick={() => void load(target)} className="ml-auto glow-btn px-3 py-1 rounded text-white text-xs">Retry</button>
        </div>
      )}

      {expl && (
        <div className="space-y-4">
          <div className="panel p-4 text-xs text-slate-400">
            method: <span className="text-teal-300">{expl.method}</span> · output space: {expl.output_space} ·
            baseline (E[f(X)]): <span className="text-cyan-300 font-mono">{expl.baseline.toFixed(3)}</span> ·
            model: {expl.model_name} · version {expl.model_version}
          </div>
          <div className="panel p-4 h-[520px]">
            <ResponsiveContainer>
              <BarChart data={data} layout="vertical" margin={{ left: 150, right: 20 }}>
                <XAxis type="number" tick={{ fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" width={200} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e3a5f' }} />
                <ReferenceLine x={0} stroke="#475569" />
                <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                  {data.map((d, i) => <Cell key={i} fill={d.contribution >= 0 ? '#ef4444' : '#22d3ee'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500">
            Red bars push the probability toward stenosis; cyan bars push toward normal. SHAP contributions are
            additive attributions in log-odds space — associative, NOT proof of causality.
          </p>
        </div>
      )}
    </div>
  )
}

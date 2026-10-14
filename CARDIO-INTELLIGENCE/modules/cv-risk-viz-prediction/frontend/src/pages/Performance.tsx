import { Loader2, TriangleAlert } from 'lucide-react'
import { useMetrics } from '../api/cv_risk_viz_prediction__src_api__hooks'
import type { HoldoutMetrics, TargetKey } from '../types/cv_risk_viz_prediction__src_types__api'

const TARGETS: TargetKey[] = ['cad', 'lad', 'lcx', 'rca']
const ROWS: [keyof HoldoutMetrics, string][] = [
  ['macro_f05', 'Macro F0.5 ↑'], ['f05_positive', 'Positive F0.5 ↑'],
  ['accuracy', 'Accuracy ↑'], ['recall_sensitivity', 'Sensitivity ↑'],
  ['specificity', 'Specificity ↑'], ['precision', 'Precision ↑'],
  ['f1', 'F1 ↑'], ['macro_f1', 'Macro F1 ↑'],
  ['roc_auc', 'ROC-AUC ↑'], ['pr_auc', 'PR-AUC ↑'], ['brier', 'Brier ↓'],
  ['false_negatives', 'False negatives ↓'], ['false_positives', 'False positives ↓'],
]

export default function Performance() {
  const { metrics, loading, error, reload } = useMetrics()

  if (loading) return <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" /> Loading evaluation artifacts…</div>
  if (error) return (
    <div className="panel p-8 text-center">
      <TriangleAlert className="mx-auto text-amber-400 mb-3" size={30} />
      <p className="text-slate-300 mb-4">{error}</p>
      <button onClick={reload} className="glow-btn px-4 py-2 rounded-lg text-sm">Retry</button>
    </div>
  )
  if (!metrics) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Model Performance</h1>
      <p className="text-xs text-slate-500">
        All values below are read live from /api/metrics, backed by the artifacts saved at training time
        (held-out 20% stratum, never used for model or threshold selection). Model version {metrics.model_version}.
      </p>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-cyan-400 mb-2">Selected models (argmax CV macro-F0.5)</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {TARGETS.map(t => {
            const c = metrics.chosen_models[t]
            return (
              <div key={t} className="panel p-4">
                <div className="text-xs uppercase text-teal-300">{t.toUpperCase()}</div>
                <div className="text-lg font-semibold mt-1">{c.model}</div>
                <div className="text-xs text-slate-400 mt-1">CV macro-F0.5: {c.cv_macro_f05.toFixed(3)} ± {c.cv_macro_f05_std.toFixed(3)}</div>
                <div className="text-xs text-slate-400">threshold: {c.tuned_threshold.toFixed(2)}</div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-cyan-400 mb-2">Holdout test metrics (default threshold 0.5)</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left px-3 py-2">Metric</th>
                {TARGETS.map(t => <th key={t} className="px-3 py-2">{t.toUpperCase()} (n={metrics.metrics[t]?.n_test})</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, label]) => (
                <tr key={String(k)} className="border-b border-slate-800/60 hover:bg-white/5">
                  <td className="px-3 py-1.5 text-slate-300">{label}</td>
                  {TARGETS.map(t => {
                    const v = metrics.metrics[t]?.default?.[k]
                    return <td key={t} className="px-3 py-1.5 text-center font-mono text-slate-200">
                      {typeof v === 'number' ? (k === 'tp' || k === 'fp' || k === 'fn' || k === 'tn' || k.startsWith('false')
                        ? v : v.toFixed(3)) : '—'}
                    </td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Sensitivity safeguards: models reaching zero CV precision or zero CV recall were rejected prior to the
        argmax. No clinically justified minimum-sensitivity floor was invented; the full CV precision/recall
        trade-off table for every threshold is exported in reports/leaderboards/.
      </p>
    </div>
  )
}

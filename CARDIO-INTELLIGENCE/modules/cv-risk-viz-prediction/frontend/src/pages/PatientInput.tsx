import { useMemo, useState } from 'react'
import { Loader2, Play, RotateCcw, TriangleAlert } from 'lucide-react'
import { useSchema } from '../api/cv_risk_viz_prediction__src_api__hooks'
import { api } from '../api/cv_risk_viz_prediction__src_api__client'
import { usePrediction } from '../state/PredictionContext'
import ClinicalDisclaimer from '../components/ClinicalDisclaimer'
import type { PredictResponse } from '../types/cv_risk_viz_prediction__src_types__api'

// Illustrative demo patient (median-like typical profile, NOT a real record).
const DEMO: Record<string, string | number> = {
  Age: 62, Weight: 85, Length: 172, Sex: 'Male', BMI: 28.7, DM: 1, HTN: 1,
  'Current Smoker': 0, 'EX-Smoker': 1, FH: 0, Obesity: 'N', CRF: 'N', CVA: 'N',
  'Airway disease': 'N', 'Thyroid Disease': 'N', CHF: 'N', DLP: 'Y', BP: 145,
  PR: 82, Edema: 0, 'Weak Peripheral Pulse': 'N', 'Lung rales': 'N',
  'Systolic Murmur': 'N', 'Diastolic Murmur': 'Y', 'Typical Chest Pain': 1,
  Dyspnea: 'Y', 'Function Class': 2, Atypical: 'N', Nonanginal: 'N',
  'Exertional CP': 'N', 'LowTH Ang': 'N', 'Q Wave': 0, 'St Elevation': 0,
  'St Depression': 1, Tinversion: 1, LVH: 'N', 'Poor R Progression': 'N',
  BBB: 'N', FBS: 130, CR: 1.2, TG: 220, LDL: 140, HDL: 33, BUN: 20, ESR: 12,
  HB: 14.0, K: 4.3, Na: 140, WBC: 8000, Lymph: 30, Neut: 60, PLT: 240,
  'EF-TTE': 45, 'Region RWMA': 2, VHD: 'mild',
}

const GROUP_ORDER = ['demographics', 'examinations', 'ECG', 'laboratory']
const GROUP_TITLES: Record<string, string> = {
  demographics: 'Demographics', examinations: 'Examinations',
  ECG: 'ECG & Echocardiography', laboratory: 'Laboratory Findings',
}

let catOptions: Record<string, string[]> = {}

type SchemaFeat = { feature: string; display_name: string; type: string; group?: string | null }

function classify(schemaFeatures: SchemaFeat[]) {
  catOptions = {}
  for (const f of schemaFeatures) {
    if (f.type === 'categorical') {
      catOptions[f.feature] = ['Y', 'N', 'Male', 'Fmale', 'mild', 'Moderate', 'Severe']
    }
  }
}

export default function PatientInput() {
  const { schema, error, loading, reload } = useSchema()
  const { setFeatures, setPrediction, prediction } = usePrediction()
  const [form, setForm] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const groups = useMemo(() => {
    if (!schema) return null
    classify(schema.features)
    const g: Record<string, typeof schema.features> = {}
    for (const f of schema.features) {
      const key = f.group ?? 'laboratory'
      ;(g[key] ??= []).push(f)
    }
    // heuristics: ECG/TTE columns into ECG group
    g.ECG = schema.features.filter(f =>
      ['Q Wave', 'St Elevation', 'St Depression', 'Tinversion', 'LVH', 'Poor R Progression', 'BBB',
       'EF-TTE', 'Region RWMA', 'VHD'].includes(f.feature))
    for (const f of g.ECG) {
      for (const k of GROUP_ORDER.slice(0, 3)) {
        if (g[k]) g[k] = g[k].filter(x => x.feature !== f.feature)
      }
    }
    return g
  }, [schema])

  const numericSchema = useMemo(() => {
    const m = new Map<string, { min?: number; max?: number }>()
    if (schema) for (const f of schema.features) {
      if (f.type !== 'categorical') m.set(f.feature, { min: f.min, max: f.max })
    }
    return m
  }, [schema])

  function setValue(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setDone(false)
    // validate: coerce numerics, check ranges
    const payload: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(form)) {
      const num = numericSchema.get(k)
      const parsed = num ? Number(v) : v
      if (v === '') continue
      if (num && Number.isNaN(parsed)) {
        setSubmitError(`Field "${k}" must be numeric (got "${v}")`)
        return
      }
      if (num && num.min != null && num.max != null && (Number(parsed) < num.min || Number(parsed) > num.max)) {
        setSubmitError(`Field "${k}" out of plausible range (${num.min}–${num.max})`)
        return
      }
      payload[k] = parsed
    }
    setFeatures(payload)
    setSubmitting(true)
    try {
      const preds: PredictResponse = await api.predict(payload)
      setPrediction(preds)
      setDone(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'inference failed')
    } finally {
      setSubmitting(false)
    }
  }

  function fillDemo() {
    setForm(Object.fromEntries(Object.entries(DEMO).map(([k, v]) => [k, String(v)])))
  }

  function reset() {
    setForm({})
    setSubmitError(null)
    setDone(false)
  }

  if (loading) return <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" /> Loading model schema…</div>
  if (error) return (
    <div className="panel p-8 text-center">
      <TriangleAlert className="mx-auto text-amber-400 mb-3" size={32} />
      <p className="text-slate-300 mb-4">Backend unavailable: {error}</p>
      <button onClick={reload} className="glow-btn px-4 py-2 rounded-lg text-sm">Retry</button>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Patient Input</h1>
        <div className="flex gap-2">
          <button onClick={fillDemo} className="px-3 py-1.5 rounded-lg border border-teal-500/40 text-teal-300 text-sm hover:bg-teal-500/10">
            Load demo patient
          </button>
          <button onClick={reset} className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-white/5">
            <RotateCcw size={14} className="inline mr-1" /> Reset
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Illustrative demo data is labeled research-grade; no real patient record is used.
        Angiography outcome columns (LAD/LCX/RCA/Cath) are never collected — they are ground-truth targets.
      </p>
      <ClinicalDisclaimer />

      <form onSubmit={submit} className="space-y-5">
        {groups && GROUP_ORDER.map(g => (groups[g]?.length ? (
          <fieldset key={g} className="panel p-4">
            <legend className="text-xs uppercase tracking-wider text-cyan-400 px-2">{GROUP_TITLES[g]}</legend>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {groups[g].map(f => (
                <label key={f.feature} className="text-xs">
                  <span className="block text-slate-400 mb-1">{f.display_name}</span>
                  {catOptions[f.feature] ? (
                    <select
                      value={form[f.feature] ?? ''}
                      onChange={e => setValue(f.feature, e.target.value)}
                      className="w-full bg-[#0f172a] border border-slate-700 rounded px-2 py-1.5 focus:border-cyan-500 outline-none"
                    >
                      <option value="">—</option>
                      {catOptions[f.feature].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type="number"
                      step="any"
                      value={form[f.feature] ?? ''}
                      onChange={e => setValue(f.feature, e.target.value)}
                      placeholder={f.type === 'numeric' ? 'number' : '0/1'}
                      className="w-full bg-[#0f172a] border border-slate-700 rounded px-2 py-1.5 focus:border-cyan-500 outline-none"
                    />
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null))}

        {submitError && (
          <div className="panel border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {submitError} — click the submit button to retry.
          </div>
        )}
        {done && prediction && (
          <div className="panel border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Inference complete: CAD {(prediction.predictions[0].probability * 100).toFixed(1)}% ·
            LAD {(prediction.predictions[1].probability * 100).toFixed(1)}% ·
            LCX {(prediction.predictions[2].probability * 100).toFixed(1)}% ·
            RCA {(prediction.predictions[3].probability * 100).toFixed(1)}%.
            See <a className="underline" href="/heart">3D Heart</a> for vessel risk colors.
          </div>
        )}
        <button type="submit" disabled={submitting}
          className="glow-btn px-5 py-2.5 rounded-lg font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50">
          {submitting ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
          {submitting ? 'Running 4 classifiers…' : 'Run inference'}
        </button>
      </form>
    </div>
  )
}

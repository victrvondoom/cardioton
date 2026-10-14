import { createContext, useContext, useEffect, useState } from 'react'
import type { PredictResponse, ExplainResponse } from '../types/cv_risk_viz_prediction__src_types__api'

interface PatientFeatures {
  [key: string]: string | number
}

interface PredictionState {
  features: PatientFeatures
  setFeatures: (f: PatientFeatures) => void
  prediction: PredictResponse | null
  setPrediction: (p: PredictResponse | null) => void
  explanation: Record<string, ExplainResponse> | null
  setExplanation: (e: Record<string, ExplainResponse>) => void
}

const PRED_KEY = 'cv-prediction'

const Ctx = createContext<PredictionState | undefined>(undefined)

export function PredictionProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<PatientFeatures>(() => {
    try {
      const raw = localStorage.getItem(PRED_KEY)
      const saved = raw ? JSON.parse(raw) : null
      return saved?.features ?? {}
    } catch { return {} }
  })
  const [prediction, setPrediction] = useState<PredictResponse | null>(() => {
    try {
      const raw = localStorage.getItem(PRED_KEY)
      const saved = raw ? JSON.parse(raw) : null
      return saved?.prediction ?? null
    } catch { return null }
  })
  const [explanation, setExplanation] = useState<Record<string, ExplainResponse> | null>(null)

  // persist latest prediction so page reloads and direct-URL navigation retain it
  useEffect(() => {
    try {
      if (prediction) localStorage.setItem(PRED_KEY, JSON.stringify({ features, prediction }))
      else localStorage.removeItem(PRED_KEY)
    } catch { /* storage unavailable */ }
  }, [prediction, features])

  return (
    <Ctx.Provider value={{ features, setFeatures, prediction, setPrediction, explanation, setExplanation }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePrediction() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePrediction must be used within PredictionProvider')
  return ctx
}

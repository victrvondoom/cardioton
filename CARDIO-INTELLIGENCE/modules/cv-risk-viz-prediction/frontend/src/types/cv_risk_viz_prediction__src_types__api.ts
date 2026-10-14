// Shared API types mirroring backend Pydantic schemas.
export type TargetKey = 'cad' | 'lad' | 'lcx' | 'rca'

export interface VesselPrediction {
  target: TargetKey
  probability: number
  prediction: 0 | 1
  threshold: number
  model_name: string
}

export interface PredictResponse {
  predictions: VesselPrediction[]
  model_version: string
  input_completeness: { supplied: number; total: number; fraction: number }
  disclaimer: string
}

export interface Contribution {
  feature: string
  value: number | string
  contribution: number
}

export interface ExplainResponse {
  target: TargetKey
  method: string
  output_space: string
  baseline: number
  contributions: Contribution[]
  model_name: string
  model_version: string
  disclaimer: string
}

export interface FeatureSpec {
  feature: string
  display_name: string
  type: 'categorical' | 'numeric' | 'binary'
  allowed_values?: (string | number)[]
  min?: number
  max?: number
  group?: string | null
  required: boolean
}

export interface SchemaResponse {
  features: FeatureSpec[]
  forbidden_features: string[]
}

export interface HealthStatus {
  status: string
  models_loaded: boolean
  model_version: string
  readiness: string
  error?: string | null
}

export interface HoldoutMetrics {
  threshold: number
  accuracy: number
  precision: number
  recall_sensitivity: number
  specificity: number
  f1: number
  f05_positive: number
  macro_f05: number
  macro_f1: number
  roc_auc: number
  pr_auc: number
  brier: number
  tp: number
  fp: number
  fn: number
  tn: number
  false_negatives: number
  false_positives: number
}

export interface ChosenModel {
  model: string
  cv_macro_f05: number
  cv_macro_f05_std: number
  tuned_threshold: number
  selection_note: string
  test_default_macro_f05?: number
}

export interface ModelsResponse {
  models: Record<TargetKey, { chosen_model: string; threshold: number }>
  model_version: string
}

export interface MetricsResponse {
  metrics: Record<TargetKey, { default: HoldoutMetrics; tuned: HoldoutMetrics; n_test: number }>
  chosen_models: Record<TargetKey, ChosenModel>
  model_version: string
}

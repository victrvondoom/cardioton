export interface SchemaField {
  name: string;
  type: 'numeric' | 'binary';
  min?: number;
  max?: number;
  median?: number;
}

export interface PatientData {
  [key: string]: number;
}

export interface SamplePatient {
  id: string;
  name: string;
  description: string;
  ground_truth: {
    CAD: string;
    LAD: string;
    LCX: string;
    RCA: string;
  };
  data: PatientData;
}

export interface PredictionResult {
  probabilities: {
    CAD: number;
    LAD: number;
    LCX: number;
    RCA: number;
  };
  vessel_status: {
    CAD: string;
    LAD: string;
    LCX: string;
    RCA: string;
  };
  risk_tier: 'High Risk' | 'Moderate Risk' | 'Low Risk';
  thresholds: {
    CAD: number;
    LAD: number;
    LCX: number;
    RCA: number;
  };
  disclaimer: string;
}

export interface ShapFeature {
  feature: string;
  value: number;
  shap: number;
  abs_shap: number;
}

export interface ExplanationResult {
  target: string;
  positive_features: ShapFeature[];
  negative_features: ShapFeature[];
  all_top_features: ShapFeature[];
  disclaimer: string;
}

export interface WhatIfComparison {
  baseline_prob: number;
  modified_prob: number;
  absolute_risk_reduction: number;
  relative_percent_change: number;
}

export interface WhatIfResult {
  changes_applied: Record<string, number>;
  risk_comparison: {
    CAD: WhatIfComparison;
    LAD: WhatIfComparison;
    LCX: WhatIfComparison;
    RCA: WhatIfComparison;
  };
  modified_risk_tier: string;
}

export interface CvMetricRow {
  target: string;
  model: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
  accuracy_std?: number;
  precision_std?: number;
  recall_std?: number;
  f1_std?: number;
  roc_auc_std?: number;
}

export interface MetricsData {
  best_models: Record<string, string>;
  cv_best: CvMetricRow[];
  shap_top_features: Record<string, Record<string, number>>;
  feature_order: string[];
}

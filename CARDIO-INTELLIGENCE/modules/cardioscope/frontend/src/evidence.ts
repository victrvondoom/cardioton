import { TARGETS, type Target, type TargetDefinition } from './api';

export const METRICS = [
  ['roc_auc', 'ROC-AUC'], ['accuracy', 'Accuracy'], ['balanced_accuracy', 'Balanced accuracy'],
  ['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1'], ['brier_score', 'Brier score'],
] as const;
export type Metric = typeof METRICS[number][0];
export interface Interval { interval: [number, number] | null; confidence_level: number; method: string; reason?: string | null }
export interface EvidenceTarget {
  definition: TargetDefinition;
  model: { id: string; family: 'logistic' | 'forest'; params: { C?: number; class_weight: string | null; max_depth?: number; min_samples_leaf?: number } };
  metrics: Record<Metric, number> & { threshold: number; class_counts: { '0': number; '1': number }; confusion_matrix: [[number, number], [number, number]] };
  uncertainty: { intervals: Record<Metric, Interval>; limitation: string };
  development_roc_auc: { development_nested_cv_mean: number; development_outer_sample_sd: number; final_holdout: number; interpretation: string };
}
export interface EvidenceData {
  phase: 'FINAL_HOLDOUT'; evaluation_id: string; completed_utc: string;
  records: { total: number; development: number; holdout: number }; threshold: number;
  nested_cv: { outer: number; inner: number }; model_version: string; schema_version: number; schema_fingerprint: string;
  development_run_id: string; targets: Record<Target, EvidenceTarget>; source: { path: string; sha256: string };
}
export function validateEvidence(data: EvidenceData): EvidenceData {
  const fail = () => { throw new Error('Saved evaluation evidence failed verification; no metrics displayed.'); };
  const finite = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
  if (!data || data.phase !== 'FINAL_HOLDOUT' || data.records?.total !== 303 || data.records.development !== 242 ||
      data.records.holdout !== 61 || data.threshold !== .5 || data.nested_cv?.outer !== 5 || data.nested_cv.inner !== 3 ||
      data.schema_version !== 1 || !data.evaluation_id || !data.source?.path.endsWith('/results.json') ||
      ![data.model_version, data.schema_fingerprint, data.source.sha256].every(v => /^[a-f0-9]{64}$/.test(v ?? '')) ||
      Object.keys(data.targets ?? {}).sort().join() !== [...TARGETS].sort().join()) fail();
  for (const target of TARGETS) {
    const t = data.targets[target], m = t?.metrics, matrix = m?.confusion_matrix;
    if (!t || t.definition?.column !== (target === 'CAD' ? 'Cath' : target) ||
        t.definition.positive_class !== (target === 'CAD' ? 'CAD' : 'Stenotic') || t.definition.negative_class !== 'Normal' ||
        m?.threshold !== .5 || !METRICS.every(([key]) => finite(m[key])) ||
        !Array.isArray(matrix) || matrix.length !== 2 || matrix.some(row => row.length !== 2 || row.some(n => !Number.isInteger(n) || n < 0)) ||
        !Number.isInteger(m.class_counts?.['0']) || !Number.isInteger(m.class_counts?.['1']) ||
        matrix[0][0] + matrix[0][1] !== m.class_counts['0'] || matrix[1][0] + matrix[1][1] !== m.class_counts['1'] ||
        m.class_counts['0'] + m.class_counts['1'] !== 61 ||
        !finite(t.development_roc_auc?.development_nested_cv_mean) || t.development_roc_auc.final_holdout !== m.roc_auc ||
        t.model?.id !== (target === 'CAD' || target === 'LAD' ? 'logistic-C0.1-balanced' :
          target === 'LCX' ? 'forest-depth3-leaf10-none' : 'forest-depth5-leaf10-none')) fail();
    for (const [metric] of METRICS) {
      const interval = t.uncertainty?.intervals?.[metric];
      if (!interval || interval.confidence_level !== .95 || !interval.method ||
          (interval.interval !== null && (interval.interval.length !== 2 || !interval.interval.every(finite) || interval.interval[0] > interval.interval[1]))) fail();
    }
  }
  return data;
}

import { api, type ApplicationMetadata, type FeatureManifest, type Prediction, type Target } from './api';
export interface Contribution { feature: string; value: number | string; unit: string | null; contribution: number }
export interface Explanation {
  target: Target; positive_class: string; probability: number; positive: boolean; status: string; threshold: number;
  output_space: 'log_odds' | 'probability'; contribution_units: string;
  baseline: number; explained_output: number; total_contribution: number; reconstructed_output: number;
  reconstruction_residual: number; reconstruction_tolerance: number; remaining_factor_contribution: number;
  encoded_contribution_sum: number; contributions: Contribution[];
  profile_fingerprint: string; model_version: string; schema_fingerprint: string; model_sha256: string;
  method: string; method_version: string; explanation_configuration_fingerprint: string;
  background_fingerprint: string; background_records: number; feature_perturbation: string; aggregation: string;
}
const sha = /^[a-f0-9]{64}$/;
export function validateExplanation(r: Explanation, target: Target, prediction: Prediction,
  features: Record<string, number | string>, schema: FeatureManifest, metadata: ApplicationMetadata): Explanation {
  const o = prediction.outputs[target], logistic = target === 'CAD' || target === 'LAD';
  const close = (a: number, b: number, tol = 1e-10) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
  const fail = () => { throw new Error('Unverified or stale explanation rejected; predictions remain available.'); };
  if (!r || r.target !== target || r.profile_fingerprint !== prediction.profile_fingerprint ||
      !metadata || metadata.model_version !== prediction.model_version ||
      metadata.schema_fingerprint !== prediction.schema_fingerprint || metadata.model_checksums[target] !== o.model_sha256 ||
      r.explanation_configuration_fingerprint !== metadata.explanation_configuration_fingerprint ||
      r.background_fingerprint !== metadata.background_fingerprint ||
      r.model_version !== prediction.model_version || r.schema_fingerprint !== prediction.schema_fingerprint ||
      r.model_sha256 !== o.model_sha256 || !close(r.probability, o.probability, 1e-12) ||
      r.positive_class !== o.positive_class || r.positive !== o.positive || r.status !== o.status || r.threshold !== .5 ||
      r.output_space !== (logistic ? 'log_odds' : 'probability') ||
      r.contribution_units !== (logistic ? 'model log-odds' : 'probability units') ||
      r.method !== (logistic ? 'LinearExplainer' : 'TreeExplainer') || r.method_version !== 'shap-0.52.0/cardioscope-v1' ||
      !sha.test(r.explanation_configuration_fingerprint ?? '') || !sha.test(r.background_fingerprint ?? '') ||
      r.background_records !== 100 || r.feature_perturbation !== 'interventional' ||
      r.reconstruction_tolerance !== (logistic ? 1e-10 : 1e-6) || r.remaining_factor_contribution !== 0 ||
      !Array.isArray(r.contributions) || r.contributions.length !== 55) fail();
  const names = r.contributions.map(c => c.feature);
  if (new Set(names).size !== 55 || names.join() !== schema.feature_order.join()) fail();
  for (const c of r.contributions) {
    const spec = schema.features.find(f => f.name === c.feature)!;
    if (c.value !== features[c.feature] || !Number.isFinite(c.contribution) ||
        c.unit !== (spec.unit_status === 'verified' ? spec.unit : null)) fail();
  }
  const sum = r.contributions.reduce((s, c) => s + c.contribution, 0);
  if (!close(sum, r.total_contribution) || !close(sum, r.encoded_contribution_sum) ||
      !close(r.baseline + sum, r.reconstructed_output) ||
      !close(r.reconstructed_output - r.explained_output, r.reconstruction_residual) ||
      Math.abs(r.reconstruction_residual) > r.reconstruction_tolerance ||
      !close(logistic ? 1 / (1 + Math.exp(-r.explained_output)) : r.explained_output, r.probability, 1e-12)) fail();
  return r;
}
export function explanationFactors(result: Explanation) {
  const up = result.contributions.filter(c => c.contribution > 0).sort((a, b) => b.contribution - a.contribution).slice(0, 5);
  const down = result.contributions.filter(c => c.contribution < 0).sort((a, b) => a.contribution - b.contribution).slice(0, 5);
  const shown = new Set([...up, ...down].map(c => c.feature));
  const rest = result.contributions.filter(c => !shown.has(c.feature));
  return { up, down, rest, remaining: rest.reduce((sum, c) => sum + c.contribution, 0) };
}
export async function fetchExplanation(features: Record<string, number | string>, target: Target,
  prediction: Prediction, signal: AbortSignal): Promise<Explanation> {
  return api.explain({ features, target, probability: prediction.outputs[target].probability,
    profile_fingerprint: prediction.profile_fingerprint, model_version: prediction.model_version,
    schema_fingerprint: prediction.schema_fingerprint, model_sha256: prediction.outputs[target].model_sha256 }, signal);
}

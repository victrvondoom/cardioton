export interface Health {
  service: 'CardioScope';
  version: string;
  phase: 'inference';
  data_prepared: boolean;
  anatomy_prepared: boolean;
  models_loaded: boolean;
  model_error: string | null;
}

export interface TargetDefinition {
  column: string;
  positive_class: string;
  negative_class: string;
}

export interface FeatureDefinition {
  name: string;
  kind: 'integer' | 'number' | 'category';
  storage_dtype: string;
  unit: string | null;
  unit_status: string;
  categories: string[] | null;
  categories_source: string | null;
  required: boolean;
}

export interface FeatureManifest {
  schema_version: number;
  dataset_zip_sha256: string;
  workbook_sha256: string;
  feature_order: string[];
  features: FeatureDefinition[];
  targets: Record<string, TargetDefinition>;
  forbidden_feature_aliases: string[];
  missing_input_policy: string;
  preprocessing_fitted: boolean;
}

export interface AnatomyManifest {
  schema_version: number;
  groups: Record<string, { concept_id: string; representation_id: string; leaf_ids: string[]; original_leaf_ids?: string[]; source_name: string }>;
  meshes: Record<string, { path: string; sha256: string; vertices: number; faces: number; bytes: number }>;
  assembly: { center: number[]; scale: number; coordinate_units: string };
  browser_render_verified: boolean;
  anatomical_visual_review_complete: boolean;
  source_records: { attribution: string; license: string };
}

export interface ProfileValidation {
  valid: boolean;
  profile_fingerprint: string;
  feature_manifest_sha256: string;
  model_version: string | null;
}

async function request<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    signal,
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { detail?: unknown };
    throw new Error(typeof error.detail === 'string' ? error.detail : `API error ${response.status}`);
  }
  try { return (await response.json()) as T; }
  catch { throw new Error('Malformed API response; no results available.'); }
}

export const api = {
  health: (signal?: AbortSignal) => request<Health>('/api/health', signal).then(validateHealth),
  schema: (signal?: AbortSignal) => request<FeatureManifest>('/api/schema', signal).then(validateSchema),
  anatomy: (signal?: AbortSignal) => request<AnatomyManifest>('/api/anatomy', signal),
  validateProfile: (features: Record<string, number | string>, signal?: AbortSignal) =>
    request<ProfileValidation>('/api/profiles/validate', signal, { features }),
  predict: (features: Record<string, number | string>, signal?: AbortSignal) =>
    request<Prediction>('/api/predict', signal, { features }).then(validatePrediction),
  explain: (body: { features: Record<string, number | string>; target: Target; probability: number; profile_fingerprint: string; model_version: string; schema_fingerprint: string; model_sha256: string }, signal?: AbortSignal) =>
    request<import('./explanations').Explanation>('/api/explain', signal, body),
  examples: (signal?: AbortSignal) => request<{ examples: ExampleProfile[] }>('/api/examples', signal).then(data => {
    if (!data || !Array.isArray(data.examples) || data.examples.some(e => !e || typeof e.features !== 'object' || !e.features || typeof e.id !== 'string' || typeof e.workbook_sha256 !== 'string'))
      throw new Error('Malformed development example response.');
    return data;
  }),
  metadata: (signal?: AbortSignal) => request<ApplicationMetadata>('/api/metadata', signal).then(validateMetadata),
  evidence: (signal?: AbortSignal) => request<import('./evidence').EvidenceData>('/api/evidence', signal),
};

function validateHealth(data: Health): Health {
  if (!data || data.service !== 'CardioScope' || ['data_prepared', 'anatomy_prepared', 'models_loaded'].some(key => typeof data[key as keyof Health] !== 'boolean'))
    throw new Error('Malformed application health response.');
  return data;
}

export function validateSchema(data: FeatureManifest): FeatureManifest {
  const forbidden = ['Cath', 'LAD', 'LCX', 'RCA'];
  if (!data || data.schema_version !== 1 || !Array.isArray(data.feature_order) || data.feature_order.length !== 55 || new Set(data.feature_order).size !== 55 ||
      !data.feature_order.every(name => typeof name === 'string' && !forbidden.includes(name)) || !Array.isArray(data.features) || data.features.length !== 55 ||
      data.features.some((field, i) => !field || field.name !== data.feature_order[i] || !['integer', 'number', 'category'].includes(field.kind) ||
        (field.kind === 'category' && (!Array.isArray(field.categories) || !field.categories.length || !field.categories.every(v => typeof v === 'string')))) ||
      !TARGETS.every(t => data.targets?.[t]?.column === (t === 'CAD' ? 'Cath' : t) && data.targets[t].positive_class === (t === 'CAD' ? 'CAD' : 'Stenotic') && data.targets[t].negative_class === 'Normal'))
    throw new Error('Malformed source schema; the profile cannot be used.');
  return data;
}

export const TARGETS = ['CAD', 'LAD', 'LCX', 'RCA'] as const;
export type Target = typeof TARGETS[number];
export interface ApplicationMetadata {
  model_version: string;
  schema_fingerprint: string;
  model_checksums: Record<Target, string>;
  explanation_configuration_fingerprint: string;
  background_fingerprint: string;
}
export function validateMetadata(data: ApplicationMetadata): ApplicationMetadata {
  if (!data || ![data.model_version, data.schema_fingerprint, data.explanation_configuration_fingerprint,
    data.background_fingerprint, ...TARGETS.map(t => data.model_checksums?.[t])].every(v => /^[a-f0-9]{64}$/.test(v ?? '')))
    throw new Error('Verified application metadata unavailable.');
  return data;
}
export interface ModelOutput {
  probability: number;
  positive: boolean;
  status: string;
  column: string;
  positive_class: string;
  negative_class: 'Normal';
  model_id: string;
  model_sha256: string;
}
export interface Prediction {
  outputs: Record<Target, ModelOutput>;
  threshold: 0.5;
  probability_label: 'model-estimated probability';
  model_version: string;
  development_run_id: string;
  development_run_fingerprint: string;
  profile_fingerprint: string;
  schema_version: number;
  schema_fingerprint: string;
  feature_manifest_fingerprint: string;
}
export interface ExampleProfile {
  id: string;
  label: string;
  source: string;
  selection_rule: string;
  workbook_sha256: string;
  features: Record<string, number | string>;
}
const SHA = /^[a-f0-9]{64}$/;
export function validatePrediction(result: Prediction): Prediction {
  if (!result || result.threshold !== 0.5 || result.probability_label !== 'model-estimated probability' ||
      result.schema_version !== 1 || !result.development_run_id ||
      ![result.model_version, result.profile_fingerprint, result.schema_fingerprint,
        result.feature_manifest_fingerprint, result.development_run_fingerprint].every(value => SHA.test(value ?? '')) ||
      result.schema_fingerprint !== result.feature_manifest_fingerprint ||
      Object.keys(result.outputs ?? {}).sort().join() !== [...TARGETS].sort().join())
    throw new Error('Malformed prediction response; no results displayed');
  for (const target of TARGETS) {
    const output = result.outputs[target], positiveClass = target === 'CAD' ? 'CAD' : 'Stenotic';
    const id = target === 'CAD' || target === 'LAD' ? 'logistic-C0.1-balanced' :
      target === 'LCX' ? 'forest-depth3-leaf10-none' : 'forest-depth5-leaf10-none';
    if (!output || typeof output.probability !== 'number' || !Number.isFinite(output.probability) ||
        output.probability < 0 || output.probability > 1 ||
        output.positive !== (output.probability >= 0.5) ||
        output.column !== (target === 'CAD' ? 'Cath' : target) ||
        output.positive_class !== positiveClass || output.negative_class !== 'Normal' ||
        output.status !== (output.positive ? positiveClass : 'Normal') ||
        output.model_id !== id || !SHA.test(output.model_sha256 ?? ''))
      throw new Error(`Malformed ${target} prediction; no results displayed`);
  }
  return result;
}

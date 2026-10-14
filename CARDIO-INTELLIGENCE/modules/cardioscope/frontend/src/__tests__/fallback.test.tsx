// This suite isolates Phase 5; explanation lifecycle is tested separately.
vi.mock('../ExplanationPanel', () => ({ ExplanationPanel: () => null }));
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { api, TARGETS } from '../api';
import type { FeatureManifest, Prediction } from '../api';
import source from '../../../artifacts/data/feature_manifest.json';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('retains all four real-contract numerical outputs when WebGL is unavailable', async () => {
  // This test exercises WebGL fallback, not cold lazy-module import timing.
  await import('../anatomy/AnatomyViewer');
  // Synthetic fixture values, separate from product/public examples.
  const schema = source as FeatureManifest, hash = 'a'.repeat(64);
  const features = Object.fromEntries(schema.features.map(f => [f.name, f.kind === 'category' ? f.categories![0] : 42]));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(api, 'anatomy');
  vi.spyOn(api, 'health').mockResolvedValue({ service: 'CardioScope', version: '0.1.0', phase: 'inference', data_prepared: true,
    anatomy_prepared: true, models_loaded: true, model_error: null });
  vi.spyOn(api, 'schema').mockResolvedValue(schema);
  vi.spyOn(api, 'examples').mockResolvedValue({ examples: [{ id: hash, label: 'Public dataset example — not a real current patient',
    features, source: 'Synthetic test fixture', selection_rule: 'test only', workbook_sha256: schema.workbook_sha256 }] });
  vi.spyOn(api, 'validateProfile').mockResolvedValue({ valid: true, profile_fingerprint: hash, feature_manifest_sha256: hash, model_version: hash });
  const outputs = Object.fromEntries(TARGETS.map((target, i) => {
    const p = [.12, .23, .34, .56][i], positiveClass = target === 'CAD' ? 'CAD' : 'Stenotic';
    return [target, { probability: p, positive: p >= .5, status: p >= .5 ? positiveClass : 'Normal',
      positive_class: positiveClass, negative_class: 'Normal', column: target === 'CAD' ? 'Cath' : target,
      model_id: target === 'CAD' || target === 'LAD' ? 'logistic-C0.1-balanced' :
        target === 'LCX' ? 'forest-depth3-leaf10-none' : 'forest-depth5-leaf10-none', model_sha256: hash }];
  })) as Prediction['outputs'];
  vi.spyOn(api, 'predict').mockResolvedValue({ outputs, threshold: .5, probability_label: 'model-estimated probability',
    profile_fingerprint: hash, model_version: hash, schema_fingerprint: hash, feature_manifest_fingerprint: hash,
    schema_version: 1, development_run_id: 'test', development_run_fingerprint: hash });
  render(<App />);
  expect((await screen.findByRole('alert')).textContent).toContain('WebGL 2 is unavailable');
  fireEvent.click(await screen.findByRole('button', { name: 'Load development example' }));
  fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  await screen.findByText('12.0%');
  for (const p of ['23.0%', '34.0%', '56.0%']) expect(screen.getByText(p)).toBeTruthy();
  expect(screen.getByRole('alert').textContent).not.toContain('predictions are unavailable');
  expect(api.anatomy).not.toHaveBeenCalled();
});

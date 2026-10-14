// This suite isolates Phase 5; explanation lifecycle is tested separately.
vi.mock('../ExplanationPanel', () => ({ ExplanationPanel: () => null }));
// Synthetic API outputs and profiles for lifecycle tests; never clinical examples.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import source from '../../../artifacts/data/feature_manifest.json';
import App from '../App';
import { api, TARGETS, validatePrediction } from '../api';
import type { ExampleProfile, FeatureManifest, Prediction } from '../api';
import { parseProfile, predictionVessels } from '../profile';
import { probabilityColor, VESSELS } from '../anatomy/contract';
import type { VesselStates } from '../anatomy/contract';
import type { ViewerAction, ViewerState } from '../anatomy/state';
const schema = source as FeatureManifest, hash = 'a'.repeat(64);
const features = Object.fromEntries(schema.features.map(field =>
  [field.name, field.kind === 'category' ? field.categories![0] : field.kind === 'integer' ? 42 : 1.25]));
const example: ExampleProfile = { id: hash, label: 'Public dataset example — not a real current patient',
  workbook_sha256: schema.workbook_sha256, source: 'Synthetic test fixture', selection_rule: 'test only', features };
function result(): Prediction {
  return {
    outputs: Object.fromEntries(TARGETS.map((target, i) => {
      const p = [.81, .71, .31, .61][i], positive = p >= .5;
      return [target, { probability: p, positive, status: positive ? (target === 'CAD' ? 'CAD' : 'Stenotic') : 'Normal',
        column: target === 'CAD' ? 'Cath' : target, positive_class: target === 'CAD' ? 'CAD' : 'Stenotic',
        negative_class: 'Normal', model_sha256: hash, model_id: target === 'CAD' || target === 'LAD' ? 'logistic-C0.1-balanced' :
          target === 'LCX' ? 'forest-depth3-leaf10-none' : 'forest-depth5-leaf10-none' }];
    })) as Prediction['outputs'],
    threshold: .5, probability_label: 'model-estimated probability', schema_version: 1,
    model_version: hash, profile_fingerprint: hash, schema_fingerprint: hash,
    feature_manifest_fingerprint: hash, development_run_id: 'v1-test', development_run_fingerprint: hash,
  };
}
vi.mock('../anatomy/AnatomyViewer', () => ({ AnatomyViewer: ({ vesselStates, viewerState, onAction }: {
  vesselStates: VesselStates; viewerState: ViewerState; onAction: (action: ViewerAction) => void;
}) => <div data-testid="anatomy" data-selected={viewerState.selected}>
  {VESSELS.map(vessel => <button key={vessel} onClick={() => onAction({ type: 'select', vessel })}
    data-testid={`geometry-${vessel}`} data-probability={vesselStates[vessel].status === 'prediction' ? vesselStates[vessel].probability : ''}>
    Mesh {vessel}</button>)}
  <button onClick={() => onAction({ type: 'reset' })}>Mock reset view</button>
</div> }));
beforeEach(() => {
  vi.spyOn(api, 'metadata').mockResolvedValue({model_version:hash,schema_fingerprint:hash,model_checksums:{CAD:hash,LAD:hash,LCX:hash,RCA:hash},explanation_configuration_fingerprint:hash,background_fingerprint:hash});
  vi.spyOn(api, 'health').mockResolvedValue({ service: 'CardioScope', version: '0.1.0', phase: 'inference', data_prepared: true,
    anatomy_prepared: true, models_loaded: true, model_error: null });
  vi.spyOn(api, 'schema').mockResolvedValue(schema);
  vi.spyOn(api, 'examples').mockResolvedValue({ examples: [example] });
  vi.spyOn(api, 'validateProfile').mockResolvedValue({ valid: true, profile_fingerprint: hash, feature_manifest_sha256: hash, model_version: hash });
  vi.spyOn(api, 'predict').mockResolvedValue(result());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function load() {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Load development example' }));
}
async function predict() {
  await load();
  fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  await screen.findByText('81.0%');
}
it('renders all 55 exact source fields empty, categories exact and no inferred units/defaults', async () => {
  render(<App />);
  await screen.findByLabelText('Age');
  for (const field of schema.features) {
    const input = screen.getByLabelText(field.name) as HTMLInputElement;
    expect(input.value).toBe('');
    if (field.kind === 'category') expect([...screen.getByLabelText(field.name).querySelectorAll('option')].slice(1).map(o => o.textContent)).toEqual(field.categories);
  }
  expect((screen.getByRole('button', { name: 'Run prediction' }) as HTMLButtonElement).disabled).toBe(true);
});
it('loads a complete labeled development example and sends all 55 validated predictors', async () => {
  await predict();
  expect(screen.getByText(/Public dataset example — not a real current patient. Source record/)).toBeTruthy();
  for (const field of schema.features) expect((screen.getByLabelText(field.name) as HTMLInputElement).value).toBe(String(features[field.name]));
  expect(api.predict).toHaveBeenCalledWith(features, expect.any(AbortSignal));
  expect(api.validateProfile).toHaveBeenCalledWith(features, expect.any(AbortSignal));
  expect(screen.getAllByText(/Model-estimated probability:/)).toHaveLength(4);
});
it('renders all four outputs and maps each named probability to geometry, card and legend', async () => {
  await predict();
  for (const [target, probability] of Object.entries(result().outputs)) {
    expect(screen.getByText(`${(probability.probability * 100).toFixed(1)}%`)).toBeTruthy();
    if (target !== 'CAD') {
      expect(screen.getByTestId(`geometry-${target}`).getAttribute('data-probability')).toBe(String(probability.probability));
      expect(document.querySelector(`[data-target="${target}"]`)?.getAttribute('data-color')).toBe(probabilityColor(probability.probability));
    }
  }
  for (const p of [0, .25, .5, .75, 1]) {
    const swatch = screen.getByText(`${p * 100}%`).querySelector('i')!;
    const expected = document.createElement('i'); expected.style.background = probabilityColor(p);
    expect(swatch.style.background).toBe(expected.style.background);
  }
  expect(predictionVessels(result()).LCX).toMatchObject({ probability: .31, profileFingerprint: hash, modelVersion: hash });
});
it('keeps result-card and mesh selection synchronized after prediction and view reset', async () => {
  await predict();
  fireEvent.click(screen.getByRole('button', { name: 'Select LAD anatomy' }));
  expect(screen.getByTestId('anatomy').getAttribute('data-selected')).toBe('LAD');
  fireEvent.click(screen.getByRole('button', { name: 'Mesh LCX' }));
  expect(screen.getByRole('button', { name: 'Select LCX anatomy' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Mock reset view' }));
  expect(screen.getByTestId('anatomy').getAttribute('data-selected')).toBeNull();
  expect(screen.getByText('31.0%')).toBeTruthy();
});
it('clears numerical results and vessel predictions immediately on input edit', async () => {
  await predict();
  fireEvent.change(screen.getByLabelText('Age'), { target: { value: '43' } });
  expect(screen.queryByText('81.0%')).toBeNull();
  expect(screen.getByTestId('geometry-LAD').getAttribute('data-probability')).toBe('');
  expect(screen.getByText(/Previous results cleared/)).toBeTruthy();
});
it('shows inline finite/integer errors and prevents requests for invalid input', async () => {
  await load();
  fireEvent.change(screen.getByLabelText('Age'), { target: { value: '42.5' } });
  fireEvent.blur(screen.getByLabelText('Age'));
  expect(screen.getByText('Enter an integer.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('BMI'), { target: { value: 'Infinity' } });
  fireEvent.blur(screen.getByLabelText('BMI'));
  expect(screen.getByText('Enter a finite number.')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Run prediction' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.predict).not.toHaveBeenCalled();
});
it.each(['profile', 'model', 'schema', 'missing-target', 'nonfinite', 'wrong-threshold', 'wrong-class'])('rejects %s response without showing any output', async kind => {
  const output = result();
  if (kind === 'profile') output.profile_fingerprint = 'b'.repeat(64);
  if (kind === 'model') output.model_version = 'b'.repeat(64);
  if (kind === 'schema') { output.schema_fingerprint = 'b'.repeat(64); output.feature_manifest_fingerprint = output.schema_fingerprint; }
  if (kind === 'missing-target') delete (output.outputs as Partial<Prediction['outputs']>).RCA;
  if (kind === 'nonfinite') output.outputs.LCX.probability = NaN;
  if (kind === 'wrong-threshold') (output as { threshold: number }).threshold = .4;
  if (kind === 'wrong-class') output.outputs.LAD.positive_class = 'Normal';
  vi.mocked(api.predict).mockResolvedValueOnce(output);
  await load(); fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('81.0%')).toBeNull();
});
it('aborts an obsolete request and rejects a late response even when fetch ignores cancellation', async () => {
  let resolve!: (value: Prediction) => void;
  vi.mocked(api.predict).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await load(); fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  await waitFor(() => expect(api.predict).toHaveBeenCalledOnce());
  const signal = vi.mocked(api.predict).mock.calls[0][1]!;
  fireEvent.change(screen.getByLabelText('Age'), { target: { value: '43' } });
  expect(signal.aborted).toBe(true);
  // Newer request wins; old response cannot replace its different fingerprint/probabilities.
  const newer = result(); newer.profile_fingerprint = 'b'.repeat(64); newer.outputs.CAD.probability = .91;
  vi.mocked(api.validateProfile).mockResolvedValueOnce({ valid: true, profile_fingerprint: newer.profile_fingerprint, feature_manifest_sha256: hash, model_version: hash });
  vi.mocked(api.predict).mockResolvedValueOnce(newer);
  fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  await screen.findByText('91.0%');
  await act(async () => resolve(result()));
  expect(screen.getByText('91.0%')).toBeTruthy(); expect(screen.queryByText('81.0%')).toBeNull();
});
it('cancels explicitly without leaving probabilities and ignores late completion', async () => {
  let resolve!: (value: Prediction) => void;
  vi.mocked(api.predict).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await load(); fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  await waitFor(() => expect(api.predict).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'Cancel prediction' }));
  expect(vi.mocked(api.predict).mock.calls[0][1]!.aborted).toBe(true);
  await act(async () => resolve(result())); expect(screen.queryByText('81.0%')).toBeNull();
});
it('clears a previous successful result if a new request fails', async () => {
  await predict(); vi.mocked(api.predict).mockRejectedValueOnce(new Error('API error 503'));
  fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  expect((await screen.findByRole('alert')).textContent).toContain('API error 503');
  expect(screen.queryByText('81.0%')).toBeNull();
});
it('reports unavailable models and disables requests without fabricated results', async () => {
  vi.mocked(api.health).mockResolvedValueOnce({ service: 'CardioScope', version: '0.1.0', phase: 'inference',
    data_prepared: true, anatomy_prepared: true, models_loaded: false, model_error: 'Checksum mismatch' });
  render(<App />); expect((await screen.findByRole('alert')).textContent).toContain('Checksum mismatch');
  expect(api.examples).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: 'Run prediction' }) as HTMLButtonElement).disabled).toBe(true);
});
it('rejects invalid category strings, missing/extra fields, blanks, hex and nonfinite numbers', () => {
  const values = Object.fromEntries(Object.entries(features).map(([name, v]) => [name, String(v)]));
  expect(parseProfile(values, schema).valid).toBe(true);
  for (const invalid of [{ Sex: 'Female' }, { Age: '' }, { BMI: 'NaN' }, { BMI: '0x20' }, { Cath: 'CAD' }] as Record<string, string>[])
    expect(parseProfile({ ...values, ...invalid }, schema).valid).toBe(false);
  delete values.Age; expect(parseProfile(values, schema).valid).toBe(false);
});
it('rejects malformed prediction values including non-numeric probabilities', () => {
  expect(validatePrediction(result())).toBeTruthy();
  const bad = result(); (bad.outputs.CAD as unknown as { probability: string }).probability = '0.8';
  expect(() => validatePrediction(bad)).toThrow('Malformed');
});
it('aborts during validation and never sends inference for the obsolete profile', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof api.validateProfile>>) => void;
  vi.mocked(api.validateProfile).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await load(); fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  await waitFor(() => expect(api.validateProfile).toHaveBeenCalledOnce());
  const signal = vi.mocked(api.validateProfile).mock.calls[0][1]!;
  fireEvent.change(screen.getByLabelText('Age'), { target: { value: '43' } });
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ valid: true, profile_fingerprint: hash, feature_manifest_sha256: hash, model_version: hash }));
  expect(api.predict).not.toHaveBeenCalled();
});
it('aborts on unmount and ignores late prediction responses', async () => {
  let resolve!: (value: Prediction) => void;
  vi.mocked(api.predict).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const mounted = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Load development example' }));
  fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  await waitFor(() => expect(api.predict).toHaveBeenCalledOnce());
  const signal = vi.mocked(api.predict).mock.calls[0][1]!;
  mounted.unmount(); expect(signal.aborted).toBe(true);
  await act(async () => resolve(result()));
});
it('rejects incomplete or mismatched example data instead of filling it', async () => {
  vi.mocked(api.examples).mockResolvedValueOnce({ examples: [{ ...example, features: { Age: 42 } }] });
  await load();
  expect(screen.getByRole('alert').textContent).toContain('Example does not match');
  expect((screen.getByLabelText('Age') as HTMLInputElement).value).toBe('');
});

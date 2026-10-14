// Synthetic fixtures for contract/lifecycle tests only; never production profiles/results.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import source from '../../../artifacts/data/feature_manifest.json';
import { api, TARGETS, type FeatureManifest, type Prediction, type Target } from '../api';
import { ExplanationPanel } from '../ExplanationPanel';
import { explanationFactors, validateExplanation, type Explanation } from '../explanations';
import App from '../App';
import { savedEvidence } from './savedEvidence';
const schema = source as FeatureManifest, hash = 'a'.repeat(64);
const metadata = { model_version: hash, schema_fingerprint: hash, model_checksums: {CAD:hash,LAD:hash,LCX:hash,RCA:hash},
  explanation_configuration_fingerprint:hash, background_fingerprint:hash };
const features = Object.fromEntries(schema.features.map(f => [f.name, f.kind === 'category' ? f.categories![0] : f.kind === 'integer' ? 42 : 1.25]));
const prediction: Prediction = {
  outputs: Object.fromEntries(TARGETS.map(t => {
    const probability = t === 'CAD' || t === 'LAD' ? 1/(1+Math.exp(-1)) : .6;
    return [t, { probability, positive: true, status: t === 'CAD' ? 'CAD' : 'Stenotic', column: t === 'CAD' ? 'Cath' : t,
      positive_class: t === 'CAD' ? 'CAD' : 'Stenotic', negative_class: 'Normal', model_sha256: hash,
      model_id: t === 'CAD' || t === 'LAD' ? 'logistic-C0.1-balanced' : t === 'LCX' ? 'forest-depth3-leaf10-none' : 'forest-depth5-leaf10-none' }];
  })) as Prediction['outputs'], threshold: .5, probability_label: 'model-estimated probability',
  model_version: hash, development_run_id: 'synthetic-test', development_run_fingerprint: hash,
  profile_fingerprint: hash, schema_version: 1, schema_fingerprint: hash, feature_manifest_fingerprint: hash,
};
function explanation(target: Target = 'CAD'): Explanation {
  const logistic = target === 'CAD' || target === 'LAD';
  const contributions = schema.features.map((f, i) => ({ feature: f.name, value: features[f.name], unit: null,
    contribution: i === 0 ? .4 : i === 1 ? -.2 : .001 }));
  const total = contributions.reduce((s, c) => s + c.contribution, 0), output = logistic ? 1 : .6;
  return { target, positive_class: target === 'CAD' ? 'CAD' : 'Stenotic', probability: prediction.outputs[target].probability,
    positive: true, status: prediction.outputs[target].status, threshold: .5,
    output_space: logistic ? 'log_odds' : 'probability', contribution_units: logistic ? 'model log-odds' : 'probability units',
    baseline: output-total, explained_output: output, total_contribution: total, reconstructed_output: output,
    reconstruction_residual: 0, reconstruction_tolerance: logistic ? 1e-10 : 1e-6, remaining_factor_contribution: 0,
    encoded_contribution_sum: total, contributions, profile_fingerprint: hash, model_version: hash,
    schema_fingerprint: hash, model_sha256: hash, method: logistic ? 'LinearExplainer' : 'TreeExplainer',
    method_version: 'shap-0.52.0/cardioscope-v1', explanation_configuration_fingerprint: hash,
    background_fingerprint: hash, background_records: 100, feature_perturbation: 'interventional', aggregation: 'sum',
  };
}
vi.mock('../anatomy/AnatomyViewer', () => ({ AnatomyViewer: ({ onAction }: { onAction: (a: {type: 'select'; vessel: 'LCX'}) => void }) =>
  <button onClick={() => onAction({ type: 'select', vessel: 'LCX' })}>Test LCX mesh</button> }));
beforeEach(() => { vi.spyOn(api, 'metadata').mockResolvedValue(metadata); vi.spyOn(api, 'explain').mockImplementation(async body => explanation(body.target)); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('rejects correctly structured but unexpected configuration/background identities', () => {
  for (const field of ['explanation_configuration_fingerprint', 'background_fingerprint'] as const) {
    expect(() => validateExplanation({...explanation(),[field]:'b'.repeat(64)},'CAD',prediction,features,schema,metadata)).toThrow();
  }
  expect(() => validateExplanation(explanation(),'CAD',prediction,features,schema,{...metadata,model_version:'b'.repeat(64)})).toThrow();
});
it('keeps predictions independent when trusted explanation metadata is unavailable', async () => {
  render(<ExplanationPanel prediction={prediction} features={features} schema={schema} target="CAD" onTarget={vi.fn()} metadata={null}/>);
  expect((await screen.findByRole('alert')).textContent).toContain('Numerical predictions remain available');
  expect(api.explain).not.toHaveBeenCalled();
});
function panel(target: Target = 'CAD', onTarget = vi.fn()) {
  return <ExplanationPanel prediction={prediction} features={features} schema={schema} target={target} onTarget={onTarget} metadata={metadata} />;
}
it('renders signed factors, entered values, remaining accounting, identity and noncausal limitations', async () => {
  render(panel());
  expect(screen.getByText(/Loading verified CAD/)).toBeTruthy();
  await screen.findByText(/Contribution units: model log-odds, not probability percentage points/);
  expect(screen.getByText('Pushed the model output higher')).toBeTruthy();
  expect(screen.getByText('Pushed the model output lower')).toBeTruthy();
  expect(screen.getAllByText('Entered: 42').length).toBeGreaterThan(0);
  expect(screen.getAllByText('+0.4000').length).toBeGreaterThan(0);
  expect(screen.getAllByText('-0.2000').length).toBeGreaterThan(0);
  const f = explanationFactors(explanation());
  expect(f.rest.length).toBe(49);
  expect(f.remaining + [...f.up, ...f.down].reduce((s,c) => s+c.contribution, 0)).toBeCloseTo(explanation().total_contribution, 14);
  expect(screen.getByText(/Remaining 49 factors/)).toBeTruthy();
  expect(screen.getByText(/Calibration is unverified; LCX\/RCA detection/)).toBeTruthy();
});
it('switches all four targets with the correct output space and positive orientation', async () => {
  const view = render(panel());
  for (const target of TARGETS) {
    view.rerender(panel(target));
    await screen.findByText(new RegExp(`Current ${target} model-estimated probability`));
    expect(screen.getByText(new RegExp(`Explains the positive ${target === 'CAD' ? 'CAD' : 'Stenotic'} class for ${target}`))).toBeTruthy();
    expect(screen.getByText(target === 'CAD' || target === 'LAD' ? /model log-odds, not probability percentage points/ : /Contribution units: probability units/)).toBeTruthy();
  }
});
it('rejects identity, class, reconstruction, values, incomplete contributions and units mismatches', () => {
  for (const change of [ { target: 'RCA' }, { profile_fingerprint: 'b'.repeat(64) }, { model_version: 'b'.repeat(64) },
    { schema_fingerprint: 'b'.repeat(64) }, { model_sha256: 'b'.repeat(64) }, { positive_class: 'Normal' },
    { total_contribution: 99 }, { reconstructed_output: 99 }, { probability: .9 }, { reconstruction_residual: NaN },
    { contributions: explanation().contributions.slice(1) },
    { contributions: explanation().contributions.map((c,i) => i === 0 ? {...c,value:999} : c) },
    { contributions: explanation().contributions.map((c,i) => i === 0 ? {...c,unit:'invented'} : c) },
  ]) expect(() => validateExplanation({ ...explanation(), ...change } as Explanation, 'CAD', prediction, features, schema, metadata)).toThrow(/rejected/);
});
it('aborts target changes, ignores obsolete responses, and aborts on profile invalidation/unmount', async () => {
  let resolve!: (r: Explanation) => void;
  const spy = vi.mocked(api.explain).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const view = render(panel('CAD'));
  const signal = spy.mock.calls[0][1]!;
  view.rerender(panel('RCA'));
  expect(signal.aborted).toBe(true);
  await screen.findByText(/Current RCA model-estimated probability/);
  await act(async () => resolve(explanation('CAD')));
  expect(screen.queryByText(/Current CAD model-estimated probability/)).toBeNull();
  const latest = spy.mock.calls.at(-1)![1]!;
  view.unmount(); expect(latest.aborted).toBe(true);
});
it('rejects a stale response visibly without showing factor bars', async () => {
  vi.mocked(api.explain).mockResolvedValue({ ...explanation(), profile_fingerprint: 'b'.repeat(64) });
  render(panel());
  await screen.findByRole('alert');
  expect(screen.queryByText('Pushed the model output higher')).toBeNull();
});
async function appPrediction() {
  vi.spyOn(api, 'health').mockResolvedValue({ service: 'CardioScope', version: '0.1.0', phase: 'inference', data_prepared: true,
    anatomy_prepared: true, models_loaded: true, model_error: null });
  vi.spyOn(api, 'schema').mockResolvedValue(schema);
  vi.spyOn(api, 'examples').mockResolvedValue({ examples: [{ id: hash, label: 'Synthetic test only', source: 'test', selection_rule: 'test', workbook_sha256: schema.workbook_sha256, features }] });
  vi.spyOn(api, 'validateProfile').mockResolvedValue({valid: true, profile_fingerprint: hash, feature_manifest_sha256: hash, model_version: hash});
  vi.spyOn(api, 'predict').mockResolvedValue(prediction);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Load development example' }));
  fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  await screen.findByText(/Four model outputs received/);
}
it('defaults CAD, synchronizes anatomy/result selection and immediately invalidates explanations on edits', async () => {
  await appPrediction();
  await screen.findByText(/Current CAD model-estimated probability/);
  expect((screen.getByLabelText('Explanation target') as HTMLSelectElement).value).toBe('CAD');
  fireEvent.click(screen.getByRole('button', { name: 'Test LCX mesh' }));
  await screen.findByText(/Current LCX model-estimated probability/);
  fireEvent.change(screen.getByLabelText('Explanation target'), {target:{value:'LAD'}});
  await screen.findByText(/Current LAD model-estimated probability/);
  expect(screen.getByRole('button', {name:'Select LAD anatomy'}).getAttribute('aria-pressed')).toBe('true');
  const lastSignal = vi.mocked(api.explain).mock.calls.at(-1)![1]!;
  fireEvent.change(screen.getByLabelText('Age'), {target:{value:'43'}});
  expect(screen.queryByText('Explain this model output')).toBeNull();
  expect(screen.getByText(/No current prediction/)).toBeTruthy();
  expect(lastSignal.aborted).toBe(true);
});
it('shows predictions before SHAP completes and keeps them after SHAP failure', async () => {
  let reject!: (r: Error) => void;
  vi.mocked(api.explain).mockImplementation(() => new Promise((_r,j) => {reject=j;}));
  await appPrediction();
  expect(screen.getByText(/Loading verified CAD/)).toBeTruthy();
  expect(document.querySelectorAll('.result-grid article').length).toBe(4);
  // Loading is rendered before the async request reaches the mocked transport.
  await waitFor(() => expect(typeof reject).toBe('function'));
  await act(async () => reject(new Error('Reconstruction failed')));
  expect(screen.getByRole('alert').textContent).toMatch(/Numerical predictions remain available/);
  expect(document.querySelectorAll('.result-grid article').length).toBe(4);
});
it('reprediction defaults to CAD consistently and ignores an old vessel response after an edit', async () => {
  await appPrediction();
  await screen.findByText(/Current CAD model-estimated probability/);
  let resolve!: (e: Explanation) => void;
  vi.mocked(api.explain).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  fireEvent.change(screen.getByLabelText('Explanation target'), {target:{value:'RCA'}});
  expect(screen.getByRole('button',{name:'Select RCA anatomy'}).getAttribute('aria-pressed')).toBe('true');
  const obsolete = vi.mocked(api.explain).mock.calls.at(-1)![1]!;
  fireEvent.change(screen.getByLabelText('Age'), {target:{value:'43'}});
  expect(obsolete.aborted).toBe(true);
  const nextHash = 'b'.repeat(64);
  vi.mocked(api.validateProfile).mockResolvedValue({valid:true,profile_fingerprint:nextHash,feature_manifest_sha256:hash,model_version:hash});
  vi.mocked(api.predict).mockResolvedValue({...prediction,profile_fingerprint:nextHash});
  vi.mocked(api.explain).mockImplementation(async body => ({...explanation(body.target),profile_fingerprint:body.profile_fingerprint,
    contributions:explanation(body.target).contributions.map(c=>({...c,value:body.features[c.feature]}))}));
  fireEvent.click(screen.getByRole('button',{name:'Run prediction'}));
  await screen.findByText(/Current CAD model-estimated probability/);
  expect(document.querySelector('.selected-result')).toBeNull();
  await act(async () => resolve(explanation('RCA')));
  expect(document.querySelector('.explanation')?.getAttribute('data-profile')).toBe(nextHash);
  expect((screen.getByLabelText('Explanation target') as HTMLSelectElement).value).toBe('CAD');
  expect(screen.queryByText(/Current RCA model-estimated probability/)).toBeNull();
});
it('navigates to saved evidence and returns without losing the submitted profile, outputs or selected vessel', async () => {
  vi.spyOn(api,'evidence').mockResolvedValue(savedEvidence);
  await appPrediction();
  await screen.findByText(/Current CAD model-estimated probability/);
  fireEvent.change(screen.getByLabelText('Explanation target'),{target:{value:'RCA'}});
  await screen.findByText(/Current RCA model-estimated probability/);
  fireEvent.click(screen.getByRole('button',{name:'Evidence'}));
  await screen.findByRole('heading',{name:'Final holdout — 61 records'});
  expect(screen.queryByRole('button',{name:'Run prediction'})).toBeNull();
  expect(screen.getByRole('button',{name:'Evidence'}).getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getByRole('button',{name:'Prediction'}));
  expect(screen.getByRole('button',{name:'Select RCA anatomy'}).getAttribute('aria-pressed')).toBe('true');
  expect((screen.getByLabelText('Explanation target') as HTMLSelectElement).value).toBe('RCA');
  expect((screen.getByLabelText('Age') as HTMLInputElement).value).toBe(String(features.Age));
  expect(api.predict).toHaveBeenCalledTimes(1);
  for(const field of schema.features)expect(screen.getByLabelText(field.name).id).toBeTruthy();
});

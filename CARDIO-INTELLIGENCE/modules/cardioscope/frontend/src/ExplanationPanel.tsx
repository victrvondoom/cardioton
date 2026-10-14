import { useEffect, useRef, useState } from 'react';
import { TARGETS, type ApplicationMetadata, type FeatureManifest, type Prediction, type Target } from './api';
import { explanationFactors, fetchExplanation, validateExplanation, type Contribution, type Explanation } from './explanations';
function signed(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(4)}`; }
export function ExplanationPanel({ prediction, features, schema, target, onTarget, metadata }: {
  prediction: Prediction; features: Record<string, number | string>; schema: FeatureManifest;
  target: Target; onTarget: (target: Target) => void;
  metadata: ApplicationMetadata | null;
}) {
  const [result, setResult] = useState<Explanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController(), id = ++generation.current;
    setResult(null); setError(null);
    if (!metadata) {
      setError('Verified explanation configuration metadata unavailable.');
      return () => { controller.abort(); generation.current++; };
    }
    void fetchExplanation(features, target, prediction, controller.signal).then(r => {
      if (controller.signal.aborted || id !== generation.current) return;
      setResult(validateExplanation(r, target, prediction, features, schema, metadata));
    }).catch(reason => {
      if (!controller.signal.aborted && id === generation.current)
        setError(reason instanceof Error ? reason.message : 'Explanation unavailable; predictions remain available.');
    });
    return () => { controller.abort(); generation.current++; };
  }, [prediction, features, schema, target, metadata]);
  // Never expose a previous target even during the render preceding effect cleanup.
  const current = result?.target === target && result.profile_fingerprint === prediction.profile_fingerprint &&
    result.model_version === prediction.model_version && result.schema_fingerprint === prediction.schema_fingerprint &&
    result.model_sha256 === prediction.outputs[target].model_sha256 &&
    result.explanation_configuration_fingerprint === metadata?.explanation_configuration_fingerprint &&
    result.background_fingerprint === metadata?.background_fingerprint ? result : null;
  const factors = current ? explanationFactors(current) : null;
  const max = factors ? Math.max(...[...factors.up, ...factors.down].map(c => Math.abs(c.contribution)), 1e-20) : 1;
  function bars(items: Contribution[], direction: string) {
    return <div><h3>{direction}</h3>{items.length === 0 && <p>No nonzero factors in this direction.</p>}
      {items.map(c => <div className="factor" key={c.feature}>
        <div className="factor-label"><strong>{c.feature}</strong><span>Entered: {String(c.value)}{c.unit ? ` ${c.unit}` : ''}</span></div>
        <div className="bar-track" aria-hidden="true"><span className={c.contribution > 0 ? 'bar-up' : 'bar-down'} style={{ width: `${100 * Math.abs(c.contribution) / max}%` }} /></div>
        <span className="factor-number">{signed(c.contribution)}</span>
      </div>)}</div>;
  }
  return <section aria-labelledby="explanation-heading" className="explanation" data-profile={current?.profile_fingerprint} data-explanation-target={current?.target}>
    <h2 id="explanation-heading">Explain this model output</h2>
    <label htmlFor="explanation-target">Explanation target</label> <select id="explanation-target" value={target} onChange={e => onTarget(e.target.value as Target)}>{TARGETS.map(t => <option key={t}>{t}</option>)}</select>
    <p>Explains the positive {target === 'CAD' ? 'CAD' : 'Stenotic'} class for {target}.</p>
    <p>Explanations describe the frozen model’s behavior, do not establish clinical causality, and come from a small public dataset. Calibration is unverified; LCX/RCA detection performance is weak.</p>
    {error ? <p role="alert">Explanation unavailable: {error} Numerical predictions remain available.</p> : !current ? <p role="status">Loading verified {target} explanation… Predictions are ready.</p> : <>
      <p>Current {target} model-estimated probability: <strong>{(current.probability * 100).toFixed(1)}%</strong>. Thresholded class: {current.status} (0.5).</p>
      <p className="contribution-units">Contribution units: {current.output_space === 'log_odds' ? 'model log-odds, not probability percentage points.' : 'probability units (1.0 equals 100 percentage points of model output).'}</p>
      <p>Baseline: {current.baseline.toFixed(6)}. Sum of all 55 factors: {signed(current.total_contribution)}. Reconstructed {current.output_space === 'log_odds' ? 'log-odds' : 'probability'}: {current.reconstructed_output.toFixed(6)}.</p>
      <p>Reconstruction residual: {current.reconstruction_residual.toExponential(2)}; tolerance: {current.reconstruction_tolerance.toExponential(0)}. Verified using unrounded values.</p>
      <div className="factor-columns">{bars(factors!.up, 'Pushed the model output higher')}{bars(factors!.down, 'Pushed the model output lower')}</div>
      <p>Remaining {factors!.rest.length} factors, net contribution: <strong>{signed(factors!.remaining)}</strong>. Shown factors plus remaining factors account for all 55 inputs.</p>
      <details><summary>How to read this</summary><p>Signed factors describe associations with this model prediction relative to 100 deterministic development reference records. Larger bars represent larger absolute contributions; both directions share one scale. Correlated features can share attribution. {current.output_space === 'log_odds' ? 'Baseline and contributions sum to model log-odds; a logistic conversion gives the separately displayed probability. A +0.4 contribution does not mean +40 percentage points.' : 'Baseline and contributions sum to the positive-class model probability.'} These are not clinical effects or measured disease severity. Units are shown only when documented; entered values retain source conventions.</p></details>
      <details><summary>All factors and explanation identity</summary><div className="factor-table"><table><thead><tr><th>Source feature</th><th>Entered value</th><th>Signed contribution</th></tr></thead><tbody>{current.contributions.map(c => <tr key={c.feature}><td>{c.feature}</td><td>{String(c.value)}{c.unit ? ` ${c.unit}` : ''}</td><td>{signed(c.contribution)}</td></tr>)}</tbody></table></div>
        <p>{current.method}; {current.method_version}; interventional reference.</p>
        <small className="fingerprints">Profile: {current.profile_fingerprint}<br />Model: {current.model_sha256}<br />Application model: {current.model_version}<br />Schema: {current.schema_fingerprint}<br />Configuration: {current.explanation_configuration_fingerprint}<br />Background: {current.background_fingerprint}</small>
      </details>
    </>}
  </section>;
}

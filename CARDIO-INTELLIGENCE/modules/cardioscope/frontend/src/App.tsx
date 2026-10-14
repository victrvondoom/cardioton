import { lazy, Suspense, useEffect, useReducer, useRef, useState } from 'react';
import { api, TARGETS, validatePrediction } from './api';
import type { ExampleProfile, FeatureManifest, Health, Prediction } from './api';
import { NEUTRAL_STATES, probabilityColor, VESSELS } from './anatomy/contract';
import { INITIAL_STATE, viewerReducer } from './anatomy/state';
import { ExplanationPanel } from './ExplanationPanel';
import type { ApplicationMetadata } from './api';
import type { Target } from './api';
import type { ViewerAction } from './anatomy/state';
import { PatientForm } from './PatientForm';
import { parseProfile, predictionVessels } from './profile';
import type { FormValues } from './profile';
import { ModuleBoundary } from './ModuleBoundary';

const AnatomyViewer = lazy(() => import('./anatomy/AnatomyViewer').then(module => ({ default: module.AnatomyViewer })));
const EvidencePage = lazy(() => import('./EvidencePage').then(module => ({ default: module.EvidencePage })));

export default function App() {
  const [page, setPage] = useState<'prediction' | 'evidence'>('prediction');
  const [evidenceVisited, setEvidenceVisited] = useState(false);
  const [metadata, setMetadata] = useState<ApplicationMetadata | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [schema, setSchema] = useState<FeatureManifest | null>(null);
  const [examples, setExamples] = useState<ExampleProfile[]>([]);
  const [values, setValues] = useState<FormValues>({});
  const [exampleLabel, setExampleLabel] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [submitted, setSubmitted] = useState<Record<string, number | string> | null>(null);
  const [explanationTarget, setExplanationTarget] = useState<Target>('CAD');
  const [error, setError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Enter a complete profile or load the development example.');
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [viewer, dispatch] = useReducer(viewerReducer, INITIAL_STATE);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    void api.metadata(controller.signal).then(result => {
      if (!controller.signal.aborted) setMetadata(result);
    }).catch(reason => { if (!controller.signal.aborted) setMetadataError(reason instanceof Error ? reason.message : 'Metadata unavailable'); });
    async function load() {
      try {
        const status = await api.health(controller.signal);
        const contract = await api.schema(controller.signal);
        if (controller.signal.aborted) return;
        setHealth(status); setSchema(contract);
        setValues(Object.fromEntries(contract.feature_order.map(name => [name, ''])));
        if (status.models_loaded) {
          const publicExamples = await api.examples(controller.signal);
          if (!controller.signal.aborted) setExamples(publicExamples.examples);
        }
      } catch (reason) {
        if (!controller.signal.aborted) setSetupError(reason instanceof Error ? reason.message : 'Setup request failed');
      }
    }
    void load();
    return () => { controller.abort(); generation.current++; request.current?.abort(); };
  }, []);
  function invalidate(message: string) {
    generation.current++; request.current?.abort(); request.current = null;
    setPrediction(null); setSubmitted(null); setExplanationTarget('CAD'); setBusy(false); setElapsed(null); setError(null); setNotice(message);
  }
  function change(name: string, value: string) {
    invalidate('Profile changed. Previous results cleared; run prediction for this profile.');
    setExampleLabel(null); setValues(previous => ({ ...previous, [name]: value }));
  }
  function loadExample(example: ExampleProfile) {
    if (!schema) return;
    const next = Object.fromEntries(Object.entries(example.features).map(([name, value]) => [name, String(value)]));
    if (example.workbook_sha256 !== schema.workbook_sha256 || !parseProfile(next, schema).valid) {
      invalidate('Example could not be loaded.'); setError('Example does not match the verified source schema.'); return;
    }
    invalidate('Development example loaded. Review all values, then run prediction.');
    setValues(next); setExampleLabel(`${example.label}. Source record: ${example.id}`);
  }
  async function predict() {
    if (!schema) return;
    const parsed = parseProfile(values, schema);
    if (!parsed.valid) { invalidate('Incomplete or invalid profile.'); setError('Correct all required fields before prediction.'); return; }
    invalidate('Validating profile and requesting four frozen-model outputs…');
    const id = generation.current, controller = new AbortController();
    request.current = controller; setBusy(true);
    const started = performance.now();
    try {
      const validated = await api.validateProfile(parsed.features, controller.signal);
      if (id !== generation.current || controller.signal.aborted) return;
      if (!validated.valid || !validated.model_version) throw new Error('Verified models unavailable.');
      const result = validatePrediction(await api.predict(parsed.features, controller.signal));
      if (id !== generation.current || controller.signal.aborted) return;
      if (result.profile_fingerprint !== validated.profile_fingerprint ||
          result.model_version !== validated.model_version ||
          result.schema_fingerprint !== validated.feature_manifest_sha256 ||
          result.schema_version !== schema.schema_version)
        throw new Error('Stale or mismatched profile/model/schema response; no results displayed.');
      dispatch({ type: 'reset' }); setExplanationTarget('CAD');
      setSubmitted(parsed.features); setPrediction(result); setElapsed(performance.now() - started);
      setNotice('Four model outputs received for the current profile.');
    } catch (reason) {
      if (id !== generation.current || controller.signal.aborted) return;
      setPrediction(null); setElapsed(null);
      if (reason instanceof Error && reason.name === 'AbortError') setNotice('Prediction cancelled; no results displayed.');
      else {
        setNotice('Prediction unavailable; no current results.');
        setError(reason instanceof Error ? reason.message : 'Prediction failed; no results displayed.');
      }
    } finally {
      if (id === generation.current) { setBusy(false); request.current = null; }
    }
  }
  function viewerAction(action: ViewerAction) {
    dispatch(action);
    if (action.type === 'select') setExplanationTarget(action.vessel);
    if (action.type === 'reset') setExplanationTarget('CAD');
  }
  function selectExplanation(target: Target) {
    setExplanationTarget(target);
    dispatch(target === 'CAD' ? { type: 'reset' } : { type: 'select', vessel: target });
  }
  const parsed = schema ? parseProfile(values, schema) : null;
  function navigate(next: 'prediction' | 'evidence') {
    setPage(next); if (next === 'evidence') setEvidenceVisited(true);
  }
  return <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#main-content" onClick={() => navigate('prediction')} aria-label="CardioScope prediction">
        <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 17h6l3-8 5 15 3-7h5" /></svg></span>
        <span><strong>CardioScope</strong><small>Coronary models, made visible</small></span></a>
      <nav aria-label="Main navigation"><button aria-current={page === 'prediction' ? 'page' : undefined} onClick={() => navigate('prediction')}>Prediction</button>
        <button aria-current={page === 'evidence' ? 'page' : undefined} onClick={() => navigate('evidence')}>Evidence</button></nav>
      <span className="header-label">Research prototype</span>
    </div></header>
    <div className="disclaimer"><span aria-hidden="true">ⓘ</span> Educational and decision-support prototype. Not a substitute for diagnostic imaging.</div>
    <main id="main-content" tabIndex={-1}>
      {setupError && <p role="alert">Application setup unavailable: {setupError}</p>}
      {health && !health.models_loaded && <p role="alert">{health.model_error ?? 'Verified models unavailable.'}</p>}
      <div hidden={page !== 'prediction'} id="prediction-page">
        <header className="page-heading"><div><span className="eyebrow">Prediction workspace</span><h1>Explore a model output</h1>
          <p>Enter a complete source profile. Inspect four independent outputs, reference anatomy and the factors behind each model.</p></div>
          <span className="tag">55 inputs · 4 frozen classifiers</span></header>
        <div className="workflow-note"><strong>Know the limits.</strong> Small public dataset; probabilities are not established as calibrated. LCX/RCA detection was weak at threshold 0.5.
          <button className="text-button" onClick={() => navigate('evidence')}>View evidence and limitations →</button></div>
        <div className="workspace">
          <section className="panel profile-panel" aria-labelledby="profile-heading">
            <div className="card-heading"><div><span className="eyebrow">01 / Source inputs</span><h2 id="profile-heading">Patient profile</h2></div>
              <span className="tag">{schema ? 55 - Object.keys(parsed?.errors ?? {}).filter(k => k !== '_profile').length : 0}/55 valid</span></div>
            <p className="muted">Source conventions are retained. No clinical units or missing values are guessed.</p>
            {examples.map(example => <button className="example-button" key={example.id} onClick={() => loadExample(example)}>Load development example</button>)}
            {exampleLabel && <details className="example-source"><summary>Public dataset example loaded</summary><p>{exampleLabel}</p></details>}
            {schema && <PatientForm schema={schema} values={values} onChange={change} />}
            <div className="prediction-action">
              {parsed && <p>{Object.keys(parsed.errors).length === 0 ? 'All 55 fields are valid.' : `${Object.keys(parsed.errors).length} fields require valid input.`}</p>}
              <button className="primary-button" disabled={!health?.models_loaded || !parsed?.valid || busy} onClick={() => void predict()}>{busy ? 'Computing outputs…' : 'Run prediction'}</button>
              {busy && <button onClick={() => invalidate('Prediction cancelled; no results displayed.')}>Cancel prediction</button>}
            </div>
          </section>
          <div className="output-workspace">
            <section className="panel results-panel" aria-labelledby="results-heading">
              <div className="card-heading"><div><span className="eyebrow">02 / Frozen model outputs</span><h2 id="results-heading">Four independent outputs</h2></div>
                <span className="tag">Threshold 0.5</span></div>
              <p className="muted">The four classifiers are independent. Their probabilities do not form a joint distribution; CAD is predicted by its own model.</p>
              <p role="status" className="prediction-notice">{notice}</p>
              {error && <p role="alert">{error}</p>}
              {prediction ? <>
                <div className="result-grid">{TARGETS.map(target => {
                  const output = prediction.outputs[target], vessel = target === 'CAD' ? null : target;
                  return <article key={target} style={vessel ? { borderTop: `3px solid ${probabilityColor(output.probability)}` } : {}}
                    data-target={target} data-color={vessel ? probabilityColor(output.probability) : ''}
                    className={`${target === 'CAD' ? 'cad-result' : ''} ${viewer.selected === vessel && vessel ? 'selected-result' : ''}`}>
                    <div className="card-heading"><h3>{target === 'CAD' ? 'Overall CAD' : target}</h3>{viewer.selected === vessel && vessel && <span className="selection-badge">Selected</span>}</div>
                    <p className="probability-number">Model-estimated probability: <strong>{(output.probability * 100).toFixed(1)}%</strong></p>
                    <p className="threshold-class">Thresholded class: <strong>{output.status}</strong> (threshold 0.5)</p>
                    {vessel && <button aria-pressed={viewer.selected === vessel}
                      onClick={() => viewerAction({ type: 'select', vessel })}>Select {vessel} anatomy</button>}
                    <details className="model-detail"><summary>Frozen model</summary><small>Model: {output.model_id}</small></details>
                  </article>;
                })}</div>
                <details className="technical-details"><summary>Prediction identity &amp; timing</summary><small className="fingerprints">Profile fingerprint: {prediction.profile_fingerprint}<br />
                  Model version: {prediction.model_version}<br />Schema fingerprint: {prediction.schema_fingerprint}</small>
                  {elapsed !== null && <p>Local validation + prediction round trip: {Math.round(elapsed)} ms.</p>}</details>
              </> : <div className="empty-results"><span aria-hidden="true">◎</span><p>No current prediction. Vessel colors are neutral.</p><small>Load the public development example or complete all 55 inputs to begin.</small></div>}
            </section>
            <div className="panel anatomy-panel">
              <span className="eyebrow">03 / Reference anatomy</span>
              <ModuleBoundary name="3D anatomy">
              <Suspense fallback={<p role="status">Loading anatomy viewer module; anatomy has not rendered yet…</p>}>
                <AnatomyViewer active={page === 'prediction'} vesselStates={prediction ? predictionVessels(prediction) : NEUTRAL_STATES}
                  viewerState={viewer} onAction={viewerAction} />
              </Suspense>
              </ModuleBoundary>
              <div className="probability-legend"><strong>{prediction ? 'Model-estimated probability' : 'Probability color scale · inactive until prediction'}</strong>
                <div className="legend-swatches">{[0, .25, .5, .75, 1].map(p => <span key={p}><i style={{ background: probabilityColor(p) }} />{p * 100}%</span>)}</div>
                <p>Color represents model-estimated probability, not measured stenosis severity or percent narrowing.</p>
                <p>Lower model output → higher model output. Entire named vessels are colored; no lesion location is inferred.</p></div>
            </div>
          </div>
        </div>
        {prediction && submitted && schema && <ExplanationPanel prediction={prediction} features={submitted} schema={schema}
          target={explanationTarget} onTarget={selectExplanation} metadata={metadata} />}
        {metadataError && <p className="muted">Explanation identity metadata unavailable: {metadataError}. Numerical predictions remain available.</p>}
        <div className="workflow-note"><p>Reference anatomy retains the verified BodyParts3D heart, {VESSELS.join(', ')} mappings. It is not patient-specific geometry.</p>
          <button className="text-button" onClick={() => navigate('evidence')}>Read model performance, sources and limitations →</button></div>
      </div>
      {evidenceVisited && <div hidden={page !== 'evidence'} id="evidence-page"><ModuleBoundary name="Evidence page">
        <Suspense fallback={<p role="status">Loading saved evidence page…</p>}><EvidencePage active={page === 'evidence'} metadata={metadata} /></Suspense>
      </ModuleBoundary></div>}
    </main>
    <footer className="site-footer"><strong>CardioScope</strong><span>Public-data research prototype · reference anatomy · frozen evidence</span>
      <a href="/api/model-information" target="_blank" rel="noreferrer">Model information</a></footer>
  </>;
}

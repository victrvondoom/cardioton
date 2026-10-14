import { useEffect, useState } from 'react';
import { api, TARGETS, type ApplicationMetadata, type Target } from './api';
import { METRICS, validateEvidence, type EvidenceData, type EvidenceTarget } from './evidence';

const f = (n: number) => n.toFixed(3);
function range(target: EvidenceTarget, metric: 'roc_auc' | 'recall') {
  const interval = target.uncertainty.intervals[metric];
  return interval.interval ? interval.interval.map(f).join('–') : `Withheld: ${interval.reason ?? 'insufficient information'}`;
}
function modelName(t: EvidenceTarget) {
  return t.model.family === 'logistic'
    ? `Logistic regression · C=${t.model.params.C} · ${t.model.params.class_weight}`
    : `Random forest · depth ${t.model.params.max_depth} · minimum leaf ${t.model.params.min_samples_leaf}`;
}
export function EvidencePage({ active, metadata }: { active: boolean; metadata: ApplicationMetadata | null }) {
  const [data, setData] = useState<EvidenceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!active || data) return;
    const controller = new AbortController();
    setError(null);
    api.evidence(controller.signal).then(result => {
      if (!controller.signal.aborted) setData(validateEvidence(result));
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Evidence unavailable'); });
    return () => controller.abort();
  }, [active, data, attempt]);
  const mismatched = data && metadata && (data.model_version !== metadata.model_version || data.schema_fingerprint !== metadata.schema_fingerprint);
  if (error || mismatched) return <section className="panel evidence-error"><h1>Evidence unavailable</h1>
    <p role="alert">{mismatched ? 'Saved evidence does not match the current application model/schema.' : error}</p>
    <p>No unverified metrics are displayed. Predictions have their own verified model contract.</p>
    <button onClick={() => { setData(null); retry(n => n + 1); }}>Retry evidence</button></section>;
  if (!data) return <section className="panel"><h1>Model evidence</h1><p role="status">Loading verified saved evaluation evidence…</p></section>;
  return <div className="evidence-page">
    <header className="page-heading"><div><span className="eyebrow">Methods &amp; performance</span><h1>Evidence behind the outputs</h1>
      <p>Four frozen classifiers. One reserved evaluation. The strengths and limits, together.</p></div><span className="tag">Saved evidence · no new evaluation</span></header>
    <section className="panel evidence-overview" aria-labelledby="overview-heading">
      <div><h2 id="overview-heading">Four separate questions</h2><p>CAD estimates overall CAD; LAD, LCX and RCA estimate stenosis in each named vessel.
        These are independent classifiers. Their probabilities are not a joint probability distribution.</p></div>
      <div className="sample-stats">{[['Total records', data.records.total], ['Development', data.records.development], ['Final holdout', data.records.holdout]].map(([label, n]) =>
        <div key={label}><strong>{n}</strong><span>{label}</span></div>)}</div>
    </section>
    <aside className="workflow-note evidence-boundary" aria-label="Evidence interpretation limits">
      <strong>Interpret within its limits.</strong> Same-source holdout, not external validation. Calibration and patient independence are unverified; LCX/RCA recall is weak.
      <a href="#limitations-heading">Read the full limitations</a>
    </aside>
    <section aria-labelledby="holdout-heading">
      <div className="section-heading"><div><span className="eyebrow">Frozen pipelines · threshold 0.5</span><h2 id="holdout-heading">Final holdout — 61 records</h2></div>
        <p>Same records across all four targets.<br />All values below come from the saved final evaluation.</p></div>
      <div className="performance-grid">{TARGETS.map(target => {
        const t = data.targets[target], weak = target === 'LCX' || target === 'RCA';
        return <article key={target} className={`panel performance-card ${weak ? 'limited-detection' : ''}`} aria-labelledby={`performance-${target}`} data-evidence-target={target}>
          <div className="card-heading"><h3 id={`performance-${target}`}>{target === 'CAD' ? 'Overall CAD' : `${target} stenosis`}</h3><span className="tag">{target}</span></div>
          <div className="auc-number"><strong>{f(t.metrics.roc_auc)}</strong><span>ROC-AUC</span></div>
          <p className="interval">95% interval {range(t, 'roc_auc')}</p>
          <dl className="metric-list">{METRICS.filter(([key]) => key !== 'roc_auc').map(([key, label]) => <div key={key} className={key === 'recall' ? 'recall-row' : ''}>
            <dt>{label}</dt><dd>{f(t.metrics[key])}</dd></div>)}</dl>
          <p className="interval">Recall 95% interval {range(t, 'recall')}</p>
          <p className="class-counts">Normal <strong>{t.metrics.class_counts['0']}</strong> · {t.definition.positive_class} <strong>{t.metrics.class_counts['1']}</strong></p>
          {weak && <p className="detection-note">Limited detection at 0.5: {t.metrics.confusion_matrix[1][0]} of {t.metrics.class_counts['1']} positive records were missed.</p>}
        </article>;
      })}</div>
      <p className="metric-note">Metrics use the positive CAD / Stenotic class. Accuracy and recall depend on the fixed 0.5 threshold.
        Brier score measures squared probability error; a lower value alone does not establish calibration.</p>
    </section>
    <section className="panel uncertainty" aria-labelledby="uncertainty-heading"><span className="eyebrow">Read the intervals carefully</span>
      <h2 id="uncertainty-heading">A small, same-source holdout</h2>
      <p>These saved 95% intervals are conditional on this same-source sample. Patient independence cannot be fully verified.
        They do not establish external clinical generalization or provide clinical confidence guarantees.</p>
      <p className="muted">ROC-AUC uses 2,000 paired, within-class stratified bootstrap resamples of saved outcomes and probabilities.
        Recall uses a two-sided Clopper–Pearson exact binomial interval. Neither captures uncertainty from retraining.</p>
    </section>
    <section aria-labelledby="confusion-heading"><div className="section-heading"><div><span className="eyebrow">Thresholded outcomes</span><h2 id="confusion-heading">What the models missed</h2></div>
      <p>Rows are observed labels; columns are model predictions.<br />False negatives are marked explicitly.</p></div>
      <div className="matrix-grid">{TARGETS.map(target => <ConfusionMatrix key={target} target={target} data={data.targets[target]} />)}</div>
    </section>
    <section className="panel" aria-labelledby="comparison-heading"><span className="eyebrow">Two different evaluation questions</span><h2 id="comparison-heading">Development and final holdout</h2>
      <p>Nested CV evaluated the model-selection procedure on development data. The holdout evaluated the already-frozen pipelines.
        This comparison is descriptive; the estimates are not interchangeable or a significance test.</p>
      <div className="table-scroll"><table className="comparison-table"><caption>ROC-AUC: nested selection procedure vs frozen pipelines</caption><thead><tr><th scope="col">Target</th>
        <th scope="col">Development nested-CV mean</th><th scope="col">Final holdout ROC-AUC</th></tr></thead><tbody>{TARGETS.map(t => <tr key={t}>
          <th scope="row">{t}</th><td>{f(data.targets[t].development_roc_auc.development_nested_cv_mean)}</td><td>{f(data.targets[t].metrics.roc_auc)}</td></tr>)}</tbody></table></div>
    </section>
    <section className="panel" aria-labelledby="methodology-heading"><span className="eyebrow">Separation before selection</span><h2 id="methodology-heading">Evaluation methodology</h2>
      <div className="evaluation-flow" aria-label="303 records split into 242 development and 61 locked holdout; development nested CV, configuration freeze, then one final holdout evaluation">
        {['303 records', '242 development', '5 outer / 3 inner CV', 'Freeze pipelines', '61 locked holdout', 'One evaluation'].map((text, i) => <div key={text}><span>{String(i + 1).padStart(2, '0')}</span><strong>{text}</strong></div>)}
      </div>
      <p>The 61 holdout records were reserved before development and shared across all targets. All preprocessing was fitted inside training folds.
        Cath, LAD, LCX and RCA target columns were excluded from predictors. The threshold stayed fixed at 0.5.
        Final holdout evaluation occurred once, after configurations were frozen.</p>
      <div className="frozen-models">{TARGETS.map(target => <div key={target}><strong>{target}</strong><p>{modelName(data.targets[target])}</p></div>)}</div>
      <p className="muted">The search kept model complexity bounded for this small dataset. These configurations were selected using the documented development-only rule; they are not claimed to be universally optimal.</p>
    </section>
    <section className="panel" aria-labelledby="shap-heading"><span className="eyebrow">Explain the model, not disease causation</span><h2 id="shap-heading">How explanations work</h2>
      <div className="method-pair"><div><h3>CAD / LAD</h3><p>Linear SHAP in positive-class model log-odds. Contributions are not probability percentage-point changes.</p></div>
        <div><h3>LCX / RCA</h3><p>Interventional TreeSHAP in positive-class probability space.</p></div></div>
      <p>Both use 100 deterministic development-only reference records. All 55 original features are displayed after aggregation of encoded contributions.
        Mathematical reconstruction is verified for every uncached explanation. SHAP describes the frozen model’s behavior, not clinical causality.</p>
    </section>
    <section className="panel limitations" aria-labelledby="limitations-heading"><span className="eyebrow">Scope of this prototype</span><h2 id="limitations-heading">Limitations that matter</h2>
      <ul><li>Only 303 records; the same-source holdout is not external validation.</li>
        <li>Authoritative patient IDs are unavailable, so patient independence cannot be fully verified.</li>
        <li>Model-estimated probabilities are not established as calibrated clinical risk.</li>
        <li>LCX and RCA recall is weak at threshold 0.5; missed positive records remain visible above.</li>
        <li>The anatomical model is reference anatomy, not patient-specific anatomy.</li>
        <li>The model cannot identify lesion location or measured stenosis percentage.</li>
        <li>Explanations describe associations in the model, not causes.</li>
        <li>Educational and decision support only; not a substitute for diagnostic imaging.</li></ul>
    </section>
    <section className="panel sources" aria-labelledby="sources-heading"><span className="eyebrow">Sources &amp; reproducibility</span><h2 id="sources-heading">Public data, traceable evidence</h2>
      <div className="method-pair"><div><h3>Clinical source</h3><p><a href="https://archive.ics.uci.edu/dataset/411/extention+of+z" target="_blank" rel="noreferrer">UCI Extension of Z-Alizadeh Sani dataset</a> · <a href="https://doi.org/10.24432/C5461K" target="_blank" rel="noreferrer">DOI: 10.24432/C5461K</a> · CC BY 4.0.
        Source names and categories are retained; undocumented clinical units are not invented.</p></div>
        <div><h3>Reference anatomy</h3><p><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/" target="_blank" rel="noreferrer">BodyParts3D</a>, © The Database Center for Life Science, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC Attribution 4.0 International</a>.
          Verified heart/LAD/LCX/RCA groups retain their shared source coordinates; coronary leaves are excluded from the heart base.</p></div></div>
      <details className="technical-details"><summary>Technical identity &amp; reproducibility</summary><dl className="identity-list">
        <div><dt>Evaluation ID</dt><dd>{data.evaluation_id}</dd></div><div><dt>Development run</dt><dd>{data.development_run_id}</dd></div>
        <div><dt>Model version</dt><dd>{data.model_version}</dd></div><div><dt>Schema version / fingerprint</dt><dd>{data.schema_version} / {data.schema_fingerprint}</dd></div>
        <div><dt>Saved evidence source / SHA-256</dt><dd>{data.source.path}<br />{data.source.sha256}</dd></div>
        <div><dt>Explanation configuration</dt><dd>{metadata?.explanation_configuration_fingerprint ?? 'Verified metadata unavailable'}</dd></div>
        <div><dt>Explanation background</dt><dd>{metadata?.background_fingerprint ?? 'Verified metadata unavailable'}</dd></div></dl>
        <p>Full methods and provenance are in the repository: docs/MODELING.md, docs/FINAL_EVALUATION.md and docs/EXPLANATIONS.md.
          The dashboard reads saved aggregate artifacts; it performs no training or evaluation.</p></details>
    </section>
  </div>;
}
function ConfusionMatrix({ target, data }: { target: Target; data: EvidenceTarget }) {
  const [[tn, fp], [fn, tp]] = data.metrics.confusion_matrix, positive = data.definition.positive_class;
  return <article className="panel matrix-card"><h3>{target}</h3><table><caption>Observed rows / predicted columns</caption><thead><tr><td />
    <th scope="col">Normal</th><th scope="col">{positive}</th></tr></thead><tbody>
      <tr><th scope="row">Normal</th><td><strong>{tn}</strong><span>True negative</span></td><td><strong>{fp}</strong><span>False positive</span></td></tr>
      <tr><th scope="row">{positive}</th><td className="false-negative"><strong>{fn}</strong><span>False negative</span></td><td><strong>{tp}</strong><span>True positive</span></td></tr>
    </tbody></table><p>{fn} missed / {data.metrics.class_counts['1']} positive records</p></article>;
}

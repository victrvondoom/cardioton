import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, ArrowRight, Earth, FileCheck2, HeartPulse, History, Upload } from "lucide-react";
import { cardio } from "../cardiotwin/api";
import { axisWhy, EvidenceRecord, hemoLabel, hemoValue, StateVector, WhyPanel, type WhySelection } from "../cardiotwin/HemoPanels";
import { HEMO_AXES, type HemoAxisKey, type HemoResult } from "../cardiotwin/hemoTypes";
import { reportsApi, type CardiovascularReport, type ReportFinding, type ReviewDecision } from "../cardiotwin/intelligence/reportApi";
import ReportReview from "../cardiotwin/intelligence/ReportReview";
import { REFERENCE_STRUCTURES, type AnatomyFinding } from "../cardiotwin/intelligence/anatomyTypes";
import SurfaceBoundary from "../cardiotwin/intelligence/SurfaceBoundary";
import { visibleCoronaryContext } from "../cardiotwin/intelligence/coronaryContext";
import { VESSELS } from "../cardiotwin/types";
import { downloadHemoJson } from "../cardiotwin/downloadHemoJson";
import "../cardiotwin/intelligence/intelligence.css";

const AnatomyViewer = lazy(() => import("../cardiotwin/intelligence/AnatomyViewer"));
const EnvironmentWorkspace = lazy(() => import("../cardiotwin/intelligence/EnvironmentWorkspace"));
type ViewMode = "anatomy" | "evidence" | "coronary" | "hemo" | "section" | "replay";
const MODES: [ViewMode, string][] = [["anatomy", "Normal anatomy"], ["evidence", "Clinical evidence"], ["coronary", "Coronary explorer"], ["hemo", "Hemodynamic context"], ["section", "Cross-section"], ["replay", "Time replay"]];
const TABS = [["heart", "Heart + evidence"], ["reports", "Reports + review"], ["earth", "Earth"], ["alignment", "Evidence alignment"], ["compare", "Compare"]] as const;
const today = () => new Date().toISOString().slice(0, 10);
const boundary = (date: string) => `${date}T23:59:59.999999Z`;
const DEMO_PATIENT = "Patient/synthetic-cardio-hemo";
const loading = <p className="ci-empty" role="status">Loading evidence workspace…</p>;
const AXIS_STRUCTURE: Partial<Record<HemoAxisKey, string>> = { pump_function: "LV", rhythm_stability: "LA", vascular_load: "AORTA", respiratory_interaction: "PULMONARY_ARTERY" };

export function reportAnnotations(reports: CardiovascularReport[]): AnatomyFinding[] {
  return reports.flatMap(report => report.findings.filter(finding => finding.active_annotation && finding.status === "approved" && finding.certainty === "documented").flatMap(finding => (finding.mapping.structure_ids?.length ? finding.mapping.structure_ids : finding.mapping.structure_id ? [finding.mapping.structure_id] : []).map(structure => ({
    id: `${report.id}:${finding.id}:${structure}`, structure_id: structure, label: finding.normalized.label,
    review_status: finding.status, source_excerpt: finding.source_excerpt, source_ref: report.id,
    observed_at: finding.event_at ?? report.event_at, available_at: finding.available_at ?? report.available_at, mapping_explanation: finding.mapping.rationale,
    certainty: finding.certainty, value: finding.normalized.value, unit: finding.normalized.unit,
  }))));
}

function SourcePanel({ selection, onPassport }: { selection: { report: CardiovascularReport; finding: ReportFinding }[]; onPassport: (report: CardiovascularReport) => void }) {
  return <section className="ci-panel ci-evidence" aria-label="Anatomical evidence trace"><p className="ci-kicker">STRUCTURE → FINDING → REPORT → REVIEW → PASSPORT</p><h2>Evidence behind the highlight</h2>
    {!selection.length && <p className="ci-empty">Select an annotated structure to inspect its evidence. A reference mesh alone does not establish pathology.</p>}
    {selection.map(({ report, finding }) => <article className="ci-finding" key={`${report.id}:${report.version}:${finding.id}`}><div className="ci-row"><h3>{finding.normalized.label}</h3><span className="ci-status ci-status-approved">{finding.status}</span></div><p>{finding.mapping.explanation ?? finding.mapping.rationale}</p><p className="ci-muted">{finding.mapping.rationale}</p><blockquote>{finding.source_excerpt}</blockquote><dl className="ci-facts"><div><dt>Structure / segment</dt><dd>{finding.mapping.structure_id ?? "Location not established from supplied evidence"} / {finding.normalized.segment ?? "unspecified"}</dd></div><div><dt>Reported measurement</dt><dd>{finding.normalized.value != null ? `${finding.normalized.value} ${finding.normalized.unit ?? ""}` : "Qualitative"}</dd></div><div><dt>Study date</dt><dd>{finding.event_at ?? report.event_at ?? "Unknown"}</dd></div><div><dt>Source document</dt><dd>{report.source.filename}</dd></div><div><dt>Review</dt><dd>{finding.reviewer_id} · {finding.reviewed_at}</dd></div><div><dt>Mapping certainty</dt><dd>{finding.certainty} · {finding.mapping.version}</dd></div></dl><p className="ci-notice">Reported severity does not determine lesion geometry. Motion illustrates reference anatomy, rather than measured patient contractility.</p><button onClick={() => onPassport(report)}>Open Evidence Passport trail</button></article>)}
    <Link to="/cardiotwin/hemo">Open existing Cardio-Hemo WHY workspace <ArrowRight size={13} aria-hidden/></Link>
  </section>;
}

function ClinicalTimeline({ reports, date, hemo }: { reports: CardiovascularReport[]; date: string; hemo?: HemoResult | null }) {
  const reportEvents = reports.flatMap(report => [
    ...(report.event_at ? [{ at: report.event_at, label: `${report.source.filename}: observed`, arrival: false }] : []),
    { at: report.available_at, label: `${report.source.filename}: received`, arrival: true },
    ...report.findings.filter(finding => finding.reviewed_at).map(finding => ({ at: finding.reviewed_at!, label: `${finding.normalized.label}: ${finding.status}`, arrival: true })),
  ]);
  const events = [...reportEvents, ...(hemo?.evidence ?? []).flatMap(record => [
    { at: record.event_at, label: `${record.source_ref}: ${record.kind} observed`, arrival: false },
    { at: record.available_at, label: `${record.source_ref}: available to twin`, arrival: true },
  ])].filter(event => Number.isFinite(Date.parse(event.at)) && Date.parse(event.at) <= Date.parse(boundary(date)));
  if (!events.length) return <p className="ci-empty">No dated clinical evidence to plot.</p>;
  const minimum = Math.min(...events.map(event => Date.parse(event.at))), maximum = Math.max(Date.parse(boundary(date)), minimum + 86_400_000);
  return <svg className="ci-chart" viewBox="0 0 800 150" role="img" aria-label="Clinical source occurrence, receipt and review timestamps plotted on the same date axis"><line x1="20" y1="70" x2="780" y2="70"/>{events.map((event, i) => <g key={`${event.label}-${i}`}><circle className={event.arrival ? "ci-arrival" : undefined} cx={20 + 760 * (Date.parse(event.at) - minimum) / (maximum - minimum)} cy={45 + (i % 3) * 25} r="5"><title>{event.label} · {event.at}</title></circle></g>)}<text x="20" y="120">{new Date(minimum).toISOString().slice(0, 10)}</text><text x="780" y="120" textAnchor="end">{date}</text><text x="20" y="140">Blue: occurrence · Yellow: receipt / review · Exact times in the table</text></svg>;
}

function HemodynamicAlignment({ hemo }: { hemo: HemoResult | null }) {
  if (!hemo) return <p className="ci-muted">Enable the existing fictional Cardio-Hemo observations in Heart view to include their available source observations here. Real-patient FHIR reconstruction remains in the Cardio-Hemo workspace.</p>;
  return <details className="ci-alignment-records"><summary>Inspect {hemo.evidence.length} existing hemodynamic source observations at {hemo.as_of}</summary><p className="ci-muted">Fictional demonstration sources retain their original classifications. Twin interpretations require human review and do not approve a clinical diagnosis or a causal environmental link.</p><div className="ci-alignment"><table><caption>Existing engine observations · event and availability clocks</caption><thead><tr><th>Observation</th><th>Value</th><th>Classification</th><th>Observed</th><th>Available</th><th>Source</th></tr></thead><tbody>{hemo.evidence.map(record => <tr key={record.id}><td>{hemoLabel(record.kind)}</td><td>{hemoValue(record.value)} {record.unit}</td><td>{record.classification}</td><td>{record.event_at}</td><td>{record.available_at}</td><td className="ci-mono">{record.source_ref}</td></tr>)}</tbody></table></div></details>;
}

function SafeAnatomy(props: Parameters<typeof AnatomyViewer>[0]) {
  return <SurfaceBoundary fallback={<section><p role="status">The 3D module is unavailable. Reference structures and evidence remain selectable.</p><div className="ci-controls">{REFERENCE_STRUCTURES.map(structure => <button key={structure.id} onClick={() => props.onSelect(structure.id)} aria-pressed={props.selectedStructure === structure.id}>{structure.label}</button>)}</div></section>}><Suspense fallback={loading}><AnatomyViewer {...props}/></Suspense></SurfaceBoundary>;
}

export default function CardioIntelligence() {
  const location = useLocation();
  const modelSession = (location.state as { coronaryContext?: unknown } | null)?.coronaryContext;
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("heart"), [mode, setMode] = useState<ViewMode>("evidence");
  const [date, setDate] = useState(today), [compareDate, setCompareDate] = useState("2026-08-10");
  const [caseRef, setCaseRef] = useState("synthetic-cardio-demo"), [patientRef, setPatientRef] = useState(DEMO_PATIENT);
  const [reports, setReports] = useState<CardiovascularReport[]>([]), [comparison, setComparison] = useState<CardiovascularReport[]>([]);
  const [reviewReports, setReviewReports] = useState<CardiovascularReport[]>([]);
  const [hemo, setHemo] = useState<HemoResult | null>(null), [compareHemo, setCompareHemo] = useState<HemoResult | null>(null);
  const [syntheticHemo, setSyntheticHemo] = useState(false), [selected, setSelected] = useState<string | null>(null);
  const [why, setWhy] = useState<WhySelection | null>(null), [recordId, setRecordId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [limitations, setLimitations] = useState<string[]>([]), [revision, setRevision] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null), [alignConsent, setAlignConsent] = useState(false);
  const generation = useRef(0);
  const anatomy = useMemo(() => reportAnnotations(reports), [reports]);
  const comparisonAnatomy = useMemo(() => reportAnnotations(comparison), [comparison]);
  const coronaryContext = visibleCoronaryContext(modelSession, boundary(date));
  useEffect(() => {
    const id = ++generation.current, controller = new AbortController();
    setReports([]); setReviewReports([]); setComparison([]); setHemo(null); setCompareHemo(null); setWhy(null); setRecordId(null); setSelected(null); setBusy(true); setError(""); setLimitations([]); setDeleteId(null);
    const timer = window.setTimeout(async () => {
      const jobs = [reportsApi.list(caseRef, boundary(date), controller.signal), ...(tab === "compare" ? [reportsApi.list(caseRef, boundary(compareDate), controller.signal)] : tab === "reports" ? [reportsApi.list(caseRef, undefined, controller.signal)] : [])];
      const results = await Promise.allSettled(jobs);
      if (id !== generation.current || controller.signal.aborted) return;
      const current = results[0];
      if (current.status === "fulfilled") { setReports(current.value.reports.filter(r => r.patient_ref === patientRef)); setLimitations(current.value.limitations ?? []); }
      else setError(current.reason instanceof Error ? current.reason.message : "Report service unavailable");
      if (results[1]?.status === "fulfilled") { if (tab === "reports") setReviewReports(results[1].value.reports.filter(r => r.patient_ref === patientRef)); else setComparison(results[1].value.reports.filter(r => r.patient_ref === patientRef)); }
      else if (results[1]?.status === "rejected") setError("Comparison report service unavailable. No annotations are assumed.");
      if (syntheticHemo && patientRef === DEMO_PATIENT) {
        const states = await Promise.allSettled([cardio.hemoDemo(boundary(date)), ...(tab === "compare" ? [cardio.hemoDemo(boundary(compareDate))] : [])]);
        if (id !== generation.current || controller.signal.aborted) return;
        if (states[0].status === "fulfilled") setHemo(states[0].value); else setError("Synthetic hemodynamic reconstruction unavailable; no clinical state is assumed.");
        if (states[1]?.status === "fulfilled") setCompareHemo(states[1].value);
        else if (states[1]?.status === "rejected") setError("Comparison hemodynamic reconstruction unavailable; no prior state is assumed.");
      }
      if (id === generation.current) setBusy(false);
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); generation.current++; };
  }, [caseRef, patientRef, date, compareDate, syntheticHemo, tab, revision]);
  const refresh = () => setRevision(value => value + 1);
  const decide = async (report: CardiovascularReport, decision: ReviewDecision) => {
    setBusy(true); setError("");
    try { await reportsApi.review(report.id, decision); refresh(); } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  const passport = useCallback(async (report: CardiovascularReport) => {
    setError(""); try { const payload = await reportsApi.passport(report.id, boundary(date)); downloadHemoJson(payload, `cardio-report-passport-${report.id}.json`); } catch (e) { setError((e as Error).message); }
  }, [date]);
  const remove = async (report: CardiovascularReport) => {
    if (deleteId !== report.id) { setDeleteId(report.id); return; }
    setBusy(true); setError(""); try { await reportsApi.remove(report.id); setDeleteId(null); refresh(); } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  const setReference = (field: "case" | "patient", value: string) => { setReports([]); setReviewReports([]); setAlignConsent(false); if (field === "case") setCaseRef(value); else { setPatientRef(value); if (value !== DEMO_PATIENT) setSyntheticHemo(false); } };
  const chooseStructure = (structure: string) => { setSelected(structure); setWhy(null); setRecordId(null); if (hemo) { const axis = HEMO_AXES.find(([key]) => AXIS_STRUCTURE[key] === structure)?.[0]; if (axis) setWhy(axisWhy(axis, hemo.snapshot[axis], hemo.as_of)); } };
  const selection = (tab === "compare" ? [...reports, ...comparison.filter(report => !reports.some(current => current.id === report.id && current.version === report.version))] : reports).flatMap(report => report.findings.filter(finding => finding.active_annotation && finding.status === "approved" && (finding.mapping.structure_id === selected || finding.mapping.structure_ids?.includes(selected ?? ""))).map(finding => ({ report, finding })));
  const unresolved = reports.flatMap(report => report.findings.filter(finding => finding.status !== "rejected" && !finding.mapping.structure_id).map(finding => ({ report, finding })));
  const record = hemo?.evidence.find(e => e.id === recordId);

  return <div className="ci-workspace" data-testid="cardio-intelligence"><header className="ci-header"><div><Link to="/cardiotwin" className="ci-back">← CardioTwin coronary workspace</Link><p className="ci-kicker">CARDIOTON / CARDIOVASCULAR INTELLIGENCE</p><h1>Evidence, in <em>every dimension.</em></h1><p>Reference anatomy. Reviewed findings. Environmental context. One traceable clock.</p></div><button className="ci-primary" onClick={() => setTab("reports")}><Upload size={16} aria-hidden/> Upload Cardiovascular Report</button></header>
    <nav className="ci-related" aria-label="Existing cardiovascular systems"><Link to="/cardiotwin">Coronary predictions</Link><Link to="/cardiotwin/hemo">Cardio-Hemo + WHY</Link><Link to="/cardiotwin/atlas">Atlas + Evidence Passport</Link><Link to="/interop">FHIR + governed exchange</Link></nav>
    <div className="ci-notice" role="note">Clinical support / research workspace. Reference anatomy and illustrative motion do not reconstruct a patient’s heart. Only reviewed, source-supported mappings become annotations. Environmental context does not establish individual exposure or causation.</div>
    <section className="ci-clock ci-panel" aria-label="Shared evidence replay boundary"><div><p className="ci-kicker">HEART · EARTH · TIME</p><h2><History size={17} aria-hidden/> Evidence replay</h2><p>Event, receipt and review must all precede this boundary.</p></div><label>Replay date · end of day UTC<input type="date" value={date} max={today()} onChange={e => { if (e.target.value) setDate(e.target.value); }}/></label><div className="ci-actions"><button className="ci-secondary" onClick={() => setDate(today())}>Today</button><button className="ci-secondary" onClick={refresh}>Refresh evidence</button></div></section>
    <nav className="ci-tabs" aria-label="Cardiovascular intelligence views">{TABS.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{id === "heart" ? <HeartPulse size={15} aria-hidden/> : id === "earth" ? <Earth size={15} aria-hidden/> : id === "reports" ? <FileCheck2 size={15} aria-hidden/> : <Activity size={15} aria-hidden/>}{label}</button>)}</nav>
    <div className="ci-row ci-context"><span>{patientRef || "Patient reference required"} · {caseRef || "Case reference required"}</span><span>{anatomy.length} approved mappings · {reports.length} available reports</span></div>
    {error && <p role="alert" className="ci-error">{error} <button onClick={refresh}>Retry</button></p>}
    {limitations.map((item, i) => <p className="ci-muted" key={i}>{item}</p>)}
    {busy && <p role="status" className="ci-muted">Refreshing evidence at {date}; previous annotations are withheld.</p>}
    {tab === "reports" && <><ReportReview reports={reviewReports} caseRef={caseRef} patientRef={patientRef} onChange={setReference} onUploaded={() => { setDate(today()); refresh(); }} onDecision={(report, decision) => void decide(report, decision)} onPassport={report => void passport(report)} onDelete={report => void remove(report)} busy={busy}/>{deleteId && <div role="alert" className="ci-notice">Delete the stored report, findings and report audit? This cannot be undone.<button onClick={() => { const report = reviewReports.find(r => r.id === deleteId); if (report) void remove(report); }}>Confirm report deletion</button><button className="ci-secondary" onClick={() => setDeleteId(null)}>Keep report</button></div>}</>}
    {(tab === "heart" || tab === "compare") && <><div className="ci-controls" role="group" aria-label="Anatomy interaction mode">{MODES.map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}</div>
      <label className="ci-checkbox ci-panel"><input type="checkbox" checked={syntheticHemo} disabled={patientRef !== DEMO_PATIENT} onChange={e => setSyntheticHemo(e.target.checked)}/> Load existing fictional Cardio-Hemo observations for {DEMO_PATIENT} (1–21 August 2026)</label>
      {syntheticHemo && <div className="ci-actions" aria-label="Fictional replay dates">{["2026-08-10", "2026-08-12", "2026-08-15", "2026-08-21"].map(at => <button key={at} onClick={() => { setDate(at); setMode("replay"); }}>{at}</button>)}<p className="ci-muted">Reports received today remain excluded from August replay, even when their study date is earlier.</p></div>}
      {mode === "coronary" && <section className="ci-panel" aria-label="Existing coronary model session"><p className="ci-kicker">EXISTING CARDIOTWIN MODEL / INDEPENDENT SESSION</p><h2>Vessel estimates and reference regions</h2>{coronaryContext ? <><p>Model vessel involvement probabilities from the coronary workspace. This model session is not linked to the selected report case and does not establish a confirmed finding, stenosis severity or lesion position.</p><div className="ci-controls">{VESSELS.map(vessel => <button key={vessel} aria-pressed={selected === vessel} onClick={() => chooseStructure(vessel)}>{vessel} · {(coronaryContext.probabilities[vessel] * 100).toFixed(1)}% model probability</button>)}</div><p className="ci-muted">{coronaryContext.model} · Generated {coronaryContext.generatedAt} · {coronaryContext.researchScenario ? "Research perturbation" : "Current model input"} · Scenario {coronaryContext.scenario ?? "manual input"}</p><p className="ci-mono">Model artifact SHA-256: {coronaryContext.artifactSha256}</p></> : <p>{modelSession ? "The imported model estimate is unavailable at this historical boundary or its contract is invalid." : "Open this workspace from CardioTwin after a prediction to inspect its vessel estimates alongside the reference regions."}</p>}<Link to="/cardiotwin">Open coronary inputs, model explanations and sensitivity →</Link></section>}
      {tab === "compare" && <label className="ci-compare-date">Comparison date · end of day UTC<input type="date" value={compareDate} max={today()} onChange={e => { if (e.target.value) setCompareDate(e.target.value); }}/></label>}
      <div className={tab === "compare" ? "ci-compare-grid" : "ci-heart-grid"}><section className="ci-panel ci-heart"><p className="ci-kicker">REFERENCE ANATOMY / {date}</p><SafeAnatomy findings={anatomy} selectedStructure={selected} onSelect={chooseStructure} mode={mode} snapshot={hemo?.snapshot ?? null}/><button className="ci-secondary" onClick={() => setTab("reports")}><Upload size={14} aria-hidden/> Upload or review a report</button></section>{tab === "compare" ? <section className="ci-panel ci-heart"><p className="ci-kicker">REFERENCE ANATOMY / {compareDate}</p><SafeAnatomy findings={comparisonAnatomy} selectedStructure={selected} onSelect={chooseStructure} mode={mode} snapshot={compareHemo?.snapshot ?? null} comparisonLabel={compareDate}/><p className="ci-muted">{comparisonAnatomy.length} approved annotations at this boundary. Structure selection is synchronized; cameras can be inspected independently.</p>{compareHemo && <dl className="ci-facts">{HEMO_AXES.map(([axis, label]) => <div key={axis}><dt>{label}</dt><dd>{compareHemo.snapshot[axis].level} · {compareHemo.snapshot[axis].classification}</dd></div>)}</dl>}</section> : <SourcePanel selection={selection} onPassport={report => void passport(report)}/>}</div>
      {tab === "compare" && <SourcePanel selection={selection} onPassport={report => void passport(report)}/>}
      {!!unresolved.length && <section className="ci-panel"><h2>Location not established from supplied evidence</h2>{unresolved.map(({ report, finding }) => <article className="ci-finding" key={`${report.id}:${report.version}:${finding.id}`}><h3>{finding.normalized.label} · {finding.status}</h3><blockquote>{finding.source_excerpt}</blockquote><p>{finding.mapping.rationale}</p><button onClick={() => void passport(report)}>Inspect source Passport</button></article>)}</section>}
      {hemo && <section className="ci-panel"><p className="ci-kicker">EXISTING SYNTHETIC HEMODYNAMIC ENGINE / {hemo.as_of}</p><StateVector result={hemo} onWhy={selection => { setWhy(selection); setRecordId(null); }}/>{why && <WhyPanel result={hemo} selected={why} onEvidence={setRecordId} onClose={() => { setWhy(null); setRecordId(null); }}/>}{record && <EvidenceRecord evidence={record}/>}<p className="ci-muted">Eight qualitative proxies retain their original uncertainty, evidence references and WHY explanations. No physical flow or patient contractility is calculated by this viewer.</p></section>}
    </>}
    {tab === "earth" && <Suspense fallback={loading}><EnvironmentWorkspace date={date} onDateChange={setDate}/></Suspense>}
    {tab === "alignment" && <><section className="ci-panel"><p className="ci-kicker">CARDIO-ENVIRONMENTAL EVIDENCE ALIGNMENT</p><h2>Compare timing, preserve uncertainty.</h2><p>This view juxtaposes report occurrence, receipt and review with a selected ambient location. Personal exposure is not documented. Temporal coincidence alone does not establish an association for this patient.</p><label className="ci-checkbox"><input type="checkbox" checked={alignConsent} onChange={e => setAlignConsent(e.target.checked)}/> I consent to a temporary, local comparison with a location I select. No location history is attached to the patient or sent with clinical data.</label><div className="ci-alignment"><h3>Clinical evidence available at {date}</h3><ClinicalTimeline reports={reports} date={date} hemo={hemo}/><table><caption>Observation and knowledge availability are separate clocks</caption><thead><tr><th>Finding / source</th><th>Observed</th><th>Received</th><th>Review</th><th>Personal exposure</th></tr></thead><tbody>{reports.flatMap(report => report.findings.map(finding => <tr key={`${report.id}:${report.version}:${finding.id}`}><td>{finding.normalized.label}</td><td>{finding.event_at ?? report.event_at ?? "Unknown"}</td><td>{report.available_at}</td><td>{finding.status} {finding.reviewed_at ?? ""}</td><td>Not established</td></tr>))}</tbody></table>{!reports.length && <p className="ci-empty">No clinical reports are available at this boundary. Environmental observations cannot fill that evidence gap.</p>}</div><HemodynamicAlignment hemo={hemo}/></section>{alignConsent ? <Suspense fallback={loading}><EnvironmentWorkspace date={date} onDateChange={setDate} clinicalCount={reports.flatMap(r => r.findings).length + (hemo?.evidence.length ?? 0)}/></Suspense> : <p className="ci-empty">Choose whether to juxtapose a contextual location with this patient’s evidence.</p>}</>}
    <footer className="ci-footer">Clinical source chains and environmental source chains remain distinct. Integrity verification proves an artifact’s consistency; it does not certify diagnosis, anatomy, exposure or regulatory compliance.</footer>
  </div>;
}

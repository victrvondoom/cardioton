import { ArrowLeft, ArrowRight, Download, HeartPulse, History, Loader2, ShieldAlert, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { cardio } from "../cardiotwin/core__src_cardiotwin__api";
import { EvidenceSensitivity, KnowledgeFrontier } from "../cardiotwin/EvidenceSensitivity";
import { DerivedMeasures, EvidenceRecord, GovernanceNote, HEMO_BUTTON, HemoSection, InteractionPanels, InterventionResponses, JsonSnapshot, StateVector, TrajectoryPanel, TransitionList, WhyPanel, hemoDate, hemoValue, transitionWhy, type WhySelection } from "../cardiotwin/HemoPanels";
import type { HemoFhirInput, HemoResult } from "../cardiotwin/hemoTypes";
import HemoReplayTransport from "../cardiotwin/HemoReplayTransport";
import { downloadHemoJson } from "../cardiotwin/downloadHemoJson";

const endOfDay = (date: string) => `${date}T23:59:59.999999Z`;
const todayUtc = () => new Date().toISOString().slice(0, 10);
const WORKSPACE_TABS = [
  ["overview", "Overview"], ["evidence", "Evidence & WHY"], ["patterns", "Clinical patterns"],
  ["uncertainty", "Uncertainty"], ["exchange", "Import & export"],
] as const;
type WorkspaceTab = (typeof WORKSPACE_TABS)[number][0];

/** The API owns every reconstruction; the browser never computes a clinical state. */
export default function CardioHemoTwin() {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("overview");
  const [visitedTabs, setVisitedTabs] = useState(() => new Set<WorkspaceTab>(["overview"]));
  const activateTab = (tab: WorkspaceTab) => {
    setVisitedTabs(previous => previous.has(tab) ? previous : new Set([...previous, tab]));
    setWorkspaceTab(tab);
  };
  const [result, setResult] = useState<HemoResult | null>(null);
  const [demo, setDemo] = useState<HemoResult["demo"]>();
  const [mode, setMode] = useState<"demo" | "fhir">("demo");
  const [date, setDate] = useState("");
  const [why, setWhy] = useState<WhySelection | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [bundleText, setBundleText] = useState("");
  const [patientRef, setPatientRef] = useState("");
  const [importDate, setImportDate] = useState(todayUtc);
  const requestId = useRef(0);
  const imported = useRef<HemoFhirInput | null>(null);
  const lastResult = useRef<HemoResult | null>(null);

  const reconstruct = useCallback(async (asOf?: string, nextMode: "demo" | "fhir" = "demo", input?: HemoFhirInput) => {
    const id = ++requestId.current;
    setBusy(true);
    setError(null);
    setResult(null); // Never leave a current snapshot visible during a historical request.
    setWhy(null);
    setRecordId(null);
    setMode(nextMode);
    try {
      const fhir = input ?? imported.current;
      if (nextMode === "fhir" && !fhir) throw new Error("Import a FHIR Bundle before replaying it.");
      const data = nextMode === "demo" ? await cardio.hemoDemo(asOf) : await cardio.hemoFhir({ ...fhir!, as_of: asOf ?? fhir!.as_of });
      if (id !== requestId.current) return;
      setResult(data);
      lastResult.current = data;
      setDate(data.as_of.slice(0, 10));
      if (nextMode === "demo" && data.demo) setDemo(data.demo);
      if (data.transitions.length) setWhy(transitionWhy(data.transitions[data.transitions.length - 1]));
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void reconstruct();
    return () => { requestId.current += 1; };
  }, [reconstruct]);

  const replay = useCallback((at: string) => void reconstruct(at.includes("T") ? at : endOfDay(at), mode), [reconstruct, mode]);
  const chooseWhy = (selection: WhySelection, scroll = true) => {
    setWhy(selection);
    setRecordId(null);
    activateTab("evidence");
    if (scroll) window.requestAnimationFrame(() => document.getElementById("hemo-why")?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };
  const selectRecord = (id: string) => {
    setRecordId(id);
    activateTab("evidence");
    window.requestAnimationFrame(() => document.getElementById("hemo-original-record")?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };

  const importBundle = () => {
    let bundle: unknown;
    try { bundle = JSON.parse(bundleText); } catch { setError("Enter a valid JSON FHIR Bundle."); return; }
    if (!bundle || typeof bundle !== "object" || Array.isArray(bundle) || (bundle as Record<string, unknown>).resourceType !== "Bundle") {
      setError("The input must be a FHIR R4 Bundle object.");
      return;
    }
    const input: HemoFhirInput = { bundle: bundle as Record<string, unknown>, ...(patientRef.trim() ? { patient_ref: patientRef.trim() } : {}), as_of: endOfDay(importDate), received_at: new Date().toISOString() };
    imported.current = input;
    void reconstruct(input.as_of, "fhir", input);
  };

  const exportPassport = async () => {
    if (!result) return;
    const id = requestId.current;
    setExportBusy(true);
    try {
      const input = imported.current;
      if (mode === "fhir" && !input) throw new Error("Import a FHIR Bundle before exporting its Evidence Passport.");
      const passport = mode === "demo" ? await cardio.hemoDemoPassport(result.as_of) : await cardio.hemoFhirPassport({ ...input!, as_of: result.as_of });
      downloadHemoJson(passport, `cardio-hemo-evidence-passport-${result.as_of.slice(0, 10)}.json`);
    } catch (e) { if (id === requestId.current) setError((e as Error).message); }
    finally { setExportBusy(false); }
  };

  const selectedRecord = result?.evidence.find(e => e.id === recordId);
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % WORKSPACE_TABS.length;
    else if (event.key === "ArrowLeft") next = (index + WORKSPACE_TABS.length - 1) % WORKSPACE_TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = WORKSPACE_TABS.length - 1;
    else return;
    event.preventDefault();
    activateTab(WORKSPACE_TABS[next][0]);
    document.getElementById(`hemo-tab-${WORKSPACE_TABS[next][0]}`)?.focus();
  };

  return <div className="hemo-workspace mx-auto max-w-[1480px] px-3 py-3 sm:px-4" data-testid="cardiohemo-workspace">
    <header className="hemo-workspace__header">
      <div className="hemo-workspace__header-row">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink-primary"><HeartPulse size={22} aria-hidden /> CARDIO-HEMO TWIN</h1>
        <div className="hemo-workspace__date-controls"><label className="text-[10px] text-ink-muted" htmlFor="hemo-replay-date"><span className="hemo-workspace__full-label">As-of date · end of day UTC</span><span aria-hidden className="hemo-workspace__short-label">As-of UTC</span><input id="hemo-replay-date" aria-label="As-of date · end of day UTC" type="date" value={date} min={mode === "demo" ? demo?.start_at.slice(0, 10) : undefined} max={mode === "demo" ? demo?.end_at.slice(0, 10) : undefined} onChange={e => setDate(e.target.value)} className="mt-1 block rounded-lg border border-surface-border bg-surface-bg px-3 py-2 text-xs text-ink-primary [color-scheme:light] dark:[color-scheme:dark]" /></label><button type="button" aria-label="Reconstruct as of date" onClick={() => replay(date)} disabled={!date || busy} className={`${HEMO_BUTTON} min-h-[35px]`}><History size={13} aria-hidden /><span className="hemo-workspace__full-label">Reconstruct as of date</span><span aria-hidden className="hemo-workspace__short-label">Reconstruct</span></button>{mode === "fhir" && <button type="button" onClick={() => void reconstruct()} className={HEMO_BUTTON}>Return to synthetic demo</button>}</div>
      </div>
      <div className="hemo-workspace__replay" aria-label="Replay Twin">{mode === "demo" && demo && <HemoReplayTransport dates={demo.replay_dates} asOf={result?.as_of ?? date} busy={busy} failed={Boolean(error)} onReplay={replay} />}</div>
      <div className="hemo-workspace__utilities">
        <Link to="/cardiotwin" className="inline-flex items-center gap-1 hover:text-ink-primary"><ArrowLeft size={12} aria-hidden /> Coronary workspace</Link>
        <Link to="/cardiotwin/intelligence" className="inline-flex items-center gap-1 hover:text-ink-primary">Anatomy, reports &amp; Earth <ArrowRight size={12} aria-hidden /></Link>
        {mode === "demo" && <details className="hemo-workspace__checkpoints"><summary>Jump to a checkpoint</summary><div className="mt-2 flex flex-wrap gap-2" aria-label="Synthetic replay dates">{demo?.replay_dates.map(at => <button type="button" key={at} onClick={() => replay(at)} disabled={busy} aria-pressed={date === at.slice(0, 10)} className={`rounded-full border px-2.5 py-1 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand ${date === at.slice(0, 10) ? "border-accent-brand bg-accent-brand text-ink-invert" : "border-surface-border text-ink-body hover:border-accent-brand"}`}>{hemoDate(at)}</button>)}</div></details>}
        <details className="hemo-workspace__safety"><summary><ShieldAlert size={13} aria-hidden /> Research / clinical-support inference &middot; human review required</summary><div role="note" aria-label="Cardio-hemo clinical safety boundary" className="pt-2 text-xs leading-relaxed text-ink-body">
          <p className="text-[9px] uppercase tracking-[0.18em] text-ink-muted">CARDIOTON &middot; Longitudinal heart-failure research &middot; DETERMINISTIC CORE &middot; LLM INDEPENDENT</p>
          <p className="mt-2">One evolving cardiovascular state. Every transition has a reason; every replay has a knowledge boundary.</p>
          <p className="mt-2">{result?.safety_notice ?? "This twin reconstructs evidence patterns. It does not diagnose, predict guaranteed outcomes, prescribe treatment, or replace cardiologist judgment."} Clinician interpretation and human review remain required.</p>
          <p className="mt-2 font-semibold">Replay Twin &middot; What was known on this date?</p>
          <div className="mt-2 grid gap-2 text-xs md:grid-cols-3"><p><b>01 &middot; Travel back</b><span className="block text-ink-muted">Choose an earlier date to remove future knowledge.</span></p><p><b>02 &middot; Ask WHY</b><span className="block text-ink-muted">Select a state transition and follow its contributing evidence.</span></p><p><b>03 &middot; Open the source</b><span className="block text-ink-muted">Inspect the original record, availability and transformation.</span></p></div>
          <p className="mt-3 text-[10px] leading-relaxed text-ink-muted">Temporal integrity: event time and evidence availability must both be at or before the reconstruction timestamp. Later results and later hospital events are excluded.</p>
        </div></details>
      </div>
    </header>

    {error && <div role="alert" data-testid="cardiohemo-error" className="rounded-xl border border-accent-red/50 bg-accent-red/5 p-3 text-xs text-ink-primary">{error}<button type="button" className="ml-3 underline" onClick={() => void reconstruct(date ? endOfDay(date) : undefined, mode)}>Retry reconstruction</button></div>}
    {busy && <div role="status" className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised p-3 text-xs text-ink-muted"><Loader2 size={14} className="animate-spin" aria-hidden /> Reconstructing only the evidence available at this time...</div>}
    {result && !busy && <div className="hemo-workspace__context" data-testid="hemo-as-of"><span><b>{mode === "demo" ? "SYNTHETIC DEMO" : "FHIR EVIDENCE RECONSTRUCTION"}</b> &middot; {mode === "demo" ? result.demo?.label ?? demo?.label : result.patient_ref}</span><span>Knowledge boundary: <b>{result.as_of}</b> &middot; {result.evidence.length} available records</span></div>}
    {(result || lastResult.current) && <StateVector result={(result ?? lastResult.current)!} pending={busy || !result} onWhy={chooseWhy} onSceneWhy={selection => chooseWhy(selection, false)} />}

    <div className="hemo-workspace__details">
      <div role="tablist" aria-label="Twin workspace panels" className="hemo-workspace__tabs">{WORKSPACE_TABS.map(([key, label], index) => <button type="button" role="tab" id={`hemo-tab-${key}`} key={key} aria-selected={workspaceTab === key} aria-controls={`hemo-panel-${key}`} tabIndex={workspaceTab === key ? 0 : -1} onClick={() => activateTab(key)} onKeyDown={event => handleTabKey(event, index)}>{label}</button>)}</div>
      <div role="tabpanel" id="hemo-panel-overview" aria-labelledby="hemo-tab-overview" tabIndex={0} hidden={workspaceTab !== "overview"} className="hemo-workspace__panel">
{result && !busy && <>
      <div className="grid items-start gap-4 xl:grid-cols-[1.4fr_1fr]"><TrajectoryPanel result={result} onReplay={replay} busy={busy} /><TransitionList result={result} selected={why} onWhy={chooseWhy} /></div>
    </>}
      </div>
      <div role="tabpanel" id="hemo-panel-evidence" aria-labelledby="hemo-tab-evidence" tabIndex={0} hidden={workspaceTab !== "evidence"} className="hemo-workspace__panel">
{visitedTabs.has("evidence") && result && !busy && <>
      {why && <WhyPanel result={result} selected={why} onEvidence={selectRecord} onClose={() => { setWhy(null); setRecordId(null); }} />}
      {selectedRecord && <HemoSection id="hemo-original-record" title="Twin state → evidence → original record" eyebrow="Source trace" right={<button type="button" onClick={() => setRecordId(null)} className={HEMO_BUTTON}>Back to explanation</button>}><EvidenceRecord evidence={selectedRecord} onBack={() => setRecordId(null)} /></HemoSection>}
      {!why && <p className="px-1 text-xs text-ink-muted">Select any state or transition to inspect its explanation and contributing source records.</p>}
      <HemoSection title="Patient cardiovascular timeline" eyebrow="Original evidence available as of this reconstruction">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{result.evidence.map(e => <EvidenceRecord key={e.id} evidence={e} />)}</div>{!result.evidence.length && <p className="text-xs text-ink-muted">No eligible evidence was available by this timestamp. State remains UNKNOWN.</p>}
      </HemoSection>
    </>}
      </div>
      <div role="tabpanel" id="hemo-panel-patterns" aria-labelledby="hemo-tab-patterns" tabIndex={0} hidden={workspaceTab !== "patterns"} className="hemo-workspace__panel">
{visitedTabs.has("patterns") && result && !busy && <>
      <InteractionPanels result={result} onWhy={chooseWhy} />
      <div className="grid items-start gap-4 lg:grid-cols-2"><HemoSection title="What changed after the intervention?" eyebrow="Observational response timeline"><p className="mb-3 text-xs leading-relaxed text-ink-muted">Compare available observations before and after a recorded intervention. A change after treatment does not establish a treatment effect.</p><InterventionResponses result={result} onWhy={chooseWhy} /></HemoSection><HemoSection title="Derived measures" eyebrow="Reproducible transformations"><DerivedMeasures result={result} onWhy={chooseWhy} /></HemoSection></div>
    </>}
      </div>
      <div role="tabpanel" id="hemo-panel-uncertainty" aria-labelledby="hemo-tab-uncertainty" tabIndex={0} hidden={workspaceTab !== "uncertainty"} className="hemo-workspace__panel">
{visitedTabs.has("uncertainty") && result && !busy && <>
      <EvidenceSensitivity result={result} onWhy={chooseWhy} />
      <KnowledgeFrontier result={result} onWhy={chooseWhy} />
      <HemoSection title="Uncertainty is part of the twin" eyebrow="Confidence & evidence gaps" right={<span className="text-xs text-ink-body">Confidence: <b>{result.snapshot.confidence}</b></span>}>
        {result.snapshot.confidence_details && <p className="mb-3 rounded-lg border border-surface-border bg-surface-bg p-3 text-xs text-ink-body"><b>{result.snapshot.confidence_details.known_axes} / {result.snapshot.confidence_details.total_axes} state axes supported.</b> {result.snapshot.confidence_details.meaning}</p>}
        <div className="grid gap-4 md:grid-cols-2"><div><p className="text-xs font-semibold text-ink-primary">Evidence coverage and limitations</p>{result.snapshot.uncertainties.length ? <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-ink-body">{result.snapshot.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul> : <p className="mt-2 text-xs text-ink-muted">No additional engine uncertainty flags in this window. Research rules still require clinician review.</p>}</div><div className="rounded-xl border border-dashed border-surface-border bg-surface-bg p-3"><p className="text-xs font-semibold text-ink-primary">Observed ≠ inferred</p><dl className="mt-2 space-y-2 text-[11px] text-ink-body"><div><dt className="inline font-semibold">OBSERVED</dt><dd className="inline"> · A documented source fact.</dd></div><div><dt className="inline font-semibold">DERIVED</dt><dd className="inline"> · A reproducible calculation from source facts.</dd></div><div><dt className="inline font-semibold">INFERRED</dt><dd className="inline"> · A rule-based interpretation, requiring clinical review.</dd></div><div><dt className="inline font-semibold">UNKNOWN</dt><dd className="inline"> · Evidence is absent, stale, conflicting or insufficient.</dd></div></dl></div></div>
        {!!result.issues.length && <details className="mt-4 border-t border-surface-border pt-3 text-xs text-ink-body"><summary className="cursor-pointer font-medium">Intake / temporal integrity issues ({result.issues.length})</summary><ul className="mt-2 space-y-1">{result.issues.map((issue, i) => <li key={i} className="break-words">{hemoValue(issue)}</li>)}</ul></details>}
      </HemoSection>
    </>}
      </div>
      <div role="tabpanel" id="hemo-panel-exchange" aria-labelledby="hemo-tab-exchange" tabIndex={0} hidden={workspaceTab !== "exchange"} className="hemo-workspace__panel">
{visitedTabs.has("exchange") && <>
{result && !busy && <>
      <HemoSection title="Digital twin snapshot & Evidence Passport" eyebrow="Inspect / export · no source-record mutation" right={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => downloadHemoJson(result, `cardio-hemo-snapshot-${result.as_of.slice(0, 10)}.json`)} className={HEMO_BUTTON}><Download size={13} aria-hidden /> Export snapshot</button><button type="button" onClick={() => void exportPassport()} disabled={exportBusy} className={HEMO_BUTTON}><Download size={13} aria-hidden /> {exportBusy ? "Preparing passport…" : "Export Evidence Passport"}</button></div>}><JsonSnapshot result={result} /><div className="mt-4"><GovernanceNote /></div><p className="mt-3 text-[10px] text-ink-muted">Engine {result.engine_version} · Clinical approval: {String(result.review.clinical_approval)} · Review status: {result.review.status}</p></HemoSection>
      </>}
    <HemoSection title="Reconstruct from a FHIR R4 Bundle" eyebrow="Patient-specific evidence · authenticated, stateless processing">
      <p className="mb-3 max-w-3xl text-xs leading-relaxed text-ink-muted">Import source evidence through CARDIOTON’s existing CardioTwin API. The source Bundle remains distinct from derived measures and inferred twin states. Source availability timestamps are preserved; records without them become available when imported.</p>
      <label htmlFor="hemo-fhir-bundle" className="text-xs font-medium text-ink-primary">FHIR Bundle JSON</label><textarea id="hemo-fhir-bundle" value={bundleText} onChange={e => setBundleText(e.target.value)} placeholder={'{"resourceType":"Bundle","type":"collection","entry":[…]}'} rows={5} spellCheck={false} className="mt-1 w-full rounded-xl border border-surface-border bg-surface-bg p-3 font-mono text-[11px] text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand" />
      <div className="mt-3 flex flex-wrap items-end gap-3"><label htmlFor="hemo-patient-ref" className="flex-1 text-[10px] text-ink-muted">Patient reference (optional for a single-patient Bundle)<input id="hemo-patient-ref" value={patientRef} onChange={e => setPatientRef(e.target.value)} placeholder="Patient/resource-id" className="mt-1 block w-full min-w-[220px] rounded-lg border border-surface-border bg-surface-bg px-3 py-2 text-xs text-ink-primary" /></label><label htmlFor="hemo-import-date" className="text-[10px] text-ink-muted">Reconstruction date · UTC<input id="hemo-import-date" type="date" value={importDate} onChange={e => setImportDate(e.target.value)} className="mt-1 block rounded-lg border border-surface-border bg-surface-bg px-3 py-2 text-xs text-ink-primary [color-scheme:light] dark:[color-scheme:dark]" /></label><button type="button" onClick={importBundle} disabled={!bundleText.trim() || !importDate || busy} className={HEMO_BUTTON}><Upload size={13} aria-hidden /> Reconstruct FHIR evidence <ArrowRight size={12} aria-hidden /></button></div>
      <p className="mt-3 text-[10px] text-ink-muted">This view does not persist a patient record, approve a state, or initiate an exchange. Use the existing governed workbench for review and exchange.</p>
    </HemoSection>
    </>}
      </div>
    </div>
  </div>;
}

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Download, ExternalLink, Search, Shield, X } from "lucide-react";
import { globalApi, type CopilotResponse, type EvidenceRecord, type PassportArtifact, type PassportVerification, type ResearchTask, type TaskTrace } from "./globalApi";
import { getStoredUser } from "../lib/core__src_lib__auth";

export function useResearchResource<T>(loader: (signal: AbortSignal) => Promise<T>, dependency: string | number = 0) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string }>({ data: null, loading: true, error: "" });
  const loadRef = useRef(loader);
  loadRef.current = loader;
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, loading: true, error: "" });
    loadRef.current(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: "" });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ data: null, loading: false, error: error instanceof Error ? error.message : "Research request failed." });
    });
    return () => controller.abort();
  }, [dependency]);
  return state;
}

function useActionRequest() {
  const active = useRef<AbortController>();
  useEffect(() => () => active.current?.abort(), []);
  return () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    return controller.signal;
  };
}

export function ResearchError({ message }: { message: string }) {
  return message ? <p className="cgi-error" role="alert"><AlertTriangle size={13} aria-hidden />{message}</p> : null;
}
export function Loading({ children = "Loading records…" }: { children?: ReactNode }) {
  return <p className="cgi-loading" role="status"><span className="cgi-spinner" aria-hidden />{children}</p>;
}
export function DataMode({ mode }: { mode?: string }) {
  return <span className={`cgi-badge ${mode === "synthetic_demo" ? "demo" : ""}`}>{mode === "synthetic_demo" ? "Synthetic demonstration" : mode === "live" || mode === "retrieved" ? "Retrieved source records" : mode ? mode.replaceAll("_", " ") : "Data unavailable"}</span>;
}
export function dateText(value?: string | null) {
  if (!value) return "Not reported";
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) ? new Date(stamp).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC") : value;
}
export function sourceUrl(value?: string) {
  if (!value) return undefined;
  if (value.startsWith("/api/cardiotwin/global/records/")) return value;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}
export function SourceLink({ url, children }: { url?: string; children: ReactNode }) {
  const safe = sourceUrl(url);
  return safe ? <a href={safe} target="_blank" rel="noopener noreferrer" className="cgi-source-link">{children}<ExternalLink size={11} aria-hidden /></a> : <span>{children} (source URL unavailable)</span>;
}
export function downloadResearchJson(filename: string, data: unknown) {
  const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export function ResearchDrawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const drawer = ref.current;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab" || !drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('a[href],button,input,textarea,select,summary,[tabindex="0"]')).filter(element => {
        if (element.tabIndex < 0 || element.matches(":disabled") || element.closest("[hidden],[inert]")) return false;
        for (let ancestor: HTMLElement | null = element; ancestor && ancestor !== drawer; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          if (style.display === "none" || style.visibility === "hidden") return false;
          if (ancestor instanceof HTMLDetailsElement && !ancestor.open) {
            const summary = Array.from(ancestor.children).find(child => child.tagName === "SUMMARY");
            if (!summary?.contains(element)) return false;
          }
        }
        return true;
      });
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!drawer.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = priorOverflow; previous?.focus(); };
  }, []);
  return <div className="cgi-drawer-overlay" onClick={onClose}>
    <div className="cgi-drawer" ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
      <div className="cgi-detail-heading"><h2 id={titleId}>{title}</h2><button className="cgi-badge" onClick={onClose} aria-label="Close detail"><X size={14} aria-hidden />Close</button></div>
      {children}
    </div>
  </div>;
}

export function RecordDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [revision, setRevision] = useState(0);
  const [rationale, setRationale] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const state = useResearchResource(signal => globalApi.getRecord(id, signal), `${id}:${revision}`);
  const request = useActionRequest();
  const role = getStoredUser()?.role;
  async function review(decision: "approve" | "reject") {
    const snapshot = state.data?.history?.at(-1)?.snapshot_hash;
    if (!snapshot) return;
    const signal = request(); setReviewing(true); setReviewError("");
    try { await globalApi.reviewMapping(id, {decision, expected_snapshot_hash: snapshot, rationale}, signal); if (!signal.aborted) setRevision(value => value + 1); }
    catch (error) { if (!signal.aborted) setReviewError(error instanceof Error ? error.message : "Mapping review failed"); }
    finally { if (!signal.aborted) setReviewing(false); }
  }
  const record = state.data;
  return <ResearchDrawer title="Evidence source record" onClose={onClose}>
    {state.loading && <Loading />}
    <ResearchError message={state.error} />
    {record && <>
      <DataMode mode={record.data_mode} />
      <h3>{record.title}</h3>
      <dl className="cgi-detail-list">
        {[
          ["Identifier", `${record.source_name}: ${record.source_identifier}`],
          ["Authors / sponsor", record.authors_or_sponsor],
          ["Clinical area", record.clinical_area],
          ["Indication", record.target_indication],
          ["Intervention", record.intervention_or_device],
          ["Study design", record.study_design],
          ["Phase", Array.isArray(record.phase) ? record.phase.join(", ") : record.phase],
          ["Recruitment status", record.recruitment_status ?? record.status],
          ["Enrollment / sample size", record.enrollment ?? record.sample_size],
          ["Publication / start date", record.publication_or_start_date],
          ["Retrieved", dateText(record.retrieved_at)],
          ["Mapping status", record.mapping_status ?? "Unreported"],
          ["Human mapping review", record.human_verified === true ? "Mapping reviewed; scientific validity unassessed" : "Not independently verified"],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === undefined || value === null || value === "" ? "Not reported" : String(value)}</dd></div>)}
      </dl>
      <p className="cgi-kicker">Reported findings</p><p>{record.summary_findings || "No findings supplied."}</p>
      <p className="cgi-kicker">Reported endpoints</p>
      {record.reported_endpoints?.length ? <ul>{record.reported_endpoints.map(endpoint => <li key={endpoint}>{endpoint}</li>)}</ul> : <p>Endpoints not reported.</p>}
      {record.primary_outcomes?.length ? <details><summary>Primary outcomes supplied by source</summary><pre className="cgi-json">{JSON.stringify(record.primary_outcomes, null, 2)}</pre></details> : null}
      <SourceLink url={record.source_url}>Open original source: {record.source_identifier}</SourceLink>
      {record.quality && <details open><summary>Evidence quality dimensions</summary><pre className="cgi-json">{JSON.stringify(record.quality, null, 2)}</pre></details>}
      <details><summary>Provenance and source snapshot</summary><pre className="cgi-json">{JSON.stringify(record.provenance ?? { status: "Not supplied" }, null, 2)}</pre></details>
      <details><summary>Mapping rationale</summary><ul>{record.mapping_rationale?.map(item => <li key={item}>{item}</li>)}</ul></details>
      <details><summary>Retained source versions and field changes ({record.history?.length ?? 0})</summary><pre className="cgi-json">{JSON.stringify(record.history ?? [], null, 2)}</pre></details>
      {(role === "reviewer" || role === "admin") && record.history?.length && <section className="cgi-stack" aria-label="Human mapping review"><p className="cgi-kicker">Review category mapping</p><p className="cgi-notice">Designated curator organizations can review shared public category mappings. Your rationale and decision become public; do not include patient or private research information. Study quality, clinical recommendations and treatment remain unassessed.</p><label className="cgi-field">Review rationale<textarea className="cgi-copilot-input" value={rationale} onChange={event => setRationale(event.target.value)} maxLength={1000} /></label><ResearchError message={reviewError} /><div className="cgi-filters"><button className="cgi-badge" disabled={reviewing || rationale.trim().length < 5} onClick={() => void review("approve")}>Approve category mapping</button><button className="cgi-badge" disabled={reviewing || rationale.trim().length < 5} onClick={() => void review("reject")}>Reject category mapping</button></div></section>}
      <p className="cgi-notice">Registration and study phase do not establish efficacy, safety, or regulatory approval. A proposed mapping requires review. Synthetic records demonstrate the workflow and are not verified research findings.</p>
    </>}
  </ResearchDrawer>;
}

export function RecordsTable({ records, onRecord, label = "Evidence records" }: { records: EvidenceRecord[]; onRecord: (id: string) => void; label?: string }) {
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  return <div>
    <div className="cgi-table-wrap"><table className="cgi-table" aria-label={label}>
      <thead><tr><th>Source / identifier</th><th>Study</th><th>Indication / intervention</th><th>Design / sample</th><th>Mapping / data</th></tr></thead>
      <tbody>{records.slice(safePage * pageSize, (safePage + 1) * pageSize).map(record => <tr key={record.id}>
        <td><SourceLink url={record.source_url}>{record.source_identifier}</SourceLink><small className="cgi-table-sub">{record.source_name}</small></td>
        <td><button className="cgi-record-link" onClick={() => onRecord(record.id)} aria-label={`Inspect ${record.title}`}>{record.title}</button><small className="cgi-table-sub">{record.authors_or_sponsor}</small></td>
        <td>{record.target_indication}<small className="cgi-table-sub">{record.intervention_or_device || "Intervention not reported"}</small></td>
        <td>{record.study_design}<small className="cgi-table-sub">N = {record.sample_size ?? record.enrollment ?? "not reported"}</small></td>
        <td>{record.mapping_status ?? "Unreported"}<small className="cgi-table-sub">{record.data_mode === "synthetic_demo" ? "Synthetic fixture" : record.data_mode}</small></td>
      </tr>)}</tbody>
    </table></div>
    {!records.length && <p className="cgi-empty">No evidence records match this selection.</p>}
    {pageCount > 1 && <div className="cgi-filters"><button className="cgi-badge" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous records</button><span>Page {safePage + 1} of {pageCount}</span><button className="cgi-badge" disabled={safePage === pageCount - 1} onClick={() => setPage(safePage + 1)}>Next records</button></div>}
  </div>;
}

export function TraceList({ traces }: { traces: TaskTrace[] }) {
  return traces.length ? <ol className="cgi-trace-log" aria-label="Recorded execution trace">{traces.map((trace, index) => <li className="cgi-trace-entry" key={`${trace.task_id}-${index}`}>
    <div><b className="cgi-trace-agent">{trace.agent_role}</b><p className="cgi-trace-desc">{trace.step_description}</p>{trace.tool_invoked && <small>Tool: {trace.tool_invoked} · {trace.status}</small>}
      {(trace.input_snapshot || trace.output_snapshot) && <details><summary>Recorded inputs and outputs</summary><pre className="cgi-json">{JSON.stringify({ input: trace.input_snapshot, output: trace.output_snapshot }, null, 2)}</pre></details>}
    </div><time className="cgi-trace-time" dateTime={trace.timestamp}>{dateText(trace.timestamp)}</time>
  </li>)}</ol> : <p className="cgi-empty">No execution events recorded.</p>;
}
export function TaskDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useResearchResource(signal => globalApi.getTask(id, signal), id);
  const task: ResearchTask | null = state.data;
  return <ResearchDrawer title="Research task execution" onClose={onClose}>
    {state.loading && <Loading />}
    <ResearchError message={state.error} />
    {task && <><p className="cgi-passport-hash">{task.task_id}</p><p><b>{task.task_type}</b> · {task.status}</p>
      <p>Started {dateText(task.started_at)}<br />Completed {dateText(task.completed_at)}</p>
      <p>Timeout: {task.timeout_seconds}s · Retries: {task.retry_count}/{task.max_retries}</p>
      <p>Permitted tools: {task.allowed_tools?.join(", ") || "None recorded"}</p>
      {task.error_message && <ResearchError message={task.error_message} />}
      <TraceList traces={task.trace_logs ?? []} />
      <details><summary>Task inputs and result artifacts</summary><pre className="cgi-json">{JSON.stringify({ inputs: task.inputs, result_artifacts: task.result_artifacts, error: task.error }, null, 2)}</pre></details>
    </>}
  </ResearchDrawer>;
}

export function PassportPanel({ initialHash = "" }: { initialHash?: string }) {
  const [hash, setHash] = useState(initialHash);
  const [supplied, setSupplied] = useState("");
  const [result, setResult] = useState<PassportVerification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useActionRequest();
  const hashValid = /^[a-f0-9]{64}$/i.test(hash.trim());
  useEffect(() => { setHash(initialHash); setResult(null); setError(""); }, [initialHash]);
  async function verify(independent = false) {
    const signal = request();
    setBusy(true); setResult(null); setError("");
    try {
      let outcome: PassportVerification;
      if (independent) {
        const artifact = JSON.parse(supplied) as PassportArtifact;
        if (!artifact || !/^[a-f0-9]{64}$/i.test(artifact.passport_hash) || !artifact.payload || typeof artifact.payload !== "object" || Array.isArray(artifact.payload)) throw new Error("Supply an exported JSON object with passport_hash and payload.");
        outcome = await globalApi.verifySuppliedPassport(artifact, signal);
      } else outcome = await globalApi.verifyPassport(hash.trim(), signal);
      if (!signal.aborted) setResult(outcome);
    } catch (caught) { if (!signal.aborted) setError(caught instanceof Error ? caught.message : "Passport verification failed."); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  async function exportArtifact() {
    const signal = request(); setBusy(true); setError("");
    try { const artifact = await globalApi.getPassport(hash.trim(), signal); if (!signal.aborted) downloadResearchJson(`cardiotwin-passport-${hash.slice(0, 12)}.json`, artifact); }
    catch (caught) { if (!signal.aborted) setError(caught instanceof Error ? caught.message : "Passport export failed."); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  return <section className="cgi-stack" aria-label="Evidence passport verification">
    <p className="cgi-kicker">Evidence passport</p>
    <label className="cgi-field">SHA-256 passport digest<input className="cgi-copilot-input" value={hash} disabled={busy} onChange={event => { if (!busy) { setHash(event.target.value); setResult(null); } }} placeholder="64 hexadecimal characters" /></label>
    <div className="cgi-filters"><button className="cgi-copilot-btn" disabled={busy || !hashValid} onClick={() => void verify()}><Shield size={12} aria-hidden />Verify stored passport</button><button className="cgi-badge" disabled={busy || !hashValid} onClick={() => void exportArtifact()}><Download size={12} aria-hidden />Export passport JSON</button></div>
    <details><summary>Independently verify an exported artifact</summary><label className="cgi-field">Exported passport JSON<textarea className="cgi-copilot-input cgi-json-input" value={supplied} disabled={busy} onChange={event => { if (!busy) { setSupplied(event.target.value); setResult(null); } }} /></label><button className="cgi-badge" disabled={busy || !supplied.trim()} onClick={() => void verify(true)}>Verify supplied artifact</button></details>
    {busy && <Loading>Checking passport…</Loading>}
    <ResearchError message={error} />
    {result && <div className="cgi-passport" role="status"><b>{result.verified === true && result.integrity_check === "PASSED" ? "Integrity verified" : result.tamper_detected === true ? "Tamper detected" : "Passport not verified"}</b><p className="cgi-passport-hash">Verified artifact digest: {result.passport_hash}</p><p>{result.status} · {result.integrity_check}</p><p>{result.notes}</p><small>Checked {dateText(result.verified_at)}</small></div>}
    <p className="cgi-notice">A matching SHA-256 digest detects content changes. It does not establish scientific truth, author identity, clinical validity, or human approval.</p>
  </section>;
}

export function ResearchWorkflow({ onRecord, onTask, onComplete }: { onRecord: (id: string) => void; onTask: (id: string) => void; onComplete: () => void }) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useActionRequest();
  const [lastRequest, setLastRequest] = useState<{ query: string; key: string } | null>(null);
  async function ask(newAttempt = false) {
    if (!query.trim() || loading) return;
    const question = query.trim();
    const key = !newAttempt && lastRequest?.query === question ? lastRequest.key : crypto.randomUUID();
    setLastRequest({ query: question, key });
    const signal = request(); setLoading(true); setError(""); setResponse(null);
    try {
      const result = await globalApi.askCopilot(question, signal, key);
      if (!signal.aborted) { setResponse(result); setLastRequest(null); onComplete(); }
    } catch (caught) { if (!signal.aborted) setError(caught instanceof Error ? caught.message : "Research task failed."); }
    finally { if (!signal.aborted) setLoading(false); }
  }
  return <div className="cgi-panel">
    <div className="cgi-panel-header"><span className="cgi-panel-title"><Search size={14} aria-hidden />Research question to evidence brief</span>{response && <DataMode mode={response.data_mode} />}</div>
    <div className="cgi-panel-body cgi-stack">
      <form className="cgi-copilot-form" onSubmit={event => { event.preventDefault(); void ask(); }}><input className="cgi-copilot-input" aria-label="Cardiovascular research question" value={query} onChange={event => setQuery(event.target.value)} maxLength={2000} placeholder="e.g. heart failure SGLT2 trials" /><button className="cgi-copilot-btn" disabled={loading || !query.trim()} type="submit"><Search size={13} aria-hidden />Find evidence</button></form>
      <p className="cgi-notice">Search the configured evidence corpus. Use research topics without patient identifiers. The result lists matching records and metadata gaps; it does not infer treatment recommendations or trial success.</p>
      <ResearchError message={error} />
      {error && <div className="cgi-notice"><p>Find evidence retries the same task after an uncertain response. If that task failed, inspect Agent Monitor or start a separate attempt.</p><button className="cgi-badge" disabled={loading || !query.trim()} onClick={() => void ask(true)}>Start new research attempt</button></div>}
      {loading && <Loading>Running bounded retrieval and evidence analysis…</Loading>}
      {response && <>
        <div className="cgi-copilot-response" aria-label="Source-linked research brief">{response.summary_response}</div>
        <div className="cgi-filters"><button className="cgi-badge" onClick={() => onTask(response.task_id)}>Inspect task execution</button><button className="cgi-badge" onClick={() => downloadResearchJson(`cardiotwin-research-${response.task_id}.json`, response)}><Download size={12} aria-hidden />Export research brief JSON</button></div>
        <p className="cgi-kicker">Retrieved records ({response.evidence_records.length})</p><RecordsTable records={response.evidence_records} onRecord={onRecord} />
        {response.evidence_citations.length > 0 && <details><summary>Original source links</summary><ul>{response.evidence_citations.map(citation => <li key={`${citation.source_id}-${citation.url}`}><SourceLink url={citation.url}>{citation.source_id}: {citation.title}</SourceLink></li>)}</ul></details>}
        {response.factual_claims.length > 0 && <details><summary>Extracted record metadata</summary><ul>{response.factual_claims.map((claim, index) => <li key={index}>{claim}</li>)}</ul></details>}
        {response.model_interpretations.length > 0 && <details><summary>Synthesized interpretations requiring review</summary><ul>{response.model_interpretations.map((claim, index) => <li key={index}>{claim}</li>)}</ul></details>}
        <details open><summary>Evidence gaps and next research actions ({response.identified_gaps.length})</summary>{response.identified_gaps.length ? <ul>{response.identified_gaps.map((gap, index) => <li key={index}>{typeof gap === "string" ? gap : <><b>{gap.category ?? "Evidence gap"}</b> — {gap.description ?? gap.reason ?? JSON.stringify(gap)}{gap.next_action && <p>Next action: {gap.next_action}</p>}</>}</li>)}</ul> : <p>No metadata gaps identified by the supported rules. This does not establish evidence completeness.</p>}</details>
        {response.limitations?.length ? <ul className="cgi-notice">{response.limitations.map(item => <li key={item}>{item}</li>)}</ul> : null}
        {response.passport_hash && <PassportPanel initialHash={response.passport_hash} />}
      </>}
    </div>
  </div>;
}

import { useRef, useState } from "react";
import { getStoredUser } from "../../lib/core__src_lib__auth";
import { reportsApi, type CardiovascularReport, type ReportFinding, type ReviewDecision } from "./reportApi";

const STRUCTURES = ["LA", "RA", "LV", "RV", "SEPTUM", "MITRAL", "TRICUSPID", "PULMONARY_VALVE", "AORTIC_VALVE", "AORTA", "PULMONARY_ARTERY", "VENA_CAVA", "PULMONARY_VEINS", "LAD", "LCX", "RCA"];
export function FindingReview({ report, finding, onDecision, busy }: { report: CardiovascularReport; finding: ReportFinding; onDecision: (report: CardiovascularReport, decision: ReviewDecision) => void; busy: boolean }) {
  const [draft, setDraft] = useState(finding.normalized);
  const [note, setNote] = useState("");
  const canReview = ["reviewer", "admin"].includes(getStoredUser()?.role ?? "");
  const decide = (action: ReviewDecision["action"]) => onDecision(report, { finding_id: finding.id, action, expected_version: report.version, ...(action === "correct" ? { normalized: draft } : {}), note });
  return <article className="ci-finding" data-testid="report-finding">
    <div className="ci-row"><h3>{finding.normalized.label}</h3><span className={`ci-status ci-status-${finding.status}`}>{finding.status} · {finding.certainty}</span></div>
    <blockquote>{finding.source_excerpt}</blockquote>
    <dl className="ci-facts"><div><dt>Proposed structure</dt><dd>{finding.mapping.structure_id ?? "Location not established from supplied evidence"}</dd></div><div><dt>Documented segment</dt><dd>{finding.normalized.segment ?? "Unspecified; no lesion position is placed"}</dd></div><div><dt>Normalized observation</dt><dd>{finding.normalized.value != null ? `${finding.normalized.value} ${finding.normalized.unit ?? ""}` : "Qualitative finding"}</dd></div><div><dt>Mapping version</dt><dd>{finding.mapping.version}</dd></div></dl>
    <p>{finding.mapping.explanation ?? finding.mapping.rationale}</p><p className="ci-muted">{finding.mapping.rationale}</p>
    {finding.reviewed_at && <p className="ci-muted">Reviewed by {finding.reviewer_id} at {finding.reviewed_at}</p>}
    <details><summary>Correct proposed mapping</summary><p className="ci-muted">Corrections return to pending review and require separate approval. The server accepts only values and segments explicitly supported by this source; a correction cannot change its vessel or invent anatomy. Ambiguous or negated evidence requires source clarification.</p><div className="ci-form-grid"><label>Finding label<input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} maxLength={240}/></label><label>Anatomical structure<select value={draft.structure_id ?? ""} onChange={e => setDraft({ ...draft, structure_id: e.target.value || null })}><option value="">Location unresolved</option>{STRUCTURES.map(id => <option key={id}>{id}</option>)}</select></label><label>Reported segment<input value={draft.segment ?? ""} onChange={e => setDraft({ ...draft, segment: e.target.value || null })}/></label><label>Value<input type="number" step="any" value={draft.value ?? ""} onChange={e => setDraft({ ...draft, value: e.target.value === "" ? null : Number(e.target.value) })}/></label><label>Unit<input value={draft.unit ?? ""} onChange={e => setDraft({ ...draft, unit: e.target.value || null })}/></label></div><button disabled={busy || !canReview || !note.trim()} onClick={() => decide("correct")}>Save correction for review</button></details>
    <label>Reviewer rationale<input value={note} onChange={e => setNote(e.target.value)} maxLength={1000} placeholder="Required for corrections; retained in audit"/></label>
    <div className="ci-actions"><button disabled={busy || !canReview || finding.status !== "pending" || finding.certainty !== "documented"} onClick={() => decide("approve")}>Approve finding</button><button className="ci-secondary" disabled={busy || !canReview || finding.status === "rejected"} onClick={() => decide("reject")}>Reject finding</button></div>
    {!canReview && <p className="ci-muted">A reviewer or administrator must approve or reject this extraction.</p>}
  </article>;
}

export default function ReportReview({ reports, caseRef, patientRef, onChange, onUploaded, onDecision, onPassport, onDelete, busy }: {
  reports: CardiovascularReport[]; caseRef: string; patientRef: string; onChange: (field: "case" | "patient", value: string) => void;
  onUploaded: () => void; onDecision: (report: CardiovascularReport, decision: ReviewDecision) => void;
  onPassport: (report: CardiovascularReport) => void; onDelete: (report: CardiovascularReport) => void; busy: boolean;
}) {
  const [file, setFile] = useState<File | null>(null), [synthetic, setSynthetic] = useState(true), [studyDate, setStudyDate] = useState("");
  const [uploading, setUploading] = useState(false), [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = async (selected: File | null = file) => {
    if (!selected || !caseRef.trim() || !patientRef.trim()) { setError("Choose a report and supply case and patient references."); return; }
    if (selected.size > 8 * 1024 * 1024) { setError("Report exceeds the 8 MiB upload limit."); return; }
    const form = new FormData(); form.append("file", selected); form.append("case_ref", caseRef.trim()); form.append("patient_ref", patientRef.trim()); form.append("synthetic", String(synthetic));
    if (studyDate) form.append("study_at", `${studyDate}T00:00:00Z`);
    setUploading(true); setError("");
    try { await reportsApi.upload(form); setFile(null); if (fileInput.current) fileInput.current.value = ""; onUploaded(); }
    catch (e) { setError((e as Error).message); } finally { setUploading(false); }
  };
  const fictional = (unresolved: boolean) => {
    const today = new Date().toISOString();
    const text = `SYNTHETIC FICTIONAL CARDIOVASCULAR REPORT\nStudy date: ${today}\nReport type: Coronary angiography\n${unresolved ? "Cardiac disease documented. Anatomical location unspecified." : "LAD stenosis, 70%. Segment unspecified. LVEF 30%."}\nAuthor: Synthetic demonstration clinician\nEducational fixture; not a real patient.`;
    void upload(new File([text], unresolved ? "synthetic-unresolved.txt" : "synthetic-angiography.txt", { type: "text/plain" }));
  };
  return <section className="ci-panel" id="cardiovascular-upload" aria-label="Cardiovascular report intake and review"><div className="ci-row"><div><p className="ci-kicker">SOURCE → EXTRACTION → HUMAN REVIEW → ANATOMY</p><h2>Upload Cardiovascular Report</h2></div><span className="ci-badge">Protected evidence</span></div>
    <p>PDF text reports and supported FHIR JSON enter a conservative extraction workflow. Scans requiring OCR, raw ECG signals, DICOM and patient imaging reconstruction are unsupported here.</p>
    <form onSubmit={e => { e.preventDefault(); void upload(); }} className="ci-upload"><div className="ci-form-grid"><label>Case reference<input value={caseRef} onChange={e => onChange("case", e.target.value)} required maxLength={120}/></label><label>Patient reference<input value={patientRef} onChange={e => onChange("patient", e.target.value)} required maxLength={120}/></label><label>Study date override (optional)<input type="date" value={studyDate} onChange={e => setStudyDate(e.target.value)}/></label></div><label className="ci-checkbox"><input type="checkbox" checked={synthetic} onChange={e => setSynthetic(e.target.checked)}/> Fictional synthetic demonstration; contains no real patient data</label><label className="ci-file">Select cardiovascular PDF or FHIR JSON<input ref={fileInput} type="file" accept=".pdf,.json,.txt,application/pdf,application/json,text/plain" onChange={e => setFile(e.target.files?.[0] ?? null)}/></label><p className="ci-muted">Text files are synthetic-only. Server receipt and review timestamps are recorded now, independently of the study date.</p><div className="ci-actions"><button disabled={busy || uploading || !file}>{uploading ? "Validating and extracting…" : "Validate and extract report"}</button><button type="button" className="ci-secondary" disabled={!synthetic || uploading || busy} onClick={() => fictional(false)}>Use fictional LAD report</button><button type="button" className="ci-secondary" disabled={!synthetic || uploading || busy} onClick={() => fictional(true)}>Use fictional unresolved report</button></div></form>
    {error && <p role="alert" className="ci-error">{error}</p>}
    {!reports.length && <p className="ci-empty">No report was available at this replay boundary. Upload evidence, or return to today to review a newly received report.</p>}
    {reports.map(report => <section className="ci-report" key={`${report.id}-${report.version}`}><div className="ci-row"><h3>{report.source.filename}</h3><span className="ci-badge">{report.synthetic ? "SYNTHETIC" : "SOURCE DOCUMENT"} · v{report.version}</span></div><p className="ci-muted">{report.patient_ref} · observed {report.event_at ?? "unknown"} · received {report.available_at} · {report.storage_mode}</p>{report.warnings.map((warning, i) => <p className="ci-notice" key={i}>{warning}</p>)}{report.findings.map(finding => <FindingReview key={finding.id} report={report} finding={finding} onDecision={onDecision} busy={busy}/>)}<details><summary>Source integrity and audit trail</summary><p className="ci-mono">SHA-256 {report.source.sha256}</p><pre>{JSON.stringify(report.audit, null, 2)}</pre></details><div className="ci-actions"><button className="ci-secondary" disabled={busy} onClick={() => onPassport(report)}>Export report Evidence Passport</button><button className="ci-secondary" disabled={busy} onClick={() => onDelete(report)}>Delete protected report</button></div></section>)}
  </section>;
}

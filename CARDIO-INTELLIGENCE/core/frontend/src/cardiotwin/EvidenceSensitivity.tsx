import { ArrowRight, Clock3, Layers3 } from "lucide-react";
import { HemoSection, hemoDate, hemoLabel, type WhySelection } from "./HemoPanels";
import type { HemoResult } from "./hemoTypes";

/** Audits the reconstruction's dependence on inputs; never simulates patient physiology. */
export function EvidenceSensitivity({ result, onWhy }: { result: HemoResult; onWhy: (why: WhySelection) => void }) {
  if (!result.evidence_sensitivity) return null;
  return <HemoSection title="What holds this inference together?" eyebrow="Evidence sensitivity · same deterministic rules">
    <p className="max-w-4xl text-xs leading-relaxed text-ink-body">Withhold one evidence type and inspect the reconstructed state. A changed conclusion exposes dependence on that input; an unchanged conclusion does not establish clinical certainty.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Evidence sensitivity comparisons">
      {result.evidence_sensitivity.map(row => <button key={row.modality} type="button" onClick={() => onWhy({ title: `${row.modality} evidence withheld`, from: row.original_stage, to: row.withheld_stage, explanation: `${result.sensitivity_notice} ${row.changed_axes.length ? row.changed_axes.map(a => `${hemoLabel(a.axis)}: ${a.with_all_evidence} → ${a.with_modality_withheld}`).join("; ") : "No qualitative axis category changed under the same rules."}`, confidence: row.withheld_confidence, evidence_refs: row.evidence_refs, timestamp: result.as_of, classification: "DERIVED · EVIDENCE SENSITIVITY" })} className={`rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand ${row.stage_changed ? "border-accent-brand/60 bg-accent-brand/5" : "border-surface-border bg-surface-bg"}`}>
        <span className="flex items-center gap-2 text-xs font-semibold text-ink-primary"><Layers3 size={13} aria-hidden /> Without {row.modality.toLowerCase()}</span>
        <span className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-body">{hemoLabel(row.original_stage)} <ArrowRight size={12} aria-hidden /> <b>{hemoLabel(row.withheld_stage)}</b></span>
        <span className="mt-2 block text-[10px] text-ink-muted">Confidence {row.original_confidence} → {row.withheld_confidence} · {row.changed_axes.length} axes changed</span>
        <span className="mt-2 block text-[10px] font-semibold text-ink-primary">Inspect withheld evidence →</span>
      </button>)}
    </div>
    {!result.evidence_sensitivity.length && <p className="mt-3 text-xs text-ink-muted">No eligible evidence modality to inspect. The state remains UNKNOWN.</p>}
    <p className="mt-3 text-[10px] leading-relaxed text-ink-muted">{result.sensitivity_notice}</p>
  </HemoSection>;
}

export function KnowledgeFrontier({ result, onWhy }: { result: HemoResult; onWhy: (why: WhySelection) => void }) {
  if (!result.knowledge_frontier) return null;
  return <HemoSection title="When did the twin learn this?" eyebrow="Knowledge arrival · observation time ≠ availability time">
    <p className="text-xs leading-relaxed text-ink-body">Delayed evidence enters the twin when its recorded version becomes available. Earlier replays cannot see that result.</p>
    <ol className="mt-4 space-y-3" aria-label="Delayed evidence arrival ledger">{result.knowledge_frontier.map(row => <li key={row.id} className="rounded-xl border border-surface-border bg-surface-bg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-semibold text-ink-primary"><Clock3 size={13} aria-hidden /> {hemoLabel(row.kind)}</span><span className="text-[10px] text-ink-muted">DERIVED · {row.delay_hours} hours until availability</span></div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-body"><span><span className="block text-[9px] text-ink-muted">Observed</span>{hemoDate(row.event_at, true)} UTC</span><ArrowRight size={14} aria-hidden /><span><span className="block text-[9px] text-ink-muted">Knowable</span>{hemoDate(row.available_at, true)} UTC</span></div>
      <p className="mt-3 text-[10px] leading-relaxed text-ink-muted">{row.explanation}</p>
      <button type="button" className="mt-2 rounded text-[11px] font-semibold text-ink-primary underline focus-visible:ring-2 focus-visible:ring-accent-brand" onClick={() => onWhy({ title: `${hemoLabel(row.kind)} knowledge arrival`, to: "AVAILABLE", explanation: row.explanation, confidence: "LOW", evidence_refs: row.evidence_refs, timestamp: row.available_at, classification: "DERIVED · AVAILABILITY LAG" })}>Trace delayed source</button>
    </li>)}</ol>
    {!result.knowledge_frontier.length && <p className="mt-3 text-xs text-ink-muted">No known result with a delay of 24 hours or more in this reconstruction. Unavailable results are not listed.</p>}
  </HemoSection>;
}

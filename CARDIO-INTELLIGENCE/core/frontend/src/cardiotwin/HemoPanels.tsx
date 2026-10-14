import { ArrowDown, ArrowRight, Braces, CircleHelp, FileText, HeartPulse, Link2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { HEMO_AXES, type HemoAxis, type HemoAxisKey, type HemoEvidence, type HemoResult, type HemoTransition } from "./hemoTypes";
import HemoStateScene from "./HemoStateScene";

export const HEMO_BUTTON = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs font-medium text-ink-primary hover:border-accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand disabled:cursor-wait disabled:opacity-50";
export const hemoLabel = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
export const hemoDate = (value: string, time = false) => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "UTC" }).format(parsed);
};
export const hemoValue = (value: unknown): string => value == null || value === "" ? "UNKNOWN" : typeof value === "string" ? value : JSON.stringify(value) ?? "UNKNOWN";

export function HemoSection({ title, eyebrow, children, id, right }: { title: string; eyebrow?: string; children: ReactNode; id?: string; right?: ReactNode }) {
  return <section id={id} className="hemo-section min-w-0 rounded-2xl border border-surface-border bg-surface-raised p-4 sm:p-5 scroll-mt-24">
    <header className="mb-4 flex flex-wrap items-start justify-between gap-2"><div>{eyebrow && <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">{eyebrow}</p>}<h2 className="mt-1 text-base font-semibold text-ink-primary">{title}</h2></div>{right}</header>
    {children}
  </section>;
}

export interface WhySelection { title: string; from?: string; to: string; explanation: string; confidence: string; evidence_refs: string[]; uncertainties?: string[]; timestamp: string; classification?: string; }
export function transitionWhy(t: HemoTransition): WhySelection { return { title: hemoLabel(t.axis), from: t.from_level, to: t.to_level, explanation: t.explanation, confidence: t.confidence, evidence_refs: t.evidence_refs, timestamp: t.timestamp }; }
export function axisWhy(key: HemoAxisKey, axis: HemoAxis, timestamp: string): WhySelection { return { title: HEMO_AXES.find(([k]) => k === key)?.[1] ?? hemoLabel(key), to: axis.level, explanation: axis.explanation, confidence: axis.confidence, evidence_refs: axis.evidence_refs, uncertainties: axis.uncertainties, timestamp, classification: axis.classification === "INFERRED" ? "TWIN INFERENCE" : axis.classification }; }

export function StateVector({ result, onWhy, onSceneWhy = onWhy, pending = false }: { result: HemoResult; onWhy: (why: WhySelection) => void; onSceneWhy?: (why: WhySelection) => void; pending?: boolean }) {
  const s = result.snapshot;
  return <HemoSection title="Cardiovascular state" eyebrow="Time-indexed reconstruction" right={<span className="rounded-full border border-surface-border px-2.5 py-1 text-[11px] text-ink-body">{pending ? "Loading evidence…" : <>Confidence: <b>{s.confidence}</b></>}</span>}>
    <HemoStateScene snapshot={s} evidence={pending ? [] : result.evidence} asOf={result.as_of} pending={pending} recentDays={typeof result.rules?.recent_days === "number" ? result.rules.recent_days : 14} onSelect={key => onSceneWhy(axisWhy(key, s[key], s.timestamp))} />
    {!pending && <details className="hemo-vector-details"><summary>Detailed state vector &middot; all eight dimensions</summary><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Cardiovascular state vector">
      {HEMO_AXES.map(([key, label]) => { const axis = s[key]; return <button key={key} type="button" onClick={() => onWhy(axisWhy(key, axis, s.timestamp))} className={`group flex min-h-[104px] flex-col items-start rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand ${axis.level === "UNKNOWN" ? "border-dashed border-surface-border bg-surface-bg" : axis.level === "HIGH" ? "border-accent-brand bg-accent-brand/10" : "border-surface-border bg-surface-bg hover:border-accent-brand"}`} data-testid={`hemo-axis-${key}`}>
        <span className="text-xs text-ink-body">{label}</span><strong className="mt-3 text-lg tracking-tight text-ink-primary">{axis.level}</strong>
        <span className="mt-1 text-[9px] uppercase tracking-wider text-ink-muted">{axis.classification} · {axis.confidence} confidence</span>
        <span className="mt-auto pt-2 text-[10px] text-ink-muted group-hover:text-ink-primary">Inspect evidence <ArrowRight size={10} className="inline" aria-hidden /></span>
      </button>; })}
    </div></details>}
    <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">Qualitative state categories describe this research reconstruction. Filling pressure is a proxy; inferred states are not directly measured pressures.</p>
  </HemoSection>;
}

export function TrajectoryPanel({ result, onReplay, busy }: { result: HemoResult; onReplay: (at: string) => void; busy: boolean }) {
  const moments = result.timeline.filter((s, i, list) => i === 0 || i === list.length - 1 || s.congestion.stage !== list[i - 1].congestion.stage);
  return <HemoSection title="Hemodynamic state transitions" eyebrow="Signature trajectory · Research / clinical-support inference">
    <div className="flex items-center gap-2 text-ink-primary"><HeartPulse size={19} aria-hidden /><strong className="text-lg">{hemoLabel(result.snapshot.congestion.stage)}</strong><span className="ml-auto text-[10px] uppercase tracking-wider text-ink-muted">{result.snapshot.congestion.confidence} confidence</span></div>
    <p className="mt-2 text-sm leading-relaxed text-ink-body">{result.snapshot.congestion.explanation}</p>
    <ol className="mt-5 flex gap-0 overflow-x-auto pb-2" aria-label="Congestion trajectory timeline">
      {moments.map((s, i) => <li key={`${s.timestamp}-${i}`} className="relative min-w-[138px] flex-1 border-t-2 border-surface-border pt-4 pr-3">
        <span className={`absolute -top-[6px] left-0 h-[10px] w-[10px] rounded-full border-2 border-surface-raised ${s.congestion.stage === "UNKNOWN" ? "bg-ink-faint" : "bg-ink-primary"}`} />
        <button type="button" onClick={() => onReplay(s.timestamp)} disabled={busy} className="rounded-lg py-1 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand hover:underline" aria-label={`Replay twin ${hemoDate(s.timestamp)} ${hemoLabel(s.congestion.stage)}`}>
          <span className="block text-[10px] text-ink-muted">{hemoDate(s.timestamp)}</span><strong className="mt-1 block text-xs text-ink-primary">{hemoLabel(s.congestion.stage)}</strong><span className="mt-1 block text-[10px] text-ink-muted">{s.evidence_refs.length} evidence references</span>
        </button>
      </li>)}
    </ol>
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-ink-muted"><FileText size={12} aria-hidden /> Evidence <ArrowRight size={10} aria-hidden /> Interpretation <ArrowRight size={10} aria-hidden /> State transition <ArrowRight size={10} aria-hidden /> Clinician review</div>
  </HemoSection>;
}

export function TransitionList({ result, selected, onWhy }: { result: HemoResult; selected: WhySelection | null; onWhy: (why: WhySelection) => void }) {
  return <HemoSection title="Why did the twin change?" eyebrow={`${result.transitions.length} inspectable transitions`}>
    {!result.transitions.length ? <p className="text-sm text-ink-muted">No state transition is supported in this evidence window. Inspect any state above to see what is known.</p> : <ol className="max-h-[350px] space-y-2 overflow-y-auto pr-1">
      {[...result.transitions].reverse().map(t => <li key={t.id}><button type="button" onClick={() => onWhy(transitionWhy(t))} aria-pressed={selected?.timestamp === t.timestamp && selected?.title === hemoLabel(t.axis)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-surface-border p-3 text-left hover:border-accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand">
        <div className="min-w-0"><span className="text-[10px] text-ink-muted">{hemoDate(t.timestamp)} · {hemoLabel(t.axis)}</span><p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-primary">{hemoLabel(t.from_level)} <ArrowRight size={12} aria-hidden /> {hemoLabel(t.to_level)}</p><p className="mt-1 text-[10px] text-ink-muted">{t.evidence_refs.length} linked records · {t.confidence} confidence · Review required</p></div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-ink-primary"><CircleHelp size={13} aria-hidden /> WHY</span>
      </button></li>)}
    </ol>}
  </HemoSection>;
}

export function EvidenceRecord({ evidence, onBack }: { evidence: HemoEvidence; onBack?: () => void }) {
  return <article id={`hemo-record-${evidence.id}`} className="rounded-xl border border-surface-border bg-surface-bg p-3 scroll-mt-24" data-testid={`hemo-evidence-${evidence.id}`}>
    <header className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] uppercase tracking-wider text-ink-muted">{evidence.classification}</p><h4 className="mt-1 text-sm font-semibold text-ink-primary">{hemoLabel(evidence.kind)}</h4></div><span className="text-sm font-semibold tabular-nums text-ink-primary">{hemoValue(evidence.value)} {evidence.unit}</span></header>
    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px] text-ink-body"><dt className="text-ink-muted">Event time</dt><dd>{hemoDate(evidence.event_at, true)} UTC</dd><dt className="text-ink-muted">Available to twin</dt><dd>{hemoDate(evidence.available_at, true)} UTC</dd><dt className="text-ink-muted">Source reference</dt><dd className="break-all font-mono">{evidence.source_ref}</dd><dt className="text-ink-muted">Evidence ID</dt><dd className="break-all font-mono">{evidence.id}</dd></dl>
    <details className="mt-3 text-xs text-ink-body"><summary className="cursor-pointer rounded font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"><FileText size={12} className="mr-1 inline" aria-hidden /> Original record &amp; provenance</summary>
      <div className="mt-3 space-y-3"><div><p className="mb-1 text-[10px] uppercase text-ink-muted">Transformation / provenance</p><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-surface-border bg-surface-raised p-2 text-[10px]">{JSON.stringify(evidence.provenance, null, 2)}</pre></div><div><p className="mb-1 text-[10px] uppercase text-ink-muted">Original source record</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-surface-border bg-surface-raised p-2 text-[10px]">{JSON.stringify(evidence.original_record, null, 2)}</pre></div>{onBack && <button className={HEMO_BUTTON} onClick={onBack}>Back to twin explanation</button>}</div>
    </details>
  </article>;
}

export function WhyPanel({ result, selected, onEvidence, onClose }: { result: HemoResult; selected: WhySelection; onEvidence: (id: string) => void; onClose: () => void }) {
  const records = selected.evidence_refs.map(id => result.evidence.find(e => e.id === id)).filter((e): e is HemoEvidence => Boolean(e));
  return <HemoSection id="hemo-why" title="WHY DID THIS CHANGE?" eyebrow="Evidence → interpretation → state" right={<button type="button" onClick={onClose} className={HEMO_BUTTON}>Close explanation</button>}>
    <div data-testid="hemo-why" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-primary"><span>{selected.title}</span><span className="text-ink-muted">· {hemoDate(selected.timestamp)}</span>{selected.from && <><span>{hemoLabel(selected.from)}</span><ArrowRight size={15} aria-hidden /></>}<span className="rounded border border-accent-brand px-2 py-1">{hemoLabel(selected.to)}</span></div>
      <div className="grid gap-3 lg:grid-cols-[1.05fr_24px_1fr_24px_0.8fr]">
        <div className="rounded-xl border border-surface-border p-3"><p className="text-[10px] uppercase tracking-wider text-ink-muted">Contributing evidence</p><ul className="mt-2 space-y-2">{records.map(e => <li key={e.id}><button type="button" onClick={() => onEvidence(e.id)} className="w-full rounded-lg border border-surface-border bg-surface-bg p-2 text-left text-xs hover:border-accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"><b className="text-ink-primary">{hemoLabel(e.kind)}</b><span className="ml-1 text-ink-body">{hemoValue(e.value)} {e.unit}</span><span className="mt-1 block text-[10px] text-ink-muted">{e.classification} · {hemoDate(e.event_at)} · Open original record <Link2 size={10} className="inline" aria-hidden /></span></button></li>)}</ul>{!records.length && <p className="mt-2 text-xs text-ink-muted">No accessible contributing observation. This state remains uncertain.</p>}</div>
        <ArrowRight className="hidden self-center text-ink-muted lg:block" size={20} aria-hidden /><ArrowDown className="mx-auto text-ink-muted lg:hidden" size={18} aria-hidden />
        <div className="rounded-xl border border-surface-border bg-surface-bg p-3"><p className="text-[10px] uppercase tracking-wider text-ink-muted">Deterministic interpretation</p><p className="mt-2 text-xs leading-relaxed text-ink-body">{selected.explanation}</p><span className="mt-3 inline-block rounded border border-surface-border px-1.5 py-0.5 text-[9px] text-ink-muted">{selected.classification ?? "TWIN INFERENCE"}</span></div>
        <ArrowRight className="hidden self-center text-ink-muted lg:block" size={20} aria-hidden /><ArrowDown className="mx-auto text-ink-muted lg:hidden" size={18} aria-hidden />
        <div className="rounded-xl border border-accent-brand/50 p-3"><p className="text-[10px] uppercase tracking-wider text-ink-muted">Twin state · review</p><p className="mt-2 text-sm font-semibold text-ink-primary">{hemoLabel(selected.to)}</p><p className="mt-2 text-xs text-ink-body">Confidence: <b>{selected.confidence}</b></p><p className="mt-3 flex items-center gap-1 text-xs font-semibold text-ink-primary"><ShieldCheck size={13} aria-hidden /> Human review REQUIRED</p><p className="mt-2 text-[10px] leading-relaxed text-ink-muted">This inference cannot approve a diagnosis or prescribe treatment.</p></div>
      </div>
      {!!selected.uncertainties?.length && <ul className="list-disc space-y-1 pl-4 text-xs text-ink-muted">{selected.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul>}
    </div>
  </HemoSection>;
}

export function InteractionPanels({ result, onWhy }: { result: HemoResult; onWhy: (why: WhySelection) => void }) {
  const axisCard = (key: HemoAxisKey) => {
    const a = result.snapshot[key];
    const history = result.timeline.filter((s, i, list) => i === 0 || s[key].level !== list[i - 1][key].level).slice(-4);
    return <div className="mt-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-ink-primary">{a.level}</span><span className="text-[9px] text-ink-muted">{a.classification} · {a.confidence}</span></div><p className="mt-2 text-xs leading-relaxed text-ink-body">{a.explanation}</p>{a.uncertainties?.map((u, i) => <p key={i} className="mt-1 text-[10px] text-ink-muted">{u}</p>)}
      <ol className="mt-3 space-y-1 border-l border-surface-border pl-3" aria-label={`${hemoLabel(key)} state history`}>{history.map(s => <li key={s.timestamp}><button type="button" onClick={() => onWhy(axisWhy(key, s[key], s.timestamp))} className="flex w-full items-center justify-between gap-2 rounded py-0.5 text-left text-[10px] focus-visible:ring-2 focus-visible:ring-accent-brand hover:underline"><span className="text-ink-muted">{hemoDate(s.timestamp)}</span><span className="font-semibold text-ink-body">{s[key].level}</span></button></li>)}</ol>
      <button type="button" onClick={() => onWhy(axisWhy(key, a, result.snapshot.timestamp))} className="mt-3 inline-flex items-center gap-1 rounded text-[11px] font-semibold text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand">Trace evidence <ArrowRight size={12} aria-hidden /></button></div>;
  };
  return <div className="grid gap-4 md:grid-cols-3">
    <HemoSection title="Cardiac function trajectory" eyebrow="Pump ↔ functional capacity">{axisCard("pump_function")}<div className="mt-4 border-t border-surface-border pt-3"><p className="text-[10px] uppercase text-ink-muted">Functional capacity</p>{axisCard("functional_capacity")}</div></HemoSection>
    <HemoSection title="Heart ↔ Kidney" eyebrow="Cardio-renal interaction">{axisCard("renal_interaction")}<p className="mt-4 border-t border-surface-border pt-3 text-[10px] leading-relaxed text-ink-muted">Renal marker changes and congestion signals are temporal associations. They do not establish that one caused the other.</p></HemoSection>
    <HemoSection title="Rhythm stability timeline" eyebrow="Recorded rhythm evidence">{axisCard("rhythm_stability")}<div className="mt-4 border-t border-surface-border pt-3"><p className="text-[10px] uppercase text-ink-muted">Respiratory interaction</p>{axisCard("respiratory_interaction")}</div></HemoSection>
  </div>;
}

export function DerivedMeasures({ result, onWhy }: { result: HemoResult; onWhy: (why: WhySelection) => void }) {
  if (!result.derived_measures.length) return <p className="text-xs leading-relaxed text-ink-muted">No derived trend is supported by the currently available observations.</p>;
  return <div className="space-y-3">{result.derived_measures.map(m => <article key={m.id} className="rounded-xl border border-surface-border bg-surface-bg p-3"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-xs font-semibold text-ink-primary">{hemoLabel(m.kind)}</p><span className="text-[9px] tracking-wide text-ink-muted">DERIVED · {m.window_days} days</span></div><p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums text-ink-primary"><span>{m.baseline} {m.unit}</span><ArrowRight size={14} aria-hidden /><span>{m.latest} {m.unit}</span><span className="ml-auto text-xs">{m.value > 0 ? "+" : ""}{m.value} {m.unit}{m.percent_change != null ? ` (${m.percent_change > 0 ? "+" : ""}${m.percent_change.toFixed(1)}%)` : ""}</span></p><p className="mt-2 text-[10px] leading-relaxed text-ink-muted">{m.transformation}</p><button type="button" className="mt-3 inline-flex items-center gap-1 rounded text-[11px] font-semibold text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand" onClick={() => onWhy({ title: hemoLabel(m.kind), from: `${m.baseline} ${m.unit ?? ""}`, to: `${m.latest} ${m.unit ?? ""}`, explanation: m.transformation, confidence: result.snapshot.confidence, evidence_refs: m.evidence_refs, timestamp: m.timestamp, classification: "DERIVED MEASURE" })}>Trace calculation operands <ArrowRight size={12} aria-hidden /></button></article>)}</div>;
}

export function InterventionResponses({ result, onWhy }: { result: HemoResult; onWhy: (why: WhySelection) => void }) {
  if (!result.intervention_responses.length) return <p className="text-xs leading-relaxed text-ink-muted">No evaluable intervention response is available as of this time. Later response observations remain outside this replay.</p>;
  return <div className="space-y-4">{result.intervention_responses.map(r => <article key={`${r.intervention_ref}-${r.timestamp}`} className="rounded-xl border border-surface-border bg-surface-bg p-3"><header className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-ink-primary">Recorded intervention · {hemoDate(r.timestamp)}</p><button type="button" className="rounded text-[10px] font-semibold text-ink-body underline focus-visible:ring-2 focus-visible:ring-accent-brand" onClick={() => onWhy({ title: "Intervention response", to: hemoLabel(r.status), explanation: r.interpretation, confidence: result.snapshot.confidence, evidence_refs: r.evidence_refs, timestamp: result.as_of, classification: "OBSERVATIONAL COMPARISON" })}>WHY / source record</button></header>
    {!r.changes.length ? <p className="mt-3 text-xs text-ink-muted">Post-intervention observations remain UNKNOWN at this time.</p> : <div className="mt-3 space-y-3">{r.changes.map((c, i) => <div key={`${c.kind}-${i}`} className="border-t border-surface-border pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-ink-primary">{hemoLabel(c.kind)}</p><span className="text-[9px] tracking-wide text-ink-muted">{c.classification}</span></div><div className="mt-2 grid grid-cols-[1fr_20px_1fr] gap-2 text-xs text-ink-body"><div><span className="block text-[9px] text-ink-muted">Before · {hemoDate(c.before_at)}</span><b>{hemoValue(c.before)} {c.unit}</b></div><ArrowRight size={14} className="self-center text-ink-muted" aria-hidden /><div><span className="block text-[9px] text-ink-muted">After · {hemoDate(c.after_at)}</span><b>{hemoValue(c.after)} {c.unit}</b></div></div>{c.delta != null && <p className="mt-2 text-[11px] font-semibold tabular-nums text-ink-primary">Observed difference: {c.delta > 0 ? "+" : ""}{c.delta} {c.unit}</p>}{c.uncertainties?.map((u, j) => <p key={j} className="mt-1 text-[10px] text-ink-muted">{u}</p>)}<button type="button" className="mt-2 rounded text-[10px] font-semibold text-ink-muted underline focus-visible:ring-2 focus-visible:ring-accent-brand" onClick={() => onWhy({ title: `${hemoLabel(c.kind)} after intervention`, from: hemoValue(c.before), to: hemoValue(c.after), explanation: `${c.transformation}. ${r.interpretation}`, confidence: result.snapshot.confidence, evidence_refs: [...new Set([r.intervention_ref, ...c.evidence_refs])], timestamp: c.after_at, uncertainties: c.uncertainties, classification: c.classification })}>Trace before / after evidence</button></div>)}</div>}
    <p className="mt-3 border-t border-surface-border pt-3 text-[10px] leading-relaxed text-ink-muted">{r.interpretation}</p>
  </article>)}</div>;
}

export function GovernanceNote() { return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-bg p-3 text-xs text-ink-body"><p><b>Human review: REQUIRED.</b> This draft reconstruction does not alter source records or approve clinical states.</p><Link to="/interop" className={HEMO_BUTTON}><ShieldCheck size={13} aria-hidden /> Existing review &amp; exchange workbench</Link></div>; }
export function JsonSnapshot({ result }: { result: HemoResult }) { return <details className="text-xs text-ink-body"><summary className="cursor-pointer font-medium"><Braces size={13} className="mr-1 inline" aria-hidden /> Inspect structured twin snapshot</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-surface-border bg-surface-bg p-3 text-[10px]">{JSON.stringify({ engine_version: result.engine_version, as_of: result.as_of, snapshot: result.snapshot, review: result.review }, null, 2)}</pre></details>; }

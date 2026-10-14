/** Cardiology-first 3D view of the clinical and deployment architecture. */
import { Activity, ArrowRight, HeartPulse, Layers3, ShieldCheck } from "lucide-react";
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { EMPTY_SNAPSHOT, fetchSnapshot } from "../lib/liveFeed";
import { useLive } from "../lib/core__src_lib__useLive";

const CardiologyArchitecture3D = lazy(() => import("../cardiotwin/CardiologyArchitecture3D"));

const FLOW = [
  { icon: Activity, title: "Patient evidence", copy: "Recorded inputs and provenance enter the governed workflow.", to: "/evidence" },
  { icon: HeartPulse, title: "CardioTwin estimate", copy: "Model estimates are surfaced with uncertainty and validation context.", to: "/cardiotwin" },
  { icon: ShieldCheck, title: "Clinical review", copy: "A qualified reviewer interprets evidence and owns the decision.", to: "/review" },
  { icon: Layers3, title: "Approved exchange", copy: "FHIR/OAH transfer occurs only after explicit human approval.", to: "/interop" },
];

export default function Architecture() {
  const snapshot = useLive(fetchSnapshot).data ?? EMPTY_SNAPSHOT;
  const observations = [
    snapshot.cases ? `${snapshot.cases.total} recorded cases` : "Case counts unavailable",
    snapshot.cardio ? `Model v${snapshot.cardio.version} · ${snapshot.cardio.integrity ? "integrity verified" : "integrity failed"}` : "Model status unavailable",
    snapshot.cases ? `${snapshot.cases.awaiting} awaiting review` : "Review counts unavailable",
    "Open governed exchange",
  ];
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-cyan">CARDIOTON · CARDIOLOGY-FIRST ARCHITECTURE</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-primary sm:text-3xl">A cardiac view of the care system</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted">Explore how cardiac decision support sits inside a clinician-governed workflow, with evidence, services, and approved interoperability shown around it.</p>
      </div>
      <Link to="/cardiotwin" className="inline-flex items-center gap-2 rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 px-3 py-2 text-sm text-accent-cyan hover:bg-accent-cyan/10">Open CardioTwin <ArrowRight size={14} /></Link>
    </header>

    <Suspense fallback={<div className="grid h-64 place-items-center rounded-2xl border border-surface-border bg-surface-raised text-sm text-ink-muted">Loading interactive heart architecture…</div>}>
      <CardiologyArchitecture3D />
    </Suspense>

    <section aria-labelledby="care-flow-title" className="rounded-2xl border border-surface-border bg-surface-raised p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] uppercase tracking-wider text-ink-faint">Clinical flow</p><h2 id="care-flow-title" className="text-base font-semibold text-ink-primary">Signal → review → approved exchange</h2></div><Link to="/runtime" className="text-xs text-accent-cyan hover:underline">Live service health and deployment topology</Link></div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FLOW.map(({ icon: Icon, title, copy, to }, index) => <li key={title}><Link to={to} className="block h-full rounded-xl border border-surface-border bg-surface-panel/50 p-3 transition-colors hover:border-accent-cyan/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-cyan">
          <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-cyan/10 text-accent-cyan"><Icon size={15} /></span><span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">0{index + 1}</span></div>
          <h3 className="mt-2 text-sm font-semibold text-ink-primary">{title}</h3><p className="mt-1 text-xs leading-relaxed text-ink-muted">{copy}</p>
          <p className="mt-3 flex items-center justify-between gap-2 text-[11px] text-accent-cyan">{observations[index]}<ArrowRight size={12} aria-hidden /></p>
        </Link></li>)}
      </ol>
    </section>

    <div className="grid gap-3 md:grid-cols-2">
      <Link to="/cardiotwin/evaluation" className="rounded-xl border border-surface-border bg-surface-raised p-4 transition-colors hover:border-accent-brand/50"><p className="text-[10px] uppercase tracking-wider text-ink-faint">Model assurance</p><h2 className="mt-1 text-sm font-semibold text-ink-primary">Evaluation &amp; methods <ArrowRight className="inline" size={13} /></h2><p className="mt-1 text-xs text-ink-muted">Review validation metrics, calibration, and model limitations.</p></Link>
      <Link to="/interop" className="rounded-xl border border-surface-border bg-surface-raised p-4 transition-colors hover:border-accent-brand/50"><p className="text-[10px] uppercase tracking-wider text-ink-faint">Interoperability</p><h2 className="mt-1 text-sm font-semibold text-ink-primary">Human review &amp; round trip <ArrowRight className="inline" size={13} /></h2><p className="mt-1 text-xs text-ink-muted">Inspect validation, reviewer approval, provenance, and semantic exchange.</p></Link>
    </div>
  </main>;
}

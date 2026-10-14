import { HeartHandshake, ShieldAlert } from "lucide-react";
import type { PatientValues, Prediction } from "./core__src_cardiotwin__types";

interface HeartTeamConsensusProps {
  prediction: Prediction;
  patient: PatientValues;
}

export function HeartTeamConsensus({ prediction, patient }: HeartTeamConsensusProps) {
  const values = [
    ["CAD", prediction.cad.probability],
    ["LAD", prediction.vessels.LAD.probability],
    ["LCX", prediction.vessels.LCX.probability],
    ["RCA", prediction.vessels.RCA.probability],
  ] as const;

  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised p-4 cardio-card-glow space-y-3.5">
      <div className="flex items-center gap-2 border-b border-surface-border/60 pb-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-brand/15 text-accent-brand"><HeartHandshake size={16} /></span>
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">Model estimates and review</h3>
          <p className="text-[11px] text-ink-muted">Patient inputs: age {typeof patient.age === "number" ? patient.age : "not provided"}; sex {patient.sex === 1 ? "male" : patient.sex === 0 ? "female" : "not provided"}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {values.map(([label, value]) => <div key={label} className="rounded-lg border border-surface-border bg-surface-panel p-3">
          <span className="block text-[11px] text-ink-muted">{label} model probability</span>
          <span className="text-lg font-semibold font-mono text-ink-primary">{(value * 100).toFixed(1)}%</span>
        </div>)}
      </div>
      <div className="flex gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 text-xs text-ink-body">
        <ShieldAlert size={16} className="shrink-0 text-accent-amber" />
        <p>These are model outputs, not diagnoses or treatment recommendations. No anatomical measurements, guideline determination, clinician sign-off, or cryptographic passport is represented here. Clinical review is pending.</p>
      </div>
    </section>
  );
}

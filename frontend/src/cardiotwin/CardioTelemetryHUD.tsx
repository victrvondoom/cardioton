import { Activity, Flame, Heart, ShieldAlert } from "lucide-react";
import type { PatientValues, Prediction, TargetId } from "./types";

interface CardioTelemetryHUDProps {
  patient: PatientValues;
  prediction: Prediction | null;
  selectedTarget: TargetId;
  stressMode: boolean;
  onToggleStress: (active: boolean) => void;
}

export function CardioTelemetryHUD({ patient, prediction, selectedTarget, stressMode, onToggleStress }: CardioTelemetryHUDProps) {
  const hr = typeof patient.PR === "number" ? patient.PR : null;
  const bp = typeof patient.BP === "number" ? patient.BP : null;
  const probability = prediction ? (selectedTarget === "CAD" ? prediction.cad.probability : prediction.vessels[selectedTarget].probability) : null;

  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised p-4 cardio-card-glow space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-brand/10 text-accent-brand"><Activity size={16} /></span>
          <div>
            <h2 className="text-sm font-semibold text-ink-primary">Input measurements and illustrative scenario</h2>
            <p className="text-[11px] text-ink-muted">Values shown only when present in the submitted model inputs</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onToggleStress(false)} aria-pressed={!stressMode} className="px-2.5 py-1 text-xs rounded-md border border-surface-border">Baseline</button>
          <button type="button" onClick={() => onToggleStress(true)} aria-pressed={stressMode} className="px-2.5 py-1 text-xs rounded-md border border-surface-border flex items-center gap-1"><Flame size={12} />Scenario stress</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border border-surface-border bg-surface-panel p-3"><span className="flex items-center gap-1 text-[11px] text-ink-muted"><Heart size={13} />PR input</span><p className="mt-1 text-lg font-mono text-ink-primary">{hr === null ? "Not provided" : `${hr} bpm`}</p></div>
        <div className="rounded-lg border border-surface-border bg-surface-panel p-3"><span className="text-[11px] text-ink-muted">BP input</span><p className="mt-1 text-lg font-mono text-ink-primary">{bp === null ? "Not provided" : `${bp} mmHg`}</p></div>
        <div className="rounded-lg border border-surface-border bg-surface-panel p-3"><span className="text-[11px] text-ink-muted">{selectedTarget} model probability</span><p className="mt-1 text-lg font-mono text-ink-primary">{probability === null ? "Unavailable" : `${(probability * 100).toFixed(1)}%`}</p></div>
      </div>
      <div className="flex gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 text-xs text-ink-body">
        <ShieldAlert size={16} className="shrink-0 text-accent-amber" />
        <p><b>Illustrative waveform only — not a patient ECG.</b> The scenario toggle changes no patient measurement or model probability. It does not represent stress testing or physiological telemetry.</p>
      </div>
      <svg viewBox="0 0 480 72" role="img" aria-label="Illustrative decorative waveform, not a patient ECG" className="w-full h-16 rounded-lg border border-surface-border bg-surface-panel">
        <path d="M0 36 H70 l8 -5 8 10 10 -18 10 26 10 -13 H190 l8 -5 8 10 10 -18 10 26 10 -13 H340 l8 -5 8 10 10 -18 10 26 10 -13 H480" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-brand" />
      </svg>
    </section>
  );
}

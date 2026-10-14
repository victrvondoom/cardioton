import { Activity, ShieldAlert } from "lucide-react";
import type { Prediction, TargetId } from "./core__src_cardiotwin__types";

interface VesselCrossSectionInspectorProps {
  prediction: Prediction;
  selectedTarget: TargetId;
  stressMode: boolean;
}

export function VesselCrossSectionInspector({ prediction, selectedTarget, stressMode }: VesselCrossSectionInspectorProps) {
  const result = selectedTarget === "CAD" ? prediction.cad : prediction.vessels[selectedTarget];
  const probability = Math.max(0, Math.min(1, result.probability));

  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised p-4 cardio-card-glow space-y-3.5">
      <div className="flex items-center gap-2 border-b border-surface-border/60 pb-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-cyan/15 text-accent-cyan"><Activity size={16} /></span>
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">Model output: {selectedTarget}</h3>
          <p className="text-[11px] text-ink-muted">Probability produced by the selected prediction model</p>
        </div>
      </div>
      <div className="rounded-lg border border-surface-border bg-surface-panel p-4">
        <div className="flex justify-between text-xs text-ink-muted"><span>Model probability</span><span className="font-mono text-ink-primary">{(probability * 100).toFixed(1)}%</span></div>
        <div className="mt-2 h-2 rounded-full bg-surface-border overflow-hidden" role="img" aria-label={`${(probability * 100).toFixed(1)} percent model probability`}>
          <div className="h-full rounded-full bg-accent-brand" style={{ width: `${probability * 100}%` }} />
        </div>
      </div>
      <div className="flex gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 text-xs text-ink-body">
        <ShieldAlert size={16} className="shrink-0 text-accent-amber" />
        <p>No patient-specific vessel imaging, stenosis measurement, pressure, flow, or ischemia measurement is available in this view. {stressMode ? "The stress scenario does not change this model output." : "The display is not a vessel cross-section or hemodynamic simulation."}</p>
      </div>
    </section>
  );
}

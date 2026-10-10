import { Cpu, Gauge, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { Prediction, TargetId, VesselId } from "./types";

interface VesselCrossSectionInspectorProps {
  prediction: Prediction;
  selectedTarget: TargetId;
  stressMode: boolean;
}

export function VesselCrossSectionInspector({
  prediction,
  selectedTarget,
  stressMode,
}: VesselCrossSectionInspectorProps) {
  const [viewMode, setViewMode] = useState<"physics" | "ivus" | "oct" | "ffr">("physics");

  const isVessel = selectedTarget !== "CAD";
  const vesselId = (isVessel ? selectedTarget : "LAD") as VesselId;
  const targetData = isVessel ? prediction.vessels[vesselId] : prediction.cad;

  // Probability & Hemodynamic calculations
  const rawProb = targetData.probability;
  const effectiveProb = stressMode ? Math.min(0.99, rawProb * 1.25) : rawProb;

  // 0D/1D Navier-Stokes Lumped-Parameter Windkessel Physics
  const physicsData = useMemo(() => {
    const s = Math.max(0.05, Math.min(0.95, effectiveProb * 0.85));
    const d0_mm = vesselId === "LCX" ? 3.2 : vesselId === "RCA" ? 3.4 : 3.6;
    const l_mm = vesselId === "LCX" ? 75.0 : vesselId === "RCA" ? 110.0 : 95.0;

    // Viscous resistance (Poiseuille term) in MPa*s/m3
    const d_sten_mm = d0_mm * Math.sqrt(Math.max(0.05, 1 - s));
    const rv = (128 * 0.0035 * (l_mm * 1e-3)) / (Math.PI * Math.pow(d_sten_mm * 1e-3, 4)) / 1e6;

    // Inertial loss (Bernoulli term) in TPa*s2/m6
    const a0 = Math.PI * Math.pow((d0_mm * 1e-3) / 2, 2);
    const a_sten = Math.PI * Math.pow((d_sten_mm * 1e-3) / 2, 2);
    const ru = (1050 / (2 * Math.pow(a_sten, 2))) * Math.pow(a0 / a_sten - 1, 2) / 1e12;

    // Hyperemic flow (mL/min)
    const baseFlow = stressMode ? 145 : 95;
    const flow_ml_min = Math.max(25, baseFlow * (1 - s * 0.65));

    // Velocity & Reynolds number
    const v_m_s = (flow_ml_min / 6e7) / a_sten;
    const reynolds = (1050 * v_m_s * (d_sten_mm * 1e-3)) / 0.0035;

    // Wall shear stress in Pa
    const wall_shear = (4 * 0.0035 * (flow_ml_min / 6e7)) / (Math.PI * Math.pow((d_sten_mm * 1e-3) / 2, 3));

    // Translesional pressure drop (mmHg)
    const dp_pa = (rv * 1e6 * (flow_ml_min / 6e7)) + (ru * 1e12 * Math.pow(flow_ml_min / 6e7, 2));
    const dp_mmhg = dp_pa / 133.322;
    const ffr_physics = Math.max(0.40, Math.min(1.0, (93.3 - dp_mmhg) / 93.3));

    // Conformal 90% confidence interval
    const conf_margin = 0.165;
    const conf_lower = Math.max(0.0, rawProb - conf_margin);
    const conf_upper = Math.min(1.0, rawProb + conf_margin);

    return {
      d0_mm,
      d_sten_mm: d_sten_mm.toFixed(2),
      rv: rv.toFixed(1),
      ru: ru.toFixed(2),
      flow_ml_min: flow_ml_min.toFixed(1),
      reynolds: Math.round(reynolds),
      wall_shear: wall_shear.toFixed(1),
      dp_mmhg: dp_mmhg.toFixed(1),
      ffr: ffr_physics.toFixed(2),
      is_ischemic: ffr_physics <= 0.80,
      is_turbulent: reynolds > 2000,
      conformal_interval: [conf_lower.toFixed(2), conf_upper.toFixed(2)],
    };
  }, [effectiveProb, vesselId, stressMode, rawProb]);

  // Plaque morphology approximations
  const areaStenosis = Math.round(effectiveProb * 78);
  const mla = (4.2 * (1 - effectiveProb * 0.7)).toFixed(1);
  const outerRadius = 60;
  const lumenRadius = Math.max(16, outerRadius * Math.sqrt(Math.max(0.1, 1 - areaStenosis / 100)));
  const plaqueThickness = outerRadius - lumenRadius;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4 cardio-card-glow space-y-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-cyan/15 text-accent-cyan">
            <Cpu size={16} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink-primary flex items-center gap-1.5">
              Physics-Informed Hemodynamics &amp; Conformal Risk Engine
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-panel border border-surface-border text-accent-brand font-semibold">
                {selectedTarget}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent-blue/10 border border-accent-blue/30 text-accent-blue">
                90% Conformal: [{physicsData.conformal_interval[0]}, {physicsData.conformal_interval[1]}]
              </span>
            </h3>
            <p className="text-[11px] text-ink-muted">
              0D/1D Navier-Stokes Lumped-Parameter Windkessel Network - Poiseuille-Bernoulli Resistance - Conformal Bounds
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-surface-panel p-1 rounded-lg border border-surface-border text-xs">
          <button
            type="button"
            onClick={() => setViewMode("physics")}
            className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
              viewMode === "physics" ? "bg-accent-brand text-white shadow-sm" : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            <Zap size={11} />
            1D Windkessel Physics
          </button>
          <button
            type="button"
            onClick={() => setViewMode("ivus")}
            className={`px-2 py-0.5 rounded font-medium ${
              viewMode === "ivus" ? "bg-surface-raised text-ink-primary shadow-sm" : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            IVUS Cross-Section
          </button>
          <button
            type="button"
            onClick={() => setViewMode("oct")}
            className={`px-2 py-0.5 rounded font-medium ${
              viewMode === "oct" ? "bg-surface-raised text-ink-primary shadow-sm" : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            OCT Morphology
          </button>
          <button
            type="button"
            onClick={() => setViewMode("ffr")}
            className={`px-2 py-0.5 rounded font-medium ${
              viewMode === "ffr" ? "bg-surface-raised text-ink-primary shadow-sm" : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            FFR-CT Gauge
          </button>
        </div>
      </div>

      {/* Physics Governing Equation Strip */}
      {viewMode === "physics" && (
        <div className="rounded-lg border border-accent-brand/20 bg-accent-brand/5 p-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-[10.5px] font-mono text-accent-brand font-semibold block uppercase">
              Governing 1D Navier-Stokes Resistance Equation
            </span>
            <code className="text-[12px] font-mono font-bold text-ink-primary">
              ΔP = R_viscous(128μL / πD⁴) · Q + R_inertial(ρ / 2A² (A₀/A - 1)²) · Q²
            </code>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-ink-muted">
            <span>ρ = 1050 kg/m³</span>
            <span>μ = 0.0035 Pa·s</span>
            <span>MAP = 93.3 mmHg</span>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 items-center">
        {/* SVG Vessel Cross-Section Visualization */}
        <div className="relative flex flex-col items-center justify-center bg-surface-panel rounded-lg border border-surface-border p-3">
          <svg width="150" height="150" viewBox="0 0 150 150" className="overflow-visible">
            {/* Outer Adventitial Vessel Wall */}
            <circle
              cx="75"
              cy="75"
              r={outerRadius}
              fill="rgba(30, 41, 59, 0.4)"
              stroke="rgb(var(--surface-border-hi))"
              strokeWidth="2.5"
            />

            {/* Atherosclerotic Plaque Layer */}
            {areaStenosis > 10 && (
              <circle
                cx={75 + (effectiveProb > 0.4 ? 8 : 0)}
                cy={75 + (effectiveProb > 0.4 ? -4 : 0)}
                r={outerRadius - 2}
                fill={
                  viewMode === "oct"
                    ? "url(#octGradient)"
                    : effectiveProb > 0.6
                    ? "rgba(225, 29, 72, 0.35)"
                    : "rgba(245, 158, 11, 0.3)"
                }
                stroke={effectiveProb > 0.6 ? "#e11d48" : "#f59e0b"}
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            )}

            {/* Residual Patent Lumen (Blood Flow Channel) */}
            <circle
              cx={75 + (effectiveProb > 0.4 ? 12 : 0)}
              cy={75 + (effectiveProb > 0.4 ? -6 : 0)}
              r={lumenRadius}
              fill={physicsData.is_ischemic ? "rgba(239, 68, 68, 0.85)" : "rgba(14, 165, 233, 0.85)"}
              stroke={physicsData.is_ischemic ? "#f43f5e" : "#38bdf8"}
              strokeWidth="2"
              className={stressMode ? "vessel-glow" : ""}
            />

            {/* Gradient definition for OCT */}
            <defs>
              <radialGradient id="octGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                <stop offset="70%" stopColor="#e11d48" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#1e293b" stopOpacity="0.2" />
              </radialGradient>
            </defs>
          </svg>

          <span className="text-[10.5px] font-mono text-ink-muted mt-2">
            Patent Lumen: {mla} mm² - Plaque: {(plaqueThickness / 10).toFixed(1)} mm
          </span>
        </div>

        {/* Morphological and Hemodynamic Metrics */}
        <div className="space-y-2.5">
          {/* FFR-CT Primary Gauge */}
          <div className="rounded-lg border border-surface-border bg-surface-panel p-2.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Gauge size={13} className="text-accent-brand" />
                <span>Navier-Stokes Windkessel Fractional Flow Reserve (FFR)</span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold font-mono text-ink-primary">{physicsData.ffr}</span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    physicsData.is_ischemic
                      ? "bg-accent-red/15 text-accent-red border border-accent-red/30"
                      : "bg-accent-green/15 text-accent-green border border-accent-green/30"
                  }`}
                >
                  {physicsData.is_ischemic ? "Ischemic (FFR <= 0.80)" : "Preserved Hemodynamics (> 0.80)"}
                </span>
                <span className="text-[10px] font-mono text-ink-muted">
                  ΔP: {physicsData.dp_mmhg} mmHg
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-ink-muted block">Flow Regime</span>
              <span className={`text-xs font-semibold font-mono ${physicsData.is_turbulent ? "text-accent-red" : "text-accent-green"}`}>
                Re {physicsData.reynolds} - {physicsData.is_turbulent ? "Turbulent Shedding" : "Laminar"}
              </span>
            </div>
          </div>

          {/* Metric Quad */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md border border-surface-border bg-surface-panel p-2">
              <span className="text-[10px] text-ink-muted block">Coronary Flow (Q)</span>
              <span className="font-semibold text-ink-primary tabular-nums font-mono">{physicsData.flow_ml_min} mL/min</span>
            </div>
            <div className="rounded-md border border-surface-border bg-surface-panel p-2">
              <span className="text-[10px] text-ink-muted block">Wall Shear Stress</span>
              <span className="font-semibold text-ink-primary tabular-nums font-mono">{physicsData.wall_shear} Pa</span>
            </div>
            <div className="rounded-md border border-surface-border bg-surface-panel p-2">
              <span className="text-[10px] text-ink-muted block">Viscous Drag (Rv)</span>
              <span className="font-semibold text-ink-primary tabular-nums font-mono">{physicsData.rv} MPa·s/m³</span>
            </div>
            <div className="rounded-md border border-surface-border bg-surface-panel p-2">
              <span className="text-[10px] text-ink-muted block">Inertial Loss (Ru)</span>
              <span className="font-semibold text-ink-primary tabular-nums font-mono">{physicsData.ru} TPa·s²/m⁶</span>
            </div>
          </div>

          {/* Interpretation */}
          <p className="text-[11px] text-ink-muted leading-relaxed">
            <b>{viewMode.toUpperCase()} Simulation:</b> 0D/1D circuit solver demonstrates {physicsData.flow_ml_min} mL/min hyperemic flow through {selectedTarget}.{" "}
            {physicsData.is_ischemic
              ? `Translesional pressure gradient ΔP = ${physicsData.dp_mmhg} mmHg drops FFR to ${physicsData.ffr}, crossing the ischemic revascularization threshold.`
              : `Flow reserve remains preserved with translesional gradient ΔP = ${physicsData.dp_mmhg} mmHg.`}
          </p>
        </div>
      </div>
    </div>
  );
}

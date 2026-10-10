import { Activity, AlertCircle, Flame, Heart, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import type { PatientValues, Prediction, TargetId } from "./types";

interface CardioTelemetryHUDProps {
  patient: PatientValues;
  prediction: Prediction | null;
  selectedTarget: TargetId;
  stressMode: boolean;
  onToggleStress: (active: boolean) => void;
}

export function CardioTelemetryHUD({
  patient,
  prediction,
  selectedTarget,
  stressMode,
  onToggleStress,
}: CardioTelemetryHUDProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Extract or default physiological parameters
  const baseHr = typeof patient.thalach === "number" ? patient.thalach : 72;
  const restingBp = typeof patient.trestbps === "number" ? patient.trestbps : 124;
  const dbp = Math.round(restingBp * 0.65); // Standard diastolic approximation

  // Stress state modulates hemodynamics
  const currentHr = stressMode ? Math.round(baseHr * 1.42) : baseHr;
  const sbp = stressMode ? Math.round(restingBp * 1.25) : restingBp;
  const currentDbp = stressMode ? Math.round(dbp * 1.08) : dbp;

  // Hemodynamic derivations
  const map = Math.round(currentDbp + (sbp - currentDbp) / 3);
  const strokeVolume = Math.round(75 * (stressMode ? 1.15 : 1.0)); // mL
  const cardiacOutput = ((currentHr * strokeVolume) / 1000).toFixed(1); // L/min
  const rpp = Math.round((currentHr * sbp) / 100); // Rate Pressure Product (MVO2 proxy)
  const cpp = Math.max(25, currentDbp - 12); // Coronary Perfusion Pressure (DBP - LVEDP)

  // Myocardial workload status
  const mvo2Tier = rpp > 220 ? "High Demand" : rpp > 140 ? "Elevated" : "Optimal";
  const mvo2Color = rpp > 220 ? "text-accent-red" : rpp > 140 ? "text-accent-amber" : "text-accent-green";

  // ECG Canvas Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;
    const width = canvas.width;
    const height = canvas.height;
    const points: number[] = new Array(width).fill(height / 2);

    // ECG waveform synthesis (P-wave, QRS complex, T-wave)
    const getEcgSample = (phase: number): number => {
      // phase: 0 to 1
      const mid = height / 2;
      const amp = stressMode ? 1.3 : 1.0;

      // P wave (0.15 - 0.25)
      if (phase >= 0.15 && phase < 0.25) {
        return mid - Math.sin((phase - 0.15) * 10 * Math.PI) * 7 * amp;
      }
      // Q wave (0.33 - 0.36)
      if (phase >= 0.33 && phase < 0.36) {
        return mid + Math.sin((phase - 0.33) * 33.3 * Math.PI) * 6 * amp;
      }
      // R wave spike (0.36 - 0.42)
      if (phase >= 0.36 && phase < 0.42) {
        return mid - Math.sin((phase - 0.36) * 16.6 * Math.PI) * 38 * amp;
      }
      // S wave dip (0.42 - 0.46)
      if (phase >= 0.42 && phase < 0.46) {
        return mid + Math.sin((phase - 0.42) * 25 * Math.PI) * 11 * amp;
      }
      // T wave (0.55 - 0.72)
      if (phase >= 0.55 && phase < 0.72) {
        return mid - Math.sin((phase - 0.55) * 5.88 * Math.PI) * 12 * amp;
      }
      return mid + (Math.random() - 0.5) * 1.5; // subtle physiological baseline noise
    };

    const render = () => {
      // Advance by heart rate speed
      const speed = (currentHr / 60) * 0.016; // fraction of cycle per frame
      t = (t + speed) % 1;

      // Shift points
      points.shift();
      points.push(getEcgSample(t));

      ctx.clearRect(0, 0, width, height);

      // Grid background
      ctx.strokeStyle = "rgba(100, 116, 139, 0.15)";
      ctx.lineWidth = 1;
      const gridSize = 16;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // ECG trace
      ctx.strokeStyle = stressMode ? "#f43f5e" : "#10b981";
      ctx.lineWidth = 2;
      ctx.shadowColor = stressMode ? "rgba(244, 63, 94, 0.6)" : "rgba(16, 185, 129, 0.5)";
      ctx.shadowBlur = 6;
      ctx.beginPath();

      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(i, points[i]);
        else ctx.lineTo(i, points[i]);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Scanning leading pip
      const leadX = points.length - 1;
      const leadY = points[leadX];
      ctx.fillStyle = stressMode ? "#fff1f2" : "#a7f3d0";
      ctx.beginPath();
      ctx.arc(leadX, leadY, 3, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [currentHr, stressMode]);

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4 cardio-card-glow space-y-3.5">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-brand/10 text-accent-brand">
            <Activity size={16} className="cardiac-pulse" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink-primary flex items-center gap-1.5">
              Hemodynamic Bio-HUD &amp; ECG Telemetry
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-panel border border-surface-border text-ink-muted">
                Lead II · Synchronized
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent-brand/10 border border-accent-brand/30 text-accent-brand font-semibold">
                Focus: {selectedTarget} {prediction ? `(${(selectedTarget === "CAD" ? prediction.cad.probability * 100 : prediction.vessels[selectedTarget as "LAD" | "LCX" | "RCA"].probability * 100).toFixed(0)}%)` : ""}
              </span>
            </h2>
            <p className="text-[11px] text-ink-muted">
              Real-time physiological telemetry, coronary perfusion indices &amp; inotropic challenge testing
            </p>
          </div>
        </div>

        {/* Stress Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-surface-panel p-1 rounded-lg border border-surface-border">
          <button
            type="button"
            onClick={() => onToggleStress(false)}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
              !stressMode
                ? "bg-surface-raised text-ink-primary shadow-sm border border-surface-border"
                : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            Resting Baseline
          </button>
          <button
            type="button"
            onClick={() => onToggleStress(true)}
            className={`px-2.5 py-1 text-xs rounded-md font-medium flex items-center gap-1 transition-all ${
              stressMode
                ? "bg-accent-brand text-white shadow-sm"
                : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            <Flame size={12} className={stressMode ? "animate-pulse" : ""} />
            Dobutamine Stress Test
          </button>
        </div>
      </div>

      {/* Main Grid: Waveform & Metric Tiles */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* ECG Waveform Canvas */}
        <div className="relative rounded-lg border border-surface-border bg-surface-panel overflow-hidden p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-ink-muted mb-1 px-1">
            <span className="flex items-center gap-1 font-mono">
              <span className={`inline-block h-2 w-2 rounded-full ${stressMode ? "bg-accent-brand animate-ping" : "bg-accent-green"}`} />
              {stressMode ? "INOTROPIC HYPEREMIA · 140% WORKLOAD" : "NORMAL SINUS RHYTHM"}
            </span>
            <span className="font-mono text-[10.5px]">25 mm/s · 10 mm/mV</span>
          </div>

          <canvas
            ref={canvasRef}
            width={480}
            height={110}
            className="w-full h-[110px] rounded block"
          />

          <div className="flex items-center justify-between text-[10.5px] text-ink-muted mt-1 px-1 font-mono">
            <span>HR: {currentHr} BPM</span>
            <span>BP: {sbp}/{currentDbp} mmHg</span>
            <span>Q: {cardiacOutput} L/min</span>
          </div>
        </div>

        {/* Vital Metric Cards */}
        <div className="grid grid-cols-2 gap-2">
          {/* Heart Rate */}
          <div className="rounded-lg border border-surface-border bg-surface-panel p-2.5">
            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span>Heart Rate</span>
              <Heart size={13} className="text-accent-brand cardiac-pulse" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold tabular-nums text-ink-primary">{currentHr}</span>
              <span className="text-[11px] text-ink-muted">BPM</span>
            </div>
            <p className="text-[10px] text-ink-muted mt-0.5">
              {stressMode ? "Simulated max effort" : "Resting baseline"}
            </p>
          </div>

          {/* Blood Pressure & MAP */}
          <div className="rounded-lg border border-surface-border bg-surface-panel p-2.5">
            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span>Arterial Pressure</span>
              <Activity size={13} className="text-accent-cyan" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold tabular-nums text-ink-primary">{sbp}/{currentDbp}</span>
              <span className="text-[10px] text-ink-muted font-mono">MAP {map}</span>
            </div>
            <p className="text-[10px] text-ink-muted mt-0.5">
              Perfusion index: {map >= 65 ? "Adequate" : "Marginal"}
            </p>
          </div>

          {/* Coronary Perfusion Pressure */}
          <div className="rounded-lg border border-surface-border bg-surface-panel p-2.5">
            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span>Coronary Perfusion (CPP)</span>
              <Zap size={13} className="text-accent-blue" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold tabular-nums text-ink-primary">{cpp}</span>
              <span className="text-[11px] text-ink-muted">mmHg</span>
            </div>
            <p className="text-[10px] text-ink-muted mt-0.5">
              DBP − estimated LVEDP (12)
            </p>
          </div>

          {/* Rate-Pressure Product / MVO2 */}
          <div className="rounded-lg border border-surface-border bg-surface-panel p-2.5">
            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span>Myocardial O₂ (MVO₂)</span>
              <AlertCircle size={13} className={mvo2Color} />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold tabular-nums text-ink-primary">{rpp}</span>
              <span className={`text-[10px] font-semibold ${mvo2Color}`}>{mvo2Tier}</span>
            </div>
            <p className="text-[10px] text-ink-muted mt-0.5">
              Rate-Pressure Product index
            </p>
          </div>
        </div>
      </div>

      {/* Stress Test Clinical Note */}
      {stressMode && (
        <div className="flex items-center gap-2 rounded-lg bg-accent-brand/10 border border-accent-brand/30 px-3 py-2 text-[11.5px] text-ink-primary">
          <Flame size={14} className="text-accent-brand shrink-0" />
          <span>
            <b>Inotropic Stress Challenge Active:</b> Myocardial oxygen demand increased by 42%. Look at the vessel probabilities below to evaluate exercise-induced ischemic vulnerability.
          </span>
        </div>
      )}
    </div>
  );
}

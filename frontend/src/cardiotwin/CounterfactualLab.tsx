import { useCallback, useState } from "react";
import { cardio } from "./api";

/* ─── Types ─────────────────────────────────────────────── */
interface SweepPoint {
  sweep_param_value: number;
  ffr: number;
  distal_pressure_mmhg: number;
  flow_rate_ml_min: number;
  translesional_dp_mmhg: number;
  reynolds_number: number;
  wall_shear_stress_pa: number;
  is_ischemic: boolean;
}

interface SensitivityEntry {
  parameter: string;
  unit: string;
  center_value: number;
  local_derivative: number;
  elasticity: number;
  abs_elasticity: number;
  interpretation: string;
}

const VESSELS = ["LAD", "LCX", "RCA"] as const;
const SWEEP_PARAMS = [
  { value: "stenosis_pct", label: "Stenosis %", unit: "%" },
  { value: "mean_aortic_pressure_mmhg", label: "Aortic Pressure", unit: "mmHg" },
  { value: "hyperemia_factor", label: "Hyperemia Factor", unit: "x" },
  { value: "vessel_diameter_mm", label: "Vessel Diameter", unit: "mm" },
  { value: "lesion_length_mm", label: "Lesion Length", unit: "mm" },
  { value: "blood_viscosity_pa_s", label: "Blood Viscosity", unit: "Pa.s" },
] as const;

/* ─── BarChart ──────────────────────────────────────────── */
function MiniBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, Math.max(0, (Math.abs(value) / Math.max(max, 0.001)) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{ width: 200, fontSize: 11, color: "#9aa8b8", textAlign: "right", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 18, background: "rgba(255,255,255,.04)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width .3s ease" }} />
      </div>
      <span style={{ width: 70, fontSize: 11, color: "#cdf", textAlign: "right", fontFamily: "monospace" }}>
        {value.toFixed(4)}
      </span>
    </div>
  );
}

/* ─── SweepChart (mini SVG sparkline) ───────────────────── */
function SweepSparkline({ points, xKey, yKey, color, ischemic }: {
  points: SweepPoint[];
  xKey: keyof SweepPoint;
  yKey: keyof SweepPoint;
  color: string;
  ischemic?: number;
}) {
  if (points.length < 2) return null;
  const W = 320, H = 100, pad = 8;
  const xs = points.map(p => Number(p[xKey]));
  const ys = points.map(p => Number(p[yKey]));
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const sx = (v: number) => pad + ((v - xMin) / Math.max(xMax - xMin, 1e-9)) * (W - 2 * pad);
  const sy = (v: number) => H - pad - ((v - yMin) / Math.max(yMax - yMin, 1e-9)) * (H - 2 * pad);

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(Number(p[xKey]))},${sy(Number(p[yKey]))}`).join(" ");

  return (
    <svg width={W} height={H} style={{ background: "rgba(0,0,0,.2)", borderRadius: 8, border: "1px solid rgba(136,170,255,.08)" }}>
      {ischemic !== undefined && (
        <line x1={pad} x2={W - pad} y1={sy(ischemic)} y2={sy(ischemic)}
          stroke="#f44" strokeWidth={1} strokeDasharray="4,4" opacity={0.6} />
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={i} cx={sx(Number(p[xKey]))} cy={sy(Number(p[yKey]))} r={3}
          fill={p.is_ischemic ? "#f44" : color} stroke="rgba(0,0,0,.4)" strokeWidth={1} />
      ))}
    </svg>
  );
}

/* ─── Main Component ────────────────────────────────────── */
export default function CounterfactualLab() {
  const [vessel, setVessel] = useState<string>("LAD");
  const [sweepParam, setSweepParam] = useState<string>("stenosis_pct");
  const [sweepResults, setSweepResults] = useState<SweepPoint[]>([]);
  const [sensitivities, setSensitivities] = useState<SensitivityEntry[]>([]);
  const [baselineStenosis, setBaselineStenosis] = useState(70);
  const [interventionStenosis, setInterventionStenosis] = useState(20);
  const [compareResult, setCompareResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState("");
  const [activeTab, setActiveTab] = useState<"sweep" | "sensitivity" | "scenario">("sweep");

  const runSweep = useCallback(async () => {
    setLoading("Running parameter sweep...");
    try {
      const r = await cardio.counterfactualSweep(vessel, sweepParam, 15) as Record<string, unknown>;
      setSweepResults((r.sweep_results as SweepPoint[]) ?? []);
    } catch { /* ignore */ }
    setLoading("");
  }, [vessel, sweepParam]);

  const runSensitivity = useCallback(async () => {
    setLoading("Computing sensitivity analysis...");
    try {
      const r = await cardio.counterfactualSensitivity(vessel, { stenosis_pct: baselineStenosis }) as Record<string, unknown>;
      setSensitivities((r.sensitivities as SensitivityEntry[]) ?? []);
    } catch { /* ignore */ }
    setLoading("");
  }, [vessel, baselineStenosis]);

  const runCompare = useCallback(async () => {
    setLoading("Comparing scenarios...");
    try {
      const r = await cardio.counterfactualCompare(
        vessel,
        { stenosis_pct: baselineStenosis },
        { stenosis_pct: interventionStenosis },
      );
      setCompareResult(r);
    } catch { /* ignore */ }
    setLoading("");
  }, [vessel, baselineStenosis, interventionStenosis]);

  const sweepInfo = SWEEP_PARAMS.find(p => p.value === sweepParam);
  const maxElast = sensitivities.length ? Math.max(...sensitivities.map(s => s.abs_elasticity)) : 1;

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(14,18,28,.95), rgba(20,28,44,.95))",
      borderRadius: 16, padding: 24, color: "#e0e6ed",
      border: "1px solid rgba(136,170,255,.1)",
      boxShadow: "0 8px 32px rgba(0,0,0,.4)",
    }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "#8af" }}>
        {"\uD83E\uDDEA"} Counterfactual Hemodynamic Laboratory
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: "#7a8a9f" }}>
        0D/1D Poiseuille-Bernoulli Windkessel solver with parameter sweeps, sensitivity analysis, and scenario comparison
      </p>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <label style={labelStyle}>
          Vessel
          <select value={vessel} onChange={e => setVessel(e.target.value)} style={selectStyle}>
            {VESSELS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, alignSelf: "flex-end" }}>
          {(["sweep", "sensitivity", "scenario"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: activeTab === t ? "rgba(136,170,255,.2)" : "rgba(255,255,255,.04)",
              color: activeTab === t ? "#8af" : "#7a8a9f",
              fontWeight: 700, fontSize: 12, transition: "all .2s",
            }}>
              {t === "sweep" ? "\uD83D\uDCC8 Sweep" : t === "sensitivity" ? "\uD83C\uDFAF Sensitivity" : "\u2696\uFE0F Scenario"}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 16, textAlign: "center", color: "#8af", fontSize: 13 }}>{loading}</div>
      )}

      {/* Sweep Tab */}
      {activeTab === "sweep" && (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
            <label style={labelStyle}>
              Parameter
              <select value={sweepParam} onChange={e => setSweepParam(e.target.value)} style={selectStyle}>
                {SWEEP_PARAMS.map(p => <option key={p.value} value={p.value}>{p.label} ({p.unit})</option>)}
              </select>
            </label>
            <button onClick={runSweep} disabled={!!loading} style={runBtnStyle}>Run Sweep</button>
          </div>

          {sweepResults.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "#7a8a9f", marginBottom: 8, fontWeight: 600 }}>
                  FFR vs {sweepInfo?.label ?? sweepParam}
                </div>
                <SweepSparkline points={sweepResults} xKey="sweep_param_value" yKey="ffr" color="#4488ff" ischemic={0.80} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#7a8a9f", marginBottom: 8, fontWeight: 600 }}>
                  Wall Shear Stress vs {sweepInfo?.label ?? sweepParam}
                </div>
                <SweepSparkline points={sweepResults} xKey="sweep_param_value" yKey="wall_shear_stress_pa" color="#0d9" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#7a8a9f", marginBottom: 8, fontWeight: 600 }}>
                  Pressure Drop vs {sweepInfo?.label ?? sweepParam}
                </div>
                <SweepSparkline points={sweepResults} xKey="sweep_param_value" yKey="translesional_dp_mmhg" color="#fa0" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#7a8a9f", marginBottom: 8, fontWeight: 600 }}>
                  Flow Rate vs {sweepInfo?.label ?? sweepParam}
                </div>
                <SweepSparkline points={sweepResults} xKey="sweep_param_value" yKey="flow_rate_ml_min" color="#a855f7" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sensitivity Tab */}
      {activeTab === "sensitivity" && (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
            <label style={labelStyle}>
              Baseline Stenosis (%)
              <input type="number" value={baselineStenosis} onChange={e => setBaselineStenosis(Number(e.target.value))}
                min={0} max={95} style={inputStyle} />
            </label>
            <button onClick={runSensitivity} disabled={!!loading} style={runBtnStyle}>Analyze Sensitivity</button>
          </div>

          {sensitivities.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: "#7a8a9f", marginBottom: 12, fontWeight: 600 }}>
                FFR Elasticity (ranked by |dFFR/FFR| / |dX/X|)
              </div>
              {sensitivities.map((s, i) => (
                <MiniBar
                  key={i}
                  value={s.abs_elasticity}
                  max={maxElast}
                  color={s.interpretation === "DOMINANT" ? "#f44" : s.interpretation === "SIGNIFICANT" ? "#fa0" : "#4488ff"}
                  label={`${s.parameter} (${s.unit})`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scenario Tab */}
      {activeTab === "scenario" && (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
            <label style={labelStyle}>
              Baseline Stenosis (%)
              <input type="number" value={baselineStenosis} onChange={e => setBaselineStenosis(Number(e.target.value))}
                min={0} max={95} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Post-PCI Stenosis (%)
              <input type="number" value={interventionStenosis} onChange={e => setInterventionStenosis(Number(e.target.value))}
                min={0} max={95} style={inputStyle} />
            </label>
            <button onClick={runCompare} disabled={!!loading} style={runBtnStyle}>Compare Scenarios</button>
          </div>

          {compareResult && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {Object.entries((compareResult as Record<string, unknown>).output_deltas as Record<string, Record<string, number>>).map(([key, delta]) => (
                <div key={key} style={{
                  background: "rgba(255,255,255,.03)", padding: 14, borderRadius: 10,
                  border: "1px solid rgba(255,255,255,.06)",
                }}>
                  <div style={{ fontSize: 11, color: "#7a8a9f", textTransform: "uppercase", fontWeight: 700 }}>{key.replace(/_/g, " ")}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#7a8a9f" }}>Baseline</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#e0e6ed" }}>{delta.baseline}</div>
                    </div>
                    <div style={{ fontSize: 20, color: delta.absolute_change > 0 ? "#0d9" : "#f44", alignSelf: "center" }}>
                      {delta.absolute_change > 0 ? "\u2191" : "\u2193"}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#7a8a9f" }}>Post-PCI</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#8af" }}>{delta.intervention}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: delta.pct_change > 0 ? "#0d9" : "#f44", marginTop: 4, textAlign: "center" }}>
                    {delta.pct_change > 0 ? "+" : ""}{delta.pct_change}%
                  </div>
                </div>
              ))}
            </div>
          )}

          {compareResult && (
            <div style={{
              marginTop: 12, padding: 10, borderRadius: 8, fontSize: 11,
              color: "#fa0", background: "rgba(255,170,0,.06)",
              border: "1px solid rgba(255,170,0,.15)",
            }}>
              {"\u26A0\uFE0F"} {((compareResult as Record<string, unknown>).model_disclaimer as string) ?? "Reduced-order simulation only"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 4,
  fontSize: 11, color: "#7a8a9f", fontWeight: 600,
};
const selectStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(136,170,255,.15)",
  background: "rgba(255,255,255,.04)", color: "#e0e6ed", fontSize: 13,
};
const inputStyle: React.CSSProperties = {
  ...selectStyle, width: 100,
};
const runBtnStyle: React.CSSProperties = {
  padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
  background: "linear-gradient(135deg, #4488ff, #6644ff)", color: "#fff",
  fontWeight: 700, fontSize: 13,
};

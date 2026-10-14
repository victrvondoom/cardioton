/**
 * /iit-mandi — IIT Mandi Track A demonstration:
 * "Cardiovascular Risk Visualization & Prediction".
 *
 * One complete, reproducible experience:
 *  1. Select a synthetic patient.
 *  2. Load their physiological and clinical information.
 *  3. Run the actual CardioTwin CAD model with multimodal fusion (real backend inference).
 *  4. Display CAD probability with the model's limitations.
 *  5. Open the interactive 3D heart with vessel-level probability overlays.
 *  6. Inspect the per-modality evidence and feature contributions.
 *  7. Compare the documented historical scenario against a hypothetical one.
 *  8. Export a reproducible research report (JSON with all payloads).
 *
 * Clinical honesty rules (same as /cardiotwin):
 *  - vessel colour encodes ESTIMATED PROBABILITY, never a diagnosed stenosis;
 *  - the generic 3D heart is reference anatomy, not the patient's true anatomy;
 *  - synthetic patients only; no clinical validation claims.
 */
import { Download, Loader2, Play } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";

import { CARD, SafetyBanner } from "../cardiotwin/core__src_cardiotwin__panels";
import { VESSELS, type VesselId, type VesselViz } from "../cardiotwin/core__src_cardiotwin__types";
import { BAND_LABEL, bandFor, pct, signedPct } from "../cardiotwin/vesselMapping";
import { IitMandiError, iitMandiApi, type IitMandiDemonstration, type IitMandiScenario } from "../cardiotwin/iitMandiApi";

const HeartViewer = lazy(() => import("../cardiotwin/core__src_cardiotwin__HeartViewer"));

const CONFIDENCE: Record<string, "low" | "moderate" | "high"> = { low: "low", moderate: "moderate", high: "high" };

function vizFromDemonstration(d: IitMandiDemonstration | null): Record<VesselId, VesselViz> | null {
  if (!d) return null;
  const confidence = CONFIDENCE[d.prediction.confidence] ?? "low";
  const halo = Math.min(1, d.prediction.uncertainty.fused);
  return Object.fromEntries(
    VESSELS.map((id) => {
      const probability = d.prediction.fused_predictions[`${id.toLowerCase()}_probability` as "lad_probability"];
      return [id, { id, probability, band: bandFor(probability), confidence, halo }];
    }),
  ) as Record<VesselId, VesselViz>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className={`${CARD} p-4 space-y-2`} aria-labelledby={`mandi-step-${n}`}>
      <h2 id={`mandi-step-${n}`} className="text-[13px] font-semibold text-ink-primary">
        <span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full bg-accent-cyan/15 text-[10px] text-accent-cyan">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function IitMandiDemo() {
  const [scenarios, setScenarios] = useState<IitMandiScenario[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [demo, setDemo] = useState<IitMandiDemonstration | null>(null);
  const [compare, setCompare] = useState<IitMandiDemonstration | null>(null);
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<VesselId | null>(null);
  const [reportBlobUrl, setReportBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    iitMandiApi
      .scenarios()
      .then((res) => {
        if (cancelled) return;
        setScenarios(res.scenarios);
        const initial = res.scenarios.find((s) => s.id === "high_risk_65m") ?? res.scenarios[0];
        setSelectedId(initial?.id ?? null);
        setCompareId(res.scenarios.find((s) => s.id !== initial?.id)?.id ?? null);
      })
      .catch((e) => !cancelled && setLoadError(e instanceof IitMandiError ? e.message : "Failed to load scenarios"));
    return () => {
      cancelled = true;
    };
  }, []);

  const runDemonstration = useCallback(async (scenarioId: string, which: "main" | "compare") => {
    setBusy(true);
    setRunError(null);
    try {
      const result = await iitMandiApi.demonstration(scenarioId);
      if (which === "main") {
        setDemo(result);
        setSelectedVessel(null);
        const top = VESSELS.reduce((a, b) =>
          result.prediction.fused_predictions[`${a.toLowerCase()}_probability` as "lad_probability"] >=
          result.prediction.fused_predictions[`${b.toLowerCase()}_probability` as "lad_probability"] ? a : b);
        setSelectedVessel(top);
      } else {
        setCompare(result);
      }
    } catch (e) {
      setRunError(e instanceof IitMandiError ? e.message : "Demonstration failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId && !demo) void runDemonstration(selectedId, "main");
  }, [selectedId, demo, runDemonstration]);

  const viz = useMemo(() => vizFromDemonstration(demo), [demo]);

  const downloadReport = () => {
    if (!demo) return;
    const report = {
      report_type: "iit_mandi_track_a_demonstration",
      generated_at: new Date().toISOString(),
      synthetic_patient_only: true,
      notice: "Research demonstration. The CardioTwin model estimates probabilities from tabular clinical features; it is not a diagnosis and does not localise, size or characterise any lesion.",
      scenario: demo.scenario,
      prediction: demo.prediction,
      visualization: demo.visualization,
      comparison: compare ? { scenario: compare.scenario, prediction: compare.prediction } : null,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    setReportBlobUrl(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const scenario = demo?.scenario ?? scenarios.find((s) => s.id === selectedId) ?? null;
  const fused = demo?.prediction.fused_predictions;

  return (
    <div className="px-4 sm:px-6 py-6 space-y-4 max-w-[1300px] mx-auto">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-cyan">IIT MANDI TRACK A · CARDIOVASCULAR RISK VISUALIZATION &amp; PREDICTION</p>
        <h1 className="text-2xl font-semibold text-ink-primary">Complete demonstration — synthetic patient to 3D risk view</h1>
        <SafetyBanner compact />
      </header>

      {loadError && <div role="alert" className="rounded-lg border border-accent-red/50 bg-accent-red/10 px-3 py-2 text-[12.5px]">{loadError}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Step n={1} title="Select a synthetic patient">
          <div className="grid gap-2 sm:grid-cols-2" data-testid="mandi-scenarios">
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                aria-pressed={s.id === selectedId}
                className={`rounded-lg border p-2.5 text-left text-[12px] transition-colors ${s.id === selectedId ? "border-accent-cyan bg-accent-cyan/10" : "border-surface-border hover:border-accent-cyan/40"}`}
              >
                <span className="font-semibold text-ink-primary">{s.name}</span>
                <span className="block text-[11px] text-ink-muted mt-0.5">{s.description}</span>
                <span className="block text-[10.5px] text-ink-faint mt-0.5">{s.metadata.age}y {s.metadata.sex} · focus: {s.focus_areas.join(", ")}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => selectedId && runDemonstration(selectedId, "main")}
            disabled={!selectedId || busy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1.5 text-[12px] text-accent-cyan disabled:opacity-40 hover:bg-accent-cyan/15"
            data-testid="mandi-run"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Run prediction on selected patient
          </button>
        </Step>

        <Step n={2} title="Physiological &amp; clinical information (synthetic)">
          {scenario ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]" data-testid="mandi-patient">
              <div><dt className="text-[10.5px] uppercase text-ink-faint">Age / Sex</dt><dd className="text-ink-primary">{scenario.metadata.age} · {scenario.metadata.sex}</dd></div>
              <div><dt className="text-[10.5px] uppercase text-ink-faint">ECG scenario</dt><dd className="text-ink-primary">{scenario.ecg.scenario} @ {scenario.ecg.heart_rate} bpm</dd></div>
              <div><dt className="text-[10.5px] uppercase text-ink-faint">Wearable stream</dt><dd className="text-ink-primary">{scenario.wearable.scenario} · {scenario.wearable.duration}s</dd></div>
              <div><dt className="text-[10.5px] uppercase text-ink-faint">EHR features</dt><dd className="text-ink-primary">{Object.keys(scenario.ehr_data).length} features</dd></div>
              {Object.entries(scenario.ehr_data).slice(0, 10).map(([k, v]) => (
                <div key={k} className="col-span-2 flex justify-between border-t border-surface-border/40 pt-0.5">
                  <dt className="text-ink-muted">{k}</dt><dd className="tabular-nums text-ink-primary">{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[12px] text-ink-muted" aria-live="polite">Loading patient data…</p>
          )}
        </Step>
      </div>

      <Step n={3} title="CAD prediction (real CardioTwin model + multimodal fusion)">
        {runError && <div role="alert" className="rounded-lg border border-accent-red/50 bg-accent-red/10 px-3 py-2 text-[12.5px]">{runError}</div>}
        {!demo && !runError && <p className="text-[12px] text-ink-muted" aria-live="polite">Running model…</p>}
        {fused && (
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]" data-testid="mandi-prediction">
            <div className="grid place-items-center rounded-xl border border-surface-border p-4">
              <div
                className="grid h-28 w-28 place-items-center rounded-full border-4 tabular-nums"
                style={{
                  borderColor: fused.cad_probability >= 0.66 ? "#c8102e" : fused.cad_probability >= 0.33 ? "#f2a900" : "#8aa1b5",
                }}
                role="img"
                aria-label={`Estimated CAD probability ${pct(fused.cad_probability)}`}
              >
                <span className="text-2xl font-semibold text-ink-primary">{pct(fused.cad_probability)}</span>
                <span className="text-[10px] uppercase tracking-wide text-ink-faint">CAD probability</span>
              </div>
            </div>
            <div className="space-y-1.5 text-[12px]">
              <p className="text-ink-body">
                Per-vessel estimates:{" "}
                {VESSELS.map((v) => (
                  <span key={v} className="mr-3 tabular-nums">
                    <b>{v}</b> {pct(fused[`${v.toLowerCase()}_probability` as "lad_probability"])}
                  </span>
                ))}
              </p>
              <p className="text-ink-muted">
                Confidence <b>{demo.prediction.confidence}</b> · fused uncertainty {pct(demo.prediction.uncertainty.fused, 1)} ·
                modality disagreement {pct(demo.prediction.uncertainty.modality_disagreement, 1)} ·
                modalities present: {demo.prediction.available_modalities.join(", ") || "—"}
                {demo.prediction.missing_modalities.length > 0 && <> (missing: {demo.prediction.missing_modalities.join(", ")})</>}
              </p>
              <p className="text-ink-muted">
                Arrhythmia estimates: AFib {pct(fused.afib_probability)} · VTach {pct(fused.vtach_probability)}
              </p>
              <p className="text-[11px] text-ink-faint border-t border-surface-border/60 pt-1.5" data-testid="mandi-limitations">
                <b>Model limitations.</b> Logistic regression over tabular clinical features (synthetic cohort scenario data).
                A probability is not a diagnosis; it does not localise, size or characterise any lesion. Bands are visual
                groupings, not clinical thresholds. Reference anatomy below is a generic model, not this patient's true anatomy.
              </p>
            </div>
          </div>
        )}
      </Step>

      <Step n={4} title="Interactive 3D heart — vessel-level probability overlays">
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-surface-border bg-surface-panel/40 min-h-[420px] relative overflow-hidden">
            <Suspense fallback={<div className="grid h-[420px] place-items-center text-[12px] text-ink-muted">Loading 3D heart…</div>}>
              {viz ? (
                <HeartViewer viz={viz} selected={selectedVessel} onSelect={setSelectedVessel} />
              ) : (
                <div className="grid h-[420px] place-items-center text-[12px] text-ink-muted">Run the prediction to display the 3D view.</div>
              )}
            </Suspense>
          </div>
          <div className="space-y-2 text-[12px]">
            <p className="text-[11px] text-ink-muted">
              Colour encodes the model's <b>estimated probability</b> per vessel (neutral → amber → red). It never means
              "diagnosed stenosis"; the tube geometry is identical in all states. Select a vessel to inspect its numbers.
            </p>
            {fused && (
              <ul className="space-y-1.5" data-testid="mandi-vessels">
                {VESSELS.map((v) => {
                  const p = fused[`${v.toLowerCase()}_probability` as "lad_probability"];
                  return (
                    <li key={v}>
                      <button
                        onClick={() => setSelectedVessel(v)}
                        aria-pressed={selectedVessel === v}
                        className={`w-full rounded-lg border p-2 text-left ${selectedVessel === v ? "border-accent-cyan bg-accent-cyan/10" : "border-surface-border hover:border-accent-cyan/40"}`}
                      >
                        <span className="flex justify-between font-semibold text-ink-primary">
                          <span>{v}</span>
                          <span className="tabular-nums">{pct(p)} ({BAND_LABEL[bandFor(p)]})</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Step>

      <Step n={5} title="Multimodal evidence inspection">
        {demo ? (
          <div className="grid gap-3 sm:grid-cols-3" data-testid="mandi-modalities">
            {(Object.entries(demo.prediction.individual_predictions) as [string, typeof demo.prediction.individual_predictions.ehr][]).map(([modality, m]) => (
              <div key={modality} className="rounded-lg border border-surface-border p-2.5 text-[11.5px] space-y-1">
                <p className="font-semibold text-ink-primary uppercase tracking-wide">{modality} {m.data_present ? "" : "(absent)"}</p>
                <p className="text-ink-muted">CAD {pct(m.cad_probability)} · AFib {pct(m.afib_probability)} · VTach {pct(m.vtach_probability)}</p>
                <p className="text-ink-muted">Vessels: {VESSELS.map((v) => `${v} ${pct(m[`${v.toLowerCase()}_probability` as "lad_probability"])}`).join(" · ")}</p>
                <p className="text-ink-muted">Confidence {m.confidence} · uncertainty {pct(m.uncertainty, 1)}</p>
                <p className="text-[10.5px] text-ink-faint">
                  Contributing features: {Object.keys(m.contributing_features).slice(0, 6).join(", ") || "—"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-ink-muted">Run the prediction to inspect modality evidence.</p>
        )}
      </Step>

      <Step n={6} title="Compare documented scenario vs hypothetical scenario">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <label className="inline-flex items-center gap-1.5">
            <span className="text-ink-muted">Compare against</span>
            <select
              value={compareId ?? ""}
              onChange={(e) => setCompareId(e.target.value)}
              className="rounded border border-surface-border bg-surface-panel px-2 py-1 text-[11.5px]"
              aria-label="Hypothetical comparison scenario"
            >
              {scenarios.filter((s) => s.id !== selectedId).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => compareId && runDemonstration(compareId, "compare")}
            disabled={!compareId || busy}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-[12px] disabled:opacity-40 hover:border-accent-cyan/40"
            data-testid="mandi-compare-run"
          >
            Run hypothetical scenario
          </button>
        </div>
        {demo && compare && (
          <table className="w-full text-[12px]" data-testid="mandi-comparison">
            <thead>
              <tr className="text-left text-[10.5px] uppercase text-ink-faint">
                <th className="px-2 py-1">Output</th>
                <th className="px-2 py-1">{demo.scenario.name} (documented)</th>
                <th className="px-2 py-1">{compare.scenario.name} (hypothetical)</th>
                <th className="px-2 py-1">Delta</th>
              </tr>
            </thead>
            <tbody>
              {(["cad", "lad", "lcx", "rca", "afib"] as const).map((k) => {
                const key = `${k === "cad" ? "cad" : k === "afib" ? "afib" : k}_probability` as "cad_probability";
                const a = demo.prediction.fused_predictions[key];
                const b = compare.prediction.fused_predictions[key];
                return (
                  <tr key={k} className="border-t border-surface-border/60">
                    <td className="px-2 py-1 font-medium text-ink-primary uppercase">{k}</td>
                    <td className="px-2 py-1 tabular-nums">{pct(a)}</td>
                    <td className="px-2 py-1 tabular-nums">{pct(b)}</td>
                    <td className="px-2 py-1 tabular-nums">{signedPct(b - a)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {demo && !compare && <p className="text-[11.5px] text-ink-muted">Run a hypothetical scenario to compare model outputs side by side.</p>}
      </Step>

      <Step n={7} title="Reproducible research report">
        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          <button
            onClick={downloadReport}
            disabled={!demo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1.5 text-accent-cyan disabled:opacity-40 hover:bg-accent-cyan/15"
            data-testid="mandi-report"
          >
            <Download size={13} /> Generate report (JSON)
          </button>
          {reportBlobUrl && (
            <a href={reportBlobUrl} download={`iit-mandi-track-a-${demo?.scenario.id ?? "demo"}.json`} className="text-accent-cyan underline">
              Download iit-mandi-track-a-{demo?.scenario.id}.json
            </a>
          )}
          <p className="text-[11px] text-ink-muted max-w-2xl">
            The report bundles the scenario definition, every modality's prediction, the fused result, uncertainty and the
            comparison run — everything needed to replay and audit the demonstration. Synthetic patient, research use only.
          </p>
        </div>
      </Step>
    </div>
  );
}

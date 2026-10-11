/**
 * SlicerHeart integration panel — provenance, capability matrix, bridge status,
 * valve-metric vocabulary and the cohort annulus-shape research tool.
 *
 * Everything displayed here comes from the backend integration endpoints; the
 * panel never fabricates imaging results. Computed imaging metrics require a
 * 3D Slicer runtime, and the panel states that explicitly.
 */
import { AlertTriangle, Cpu, FileText, Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CARD } from "../panels";
import { SlicerHeartError, slicerheartApi, type AnnulusShapeResult, type CatalogEntry, type CatalogSummary, type ValveMetricCatalog } from "./api";

const CLASSIFICATION_LABEL: Record<string, string> = {
  reuse_directly: "Reuse directly",
  adapt: "Adapt",
  bridge: "Bridge (Slicer runtime)",
  convert: "Convert (assets)",
  reference_only: "Reference only",
  exclude: "Exclude",
};

const CLASSIFICATION_COLOR: Record<string, string> = {
  reuse_directly: "text-accent-cyan",
  adapt: "text-accent-brand",
  bridge: "text-amber-500",
  convert: "text-amber-500",
  reference_only: "text-ink-muted",
  exclude: "text-ink-faint",
};

/** Read a text file with a FileReader fallback for engines without Blob.text(). */
async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/** Orthographic projection of a 3D mean contour for quick visual QA (research view). */
function ContourPlot({ result }: { result: AnnulusShapeResult }) {
  const phase = result.phases[0];
  const pts = phase.mean_contour_points;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 220, H = 170, pad = 12;
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - minY) / (maxY - minY || 1)) * (H - 2 * pad);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ") + " Z";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[220px] h-[170px]" role="img" aria-label={`Mean ${result.valve_type} annulus contour (${phase.cases} cases, phase ${phase.phase})`}>
      <path d={path} fill="rgba(59,130,246,0.08)" stroke="currentColor" strokeWidth="1.4" />
      {phase.landmark_positions.map((l) => (
        <circle key={l.label} cx={sx(l.position[0])} cy={sy(l.position[1])} r="2.6" className="fill-accent-red" />
      ))}
    </svg>
  );
}

export function SlicerHeartPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CatalogSummary | null>(null);
  const [bridge, setBridge] = useState<{ available: boolean; reason: string | null; setup_instructions: string | null } | null>(null);
  const [provenance, setProvenance] = useState<{ snapshot: string; citation: string; license: string; snapshot_source_fingerprint: string; notice: string } | null>(null);
  const [matrix, setMatrix] = useState<CatalogEntry[] | null>(null);
  const [metrics, setMetrics] = useState<ValveMetricCatalog | null>(null);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [labelOrder, setLabelOrder] = useState("S,A,L,P");
  const [busy, setBusy] = useState(false);
  const [annulusError, setAnnulusError] = useState<string | null>(null);
  const [annulusResult, setAnnulusResult] = useState<AnnulusShapeResult | null>(null);
  const [annulusNotice, setAnnulusNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, catalog, valveMetrics] = await Promise.all([
        slicerheartApi.overview(),
        slicerheartApi.catalog(),
        slicerheartApi.valveMetrics(),
      ]);
      setSummary(catalog.summary);
      setMatrix(catalog.matrix);
      setMetrics(valveMetrics);
      setBridge(overview.bridge);
      setProvenance({
        snapshot: overview.snapshot,
        citation: overview.citation,
        license: overview.license,
        snapshot_source_fingerprint: overview.snapshot_source_fingerprint,
        notice: overview.notice,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof SlicerHeartError ? e.message : "Failed to load SlicerHeart integration data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !summary) {
    return (
      <section className={`${CARD} p-4 space-y-2`}>
        <h2 className="text-[14px] font-semibold text-ink-primary">SlicerHeart integration</h2>
        <p className="text-[12px] text-ink-muted inline-flex items-center gap-2" aria-live="polite"><Loader2 size={13} className="animate-spin" /> Loading integration matrix…</p>
      </section>
    );
  }

  if (error && !summary) {
    return (
      <section className={`${CARD} p-4 space-y-2`}>
        <h2 className="text-[14px] font-semibold text-ink-primary">SlicerHeart integration</h2>
        <div role="alert" className="rounded-lg border border-accent-red/50 bg-accent-red/10 px-3 py-2 text-[12.5px]">{error}</div>
        <button onClick={load} className="text-[12px] text-accent-cyan hover:underline">Retry</button>
      </section>
    );
  }

  const runAnalysis = async () => {
    if (!csvFile) return;
    setBusy(true);
    setAnnulusError(null);
    setAnnulusResult(null);
    try {
      const csv_text = await readFileText(csvFile);
      const res = await slicerheartApi.annulusShape({
        csv_text,
        label_order: labelOrder.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setAnnulusResult(res.result);
      setAnnulusNotice(res.notice);
    } catch (e) {
      setAnnulusError(e instanceof SlicerHeartError ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${CARD} p-4 space-y-4`} aria-labelledby="slicerheart-title" data-testid="slicerheart-panel">
      <div className="space-y-1">
        <h2 id="slicerheart-title" className="text-[14px] font-semibold text-ink-primary">SlicerHeart integration (3D Slicer cardiac platform)</h2>
        <p className="text-[11.5px] text-ink-muted">{provenance?.notice}</p>
        {provenance && (
          <p className="text-[11px] text-ink-faint">
            Upstream snapshot: {provenance.snapshot} · {provenance.license} · source fingerprint <code>{provenance.snapshot_source_fingerprint.slice(0, 16)}…</code>
          </p>
        )}
      </div>

      {error && <div role="alert" className="rounded-lg border border-accent-red/50 bg-accent-red/10 px-3 py-2 text-[12.5px]">{error}</div>}

      {summary && (
        <div className="flex flex-wrap gap-2 text-[11px]" data-testid="slicerheart-summary">
          <span className="rounded-full border border-surface-border px-2 py-0.5">{summary.modules_classified} upstream module groups classified</span>
          {Object.entries(summary.by_classification).map(([cls, count]) => (
            <span key={cls} className="rounded-full border border-surface-border px-2 py-0.5">
              {CLASSIFICATION_LABEL[cls] ?? cls}: {count}
            </span>
          ))}
          <span className="rounded-full border border-surface-border px-2 py-0.5 inline-flex items-center gap-1">
            <Cpu size={11} aria-hidden /> Slicer imaging runtime: {bridge?.available ? "configured" : "not configured"}
          </span>
        </div>
      )}

      {bridge && !bridge.available && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11.5px] text-ink-muted" data-testid="slicerheart-bridge-notice">
          <p className="inline-flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
            <span><b>Imaging computations unavailable:</b> {bridge.reason} Imaging-derived metrics (valve quantification, segmentation) run only inside a provisioned 3D Slicer runtime via the bridge — CardioTon never fabricates them.</span></p>
        </div>
      )}

      {matrix && (
        <details className="text-[12px]" data-testid="slicerheart-matrix">
          <summary className="cursor-pointer text-ink-muted hover:text-ink-primary">Integration matrix ({matrix.length} module groups) — what is wired, bridged, referenced or excluded</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-left text-ink-faint">
                  <th className="px-2 py-1 font-medium">Upstream module</th>
                  <th className="px-2 py-1 font-medium">Classification</th>
                  <th className="px-2 py-1 font-medium">Status in CardioTon</th>
                  <th className="px-2 py-1 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((entry) => (
                  <tr key={entry.module} className="border-t border-surface-border/60 align-top">
                    <td className="px-2 py-1.5 font-medium text-ink-primary whitespace-nowrap">{entry.module}</td>
                    <td className={`px-2 py-1.5 whitespace-nowrap ${CLASSIFICATION_COLOR[entry.classification] ?? ""}`}>{CLASSIFICATION_LABEL[entry.classification] ?? entry.classification}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-ink-muted">{entry.status.replace(/_/g, " ")}</td>
                    <td className="px-2 py-1.5 text-ink-muted">{entry.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {metrics && (
        <details className="text-[12px]" data-testid="slicerheart-metrics">
          <summary className="cursor-pointer text-ink-muted hover:text-ink-primary inline-flex items-center gap-1"><FileText size={12} aria-hidden /> Valve metric vocabulary (definitions only — computed in a Slicer runtime, never fabricated here)</summary>
          <p className="mt-1 text-[11px] text-ink-faint">{metrics.notice}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {Object.entries(metrics.metrics_by_valve).map(([valve, vals]) => (
              <div key={valve} className="rounded-lg border border-surface-border p-2">
                <p className="text-[11.5px] font-semibold text-ink-primary capitalize">{valve} valve</p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-ink-muted">
                  {vals.map((m) => (
                    <li key={m.id}><b>{m.name}</b> ({m.unit}) — {m.definition}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="rounded-lg border border-surface-border p-3 space-y-2" data-testid="slicerheart-research">
        <p className="text-[12px] font-semibold text-ink-primary">Cohort annulus-shape statistics (research)</p>
        <p className="text-[11px] text-ink-muted">
          Upload an annulus contour CSV exported by SlicerHeart's ValveBatchExport (columns Filename, Phase, Valve,
          AnnulusContourX/Y/Z, AnnulusContourLabel). The backend computes the cohort mean shape with the adapted
          SlicerHeart HeartValveBatchAnalysis statistics. Population descriptors only — no clinical interpretation.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-2 py-1.5 cursor-pointer hover:border-accent-cyan/50">
            <Upload size={13} aria-hidden />
            <span>{csvFile ? csvFile.name : "Choose contour CSV…"}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-label="Annulus contour CSV export"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="inline-flex items-center gap-1">
            <span className="text-[11px] text-ink-muted">Landmark order</span>
            <input
              value={labelOrder}
              onChange={(e) => setLabelOrder(e.target.value)}
              className="w-24 rounded border border-surface-border bg-surface-panel px-1.5 py-1 text-[11px]"
              aria-label="Landmark label order"
            />
          </label>
          <button
            onClick={runAnalysis}
            disabled={!csvFile || busy}
            className="rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1.5 text-[12px] text-accent-cyan disabled:opacity-40 hover:bg-accent-cyan/15"
          >
            {busy ? "Computing…" : "Compute cohort statistics"}
          </button>
        </div>
        {annulusError && <div role="alert" className="rounded-lg border border-accent-red/50 bg-accent-red/10 px-3 py-2 text-[11.5px]">{annulusError}</div>}
        {annulusResult && (
          <div className="flex flex-wrap items-start gap-4" data-testid="slicerheart-research-result">
            <ContourPlot result={annulusResult} />
            <ul className="text-[11.5px] text-ink-muted space-y-1">
              {annulusResult.phases.map((p) => (
                <li key={p.phase}>
                  Phase <b>{p.phase}</b>: {p.cases} case{p.cases === 1 ? "" : "s"} aligned ·{" "}
                  {p.mean_contour_points.length} mean contour points · landmarks{" "}
                  {p.landmark_positions.map((l) => l.label).join("/")}
                  {p.skipped_cases.length > 0 && <> · skipped {p.skipped_cases.length} invalid case(s)</>}
                </li>
              ))}
              <li>Units: {annulusResult.units}</li>
              {annulusNotice && <li className="text-ink-faint">{annulusNotice}</li>}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

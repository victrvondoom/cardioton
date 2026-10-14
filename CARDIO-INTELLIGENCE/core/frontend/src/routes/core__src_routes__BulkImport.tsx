/**
 * /cases/bulk-import — Bulk FHIR Import.
 *
 * Local FHIR Bulk Data review (.ndjson / .zip / Bundle JSON). Uploaded data
 * is parsed in the browser and saved through the existing pending-case API.
 * A separately selected synthetic simulation demonstrates the queue layout.
 */
import clsx from "clsx";
import { unzipSync, strFromU8 } from "fflate";
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Download,
  FileText,
  Loader2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { StatusPill } from "../components/core__src_components__StatusPill";
import { authHeader } from "../lib/core__src_lib__auth";
import type { CaseStatus } from "../lib/core__src_lib__syntheticCases";

type CaseQueueRow = {
  case_id: string;
  patient: string;
  diagnosis: string;
  treatment: string;
  status: "queued" | "in_flight" | "approved" | "denied" | "referred" | "appealed" | "created" | "failed";
  cost_usd: number | null;
  finished_at_ms?: number;
  source_bundle?: { resourceType: "Bundle"; type: "collection"; entry: FhirEntry[] };
  saved_case_id?: string;
  error?: string;
};

const SYNTHETIC_BATCH: Omit<CaseQueueRow, "status" | "cost_usd">[] = [
  { case_id: "bulk_001", patient: "S.D.", diagnosis: "C50.911 Stage IIIA breast",   treatment: "trastuzumab" },
  { case_id: "bulk_002", patient: "M.D.", diagnosis: "C50.912 Stage IIIB breast",   treatment: "trastuzumab" },
  { case_id: "bulk_003", patient: "R.K.", diagnosis: "C34.91 NSCLC IIIB",           treatment: "osimertinib" },
  { case_id: "bulk_004", patient: "P.N.", diagnosis: "C18.9 colon stage II",        treatment: "pembrolizumab" },
  { case_id: "bulk_005", patient: "T.O.", diagnosis: "C56.9 ovarian stage III",     treatment: "olaparib" },
  { case_id: "bulk_006", patient: "L.W.", diagnosis: "C50.911 Stage IIIA breast",   treatment: "trastuzumab" },
  { case_id: "bulk_007", patient: "K.M.", diagnosis: "C43.9 melanoma IV",           treatment: "dabrafenib + trametinib" },
  { case_id: "bulk_008", patient: "A.B.", diagnosis: "C43.5 melanoma IV",           treatment: "pembrolizumab" },
  { case_id: "bulk_009", patient: "F.E.", diagnosis: "C50.911 breast IV",           treatment: "T-DXd" },
  { case_id: "bulk_010", patient: "H.S.", diagnosis: "C56.9 ovarian II",            treatment: "olaparib" },
  { case_id: "bulk_011", patient: "C.R.", diagnosis: "C34.10 NSCLC IV",             treatment: "osimertinib" },
  { case_id: "bulk_012", patient: "B.T.", diagnosis: "C50.912 breast IIIB",         treatment: "trastuzumab" },
  { case_id: "bulk_013", patient: "Y.J.", diagnosis: "C18.0 cecum II",              treatment: "pembrolizumab" },
  { case_id: "bulk_014", patient: "N.G.", diagnosis: "C50.911 breast IIIA",         treatment: "trastuzumab" },
  { case_id: "bulk_015", patient: "V.D.", diagnosis: "C61 prostate IV",             treatment: "abiraterone" },
  { case_id: "bulk_016", patient: "Z.O.", diagnosis: "C71.9 glioblastoma IV",       treatment: "bevacizumab" },
  { case_id: "bulk_017", patient: "Q.L.", diagnosis: "C56.9 ovarian II",            treatment: "olaparib" },
  { case_id: "bulk_018", patient: "X.M.", diagnosis: "C50.911 breast IIIA",         treatment: "trastuzumab" },
  { case_id: "bulk_019", patient: "G.P.", diagnosis: "C34.91 NSCLC IIIB",           treatment: "osimertinib" },
  { case_id: "bulk_020", patient: "I.A.", diagnosis: "C43.9 melanoma IV",           treatment: "pembrolizumab" },
  { case_id: "bulk_021", patient: "O.K.", diagnosis: "C50.912 breast IIIB",         treatment: "T-DXd" },
  { case_id: "bulk_022", patient: "U.R.", diagnosis: "C18.9 colon II",              treatment: "pembrolizumab" },
  { case_id: "bulk_023", patient: "E.S.", diagnosis: "C50.911 breast IIIA",         treatment: "trastuzumab" },
  { case_id: "bulk_024", patient: "W.J.", diagnosis: "C56.9 ovarian III",           treatment: "olaparib" },
];

// Explicit synthetic queue examples only; never applied to uploaded evidence.
function verdictForRow(idx: number): CaseQueueRow["status"] {
  const pattern: CaseQueueRow["status"][] = [
    "approved", "approved", "approved", "referred",
    "approved", "denied",   "approved", "approved",
    "appealed", "approved", "referred", "approved",
    "approved", "approved", "approved", "referred",
    "approved", "approved", "denied",   "approved",
    "approved", "appealed", "referred", "approved",
  ];
  return pattern[idx] ?? "approved";
}

const STATUS_TO_PILL: Record<CaseQueueRow["status"], CaseStatus> = {
  queued:    "pending",
  in_flight: "running",
  approved:  "approved",
  denied:    "denied",
  referred:  "referred",
  appealed:  "appealed",
  created: "pending",
  failed: "pending",
};

// =============================================================================
// File download helpers (client-side; demo runs are simulated, no backend round-trip)
// =============================================================================

function triggerDownload(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after the download has had time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =============================================================================
// FHIR Bulk Data export parser — .ndjson / .zip / Bundle .json
// =============================================================================

interface FhirResource {
  resourceType?: string;
  id?: string;
  [k: string]: unknown;
}

interface FhirEntry {
  resource: FhirResource;
  fullUrl?: string;
  [key: string]: unknown;
}

async function readFhirBulkFile(
  file: File,
): Promise<{ entries: FhirEntry[]; fileCount: number }> {
  const lower = file.name.toLowerCase();
  const isZip = lower.endsWith(".zip") || file.type === "application/zip";

  // ZIP path — unzip in-browser via fflate, then parse each .ndjson/.json entry
  if (isZip) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const entries = unzipSync(buf, {
      filter: (f) => /\.(ndjson|json)$/i.test(f.name),
    });
    const names = Object.keys(entries);
    if (names.length === 0) {
      throw new Error("ZIP contains no .ndjson or .json files");
    }
    const resources: FhirEntry[] = [];
    for (const name of names) {
      const text = strFromU8(entries[name]);
      resources.push(...parseFhirText(text, name));
    }
    return { entries: resources, fileCount: names.length };
  }

  // Plain text path — .ndjson or .json (Bundle, array, or single resource)
  const text = await file.text();
  const resources = parseFhirText(text, file.name);
  return { entries: resources, fileCount: 1 };
}

function parseFhirText(text: string, filename: string): FhirEntry[] {
  const lower = filename.toLowerCase();

  // NDJSON — one JSON object per line
  if (lower.endsWith(".ndjson")) {
    const out: FhirEntry[] = [];
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      const t = line.trim();
      if (!t) continue;
      try {
        out.push(...toFhirEntries(JSON.parse(t)));
      } catch {
        throw new Error(`${filename}: invalid FHIR JSON on line ${index + 1}. No cases were submitted.`);
      }
    }
    return out;
  }

  // .json — could be Bundle, array, or a single resource
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Sometimes a .json file is actually NDJSON in disguise — fall back
    return parseFhirText(text, filename + ".ndjson");
  }
  return toFhirEntries(parsed);
}

function toFhirEntries(parsed: unknown): FhirEntry[] {
  if (Array.isArray(parsed)) return parsed.flatMap(toFhirEntries);
  if (parsed && typeof parsed === "object") {
    const obj = parsed as FhirResource & { entry?: FhirEntry[] };
    if (obj.resourceType === "Bundle" && Array.isArray(obj.entry)) {
      return obj.entry.filter((entry) => entry.resource && typeof entry.resource.resourceType === "string");
    }
    if (typeof obj.resourceType === "string") return [{ resource: obj }];
  }
  return [];
}

function groupFhirIntoCases(
  entries: FhirEntry[],
): Omit<CaseQueueRow, "status" | "cost_usd">[] {
  // Index patients first, then attach the first Condition + MedicationRequest we
  // find for each. This mirrors how a real Da Vinci PAS payload structures cases.
  type Acc = { patient: string; diagnosis?: string; treatment?: string; entry: FhirEntry };
  const byPatientId = new Map<string, Acc>();
  const patientAliases = new Map<string, string>();
  const resources = entries.map(entry => entry.resource);

  const initials = (r: FhirResource): string => {
    const name = (r as { name?: { given?: string[]; family?: string }[] }).name?.[0];
    return [name?.given?.[0]?.[0], name?.family?.[0]].filter(Boolean).join(".");
  };

  for (const [index, entry] of entries.entries()) {
    const r = entry.resource;
    if (r.resourceType === "Patient") {
      const key = r.id || entry.fullUrl || `patient-row-${index + 1}`;
      byPatientId.set(key, { patient: initials(r), entry });
      for (const alias of [r.id, r.id ? `Patient/${r.id}` : undefined, entry.fullUrl]) {
        if (alias) patientAliases.set(alias, key);
      }
    }
  }

  const subjectId = (r: FhirResource): string | null => {
    const ref = (r as { subject?: { reference?: string }; patient?: { reference?: string }; beneficiary?: { reference?: string } });
    const raw = ref.subject?.reference ?? ref.patient?.reference ?? ref.beneficiary?.reference ?? null;
    if (!raw) return null;
    const relative = raw.match(/(?:^|\/)Patient\/([^/]+)(?:\/_history\/[^/]+)?$/)?.[1];
    return patientAliases.get(raw) ?? (relative ? patientAliases.get(`Patient/${relative}`) : null) ?? null;
  };

  for (const r of resources) {
    const pid = subjectId(r);
    if (!pid) continue;
    const acc = byPatientId.get(pid);
    if (!acc) continue;
    if (r.resourceType === "Condition" && !acc.diagnosis) {
      const code = (r as { code?: { coding?: { code?: string; display?: string }[]; text?: string } }).code;
      const c = code?.coding?.[0];
      acc.diagnosis = [c?.code, c?.display ?? code?.text].filter(Boolean).join(" ").trim() || "Condition";
    } else if (r.resourceType === "MedicationRequest" && !acc.treatment) {
      const mc = (r as {
        medicationCodeableConcept?: { coding?: { display?: string }[]; text?: string };
        medicationReference?: { display?: string };
      });
      acc.treatment =
        mc.medicationCodeableConcept?.coding?.[0]?.display ??
        mc.medicationCodeableConcept?.text ??
        mc.medicationReference?.display ??
        "MedicationRequest";
    }
  }

  const aliases = new Map<string, FhirEntry>();
  for (const entry of entries) {
    if (entry.fullUrl) aliases.set(entry.fullUrl, entry);
    if (entry.resource.id) aliases.set(`${entry.resource.resourceType}/${entry.resource.id}`, entry);
  }
  const references = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(references);
    if (!value || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([key, child]) => key === "reference" && typeof child === "string" ? [child] : references(child));
  };

  const cases: Omit<CaseQueueRow, "status" | "cost_usd">[] = [];
  let i = 1;
  for (const [pid, acc] of byPatientId) {
    if (!acc.diagnosis && !acc.treatment) continue;  // skip patients with no clinical context
    const patientEntries = new Set(entries.filter(entry => entry === acc.entry || subjectId(entry.resource) === pid));
    // Preserve whole source entries, extensions, identifiers, and referenced
    // supporting resources without mixing another patient's clinical records.
    for (const entry of patientEntries) {
      for (const reference of references(entry.resource)) {
        const relative = reference.match(/(?:^|\/)([A-Z][A-Za-z]+\/[^/]+)(?:\/_history\/[^/]+)?$/)?.[1];
        const linked = aliases.get(reference) ?? (relative ? aliases.get(relative) : undefined);
        if (!linked) continue;
        const owner = subjectId(linked.resource);
        if (owner && owner !== pid) continue;
        if (linked.resource.resourceType === "Patient" && linked !== acc.entry) continue;
        patientEntries.add(linked);
      }
    }
    cases.push({
      case_id: `preview_${i.toString().padStart(3, "0")}`,
      patient: acc.patient,
      diagnosis: acc.diagnosis ?? "—",
      treatment: acc.treatment ?? "",
      source_bundle: { resourceType: "Bundle", type: "collection", entry: [...patientEntries] },
    });
    i++;
  }

  // Fallback — if no Patient resources at all, build a row per top-level
  // Condition or MedicationRequest so the user still sees their upload land.
  if (cases.length === 0) {
    for (const r of resources) {
      if (r.resourceType !== "Condition" && r.resourceType !== "MedicationRequest") continue;
      const code = (r as { code?: { coding?: { code?: string; display?: string }[]; text?: string } }).code;
      cases.push({
        case_id: `bulk_${(r.id ?? cases.length + 1).toString().slice(0, 12)}`,
        patient: "—",
        diagnosis: code?.coding?.[0]?.display ?? code?.text ?? r.resourceType,
        treatment: r.resourceType === "MedicationRequest" ? "see resource" : "—",
        error: "A linked Patient and documented diagnosis are required before this resource can create a case.",
      });
    }
  }

  if (cases.length > 200) throw new Error(`This file contains ${cases.length} case groups. Split it into batches of at most 200; no cases were submitted.`);
  return cases;
}

function tsSlug(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadResultsCSV(rows: CaseQueueRow[], demo: boolean): void {
  if (rows.length === 0) return;
  const headers = [
    "row",
    "case_id",
    "patient_initials",
    "diagnosis",
    "treatment",
    "source_mode",
    "processing_status",
    "simulated_verdict",
    "cost_usd",
    "finished_seconds",
  ];
  const body = rows.map((r, i) =>
    [
      i + 1,
      r.case_id,
      r.patient,
      r.diagnosis,
      r.treatment,
      demo ? "synthetic_ui_simulation" : "local_file_preview",
      demo ? r.status : r.saved_case_id ? "saved_pending" : r.status === "failed" ? "save_failed" : "not_submitted",
      demo && !["queued", "in_flight"].includes(r.status) ? r.status : "",
      r.cost_usd?.toFixed(4) ?? "",
      r.finished_at_ms != null ? (r.finished_at_ms / 1000).toFixed(2) : "",
    ]
      .map(csvField)
      .join(","),
  );
  const csv = [headers.join(","), ...body].join("\n");
  triggerDownload(`cardioton-bulk-import-${tsSlug()}.csv`, csv, "text/csv");
}

function downloadSimulationReport(rows: CaseQueueRow[]): void {
  if (rows.length === 0) return;
  const counts = {
    approved: rows.filter((r) => r.status === "approved").length,
    denied:   rows.filter((r) => r.status === "denied").length,
    referred: rows.filter((r) => r.status === "referred").length,
    appealed: rows.filter((r) => r.status === "appealed").length,
  };
  const finishedTimes = rows
    .map((r) => r.finished_at_ms ?? 0)
    .filter((ms) => ms > 0);
  const durationSec = finishedTimes.length > 0 ? Math.max(...finishedTimes) / 1000 : 0;
  const throughput = durationSec > 0 ? (rows.length / durationSec).toFixed(2) : "—";
  const generatedAt = new Date().toISOString();

  const tableRows = rows
    .map(
      (r, i) =>
        `| ${i + 1} | ${r.case_id} | ${r.patient} | ${r.diagnosis} | ${r.treatment} | ${r.status.toUpperCase()} | ${r.finished_at_ms != null ? (r.finished_at_ms / 1000).toFixed(2) + "s" : "—"} |`,
    )
    .join("\n");

  const md = `# CARDIOTON — Synthetic Queue Simulation

**Generated:** ${generatedAt}
**Batch:** ${rows.length} synthetic examples
**UI animation duration:** ${durationSec.toFixed(2)} s
**UI animation rate:** ${throughput} examples/sec

This is a user-selected interface simulation. Outcomes are predefined examples.
No backend agent ran, no case was persisted, and no clinical decision or appeal
was produced. Costs, actual throughput, and compliance status were not measured.

## Simulated outcomes

| Outcome  | Count |
|----------|------:|
| Approved | ${counts.approved} |
| Denied   | ${counts.denied} |
| Referred | ${counts.referred} |
| Appealed | ${counts.appealed} |
| **Total** | **${rows.length}** |

## Synthetic examples

| # | Example ID | Patient | Diagnosis | Treatment | Simulated verdict | UI finished |
|--:|------------|---------|-----------|-----------|-------------------|-------------|
${tableRows}
`;
  triggerDownload(`cardioton-queue-simulation-${tsSlug()}.md`, md, "text/markdown");
}

export default function BulkImport() {
  const [phase, setPhase] = useState<"idle" | "preview" | "running" | "done">("idle");
  const [demo, setDemo] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [payer, setPayer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const mounted = useRef(true);
  const [rows, setRows] = useState<CaseQueueRow[]>([]);
  const [tickMs, setTickMs] = useState(0);
  const [sourceFile, setSourceFile] = useState<{ name: string; size: number; n_resources: number; unlinked?: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const total = rows.length;
  const completed = rows.filter((r) =>
    ["approved", "denied", "referred", "appealed"].includes(r.status),
  ).length;
  const inFlight = rows.filter((r) => r.status === "in_flight").length;
  const queued = rows.filter((r) => r.status === "queued").length;
  const throughput = demo && tickMs > 0
    ? (completed / (tickMs / 1000)).toFixed(1)
    : "0.0";

  // Only this explicit action enables simulated processing.
  const startQueue = () => {
    if (phase !== "idle" || parsing) return;
    const initialRows: CaseQueueRow[] = SYNTHETIC_BATCH.map((r) => ({
      ...r,
      status: "queued",
      cost_usd: null,
    }));
    setRows(initialRows);
    setDemo(true);
    setTickMs(0);
    setSourceFile({ name: "synthetic-batch (demo)", size: 0, n_resources: SYNTHETIC_BATCH.length });
    setParseError(null);
    setPhase("running");
  };

  // Open the OS file picker
  const openFilePicker = useCallback(() => {
    if (phase === "idle" && !parsing) inputRef.current?.click();
  }, [phase, parsing]);

  // Parse a real FHIR Bulk Data export (.ndjson / .zip / Bundle .json)
  const handleFileSelect = useCallback(async (file: File) => {
    if (phase !== "idle" || parsing) return;
    setParsing(true);
    setDemo(false);
    setParseError(null);
    setSourceFile({ name: file.name, size: file.size, n_resources: 0 });
    try {
      const { entries, fileCount } = await readFhirBulkFile(file);
      const cases = groupFhirIntoCases(entries);
      if (cases.length === 0) {
        throw new Error(
          `No FHIR Patient/Condition/MedicationRequest resources found across ${fileCount} file(s). ` +
          `Upload an .ndjson export, a .zip of .ndjson files, or a Bundle .json.`,
        );
      }
      const initialRows: CaseQueueRow[] = cases.map((c) => ({ ...c, status: "queued", cost_usd: null }));
      setRows(initialRows);
      const groupedEntries = new Set(cases.flatMap(row => row.source_bundle?.entry ?? []));
      setSourceFile({ name: file.name, size: file.size, n_resources: entries.length, unlinked: entries.length - groupedEntries.size });
      setPhase("preview");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Could not read file");
      setSourceFile(null);
    } finally {
      setParsing(false);
    }
  }, [phase, parsing]);

  const reset = () => {
    setPhase("idle");
    setRows([]);
    setSourceFile(null);
    setParseError(null);
    setDemo(false);
    setTickMs(0);
    setPayer("");
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const canCreate = (row: CaseQueueRow) => Boolean(
    row.source_bundle && row.patient.trim() && row.treatment.trim()
    && row.diagnosis !== "—" && !row.saved_case_id && row.status !== "in_flight",
  );
  const createCases = async (candidates: CaseQueueRow[]) => {
    if (demo || !payer.trim() || submitLock.current) return;
    const ready = candidates.filter(canCreate);
    if (!ready.length) return;
    submitLock.current = true;
    setSubmitting(true);
    for (const row of ready) {
      if (!mounted.current) break;
      const started = performance.now();
      let serviceUnavailable = false;
      setRows(current => current.map(item => item.case_id === row.case_id ? { ...item, status: "in_flight", error: undefined } : item));
      try {
        const response = await fetch("/api/v1/cases", {
          method: "POST",
          headers: { ...authHeader(), "Content-Type": "application/json" },
          body: JSON.stringify({
            payer_id: payer.trim(),
            patient_initials: row.patient.trim(),
            requested_treatment: { name: row.treatment.trim(), j_code: null },
            physician_note: null,
            fhir_bundle: row.source_bundle,
          }),
        });
        serviceUnavailable = [401, 403, 429, 503].includes(response.status);
        const text = await response.text();
        let result: { case_id?: string; detail?: unknown } = {};
        try { result = JSON.parse(text); } catch { /* Preserve the HTTP failure below. */ }
        if (!response.ok || typeof result.case_id !== "string" || !result.case_id.trim()) throw new Error(typeof result.detail === "string" ? result.detail : `Case was not confirmed saved (HTTP ${response.status}). Check the case list before retrying.`);
        if (mounted.current) setRows(current => current.map(item => item.case_id === row.case_id ? {
          ...item, status: "created", saved_case_id: result.case_id,
          finished_at_ms: performance.now() - started, error: undefined,
        } : item));
      } catch (error) {
        if (mounted.current) setRows(current => current.map(item => item.case_id === row.case_id ? {
          ...item, status: "failed", error: error instanceof TypeError ? "Save could not be confirmed. Check the case list before retrying." : error instanceof Error ? error.message : "Case was not confirmed saved.",
        } : item));
        // Stop the batch on a shared service/auth failure. Unsent source rows
        // remain available for an explicit retry once the problem is resolved.
        if (serviceUnavailable || error instanceof TypeError) break;
      }
    }
    submitLock.current = false;
    if (mounted.current) setSubmitting(false);
  };

  // Drag-and-drop hooks
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFileSelect(f);
  };

  useEffect(() => {
    if (phase !== "running" || !demo) return;
    const start = Date.now();
    const interval = setInterval(() => {
      setTickMs(Date.now() - start);
      setRows((prev) => {
        const next = [...prev];
        // Advance one predefined example per UI animation tick.
        const inFlightNow = next.filter((r) => r.status === "in_flight").length;
        const slots = Math.max(0, 2 - inFlightNow);
        for (let i = 0; i < next.length && slots > 0; i++) {
          if (next[i].status === "queued") {
            next[i] = { ...next[i], status: "in_flight" };
            break;
          }
        }
        const idx = next.findIndex((r) => r.status === "in_flight");
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            status: verdictForRow(idx),
            cost_usd: null,
            finished_at_ms: Date.now() - start,
          };
        }
        return next;
      });
    }, 240);

    return () => clearInterval(interval);
  }, [phase, demo]);

  // Detect completion
  useEffect(() => {
    if (phase === "running" && rows.length > 0 && completed === total) {
      setPhase("done");
    }
  }, [phase, rows, completed, total]);

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-[10px] text-compact text-accent-brand mb-2">
          <CloudUpload size={12} />
          BULK IMPORT
          <span className="text-ink-faint">·</span>
          <span className="text-accent-cyan">FHIR source review</span>
        </div>
        <h1 className="text-2xl font-semibold text-ink-primary leading-tight">
          Review a FHIR export. Create pending cases from its evidence.
        </h1>
        <p className="text-sm text-ink-muted mt-2 max-w-2xl">
          Choose a{" "}
          <code className="text-xs text-mono-tech px-1 py-0.5 rounded bg-surface-panel">.ndjson</code>,{" "}
          <code className="text-xs text-mono-tech px-1 py-0.5 rounded bg-surface-panel">.zip</code>,
          or FHIR Bundle export. Review the patient groups, supply the payer and missing
          request fields, then save pending cases. Source resources and their fields are
          retained for each patient. Run and review each case from its workspace.
        </p>
      </header>

      {/* Drop zone */}
      {phase === "idle" && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={clsx(
            "w-full bg-surface-raised border-2 border-dashed rounded-2xl p-12 transition-all flex flex-col items-center gap-3",
            dragOver
              ? "border-accent-brand bg-accent-brand/10"
              : "border-accent-brand/40 hover:border-accent-brand hover:bg-accent-brand/5",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".ndjson,.zip,.json,application/zip,application/json,application/fhir+json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFileSelect(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={openFilePicker}
            disabled={parsing}
            className="flex flex-col items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand rounded-xl p-2"
          >
            <CloudUpload size={48} className="text-accent-brand/60 group-hover:text-accent-brand group-hover:scale-105 transition-all" />
            <div className="text-center">
              <div className="font-semibold text-ink-primary mb-1" role="status">
                {parsing ? "Reading FHIR resources…" : "Drop a FHIR Bulk Data export"}
              </div>
              <div className="text-sm text-ink-muted">
                or <span className="text-accent-brand underline">click to browse</span>
              </div>
              <div className="text-[11px] text-mono-tech text-ink-faint mt-3">
                Supports .ndjson · .zip · .json (Bundle) · application/fhir+json
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={startQueue}
            disabled={parsing}
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-accent-brand bg-accent-brand-soft/50 hover:bg-accent-brand-soft px-3 py-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
          >
            <Zap size={12} />
            Simulate {SYNTHETIC_BATCH.length} synthetic examples
          </button>
          {parseError && (
            <div className="mt-2 text-xs text-accent-red bg-accent-red/10 border border-accent-red/30 px-3 py-2 rounded-md max-w-xl text-center">
              <AlertCircle size={12} className="inline mr-1 -mt-0.5" />
              {parseError}
            </div>
          )}
        </div>
      )}

      {/* Progress header (running) */}
      {phase !== "idle" && (
        <div className="bg-surface-raised border border-surface-border rounded-2xl p-5 mb-4">
          <p className="mb-3 text-xs text-accent-amber" role="status">
            {demo ? "Synthetic interface simulation · predefined outcomes · no agents run and no cases saved." : "Source preview · saved cases remain pending until you run and review them. No clinical outcomes are inferred here."}
          </p>
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <div className="flex items-center gap-3">
              {phase === "running" || submitting ? (
                <Loader2 size={18} className="text-accent-brand animate-spin" />
              ) : (
                <FileText size={18} className="text-accent-cyan" />
              )}
              <div>
                <div className="text-sm font-medium text-ink-primary">
                  {demo ? phase === "running" ? `Simulating ${total} examples…` : `Simulation complete · ${total} examples` : `${total} patient groups · ${rows.filter(row => row.saved_case_id).length} cases saved`}
                </div>
                <div className="text-[11px] text-mono-tech text-ink-muted">
                  <span className="text-accent-green">{demo ? completed : rows.filter(row => row.saved_case_id).length}</span> {demo ? "simulated" : "saved"}
                  <span className="mx-1.5 text-ink-faint">·</span>
                  <span className="text-accent-brand">{inFlight}</span> in flight
                  <span className="mx-1.5 text-ink-faint">·</span>
                  <span>{queued}</span> {demo ? "queued examples" : "not submitted"}
                </div>
                {sourceFile && (
                  <div className="text-[10px] text-mono-tech text-ink-faint mt-1 flex items-center gap-1">
                    <FileText size={10} />
                    <span className="text-ink-muted truncate max-w-[280px]" title={sourceFile.name}>{sourceFile.name}</span>
                    {sourceFile.size > 0 && (
                      <>
                        <span>·</span>
                        <span>{(sourceFile.size / 1024).toFixed(1)} KB</span>
                      </>
                    )}
                    {sourceFile.n_resources > 0 && (
                      <>
                        <span>·</span>
                        <span>{sourceFile.n_resources} {demo ? "synthetic examples" : "source resources"}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-mono-tech text-ink-muted">
              {demo && <span>UI animation rate: <span className="text-accent-cyan font-semibold">{throughput} examples/sec</span></span>}
              <button type="button" disabled={submitting} onClick={reset} className="text-xs px-3 py-1.5 border border-surface-border rounded-md disabled:opacity-40">{demo && phase === "running" ? "Stop simulation" : "Choose another file"}</button>
              {phase !== "running" && (
                <button
                  type="button"
                  onClick={() => downloadResultsCSV(rows, demo)}
                  className="text-xs font-medium px-3 py-1.5 rounded-md border border-surface-border text-ink-body hover:bg-surface-raised-hi transition-colors flex items-center gap-1.5"
                >
                  <Download size={11} />
                  {demo ? "Export simulation CSV" : "Export source summary CSV"}
                </button>
              )}
            </div>
          </div>

          {!demo && <div className="flex flex-wrap items-end gap-3 border-t border-surface-border pt-4 mt-4">
            <label className="text-xs text-ink-muted">Payer ID for this batch
              <input value={payer} onChange={event => setPayer(event.target.value)} disabled={submitting} placeholder="Enter the payer from the source record" className="block mt-1 border border-surface-border rounded-md bg-surface-bg text-ink-primary px-3 py-2 w-72 max-w-full" />
            </label>
            <button type="button" onClick={() => void createCases(rows)} disabled={submitting || !payer.trim() || !rows.some(canCreate)} className="rounded-md px-4 py-2 bg-accent-brand text-ink-invert text-xs disabled:opacity-40">{submitting ? "Saving pending cases…" : `Save ${rows.filter(canCreate).length} ready cases`}</button>
            <p className="text-[11px] text-ink-muted max-w-xl">A patient, documented diagnosis, requested treatment, and payer are required. Missing fields stay empty for your review. Backend errors appear on their source rows.</p>
            <Link to="/cases" className="text-xs text-accent-cyan underline">Check saved cases</Link>
            {Boolean(sourceFile?.unlinked) && <p className="w-full text-xs text-accent-amber">{sourceFile?.unlinked} source resources are not linked to a listed clinical patient group. They are not submitted. Review the source references before treating this as a complete import.</p>}
          </div>}

          {/* Segmented progress bar */}
          {demo && <div className="flex gap-0.5">
            {rows.map((r, i) => (
              <div
                key={r.case_id}
                className={clsx(
                  "h-2 flex-1 rounded-sm transition-colors",
                  r.status === "queued"   && "bg-surface-border",
                  r.status === "in_flight" && "bg-accent-brand animate-pulse-soft",
                  r.status === "approved" && "bg-accent-green",
                  r.status === "denied"   && "bg-accent-red",
                  r.status === "referred" && "bg-accent-amber",
                  r.status === "appealed" && "bg-accent-violet",
                )}
                title={`#${i + 1} · ${r.status}`}
              />
            ))}
          </div>}
        </div>
      )}

      {/* Result table */}
      {rows.length > 0 && (
        <div className="bg-surface-raised border border-surface-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-primary">{demo ? "Simulated queue outcomes" : "Source review and case creation"}</h3>
            <span className="text-[11px] text-mono-tech text-ink-muted">
              {demo ? `${completed} of ${total} examples animated` : `${rows.filter(row => row.saved_case_id).length} of ${total} cases saved`}
            </span>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-panel text-[10px] text-compact text-ink-muted sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 w-8">#</th>
                  <th className="text-left px-4 py-2.5">Case</th>
                  <th className="text-left px-4 py-2.5">Patient</th>
                  <th className="text-left px-4 py-2.5">Diagnosis</th>
                  <th className="text-left px-4 py-2.5">Treatment</th>
                  <th className="text-left px-4 py-2.5">{demo ? "Simulated verdict" : "Save status"}</th>
                  <th className="text-right px-4 py-2.5">{demo ? "Cost" : "Action"}</th>
                  <th className="text-right px-4 py-2.5 w-20">{demo ? "UI finished" : "Save response"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((r, i) => (
                  <tr
                    key={r.case_id}
                    className={clsx(
                      "transition-colors",
                      r.status === "in_flight" && "bg-accent-brand/[0.04]",
                    )}
                  >
                    <td className="px-4 py-2 text-[10px] text-mono-tech text-ink-faint">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-2 text-mono-tech text-xs text-ink-muted">{r.saved_case_id ? <Link to={`/cases/${r.saved_case_id}`} className="text-accent-cyan underline">{r.saved_case_id}</Link> : r.case_id}</td>
                    <td className="px-4 py-2 text-mono-tech text-xs text-ink-body">
                      {demo || r.saved_case_id ? r.patient || "—" : <input aria-label={`Patient initials for ${r.case_id}`} value={r.patient} onChange={event => setRows(current => current.map(row => row.case_id === r.case_id ? { ...row, patient: event.target.value } : row))} disabled={submitting} placeholder="Required initials" className="w-28 border border-surface-border bg-surface-bg rounded px-2 py-1" />}
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-body">{r.diagnosis}{!demo && r.source_bundle && <details className="mt-2"><summary className="text-accent-cyan cursor-pointer">Review {r.source_bundle.entry.length} source resources</summary><pre className="mt-2 max-h-60 max-w-md overflow-auto whitespace-pre-wrap text-[10px] text-ink-muted">{JSON.stringify(r.source_bundle, null, 2)}</pre></details>}</td>
                    <td className="px-4 py-2 text-xs text-ink-primary">
                      {demo || r.saved_case_id ? r.treatment || "—" : <input aria-label={`Requested treatment for ${r.case_id}`} value={r.treatment} onChange={event => setRows(current => current.map(row => row.case_id === r.case_id ? { ...row, treatment: event.target.value } : row))} disabled={submitting} placeholder="Required requested treatment" className="w-44 border border-surface-border bg-surface-bg rounded px-2 py-1" />}
                    </td>
                    <td className="px-4 py-2">
                      {r.status === "created" ? <span className="text-xs text-accent-green">Saved · pending review</span> : r.status === "failed" ? <span className="text-xs text-accent-red" role="alert">{r.error}</span> : r.status === "queued" ? (
                        <span className="text-[10px] text-mono-tech text-ink-faint">{demo ? "queued example" : r.error || "Not submitted"}</span>
                      ) : r.status === "in_flight" ? (
                        <span className="text-[10px] text-mono-tech uppercase text-accent-brand flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" />
                          {demo ? "animated example" : "Saving…"}
                        </span>
                      ) : (
                        <StatusPill status={STATUS_TO_PILL[r.status]} />
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-mono-tech text-xs text-ink-muted nums-tabular">
                      {demo ? "Not measured" : r.saved_case_id ? <Link to={`/cases/${r.saved_case_id}`} className="text-accent-cyan underline">Open case</Link> : <button type="button" disabled={submitting || !payer.trim() || !canCreate(r)} onClick={() => void createCases([r])} className="text-accent-cyan underline disabled:opacity-40">{r.status === "failed" ? "Retry save" : "Save pending case"}</button>}
                    </td>
                    <td className="px-4 py-2 text-right text-mono-tech text-[10px] text-ink-muted">
                      {r.finished_at_ms ? `${(r.finished_at_ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {phase === "done" && (
            <div className="px-5 py-4 border-t border-surface-border bg-accent-green/5">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 size={16} className="text-accent-green" />
                <span className="text-sm font-medium text-ink-primary">
                  Synthetic simulation complete
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <BatchSummary label="Approved"   value={rows.filter((r) => r.status === "approved").length} accent="green" />
                <BatchSummary label="Denied"     value={rows.filter((r) => r.status === "denied").length}   accent="red" />
                <BatchSummary label="Referred"   value={rows.filter((r) => r.status === "referred").length} accent="amber" />
                <BatchSummary label="Appealed"   value={rows.filter((r) => r.status === "appealed").length} accent="violet" />
                <BatchSummary label="Backend cases saved" value={0} accent="cyan" mono />
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-muted text-mono-tech">
                <AlertCircle size={11} />
                <span>Predefined example outcomes. No clinical decision, appeal, cost, or backend throughput was produced.</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => downloadResultsCSV(rows, true)}
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-accent-brand text-ink-invert hover:opacity-90 transition-opacity flex items-center gap-1.5"
                >
                  <Download size={11} />
                  Download simulation CSV
                </button>
                <button
                  type="button"
                  onClick={() => downloadSimulationReport(rows)}
                  className="text-xs font-medium px-3 py-1.5 rounded-md border border-surface-border text-ink-body hover:bg-surface-raised-hi transition-colors flex items-center gap-1.5"
                >
                  <FileText size={11} />
                  Download simulation report
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BatchSummary({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: number | string;
  accent: "green" | "red" | "amber" | "violet" | "cyan";
  mono?: boolean;
}) {
  const tint =
    accent === "green"  ? "text-accent-green" :
    accent === "red"    ? "text-accent-red"   :
    accent === "amber"  ? "text-accent-amber" :
    accent === "violet" ? "text-accent-violet":
                          "text-accent-cyan";
  return (
    <div className="bg-surface-raised border border-surface-border rounded-md p-2.5">
      <div className="text-[10px] text-compact text-ink-muted">{label}</div>
      <div className={clsx("text-lg font-semibold mt-0.5 nums-tabular", tint, mono && "text-base text-mono-tech")}>
        {value}
      </div>
    </div>
  );
}

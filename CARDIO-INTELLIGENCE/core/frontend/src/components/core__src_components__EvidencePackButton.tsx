/**
 * Recorded Evidence Pack download button.
 *
 * Pulls GET /api/v1/cases/{id}/evidence-pack and triggers a JSON download.
 * The bundle includes case + decision + appeal + every agent_runs row +
 * reviewer_actions + live compliance scorecard + business value + most recent
 * TriZetto envelope + bundle_sha256 (tamper-evident over the whole thing).
 *
 * Downloads only the server-produced recorded artifact; unavailable services return an error.
 */
import { Download, FileLock2, Loader2 } from "lucide-react";
import { useState } from "react";

import { api } from "../lib/core__src_lib__api";

interface Props {
  caseId: string;
}

export function EvidencePackButton({ caseId }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
    const bundle = await api.getEvidencePack(caseId);

    const sha = (bundle as { bundle_sha256: string }).bundle_sha256;
    if (typeof sha !== "string" || !/^[0-9a-f]{64}$/i.test(sha)) throw new Error("The service returned an evidence pack without a valid SHA-256 digest.");
    setLastHash(sha.slice(0, 16));

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cardioton-evidence-${caseId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evidence pack could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-surface-raised border border-surface-border rounded-2xl p-4 flex items-center gap-4 flex-wrap">
      <FileLock2 size={20} className="text-accent-amber shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-primary">
          Recorded evidence pack
        </div>
        <div className="text-[11px] text-ink-muted mt-0.5 leading-snug">
          Single-file JSON bundle: case + decision + appeal + agent_runs + reviewer_actions
          + live CMS-0057-F scorecard + business value + TriZetto envelope. Bundle
          SHA-256 tamper-evident over the entire payload.
        </div>
        {lastHash && (
          <div className="mt-1 text-[10px] text-mono-tech text-ink-faint">
            last bundle: <code className="text-ink-body">{lastHash}…</code>
          </div>
        )}
        {error && (
          <div className="mt-1 text-[11px] text-accent-red">{error}</div>
        )}
      </div>
      <button
        type="button"
        onClick={download}
        disabled={downloading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent-amber/40 text-accent-amber hover:bg-accent-amber/10 transition-colors disabled:opacity-50 text-sm"
      >
        {downloading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Building bundle…
          </>
        ) : (
          <>
            <Download size={14} />
            Download evidence pack
          </>
        )}
      </button>
    </div>
  );
}

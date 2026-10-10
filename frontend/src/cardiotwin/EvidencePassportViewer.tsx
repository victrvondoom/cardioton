import { useCallback, useState } from "react";
import { cardio } from "./api";

/* ─── Types ─────────────────────────────────────────────── */
interface PassportIntegrity {
  content_sha256: string;
  signature_ed25519: string;
  signer_public_key_b64: string;
  canonical_format: string;
  tamper_evident: boolean;
}
interface PassportGovernance {
  status: string;
  approver_id: string | null;
  approver_name: string | null;
  approval_timestamp: string | null;
  approval_scope: string | null;
  reviewed_content_sha256: string | null;
  ai_autonomous_prescribing_forbidden: boolean;
  notes: string | null;
}
interface VerifyChecklist { check: string; status: string; details: string; }
interface VerifyResult {
  is_valid: boolean;
  tamper_detected: boolean;
  computed_sha256: string;
  recorded_sha256: string;
  signature_valid: boolean;
  governance_valid: boolean;
  checklist: VerifyChecklist[];
  verified_at_utc: string;
}
interface SemanticField { field: string; status: string; original: unknown; reimported: unknown; }
interface SemanticScore {
  total_fields: number;
  preserved: number;
  dropped: number;
  mutated: number;
  score_pct: number;
  grade: string;
}

/* ─── StatusBadge ───────────────────────────────────────── */
function StatusBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
      color: ok ? "#0d9" : "#f44",
      background: ok ? "rgba(0,221,153,.12)" : "rgba(255,68,68,.12)",
      border: `1px solid ${ok ? "rgba(0,221,153,.3)" : "rgba(255,68,68,.3)"}`,
    }}>
      <span style={{ fontSize: 16 }}>{ok ? "\u2713" : "\u2717"}</span> {label}
    </span>
  );
}

/* ─── HashDisplay ───────────────────────────────────────── */
function HashDisplay({ label, hash }: { label: string; hash?: string }) {
  if (!hash) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{ color: "#8af", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{label}</span>
      <div style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 11,
        background: "rgba(255,255,255,.04)", padding: "6px 12px", borderRadius: 6,
        color: "#cdf", wordBreak: "break-all", marginTop: 4,
        border: "1px solid rgba(136,170,255,.12)",
      }}>
        {hash}
      </div>
    </div>
  );
}

/* ─── VerifyPanel ───────────────────────────────────────── */
function VerifyPanel({ result }: { result: VerifyResult }) {
  return (
    <div style={{
      background: result.is_valid ? "rgba(0,221,153,.06)" : "rgba(255,68,68,.06)",
      border: `1px solid ${result.is_valid ? "rgba(0,221,153,.2)" : "rgba(255,68,68,.2)"}`,
      borderRadius: 12, padding: 20, marginTop: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 28 }}>{result.is_valid ? "\uD83D\uDD12" : "\u26A0\uFE0F"}</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: result.is_valid ? "#0d9" : "#f44" }}>
            {result.is_valid ? "Passport Verified — Integrity Intact" : "TAMPER DETECTED — Integrity Compromised"}
          </div>
          <div style={{ fontSize: 11, color: "#8af", marginTop: 2 }}>Verified at {result.verified_at_utc}</div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {result.checklist.map((c, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 14px", borderRadius: 8,
            background: c.status === "PASSED" ? "rgba(0,221,153,.06)" : "rgba(255,68,68,.08)",
            border: `1px solid ${c.status === "PASSED" ? "rgba(0,221,153,.15)" : "rgba(255,68,68,.15)"}`,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e6ed" }}>{c.check}</div>
              <div style={{ fontSize: 11, color: "#7a8a9f", marginTop: 2 }}>{c.details}</div>
            </div>
            <StatusBadge label={c.status} ok={c.status === "PASSED"} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── FhirRoundTripPanel ────────────────────────────────── */
function FhirRoundTripPanel({ score, fields }: { score: SemanticScore; fields: SemanticField[] }) {
  const gradeColors: Record<string, string> = { A: "#0d9", B: "#4af", C: "#fa0", F: "#f44" };
  return (
    <div style={{
      background: "rgba(136,170,255,.04)", border: "1px solid rgba(136,170,255,.12)",
      borderRadius: 12, padding: 20, marginTop: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 900, color: gradeColors[score.grade] ?? "#8af",
          border: `3px solid ${gradeColors[score.grade] ?? "#8af"}`,
          background: "rgba(0,0,0,.3)",
        }}>
          {score.grade}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e0e6ed" }}>FHIR Semantic Integrity: {score.score_pct}%</div>
          <div style={{ fontSize: 12, color: "#7a8a9f" }}>
            {score.preserved} preserved / {score.dropped} dropped / {score.mutated} mutated of {score.total_fields} fields
          </div>
        </div>
      </div>
      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(136,170,255,.15)" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", color: "#8af" }}>Field</th>
              <th style={{ textAlign: "center", padding: "6px 8px", color: "#8af" }}>Status</th>
              <th style={{ textAlign: "right", padding: "6px 8px", color: "#8af" }}>Original</th>
              <th style={{ textAlign: "right", padding: "6px 8px", color: "#8af" }}>Re-imported</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => {
              const clr = f.status === "PRESERVED" ? "#0d9" : f.status === "MUTATED" ? "#fa0" : "#f44";
              return (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                  <td style={{ padding: "5px 8px", color: "#c8d4e0", fontFamily: "monospace" }}>{f.field}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center" }}>
                    <span style={{ color: clr, fontWeight: 700, fontSize: 11 }}>{f.status}</span>
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", color: "#9aa8b8", fontFamily: "monospace" }}>{String(f.original)}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right", color: "#9aa8b8", fontFamily: "monospace" }}>{String(f.reimported ?? "—")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────── */
export default function EvidencePassportViewer({
  features,
  caseId,
}: {
  features: Record<string, unknown>;
  caseId?: string;
}) {
  const [passport, setPassport] = useState<Record<string, unknown> | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [fhirResult, setFhirResult] = useState<{ score: SemanticScore; fields: SemanticField[] } | null>(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const passportId = (passport as Record<string, unknown> | null)?.passport_id as string | undefined;

  const generate = useCallback(async () => {
    setLoading("Generating Evidence Passport...");
    setError("");
    setVerifyResult(null);
    setFhirResult(null);
    try {
      const p = await cardio.createPassport(features as Record<string, number | string>, caseId);
      setPassport(p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate passport");
    }
    setLoading("");
  }, [features, caseId]);

  const verify = useCallback(async () => {
    if (!passportId) return;
    setLoading("Verifying cryptographic integrity...");
    setError("");
    try {
      const r = await cardio.verifyPassport(passportId);
      setVerifyResult(r as unknown as VerifyResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed");
    }
    setLoading("");
  }, [passportId]);

  const signOff = useCallback(async () => {
    if (!passportId) return;
    setLoading("Executing clinical sign-off...");
    try {
      const signed = await cardio.signOffPassport(passportId, "ESC/ACC Heart Team Review");
      setPassport(signed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign-off failed");
    }
    setLoading("");
  }, [passportId]);

  const tamperDemo = useCallback(async () => {
    if (!passportId) return;
    setLoading("Simulating tampering...");
    try {
      const r = await cardio.tamperTest(passportId);
      const vr = (r as Record<string, unknown>).verification_result;
      setVerifyResult(vr as unknown as VerifyResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Tamper test failed");
    }
    setLoading("");
  }, [passportId]);

  const roundtrip = useCallback(async () => {
    if (!passportId) return;
    setLoading("Executing FHIR round-trip...");
    try {
      const r = await cardio.fhirRoundtrip(passportId);
      const si = (r as Record<string, unknown>).semantic_integrity as Record<string, unknown>;
      setFhirResult({
        score: (si.semantic_integrity_score as SemanticScore),
        fields: (si.field_results as SemanticField[]),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Round-trip failed");
    }
    setLoading("");
  }, [passportId]);

  const integrity = passport ? (passport as Record<string, unknown>).integrity as PassportIntegrity | undefined : undefined;
  const governance = passport ? (passport as Record<string, unknown>).governance as PassportGovernance | undefined : undefined;
  const clinicalFacts = passport ? (passport as Record<string, unknown>).clinical_facts as Record<string, unknown> | undefined : undefined;
  const dataQuality = clinicalFacts?.data_quality as Record<string, unknown> | undefined;

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(14,18,28,.95), rgba(20,28,44,.95))",
      borderRadius: 16, padding: 24, color: "#e0e6ed",
      border: "1px solid rgba(136,170,255,.1)",
      boxShadow: "0 8px 32px rgba(0,0,0,.4)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#8af" }}>
            {"\uD83D\uDCDC"} Global Evidence Passport
          </h2>
          <div style={{ fontSize: 12, color: "#7a8a9f", marginTop: 4 }}>
            Tamper-evident, SHA-256 sealed, Ed25519 signed cardiovascular assessment record
          </div>
        </div>
        <button
          onClick={generate}
          disabled={!!loading}
          style={{
            padding: "10px 22px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #4488ff, #6644ff)", color: "#fff",
            fontWeight: 700, fontSize: 13, opacity: loading ? 0.5 : 1,
            transition: "all .2s",
          }}
        >
          {passport ? "\u27F3 Regenerate" : "\u26A1 Generate Passport"}
        </button>
      </div>

      {loading && (
        <div style={{
          padding: 16, borderRadius: 10, background: "rgba(136,170,255,.08)",
          border: "1px solid rgba(136,170,255,.15)", textAlign: "center",
          color: "#8af", fontSize: 13, animation: "pulse 1.5s infinite",
        }}>
          {loading}
        </div>
      )}

      {error && (
        <div style={{
          padding: 12, borderRadius: 8, background: "rgba(255,68,68,.08)",
          border: "1px solid rgba(255,68,68,.2)", color: "#f88", fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {passport && !loading && (
        <>
          {/* Passport Summary */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16,
          }}>
            <div style={{ background: "rgba(255,255,255,.03)", padding: 14, borderRadius: 10, border: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ fontSize: 11, color: "#7a8a9f", textTransform: "uppercase", fontWeight: 700 }}>Passport ID</div>
              <div style={{ fontSize: 13, fontFamily: "monospace", color: "#8af", marginTop: 4 }}>
                {passportId}
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,.03)", padding: 14, borderRadius: 10, border: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ fontSize: 11, color: "#7a8a9f", textTransform: "uppercase", fontWeight: 700 }}>Data Completeness</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: (dataQuality?.completeness_score_pct as number) >= 80 ? "#0d9" : "#fa0", marginTop: 4 }}>
                {dataQuality?.completeness_score_pct as number}%
              </div>
            </div>
          </div>

          {/* Integrity */}
          <HashDisplay label="Content SHA-256" hash={integrity?.content_sha256} />
          <HashDisplay label="Ed25519 Signature" hash={integrity?.signature_ed25519} />

          {/* Governance */}
          {governance && (
            <div style={{
              background: "rgba(255,255,255,.03)", padding: 14, borderRadius: 10,
              border: "1px solid rgba(255,255,255,.06)", marginBottom: 12,
            }}>
              <div style={{ fontSize: 11, color: "#7a8a9f", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
                Human Governance
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <StatusBadge
                  label={governance.status}
                  ok={governance.status === "CLINICALLY_APPROVED"}
                />
                {governance.approver_name && (
                  <span style={{ fontSize: 12, color: "#9aa8b8" }}>
                    Approved by {governance.approver_name} at {governance.approval_timestamp}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#8af", marginTop: 6 }}>
                {"\uD83D\uDEAB"} AI Autonomous Prescribing: FORBIDDEN
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button onClick={verify} disabled={!!loading} style={btnStyle("#0d9")}>
              {"\uD83D\uDD0D"} Verify Integrity
            </button>
            <button onClick={signOff} disabled={!!loading || governance?.status === "CLINICALLY_APPROVED"} style={btnStyle("#4488ff")}>
              {"\u2705"} Clinical Sign-Off
            </button>
            <button onClick={tamperDemo} disabled={!!loading} style={btnStyle("#fa0")}>
              {"\u26A0\uFE0F"} Tamper Demo
            </button>
            <button onClick={roundtrip} disabled={!!loading} style={btnStyle("#a855f7")}>
              {"\uD83D\uDD04"} FHIR Round-Trip
            </button>
          </div>

          {/* Verification Result */}
          {verifyResult && <VerifyPanel result={verifyResult} />}

          {/* FHIR Round-Trip Result */}
          {fhirResult && <FhirRoundTripPanel score={fhirResult.score} fields={fhirResult.fields} />}
        </>
      )}
    </div>
  );
}

const btnStyle = (color: string): React.CSSProperties => ({
  padding: "8px 18px", borderRadius: 8, border: `1px solid ${color}40`,
  background: `${color}15`, color, cursor: "pointer",
  fontWeight: 700, fontSize: 12, transition: "all .2s",
});

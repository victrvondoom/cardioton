export interface ExtractedField {
  name: string; value: string; confidence: number; source_excerpt: string; page: number | null;
}
export interface IntakeResult {
  classification: { document_type: string; confidence: number; rationale: string; quality_flags: string[] };
  ocr: { engine: string; full_text: string; extracted_fields: ExtractedField[]; overall_confidence: number; phi_redactions_applied: number; pages: number };
  clinical_snapshot_partial: Record<string, unknown>;
  risk_flags: string[]; requires_human_review: boolean; audit: Record<string, unknown>;
  fhir_bundle: { resourceType: string; entry?: unknown[] } | null;
  requested_treatment: { name?: string; j_code?: string | null };
  patient_initials: string | null; missing_fields: string[]; case_ready: boolean;
}
export interface IntakeDraft { patient_initials: string; requested_treatment: string; payer_id: string }

/** Preparation checks describe missing evidence; they never approve a clinical record. */
export function intakeBlockers(result: IntakeResult, draft: IntakeDraft): string[] {
  const blockers = new Set<string>();
  if (!result.case_ready) blockers.add("The source is not ready for case creation.");
  for (const field of result.missing_fields ?? []) blockers.add(`Missing source evidence: ${field.replaceAll("_", " ")}.`);
  if (result.fhir_bundle?.resourceType !== "Bundle" || !result.fhir_bundle.entry?.length) blockers.add("A populated source FHIR Bundle is required.");
  if (!result.ocr.full_text.trim()) blockers.add("No readable document text was extracted.");
  if (!Number.isFinite(result.ocr.overall_confidence) || result.ocr.overall_confidence < .7) blockers.add("Extraction confidence is below the 70% review threshold.");
  if (!Number.isFinite(result.classification.confidence) || result.classification.confidence < .7) blockers.add("Document classification needs review.");
  for (const field of result.ocr.extracted_fields.filter(field => !Number.isFinite(field.confidence) || field.confidence < .7)) blockers.add(`Check low-confidence field: ${field.name}.`);
  for (const flag of result.classification.quality_flags) blockers.add(`Document quality: ${flag.replaceAll("_", " ")}.`);
  for (const flag of result.risk_flags) blockers.add(`Review risk flag: ${flag.replaceAll("_", " ")}.`);
  if (result.requires_human_review) blockers.add("The extraction service requires human review.");
  if (!draft.patient_initials.trim()) blockers.add("Confirm patient initials.");
  if (!draft.requested_treatment.trim()) blockers.add("Confirm requested treatment.");
  if (!draft.payer_id.trim()) blockers.add("Select and confirm the patient's payer.");
  return [...blockers];
}

export function prepareIntakeReviewPackage(result: IntakeResult, draft: IntakeDraft, file: Pick<File, "name" | "type" | "size" | "lastModified">, blockers = intakeBlockers(result, draft)) {
  return {
    schema: "cardioton.intake-review-package.v1",
    prepared_at: new Date().toISOString(),
    source: { filename: file.name, media_type: file.type, size_bytes: file.size, last_modified: file.lastModified, sha256: result.audit.document_sha256 ?? null },
    review: { status: "pending", clinical_approval: false, review_required: true, blockers, unconfirmed_case_details: { ...draft }, source_case_ready: result.case_ready },
    clinical_snapshot_partial: result.clinical_snapshot_partial,
    fhir_bundle: result.fhir_bundle,
    extraction: { classification: result.classification, ocr: result.ocr, risk_flags: result.risk_flags, requires_human_review: result.requires_human_review, missing_fields: result.missing_fields },
    provenance: result.audit,
    scope: "Prepared for human review. This package does not create a case, approve treatment, or send evidence to another system.",
  };
}
export type IntakeReviewPackage = ReturnType<typeof prepareIntakeReviewPackage>;

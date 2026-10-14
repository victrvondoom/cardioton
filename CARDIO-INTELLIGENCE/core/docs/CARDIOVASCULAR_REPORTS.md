# Cardiovascular report evidence adapter

Implemented locally on 9 October 2026. This is a deterministic, bounded report-to-evidence adapter, not a comprehensive clinical interpretation service. It reuses authentication, the existing database pool, PDF dependencies, historical time parser and generic Evidence Passport export.

## API

All routes use `/api/v1/cardiotwin/anatomy` and require authentication. Protected report reads, writes, exports and deletion require both the authenticated organization and the uploading user.

| Method | Path | Contract |
|---|---|---|
| POST | `/reports` | Multipart `file`, `case_ref`, `patient_ref`, `synthetic`, optional timezone-aware `study_at`; returns a pending report, HTTP 201 |
| GET | `/reports` | Required `case_ref`, optional timezone-aware `as_of`; authorized, historical projection |
| GET | `/reports/{id}` | Optional `as_of`; 404 if unavailable at that boundary |
| POST | `/reports/{id}/review` | `finding_id`, `action` (`approve`, `reject`, `correct`), `expected_version`, optional `normalized` and `note`; reviewer/admin only |
| GET | `/reports/{id}/passport` | Optional `as_of`; existing portable artifact Passport, source hashes and decision history |
| DELETE | `/reports/{id}` | Erases payload; retains minimized tenant/user/report-id/erasure-time audit |

Concurrent review uses version compare-and-swap, returning 409 for stale versions. Correction and approval are separate actions. A correction cannot invent a new source finding, vessel, segment, quantity or diagnosis. Negated, conflicting, uncertain and unsupported findings cannot be silently approved into anatomical highlights. Original extracted certainty remains separate from subsequent review certainty.

## Supported inputs and mappings

Text-layer PDF, UTF-8 text and JSON FHIR `DiagnosticReport`, `Observation`, or a Bundle containing these resources are accepted. Scanned PDFs fail with a clear OCR requirement. DICOM, image segmentation, comprehensive FHIR profile validation, OCR and model interpretation are not implemented by this adapter.

Explicit LAD/LCX/RCA stenosis and calcification, stated coronary segment, LVEF, atrial fibrillation, named valve regurgitation/stenosis and pulmonary hypertension have supported reference associations. Heart failure, congestion, unspecified myocardial infarction and general cardiac disease remain general evidence cards when location is unspecified. Atrial fibrillation associates with both atria; it does not portray structural injury. Exact structured LOINC quantities cover LVEF, heart rate and systolic/diastolic blood pressure with checked UCUM units. Arbitrary laboratory codes are preserved as unsupported rather than guessed.

Clause-level qualifiers propagate through shared vessel lists, including `No LAD stenosis or RCA stenosis`. Conflicting quantities and source statements retain uncertainty. Extraction supports a finite vocabulary; absence of a match does not mean absence of disease. Report type, source filename, SHA-256, full extracted text, source excerpt, structured original, author where present, study precision, receipt time and mapping version are retained.

## Historical boundaries

Clinical occurrence, receipt and review are distinct clocks. A visible approved annotation requires a supported dated finding, source availability and approval decision at or before `as_of`. Replay projects historical status, correction, audit and report version, excluding later decisions and later FHIR resources. Original full FHIR payload is withheld from historical projections so future resources cannot leak through provenance.

An undated report remains reviewable but creates no authoritative historical annotation. A date without a timezone has a conservative possible occurrence interval across UTC−12 through UTC+14. Its upper bound is used for exclusion; this is not a fabricated observation hour. An explicitly supplied timestamp must be timezone-aware and consistent with the source. New locally persisted records store `extracted_certainty`; older development records load conservatively, particularly if they already contained a correction.

## Security and persistence

The streaming multipart limit is 8 MiB plus 64 KiB metadata overhead; a report file is capped at 8 MiB and JSON at 2 MiB. PDF parsing checks signature, EOF, encryption and active content, then bounds pages (30), individual decoded streams (2 MiB), total decoded content (16 MiB), text (300,000 characters), object count and recursion. Context-local pypdf configuration bounds decompression. JSON depth/node budgets and finite quantities prevent unbounded payloads. Parsing runs in the existing threadpool. Source URLs are not fetched; clinical data are not sent to external AI or environmental providers. Report responses use `Cache-Control: no-store`.

Production uses owner-and-tenant scoped PostgreSQL JSONB storage. Table creation currently uses additive `CREATE TABLE IF NOT EXISTS` through the existing database pool. This still needs a reviewed deployment migration and PostgreSQL integration/RLS verification. The application predicates are tested; database RLS, encryption, retention scheduling and backup erasure are not certified.

SQLite is accepted only with the existing opt-in development demo database and `synthetic=true`. Real reports fail closed without PostgreSQL. The strict uploader-only scope protects access but does not yet provide a cross-user coordinator-to-reviewer sharing workflow. Use the reviewer demo account for the entire fictional upload/review journey.

Original uploaded binaries are not archived. Extracted text, excerpts, original FHIR, source metadata and hash remain until report deletion. Downloaded Passports and database backups have independent retention obligations. No regulatory or clinical validation claim is made.

## Verification

`backend/tests/cardiotwin/test_anatomy_reports.py` covers parsing, qualifier scope, exact codes/units, unsupported claims, safe corrections, approval/rejection, historical reviews, future FHIR exclusion, owner/tenant isolation, concurrent review, malicious/oversized documents, deletion, persisted-record compatibility and Passport tampering. Browser journey and aggregate results are in [delivery](CARDIO_INTELLIGENCE_DELIVERY.md).

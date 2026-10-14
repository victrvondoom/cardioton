# CardioTwin requirement matrix

Audit date: 2026-10-10. This matrix records the final verified continuation slice in [CARDIOTWIN_EXECUTION_REPORT.md](CARDIOTWIN_EXECUTION_REPORT.md). A connected screen or passing isolated test does not establish clinical validation, complete standards conformance or production readiness.

| Major requirement | Status | Evidence and remaining boundary |
|---|---|---|
| Preserve the current application, fonts, routes, design tokens and adjacent modules | VERIFIED_WORKING | Existing React/FastAPI implementation retained; TypeScript, production build and existing module regressions passed. |
| Inspect Git history and pre-existing work | BLOCKED_EXTERNAL_DEPENDENCY | Workspace has no `.git` directory; history/uncommitted state cannot be determined. No destructive reset or automated commit/push/deploy. |
| Maintain resumable context and requirement tracking | VERIFIED_WORKING | `CARDIOTWIN_CONTEXT.md`, this matrix and execution report capture actual architecture, commands, boundaries and remaining work. |
| Global dashboard backed by persisted metrics and honest states | VERIFIED_WORKING | Both API aliases, stored counts, unavailable/null status, errors/empty states, drilldowns and UI behavior covered by in-process/API and component tests. |
| Public literature and trial source connectors | VERIFIED_WORKING | Opt-in ClinicalTrials.gov API v2 and Europe PMC metadata adapters; both had live retrieval smoke checks. FDA/regulatory/safety, PubMed full text, polling and institutional FHIR are not connected. |
| Normalize, deduplicate, retain provenance and snapshots | VERIFIED_WORKING | SQLite stable identity, digest validation, parser/source version history and field diffs tested. SQLite is single-host. |
| Research brief from question through retrieval and passport | VERIFIED_WORKING | End-to-end local authenticated HTTP smoke plus persisted-task, idempotency, retry, failure, provenance and tamper tests. Brief is deterministic metadata extraction, not AI synthesis. |
| Evidence-flow graph with actual counts, filters, drilldowns and accessible alternative | PARTIALLY_IMPLEMENTED | Four category transitions use unique stored record identities; SVG and table fallback tested. Lexical categories remain proposals; no causal relation or scientific support is established. Large-scale performance/browser accessibility review outstanding. |
| Mapping explanation, reviewer state and public shared curation | VERIFIED_WORKING | Reviewer/admin plus configured curator organization, optimistic snapshot comparison, public rationale disclosure, audit version and API tests. |
| Trial explorer, intervention groups, safety and regulatory views | PARTIALLY_IMPLEMENTED | Trial metadata search/phase/sort/detail works; pipeline groups source labels only. Efficacy synthesis, official regulation and safety event feeds are absent; empty safety feed means unknown. |
| Quality dimensions and ranked evidence gaps | PARTIALLY_IMPLEMENTED | Quality defaults to unassessed; disclosed categorical gap ordering. No independent risk-of-bias or applicability assessment. |
| Physics, statistical uncertainty and guideline logic | VERIFIED_WORKING | Domain/limiting solver tests, missing calibration behavior, model interval/confidence semantics and missing FFR rule outcomes tested. Scenario results are not clinical predictions. |
| Research artifact digest, independent verification and export | VERIFIED_WORKING | Owner-scoped unsigned research passports; source hashes recomputed by API and offline CLI; changed payload/raw snapshot tests fail verification. |
| Clinical passport governance, lineage and durable signatures | PARTIALLY_IMPLEMENTED | Authenticated research review, owner/organization checks and tamper detection tested. Clinical store remains in-memory; Ed25519 key is ephemeral and has no durable author identity. |
| FHIR import/export and semantic round trip | PARTIALLY_IMPLEMENTED | Limited collection Bundle scope, validation, local preservation of unmapped features and unit/reference failures covered with synthetic tests. Not full FHIR R4 validation or live hospital integration. |
| Authentication, tenant scope, private query handling and safe logs | VERIFIED_WORKING | Owner-scoped tasks/passports, clinical passport owner/tenant filters, public query redaction and safe connector errors tested. |
| Full deployment, legal compliance, multi-host scale and lifecycle governance | MISSING | No cross-border legal review, retention program, multi-host persistence, comprehensive rate limiting, institutional signing key management or deployment was performed. |
| Git history audit | BLOCKED_EXTERNAL_DEPENDENCY | Source snapshot omits repository metadata. |

Statuses: `VERIFIED_WORKING`, `IMPLEMENTED_UNVERIFIED`, `PARTIALLY_IMPLEMENTED`, `MISSING`, `BLOCKED_EXTERNAL_DEPENDENCY`. The execution report separates passed, failed and deselected checks and gives exact acceptance limitations.

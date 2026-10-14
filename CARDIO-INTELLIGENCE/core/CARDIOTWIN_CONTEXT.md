# CardioTwin continuation checkpoint

Updated: 2026-10-10 (Asia/Calcutta). Final engineering detail, requirement statuses, commands and acceptance limits: [docs/CARDIOTWIN_EXECUTION_REPORT.md](docs/CARDIOTWIN_EXECUTION_REPORT.md) and [docs/CARDIOTWIN_REQUIREMENTS.md](docs/CARDIOTWIN_REQUIREMENTS.md).

## Project and preservation

CardioTwin is a source-grounded cardiovascular research workspace in an existing React 18/TypeScript/Vite and FastAPI/Pydantic application. Existing routes, font/theme tokens, dashboard shell and CardioTwin/Hemo/Atlas/FHIR, OneHealth/AquaHealth/OncoTwin modules were retained. The source snapshot has no `.git`, so history and prior uncommitted changes are unknowable. No commit, push or deployment was made.

## Implemented workflow

`/cardiotwin/global` now connects query, explicit offline fixture or opt-in public metadata retrieval, persisted normalized record/source snapshots, inspectable category mappings, metadata-gap brief, scoped research passport and SHA-256 verification/export. Both API prefixes `/api/cardiotwin/global` and `/api/v1/cardiotwin/global` remain. `CARDIOTWIN_GLOBAL_LIVE_SOURCES` defaults empty; configure `clinicaltrials,europe_pmc` for bounded public-source retrieval. A separate `CARDIOTWIN_GLOBAL_CURATOR_ORGS` allowlist authorizes reviewer/admin users to approve public mapping categories; decisions and rationale are public.

An orchestrator executes deterministic bounded tools, owner-scoped idempotent tasks, retry/error traces and persisted results; there are no autonomous LLM agents. Research and source persistence are SQLite single-host. Public search queries are removed from public provenance (including legacy records) while private task scope retains the original query. Synthetic fixture corpus: four invented records; no fake trials or efficacy outcomes.

Scientific scope was tightened: model bootstrap intervals and confidence labels carry explicit semantics; conformal coverage remains unavailable without calibration data; missing guideline inputs are unevaluated; the main CardioTwin page no longer presents generated waveforms as ECG telemetry, model outputs as anatomy/FFR, or invented treatment/sign-off as clinical decisions. The reduced-order solver and legacy modules remain. FHIR retains unsupported source values under local codes and marks their standard meaning unresolved.

## Limits to retain

The global brief is deterministic metadata reporting without LLM synthesis. Mapping is lexical and requires review. No FDA/safety/regulatory feed, monitoring, independent risk-of-bias or efficacy synthesis exists. FHIR is a tested subset, not complete conformance or live hospital exchange. Clinical passports still use process-memory persistence and an ephemeral signing key, which does not establish durable identity or survive restart. Interrupted task recovery and large-scale graph/browser accessibility validation remain undone. See the requirement matrix/report before expanding claims.

## Verification

Final verification: CardioTwin backend **472 passed, 2 warnings**; frontend **230 passed** across 47 files; TypeScript check, production Vite build and Ruff passed. Vite reports existing large Three Fiber/MapLibre bundle advisory. Global workflow component coverage includes query reassessment, retry, passport-input binding, metric filtering and drawer keyboard focus. Live browser automation was unavailable, so no manual browser visual pass is claimed. Existing unrelated marked integration/live tests are deselected by repository defaults.

Run local synthetic mode from repository root using `./start-track7.ps1 -SQLite`. Run detailed tests and verification commands from the execution report. Do not imply external source connectivity unless the source is configured and a successful retrieval event is stored.

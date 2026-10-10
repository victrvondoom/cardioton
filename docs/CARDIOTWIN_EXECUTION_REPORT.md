# CardioTwin execution report

Updated: 2026-10-10. Source snapshot: `cardioton-main/`. This report records verified work and remaining acceptance limits for the master execution prompt.

## Product slice delivered

The existing React 18/Vite dashboard and FastAPI CardioTwin routes remain the product shell. The global workspace now follows one persistent research path: query → explicitly labelled fixture or opted-in public metadata discovery → normalization and source snapshot → category mapping and inspectable history → evidence-gap brief → owner-scoped unsigned passport → online or offline digest check → export. Dashboard elements are connected to those API responses and stored records; errors, unavailable sources and empty safety data are visible. The existing CardioTwin, Hemo, Atlas, FHIR, OneHealth, AquaHealth and OncoTwin workspaces remain present.

The source registry consists of the ClinicalTrials.gov API v2 and Europe PMC metadata adapters, disabled unless explicitly enabled in `CARDIOTWIN_GLOBAL_LIVE_SOURCES`. An offline corpus has four deliberately invented records with `DEMO-` identifiers; these are not studies or clinical findings. A direct runtime smoke test retrieved one actual current study and one Europe PMC record; the normal demo and tests remain offline. Public provenance URLs discard search query strings, including in older history projections; owner-scoped passports preserve the original retained data needed for digest verification. Public mapping review is restricted to reviewer/admin users in configured curator organizations, and the UI explains that review comments become public.

Research tasks use one deterministic orchestrator and bounded source tools. Source retries, total retry budgets, stage deadline checks, owner-scoped idempotency, visible errors, actual traces and per-task passports are implemented. The task interface describes logical capabilities; this is not a set of autonomous LLM agents. A digest proves byte integrity and does not prove research validity or author identity.

The reduced-order physics engine remains available and now validates domains and documents its assumptions. The main CardioTwin page no longer presents generated waveforms as patient ECG, classifier probabilities as measured vessel anatomy/FFR, or classifier output as treatment advice, guideline consensus, clinician sign-off or a cryptographic seal. Its model panels show model probabilities and explicitly identify illustrative displays. The legacy telemetry API no longer derives FFR, ischemia, lumen geometry, shear, SYNTAX or a treatment plan from classifier probabilities. The model response now exposes that bootstrap 10th–90th percentile ranges do not establish outcome coverage and that confidence labels are heuristics. The global conformal path reports no calibration guarantee without calibration data. The guideline module only flags supplied FFR values against a cited research threshold; missing values remain unevaluated and no treatment is selected.

FHIR support is a limited R4 collection-Bundle adapter. It validates object shapes, resource identities, one-patient scope, references, quantities and supported units. Legacy standardized fields use configured terminology mappings; remaining source features and missingness are retained in explicit local encodings, with unresolved semantic mappings reported. This is not complete FHIR conformance or a live hospital connection.

## Major requirement status

| Requirement | Status | Evidence and remaining boundary |
|---|---|---|
| Preserve existing routes, shell, fonts, modules and theme | VERIFIED_WORKING | Existing global route/classes/navigation retained; TypeScript and production build pass. Related module regressions previously passed 254 tests. |
| Audit Git history and uncommitted state | BLOCKED_EXTERNAL_DEPENDENCY | This workspace is a source snapshot with no `.git`; status/history cannot be established. No reset, commit, push or deployment was performed. |
| Dashboard metrics, refresh/error/empty states, record drilldowns | VERIFIED_WORKING | In-process API and component tests; metrics derive from stored corpus. Unconfigured safety and public task counts are null/unavailable, never invented zeroes. |
| Public source retrieval and normalized provenance | VERIFIED_WORKING | Optional ClinicalTrials.gov v2 and Europe PMC adapters; direct live response smoke test; offline fixture tests. No PubMed full text, FDA safety feed, periodic monitor, license enforcement or hospital source is connected. |
| Research workflow, task state, traces, retry and idempotency | VERIFIED_WORKING | Persistent SQLite research store, owner isolation, explicit task limits, trace tests, stage deadlines and end-to-end HTTP smoke test. Synchronous network/database calls cannot be interrupted mid-call; process-crash stale-running recovery is not implemented. |
| Evidence graph, filtering, source drilldown and accessible table | PARTIALLY_IMPLEMENTED | Counts and four source→area→modality→task→indication transitions derive from unique records, with SVG/table and export. Lexical categories are proposals and do not prove semantic, causal or clinical support; large-graph load is unmeasured. |
| Mapping review and shared-data privacy | VERIFIED_WORKING | Auth role, designated curator organization, optimistic snapshot check, rationale/audit history and public UI disclosure. Configure curator organization IDs before enabling this feature. |
| Trials, pipeline, regulatory and safety views | PARTIALLY_IMPLEMENTED | Trial metadata and filtering/search/sort/drilldown work. Pipeline is intervention-label grouping. No independent efficacy synthesis, FDA/regulatory feed or safety feed is connected; empty feed means unknown. |
| Scientific evidence quality and actionable gaps | PARTIALLY_IMPLEMENTED | Separate unassessed fields and explicit categorical metadata-gap priorities. No risk-of-bias, calibration, replication or applicability review has been performed. |
| Physics, uncertainty and guideline governance | VERIFIED_WORKING | Solver limiting/domain tests; no fabricated telemetry anatomy or treatment; unavailable calibration is disclosed; cited threshold screen has missing-input outcomes. These methods are not validated for clinical care. |
| Research passport and independent digest verification | VERIFIED_WORKING | Store-independent CLI, source-snapshot hash recomputation and online/offline tamper tests. Research passports are unsigned. |
| Clinical passport signing, identity and persistence | PARTIALLY_IMPLEMENTED | Tamper checks and authenticated research review are tested. Clinical passport store is process-memory; Ed25519 demo key is ephemeral, so signatures do not survive process restart and provide no durable signer identity. |
| FHIR exchange and round-trip report | PARTIALLY_IMPLEMENTED | Synthetic collection bundles and invalid cases tested, with explicit loss/unresolved reporting. Supported subset is deliberately limited; no external validator or live endpoint was exercised. |
| Auth, ownership, tenant isolation and sensitive query privacy | VERIFIED_WORKING | Research task/passport scopes and clinical passport owner/org filters are covered; public source search text is stripped from public provenance. No clinical patient import is allowed by global research service. |
| Accessibility and responsive states | IMPLEMENTED_UNVERIFIED | Keyboard drawer focus containment, native summary navigation, reduced motion and SVG/table alternatives have component coverage. Browser/assistive technology visual verification was unavailable in this session. |
| Full production, global compliance and deployment readiness | MISSING | No production deployment, cross-border legal assessment, data-retention program, multi-host database, rate limiting or institutional key management was performed. |

## Verification record

Commands run from `backend/` using the task-local `..\.venv\Scripts\python.exe`, unless noted:

- `python -m ruff check ...` on changed CardioTwin modules/tests: passed.
- Full CardioTwin tests: **472 passed, 2 warnings** (`tests/cardiotwin --disable-warnings`).
- Ruff on changed CardioTwin modules, tests and passport verifier: passed. Two import-order issues in existing anatomy/training modules were fixed as part of the checked CardioTwin code.
- Existing security, interoperability and OneHealth/AquaHealth/OncoTwin regression selection: **254 passed, 45 deselected, 1 warning** in the earlier regression run. Deselected means those marked integration/live cases were intentionally outside the configured run; do not count them as skips.
- Frontend TypeScript check: passed.
- Full frontend suite: **230 passed** across 47 files.
- Production Vite build: passed. Existing Three Fiber and MapLibre bundles exceed Vite's 500 KB advisory threshold.
- Global interaction tests: **11 passed** for query reassessment, retries, passport-input binding, metric filtering and drawer keyboard focus.
- HTTP smoke: authenticated local demo login → research query → persisted task/trace/passport → PASSED integrity check. Exported artifact independently passed `backend/scripts/verify_research_passport.py`.
- Browser automation was unavailable (`No browser is available`); no visual/browser-runtime pass is claimed.

## Run locally

From repository root, use the existing local demo launcher:

```powershell
.\start-track7.ps1 -SQLite
```

The launcher starts the application in synthetic local mode and opens its browser. The workspace route is `/cardiotwin/global`. Live research adapters are off by default. To enable public metadata retrieval, configure `CARDIOTWIN_GLOBAL_LIVE_SOURCES=clinicaltrials,europe_pmc` for the backend process. Designated public mapping curators require `CARDIOTWIN_GLOBAL_CURATOR_ORGS` with organization IDs whose authenticated users also have reviewer/admin roles.

Verification commands:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m pytest tests/cardiotwin --disable-warnings
python -m ruff check app/api/cardio_global.py app/api/cardiotwin.py app/cardiotwin tests/cardiotwin
Set-Location ..\frontend
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## Next acceptance work

1. Decide and implement restart recovery for tasks persisted as running after a process crash.
2. Give the clinical passport store durable, append-only storage and institutional key custody before relying on signatures across restarts.
3. Validate the limited FHIR bundle with an official R4 validator and expand supported terminology/value mappings as needed.
4. Configure, monitor and rate-limit live source access; add FDA/regulatory feeds only with verified contracts and provenance.
5. Measure graph performance on representative corpus sizes and do manual keyboard/screen-reader/browser review.
6. Review/remove stale legacy CardioTwin claims in `docs/CARDIOTWIN.md` that still describe earlier calibration/confidence behavior; API/UI now expose narrower current semantics.

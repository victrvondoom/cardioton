# Local delivery — CARDIO-HEMO TWIN

Date: 7 October 2026. All implementation changes are local and uncommitted.

## Existing features preserved

The coronary CardioTwin workspace, eight original API endpoints, model artifact,
HeartViewer, evaluation and sensitivity flows remain present. Oncology, OncoTwin,
OneHealth, AquaHealth, case workflows, governed model gateway and existing human
review/exchange routes are preserved. The six original integration files contain
additions only. Follow-up repairs extend health metadata, share shell/navigation
polling and correct a test wait. No database/schema, deployment, credentials or
`.env` change was made. Five pre-existing modified files and the pre-existing 3D
component have unchanged SHA-256 hashes compared with the initial audit. Sidenav's
existing navigation/UI was preserved exactly; its independent case polling was
replaced with the existing shared feed.

## New CardioTwin features

- Eight-axis longitudinal cardiovascular state with OBSERVED/DERIVED/INFERRED/
  UNKNOWN distinctions and explicit confidence/coverage/uncertainty.
- Explainable congestion state transitions, cardiac-function/rhythm histories,
  cardio-renal temporal associations and observational intervention comparisons.
- Server-side as-of replay that gates both event and evidence-availability time.
- WHY graph with source timestamps, original FHIR JSON, transformation and
  provenance; UNKNOWN states retain inspectable stale/conflicting source links.
- Evidence-sensitivity audit: withhold one modality and rerun the same engine;
  display changes without claiming physiology, prediction or treatment effects.
- Knowledge-arrival ledger for delayed results, with no future pending-result
  disclosure in earlier replays.
- Authenticated stateless FHIR intake, separate inferred FHIR artifact,
  snapshot export and existing Evidence Passport hash-chain integration.
- Fixed entirely synthetic scenario and a two-minute replay/source-tracing demo.
- No LLM dependency, approval endpoint, prescription, patient-record mutation or
  autonomous clinical action.
- Correct timezone-equivalent release tracing and full fractional-second date
  replay; snapshot filenames use the actual reconstructed boundary.
- FHIR passport export retains intake issues, mapping contract and original
  source provenance. Extreme numeric/nesting failures are quarantined safely.
- Replay avoids repeatedly hashing source records; CPU work uses worker threads
  with an independent async-request responsiveness regression.
- Explicit unknown case/agent metrics in SQLite mode, shared sidebar/shell
  polling, and authenticated-session isolation of feed caches.

## Files modified by this implementation — exactly 13

1. `backend/app/api/cardiotwin.py`
2. `backend/app/onehealth/passport.py`
3. `frontend/src/cardiotwin/api.ts`
4. `frontend/src/main.tsx`
5. `frontend/src/routes/CardioTwin.tsx`
6. `frontend/src/workflow/areas.ts`
7. `backend/app/api/healthz.py`
8. `backend/tests/test_http_resilience.py`
9. `frontend/src/components/ActivityTicker.tsx`
10. `frontend/src/lib/liveFeed.ts`
11. `frontend/tests/live-feed.test.tsx`
12. `frontend/tests/cohorts-page.test.tsx`
13. `frontend/src/components/Sidenav.tsx` (preserves pre-existing navigation work)

## Files created by this implementation — exactly 24

1. `backend/app/cardiotwin/hemodynamics/__init__.py`
2. `backend/app/cardiotwin/hemodynamics/api.py`
3. `backend/app/cardiotwin/hemodynamics/demo.py`
4. `backend/app/cardiotwin/hemodynamics/diagnostics.py`
5. `backend/app/cardiotwin/hemodynamics/engine.py`
6. `backend/app/cardiotwin/hemodynamics/fhir.py`
7. `backend/app/cardiotwin/hemodynamics/schema.py`
8. `backend/app/cardiotwin/hemodynamics/service.py`
9. `backend/tests/cardiotwin/test_hemodynamics_diagnostics.py`
10. `backend/tests/cardiotwin/test_hemodynamics_fhir_api.py`
11. `backend/tests/cardiotwin/test_hemodynamics_integrity.py`
12. `frontend/src/cardiotwin/EvidenceSensitivity.tsx`
13. `frontend/src/cardiotwin/HemoPanels.tsx`
14. `frontend/src/cardiotwin/hemoTypes.ts`
15. `frontend/src/routes/CardioHemoTwin.tsx`
16. `frontend/tests/cardiohemo-diagnostics.test.tsx`
17. `frontend/tests/cardiohemo-page.test.tsx`
18. `docs/CARDIO_HEMO_TWIN.md`
19. `docs/CARDIO_HEMO_DELIVERY.md`
20. `output/playwright/cardiohemo-evidence-sensitivity.png`
21. `output/playwright/cardiohemo-mobile.png`
22. `output/playwright/cardiohemo-original-record.png`
23. `backend/tests/cardiotwin/test_hemodynamics_runtime.py`
24. `frontend/tests/sidenav-feed.test.tsx`

Generated ignored verification output also includes frontend `dist/`, Python/test
caches, existing synthetic launcher's logs/SQLite demo records under
`backend/.cache/track7/`, and browser session snapshots plus the synthetic
download under `.playwright-cli/`. Temporary browser assertion scripts were
created in `backend/.cache/`: `cardiohemo_browser_verify.js`,
`cardiohemo_browser_mobile.js`, `cardiohemo_final_browser.js` and
`cardiohemo_fhir_export_browser.js`. The follow-up also created a temporary
snapshot text file, a Sidenav pre-repair backup, launcher stdout/stderr logs,
and `cardio-hemo-fhir-export-verified.json` in those ignored cache directories.
These are test/runtime artifacts, not product source or patient records.
No Git staging occurred.

## Test results

| Check | Result |
| --- | --- |
| Full offline backend regression | **935 passed, 108 deselected**, one existing multipart deprecation warning |
| Final new Cardio-Hemo backend tests | **120 passed**, included in the full offline run |
| Full frontend Vitest suite | **34 files / 175 tests passed** |
| Frontend TypeScript | Passed |
| Frontend production build | Passed; existing large MapLibre/Three.js chunk warnings |
| Backend Ruff (`app tests`) | Passed |
| Strict mypy for new hemodynamics package | Passed, 8 source files |
| Python compilation | Passed |
| Derived FHIR artifact base shape | Passed installed R4B Bundle validation; not R4 profile certification |
| Existing isolated Track 7 exchange demo | Passed independent HTTP receiver exchange, 13/13 semantic fields, changed resource IDs, round trip, rejected broken bundle and passport verification |
| Git whitespace check | Passed |

Backend full command from `backend`:

```powershell
python -m pytest -o addopts= -q -m 'not integration and not live and not postgres'
```

Final focused command from `backend`:

```powershell
python -m pytest -o addopts= -q tests/cardiotwin/test_hemodynamics_diagnostics.py tests/cardiotwin/test_hemodynamics_fhir_api.py tests/cardiotwin/test_hemodynamics_integrity.py tests/cardiotwin/test_hemodynamics_runtime.py
```

Frontend commands from `frontend`: `npm run typecheck`, `npm test`,
`npm run build`. No external database or live-provider tests were run.

Browser verification used the Playwright skill and the existing isolated
synthetic launcher on API 8765, independent receiver 8766 and UI 5181. Verified:
demo sign-in; live workspace; 10 August replay excludes both delayed BNP and
future admission; evidence-sensitivity WHY; 12 August delayed-result source
trace; expanded original JSON/provenance; responsive 390px workspace; and actual
Evidence Passport download. The downloaded 12 August passport passes the existing
`verify_portable()` verifier, remains unapproved and contains no hospitalization.

The follow-up restarted the stopped API using the existing isolated launcher in
a hidden background process, retaining the existing UI server. A fresh monitored
browser reload and 10 August replay produced **zero failed HTTP responses, zero
JavaScript errors and zero unsupported case/agent requests**. The reconstructed
boundary was `2026-08-10T23:59:59.999999+00:00`, with delayed BNP and future
admission excluded. The shared ticker explicitly shows disconnected case storage.

An actual FHIR import containing one valid synthetic source and one quarantined
comparator returned 200; its dedicated FHIR passport export returned 200, matched
the displayed reconstruction exactly and downloaded successfully. The downloaded
passport passed `verify_portable()` and retained its intake issue, provenance and
`REQUIRED`/unapproved review status. Earlier browser log entries from before the
shared-sidebar repair remain in the session log; the final monitored run was clean.

Final local preview: `http://127.0.0.1:5181/cardiotwin/hemo`, API 8765 and independent
receiver 8766. The synthetic loopback demo requires its existing demo sign-in.

## Known limitations

Rules/windows are research heuristics requiring clinical calibration and
prospective evaluation. Confidence is evidence support, never a validated
probability. Source timestamps/provenance are caller assertions, not proof of
authenticity; missing historical versions cannot be recovered. The native FHIR
mapping is a selected exact-code contract, not complete profile/terminology
validation. Unsupported text/status/units are excluded rather than inferred.

Reconstruction is stateless and bounded. Continuous telemetry ingestion,
persisted longitudinal snapshots and Cardio-Hemo-specific clinical review storage
are not added. `/interop` remains the existing review/exchange workbench; the link
does not automatically bind a snapshot to an exchange job. Clinical approval is
always false in this module. No production database, live provider, deployment
or real-patient validation is claimed.

Large replay timelines still require repeated state scans and large response
payloads. Local synthetic timings were 0.293 seconds/300 records, 1.117 seconds/600
and 13.609 seconds/3000; these are observations, not guarantees. Worker execution
keeps the event loop responsive but does not remove CPU cost or provide a durable
job queue. Case storage remains unavailable in SQLite mode; no database-backed
workflow has been fabricated or given a successful readiness result.

## Git status

HEAD remains `c2559a8e426f74b8802b1b10c954f8c39c005d19`, unchanged from the initial
read-only audit. No commit, push, branch, tag, release, PR, action, checkout,
reset or stash was performed.

There are 13 implementation-modified tracked files listed above, plus these five
**pre-existing modifications preserved unchanged**:

- `frontend/src/components/AppShell.tsx`
- `frontend/src/components/SearchPalette.tsx`
- `frontend/src/components/TopBar.tsx`
- `frontend/src/routes/Architecture.tsx`
- `frontend/tests/navigation.test.tsx`

The 24 implementation-created files remain untracked. The pre-existing untracked
`frontend/src/cardiotwin/CardiologyArchitecture3D.tsx` and `k8s/remote/` files remain
untouched. `.env` has the same SHA-256 hash as at task start and is not staged.

See `CARDIO_HEMO_TWIN.md` for the architecture audit, rules, limitations,
remediation ledger, API contract and two-minute demo instructions.

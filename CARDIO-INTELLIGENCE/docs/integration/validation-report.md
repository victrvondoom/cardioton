# Validation report

Every number below comes from an actual run against this tree. "Before" is the fresh copy of
the originals before any renaming; "after" is the final tree.

| Check | Before | After | New problems |
|---|---:|---:|---:|
| Files | 6467 | 6467 | - |
| Unresolved local JS/TS imports | 82 | 82 | 0 |
| Unresolved local Python imports | 7 | 7 | 0 |
| Python files failing to parse | 8 | 8 | 0 |
| Invalid JSON / notebooks | 0 | 0 | 0 |
| Invalid TOML | 0 | 0 | 0 |
| Shared filenames with no recorded reason | - | 0 | - |
| Runtime files mentioning a pre-rename name | - | 0 | - |

## Runtime verification

- **Originals untouched**: 6467 original files re-hashed, 0 differ; git tracked changes: none
- **SlicerHeart snapshot fingerprint**: identical (207 hashed files, cef657c00b63cdff…)
- **Core backend pytest (CI offline suite)**: pristine 108 deselected, 1268 passed, 1 skipped | unified 108 deselected, 1268 passed, 1 skipped
- **Core backend ruff**: pristine 41 findings | unified 41 findings (same rules and counts; pre-existing)
- **Core backend mypy (strict)**: pristine 120 errors in 13 files | unified 120 errors in 13 files (pre-existing)
- **Core frontend tsc --noEmit**: pristine 15 type errors | unified 15 type errors; identical set after mapping renamed paths (pre-existing in the original)
- **Core frontend vitest**: pristine 60 files, 352 tests passed | unified 60 files, 352 tests passed
- **Core frontend vite build**: pristine succeeds | unified succeeds

## Copy stage

- 6467 files copied with 0 errors. SHA-256 of every original is in `source-manifest.csv`
  (`sha256_original`).
- Core: exactly the files git tracks. Modules: everything except installed dependencies and caches
  (`node_modules`, virtualenvs, `__pycache__`, `.next`, `.expo`, tool caches). Committed `dist/` and
  `build/` folders are kept.
- Secrets and local env files were kept out of the project files. After verification they were moved next to the code that reads them: `HopHacks-main/.env`, `HopHacks-main/.env.backup`, `case-twin-main/.env.production`, `heartAI-main/api2/vespa-app/security/clients.pem`, `heartAI-main/src/.env.local`, `heartAI-main/src/heartaivespa/security/clients.pem`, `heartAI-main/src/heartaivespa/security/private-key.pem`.
- Integration patches: `core/backend/app/integrations/slicerheart/__init__.py`, `core/backend/app/integrations/slicerheart/api.py`, `core/backend/app/integrations/slicerheart/provenance.py`, `core/docs/ASSET_LICENSES.md`, `core/docs/SLICERHEART_INTEGRATION.md`.

## Problems already present in the originals (carried over unchanged)

- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/App.tsx -> ./components/AppShell`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./components/AuthContext`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./components/RequireAuth`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Agents`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/BulkImport`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/CaseDetail`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Cases`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Cohorts`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Compare`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Compliance`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Dashboard`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Eval`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Intake`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Landing`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Login`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/OncologyStack`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Policies`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/PolicyDiff`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Architecture`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Industrialize`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Reviewer`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/ROI`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Settings`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./routes/Signup`
- unresolved local js/ts imports: `core/archive/legacy/frontend_BACKUP/src/main.tsx -> ./styles/index.css`
- unresolved local js/ts imports: `core/frontend/src/assets/logos/index.ts -> ./cardiotwin-logo.svg?raw`
- unresolved local js/ts imports: `core/frontend/src/assets/logos/index.ts -> ./cardiotwin-icon.svg?raw`
- unresolved local js/ts imports: `core/frontend/tests/atlas.test.tsx -> ../src/main.tsx?raw`
- unresolved local js/ts imports: `core/frontend/tests/cardiohemo-page.test.tsx -> ../src/main.tsx?raw`
- unresolved local js/ts imports: `core/frontend/tests/navigation.test.tsx -> ../src/main.tsx?raw`
- … 52 more unresolved local js/ts imports
- unresolved local python imports: `core/backend/app/onehealth/fhir.py -> fhir.resources.R4B.bundle`
- unresolved local python imports: `core/backend/tests/cardiotwin/test_hemodynamics_diagnostics.py -> fhir.resources.R4B.bundle`
- unresolved local python imports: `core/backend/tests/interop/test_fhir_api.py -> fhir.resources.R4B.capabilitystatement`
- unresolved local python imports: `core/backend/tests/oncotwin/test_api.py -> fhir.resources.R4B`
- unresolved local python imports: `core/backend/tests/oncotwin/test_twin.py -> fhir.resources.R4B`
- unresolved local python imports: `core/backend/tests/test_intake_case_payload.py -> fhir.resources.R4B`
- unresolved local python imports: `core/backend/tests/test_vault_roundtrip.py -> app.privacy`
- python files failing to parse: `core/backend/app/api/cardio_global.py:1`
- python files failing to parse: `core/backend/app/cardiotwin/analytics/global_service.py:1`
- python files failing to parse: `core/backend/tests/cardiotwin/test_global_frontend_integration.py:1`
- python files failing to parse: `core/backend/tests/cardiotwin/test_global_intelligence.py:1`
- python files failing to parse: `core/ops/slicerheart/bridge_worker.py:98`
- python files failing to parse: `modules/aortavision-3d/backend/schemas/patient_schema.py:1`
- python files failing to parse: `modules/cardio-inspection/ml/calibration.py:1`
- python files failing to parse: `modules/case-twin/copy_of_the_original_medsiglip_embedding_generation.py:22`

## Workspace cleanup (originals removed)

- Unified tree re-checked against the manifest before and after: 0 mismatches.
- 1193 pristine originals of rewritten module files saved to `originals-of-rewritten-files.zip` (verified).
- 3254 files that existed only in the originals were moved into place, each hash-checked after the move:
  - local PostgreSQL clusters (backend/.cache/*-postgres): 2877
  - logs: 135
  - generated outputs (output/): 131
  - other local state: 98
  - secrets and keys: 12
  - local SQLite databases: 1
- 101 top-level entries deleted: the original project folders, the core's
  git-tracked files (still in git history) and installed dependencies and caches.
- Secrets that no project `.gitignore` covered got a local-only entry in `.git/info/exclude`, so no
  file was added to the project.
- `modules/case-twin/.env.production` stays visible to git: its project's own `.gitignore` tracks it on purpose (a public API URL setting, not a credential).

## Intelligence Hub and error fixes

The modules are now visible in the core frontend (`/hub`, see the top-level README).

| Check | Result |
|---|---|
| Backend `pytest` | 1310 passed, 3 skipped (was 1268): new hub tests, rewritten extraction tests, and tests moved out of `app/` that previously never ran |
| `ruff check app tests` | clean |
| `mypy app` (strict) | no issues in 476 files (was 95 errors, all in two stale test files inside `app/`) |
| Frontend `tsc`, `vitest`, `vite build` | 0 errors, 352/352, builds |
| Module web apps (`core/scripts/build_hub_apps.py`) | 12 of 12 built |
| Browser check | hub, project page, 3D viewer, benchmarks and embedded CorTwin load with no console errors |

Defects fixed along the way:
- **Clinical text extraction** (`cardiotwin` service adapted from EpiCast):
  - Findings were matched as raw substrings, so `ar` (aortic regurgitation) matched "heart", `normal` matched "abnormal", `cp` matched "except" and `sob` matched "sober".
  - Matching is now whole-word.
  - Allergy and history extraction returned placeholders. They now return the items named in the note.
- **Evidence-continuity add endpoint**: passed duplicate keyword arguments.
- **Workflow event list**: React keys were undefined.
- **Dev proxy**: targeted `localhost`, which on Windows can resolve to IPv6 while the API listens on IPv4 only. Large downloads were reset as a result. It now targets `127.0.0.1`.

## Not run

- Model accuracy re-evaluation: needs each project's datasets and training environment.
- Test suites for the absorbed modules: not run. Their web apps were installed and built for the hub; the
  build skips each project's own type-check step.
- The modules' own Python APIs: not started, so embedded apps that predict through them show their interface only.
- HawkScan dynamic security scan: no `HAWK_API_KEY` is configured in this environment.
- Model accuracy re-evaluation: needs each project's datasets and training environment.
- Starting services end to end: needs the `.env` secrets, which were deliberately not copied.

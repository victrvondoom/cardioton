> Current finished-app setup: [REPRODUCIBILITY.md](REPRODUCIBILITY.md). Phase histories below retain their original verification dates. Use `make install prepare verify build run` for v1.

# CardioScope foundation

`PLAN.md` defines the architecture and engineering rules. `README.md` retains the hackathon reference material. This document describes setup and verification for the implemented application; it does not replace that plan. See [MODELING.md](MODELING.md) for the historical Phase 3 development-only comparison, [FINAL_EVALUATION.md](FINAL_EVALUATION.md) for the completed single final holdout evaluation, and [INTEGRATION.md](INTEGRATION.md) for the frozen-model/form/anatomy workflow and [EXPLANATIONS.md](EXPLANATIONS.md) for Phase 6 verified positive-class explanations.

## Prerequisites and locked installation

- Python **3.12** (the current setup was tested with 3.12.14).
- [uv](https://docs.astral.sh/uv/) for the project-local `.venv` and `uv.lock`.
- Node.js **22.13 or newer in the 22.x line, or 24+**, and npm (tested here with Node 25.3.0/npm 11.7.0). The new jsdom test environment requires this slightly higher minimum than Vite alone.
- Internet for the initial packages, UCI workbook, and BodyParts3D mesh subset.

From the repository root:

```sh
uv sync --locked
uv pip install --no-deps --require-hashes -r config/explanations-runtime.lock.txt
cd frontend
npm ci
cd ..
```

Python versions of runtime/test dependencies are fixed in `uv.lock`. Frontend direct versions are exact in `package.json`, with the transitive resolution in `package-lock.json`. Use the lockfiles, not fresh dependency upgrades. Matplotlib generates evaluation figures. Phase 6 uses a separate hash-locked SHAP runtime add-on, verified on macOS ARM64/Python 3.12, to preserve the original development `uv.lock` and all original model-runtime versions. Do not use the old `uv sync --extra explanations` resolution: its llvmlite is incompatible with Python 3.12. `make install` performs both steps above; rerunning `uv sync` may remove the add-on, so reinstall it afterwards. See [the dependency correction](EXPLANATIONS.md#runtime-and-smallest-corrections). See the current Linux validation in [HARDENING.md](HARDENING.md); all pinned scientific versions remain unchanged. The application references the four original frozen development pipelines in place and verifies their identity against the completed final evaluation; it does not copy or modify them.

## Prepare the real sources

The commands below describe initial Phase 1 acquisition. The sources are already locked here: during model development use `make verify`, not `make prepare`. See the strict cached-snapshot requirement in [MODELING.md](MODELING.md).

```sh
.venv/bin/python -m ml.data prepare
.venv/bin/python -m ml.anatomy prepare
```

For the finished v1 product, `make prepare` verifies the committed snapshot; it does not call these historical acquisition commands.

Dataset acquisition checks the ZIP against the SHA-256 from `PLAN.md`, extracts only the exact workbook, and stores source URL, license, DOI, UTC acquisition time, ZIP hash, and workbook hash under `data/raw/uci-411/`. Cached downloads are verified. A changed source checksum fails; it is not accepted as an automatic update.

The anatomy pipeline retrieves the current archive's mapping tables/license and locks their hashes. It uses HTTP ZIP byte ranges to fetch only the selected meshes, checks archive snapshot headers on each range, and validates ZIP CRCs, OBJ coordinates, faces, and bounds. The snapshot is locked before the first mesh, and per-mesh checksum records survive an interrupted run. A partial download can be resumed against the same pinned source version.

The finished v1 snapshot now tracks the verified raw source, prepared 83-mesh subset, configuration, lockfiles, manifests and checksums. A fresh clone runs `make prepare` to verify the included files without acquisition or split rebuilding. The acquisition CLI below is historical Phase 1 documentation. If upstream `LATEST` changes, fail rather than mixing versions; restoring a matching cached archive/subset or explicitly reviewing a new source version will be necessary.

## What the data pipeline produces

| Artifact | Purpose |
| --- | --- |
| `artifacts/data/audit.json` | Descriptive full-source integrity audit: columns, storage types, observed values/ranges, class counts, duplicate/constant checks, and label inconsistencies |
| `artifacts/data/feature_manifest.json` | Exact 55 input columns, development-only category domains, explicit target encodings, missing-input policy, and undocumented units |
| `artifacts/data/split.json` | Locked content/group IDs, 242 development/61 holdout membership, per-target 5-outer/3-inner CV membership, source/config fingerprints, library version, and manifest checksum |

`Cath` is the CAD target (`CAD` = 1, `Normal` = 0). `LAD`, `LCX`, and `RCA` use `Stenotic` = 1 and `Normal` = 0. None of the four columns, their configured aliases, or unknown derived columns are allowed in the model inputs. Strict input order is preserved.

The record ID is a content hash, **not a fabricated clinical patient ID**. No authoritative patient identifier is present. Identical predictor rows would share a conservative duplicate group. Known repeated patients cannot be independently verified from this source. Those groups stay together through holdout, outer folds, and inner folds. On the current dataset there are no exact duplicates or identical-predictor groups.

Holdout membership is fixed before any fitting. The split is CAD-stratified; both classes are checked for each vessel. Development CV is target-stratified, with group-aware splitters when duplicate groups exist. Insufficient class/group support fails rather than silently reducing the fold counts. `ml.splits.load_development(root)` gives future training code only development features, targets, groups, and nested folds. It validates pinned source/config/artifact bytes, development outcomes and exact persisted fold/group membership before returning data. Phase 3 corrected the old loader’s full-label split-rebuild verification; holdout target cells are now never decoded. See [the modeling safety record](MODELING.md#leakage-boundary-and-smallest-loader-correction).

Phase 1 did not fit imputation, scaling, feature selection, calibration, or models. Phase 3 fitted scaling/encoding and models inside development training folds only, then froze final pipelines fitted on the 242 development records. Phase 4 evaluated those unchanged pipelines once on the 61-record holdout through a separate guarded reader. Category domains still come from development records only. Full-source descriptive audit ranges are not preprocessing parameters, clinical reference ranges, or rejection thresholds. Numeric sentinel meanings and clinical units remain unverified. Raw spellings/case and the constant column are preserved.

Both prepare commands are idempotent: reruns verify existing immutable artifacts instead of replacing them. Changed inputs, seed, strategy, mappings, or locked versions produce an error. Do not delete or regenerate a holdout to obtain favorable results. A genuinely necessary contract/source correction must be documented and versioned deliberately.

## What the anatomy pipeline produces

- `assets/anatomy/sources.json`: exact mapping/license URLs, checksums, sizes, and attribution.
- `assets/anatomy/archive_snapshot.json`: ZIP size, ETag, and last-modified timestamp.
- `assets/anatomy/checksums/*.json`: locked hash, geometry statistics, and bounds for each selected mesh.
- `assets/anatomy/manifest.json`: FMA/BP/FJ resolution, disjoint groups, raw mesh paths, checksums, and one shared center/scale.
- `assets/anatomy/meshes/*.obj`: **83** raw OBJ leaves, preserving the original coordinates.

Group counts are **heart base 30**, **LAD 18**, **LCX 6**, **RCA 29**. The original heart has 83 leaves; subtracting the 53 named coronary leaves prevents double rendering. BP representations are not OBJ filenames. Each mesh is served at `/anatomy/meshes/FJ....obj` when present; `/api/anatomy` supplies the assembly manifest.

The viewer applies `(source_position - center) * scale` once to the whole assembled model. It never normalizes each artery separately. Phase two verified the official Z-up/negative-Y-anterior coordinate system and millimetre anatomy units; immutable preparation metadata remains unchanged. There is no decimation or GLB conversion. The viewer now supports real mesh selection, focus, orbit/zoom, reset, anterior/posterior presets and isolation. See [the browser verification record](anatomy/VERIFICATION.md) for evidence and limitations; this is not medical expert validation.

The current archive's CC BY 4.0 attribution is retained. The old original-site license is not used to label unrelated assets. See [SOURCE_NOTES.md](SOURCE_NOTES.md) for the verified source quirks and smallest parser correction.

## Checks

After source preparation:

```sh
.venv/bin/python -m ml.data verify
.venv/bin/python -m ml.anatomy verify
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check backend ml tests
.venv/bin/python -m ruff format --check backend ml tests
cd frontend
npm test
npm run typecheck
npm run build
cd ..
```

Or run `make verify test lint build`.

Unit tests use clearly synthetic fixtures for invalid labels, leakage, group overlap, unknown categories, tampering, and range errors. Source integration tests use the real downloaded workbook/mapping/OBJ caches without network calls or holdout decoding/evaluation. New modeling tests fit small synthetic pipelines; the real full comparison is a separate explicit CLI run. They skip only when their real caches have not been prepared; prepare both sources to run the full suite.

Verified on 1 October 2026: **43 tests passed with no skips**, Ruff lint/format checks passed, both real-source integrity checks passed, and a clean `npm ci` followed by the TypeScript/production build passed. Re-running data preparation preserved the locked artifacts. A localhost API smoke check confirmed schema/anatomy loading, development-profile validation, mesh serving, unavailable-model HTTP 503, and HTTP 404 for raw dataset/split paths. The built React screen also loaded successfully in the browser. This verifies the foundation only; it does not measure model performance or validate a rendered anatomical view.

## Run CardioScope

Build the frontend, then start the backend:

```sh
cd frontend
npm run build
cd ..
.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000`. One FastAPI process serves the built React app and API. Restart the backend if its first startup preceded the frontend build or anatomy preparation, so static mounts are present.

For development, start the backend with `--reload` and, in another terminal:

```sh
cd frontend
npm run dev
```

Vite proxies `/api` and `/anatomy` to port 8000. Its terminal prints the local frontend URL. Startup verifies the original models and final completion receipt before accepting predictions; the pinned caches, models and evaluation evidence must remain present. The app renders reference anatomy with a sticky educational disclaimer. Load the development example, review the 55 fields and run prediction to populate all four outputs and matching vessel colors. WebGL 2 is required for 3D. Source/mesh failures, renderer errors and context loss show explicit fallback states; numerical predictions remain usable independently. A supported renderer can be retried after a failure. If port 8000 is occupied, use another loopback port with the built app (the Phase 5 browser check used 8001).

## API surface

| Endpoint | Current behavior |
| --- | --- |
| `GET /api/health` | Artifact presence, verified model availability and explicit integrity failure message |
| `GET /api/schema` | Exact input/target manifest; HTTP 503 when unprepared |
| `POST /api/profiles/validate` | Complete input-contract validation and stable profile/schema/model fingerprints |
| `GET /api/anatomy` | Prepared source/group/assembly manifest; HTTP 503 when unprepared |
| `POST /api/predict` | Strict validation then four frozen-model probabilities/classes at 0.5 with profile/model/schema identity; HTTP 503 on unavailable/failed inference, with no partial probabilities |
| `GET /api/examples` | One labeled complete development example, record/source identity and selection rule; no labels or holdout examples |
| `GET /api/model-information` | Minimal plain-text saved-performance and limitation note |

Profile requests have the shape `{"features": {"exact source field": "value"}}` and require all 55 real fields. No implicit missing-value defaults are fitted. Numeric values must be finite, integer columns integral, categories exact development-supported strings; booleans and numeric strings are rejected. A successful validation is a schema check, not clinical validation or a prediction. API routes do not expose raw dataset/holdout files. No profile persistence is implemented.

The TypeScript API client uses abort signals and runtime prediction-response validation. Editing a profile clears old outputs immediately; request generations reject obsolete validation/prediction responses even if cancellation is ignored. Results must match the backend-validated snapshot's profile/schema/model fingerprints. The viewer verifies the complete assembly and disposes obsolete geometry. Its typed vessel-state interface now receives actual LAD/LCX/RCA probabilities with model/profile identifiers. `probabilityColor` is shared by meshes, cards and legend. Shared selection connects result cards, mesh clicks and controls. Selection highlighting is separate from model-output magnitude; neither implies measured lesion severity.

## Phase boundary

Ready: reproducible project environment, source acquisition, audits, explicit schema, locked holdout/nested CV, group/leakage guards, real anatomy subset/provenance, API contracts, and the interactive source-based anatomy workflow. Phase two passed all 43 Python and 30 frontend tests without skips, strict TypeScript/production build, source verification and lint checks. [Visual verification](anatomy/VERIFICATION.md) records actual clicks/isolation/controls, source clarifications and approximately 60 FPS in the local browser.

Phase three additionally completed development-only fold-fitted preprocessing, the frozen 15-configuration search, all four nested-CV comparisons, persisted development pipelines/results/plots/fingerprints and measured runtime. A complete unchanged rerun reproduced results and model selection. Its verification passed 66 Python tests and 30 frontend tests. See [MODELING.md](MODELING.md) for full results and weaknesses.

Phase four completed the single final evaluation on all 61 locked holdout records using the unchanged four frozen pipelines. Its verification passed 91 Python tests and 30 frontend tests. The permanent guard refused a repeated run before model loading or outcome access; saved predictions reproduce metrics, curves, uncertainty and comparisons without inference. See [FINAL_EVALUATION.md](FINAL_EVALUATION.md) for results and limitations.

Phase five connected those exact models to strict API inference, the full form, a development-only example, numerical results and synchronized whole-vessel coloring. Current verification: **113 Python tests, 54 frontend tests**, safe source/anatomy and saved-final-result checks, Ruff, TypeScript and production build passed. Actual browser raycasting/selection, controls, edited-profile clearing/re-prediction and latency were verified. All 231 pre-phase immutable file checksums (including 180 Phase 1 inputs, every Phase 3/4 artifact and guard/receipt) remain unchanged. See [INTEGRATION.md](INTEGRATION.md).

For current evaluation status and reproducibility, use:

```sh
.venv/bin/python -m ml.evaluate_holdout status
.venv/bin/python -m ml.evaluate_holdout verify
```

`check` performs preflight without decoding holdout outcomes or running inference. `run` is the consumed once-only execution command and now refuses; there is no force/overwrite option. Do not retrain, change the predeclared search or regenerate folds after viewing holdout results. Development artifacts remain in `artifacts/development/`; final outputs live separately in `artifacts/final_holdout/`.

Not implemented: SHAP/explanations, separate calibration assessment, full evidence-page UI, final UI polish, comparison/export, or submission/report work. Development and final holdout performance have been measured; no clinical efficacy or calibrated-risk claim is made. Broader device testing and independent medical/anatomical review remain unfinished; there is no blocker for this completed phase.

## Phase 6 explanation setup and verification

The deterministic background and explanation configuration are saved in `artifacts/explanations/v1/background.json` and `config/explanations_v1.json`. On a matching cached checkout, `.venv/bin/python -m backend.explanations prepare` verifies those files without replacing them or regenerating data/splits. It reads only development feature membership for background selection.

`.venv/bin/python -m backend.benchmark_explanations` prints development-only backend latency and reconstruction checks; it performs no fitting or holdout inference. The full Python/frontend suites include explanation contracts, exact positive-output reconstruction, original-value/category grouping, stale responses, cancellation and selection synchronization. Current results and browser evidence are recorded in [EXPLANATIONS.md](EXPLANATIONS.md). The previously completed final evaluation remains unchanged: use only `.venv/bin/python -m ml.evaluate_holdout verify` to verify saved results.

## Phase 7 product and evidence

The main app now includes Prediction / Evidence navigation. `GET /api/evidence` exposes checksum-verified saved aggregate results; `GET /api/metadata` supplies trusted explanation configuration/background identity. These are read-only presentation endpoints and do not run evaluation. See [PRODUCT.md](PRODUCT.md) for sources, product behavior, verification, screenshots and immutable-file records. The original model/runtime/SHAP/anatomy contracts remain intact.

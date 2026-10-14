# Phase 7: evidence dashboard and product workflow

CardioScope now presents prediction, reference anatomy, positive-class explanations and frozen evaluation evidence in one application. This phase changes presentation and explanation identity verification only. Models, thresholds, splits, anatomy assets, SHAP computation/reference/configuration and evaluation artifacts remain unchanged.

## Evidence sources and boundary

`GET /api/evidence` reads only the aggregate saved output:

`artifacts/final_holdout/final-v1-f1fd0d4cdc334c65aba46c37fa68717b/results.json`

The backend verifies the durable completion receipt through `evaluation_status`, checks the saved results SHA-256 against the completed evaluation record, and checks application model/schema/development identity. All metric, confusion-matrix, uncertainty, frozen-candidate and development-comparison values are copied from that saved JSON without recomputation or rounding. Patient-level `predictions.json` is not served. The endpoint does not decode source rows, load holdout targets, invoke model inference, train, select models, bootstrap, or evaluate anything.

The development comparisons come from `targets.<target>.development_comparison.roc_auc`, already saved during Phase 4. They describe the nested **selection procedure**, while final results describe the frozen pipelines. The frontend preserves full precision in memory and displays three decimal places. Positive-class counts, 0.5 threshold, interval methods and limitations are retained.

The Evidence page includes:

- Four separate classifiers and the 303 / 242 / 61 record boundary.
- **Final holdout — 61 records**: ROC-AUC, accuracy, balanced accuracy, precision, recall, F1, Brier score and class counts for every target.
- Saved ROC-AUC and recall 95% intervals; the sample/independence/generalization caveats and interval methods.
- Confusion matrices with observed rows / predicted columns and explicit false-negative labels; LCX/RCA missed positives remain prominent.
- Nested development vs final ROC-AUC, methodology flow, frozen model configurations and bounded-complexity rationale.
- Explanation methods, an upfront interpretation warning and a full limitations section.
- UCI dataset/DOI and BodyParts3D CC BY 4.0 attribution, plus expandable technical identity.

## Explanation identity hardening

`GET /api/metadata` supplies the expected application model/schema/checksums and exact explanation configuration/background fingerprints. It constructs the existing `ExplanationService` only to verify/read its configuration identity; it does not import SHAP or construct/execute an explainer.

The frontend obtains this metadata independently of prediction startup. Every explanation must match the expected configuration/background as well as the profile, target, probability, application model, schema and target model checksum. Correctly formatted unexpected hashes are rejected. The render guard also checks these identities before showing an existing result. Metadata changes participate in effect cancellation/generation handling. Missing metadata makes explanations unavailable while numerical prediction remains usable.

`backend/explanations.py` and `backend/inference.py` are byte-identical to their pre-phase versions. The audited threshold adapter, aggregation, tolerances, reference and calculation paths have not changed.

## Product workflow

The main page has a labeled, grouped source-profile panel; field-group navigation and a bounded scroll region; a public development example; a clear prediction action; an overall CAD summary; three vessel cards; a framed 3D viewer and probability legend; and signed explanations with complete factor accounting. All 55 fields remain required, with exact source categories and no invented units or defaults.

Prediction/Evidence navigation keeps the profile, predictions, selected explanation, vessel/isolation state and actual orbit/zoom camera mounted in memory. The 3D frame loop pauses on Evidence; no database or persistence was added. Edits still clear old predictions and cancel explanations. New predictions still reset to CAD. Anatomy positions, coordinate transform, meshes/materials, groups and labels are unchanged.

The educational disclaimer remains visible while scrolling. A restrained teal/neutral presentation, explicit selected-state text, threshold-class text, signed numbers, labeled tables, associated input labels, a skip link and visible keyboard focus support accessibility without relying on color alone. Other medical boundaries remain stated next to outputs and explanations.

## Verification

Commands run in the existing locked runtime (no dependency upgrade or lock regeneration):

```sh
.venv/bin/python -m pytest -q
.venv/bin/ruff check backend ml tests
.venv/bin/ruff format --check backend ml tests
.venv/bin/python -m ml.data verify
.venv/bin/python -m ml.anatomy verify
.venv/bin/python -m ml.evaluate_holdout verify
cd frontend
npm test
npm run typecheck
npm run build
```

- **127 Python tests** passed, including existing explanation reconstruction tests and new aggregate-evidence/metadata checks.
- **69 frontend tests** passed, including unexpected configuration/background rejection, saved final metrics and matrices, failure handling, limitations/model text, navigation state retention and all 55 field labels.
- Ruff, TypeScript, production build, safe dataset verification and all 83 anatomy assets passed.
- Saved-result-only final verification passed. It uses saved prediction pairs; no new holdout inference or source target-cell decoding occurred.
- [IMMUTABLE_INPUTS.json](product/IMMUTABLE_INPUTS.json) records **256 protected files** before changes: all artifacts, cached source data, anatomy assets, configurations, ML source, original `uv.lock`, explanation implementation and inference implementation. Final checks match every file.

Only pre-existing dependency warnings remain: SHAP plotting deprecations, Three.js CJS deprecation in tests, and the build's large Three.js bundle warning. No dependency changes, post-processing, extra models or optional product features were introduced.

## Actual production-browser checks

The built frontend was served by the real backend at `http://127.0.0.1:8002/` (the user's existing server was not replaced).

- Loaded the existing public development example and obtained all four real predictions.
- Verified CAD/LAD log-odds and LCX/RCA probability explanations, same profile identity and correct vessel/card selection.
- Clicked a real RCA mesh; the anatomy, result card and explanation selection synchronized.
- Exercised anterior/posterior/reset/show-all/isolation, orbit and zoom. Observed approximately 60 FPS locally; this is not a hardware guarantee.
- Visited Evidence, checked exact visible metrics/matrices/limits and returned with the same profile, selected RCA, isolation and actual camera coordinates intact.
- Verified field-group navigation, 55 associated control labels and a 3 px visible keyboard focus ring.
- Inspected both pages at **1440×1000**, **1024×900**, and **390×844**. Page scroll width equals viewport width at all sizes. Anatomy height is 460 px on desktop/laptop and 400 px on mobile. Mobile explanation bars stack in one column without overflow.

Machine-readable browser observations: [targets](product/BROWSER_TARGETS.json), [interactions](product/BROWSER_INTERACTIONS.json), [responsive checks](product/BROWSER_RESPONSIVE.json).

Screenshots (real data and anatomy, no mocks):

- [Desktop prediction overview](product/desktop-prediction-overview.jpg) / [full workflow](product/desktop-prediction.jpg)
- [Desktop Evidence overview](product/desktop-evidence-overview.jpg) / [full Evidence page](product/desktop-evidence.jpg)
- [Laptop prediction](product/laptop-prediction.jpg) / [Evidence](product/laptop-evidence.jpg)
- [Mobile prediction](product/mobile-prediction.jpg) / [Evidence](product/mobile-evidence.jpg) / [probability explanation](product/mobile-explanation.jpg)

## Remaining submission work

Prepare the hackathon report, record the final demo, confirm submission-format/deadline requirements, and perform the requested final read-only submission audit after those materials are ready. This phase does not publish or submit anything. The prototype remains limited to the documented small same-source dataset and reference anatomy; UI polish does not change that evidence boundary.

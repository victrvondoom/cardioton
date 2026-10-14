# CardioScope Phase 5: frozen-model application integration

Completed on 1 October 2026. A complete profile now drives validated backend inference, all four numerical outputs, and matching whole-vessel colors in the real BodyParts3D viewer. This is implementation/verification documentation; no model or final-evaluation evidence was changed.

## Model loading and inference

`backend/inference.py` loads the original `artifacts/development/v1-bb08b3d0230a/models/*.joblib` files in place. It reuses the existing read-only preflight verifier, not the evaluation command or training module. Before deserialization it verifies all Phase 1 inputs, every Phase 3 artifact, schema/split/search/development fingerprints and runtime library versions. It then checks fitted feature order, preprocessing metadata, estimator parameters, classes `[0, 1]`, and fitted membership in exactly the 242 development records. The completed Phase 4 receipt must reference the same protocol, schema, development run and model checksums. Saved aggregate results are checksum-verified before use in the limitation note.

Frozen configurations remain CAD/LAD logistic C=0.1 with balanced weights; LCX forest depth 3/minimum leaf 10/unweighted; RCA forest depth 5/minimum leaf 10/unweighted. No model copies, refitting, reselection, calibration or threshold changes occur. Original `deployed: false` metadata remains an immutable historical Phase 3 snapshot; this application verifies and references those original bytes rather than changing it.

Application model fingerprint: `d955d81c63c3d1402766c7891fa8015919b737f36a7efb7e0130686c98e4bdcd`. This hashes the development-run fingerprint and all four model checksums. Exact model checksums remain in the [Phase 4 evaluation record](../artifacts/final_holdout/final-v1-f1fd0d4cdc334c65aba46c37fa68717b/evaluation_record.json).

Every request is validated, converted to a single named DataFrame in the exact 55-feature order, and passed through the saved pipelines. Each model returns its positive-class probability. Thresholding uses `>= 0.5`. CAD is its own classifier, never a vessel union. Component fitting methods are temporarily prohibited; a lock serializes inference while that prohibition and numerical thread limits are active. No application request invokes holdout loading/evaluation, split creation, training or source preparation.

Startup integrity failure leaves `models_loaded: false` and an explicit error; prediction/examples return HTTP 503. Schema failures also produce an explicit unavailable response. Pipeline failure never returns a partial set of targets. Profiles are not persisted or logged as request bodies.

## API

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Availability and model-integrity failure message |
| `GET /api/schema` | Unchanged exact feature/target contract |
| `POST /api/profiles/validate` | Strict input validation, profile/schema fingerprint, verified application model version |
| `POST /api/predict` | Four independent outputs with probabilities, thresholded classes, source encodings, candidate IDs, model checksums, threshold 0.5, profile/model/schema fingerprints and development-run identity |
| `GET /api/examples` | One complete labeled development example, source/record identity and selection rule; no outcomes |
| `GET /api/model-information` | Minimal plain-text saved-performance/limitation note; no evidence dashboard |
| `GET /api/anatomy` | Original verified source/group/shared-coordinate manifest |

Prediction input is `{"features": {"Age": 50, "Sex": "Male", ...}}` with **all 55 exact predictors**, numeric JSON numbers and exact categorical strings. Missing/extra fields, targets, booleans, nulls, numeric strings, malformed/nonfinite numbers, fractional integer values and unsupported categories are rejected. There is no imputation, coercion, category replacement or clinical range guessing. All four outputs and the matching identity fields are required by the runtime TypeScript response validator.

## Form and example

The schema-driven form begins entirely empty. It groups the exact source fields under demographics, history, examination/symptoms, laboratory, ECG and echocardiographic measurements. Grouping only changes navigation, never predictors. Source categories retain spelling/case, including `Fmale`, `mild`, and the single supported `Exertional CP` category `N`. Numeric entry is parsed explicitly and checked for finite/integer validity before submission; the API independently enforces the same rules. Inline errors appear after field interaction, and prediction is disabled until all fields are valid.

None of the 55 clinical units is verified in the source manifest, so none is invented. No numeric values or categorical selections are silently supplied.

The sole example is the lexicographically smallest development content record ID:

`0056fb5ae87a9ac1510fd77cb5cd6bd3b348a0d0de578cf1a86132f8d87733dc`

Source: UCI 411 Z-Alizadeh Sani; original workbook fingerprint is returned with the example. The safe development reader checks pinned membership and skips holdout target cells. Example selection uses only development IDs, not labels, predictions or final holdout outcomes. The API exposes the 55 actual predictor values, no target labels. The UI says **Public dataset example — not a real current patient**. An edit clears this example label and all old predictions. Tests use separate explicitly synthetic fixture values.

## Lifecycle and synchronized anatomy

The frontend first asks the backend to validate the submitted snapshot and establish its canonical profile/schema/model fingerprints, then requests prediction for the same snapshot. A monotonically increasing request generation and abort signal cover both operations. Editing any field, loading an example, cancelling or unmounting aborts obsolete work. Late responses cannot overwrite a newer profile even if cancellation is ignored by transport. Results must match the validated profile, schema and model fingerprints before being shown. These identity fields are retained for future explanation integration.

Old probabilities are removed immediately on any edit or new request, including failed requests. Pending/cancelled/failed states use neutral vessel styling and no invented probabilities. The numerical results remain usable when anatomy/WebGL fails; failure text never claims successful rendering or falsely says that successful numerical predictions are unavailable.

LAD/LCX/RCA outputs feed the existing typed vessel-state interface by name. Geometry, card borders and the numerical legend use the same `probabilityColor` function. The continuous blue-to-red scale indicates lower-to-higher **model output magnitude**, not measured stenosis severity, percent narrowing or a lesion location. Numeric probabilities accompany color. Entire named groups are colored; no mesh is moved, duplicated, reshaped or narrowed. The heart remains reference anatomy rather than patient geometry.

Selection is one shared reducer state: a card focuses its group; a real mesh click selects its card; controls retain orbit/zoom, anterior/posterior, isolation, show-all and reset. Selected emissive highlighting is separate from the probability base color. The educational disclaimer remains visible. A small note and plain-text performance link disclose the public-dataset/calibration limitations and weak LCX/RCA detection.

Browser inspection found a pre-existing control issue: residual default OrbitControls damping could displace a newly commanded camera preset/reset. `enableDamping={false}` is the smallest correction. Verified reset is exactly `(0, -4, 0)` and posterior is `(0, 4, 0)` in transformed coordinates. This changes control behavior only; there is **no source anatomy/mapping/orientation correction**.

## Actual browser verification

Tested the production build at `http://127.0.0.1:8001/` with real backend inference and all 83 verified meshes. Desktop and the narrower in-app viewport rendered the workflow. No browser mocks or synthetic predictions were used for these checks.

1. Loaded the specified development example and inspected all 55 rendered input values; no fields were missing.
2. Predicted CAD 17.1%, LAD 24.3%, LCX 37.1%, RCA 30.9% (display rounding only). These are actual example predictions, **not holdout performance metrics**.
3. Selected each result card and verified matching anatomical group focus/highlighting and numerical detail.
4. Clicked real LAD, LCX and RCA branches using mesh raycasting and verified matching card selection.
5. Confirmed whole-vessel colors, label, numerical outputs and legend; no fake blockage, diameter change or patient-geometry claim.
6. Exercised isolation/show-all, anterior/posterior presets, orbit and wheel zoom after prediction.
7. Changed Age 50→51: old cards disappeared and vessels became neutral. A new prediction returned a changed profile fingerprint and unchanged model fingerprint. CAD/LAD/RCA outputs changed; LCX remained the same, as a tree model may do for a small input change.
8. Verified the corrected camera reset preserves the four prediction outputs and clears selection/isolation.
9. Observed approximately 60 FPS locally with real predictions; no heavy effects added.

Original example browser profile fingerprint: `328ca73cba6befc4de6e8726096ffe2be7f639ce645b6e6b658b1a964468def3`; edited profile: `1e323336a365f1c29b2ec4e8aac5c9ea6f6ae700e45f2e27a3cb89ecaf58df70`. Fingerprints use the backend's canonical submitted JSON representation; semantically equivalent integer/float representations may have different fingerprints. Validation and prediction always receive the same browser snapshot.

Screenshots: [full workflow](integration/workflow-full.jpg), [four numerical outputs and legend](integration/results.jpg), [selected anatomy](integration/anatomy.jpg). These are verification records, not final presentation assets.

Latency [measurements](integration/LATENCY.json): first browser validation+prediction round trip 66 ms; edited-profile browser round trip 42 ms. Thirty warm loopback HTTP samples (one warm-up excluded) on the unchanged development example measured validation+prediction median **24.5 ms**, p95 **26.4 ms**; prediction endpoint alone median **23.5 ms**, p95 **24.9 ms**. Browser timing also includes frontend/transport overhead. These are local hardware measurements, not general performance guarantees or new evaluation results.

## Verification and preserved evidence

All **113 Python tests** and **54 frontend tests** passed, with no skips. Added tests cover exact artifacts, no fitting, private-copy corruption rejected before deserialization, positive-class orientation, threshold boundary, one ordered profile for all targets, identity checks, strict invalid/nonfinite inputs, deterministic repeated inference, development-only examples, pipeline failures, complete form/categories, color/group mapping, bidirectional selection, stale validation/inference responses, explicit cancellation/unmount, invalid examples and numerical fallback without WebGL. Existing anatomy and final-evaluator failure/guard tests also remain intact.

Safe data verification passed with `holdout_targets_decoded: false` and `folds_regenerated: false`; anatomy verification retained disjoint 30/18/6/29 groups and all 83 meshes. Saved-result-only final-evaluation verification reproduced the recorded metrics without inference. Ruff lint/format, TypeScript and production build passed. Vite's existing large-bundle warning remains; the real-viewer fallback test also emits a nonfatal dependency CommonJS deprecation warning for Three.js.

[IMMUTABLE_INPUTS.json](integration/IMMUTABLE_INPUTS.json) records the 231 pre-phase file checksums covering all 180 Phase 1 locked inputs, all Phase 3 artifacts, the final protocol/access lock, all Phase 4 outputs and the guard/receipt. Every checksum remained unchanged after implementation, tests and browser checks. Model loading and inference operate on original model files. No holdout evaluation was rerun, no real fitting occurred, and no evaluation module/source/model bytes were changed.

Run the standard installation/build/serve steps in [DEVELOPMENT.md](DEVELOPMENT.md). Startup requires the original pinned source/anatomy caches, frozen development artifacts, final protocol and completion receipt; it fails explicitly if they are absent or differ. Use safe verification commands, not preparation/training/evaluation execution.

## Remaining work

No blocker remained for Phase 5. Phase 6 subsequently completed verified SHAP/explanations; see [EXPLANATIONS.md](EXPLANATIONS.md). A full evidence page, any separately justified calibration assessment, final visual polish, comparison/export, report, recording and submission are not implemented. Independent clinical/anatomical validation and broader device testing remain unfinished. The weak LCX/RCA results are unchanged and disclosed; this phase does not authorize model or threshold changes.

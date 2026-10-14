# Phase 6: verified frozen-model explanations

CardioScope now explains one of CAD/LAD/LCX/RCA at a time for the exact complete profile and frozen prediction currently displayed. `POST /api/explain` returns all 55 source-feature contributions; React displays five upward/five downward factors and the remaining net contribution. CAD is selected initially and after a new prediction. Vessel target, numerical card and anatomy selection stay synchronized; selecting CAD clears vessel selection. This is implementation/verification evidence, not new model performance evidence or a final submission report.

## Methods and mathematical contract

| Target | Exact frozen estimator | Method | Explained output | Positive output |
| --- | --- | --- | --- | --- |
| CAD | Balanced logistic, C=0.1 | SHAP 0.52 LinearExplainer with Independent masker | Model log-odds | CAD, class 1 |
| LAD | Balanced logistic, C=0.1 | SHAP 0.52 LinearExplainer with Independent masker | Model log-odds | Stenotic, class 1 |
| LCX | Forest, depth 3, leaf 10 | SHAP 0.52 TreeExplainer, interventional, probability, approximate=False | Probability units | Stenotic, class 1 |
| RCA | Forest, depth 5, leaf 10 | SHAP 0.52 TreeExplainer, interventional, probability, approximate=False | Probability units | Stenotic, class 1 |

Every call independently obtains the full frozen pipeline's positive-class probability. Logistic explanations additionally obtain `pipeline.decision_function` and verify its sigmoid equals that probability. Forest explanations select output index 1, explicitly require saved classes `[0, 1]`, and reconstruct the full pipeline probability. No fitting, calibration, threshold selection or estimator mutation occurs. All thresholds remain 0.5.

The saved `pipeline[:-1].transform` is the only preprocessing path. Linear SHAP is exactly `coefficient * (transformed input - reference mean)`, with intercept + coefficient-weighted reference mean as baseline. Log-odds contributions do **not** sum to a probability or percentage-point changes. Forest baseline is the mean positive probability on the development reference, and probability-space contributions sum to the displayed positive probability.

Independent reconstruction runs for every uncached response **after** grouping all encoded contributions. Logistic absolute tolerance is **1e-10**; forest absolute tolerance is **1e-6**. Nonfinite output, wrong shape/class, mismatched prediction, or failed additivity returns HTTP 503 with no contribution payload. SHAP's own TreeExplainer additivity check is insufficient here because its documented built-in check applies to margin output; we independently check probability output. The frontend separately checks reconstruction, complete feature coverage, entered values, units, class/probability and identity before displaying bars.

Methods follow the official [LinearExplainer](https://shap.readthedocs.io/en/latest/generated/shap.LinearExplainer.html), [Independent masker](https://shap.readthedocs.io/en/latest/generated/shap.maskers.Independent.html), and [TreeExplainer](https://shap.readthedocs.io/en/latest/generated/shap.TreeExplainer.html) contracts. These are interventional reference explanations of model behavior, not causal claims or conditional explanations preserving clinical correlations.

## Development-only reference and identity

The shared background contains **100 distinct records from the 242 locked development records**. Selection is `np.random.default_rng(20261002).choice(sorted(development IDs), 100, replace=False)`, then sort the selected IDs. Selection never uses labels, model outcomes or explanation quality. Keeping 100 records avoids implicit masker subsampling, gives a substantial reference for this small development set and keeps exact TreeSHAP responsive. It is a reference choice, not a representative population or external validation sample.

[background.json](../artifacts/explanations/v1/background.json) persists selected content IDs, selection seed/rule, selected-ID SHA, full development membership SHA, source-feature-value SHA, schema SHA and app model identity. [explanations_v1.json](../config/explanations_v1.json) pins background bytes, runtime lock, package versions, methods, perturbation, dtype adapter and tolerances. Preparation is write-once/idempotent and verifies existing files. The existing safe development reader skips holdout target cells and validates the immutable source/locked membership; development outcomes returned by that reader are unused for explanations. No holdout record, label, statistic or final metric enters reference selection or SHAP computation.

The API response includes target, positive class, unchanged positive probability/status/threshold, output space/units, baseline, all 55 original values and signed contributions, encoded and grouped totals, reconstructed output, signed residual/tolerance, and zero omitted API contribution. It also includes profile fingerprint, app model version, schema fingerprint, exact target model SHA, method/version, background fingerprint and explanation configuration fingerprint. Configuration identity hashes config bytes, explanation implementation bytes and app model identity; config also pins the runtime lock. An in-memory 128-entry LRU cache is keyed by exact profile fingerprint, app model fingerprint, target and explanation configuration. It checks the expected displayed probability even on a cache hit, returns deep copies, and stores only verified successes. Prediction and explanation share the inference lock while model code runs; the no-fitting guard remains active.

## Original features and contribution accounting

The 78 actual fitted transformed positions map to 55 source features using the saved ColumnTransformer column lists, output slices and OneHotEncoder `categories_`. We do not split encoded names or fit another vocabulary. All one-hot contributions belonging to a source category are summed with `math.fsum`; the encoded and grouped algebraic sums are checked within 1e-12 floating-point tolerance. The category shown is the entered value (including source spelling/case), not its one-hot code. Numeric values shown are original measurements, not standardized z-scores. All 55 clinical/source units remain undocumented, so none are invented or shown.

Aggregation is the sum of encoded SHAP contributions, not a separately recomputed grouped Shapley game. Interventional encoded-feature coalitions can combine one-hot levels that do not correspond to a valid clinical category. The reported grouping preserves the predictor-output accounting; it does not turn the attribution into clinical causality. Correlated features can share attribution.

The API returns every factor. Top-factor sorting happens in React, by signed magnitude within each direction; omitted factors are explicitly counted and summed. Both sets of bars share the same absolute scale. The expandable table and identity record expose all factors. Display rounding never replaces unrounded verification.

## Request lifecycle and UI

Prediction is a separate fast request and renders before explanations. SHAP import, reference loading and explainer creation are lazy. The explanation section shows its own loading/error state; failures leave valid numerical outputs and anatomy colors available. Missing runtime/config/background therefore does not block prediction startup.

Edits clear predictions/explanations immediately and abort pending requests. Each explanation effect is scoped to the submitted snapshot, prediction and target, with an AbortController plus generation check. Target changes supersede pending requests; late responses, including servers that ignore cancellation, cannot overwrite the latest state. Profile/model/schema/target-model mismatch and malformed contribution accounting are rejected. New predictions default to CAD and reset previous vessel selection, preventing an old selected vessel card from contradicting the default explanation.

The production UI contains real computed probabilities only. It explicitly says **“Contribution units: model log-odds, not probability percentage points.”** for CAD/LAD, and explains decimal probability units for LCX/RCA. Nearby wording describes frozen-model associations, the small public dataset, unverified calibration and weak LCX/RCA detection. The educational/decision-support disclaimer remains visible. No inference of lesion location, measured narrowing or patient-specific anatomy was added.

## Runtime and smallest corrections

Two actual compatibility problems were found during implementation:

1. The original immutable optional-dependency resolution selects llvmlite 0.36/numba 0.53.1, which cannot build on Python 3.12. Changing the old `uv.lock` would change pinned development provenance. Instead, installation first uses the unchanged core lock, then a separate [hash-locked explanation runtime](../config/explanations-runtime.lock.txt), constrained by [all 48 original installed package versions](../config/explanations-core-constraints.txt). It adds SHAP 0.52.0, numba 0.68.0, llvmlite 0.50.0, slicer 0.0.8 and tqdm 4.70.1 only. Original package versions and `uv.lock` remain unchanged; `uv pip check` passes. This add-on is verified on **macOS ARM64, Python 3.12.14**; other platforms are not verified. In particular SHAP has different Intel macOS numba/llvmlite constraints, so do not assume this add-on lock covers Intel macOS.
2. Vanilla interventional TreeSHAP produced a **+5.7736e-5** RCA reconstruction residual on the existing development example (rejected at the unchanged 1e-6 tolerance). Per-tree inspection localized this to tree index 4; its contribution discrepancy was +0.0057738 before forest averaging. SHAP's [v0.52 C++ source](https://github.com/shap/shap/blob/v0.52.0/shap/cext/tree_shap.h) stores interventional `Node.thres` as `float`; sklearn stores thresholds as doubles and casts predictor inputs to float32. A threshold such as `14.099999904632568` rounds upward in float32, routing some inputs differently.

The smallest correction casts transformed background/current tree inputs to the same float32 dtype used by the frozen sklearn classifier and adapts **only SHAP's in-memory ensemble thresholds** to the largest float32 value less than or equal to each saved threshold. For any float32 input `x`, `x <= saved_double_threshold` is then exactly equivalent to `x <= adapted_threshold`. The equivalence also holds for every interventional coalition, whose coordinates come from float32 current/reference rows. We check wrapper probabilities against the original classifier on all 100 background rows and test neighboring float32 boundary inputs. The adapter does not round leaf probabilities, replace SHAP values, redistribute residuals, relax tolerance, or alter the original predictor/joblib.

The frozen sklearn implementation establishing input dtype is [forest prediction validation](https://github.com/scikit-learn/scikit-learn/blob/1.9.1/sklearn/ensemble/_forest.py) and [tree prediction validation](https://github.com/scikit-learn/scikit-learn/blob/1.9.1/sklearn/tree/_classes.py). SHAP wrapper loading/validation is in its [v0.52 tree explainer](https://github.com/shap/shap/blob/v0.52.0/shap/explainers/_tree.py). Neither anatomy source geometry nor dataset contract needed correction.

Install/run commands, including the supplemental runtime step, are in [DEVELOPMENT.md](DEVELOPMENT.md); `make install` performs both locks. Do not run `uv sync --extra explanations`. If `uv sync` prunes the add-on, reinstall the supplemental hash lock. Existing examples/models/source caches and the final completion receipt must remain intact.

## Development example observations and reconstruction

The existing label-free public example remains record `0056fb5ae87a9ac1510fd77cb5cd6bd3b348a0d0de578cf1a86132f8d87733dc`. Its browser-submitted profile fingerprint is `328ca73cba6befc4de6e8726096ffe2be7f639ce645b6e6b658b1a964468def3`. API/benchmark serialization of semantically equal integer/float values may produce a different fingerprint; each request uses the same validated submitted representation throughout.

| Target | Positive probability | Baseline in explained space | Reconstructed output | Example signed residual |
| --- | --- | --- | --- | --- |
| CAD | 0.1709399517600908 | 0.8347788465281016 | -1.578980251525497 | -6.66e-16 |
| LAD | 0.24305384913623826 | 0.13288440678221453 | -1.1360090958105795 | 0 |
| LCX | 0.3705140009054133 | 0.3848793000341224 | 0.3705140002937382 | -6.12e-10 |
| RCA | 0.3090592361868292 | 0.37617418935111857 | 0.3090592344159137 | -1.77e-9 |

For this profile, CAD `Typical Chest Pain=0` contributes -0.9143 model log-odds; `FH=1` contributes +0.7251. LAD has corresponding -0.6030/+0.5923 contributions. LCX `CR=1.4` contributes +0.0503 probability units and `Age=50` -0.0396; RCA `Age=50` contributes -0.0354 and `CR=1.4` +0.0317. These describe the frozen models relative to the background, not disease effects, clinical advice, performance metrics or observed patient outcomes. No labels are exposed for the example.

## Latency and numerical evidence

[BENCHMARK.json](explanations/BENCHMARK.json) measures local backend wall time on the existing example plus five deterministic development profiles selected by every 48th sorted remaining ID. Each profile is measured five times per target: 30 uncached warm computations and 30 cache hits per target. First-call timing is per target in one fresh process; CAD includes the shared SHAP import/background load, while later targets reuse that runtime. Warm uncached/cached timing is reported separately. These figures exclude HTTP/browser transport and are hardware-specific.

| Target | First call ms | Warm uncached median / p95 ms | Cache median / p95 ms | Max absolute reconstruction residual |
| --- | --- | --- | --- | --- |
| CAD | 550.9 | 15.3 / 16.9 | 0.41 / 0.43 | 6.66e-16 |
| LAD | 18.4 | 15.6 / 17.9 | 0.41 / 0.47 | 2.22e-16 |
| LCX | 53.1 | 14.4 / 26.6 | 0.42 / 0.48 | 1.36e-09 |
| RCA | 24.9 | 14.5 / 15.5 | 0.39 / 0.45 | 2.55e-09 |

All repeated results passed their target-specific tolerance. The backend tests independently recompute explanations on six sorted/strided development profiles (24 target/profile pairs, repeated with cache cleared); equality is deterministic under this locked runtime. No background-size reduction or approximate explainer was needed.

## Real browser verification

The production build ran against the real backend at `http://127.0.0.1:8001/`; the existing user process on port 8000 was left alone. No browser mocks or synthetic predictions were used. [BROWSER_TARGETS.json](explanations/BROWSER_TARGETS.json) records all four real target texts, positive-class units/reconstruction, same profile fingerprint, exact model/schema/configuration identity and matching selected vessel cards.

Verified workflow:

1. Loaded the existing development example, inspected entered values and ran the four real predictions without waiting for explanation loading.
2. Inspected CAD's signed factors, input values/categories, baseline, complete/remaining contribution accounting and residual. Switched LAD→LCX→RCA, confirming the target and its numerical output matched; each vessel selector focused/highlighted the same source anatomy group. CAD clears named-vessel selection.
3. Inspected charts at **1280×900** and **390×844**. Narrow CAD and RCA probability-space charts stack vertically without horizontal overflow; the explanation's narrow scroll width equaled client width (356 px). Labels, signed values, entered categories, units warnings and residuals remained readable. Temporary viewport overrides were reset.
4. Edited Age 50→51 while RCA was selected: old prediction/explanation disappeared immediately, and reprediction defaulted to CAD with prior vessel selection cleared. [BROWSER_EDIT.json](explanations/BROWSER_EDIT.json) records changed profile SHA (`328ca7…`→`1e3233…`) and unchanged model identity. The modified input was a local interaction test, not a source-data correction; the example label is cleared on edit.
5. Selected LAD through anatomy controls, then clicked a real visible RCA branch using mesh raycasting. The RCA card, anatomical detail (30.9%) and RCA explanation synchronized. Verified actual RCA isolation (no heart base or other arteries), show-all, orbit drag, wheel zoom, anterior/posterior presets and reset. Reset returned to CAD without losing four numerical predictions. All 83 verified meshes remained loaded; local render cadence was generally 60 FPS (a transient 48 FPS observation during viewport/selection changes).
6. Confirmed production examples contain only the existing labeled development example and no outcome labels; reference IDs exclude all holdout membership. Existing model limitations/disclaimer remained visible.

Screenshots: [desktop CAD](explanations/desktop-CAD.jpg), [narrow CAD](explanations/narrow-CAD.jpg), [narrow RCA](explanations/narrow-RCA.jpg), [actual isolated RCA](explanations/anatomy-RCA-isolated.jpg). These are engineering verification captures, not final polished presentation assets.

## Checks and immutable evidence

- **123 Python tests passed**, no skips: all existing Phase 1/3/4/5 checks plus ten Phase 6 tests covering deterministic development-only reference, original frozen membership/checksums, four positive-class reconstructions on multiple profiles, exact analytic linear attribution, fitted category grouping/sum, original values/units, metadata identity, no fitting/holdout calls, uncached determinism, deep-copy cache identity, float32 routing regression, failed reconstruction and malformed API/failure isolation.
- **62 frontend tests passed**, including eight Phase 6 tests: CAD default/all targets, both bar directions and entered values, output-space warnings/limitations, full/remaining accounting, malformed/mismatched identity rejected, loading independent of prediction, errors preserving outputs, target abort/stale rejection, edits/unmount abort, late pre-edit vessel response ignored after reprediction and anatomy/result/selector synchronization. The older Phase 5 app tests mock only the new panel to retain their original scope; the Phase 6 integration tests exercise the real panel.
- Safe source verification passed with `holdout_targets_decoded=false`, `folds_regenerated=false`, 242 development records; anatomy verification retained disjoint heart/LAD/LCX/RCA counts **30/18/6/29**, 83 meshes and unchanged mappings/coordinate transformation.
- Saved-result-only final verification passed for evaluation `final-v1-f1fd0d4cdc334c65aba46c37fa68717b`. It used saved pairs only, without holdout inference or target-cell decoding. The real final evaluator was not rerun; synthetic evaluator tests retain their existing temporary-fixture scope.
- Ruff check/format, TypeScript and production build passed; `uv pip check` passed. Nonfatal warnings are upstream SHAP/Matplotlib color API deprecations, the existing Three.js CommonJS test warning and Vite's existing large Three.js bundle warning. No visual effects or unnecessary framework was added.
- [IMMUTABLE_VERIFICATION.json](explanations/IMMUTABLE_VERIFICATION.json) records **241 before/after SHA-256 pairs**, all identical: the prior 231-file Phase 5 baseline plus pinned modeling source/search/runtime files, including the original `uv.lock`. This covers all Phase 1 locked inputs, Phase 3 fitted models/development evidence, Phase 4 protocol/output/guard/receipt and anatomy source provenance/meshes. [RUNTIME_VERIFICATION.json](explanations/RUNTIME_VERIFICATION.json) records unchanged versions for all 48 original core packages. No model/threshold/evaluation result, ML fitting/evaluator source, dataset target/input contract or anatomy artifact changed.

## Remaining scope and limitations

No blocker remains for the Phase 6 workflow on the verified macOS ARM64 environment. Other platforms/device combinations and independent clinical/anatomical validation remain unverified. The frozen LCX/RCA detection weakness and unverified calibration remain unchanged; explanation correctness does not validate clinical use or prediction accuracy.

A final evidence dashboard, comparison/export, calibration work, final visual redesign, report, demo video and submission work are still unimplemented and were not started. The once-only evaluation remains complete and unchanged. This phase supplies verified explanations and their reproducibility evidence only.

## Phase 7 identity hardening

The audited SHAP implementation/reference/configuration remain unchanged. The frontend now obtains expected configuration/background fingerprints from the read-only `/api/metadata` endpoint and requires equality, alongside the existing profile/model/schema/target/probability checks. Missing metadata leaves predictions usable and explanations unavailable. The render guard also checks complete identity, and metadata changes cancel pending explanations. Tests reject correctly formatted unexpected configuration and background hashes. See [PRODUCT.md](PRODUCT.md).

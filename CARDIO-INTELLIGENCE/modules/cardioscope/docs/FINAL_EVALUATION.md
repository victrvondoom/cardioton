# CardioScope final holdout evaluation

The **single final evaluation** completed on 1 October 2026. Every frozen pipeline made exactly one batch probability call on all 61 locked holdout records. No real model fitting, reselection, preprocessing change, threshold tuning or calibration occurred. This document records the evaluation protocol and its preserved results, not a submission report.

## Frozen inputs and scope

The evaluator loads the exact Phase 3 pipelines from `artifacts/development/v1-bb08b3d0230a/`: CAD/LAD logistic regression with C=0.1 and balanced weights; LCX forest with depth 3/minimum leaf 10/unweighted; RCA forest with depth 5/minimum leaf 10/unweighted. It does not fit, reselect, calibrate, change preprocessing, or change the threshold (0.5). Component-level fitting methods are intercepted and fail during evaluation.

`config/final_evaluation_v1.json` was written before holdout outcome access. It pins all Phase 3 files, schema, split, search, Phase 1 access lock, expected holdout membership, target definitions, frozen candidates, threshold and uncertainty settings. All 180 existing Phase 1 inputs and all Phase 3 artifacts are verified byte-for-byte. Pipeline checks additionally verify saved parameters, fitted development membership, feature order, positive-class orientation, and fitted preprocessing metadata.

The dedicated reader identifies the existing holdout membership through predictor-group hashes and only decodes the 61 selected records' target cells after the evaluation is durably reserved. Development target cells are skipped. It never rebuilds the split or performs full-source auditing. Exact membership, duplicate/group separation, field and target encodings, numeric/schema validity and completeness are required. Unsupported categories or missing records fail explicitly; no row is omitted silently.

## Permanent execution guard

The guard is keyed by the locked split checksum, so changing the evaluator, protocol, output ID or model run does not bypass the reservation for this partition. Exclusive creation and filesystem synchronization make the reservation durable before outcome decoding. One batch probability call is made per target on all 61 records. There is no force, overwrite, retry or resume-inference option.

A reserved, failed or interrupted attempt stays consumed. Failed attempts do not publish an accepted completed evaluation. Saved probability/label pairs are written promptly; later metrics, uncertainty and figures use those pairs. The completed evaluation record is published atomically after every output and input-integrity check. An independent immutable completion receipt anchors its checksum; both record and receipt are required for completed status. This handles concurrency and partial-output failures without treating an incomplete run as successful. The guard is an application-level integrity control, not protection against someone deliberately deleting or rewriting repository files.

Initial synthetic tests covered no fitting, preflight without outcomes, source/schema/split/search/model/run tampering, holdout membership corruption, missing records, invalid categories/schema/encoding, failed and interrupted attempts, concurrent reservations, exactly one inference call per target, completion-record tampering, output rendering, and verification with model/workbook loading forbidden. All passed before the real evaluation.

## Commands

```sh
# Safe preflight: no holdout outcome decoding or inference.
uv run --locked python -m ml.evaluate_holdout check

# The once-only command. An existing reservation prevents another evaluation.
uv run --locked python -m ml.evaluate_holdout run

# Read status or verify saved results without rerunning inference.
uv run --locked python -m ml.evaluate_holdout status
uv run --locked python -m ml.evaluate_holdout verify
```

`verify` checks output/receipt/protocol/code/source/model checksums and recomputes every metric, ROC/PR point, uncertainty interval and development comparison from saved labels/probabilities. It does not deserialize models, decode workbook target cells, run inference, fit or select. Source caches are read only as opaque checksum bytes. Original `holdout_evaluated: false` fields in immutable Phase 1/3 snapshots remain historical metadata; the new final evaluation record and receipt establish the current evaluation status.

Do not use `ml.data prepare` / `make prepare` for verification. Use the existing safe data verification path and anatomy integrity checks.

## Metrics and uncertainty fixed before outcome access

Positive classes are CAD for Cath and Stenotic for LAD/LCX/RCA; Normal is 0. Classification is probability >=0.5. Confusion matrices have true classes as rows and predicted classes as columns, both ordered [0,1]. All nine metrics and class counts are saved. PR-AUC is trapezoidal precision-recall area; average precision is the separate non-interpolated summary. Outputs are **model-estimated probabilities**, with calibration unverified. Brier alone does not establish calibration.

Uncertainty settings were declared in the protocol before evaluation:

- Two-sided 95% Clopper-Pearson exact binomial intervals for accuracy and recall; eligible record counts are retained.
- 2,000 paired within-class stratified percentile bootstrap resamples for ROC-AUC, PR-AUC, average precision, Brier, balanced accuracy, precision and F1. Only saved label/probability pairs are resampled; no model fitting or inference occurs.
- Seeds are 20261001 + target index in CAD/LAD/LCX/RCA order. Class counts are held fixed within each target's bootstrap. These intervals are conditional on the observed case mix and empirical records; they omit training/model-selection uncertainty.
- Bootstrap intervals are withheld when a class has fewer than 10 records or the empirical bootstrap is degenerate. Undefined precision with no predicted positives is marked explicitly. The minimum is a conservative reporting rule, not a guarantee of interval reliability.

The holdout is only 61 records from the same public source, not an external clinical validation cohort. Authoritative patient identifiers are absent; identical-predictor grouping cannot establish independence of all patients. Independence assumptions underlie both binomial and bootstrap intervals. Intervals are approximate/conditional evidence, have no multiplicity adjustment, and do not establish clinical generalization or calibrated clinical risk. No numerical endpoints will be forced where support is inadequate.

## Development comparison and interpretation

The development estimate is the all-family nested selection procedure across five outer folds. It differs from the single final fit trained on all 242 development records. The comparison records the final holdout result, development mean/sample SD/observed outer range, and whether the holdout is within that range or mean plus/minus one SD. Those flags are descriptive: neither a significance test nor a confidence-interval coverage check. Outer folds overlap in training data and are not independent cohorts. Development and final figures are stored and labeled separately.

LCX/RCA had weak and variable development recall at 0.5; LAD also varied across outer folds. Poor holdout outcomes remain valid results and do not trigger any family, parameter, feature, preprocessing, threshold or calibration change. A later calibration assessment must stay separate and cannot retroactively change this evaluation.

## Immutable completed evaluation

Evaluation ID: `final-v1-f1fd0d4cdc334c65aba46c37fa68717b`. Reservation UTC: `2026-10-01T13:39:28.373631+00:00`; completed UTC: `2026-10-01T13:39:52.917751+00:00`.

Frozen development fingerprint: `bb08b3d0230a6cd00b40ee13f84977a70bbdf0e0ca5e78b5ac9c0ab7be11722c`. Evaluator/protocol fingerprint: `4979dd5905ed7dff1a87967d4146c342744dcb19877f702a11dbb317cafd90fd`.

Artifacts: [`final-v1-f1fd0d4cdc334c65aba46c37fa68717b`](../artifacts/final_holdout/final-v1-f1fd0d4cdc334c65aba46c37fa68717b/). Completion record: [evaluation_record.json](../artifacts/final_holdout/final-v1-f1fd0d4cdc334c65aba46c37fa68717b/evaluation_record.json). Saved pairs: [predictions.json](../artifacts/final_holdout/final-v1-f1fd0d4cdc334c65aba46c37fa68717b/predictions.json). Full results: [results.json](../artifacts/final_holdout/final-v1-f1fd0d4cdc334c65aba46c37fa68717b/results.json).

All previously frozen model files, all Phase 3 artifacts (including timings/figures), and all 180 Phase 1 locked inputs remain byte-identical. The permanent reservation and checksum-anchored completion receipt are stored separately under `artifacts/final_holdout/guards/`. Normal `run` now exits with code 2 before model loading or outcome access. The saved-pair verifier recomputes all metrics, curve points, uncertainty and comparisons without another inference call.

## Complete FINAL HOLDOUT results

Every target below uses the same 61 locked records. Negative = Normal; positive = CAD for Cath and Stenotic for vessels. Threshold remains 0.5.

| Target | Negative / positive | Accuracy | Balanced accuracy | Precision | Recall | F1 |
| --- | --- | --- | --- | --- | --- | --- |
| CAD | 18 / 43 | 0.8525 | 0.8146 | 0.8864 | 0.9070 | 0.8966 |
| LAD | 28 / 33 | 0.7213 | 0.7100 | 0.7000 | 0.8485 | 0.7671 |
| LCX | 37 / 24 | 0.6066 | 0.5366 | 0.5000 | 0.2083 | 0.2941 |
| RCA | 40 / 21 | 0.6721 | 0.5804 | 0.5455 | 0.2857 | 0.3750 |

| Target | ROC-AUC | PR-AUC (trapezoidal) | Average precision | Brier score |
| --- | --- | --- | --- | --- |
| CAD | 0.9134 | 0.9594 | 0.9600 | 0.1041 |
| LAD | 0.8474 | 0.8854 | 0.8871 | 0.1667 |
| LCX | 0.6723 | 0.5189 | 0.5352 | 0.2224 |
| RCA | 0.6976 | 0.5040 | 0.5330 | 0.2066 |

### Confusion matrices

Rows=true, columns=predicted; class order [Normal=0, positive=1]. Counts are **TN / FP / FN / TP**.

| Target | TN | FP | FN | TP | Matrix |
| --- | --- | --- | --- | --- | --- |
| CAD | 13 | 5 | 4 | 39 | `[[13, 5], [4, 39]]` |
| LAD | 16 | 12 | 5 | 28 | `[[16, 12], [5, 28]]` |
| LCX | 32 | 5 | 19 | 5 | `[[32, 5], [19, 5]]` |
| RCA | 35 | 5 | 15 | 6 | `[[35, 5], [15, 6]]` |

### 95% uncertainty intervals

All four targets have at least 18 records in each class, so the predefined minimum-class rule did not withhold any interval. No empirical interval was degenerate. ROC-AUC/Brier intervals below are stratified percentile bootstrap; accuracy/recall intervals are exact Clopper-Pearson. All other configured intervals, methods, seeds and sample counts are retained in `uncertainty.json` and `results.json`.

| Target | ROC-AUC 95% interval | Accuracy 95% interval | Recall 95% interval | Brier 95% interval |
| --- | --- | --- | --- | --- |
| CAD | 0.8191–0.9780 | 0.7383–0.9302 | 0.7786–0.9741 | 0.0616–0.1557 |
| LAD | 0.7446–0.9286 | 0.5917–0.8285 | 0.6810–0.9489 | 0.1163–0.2231 |
| LCX | 0.5371–0.8018 | 0.4731–0.7293 | 0.0713–0.4215 | 0.2028–0.2403 |
| RCA | 0.5631–0.8203 | 0.5400–0.7869 | 0.1128–0.5218 | 0.1827–0.2300 |

These are nominal 95% intervals, not simultaneous guarantees across targets/metrics. Bootstrap intervals remain conditional on the observed empirical records and fixed case mix, and independent patient identity is unverified. The broad ranges must not be interpreted as external clinical validation.

## DEVELOPMENT versus FINAL HOLDOUT

| Target | Development selection-procedure ROC-AUC mean ± SD | Final holdout ROC-AUC | Within observed development outer range? | Within development mean ± 1 SD? |
| --- | --- | --- | --- | --- |
| CAD | 0.9263 ± 0.0199 | 0.9134 | yes | yes |
| LAD | 0.8259 ± 0.0773 | 0.8474 | yes | yes |
| LCX | 0.7237 ± 0.0359 | 0.6723 | yes | no |
| RCA | 0.7345 ± 0.0272 | 0.6976 | no | no |

| Target | Development recall mean ± SD | Final recall | Development pooled OOF matrix (242) | Final holdout matrix (61) |
| --- | --- | --- | --- | --- |
| CAD | 0.9425 ± 0.0571 | 0.9070 | `[[37, 32], [10, 163]]` | `[[13, 5], [4, 39]]` |
| LAD | 0.8126 ± 0.0713 | 0.8485 | `[[67, 31], [27, 117]]` | `[[16, 12], [5, 28]]` |
| LCX | 0.3474 ± 0.2725 | 0.2083 | `[[123, 24], [62, 33]]` | `[[32, 5], [19, 5]]` |
| RCA | 0.4632 ± 0.2441 | 0.2857 | `[[121, 28], [50, 43]]` | `[[35, 5], [15, 6]]` |

CAD and LAD ROC-AUC fall within both the observed development outer range and mean ± one sample SD. LCX is below mean − one SD but within the observed outer ROC-AUC range; its accuracy (0.6066) is below every development outer-fold accuracy. RCA ROC-AUC is below the observed development outer range and mean − one SD. These observations are descriptive, not evidence from a significance test.

**LCX/RCA remain the important failures.** LCX detected only 5/24 positives and missed 19; RCA detected 6/21 and missed 15. LCX accuracy equals the 37/61 accuracy of always predicting the observed majority class (Normal), despite a nonconstant score and ROC-AUC above 0.5. RCA accuracy is only one correct record above the analogous majority count of 40/61. Balanced accuracy is 0.5366 for LCX and 0.5804 for RCA. This illustrates why headline accuracy or AUC alone cannot describe useful detection behavior. Recall intervals are wide, and the required threshold is retained.

LAD has 12 false positives among 28 negatives (precision 0.7000), while CAD has five false positives and four false negatives. All failures are preserved. No target was removed, no unfavorable metric omitted, and none of the holdout outcomes triggered a configuration change.

## Artifacts and verification

The final directory contains predictions, full results, a frozen protocol copy, provenance, standalone confusion matrices/curves/uncertainty/development comparison, complete metric CSV, six clearly labeled FINAL HOLDOUT PNG/SVG figures, and the checksum-anchored evaluation record. The exact model checksums are recorded there; the evaluated pipelines stay in their original Phase 3 paths unchanged.

Verification completed after evaluation: 91 Python tests (25 dedicated evaluator cases), 30 frontend tests, safe source/anatomy checks, Ruff lint/format, TypeScript and production build. The once-only guard refused a second command before model loading/inference, and verification from saved pairs reproduced every metric/curve/uncertainty/comparison. Original source, development and model fingerprints remain unchanged. The existing nonfatal Vite large-bundle warning persists. ROC, PR and confusion figures were visually inspected.

## Remaining work

No blocker remains for this phase. SHAP, any separate calibration assessment, prediction API integration, patient form, actual-model anatomy coloring, evidence-page UI, UI polish, final report/submission and independent clinical/anatomical validation remain unfinished. Models must be referenced by their frozen checksums in later integration. There is no authorization or methodological basis here to change them in response to these holdout outcomes.

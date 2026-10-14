# CardioScope v2.1 — bounded four-task neural experiment

**Gate: FAIL — STOP**. NOT FITTED: gate failed; STOP.

Internal development evidence only. No holdout outcomes, deployment, product changes, or additional architecture attempts. The historical 61-record holdout is not available as an independent test for this or any later research candidate.

Branch: `codex/v2-multitask`. Protocol SHA256: `15ab83fcf3bc4ae0763c051403afe761a0cb93f8cd06d5642dc7332ac47e1dc6`. The protocol and implementation were committed before real-data fitting.

## Design

Exactly 242 original development records, 55 predictor fields, four related binary outputs. No true CAD or vessel labels enter input features or prediction-time inputs. Two separate repeated nested-CV strata reuse the previous LCX/RCA exact five repeats of five outer and four inner folds. All networks learn all four tasks. The stratum's focal task chooses architecture and its screening threshold using inner OOF data only. The two strata cannot be pooled as independent patient evaluations.

Sixteen fixed configurations: [32,16]/[64,32], dropout0.1/0.25, Adam L2 1e-4/1e-3, equal [1,1,1,1] or vessel-focused [1,1,1.5,1.5]. CPU, one thread, float32, full-batch Adam LR0.001, maximum300epochs, patience30, min_delta1e-4. No seed search, class weighting, feature selection or calibration.

Each inner-training partition has a private group-safe stratified20% stopping holdback. Stopping preprocessing is fitted on the other80%; weighted BCE stopping outcomes never include inner scoring or outer validation records. A fresh model/preprocessor refits the complete inner training set for the selected epoch. Outer refit uses the rounded median of four inner epochs, never outer outcomes. The exact v1 linear fold-safe preprocessing is reused; one-hot expansion means55 raw variables do not imply55 neurons.

LCX/RCA thresholds are the highest unique inner OOF probability (+0/1) satisfying sensitivity≥.65 and specificity≥.60; comparison is >=. Infeasible means ineligible, with no screening threshold fallback. A fixed inner-ranking-only diagnostic selector still permits CAD/LAD and clearly labeled vessel@.5 diagnostics in that case.

## Focal vessel results

Means below are across eligible outer folds; missing folds remain ineligible. ROC/PR summaries over different eligible subsets must not be compared without pairing. PR-AUC is trapezoidal; AP is non-interpolated average precision. Both are reported because constant predictions can have trapezoidal PR-AUC=(1+prevalence)/2 despite AP=prevalence. No table is an independent test result.

### LCX

| Procedure | Folds | sensitivity | specificity | balanced_accuracy | precision | f1 | roc_auc | pr_auc | average_precision | predicted_positive_rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v1_rf_0.5 | 25/25 | 0.1916 | 0.9498 | 0.5707 | 0.7255 | 0.2931 | 0.7225 | 0.6137 | 0.6325 | 0.1056 |
| v1_rf_nested_threshold | 23/25 | 0.6270 | 0.6793 | 0.6532 | 0.5608 | 0.5868 | 0.7187 | 0.6071 | 0.6265 | 0.4409 |
| selection_procedure | 25/25 | 0.6253 | 0.7010 | 0.6631 | 0.5766 | 0.5958 | 0.7279 | 0.6159 | 0.6336 | 0.4270 |
| multitask | 24/25 | 0.6075 | 0.6592 | 0.6333 | 0.5410 | 0.5668 | 0.7015 | 0.5992 | 0.6157 | 0.4454 |
| multitask_0.5_diagnostic | 25/25 | 0.4863 | 0.7446 | 0.6155 | 0.5667 | 0.5129 | 0.7041 | 0.6017 | 0.6182 | 0.3461 |

Preregistered focal gate: `{'checks': {}, 'passed': False, 'reason': 'Not all 25 outer rules were eligible'}`.

Paired multi-task minus `v1_rf_0.5` (24 identical folds): sensitivity +0.4211, specificity -0.2900, balanced_accuracy +0.0655, precision -0.1791, f1 +0.2807, roc_auc -0.0197, pr_auc -0.0107, average_precision -0.0135, predicted_positive_rate +0.3415.

Paired multi-task minus `v1_rf_nested_threshold` (23 identical folds): sensitivity -0.0206, specificity -0.0204, balanced_accuracy -0.0205, precision -0.0201, f1 -0.0208, roc_auc -0.0167, pr_auc -0.0063, average_precision -0.0093, predicted_positive_rate +0.0043.

Paired multi-task minus `selection_procedure` (24 identical folds): sensitivity -0.0175, specificity -0.0423, balanced_accuracy -0.0299, precision -0.0359, f1 -0.0288, roc_auc -0.0260, pr_auc -0.0168, average_precision -0.0180, predicted_positive_rate +0.0189.

Repeat-pooled multi-task screening metrics (each complete repeat =242 OOF development predictions; correlated repeats, no independent-sample CI):

| Repeat | Status | Sensitivity | Specificity | BA | ROC-AUC | Positive rate |
|---|---|---:|---:|---:|---:|---:|
| 1 | incomplete/ineligible | — | — | — | — | — |
| 2 | evaluated | 0.6316 | 0.6599 | 0.6457 | 0.6926 | 0.4545 |
| 3 | evaluated | 0.6211 | 0.6667 | 0.6439 | 0.7116 | 0.4463 |
| 4 | evaluated | 0.5789 | 0.6667 | 0.6228 | 0.6851 | 0.4298 |
| 5 | evaluated | 0.6105 | 0.6463 | 0.6284 | 0.6962 | 0.4545 |

### RCA

| Procedure | Folds | sensitivity | specificity | balanced_accuracy | precision | f1 | roc_auc | pr_auc | average_precision | predicted_positive_rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v1_rf_0.5 | 25/25 | 0.2674 | 0.9167 | 0.5921 | 0.6836 | 0.3756 | 0.7181 | 0.6210 | 0.6360 | 0.1543 |
| v1_rf_nested_threshold | 21/25 | 0.6818 | 0.6362 | 0.6590 | 0.5422 | 0.6003 | 0.7173 | 0.6193 | 0.6347 | 0.4858 |
| selection_procedure | 25/25 | 0.6398 | 0.6858 | 0.6628 | 0.5648 | 0.5946 | 0.7278 | 0.6185 | 0.6342 | 0.4395 |
| multitask | 25/25 | 0.6746 | 0.6762 | 0.6754 | 0.5664 | 0.6124 | 0.7440 | 0.6283 | 0.6450 | 0.4588 |
| multitask_0.5_diagnostic | 25/25 | 0.5656 | 0.7531 | 0.6593 | 0.5927 | 0.5743 | 0.7440 | 0.6283 | 0.6450 | 0.3695 |

Preregistered focal gate: `{'checks': {'ap_above_prevalence': True, 'mean_screening_metrics': True, 'no_extreme_repeat': True, 'no_material_auc_collapse': True, 'not_nearly_everyone_positive': True, 'pr_auc_above_prevalence': True, 'precision_above_prevalence': True, 'repeat_stability': True}, 'passed': True}`.

Paired multi-task minus `v1_rf_0.5` (25 identical folds): sensitivity +0.4073, specificity -0.2405, balanced_accuracy +0.0834, precision -0.1172, f1 +0.2369, roc_auc +0.0260, pr_auc +0.0074, average_precision +0.0091, predicted_positive_rate +0.3045.

Paired multi-task minus `v1_rf_nested_threshold` (21 identical folds): sensitivity -0.0206, specificity +0.0447, balanced_accuracy +0.0121, precision +0.0217, f1 +0.0054, roc_auc +0.0225, pr_auc +0.0003, average_precision +0.0020, predicted_positive_rate -0.0354.

Paired multi-task minus `selection_procedure` (25 identical folds): sensitivity +0.0349, specificity -0.0096, balanced_accuracy +0.0126, precision +0.0016, f1 +0.0178, roc_auc +0.0162, pr_auc +0.0098, average_precision +0.0108, predicted_positive_rate +0.0193.

Repeat-pooled multi-task screening metrics (each complete repeat =242 OOF development predictions; correlated repeats, no independent-sample CI):

| Repeat | Status | Sensitivity | Specificity | BA | ROC-AUC | Positive rate |
|---|---|---:|---:|---:|---:|---:|
| 1 | evaluated | 0.6882 | 0.6980 | 0.6931 | 0.7443 | 0.4504 |
| 2 | evaluated | 0.7204 | 0.6711 | 0.6958 | 0.7482 | 0.4793 |
| 3 | evaluated | 0.6237 | 0.6846 | 0.6541 | 0.7227 | 0.4339 |
| 4 | evaluated | 0.6667 | 0.6510 | 0.6588 | 0.7365 | 0.4711 |
| 5 | evaluated | 0.6774 | 0.6779 | 0.6776 | 0.7329 | 0.4587 |

## CAD/LAD preservation

Exact same-fold v1 CAD/LAD balanced logistic C0.1 is refitted on outer training data only. All CAD/LAD thresholds stay0.5. Preregistered maximum mean declines: ROC-AUC0.02, balanced accuracy0.03, sensitivity0.05, AP0.03. Both tasks must pass in both strata. These are safeguards, not extra model-selection feedback.

### CAD, LCX-stratified folds

| Procedure | Folds | sensitivity | specificity | balanced_accuracy | precision | f1 | roc_auc | pr_auc | average_precision | predicted_positive_rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v1_0.5 | 25/25 | 0.8482 | 0.8475 | 0.8479 | 0.9355 | 0.8877 | 0.9315 | 0.9713 | 0.9717 | 0.6493 |
| multitask | 25/25 | 0.9159 | 0.6566 | 0.7863 | 0.8724 | 0.8919 | 0.9140 | 0.9627 | 0.9634 | 0.7518 |

Safeguard: `{'checks': {'all_25_folds': True, 'average_precision': True, 'balanced_accuracy': False, 'roc_auc': True, 'sensitivity': True}, 'passed': False}`.

### LAD, LCX-stratified folds

| Procedure | Folds | sensitivity | specificity | balanced_accuracy | precision | f1 | roc_auc | pr_auc | average_precision | predicted_positive_rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v1_0.5 | 25/25 | 0.7560 | 0.7270 | 0.7415 | 0.8043 | 0.7769 | 0.8303 | 0.8737 | 0.8768 | 0.5601 |
| multitask | 25/25 | 0.8599 | 0.6733 | 0.7666 | 0.7973 | 0.8257 | 0.8383 | 0.8726 | 0.8761 | 0.6427 |

Safeguard: `{'checks': {'all_25_folds': True, 'average_precision': True, 'balanced_accuracy': True, 'roc_auc': True, 'sensitivity': True}, 'passed': True}`.

### CAD, RCA-stratified folds

| Procedure | Folds | sensitivity | specificity | balanced_accuracy | precision | f1 | roc_auc | pr_auc | average_precision | predicted_positive_rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v1_0.5 | 25/25 | 0.8635 | 0.8365 | 0.8500 | 0.9279 | 0.8937 | 0.9252 | 0.9689 | 0.9694 | 0.6653 |
| multitask | 25/25 | 0.9221 | 0.6979 | 0.8100 | 0.8839 | 0.9014 | 0.9182 | 0.9645 | 0.9651 | 0.7454 |

Safeguard: `{'checks': {'all_25_folds': True, 'average_precision': True, 'balanced_accuracy': False, 'roc_auc': True, 'sensitivity': True}, 'passed': False}`.

### LAD, RCA-stratified folds

| Procedure | Folds | sensitivity | specificity | balanced_accuracy | precision | f1 | roc_auc | pr_auc | average_precision | predicted_positive_rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v1_0.5 | 25/25 | 0.7558 | 0.7187 | 0.7373 | 0.7953 | 0.7705 | 0.8345 | 0.8765 | 0.8796 | 0.5628 |
| multitask | 25/25 | 0.8613 | 0.6624 | 0.7619 | 0.7875 | 0.8188 | 0.8358 | 0.8725 | 0.8763 | 0.6472 |

Safeguard: `{'checks': {'all_25_folds': True, 'average_precision': True, 'balanced_accuracy': True, 'roc_auc': True, 'sensitivity': True}, 'passed': True}`.

## Configurations, thresholds and stopping

Nested CV selects fold-specific configurations; selecting a new single model from outer rankings would be post-hoc. Frequencies below are descriptive, not a final winner. A full242-record candidate is permitted only if the full locked gate passes.

**LCX** configuration frequencies:

- `mlp-32-16-d0.1-l20.0001-equal`: 1/25
- `mlp-32-16-d0.1-l20.0001-vessel-focused`: 2/25
- `mlp-32-16-d0.1-l20.001-equal`: 1/25
- `mlp-32-16-d0.1-l20.001-vessel-focused`: 1/25
- `mlp-32-16-d0.25-l20.0001-equal`: 2/25
- `mlp-32-16-d0.25-l20.001-equal`: 2/25
- `mlp-32-16-d0.25-l20.001-vessel-focused`: 2/25
- `mlp-64-32-d0.1-l20.0001-vessel-focused`: 2/25
- `mlp-64-32-d0.1-l20.001-equal`: 2/25
- `mlp-64-32-d0.1-l20.001-vessel-focused`: 2/25
- `mlp-64-32-d0.25-l20.0001-equal`: 1/25
- `mlp-64-32-d0.25-l20.001-equal`: 6/25
- `mlp-64-32-d0.25-l20.001-vessel-focused`: 1/25

Focal thresholds: 24/25 eligible. Range 0.386543–0.478197, median 0.432537, mean 0.428792, SD 0.022299.

Per-repeat thresholds (fold order; null=ineligible): [[0.44189217686653137, 0.39266252517700195, None, 0.41729360818862915, 0.44837522506713867], [0.4196177124977112, 0.4224567413330078, 0.41010811924934387, 0.4109675884246826, 0.410797655582428], [0.44886019825935364, 0.429529070854187, 0.4781970977783203, 0.44405099749565125, 0.43554404377937317], [0.4479987323284149, 0.436021089553833, 0.3956398665904999, 0.4440680146217346, 0.44570061564445496], [0.45533886551856995, 0.4279794692993164, 0.4041743874549866, 0.43718260526657104, 0.386543333530426]]

Outer refit epochs: range51–138, median75; encoded channels77–78; parameters3092–7268.

**RCA** configuration frequencies:

- `mlp-32-16-d0.1-l20.0001-vessel-focused`: 1/25
- `mlp-32-16-d0.1-l20.001-vessel-focused`: 1/25
- `mlp-32-16-d0.25-l20.0001-equal`: 3/25
- `mlp-32-16-d0.25-l20.0001-vessel-focused`: 5/25
- `mlp-32-16-d0.25-l20.001-vessel-focused`: 3/25
- `mlp-64-32-d0.1-l20.0001-equal`: 3/25
- `mlp-64-32-d0.1-l20.0001-vessel-focused`: 2/25
- `mlp-64-32-d0.1-l20.001-equal`: 1/25
- `mlp-64-32-d0.25-l20.0001-equal`: 1/25
- `mlp-64-32-d0.25-l20.0001-vessel-focused`: 1/25
- `mlp-64-32-d0.25-l20.001-equal`: 1/25
- `mlp-64-32-d0.25-l20.001-vessel-focused`: 3/25

Focal thresholds: 25/25 eligible. Range 0.357676–0.492083, median 0.419880, mean 0.422611, SD 0.039391.

Per-repeat thresholds (fold order; null=ineligible): [[0.39561358094215393, 0.369083046913147, 0.44484761357307434, 0.4793242812156677, 0.4198797643184662], [0.4316815137863159, 0.4920828938484192, 0.37946829199790955, 0.40740659832954407, 0.41802915930747986], [0.47772344946861267, 0.4064697325229645, 0.35767555236816406, 0.417106568813324, 0.43326336145401], [0.3612121641635895, 0.4580942988395691, 0.4327322542667389, 0.37811774015426636, 0.4639958441257477], [0.40724387764930725, 0.37773454189300537, 0.4244545102119446, 0.4518430829048157, 0.4801870286464691]]

Outer refit epochs: range52–142, median80; encoded channels77–78; parameters3092–7268.

## Locked gate and disposition

Both vessel procedures need all25 eligible folds, mean sensitivity≥.65, specificity≥.60, BA≥.625, at least4/5 complete repeat-pooled passes, no repeat below sensitivity.55/specificity.50, mean ROC-AUC decline≤.02 versus same-fold v1, positive fraction≤.65, and PPV/PR-AUC/AP≥prevalence+.05. CAD/LAD safeguards above must also pass.

Joint gate passed: **False**. No full-development candidate was fitted or frozen. LCX had one ineligible fold and 0/5 passing repeats (one incomplete); eligible-fold mean sensitivity was 0.6075. RCA passed 4/5 repeats and its complete vessel gate. CAD balanced accuracy declined by 0.0616 on LCX-stratified folds and 0.0400 on RCA-stratified folds, exceeding the preregistered 0.03 limit. LAD passed both safeguards. No further architectures or threshold changes were attempted.

## Runtime and verification

Bounded study wall time: 246.75s (4.11min), 50 outer evaluations, 6450 neural training stages, 100 same-fold CAD/LAD reference fits. Stage count includes private stopping fits and fresh epoch-constrained refits. No final all-development fit on failure.

Real-data deterministic verification repeated the complete first-fold16-config inner search and outer refit (5.95s); decisions, epochs, probabilities and metrics reproduced. This repeats the sealed computation for verification; it is not an additional search or different seed experiment.

Post-run audit: 6450 neural stages; 637 outer arm metrics; all private stopping and scoring memberships, train-only scaler/category fits, OOF thresholds and decisions recomputed. All 256 protected v1 files match the original tag byte-for-byte; all 519 pre-existing tracked files and previous v2 artifacts remain unchanged.

Holdout outcome use: **zero**. Reserved readers and final evaluator were blocked for the entire run. The approved loader decodes only development target cells; raw source/frozen file checksum reads are opaque verification, not holdout evaluation. No historical holdout result was deserialized. The original split was not regenerated.

Tests and checks are recorded in `checks.json` alongside results. The product runtime, frontend, data contract, trained models and deployment are unchanged.

The one-time real-data verification used the isolated hash-locked environment and `python -m research.v21_multitask.run --reproduce-first-fold`. Verification artifacts are write-once; the default runner refuses a completed experiment. For a subsequent replay without overwriting a verification artifact, call the sealed `preflight`, `evaluate_fold`, and `compare_reproduction` functions with the original first-fold inputs. No configuration or seed may change. Refer to the sealed `protocol.json`, per-fold traces, `results.json`, `audit.json` and `reproducibility.json` for full provenance.

Checks passed: 22 new v2.1 tests plus 29 existing v2 tests, 61 safe v1 data/model tests, and 75 frontend tests (187 total). Ruff lint/format, TypeScript, the original 53-package runtime, locked data/split, 83 meshes, and immutable seals also passed. Combined research tests use `--import-mode=importlib` because both existing namespaces contain a `test_experiment.py` filename; this resolved a collection collision without editing sealed code. Holdout and product evidence/API tests that read historical holdout results were not run.

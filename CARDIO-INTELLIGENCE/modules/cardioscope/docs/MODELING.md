# CardioScope Phase 3 — DEVELOPMENT ONLY

Completed 1 October 2026. These measurements use the **242 locked development records only**. The 61-record final holdout was not decoded, predicted, evaluated, or used for selection. No clinical generalization or calibrated-probability claim is made.

## Reproduce the comparison

```sh
uv sync --locked
uv run --locked python -m ml.data verify
uv run --locked python -m ml.anatomy verify
uv run --locked python -m ml.train
uv run --locked python -m ml.train --reproduce
```

Use the existing prepared cache and locked configuration. Do **not** run `ml.data prepare` / `make prepare` during model development: those are the original full-label acquisition/audit operations. The current `verify` command uses byte integrity plus development-only contract/fold verification.

The default run directory is derived from the training configuration fingerprint. Results/configurations/models are immutable; reruns never overwrite a different result. `--reproduce` repeats the full search, checks every saved result and selected configuration with `atol=1e-12, rtol=1e-10`, verifies model checksums, and compares reloaded/fresh model probabilities on development inputs only. Timing files are timestamped separately because elapsed times cannot be deterministic.

## Leakage boundary and smallest loader correction

The previous `load_development` called full-workbook validation and rebuilt the split to verify it. That re-encoded holdout outcomes even though its returned object contained development data. This was technically incompatible with the stricter Phase 3 boundary.

`ml.splits.load_development` now delegates to `ml.development`: verify pinned source/config/artifact bytes, read predictor cells only for opaque membership hashes, identify development groups, and **only then decode the four development target cells**. Holdout target cells are skipped. No holdout feature statistics, label distributions, predictions, or metrics are computed. Source bytes and existing opaque split IDs are read for integrity/membership; this is not a claim that holdout-containing files are never read as bytes. The loader returns only development features/targets/groups/existing nested folds.

`config/development_access.json` pins 180 pre-existing Phase 1 files, including original audits, split/feature manifests, raw dataset snapshot/provenance, anatomy source/mapping/checksum/OBJ files. The exact cached snapshot is required; an acquisition timestamp or any source byte change fails rather than silently accepting a new snapshot. Restoring that matching cache is needed on another machine. The new lock does not replace or edit the old split. Real-source integration checks retain source-byte integrity while avoiding a repeat of the full-label audit. Original synthetic audit/split tests still exercise those behaviors.

Fold verification checks exact five outer/three inner membership, parent coverage, ID uniqueness, validation coverage, both classes, and duplicate-group separation. No folds are generated in development code. A synthetic poisoned workbook test makes holdout target decoding impossible and confirms that development loading still works. Another test forbids calls to full-workbook loading, auditing, or resplitting from the real safe loader.

## Frozen search and preprocessing

The immutable [predeclared search](../config/model_search_v1.json) was written before any fitting: **15 configurations** with seed 42 and one computational thread. No seed hunting, search extension, row filtering, feature selection, calibration, threshold tuning, or added model family occurred.

- Dummy: training-fold class prior.
- Logistic: L2 (`l1_ratio=0`), `C` in {0.1, 1, 10}, class weighting in {none, balanced}; LBFGS, 2,000 maximum iterations, tolerance 1e-8. Convergence warnings fail the run.
- Forest: 100 trees, depth in {3, 5}, minimum leaf size in {5, 10}, class weighting in {none, balanced}, sqrt feature sampling, bootstrap, `n_jobs=1`.

Every fit receives the exact 55 manifest predictors in the locked order. `Cath`, `LAD`, `LCX`, `RCA`, aliases, and unknown derived fields are rejected before preprocessing. Named-schema validation, categorical one-hot encoding, and numeric StandardScaler (logistic only) are inside each pipeline. Forest/dummy numerical features pass through unchanged. Encoder vocabularies are fitted on the training fold; categories present only in validation encode as an all-zero block. Development manifest domains validate source spelling, not encoder fitting. Missing/nonfinite/schema-invalid inputs fail; no imputation is needed or fitted. All source spellings and the constant feature remain. No units or clinical ranges are inferred.

## Selection and evaluation scope

Each target uses its own existing 5 outer / 3 inner folds. Within each outer training set, each candidate receives three inner-validation scores. Rank by mean ROC-AUC descending, mean Brier ascending, then predefined simplicity rank ascending; round to 12 decimals solely for ties. Choose one configuration per family plus one across all families **before scoring outer validation**. Family scores diagnose the restricted searches; the all-family selection procedure is the primary nested-CV estimate.

The final frozen development configuration is chosen by the same rule using the unweighted mean of its **15 existing inner-validation scores**, then fitted on all 242 development records. This uses no outer-test outcome and creates no additional folds. Those 15 scores overlap and are selection inputs, not independent performance estimates. Outer scores estimate the per-outer inner-selection procedures; they are **not an independent evaluation of the frozen all-development model**. Inner choices can differ between outer folds.

All metrics use positive class `CAD` / `Stenotic` = 1, `Normal` = 0, threshold **0.5**, and confusion-matrix rows=true/columns=predicted in [0,1] order. Tables show unweighted outer-fold mean ± sample SD (five folds); SD is descriptive variation, not a patient-level confidence interval. Full min/max/per-fold values and class counts are retained in JSON.

PR-AUC is trapezoidal area under the precision-recall curve. **Average precision (AP)** is also retained because trapezoidal interpolation can make a constant-prior dummy appear surprisingly strong. Do not conflate the two or conceal vessel PR-AUC being below that interpolated dummy. [scikit-learn AP definition](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html). Curves and confusion matrices pool 242 out-of-fold predictions; these differ from averaging fold metrics. Dummy fold ROC-AUC is 0.5, while pooled scores can vary with fold-specific training prevalence. Pooled outcomes never enter selection.

## Selected development configurations

| Target | Development negative / positive | Frozen family and parameters | Mean inner ROC-AUC / Brier (selection inputs only) |
| --- | --- | --- | --- |
| CAD | 69 / 173 | logistic: `{'C': 0.1, 'class_weight': 'balanced'}` | 0.9209 / 0.1086 |
| LAD | 98 / 144 | logistic: `{'C': 0.1, 'class_weight': 'balanced'}` | 0.8301 / 0.1670 |
| LCX | 147 / 95 | forest: `{'class_weight': None, 'max_depth': 3, 'min_samples_leaf': 10}` | 0.7248 / 0.2149 |
| RCA | 149 / 93 | forest: `{'class_weight': None, 'max_depth': 5, 'min_samples_leaf': 10}` | 0.7183 / 0.2122 |

CAD/LAD use fold-fitted scaling plus one-hot encoding; LCX/RCA use unscaled numeric values plus fold-fitted one-hot encoding. Full estimator parameters, final fitted category vocabularies/scaler coefficients, encoded feature names, fit membership fingerprints, positive encodings, and the explicit selection reason are saved.

## Complete outer-fold development comparison

Every family below means **inner-selected settings for that family**, not one fixed estimator independently tested. `selection_procedure` chooses among all three families in each outer training fold.

### CAD

| Procedure | Accuracy | Balanced accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | AP | Brier |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dummy | 0.715 ± 0.009 | 0.500 ± 0.000 | 0.715 ± 0.009 | 1.000 ± 0.000 | 0.834 ± 0.006 | 0.500 ± 0.000 | 0.857 ± 0.004 | 0.715 ± 0.009 | 0.204 ± 0.004 |
| logistic | 0.864 ± 0.020 | 0.856 ± 0.039 | 0.933 ± 0.029 | 0.873 ± 0.018 | 0.902 ± 0.012 | 0.930 ± 0.023 | 0.971 ± 0.012 | 0.972 ± 0.012 | 0.103 ± 0.013 |
| forest | 0.830 ± 0.053 | 0.748 ± 0.109 | 0.848 ± 0.075 | 0.943 ± 0.070 | 0.889 ± 0.033 | 0.918 ± 0.033 | 0.965 ± 0.016 | 0.966 ± 0.016 | 0.137 ± 0.016 |
| selection_procedure | 0.826 ± 0.037 | 0.740 ± 0.098 | 0.843 ± 0.070 | 0.943 ± 0.057 | 0.887 ± 0.018 | 0.926 ± 0.020 | 0.968 ± 0.014 | 0.969 ± 0.014 | 0.119 ± 0.018 |

| Procedure | Pooled OOF TN / FP / FN / TP | Outer ROC-AUC min–max |
| --- | --- | --- |
| dummy | 0 / 69 / 0 / 173 | 0.500–0.500 |
| logistic | 58 / 11 / 22 / 151 | 0.901–0.955 |
| forest | 38 / 31 / 10 / 163 | 0.864–0.953 |
| selection_procedure | 37 / 32 / 10 / 163 | 0.901–0.955 |

Inner-selected outer configurations: `forest-depth3-leaf5-none`, `logistic-C0.1-balanced`, `logistic-C0.1-none`, `forest-depth3-leaf5-none`, `forest-depth5-leaf5-none`.

### LAD

| Procedure | Accuracy | Balanced accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | AP | Brier |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dummy | 0.595 ± 0.009 | 0.500 ± 0.000 | 0.595 ± 0.009 | 1.000 ± 0.000 | 0.746 ± 0.007 | 0.500 ± 0.000 | 0.798 ± 0.005 | 0.595 ± 0.009 | 0.241 ± 0.002 |
| logistic | 0.756 ± 0.067 | 0.745 ± 0.073 | 0.794 ± 0.070 | 0.805 ± 0.084 | 0.797 ± 0.057 | 0.833 ± 0.070 | 0.876 ± 0.054 | 0.879 ± 0.052 | 0.167 ± 0.038 |
| forest | 0.752 ± 0.072 | 0.726 ± 0.077 | 0.756 ± 0.063 | 0.868 ± 0.067 | 0.807 ± 0.054 | 0.817 ± 0.078 | 0.866 ± 0.063 | 0.869 ± 0.061 | 0.188 ± 0.019 |
| selection_procedure | 0.761 ± 0.065 | 0.749 ± 0.071 | 0.794 ± 0.067 | 0.813 ± 0.071 | 0.801 ± 0.054 | 0.826 ± 0.077 | 0.871 ± 0.059 | 0.874 ± 0.058 | 0.167 ± 0.037 |

| Procedure | Pooled OOF TN / FP / FN / TP | Outer ROC-AUC min–max |
| --- | --- | --- |
| dummy | 0 / 98 / 0 / 144 | 0.500–0.500 |
| logistic | 67 / 31 / 28 / 116 | 0.767–0.944 |
| forest | 57 / 41 / 19 / 125 | 0.754–0.936 |
| selection_procedure | 67 / 31 / 27 / 117 | 0.754–0.944 |

Inner-selected outer configurations: `forest-depth3-leaf5-balanced`, `logistic-C0.1-balanced`, `logistic-C0.1-none`, `logistic-C0.1-balanced`, `forest-depth5-leaf5-balanced`.

### LCX

| Procedure | Accuracy | Balanced accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | AP | Brier |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dummy | 0.607 ± 0.004 | 0.500 ± 0.000 | 0.000 ± 0.000 | 0.000 ± 0.000 | 0.000 ± 0.000 | 0.500 ± 0.000 | 0.696 ± 0.002 | 0.393 ± 0.004 | 0.238 ± 0.001 |
| logistic | 0.632 ± 0.071 | 0.626 ± 0.081 | 0.526 ± 0.069 | 0.600 ± 0.161 | 0.556 ± 0.099 | 0.707 ± 0.077 | 0.604 ± 0.117 | 0.620 ± 0.109 | 0.221 ± 0.029 |
| forest | 0.645 ± 0.014 | 0.591 ± 0.060 | 0.610 ± 0.055 | 0.347 ± 0.272 | 0.386 ± 0.194 | 0.724 ± 0.036 | 0.629 ± 0.044 | 0.643 ± 0.043 | 0.217 ± 0.007 |
| selection_procedure | 0.645 ± 0.014 | 0.591 ± 0.060 | 0.610 ± 0.055 | 0.347 ± 0.272 | 0.386 ± 0.194 | 0.724 ± 0.036 | 0.629 ± 0.044 | 0.643 ± 0.043 | 0.217 ± 0.007 |

| Procedure | Pooled OOF TN / FP / FN / TP | Outer ROC-AUC min–max |
| --- | --- | --- |
| dummy | 147 / 0 / 95 / 0 | 0.500–0.500 |
| logistic | 96 / 51 / 38 / 57 | 0.606–0.819 |
| forest | 123 / 24 / 62 / 33 | 0.661–0.748 |
| selection_procedure | 123 / 24 / 62 / 33 | 0.661–0.748 |

Inner-selected outer configurations: `forest-depth3-leaf10-none`, `forest-depth3-leaf10-none`, `forest-depth3-leaf5-balanced`, `forest-depth3-leaf10-balanced`, `forest-depth3-leaf10-none`.

### RCA

| Procedure | Accuracy | Balanced accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | AP | Brier |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dummy | 0.616 ± 0.009 | 0.500 ± 0.000 | 0.000 ± 0.000 | 0.000 ± 0.000 | 0.000 ± 0.000 | 0.500 ± 0.000 | 0.692 ± 0.005 | 0.384 ± 0.009 | 0.237 ± 0.002 |
| logistic | 0.670 ± 0.058 | 0.641 ± 0.068 | 0.574 ± 0.079 | 0.516 ± 0.114 | 0.543 ± 0.098 | 0.732 ± 0.056 | 0.616 ± 0.114 | 0.633 ± 0.104 | 0.205 ± 0.023 |
| forest | 0.678 ± 0.046 | 0.630 ± 0.067 | 0.671 ± 0.124 | 0.421 ± 0.237 | 0.473 ± 0.146 | 0.722 ± 0.031 | 0.624 ± 0.034 | 0.637 ± 0.030 | 0.212 ± 0.006 |
| selection_procedure | 0.678 ± 0.046 | 0.638 ± 0.072 | 0.644 ± 0.108 | 0.463 ± 0.244 | 0.495 ± 0.159 | 0.734 ± 0.027 | 0.629 ± 0.043 | 0.642 ± 0.040 | 0.210 ± 0.007 |

| Procedure | Pooled OOF TN / FP / FN / TP | Outer ROC-AUC min–max |
| --- | --- | --- |
| dummy | 149 / 0 / 93 / 0 | 0.500–0.500 |
| logistic | 114 / 35 / 45 / 48 | 0.675–0.813 |
| forest | 125 / 24 / 54 / 39 | 0.690–0.770 |
| selection_procedure | 121 / 28 / 50 / 43 | 0.704–0.770 |

Inner-selected outer configurations: `forest-depth3-leaf5-none`, `forest-depth3-leaf10-balanced`, `logistic-C0.1-balanced`, `forest-depth5-leaf5-none`, `forest-depth5-leaf10-balanced`.

## Weaknesses and interpretation

All four all-family selection procedures improve fold ROC-AUC and Brier over the dummy, but this is development evidence from a small public dataset. CAD is strongest (ROC-AUC 0.926 ± 0.020). LAD is less stable (0.826 ± 0.077; fold range 0.754–0.944). Family selection switches in CAD/LAD/RCA; the frozen configuration must not be portrayed as winning every fold.

LCX and RCA are the weak targets. LCX recall is 0.347 ± 0.272 (range 0.105–0.737), with 62 false negatives among its 95 development positives in pooled OOF predictions. RCA recall is 0.463 ± 0.244 (range 0.211–0.778), with 50 false negatives among 93 positives. LCX balanced accuracy is only 0.591 ± 0.060; RCA is 0.638 ± 0.072. Their apparent accuracy improvement over majority-class dummy is modest. We retained the required 0.5 threshold and did not tune to hide these failures. No statistical superiority or clinical efficacy claim is supported.

RCA logistic has a slightly higher family-specific outer mean ROC-AUC than forest. RCA remains a frozen forest because **inner scores**, not outer results, chose it. Conversely CAD/LAD family-specific logistic metrics look better than some all-family metrics; the complete selection procedure is still reported without retrospectively replacing its choices.

## Data findings during this phase

- The safe source reader exposed cached predictor formulas: BMI uses `B2/((C2/100)*(C2/100))` and Obesity uses `IF(Table2[[#This Row],[BMI]]>=25,"Y","N")` in the first data row. Preserve immutable cached values, matching Phase 1 `data_only` behavior; never execute/recalculate them or treat the threshold as a new clinical rule. Missing caches/unreviewed predictor formulas fail. Dataset units remain undocumented.
- The 242 development inputs contain zero missing values and retain constant `Exertional CP`. No rows were removed or source labels modified.
- Rare allowed categories are absent from some inner training folds: CHF, CVA, LowTH Ang, Weak Peripheral Pulse, Thyroid Disease, and BBB (`RBBB`). The fold-fitted encoder handles validation-only categories without learning their vocabulary from validation. Fitted vocabularies are persisted for every fit; this is a limitation of small training folds, not a reason to use global encoding.
- The original Cath/vessel discrepancy, spelling/casing, lack of verified patient IDs, and undocumented numeric sentinel meanings remain as documented in [source notes](SOURCE_NOTES.md). No full-source/holdout descriptive audit was rerun.

## Actual local runtime

Measured on this macOS ARM machine, single-threaded fits. First-run nested comparison timing includes pipeline construction/metadata/scoring; final-fit timing includes fitted model setup; prediction measures named-schema validation plus preprocessing and positive-class probability. Warmup precedes 100 single-profile calls (first development record) and ten 242-record calls. These are local approximate timings, not browser/API/network latency.

| Target | Nested comparison (s) | Selected development fit (s) | Single profile median / p95 (ms) | 242-record batch median (ms) |
| --- | --- | --- | --- | --- |
| CAD | 8.39 | 0.011 | 3.56 / 3.75 | 3.93 |
| LAD | 9.61 | 0.011 | 3.72 / 4.00 | 4.16 |
| LCX | 9.19 | 0.043 | 5.52 / 6.02 | 6.49 |
| RCA | 8.90 | 0.044 | 5.25 / 5.46 | 6.37 |

Total first-run nested comparison: **36.08 seconds**, 900 inner fits + 60 outer family refits + four final development fits. Reproduction measurements are saved separately; initial checks were running concurrently, so timings describe this session's load.

## Versioned artifacts and checks

Run: [`v1-bb08b3d0230a`](../artifacts/development/v1-bb08b3d0230a/). Full fingerprint: `bb08b3d0230a6cd00b40ee13f84977a70bbdf0e0ca5e78b5ac9c0ab7be11722c`.

- `results.json`: complete inner/outer metrics, exact outer IDs, per-fit preprocessing metadata, selection records, OOF probabilities/labels (development only), aggregate means/SD/min/max, class counts, curve points.
- `comparison.csv`: every family/procedure metric mean/SD and pooled confusion counts.
- `selected_configurations.json`, `search.json`, `provenance.json`: frozen options, preprocessing/schema/split/search/source-access/code/library/lockfile fingerprints, seed, training membership.
- `models/{CAD,LAD,LCX,RCA}.joblib` and corresponding JSON: trusted local development-only pipelines, checksums, complete parameters and fitted preprocessing. They are **not deployed**; loading joblib requires trusting the artifact.
- `figures/*-curves.{png,svg}` and `*-confusion.{png,svg}`: clearly marked development/nested-CV plots for all targets; LCX curves and CAD confusion matrices were visually checked.
- `timings/*.json`: actual training/inference measurements, with machine and UTC context.

Verification: 66 Python tests (23 new modeling cases), 30 frontend tests, real-source byte/development verification and all 83 anatomy source/mesh checks, Ruff lint/format, TypeScript checks, production frontend build, full real nested comparison, and a full unchanged deterministic rerun. All 180 locked Phase 1 source/artifact files retain their original hashes. The existing nonfatal Vite large-bundle warning persists. No model API, viewer risk state, anatomy source, or frontend implementation changed.

## Phase boundary

Ready: four frozen development-only fitted pipelines, bounded reproducible nested comparison, baseline/family/procedure evidence, complete metrics/plots, strict holdout boundary, artifacts and runtime measurements. No blocker remains for this phase.

Not done: the single final holdout evaluation, calibration assessment, SHAP, prediction API integration, patient input UX, actual-model anatomy coloring, evidence-page UI, final report/submission, broader device testing or independent clinical/anatomical validation. None was started here. The next phase must preserve the frozen artifacts and the once-only evaluation rule; no holdout result exists yet.

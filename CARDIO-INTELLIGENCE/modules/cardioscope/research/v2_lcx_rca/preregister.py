"""Write the one-shot protocol before any experiment/model result exists."""

import itertools
import subprocess

from ml.common import ROOT, digest, object_digest, utc_now, write_json_once, write_once
from research.v2_lcx_rca.core import data_identity, load_data, make_folds, runtime_versions
from scripts.verify_immutable import verify

HERE = ROOT / "research/v2_lcx_rca"
OUTPUT = ROOT / "artifacts/experiments/v2-lcx-rca-20261003-01"


def candidates():
    rows = []
    for C, ratio, weight in itertools.product(
        [0.03, 0.1, 0.3], [0.9, 0.5, 0.0], [None, "balanced"]
    ):
        rows.append(
            {
                "id": f"elastic-C{C}-l1{ratio}-{weight}",
                "family": "elastic_net",
                "params": {"C": C, "l1_ratio": ratio, "class_weight": weight},
            }
        )
    for depth, leaf, weight in itertools.product([3, 5], [10, 5], [None, "balanced"]):
        rows.append(
            {
                "id": f"forest-d{depth}-leaf{leaf}-{weight}",
                "family": "forest",
                "params": {"max_depth": depth, "min_samples_leaf": leaf, "class_weight": weight},
            }
        )
    for depth, weight in itertools.product([1, 2, 3], ["none", "balanced"]):
        rows.append(
            {
                "id": f"xgb-d{depth}-{weight}",
                "family": "xgboost",
                "params": {"max_depth": depth},
                "weighting": weight,
            }
        )
    for rank, row in enumerate(rows, start=1):
        row["simplicity_rank"] = rank
    return rows


def preregister():
    if (HERE / "protocol.json").exists() or OUTPUT.exists():
        raise ValueError("One experiment only: existing protocol/results cannot be overwritten")
    frozen = verify()
    data, manifest = load_data()
    protocol = {
        "experiment_id": OUTPUT.name,
        "version": 1,
        "status": "POST_HOLDOUT_INTERNAL_DEVELOPMENT_ONLY",
        "created_at_utc": utc_now(),
        "starting_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "baseline_tag": "cardioscope-v1.0.0",
        "baseline_commit": subprocess.check_output(
            ["git", "rev-parse", "cardioscope-v1.0.0^{}"], text=True
        ).strip(),
        "protected_manifest_sha256": frozen["manifest_sha256"],
        **data_identity(data),
        "development_records": 242,
        "schema_sha256": object_digest(manifest),
        "predictors": manifest["feature_order"],
        "targets": {t: manifest["targets"][t] for t in ["LCX", "RCA"]},
        "outer_folds": 5,
        "outer_repeats": 5,
        "inner_folds": 4,
        "outer_seeds": [1729, 2718, 3141, 5772, 8119],
        "inner_seeds": {
            t: [[20001 + ti * 1000 + r * 10 + f for f in range(5)] for r in range(5)]
            for ti, t in enumerate(["LCX", "RCA"])
        },
        "final_inner_seeds": {"LCX": 22001, "RCA": 23001},
        "estimator_seed": 271828,
        "reference_fixed": {"n_estimators": 100, "random_state": 42},
        "references": {
            t: {
                "id": f"v1-reference-{t}",
                "family": "reference",
                "simplicity_rank": 0,
                "params": {"max_depth": depth, "min_samples_leaf": 10, "class_weight": None},
            }
            for t, depth in [("LCX", 3), ("RCA", 5)]
        },
        "candidates": candidates(),
        "forest_fixed": {
            "n_estimators": 500,
            "n_jobs": 1,
            "bootstrap": True,
            "max_features": "sqrt",
        },
        "elastic_net_fixed": {"solver": "saga", "max_iter": 20000, "tol": 1e-7},
        "xgboost_fixed": {
            "objective": "binary:logistic",
            "booster": "gbtree",
            "tree_method": "hist",
            "device": "cpu",
            "n_jobs": 1,
            "n_estimators": 200,
            "learning_rate": 0.03,
            "min_child_weight": 5,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "reg_lambda": 10.0,
            "reg_alpha": 0.0,
            "gamma": 1.0,
            "max_bin": 256,
            "eval_metric": "logloss",
            "verbosity": 0,
        },
        "weighting": {
            "xgboost_balanced": "n_negative/n_positive from each fitting partition only",
            "other_balanced": "sklearn training-fold inverse-class-frequency rule",
        },
        "preprocessing": {
            "categorical": (
                "training-fold-fitted OneHotEncoder auto, dense, ignore unknown, no drop"
            ),
            "numeric_elastic_net": (
                "training-fold-fitted StandardScaler on all non-categorical predictors"
            ),
            "numeric_tree": "passthrough",
            "missing": "reject, no imputation",
            "schema_domains": (
                "locked development contract validates spelling; does not fit encoder vocabulary"
            ),
            "feature_selection": "none",
            "calibration": "none",
        },
        "threshold_rule": {
            "sensitivity_min": 0.65,
            "specificity_min": 0.60,
            "select": (
                "highest unique inner OOF probability threshold satisfying both; >= comparison"
            ),
            "enumeration": "unique OOF probabilities plus 0 and 1",
            "failure": (
                "ineligible; no model/threshold fallback; no outer metrics for that arm/fold"
            ),
        },
        "selection": {
            "ordering": [
                "highest pooled inner OOF balanced_accuracy at selected threshold",
                "highest pooled inner OOF trapezoidal PR-AUC",
                "highest pooled inner OOF ROC-AUC",
                "lowest predefined simplicity_rank",
            ],
            "round_decimals_for_ties": 12,
            "simplicity": (
                "existing reference, then elastic-net C ascending/l1_ratio "
                "descending/unweighted first, then shallower RF/larger "
                "leaves/unweighted first, then shallow XGBoost/unweighted first"
            ),
            "complete_pool": (
                "target reference plus 18 elastic-net, 8 forest, 6 XGBoost configurations"
            ),
            "primary": "complete inner selection procedure, never retrospective best outer family",
            "final": "same selection on new predeclared full-development 4-fold inner OOF only",
        },
        "metrics": [
            "sensitivity",
            "specificity",
            "balanced_accuracy",
            "precision",
            "f1",
            "roc_auc",
            "pr_auc",
            "average_precision",
            "predicted_positive_rate",
            "prevalence",
            "confusion_matrix",
        ],
        "metric_definitions": {
            "positive": "Stenotic=1, Normal=0",
            "pr_auc": "trapezoidal precision-recall area",
            "average_precision": "non-interpolated AP",
            "confusion": "rows true/columns predicted [0,1]",
            "zero_predicted_positive": "precision and F1=0; no silent undefined metric",
            "fold_summary": (
                "unweighted mean/sample SD/median/min/max/individual values; "
                "descriptive correlated folds"
            ),
            "repeat_pooling": (
                "one prediction per development record per repeat, applying each "
                "fold's frozen threshold"
            ),
        },
        "success_gate": {
            "sensitivity_min": 0.65,
            "specificity_min": 0.60,
            "balanced_accuracy_min": 0.625,
            "successful_repeats_min": 4,
            "repeat_sensitivity_floor": 0.55,
            "repeat_specificity_floor": 0.50,
            "roc_auc_decline_max": 0.02,
            "quality_margin": 0.05,
            "positive_rate_max": 0.65,
            "all_outer_rules_eligible": True,
            "joint_success": "BOTH targets must pass all criteria",
            "interpretation": (
                "prototype research criteria, not clinical safety standards; "
                "numeric repeat/quality definitions fixed before results"
            ),
        },
        "diagnosis_rule": {
            "A": (
                "threshold-only passes same gate, mean sensitivity/BA no more "
                "than .03 below primary and mean ROC-AUC no more than .02 below "
                "primary: prefer operating-point explanation"
            ),
            "B": (
                "threshold-only fails gate, primary passes, and a non-reference "
                "family is selected in >=15/25 folds: evidence for ranking-model "
                "change"
            ),
            "C": (
                "primary fails gate: no stable improvement supported; retain v1 and stop searching"
            ),
            "otherwise": (
                "mixed/inconclusive evidence; no complexity preference inferred "
                "from trivial outer AUC differences"
            ),
        },
        "uncertainty": {
            "bootstrap_samples": 2000,
            "seed": 161803,
            "unit": (
                "development predictor-group/patient proxy, resampled jointly "
                "across all five cross-fitted repeats"
            ),
            "estimand": (
                "mean of five repeat-pooled metrics conditional on already fitted"
                " rules; percentile 95% intervals"
            ),
            "limitations": (
                "no retraining; no selection uncertainty/full external-"
                "generalization CI; repeated patients are not independent cohorts"
            ),
        },
        "reproduction": {
            "probability_atol": 1e-12,
            "probability_rtol": 1e-10,
            "single_thread": True,
            "timing_excluded": True,
            "protocol_and_code_hashes_checked_before_each_run": True,
        },
        "runtime": runtime_versions(),
        "requirements_lock_sha256": digest((HERE / "requirements.lock.txt").read_bytes()),
        "source_code_sha256": {
            str(p.relative_to(ROOT)): digest(p.read_bytes()) for p in sorted(HERE.rglob("*.py"))
        },
        "forbidden": [
            "reserved outcome decoding",
            "final holdout inference/evaluator",
            "v1 artifact writes",
            "outer-based selection changes",
            "new seeds/candidates after results",
            "deployment",
            "calibration",
            "feature subset search",
        ],
    }
    folds = make_folds(data, protocol)
    protocol["experimental_folds_sha256"] = object_digest(folds)
    write_json_once(HERE / "folds.json", folds)
    write_json_once(HERE / "protocol.json", protocol)
    write_once(HERE / "protocol.sha256", (object_digest(protocol) + "\n").encode())
    print(f"Preregistered {protocol['experiment_id']}: {object_digest(protocol)}; no models fitted")


if __name__ == "__main__":
    preregister()

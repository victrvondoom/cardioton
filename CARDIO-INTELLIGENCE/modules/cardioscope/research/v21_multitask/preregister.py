"""Write-once protocol, implementation and baseline seals before any real fit."""

import importlib.metadata
import itertools
import platform
import subprocess

from ml.common import ROOT, digest, object_digest, read_json, utc_now, write_json_once, write_once
from research.v2_lcx_rca.core import load_data, validate_folds
from scripts.verify_immutable import verify

HERE = ROOT / "research/v21_multitask"
OUTPUT = ROOT / "artifacts/experiments/v21-multitask-20261003-01"
PREVIOUS = ROOT / "artifacts/experiments/v2-lcx-rca-20261003-01/results.json"
FOLDS = ROOT / "research/v2_lcx_rca/folds.json"


def identity(data):
    return {
        "membership_sha256": object_digest(data.features.index.tolist()),
        "groups_sha256": object_digest(data.groups.to_dict()),
        "all_task_development_sha256": object_digest(
            {
                "X": data.features.to_dict(orient="split"),
                "Y": data.targets.loc[:, ["CAD", "LAD", "LCX", "RCA"]].to_dict(orient="split"),
            }
        ),
    }


def runtime():
    names = read_json(ROOT / "docs/hardening/LINUX_ENVIRONMENT.json")["packages"]
    names = sorted(
        {
            *names,
            "xgboost",
            "torch",
            "filelock",
            "fsspec",
            "sympy",
            "networkx",
            "jinja2",
            "MarkupSafe",
            "mpmath",
        }
    )
    return {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "packages": {n: importlib.metadata.version(n) for n in names},
    }


def candidates():
    rows = []
    for hidden, drop, decay, weighting in itertools.product(
        [[32, 16], [64, 32]], [0.1, 0.25], [1e-3, 1e-4], ["equal", "vessel-focused"]
    ):
        rows.append(
            {
                "id": f"mlp-{hidden[0]}-{hidden[1]}-d{drop}-l2{decay}-{weighting}",
                "hidden": hidden,
                "dropout": drop,
                "weight_decay": decay,
                "weighting": weighting,
                "weights": [1, 1, 1, 1] if weighting == "equal" else [1, 1, 1.5, 1.5],
                "simplicity_rank": len(rows),
            }
        )
    return rows


def preregister():
    if (HERE / "protocol.json").exists() or OUTPUT.exists():
        raise ValueError("Exactly one study; never overwrite protocol or results")
    frozen = verify()
    data, manifest = load_data()
    folds = read_json(FOLDS)
    validate_folds(data, folds)
    tracked = subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0")
    baseline = {p: digest((ROOT / p).read_bytes()) for p in tracked if p}
    sources = {
        str(p.relative_to(ROOT)): digest(p.read_bytes())
        for p in HERE.rglob("*.py")
        if "__pycache__" not in str(p)
    }
    protocol = {
        "id": OUTPUT.name,
        "created_at_utc": utc_now(),
        "scope": "DEVELOPMENT ONLY; STOP AFTER STUDY",
        "starting_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "records": 242,
        "raw_predictors": 55,
        "targets": ["CAD", "LAD", "LCX", "RCA"],
        "holdout_use": "FORBIDDEN; sealed v1 bytes only, never deserialize outcomes/results",
        "protected_manifest_sha256": frozen["manifest_sha256"],
        "schema_sha256": object_digest(manifest),
        **identity(data),
        "preprocessing": "Exact v1 linear SchemaGuard / training-fit StandardScaler and auto dense "
        "OneHotEncoder(ignore unknown). 55 raw fields; encoded width fold dependent. "
        "No targets, imputation, global vocabulary, feature selection or calibration.",
        "outer": {
            "folds": 5,
            "repeats": 5,
            "strata": ["LCX", "RCA"],
            "policy": "Reuse each previous target's exact outer/4-inner folds. Each model learns "
            "all four tasks. Focal vessel determines inner model selection only. "
            "50 outer fits total, not 50 independent samples. CAD/LAD assessed separately "
            "in both strata, never pool duplicate patients across strata.",
        },
        "folds_sha256": object_digest(folds),
        "previous_results_sha256": digest(PREVIOUS.read_bytes()),
        "previous_protocol_sha256": (ROOT / "research/v2_lcx_rca/protocol.sha256")
        .read_text()
        .strip(),
        "references": "Reuse sealed, same-fold v2 development OOF RF@0.5 / RF nested threshold / "
        "v2 selection_procedure. Refit CAD/LAD exact v1 balanced logistic C0.1, seed42 "
        "on each outer TRAIN only; @0.5. Do not load all-development v1 fitted models.",
        "candidates": candidates(),
        "architecture": "Two dense/ReLU/dropout blocks; four separate one-unit linear heads; "
        "sigmoid inference. BCEWithLogitsLoss is stable sigmoid+BCE.",
        "training": {
            "optimizer": "Adam (coupled L2; not AdamW)",
            "learning_rate": 0.001,
            "batch": "full inner fit partition",
            "max_epochs": 300,
            "patience": 30,
            "min_delta": 0.0001,
            "device": "CPU",
            "threads": 1,
            "dtype": "float32",
            "loss": "sum(weight * per-task mean BCE)/sum(weights), no class weighting",
            "early_stopping": "Fixed first 5-fold stratified/group-safe holdback from each "
            "inner TRAIN; scaler/encoder fit only on remaining 80%. "
            "Scoring inner validation and outer rows never passed to stopping.",
            "refit": "Fresh network+preprocessing on all inner TRAIN for private-holdback "
            "best epoch. Outer TRAIN fresh refit for nearest-half-up median of the "
            "four inner best epochs. No outer stopping or threshold feedback.",
            "seed": "SHA256(context) first8 hex mod(2^31-1); stopping split context+'/stop'; "
            "same fit seed across 16 configs, refit +1; no seed search",
            "determinism": "Python/NumPy/torch fixed seeds; deterministic algorithms; CPU1thread",
        },
        "threshold_rule": {
            "sensitivity_min": 0.65,
            "specificity_min": 0.60,
            "select": "highest inner-OOF probability among unique p plus0/1 using >=",
            "failure": "ineligible; no substitute threshold",
        },
        "selection": "Among inner focal-eligible configs maximize pooled focal BA, "
        "trapezoidal PR-AUC, "
        "ROC-AUC, then smallest predefined rank; scores rounded12. If none eligible, "
        "ranking-only highest inner focal ROC selects diagnostic CAD/LAD/@0.5 predictions, "
        "never a fallback screening threshold. Nonfocal vessel has its own inner threshold.",
        "cad_lad_threshold": 0.5,
        "gate": {
            "sensitivity_min": 0.65,
            "specificity_min": 0.60,
            "balanced_accuracy_min": 0.625,
            "successful_repeats_min": 4,
            "repeat_sensitivity_floor": 0.55,
            "repeat_specificity_floor": 0.50,
            "roc_auc_decline_max": 0.02,
            "quality_margin": 0.05,
            "positive_rate_max": 0.65,
            "policy": "Same v2 operational gate; ALL25 focal rules eligible, mean fold floors, "
            "4/5 complete repeat-pooled floors; no extreme repeat; PPV/PR/AP above "
            "prevalence+.05; all-task safeguards also required.",
        },
        "cad_lad_maximum_mean_decline": {
            "roc_auc": 0.02,
            "balanced_accuracy": 0.03,
            "sensitivity": 0.05,
            "average_precision": 0.03,
        },
        "final_if_pass": "Only if BOTH focal gates and CAD/LAD gates in BOTH strata pass: "
        "select ONE "
        "joint-eligible config using previous LCX full-development4inner folds; "
        "mean LCX/RCA BA then PR-AUC then ROC-AUC then rank. Median inner best epoch; "
        "fit all242. If no jointly eligible config, no freeze. Never old holdout/deploy.",
        "failure": "STOP; no more configs, search, reweighting, thresholds or seed changes",
        "report": "Outer selection-procedure evaluation, never independent test "
        "or confidence interval. "
        "Repeat SD descriptive only; conditional comparisons disclose ineligible subsets.",
        "numerical_tolerance": {"probabilities": 1e-10, "metrics": 1e-12},
        "runtime": runtime(),
        "baseline_files_sha256": baseline,
        "source_files_sha256": sources,
        "requirements_lock_sha256": digest((HERE / "requirements.lock.txt").read_bytes()),
        "official_docs": [
            "https://docs.pytorch.org/docs/stable/generated/torch.nn.BCEWithLogitsLoss.html",
            "https://docs.pytorch.org/docs/stable/generated/torch.optim.Adam.html",
            "https://docs.pytorch.org/docs/stable/notes/randomness.html",
        ],
    }
    write_json_once(HERE / "protocol.json", protocol)
    write_once(HERE / "protocol.sha256", (object_digest(protocol) + "\n").encode())
    print("PREREGISTERED", object_digest(protocol), "16 candidates; no real fits yet")


if __name__ == "__main__":
    preregister()

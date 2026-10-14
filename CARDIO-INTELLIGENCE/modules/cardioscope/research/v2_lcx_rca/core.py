"""Pure selection, metrics and fold-fitted models for the locked v2 experiment."""

import contextlib
import importlib.metadata
import platform
import time
import warnings
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.exceptions import ConvergenceWarning
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    auc,
    average_precision_score,
    confusion_matrix,
    precision_recall_curve,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from threadpoolctl import threadpool_limits
from xgboost import XGBClassifier

from ml.common import ROOT, object_digest, read_json
from ml.data import assert_feature_columns
from ml.development import load_safe_development
from ml.models import SchemaGuard, positive_probability
from ml.splits import assert_disjoint_groups, cv_partitions

TARGETS = ("LCX", "RCA")
ARMS = (
    "v1_rf_0.5",
    "v1_rf_nested_threshold",
    "elastic_net",
    "forest",
    "xgboost",
    "selection_procedure",
)
SCALARS = (
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
)


@contextlib.contextmanager
def development_boundary():
    """Block research access to reserved readers/evaluation and full-source label readers."""

    def forbidden(*args, **kwargs):
        raise AssertionError("V2 boundary: holdout/full-source outcome access forbidden")

    with contextlib.ExitStack() as stack:
        for name in (
            "ml.holdout_data.load_reserved_holdout",
            "ml.evaluate_holdout.load_reserved_holdout",
            "ml.evaluate_holdout.run_evaluation",
            "ml.data.load_workbook",
            "ml.data.audit",
            "ml.splits.build_split",
            "pandas.read_excel",
        ):
            stack.enter_context(patch(name, side_effect=forbidden))
        yield


def load_data(root: Path = ROOT):
    with development_boundary():
        data = load_safe_development(root)
    manifest = read_json(root / "artifacts/data/feature_manifest.json")
    assert_feature_columns(
        data.features.columns,
        {
            "features": manifest["feature_order"],
            "targets": manifest["targets"],
            "forbidden_feature_aliases": manifest["forbidden_feature_aliases"],
        },
    )
    if len(data.features) != 242 or set(data.targets) != {"CAD", "LAD", "LCX", "RCA"}:
        raise ValueError("The original development contract must contain exactly 242 records")
    if not data.features.index.equals(data.targets.index):
        raise ValueError("Development target alignment differs")
    return data, manifest


def data_identity(data):
    return {
        "membership_sha256": object_digest(data.features.index.tolist()),
        "groups_sha256": object_digest(data.groups.to_dict()),
        "development_data_sha256": object_digest(
            {
                "features": data.features.to_dict(orient="split"),
                "targets": data.targets.loc[:, list(TARGETS)].to_dict(orient="split"),
            }
        ),
    }


def runtime_versions():
    pins = read_json(ROOT / "docs/hardening/LINUX_ENVIRONMENT.json")["packages"]
    return {
        "python": platform.python_version(),
        "packages": {name: importlib.metadata.version(name) for name in [*pins, "xgboost"]},
        "platform": platform.platform(),
    }


def partition(y, groups, folds, seed):
    result = []
    for train, validation in cv_partitions(y, groups.loc[y.index], folds, seed):
        tr, va = y.index[train].tolist(), y.index[validation].tolist()
        assert_disjoint_groups(tr, va, groups.to_dict())
        if set(y.loc[tr]) != {0, 1} or set(y.loc[va]) != {0, 1}:
            raise ValueError("Each partition needs both classes")
        result.append({"train_ids": tr, "validation_ids": va})
    return result


def make_folds(data, protocol):
    result = {}
    for target in TARGETS:
        y = data.targets[target]
        repeats = []
        for repeat, seed in enumerate(protocol["outer_seeds"]):
            outer = partition(y, data.groups, 5, seed)
            for number, fold in enumerate(outer):
                fold["inner"] = partition(
                    y.loc[fold["train_ids"]],
                    data.groups,
                    4,
                    protocol["inner_seeds"][target][repeat][number],
                )
            repeats.append(outer)
        result[target] = {
            "repeats": repeats,
            "full_development_inner": partition(
                y,
                data.groups,
                4,
                protocol["final_inner_seeds"][target],
            ),
        }
    validate_folds(data, result)
    return result


def validate_folds(data, folds):
    ids = data.features.index.tolist()
    if not data.features.index.is_unique or not data.groups.index.equals(data.features.index):
        raise ValueError("Invalid development membership")
    if set(folds) != set(TARGETS):
        raise ValueError("Unexpected experimental targets")
    lookup = data.groups.to_dict()

    def validate(parts, parent, count):
        if len(parts) != count:
            raise ValueError("Incorrect locked fold count")
        seen = []
        for fold in parts:
            tr, va = fold["train_ids"], fold["validation_ids"]
            if len(set(tr)) != len(tr) or len(set(va)) != len(va):
                raise ValueError("Repeated fold record")
            if set(tr) | set(va) != set(parent):
                raise ValueError("Fold escapes its development/outer-training parent")
            assert_disjoint_groups(tr, va, lookup)
            seen.extend(va)
        if Counter(seen) != Counter(parent):
            raise ValueError("Validation coverage is not exactly once")

    for target in TARGETS:
        if len(folds[target]["repeats"]) != 5:
            raise ValueError("Exactly five repeats required")
        for outer in folds[target]["repeats"]:
            validate(outer, ids, 5)
            for fold in outer:
                validate(fold["inner"], fold["train_ids"], 4)
        validate(folds[target]["full_development_inner"], ids, 4)


def metrics(y, probability, predicted):
    y = np.asarray(y)
    p = np.asarray(probability, dtype=float)
    pred = np.asarray(predicted)
    if y.ndim != 1 or y.shape != p.shape or pred.shape != y.shape:
        raise ValueError("Metric inputs not aligned")
    if set(y) != {0, 1} or not set(pred).issubset({0, 1}):
        raise ValueError("Metrics require both classes, Normal=0/Stenotic=1")
    if not np.isfinite(p).all() or np.any((p < 0) | (p > 1)):
        raise ValueError("Invalid positive-class probabilities")
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel().tolist()
    sensitivity, specificity = tp / (tp + fn), tn / (tn + fp)
    precision = tp / (tp + fp) if tp + fp else 0.0
    pr_precision, pr_recall, _ = precision_recall_curve(y, p, pos_label=1)
    return {
        "sensitivity": sensitivity,
        "specificity": specificity,
        "balanced_accuracy": (sensitivity + specificity) / 2,
        "precision": precision,
        "f1": 2 * tp / (2 * tp + fp + fn) if tp else 0.0,
        "roc_auc": float(roc_auc_score(y, p)),
        "pr_auc": float(auc(pr_recall, pr_precision)),
        "average_precision": float(average_precision_score(y, p)),
        "predicted_positive_rate": float(np.mean(pred)),
        "prevalence": float(np.mean(y)),
        "confusion_matrix": [[tn, fp], [fn, tp]],
        "records": len(y),
    }


def choose_threshold(y, p, rule):
    """Highest feasible observed OOF operating threshold; no fallback if infeasible."""
    y, p = np.asarray(y), np.asarray(p, dtype=float)
    # Validate even on the ineligible path.
    metrics(y, p, p >= 0.5)
    for t in np.unique(np.r_[0.0, p, 1.0])[::-1]:
        pred = p >= t
        sensitivity = np.mean(pred[y == 1])
        specificity = np.mean(~pred[y == 0])
        if sensitivity >= rule["sensitivity_min"] and specificity >= rule["specificity_min"]:
            return {"threshold": float(t), "metrics": metrics(y, p, pred)}
    return None


def choose_candidate(rows, family=None):
    eligible = [
        r
        for r in rows
        if r["operating_point"] is not None
        and (family is None or r["candidate"]["family"] == family)
    ]
    if not eligible:
        return None

    def key(row):
        m = row["operating_point"]["metrics"]
        return (
            -round(m["balanced_accuracy"], 12),
            -round(m["pr_auc"], 12),
            -round(m["roc_auc"], 12),
            row["candidate"]["simplicity_rank"],
        )

    return min(eligible, key=key)


def build_pipeline(candidate, manifest, protocol):
    family, params = candidate["family"], candidate["params"]
    numeric = [f["name"] for f in manifest["features"] if f["kind"] != "category"]
    categorical = [f["name"] for f in manifest["features"] if f["kind"] == "category"]
    processor = ColumnTransformer(
        [
            ("numeric", StandardScaler() if family == "elastic_net" else "passthrough", numeric),
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                categorical,
            ),
        ],
        remainder="drop",
        sparse_threshold=0,
    )
    seed = protocol["estimator_seed"]
    if family == "elastic_net":
        estimator = LogisticRegression(**protocol["elastic_net_fixed"], **params, random_state=seed)
    elif family in {"reference", "forest"}:
        fixed = dict(protocol["forest_fixed"])
        if family == "reference":
            fixed["n_estimators"] = protocol["reference_fixed"]["n_estimators"]
            seed = protocol["reference_fixed"]["random_state"]
        estimator = RandomForestClassifier(**fixed, **params, random_state=seed)
    elif family == "xgboost":
        estimator = XGBClassifier(
            **protocol["xgboost_fixed"], **params, random_state=seed, scale_pos_weight=1.0
        )
    else:
        raise ValueError("Unapproved family")
    return Pipeline(
        [
            ("schema", SchemaGuard(manifest, protocol["schema_sha256"])),
            ("preprocess", processor),
            ("classifier", estimator),
        ]
    )


@dataclass
class FitLedger:
    entries: list = field(default_factory=list)

    def fit(self, candidate, X, y, manifest, protocol, allowed_ids, context):
        if X.index.tolist() != y.index.tolist() or not X.index.is_unique:
            raise ValueError("Unaligned/duplicate training data")
        if not set(X.index).issubset(allowed_ids):
            raise ValueError("Fit escapes development/outer-training membership")
        pipeline = build_pipeline(candidate, manifest, protocol)
        if candidate["family"] == "xgboost" and candidate["weighting"] == "balanced":
            # One training-fold-only cost weighting; never validation-derived.
            ratio = float(np.sum(y == 0) / np.sum(y == 1))
            pipeline.named_steps["classifier"].set_params(scale_pos_weight=ratio)
        started = time.perf_counter()
        with warnings.catch_warnings(), threadpool_limits(limits=1):
            warnings.simplefilter("error", ConvergenceWarning)
            pipeline.fit(X, y)
        elapsed = time.perf_counter() - started
        fit_ids = pipeline.named_steps["schema"].fit_row_ids_
        if fit_ids != X.index.tolist():
            raise ValueError("Pipeline fitted on different records")
        self.entries.append(
            {
                "context": context,
                "candidate_id": candidate["id"],
                "family": candidate["family"],
                "fit_ids_sha256": object_digest(fit_ids),
                "fit_records": len(fit_ids),
                "fit_seconds": elapsed,
            }
        )
        return pipeline


def inner_select(X, y, groups, inner, candidates, manifest, protocol, ledger, context):
    """Only outer TRAINING data is passed here: the API cannot see outer outcomes."""
    if not X.index.equals(y.index) or not groups.index.equals(X.index):
        raise ValueError("Inner selection alignment differs")
    parent = set(X.index)
    seen = []
    for f in inner:
        tr, va = f["train_ids"], f["validation_ids"]
        if set(tr) | set(va) != parent:
            raise ValueError("Inner partition escapes outer training")
        assert_disjoint_groups(tr, va, groups.to_dict())
        seen.extend(va)
    if Counter(seen) != Counter(X.index):
        raise ValueError("Inner OOF coverage incomplete/repeated")
    results = []
    for candidate in candidates:
        oof = pd.Series(np.nan, index=X.index, dtype=float)
        for number, f in enumerate(inner):
            tr, va = f["train_ids"], f["validation_ids"]
            fitted = ledger.fit(
                candidate,
                X.loc[tr],
                y.loc[tr],
                manifest,
                protocol,
                parent,
                f"{context}/inner-{number}",
            )
            oof.loc[va] = positive_probability(fitted, X.loc[va])
        if oof.isna().any():
            raise ValueError("Unfilled cross-fitted predictions")
        op = choose_threshold(y, oof.to_numpy(), protocol["threshold_rule"])
        results.append(
            {
                "candidate": candidate,
                "operating_point": op,
                "oof_ids_sha256": object_digest(oof.index.tolist()),
                "oof_probabilities": oof.tolist(),
            }
        )
    return results


def arm_choices(rows, reference_id):
    reference = next(r for r in rows if r["candidate"]["id"] == reference_id)
    return {
        "v1_rf_0.5": {"candidate": reference["candidate"], "threshold": 0.5},
        "v1_rf_nested_threshold": _selected(reference) if reference["operating_point"] else None,
        "elastic_net": _selected(choose_candidate(rows, "elastic_net")),
        "forest": _selected(choose_candidate(rows, "forest")),
        "xgboost": _selected(choose_candidate(rows, "xgboost")),
        "selection_procedure": _selected(choose_candidate(rows)),
    }


def _selected(row):
    if row is None:
        return None
    return {
        "candidate": row["candidate"],
        "threshold": row["operating_point"]["threshold"],
        "inner_metrics": row["operating_point"]["metrics"],
    }


def summarize(rows):
    valid = [r["metrics"] for r in rows if r["status"] == "evaluated"]
    out = {"evaluated_folds": len(valid), "ineligible_folds": len(rows) - len(valid)}
    out["statistics"] = {}
    for name in SCALARS:
        values = [r[name] for r in valid]
        out["statistics"][name] = (
            None
            if not values
            else {
                "mean": float(np.mean(values)),
                "sample_sd": float(np.std(values, ddof=1)) if len(values) > 1 else None,
                "median": float(np.median(values)),
                "min": float(min(values)),
                "max": float(max(values)),
                "values": values,
            }
        )
    # Missing operating points are never dropped to create an apparently complete repeat.
    out["repeat_pooled"] = []
    for repeat in range(5):
        rr = [r for r in rows if r["repeat"] == repeat]
        if len(rr) != 5 or any(r["status"] != "evaluated" for r in rr):
            out["repeat_pooled"].append(
                {"repeat": repeat, "status": "incomplete/ineligible", "metrics": None}
            )
            continue
        pairs = [p for r in rr for p in r["predictions"]]
        out["repeat_pooled"].append(
            {
                "repeat": repeat,
                "status": "evaluated",
                "metrics": metrics(
                    [p["positive"] for p in pairs],
                    [p["probability"] for p in pairs],
                    [p["predicted_positive"] for p in pairs],
                ),
            }
        )
    return out


def success_gate(primary, reference, gate):
    if primary["evaluated_folds"] != 25:
        return {"passed": False, "reason": "Not all 25 outer rules were eligible", "checks": {}}
    m = {k: v["mean"] for k, v in primary["statistics"].items()}
    r = reference["statistics"]["roc_auc"]["mean"]
    stable = [row["metrics"] for row in primary["repeat_pooled"]]

    def meets(z):
        return (
            z["sensitivity"] >= gate["sensitivity_min"]
            and z["specificity"] >= gate["specificity_min"]
            and z["balanced_accuracy"] >= gate["balanced_accuracy_min"]
        )

    checks = {
        "mean_screening_metrics": meets(m),
        "repeat_stability": sum(meets(z) for z in stable) >= gate["successful_repeats_min"],
        "no_extreme_repeat": all(
            z["sensitivity"] >= gate["repeat_sensitivity_floor"]
            and z["specificity"] >= gate["repeat_specificity_floor"]
            for z in stable
        ),
        "no_material_auc_collapse": m["roc_auc"] >= r - gate["roc_auc_decline_max"],
        "precision_above_prevalence": m["precision"] >= m["prevalence"] + gate["quality_margin"],
        "pr_auc_above_prevalence": m["pr_auc"] >= m["prevalence"] + gate["quality_margin"],
        "ap_above_prevalence": m["average_precision"] >= m["prevalence"] + gate["quality_margin"],
        "not_nearly_everyone_positive": m["predicted_positive_rate"] <= gate["positive_rate_max"],
    }
    return {"passed": all(checks.values()), "checks": checks}

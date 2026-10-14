"""Final-holdout summaries and uncertainty from stored pairs; no model inference."""

import numpy as np
from scipy.stats import beta

from ml.metrics import SCALARS, curves, score_predictions


def binomial_interval(successes: int, trials: int, confidence: float) -> dict:
    if not trials:
        return {"interval": None, "reason": "No eligible records", "method": "Clopper-Pearson"}
    alpha = 1 - confidence
    lower = 0.0 if successes == 0 else float(beta.ppf(alpha / 2, successes, trials - successes + 1))
    upper = (
        1.0
        if successes == trials
        else float(beta.ppf(1 - alpha / 2, successes + 1, trials - successes))
    )
    return {
        "interval": [lower, upper],
        "confidence_level": confidence,
        "method": "two-sided Clopper-Pearson exact binomial",
        "successes": successes,
        "trials": trials,
        "limitation": "Assumes independent records; patient identity unverified",
    }


def uncertainty(y, p, settings: dict, target_index: int) -> dict:
    y, p = np.asarray(y, dtype=int), np.asarray(p, dtype=float)
    metrics = score_predictions(y, p)
    confidence = settings["confidence_level"]
    cm = metrics["confusion_matrix"]
    intervals = {
        "accuracy": binomial_interval(cm[0][0] + cm[1][1], len(y), confidence),
        "recall": binomial_interval(cm[1][1], cm[1][0] + cm[1][1], confidence),
    }
    positive, negative = np.flatnonzero(y == 1), np.flatnonzero(y == 0)
    seed = settings["seed"] + target_index
    minimum = settings["minimum_class_count"]
    if min(len(positive), len(negative)) < minimum:
        for name in settings["bootstrap_metrics"]:
            intervals[name] = {
                "interval": None,
                "method": settings["method"],
                "reason": f"Fewer than {minimum} records in a class; interval withheld",
            }
        return {
            "seed": seed,
            "requested_repetitions": settings["bootstrap_repetitions"],
            "completed_repetitions": 0,
            "intervals": intervals,
            "limitation": settings["limitation"],
        }
    rng = np.random.default_rng(seed)
    samples = {name: [] for name in settings["bootstrap_metrics"]}
    for _ in range(settings["bootstrap_repetitions"]):
        ids = np.r_[
            rng.choice(negative, size=len(negative), replace=True),
            rng.choice(positive, size=len(positive), replace=True),
        ]
        scored = score_predictions(y[ids], p[ids])
        for name in samples:
            samples[name].append(scored[name])
    alpha = (1 - confidence) / 2
    for name, values in samples.items():
        reason = None
        if name == "precision" and cm[0][1] + cm[1][1] == 0:
            reason = "No predicted positives; precision is undefined (point metric convention=0)"
        elif np.ptp(values) == 0:
            reason = (
                "Degenerate empirical bootstrap; a zero-width interval would overstate certainty"
            )
        intervals[name] = {
            "interval": None if reason else np.quantile(values, [alpha, 1 - alpha]).tolist(),
            "confidence_level": confidence,
            "method": settings["method"],
            "reason": reason,
        }
    return {
        "seed": seed,
        "requested_repetitions": settings["bootstrap_repetitions"],
        "completed_repetitions": settings["bootstrap_repetitions"],
        "intervals": intervals,
        "limitation": settings["limitation"],
    }


def summarize_saved_predictions(predictions: dict, protocol: dict, development: dict) -> dict:
    expected = protocol["targets"]
    if predictions["phase"] != "FINAL_HOLDOUT" or predictions["threshold"] != 0.5:
        raise ValueError("Invalid prediction scope/threshold")
    if set(predictions["targets"]) != set(expected):
        raise ValueError("Prediction target definitions differ")
    result = {
        "phase": "FINAL_HOLDOUT",
        "threshold": 0.5,
        "calibrated": False,
        "probability_label": protocol["probability_label"],
        "targets": {},
    }
    for index, target in enumerate(expected):
        rows = predictions["targets"][target]
        ids = [row["row_id"] for row in rows]
        from ml.common import object_digest

        if (
            len(ids) != protocol["holdout_records"]
            or len(set(ids)) != len(ids)
            or object_digest(ids) != protocol["holdout_ids_sha256"]
        ):
            raise ValueError("Saved prediction holdout membership differs")
        y, p = [row["label"] for row in rows], [row["positive_probability"] for row in rows]
        if any(row["predicted_class"] != int(row["positive_probability"] >= 0.5) for row in rows):
            raise ValueError("Stored threshold classification differs")
        metrics = score_predictions(y, p)
        dev = development["targets"][target]["aggregate"]["selection_procedure"]["fold_metrics"]
        comparison = {}
        for name in SCALARS:
            summary = dev[name]
            comparison[name] = {
                "development_nested_cv_mean": summary["mean"],
                "development_outer_sample_sd": summary["std"],
                "development_outer_min_max": [summary["min"], summary["max"]],
                "final_holdout": metrics[name],
                "holdout_minus_development_mean": metrics[name] - summary["mean"],
                "within_development_observed_outer_range": summary["min"]
                <= metrics[name]
                <= summary["max"],
                "within_development_mean_plus_minus_one_sd": abs(metrics[name] - summary["mean"])
                <= summary["std"],
                "interpretation": (
                    "Descriptive only; outer range/SD are not a confidence interval "
                    "or a significance test"
                ),
            }
        result["targets"][target] = {
            "encoding": expected[target],
            "frozen_candidate": protocol["frozen_candidates"][target],
            "metrics": metrics,
            "curves": curves(y, p),
            "uncertainty": uncertainty(y, p, protocol["uncertainty"], index),
            "development_comparison": comparison,
        }
    return result

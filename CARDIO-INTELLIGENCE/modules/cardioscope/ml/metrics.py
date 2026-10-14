"""Development metrics with explicit class order, threshold and PR-area definitions."""

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    auc,
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

SCALARS = [
    "accuracy",
    "balanced_accuracy",
    "precision",
    "recall",
    "f1",
    "roc_auc",
    "pr_auc",
    "average_precision",
    "brier_score",
]


def score_predictions(y, probability, threshold: float = 0.5) -> dict:
    y, probability = np.asarray(y), np.asarray(probability, dtype=float)
    if y.ndim != 1 or y.shape != probability.shape or set(y.tolist()) != {0, 1}:
        raise ValueError("Metrics require aligned records with both binary classes [0,1]")
    if not np.isfinite(probability).all() or np.any((probability < 0) | (probability > 1)):
        raise ValueError("Invalid probabilities")
    if threshold != 0.5:
        raise ValueError("This phase fixes the classification threshold at 0.5")
    predicted = probability >= threshold
    precision, recall, _ = precision_recall_curve(y, probability, pos_label=1)
    return {
        "class_counts": {"0": int(np.sum(y == 0)), "1": int(np.sum(y == 1))},
        "threshold": threshold,
        "accuracy": float(accuracy_score(y, predicted)),
        "balanced_accuracy": float(balanced_accuracy_score(y, predicted)),
        "precision": float(precision_score(y, predicted, zero_division=0)),
        "recall": float(recall_score(y, predicted, zero_division=0)),
        "f1": float(f1_score(y, predicted, zero_division=0)),
        "roc_auc": float(roc_auc_score(y, probability)),
        "pr_auc": float(auc(recall, precision)),
        "average_precision": float(average_precision_score(y, probability)),
        "brier_score": float(brier_score_loss(y, probability)),
        "confusion_matrix": confusion_matrix(y, predicted, labels=[0, 1]).tolist(),
    }


def curves(y, probability) -> dict:
    fpr, tpr, _ = roc_curve(y, probability, drop_intermediate=False)
    precision, recall, _ = precision_recall_curve(y, probability, pos_label=1)
    return {
        "roc": {"false_positive_rate": fpr.tolist(), "true_positive_rate": tpr.tolist()},
        "precision_recall": {"recall": recall.tolist(), "precision": precision.tolist()},
    }


def aggregate_folds(fold_metrics: list[dict]) -> dict:
    return {
        name: {
            "mean": float(np.mean([m[name] for m in fold_metrics])),
            "std": float(np.std([m[name] for m in fold_metrics], ddof=1)),
            "min": float(min(m[name] for m in fold_metrics)),
            "max": float(max(m[name] for m in fold_metrics)),
            "values": [m[name] for m in fold_metrics],
        }
        for name in SCALARS
    }


def choose_candidate(summaries: list[dict], search: dict) -> dict:
    decimals = search["selection"]["rounding_decimals"]
    return min(
        summaries,
        key=lambda row: (
            -round(row["mean_inner_roc_auc"], decimals),
            round(row["mean_inner_brier_score"], decimals),
            row["candidate"]["simplicity_rank"],
        ),
    )

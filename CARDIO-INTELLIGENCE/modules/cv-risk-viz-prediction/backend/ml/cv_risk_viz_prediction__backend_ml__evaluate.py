"""Metrics: model-selection metric (macro F0.5) + full clinical evaluation suite."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, confusion_matrix,
    f1_score, fbeta_score, roc_auc_score, average_precision_score, brier_score_loss,
)


def macro_f05(y_true, y_pred) -> float:
    """Primary model-selection metric."""
    return float(fbeta_score(y_true, y_pred, beta=0.5, average="macro", zero_division=0))


def positive_f05(y_true, y_pred) -> float:
    return float(fbeta_score(y_true, y_pred, beta=0.5, average="binary", pos_label=1, zero_division=0))


def evaluate_probs(y_true, y_prob, threshold: float = 0.5) -> dict:
    """Full evaluation suite at a given threshold."""
    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob, dtype=float)
    y_pred = (y_prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    out = {
        "threshold": round(float(threshold), 4),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall_sensitivity": float(recall_score(y_true, y_pred, zero_division=0)),
        "specificity": float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0,
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "f05_positive": positive_f05(y_true, y_pred),
        "macro_f05": macro_f05(y_true, y_pred),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else float("nan"),
        "pr_auc": float(average_precision_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else float("nan"),
        "brier": float(brier_score_loss(y_true, y_prob)),
        "tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn),
        "false_negatives": int(fn), "false_positives": int(fp),
    }
    return out

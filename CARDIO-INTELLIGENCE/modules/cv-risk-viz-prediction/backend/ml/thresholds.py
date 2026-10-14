"""Threshold selection using cross-validated training predictions only.

Protocol: for each target and candidate model, out-of-fold predicted
probabilities are gathered via cross_val_predict; then a threshold grid
(0.30..0.70) is scanned to maximize *macro F0.5 subject to a pre-declared
recall floor*. No clinically justified minimum sensitivity exists for this
prototype's data; therefore NO fabricated clinical threshold is claimed.
Instead the selectable grid is constrained (0.30-0.70) and the recall
attained at the chosen threshold is reported transparently alongside
default-threshold (0.5) performance, so the precision/recall tradeoff is
visible rather than hidden.

A per-target candidate EARLY WARNING floor is NOT invented. Models failing
positive-class precision entirely (precision == 0 at all thresholds on CV)
are rejected regardless of macro F0.5.
"""
from __future__ import annotations

import numpy as np

THRESHOLD_GRID = np.round(np.arange(0.30, 0.71, 0.02), 4)


def select_threshold(y_true, y_prob, recall_floor: float | None = None) -> tuple[float, dict]:
    """Return (chosen_threshold, diagnostics). Maximize macro F0.5 on
    out-of-fold training predictions; optionally require recall >= floor."""
    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob, dtype=float)
    best = None
    diagnostics = []
    for t in THRESHOLD_GRID:
        pred = (y_prob >= t).astype(int)
        from sklearn.metrics import fbeta_score, recall_score, precision_score
        m = {
            "threshold": float(t),
            "macro_f05": float(fbeta_score(y_true, pred, beta=0.5, average="macro", zero_division=0)),
            "recall": float(recall_score(y_true, pred, zero_division=0)),
            "precision": float(precision_score(y_true, pred, zero_division=0)),
        }
        diagnostics.append(m)
        if m["precision"] <= 0:
            continue
        if recall_floor is not None and m["recall"] < recall_floor:
            continue
        if best is None or m["macro_f05"] > best["macro_f05"]:
            best = m
    if best is None:  # fall back to default 0.5
        return 0.5, {"fallback": True, "diagnostics": diagnostics}
    return float(best["threshold"]), {"chosen": best, "diagnostics": diagnostics}

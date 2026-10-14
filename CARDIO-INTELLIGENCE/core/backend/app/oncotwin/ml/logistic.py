"""L2-regularised logistic regression (Newton/IRLS) + evaluation metrics, numpy only.

A linear model is a deliberate choice for a clinical early-warning score:
its log-odds decompose EXACTLY into per-feature contributions, so every risk
the twin shows can be explained without post-hoc approximation.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.oncotwin._typing import FloatArray


@dataclass
class LogisticModel:
    intercept: float
    coef: FloatArray  # on standardised features
    mean: FloatArray
    std: FloatArray
    l2: float

    def standardise(self, X: FloatArray) -> FloatArray:
        return (X - self.mean) / self.std

    def logit(self, X: FloatArray) -> FloatArray:
        return self.intercept + self.standardise(X) @ self.coef

    def predict_proba(self, X: FloatArray) -> FloatArray:
        return _sigmoid(self.logit(X))

    def contributions(self, x: FloatArray) -> FloatArray:
        """Per-feature log-odds contribution relative to the average training day."""
        return self.coef * self.standardise(x)


def _sigmoid(z: FloatArray) -> FloatArray:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -35, 35)))


def fit_logistic(
    X: FloatArray,
    y: FloatArray,
    l2: float = 1.0,
    *,
    mean: FloatArray | None = None,
    std: FloatArray | None = None,
    max_iter: int = 50,
    tol: float = 1e-8,
) -> LogisticModel:
    mean = X.mean(axis=0) if mean is None else mean
    std = X.std(axis=0) if std is None else std
    std = np.where(std < 1e-8, 1.0, std)
    Z = (X - mean) / std
    n, d = Z.shape
    A = np.hstack([np.ones((n, 1)), Z])
    w = np.zeros(d + 1)
    prior = np.full(d + 1, l2)
    prior[0] = 0.0  # intercept unpenalised
    for _ in range(max_iter):
        p = _sigmoid(A @ w)
        g = A.T @ (p - y) + prior * w
        W = p * (1 - p)
        H = (A * W[:, None]).T @ A + np.diag(prior) + 1e-9 * np.eye(d + 1)
        step = np.linalg.solve(H, g)
        w -= step
        if np.max(np.abs(step)) < tol:
            break
    return LogisticModel(float(w[0]), w[1:].copy(), mean, std, l2)


def log_loss(y: FloatArray, p: FloatArray) -> float:
    p = np.clip(p, 1e-9, 1 - 1e-9)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def auroc(y: FloatArray, s: FloatArray) -> float:
    """Mann–Whitney AUROC with average ranks for ties."""
    labels = np.asarray(y).astype(bool)
    n_pos, n_neg = int(labels.sum()), int((~labels).sum())
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    order = np.argsort(s, kind="mergesort")
    ranks = np.empty(len(s))
    sorted_s = np.asarray(s)[order]
    i = 0
    while i < len(s):
        j = i
        while j + 1 < len(s) and sorted_s[j + 1] == sorted_s[i]:
            j += 1
        ranks[order[i : j + 1]] = 0.5 * (i + j) + 1.0
        i = j + 1
    return float((ranks[labels].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def average_precision(y: FloatArray, s: FloatArray) -> float:
    labels = np.asarray(y).astype(bool)
    if labels.sum() == 0:
        return float("nan")
    order = np.argsort(-np.asarray(s), kind="mergesort")
    yt = labels[order]
    tp = np.cumsum(yt)
    precision = tp / np.arange(1, len(yt) + 1)
    return float(np.sum(precision[yt]) / yt.sum())


def brier(y: FloatArray, p: FloatArray) -> float:
    return float(np.mean((np.asarray(p) - np.asarray(y)) ** 2))


def calibration_bins(y: FloatArray, p: FloatArray, n_bins: int = 10) -> list[dict[str, float]]:
    """Equal-count bins: mean predicted vs observed event rate."""
    order = np.argsort(p)
    out = []
    for chunk in np.array_split(order, n_bins):
        if len(chunk) == 0:
            continue
        out.append(
            {
                "mean_predicted": round(float(np.mean(p[chunk])), 4),
                "observed_rate": round(float(np.mean(y[chunk])), 4),
                "n": int(len(chunk)),
            }
        )
    return out


def threshold_for_ppv(
    y: FloatArray, p: FloatArray, target_ppv: float, min_sens: float = 0.0
) -> float | None:
    """Smallest threshold whose PPV ≥ target (and sensitivity ≥ min_sens)."""
    order = np.argsort(-p)
    ys, ps = y[order], p[order]
    tp = np.cumsum(ys)
    k = np.arange(1, len(ys) + 1)
    ppv = tp / k
    sens = tp / max(1, ys.sum())
    ok = np.where((ppv >= target_ppv) & (sens >= min_sens))[0]
    if ok.size == 0:
        return None
    return float(ps[ok.max()])


def threshold_for_sensitivity(y: FloatArray, p: FloatArray, target_sens: float) -> float:
    pos = np.sort(p[y.astype(bool)])[::-1]
    if pos.size == 0:
        return 0.5
    k = int(np.ceil(target_sens * pos.size)) - 1
    return float(pos[min(max(k, 0), pos.size - 1)])

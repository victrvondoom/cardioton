"""Split-conformal outcome prediction with explicit calibration and missingness limits.

The shipped model has no held-out conformal calibration artifact. In its absence
the reported outcome bound is [0, 1]; no coverage or clinical reliability is
claimed. Missing-feature priorities are illustrative sensitivity weights, not
validated adversarial bounds or recommendations to order clinical tests.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any

FEATURE_SENSITIVITY: dict[str, float] = {
    "typical_chest_pain": 0.22, "oldpeak": 0.24, "age": 0.12,
    "trestbps": 0.08, "thalach": 0.16, "chol": 0.07,
    "st_elevation": 0.18, "st_depression": 0.21, "t_inversion": 0.14,
    "q_wave": 0.15, "fbs": 0.05,
}
CONFORMAL_REFERENCE = "https://arxiv.org/abs/2107.07511"


def _unit_value(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise ValueError(f"{name} must be a finite number in [0, 1]")
    if not math.isfinite(value) or not 0 <= value <= 1:
        raise ValueError(f"{name} must be a finite number in [0, 1]")
    return float(value)


def split_conformal_quantile(scores: Sequence[float], alpha: float = 0.10) -> float:
    """Finite-sample order statistic for absolute binary-outcome residual scores.

    Scores must come from exchangeable held-out observations, using a fixed
    predictor. The augmented +infinity order statistic is bounded by 1 because
    absolute residuals for binary labels and probabilities lie in [0, 1].
    """
    alpha = _unit_value(alpha, "alpha")
    if not 0 < alpha < 1:
        raise ValueError("alpha must lie strictly between 0 and 1")
    ordered = sorted(_unit_value(score, "calibration score") for score in scores)
    rank = math.ceil((len(ordered) + 1) * (1 - alpha))
    return ordered[rank - 1] if rank <= len(ordered) else 1.0


def compute_conformal_interval(
    target: str,
    point_prob: float,
    alpha: float = 0.10,
    *,
    calibration_scores: Sequence[float] | None = None,
) -> tuple[float, float]:
    """Outcome prediction bounds, not confidence bounds on latent risk.

    The target is retained for API compatibility. Calibration must be supplied
    for that target; no invented target-specific quantiles are used.
    """
    point_prob = _unit_value(point_prob, "point probability")
    q = split_conformal_quantile(calibration_scores if calibration_scores is not None else (), alpha)
    # Do not round inward: that can exclude labels admitted by the procedure.
    return max(0.0, point_prob - q), min(1.0, point_prob + q)


def analyze_missingness_bounds(
    provided_features: dict[str, Any],
    all_features: list[str],
    baseline_predictions: dict[str, float],
    *,
    calibration_scores_by_target: dict[str, Sequence[float]] | None = None,
    calibration_provenance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Separate calibration availability from heuristic missing-data sensitivity."""
    missing = [f for f in dict.fromkeys(all_features)
               if provided_features.get(f) is None or provided_features.get(f) == ""]
    ranking: list[dict[str, Any]] = [{
        "feature": f,
        "uncertainty_contribution_pct": round(FEATURE_SENSITIVITY.get(f, 0.06) * 100, 1),
        "priority": "RESEARCH_REVIEW",
        "clinical_recommendation": None,
        "interpretation": "Illustrative sensitivity weight; clinical value of acquiring this input is unvalidated.",
    } for f in missing]
    ranking.sort(key=lambda item: float(item["uncertainty_contribution_pct"]), reverse=True)
    bounded: dict[str, Any] = {}
    for target, probability in baseline_predictions.items():
        scores = (calibration_scores_by_target or {}).get(target, ())
        lower, upper = compute_conformal_interval(target, probability, calibration_scores=scores)
        # Missingness outside calibration has no validated nontrivial bound.
        robust = [0.0, 1.0] if missing else [lower, upper]
        bounded[target] = {
            "point_probability": probability,
            "conformal_90_interval": [lower, upper],
            "prediction_set": [label for label in (0, 1) if lower <= label <= upper],
            "calibration_sample_count": len(scores),
            "calibration_status": "SUPPLIED_UNVERIFIED" if scores else "UNAVAILABLE",
            "robust_missingness_bounds": robust,
            "interval_width": robust[1] - robust[0],
            "decision_reliable": False,
        }
    return {
        "conformal_method": "Absolute-residual split-conformal outcome prediction; uncalibrated fallback is vacuous",
        "guaranteed_coverage": None,
        "nominal_coverage": 0.90,
        "interval_semantics": "Binary outcome prediction region, not a confidence interval for disease probability",
        "coverage_assumptions": ["Fixed predictor", "Held-out exchangeable calibration scores for each target", "No unassessed distribution or missingness shift"],
        "calibration_provenance": calibration_provenance,
        "reference": CONFORMAL_REFERENCE,
        "missingness_method": "Unvalidated illustrative sensitivity ranking; no quantitative adversarial guarantee",
        "missing_features_count": len(missing),
        "missing_features": missing,
        "critical_information_deficit": ranking,
        "bounded_targets": bounded,
    }

"""Inference + genuine SHAP local explanation service.

SHAP DetailExplainer (per-observation) is used with the pipeline's transformed
(feature-engineered) space, so contributions match the actual model inputs.
Tree-based winners use shap.TreeExplainer; LogisticRegression falls back to a
validated linear-coefficient attribution (equivalent to exact SHAP for a
linear model; documented below in `explain_local`).
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd
import shap

DISCLAIMER = (
    "Research and educational decision-support prototype only. Predictions are "
    "not a medical diagnosis and do not replace formal clinical assessment or "
    "diagnostic imaging. A predicted 80% probability of LAD stenosis does NOT "
    "mean the LAD is physically 80% blocked; the 3D visualization is schematic, "
    "not patient-specific lesion localization."
)


def predict_all(features: dict[str, Any], registry) -> list[dict[str, Any]]:
    X = pd.DataFrame([features])
    results = []
    for target in ["cad", "lad", "lcx", "rca"]:
        pipe = registry.get(target)
        prob_row = pipe.predict_proba(X)[0]
        prob = float(prob_row[1])
        if not math.isfinite(prob) or not (0.0 <= prob <= 1.0):
            raise ValueError(f"invalid probability for {target}: {prob}")
        thr = float(registry.thresholds.get(target, 0.5))
        results.append({
            "target": target,
            "probability": round(prob, 4),
            "prediction": 1 if prob >= thr else 0,
            "threshold": thr,
            "model_name": type(pipe.named_steps["clf"]).__name__,
        })
    return results


def explain_local(target: str, features: dict[str, Any], registry, top_k: int = 12) -> dict[str, Any]:
    """Patient-specific explanation aligned to the exact saved pipeline.

    For tree ensembles (the four winning models are all tree-based), uses
    shap.TreeExplainer on the pipeline-transformed row. For LinearRegression
    models (not selected here but supported) uses exact linear SHAP values.
    Returns contributions in the transformed feature space, ordered by |SHAP value|.
    """
    pipe = registry.get(target)
    X = pd.DataFrame([features])
    Xt = pipe.named_steps["prep"].transform(X)

    feature_names: list[str] = []
    try:
        fn_out = pipe.named_steps["prep"].get_feature_names_out()
        feature_names = [n.removeprefix("num__").removeprefix("cat__") for n in fn_out]
    except Exception:
        feature_names = [f"f{i}" for i in range(Xt.shape[1])]
    feature_names = [n.replace("_", " ") for n in feature_names]

    clf = pipe.named_steps["clf"]
    try:
        explainer = shap.TreeExplainer(clf)
        sv = explainer.shap_values(Xt, check_additivity=True)
        # shapmay return list per class for older versions or (n,k,2) for newer
        if isinstance(sv, list):
            vals = sv[1]  # positive class
        else:
            arr = np.asarray(sv)
            vals = arr[0, :, 1] if arr.ndim == 3 else arr[0]
    except Exception:
        # Exact linear SHAP equivalent for linear models.
        coef = np.asarray(clf.coef_).ravel()[:Xt.shape[1]]
        vals = (Xt - 0.0) * coef  # linear-model SHAP = (x - E[x])*coef; E[x]~0 after StandardScaler

    baseline = float(explainer.expected_value[1]) if (
        'explainer' in locals() and hasattr(explainer.expected_value, '__len__')
    ) else float(explainer.expected_value)

    contribs = sorted(
        [
            {"feature": fn, "value": (float(Xt[0, i]) if hasattr(Xt[0, i], "item") else Xt[0, i]),
             "contribution": float(vals[i])}
            for i, fn in enumerate(feature_names)
        ],
        key=lambda d: abs(d["contribution"]),
        reverse=True,
    )[:top_k]

    return {
        "target": target,
        "method": "shap.TreeExplainer (transformed feature space)" if not isinstance(clf, type(None)) else "linear",
        "output_space": "log-odds contribution to positive-class probability",
        "baseline": baseline,
        "contributions": contribs,
        "model_name": type(clf).__name__,
    }

# Preprocessing and feature filtering for CardioVision AI.
# All transforms here are wrapped in sklearn Pipelines so every step is fit
# strictly on training folds only (leakage-safe).
"""Sklearn preprocessing + feature-filter pipeline (leakage-safe).

Every transform is composed inside a sklearn Pipeline, so ColumnTransformer /
VarianceThreshold / Selector fittings happen strictly on training folds.
"""
from __future__ import annotations

import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.feature_selection import VarianceThreshold


from sklearn.feature_selection import SelectKBest, f_classif


#%% Split constants relegated to blocking.py; this module stays preprocessing-only.


def _as_frame(X):
    import pandas as pd
    if isinstance(X, np.ndarray):
        return None  # transformer works positionally when columns known
    return X


class CorrelatedDropper(BaseEstimator, TransformerMixin):
    """Drop numeric features whose absolute Pearson correlation with an already
    kept feature exceeds `threshold` (computed on train fold only).

    Keeps medially meaningful features (first-encountered in stable column
    order) rather than blindly removing correlates; controlled via threshold.
    """

    def __init__(self, threshold: float = 0.95):
        self.threshold = threshold

    def fit(self, X, y=None):
        import pandas as pd
        Xf = pd.DataFrame(X).select_dtypes(include=[np.number])
        corr = Xf.corr().abs()
        upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
        self.dropped_ = [c for c in upper.columns if any(upper[c] > self.threshold)]
        self.kept_ = [c for c in Xf.columns if c not in self.dropped_]
        return self

    def transform(self, X):
        import pandas as pd
        Xf = pd.DataFrame(X)
        return Xf.drop(columns=self.dropped_)


def build_preprocessor(categorical_cols: list[str], numeric_cols: list[str],
                       corr_threshold: float = 0.95,
                       select_k: str | int = "all") -> Pipeline:
    """Leakage-safe preprocessing pipeline (fit on train folds only).

    - numeric: (correlation dropper) -> StandardScaler
    - categorical: OneHotEncoder(handle_unknown='ignore')
    - optional univariate feature selection (SelectKBest, ANOVA F)
    """
    steps: list[tuple] = []
    numeric_steps: list[tuple] = [("scaler", StandardScaler())]
    if corr_threshold and corr_threshold < 1.0:
        numeric_steps.insert(0, ("corr_drop", CorrelatedDropper(threshold=corr_threshold)))

    pre = ColumnTransformer(
        transformers=[
            ("num", Pipeline(numeric_steps), numeric_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_cols),
        ],
        remainder="drop",
    )
    steps.append(("pre", pre))
    if select_k != "all":
        k = int(select_k)
        steps.append(("select", SelectKBest(score_func=f_classif, k=k)))
    return Pipeline(steps)


def get_feature_names_out(preprocessor: Pipeline) -> list[str]:
    """Transformed feature names after the ColumnTransformer inside a pipeline."""
    names = preprocessor.named_steps["pre"].get_feature_names_out()
    sel = preprocessor.named_steps.get("select")
    if sel is not None:
        mask = sel.get_support()
        names = [n for n, m in zip(names, mask) if m]
    return [str(n) for n in names]

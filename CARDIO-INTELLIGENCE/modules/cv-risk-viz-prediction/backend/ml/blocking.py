"""Splitting / blocking logic (leakage protection).

Dataset blocking:
    The UCI Extension of Z-Alizadeh Sani dataset contains ONE row per patient
    (verified: 303 rows, 0 duplicate rows, no patient/session/hospital/date
    identifiers). Therefore no genuine group labels exist and StratifiedGroupKFold
    is NOT applicable -- inventing groups would be fabrication. Instead:
    exact duplicate detection (none present) + stratified splits.

Feature blocking:
    FORBIDDEN_COLUMNS (LAD, LCX, RCA, Cath) are angiography outcomes and are
    hard-excluded from every feature matrix. A dedicated leakage test fails the
    build if any forbidden column reaches the model input.
"""
from __future__ import annotations

from sklearn.model_selection import StratifiedKFold, train_test_split

SEED = 42
TEST_SIZE = 0.2  # approx 80/20 shared holdout for all four targets
N_FOLDS = 5

FORBIDDEN_COLUMNS: tuple[str, ...] = ("LAD", "LCX", "RCA", "Cath")


def assert_no_forbidden_features(X_cols) -> None:
    cols = [str(c) for c in X_cols]
    leaked = [c for c in FORBIDDEN_COLUMNS if c in cols]
    if leaked:
        raise AssertionError(f"TARGET LEAKAGE: forbidden columns in feature matrix: {leaked}")


def make_holdout_split(y):
    """Shared stratified 80/20 holdout stratified on overall CAD (y['cad']) so the
    same patients' rows form test sets for all four vessel targets."""
    idx = list(range(len(y["cad"])))
    train_idx, test_idx = train_test_split(
        idx, test_size=TEST_SIZE, random_state=SEED, stratify=y["cad"]
    )
    return train_idx, test_idx


def make_cv(y_train, n_folds: int = N_FOLDS, stratify_key: str = "cad"):
    """Stratified K-fold on training data only. Reduce folds when minority
    class support is too small (documented in min class count of the split)."""
    strat = y_train[stratify_key]
    minority = min(strat.value_counts().tolist())
    while n_folds > 2 and minority < n_folds:
        n_folds -= 1
    return StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=SEED), n_folds

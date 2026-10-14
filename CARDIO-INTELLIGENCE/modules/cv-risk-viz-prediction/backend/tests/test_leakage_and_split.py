# unit tests for leakage protection, splitting, macro F0.5 and thresholds
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


def test_no_forbidden_columns_in_features():
    from ml.data_loader import load
    from ml.blocking import assert_no_forbidden_features, FORBIDDEN_COLUMNS
    b = load()
    assert_no_forbidden_features(b.feature_names)
    assert not set(FORBIDDEN_COLUMNS) & set(b.feature_names)


def test_positive_class_mapping():
    from ml.data_loader import load
    b = load()
    assert all(set(v.unique()) == {0, 1} for v in b.y.values())
    # CAD positives > 0
    assert b.y["cad"].sum() == 216


def test_reproducible_split():
    from ml.data_loader import load
    from ml.blocking import make_holdout_split
    b = load()
    tr1, te1 = make_holdout_split(b.y)
    tr2, te2 = make_holdout_split(b.y)
    assert tr1 == tr2 and te1 == te2
    assert len(set(tr1) & set(te1)) == 0


def test_cv_no_test_leakage():
    from ml.data_loader import load
    from ml.blocking import make_holdout_split, make_cv
    b = load()
    tr, te = make_holdout_split(b.y)
    # OOF fold validation indices must be a strict partition of the *training* index
    folds, _ = make_cv({k: b.y[k].iloc[tr].reset_index(drop=True) for k in b.y})
    all_va = set()
    for _, va in folds.split(b.y["cad"].iloc[tr].reset_index(drop=True), b.y["cad"].iloc[tr].reset_index(drop=True)):
        all_va |= set(va)
    assert all_va == set(range(len(tr)))
    assert len(set(tr) & set(te)) == 0


def test_macro_f05_formula():
    from ml.cv_risk_viz_prediction__backend_ml__evaluate import macro_f05
    from sklearn.metrics import fbeta_score
    y, p = [0, 1, 1, 0], [1, 1, 0, 0]
    expected = fbeta_score(y, p, beta=0.5, average="macro", zero_division=0)
    assert macro_f05(y, p) == expected


def test_threshold_selection_returns_valid():
    from ml.thresholds import select_threshold
    import random
    random.seed(0)
    y = [0, 1, 0, 1, 1, 0, 1, 0, 1, 0]
    p = [0.1, 0.9, 0.2, 0.8, 0.7, 0.3, 0.6, 0.4, 0.55, 0.35]
    thr, diag = select_threshold(y, p)
    assert thr == float(thr) and 0.0 <= thr <= 1.0


def test_artifacts_load_and_predict_bounds():
    import joblib
    import pandas as pd
    from ml.data_loader import load
    from ml.blocking import make_holdout_split
    b = load()
    _, te = make_holdout_split(b.y)
    Xte = b.X.iloc[te]
    for k in ["cad", "lad", "lcx", "rca"]:
        pipe = joblib.load(BACKEND / "models" / f"{k}.joblib")
        prob = pipe.predict_proba(Xte)[:, 1]
        assert len(prob) == len(te) and prob.min() >= 0 and prob.max() <= 1

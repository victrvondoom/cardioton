import json
from pathlib import Path

import numpy as np
import pytest

from corolens.corolens__corolens__data import LEAKY, RAW_FEATURES, encode, load_xy
from corolens.corolens__corolens__train import conformal_q, conformal_set, platt_apply, platt_fit

ROOT = Path(__file__).resolve().parents[1]


def test_dataset_shape_and_labels():
    raw, X, Y = load_xy()
    assert raw.shape == (303, 59)
    assert X.shape == (303, 55)
    assert Y.sum().to_dict() == {"CAD": 216, "LAD": 177, "LCX": 119, "RCA": 114}


def test_no_target_leakage_in_inputs():
    _, X, _ = load_xy()
    for col in LEAKY:
        assert col not in RAW_FEATURES
        assert not any(c.startswith(col) for c in X.columns), col


def test_encode_single_record_matches_dataset_rows():
    raw, X, _ = load_xy()
    one = encode(raw.iloc[[5]])
    np.testing.assert_allclose(one.values, X.iloc[[5]].values)


def test_conformal_threshold_gives_finite_sample_coverage():
    rng = np.random.default_rng(0)
    y = rng.integers(0, 2, 2000)
    p = np.clip(y * 0.7 + rng.normal(0.15, 0.2, 2000), 0.01, 0.99)
    q = conformal_q(p[:1000], y[:1000], alpha=0.1)
    sets = conformal_set(p[1000:], q)
    coverage = np.mean([yy in s for yy, s in zip(y[1000:], sets)])
    assert coverage >= 0.87


def test_platt_is_monotonic():
    rng = np.random.default_rng(1)
    p = rng.uniform(0.05, 0.95, 400)
    y = (rng.uniform(size=400) < p).astype(int)
    a, b = platt_fit(p, y)
    out = platt_apply(np.sort(p), a, b)
    assert np.all(np.diff(out) >= -1e-12)


def test_saved_metrics_are_real_and_complete():
    m = json.loads((ROOT / "results" / "metrics.json").read_text())
    assert m["split"] == {"development": 242, "test": 61, "seed": 2026, "test_prevalence_cad": pytest.approx(m["split"]["test_prevalence_cad"])}
    for t in ("CAD", "LAD", "LCX", "RCA"):
        h = m["heldout_test"][t]
        assert set(h["metrics"]) == {"roc_auc", "accuracy", "precision", "recall", "f1", "brier"}
        assert 0.5 < h["metrics"]["roc_auc"] <= 1.0
        assert m["nested_cv_dev"][t]["folds"] == 10


def test_browser_bundle_has_every_target():
    b = json.loads((ROOT / "web" / "model" / "corolens_model.json").read_text())
    assert set(b["targets"]) == {"CAD", "LAD", "LCX", "RCA"}
    assert len(b["feature_names"]) == 55

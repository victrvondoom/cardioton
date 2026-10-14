"""Synthetic leakage/selection tests; no experimental result/search tuning."""

import copy
import inspect
from dataclasses import replace
from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest

from ml.common import ROOT, object_digest, read_json
from ml.models import positive_probability, preprocessing_metadata
from ml.splits import DevelopmentData
from research.v2_lcx_rca.core import (
    ARMS,
    FitLedger,
    arm_choices,
    build_pipeline,
    choose_candidate,
    choose_threshold,
    development_boundary,
    inner_select,
    load_data,
    make_folds,
    metrics,
    partition,
    success_gate,
    summarize,
    validate_folds,
)
from research.v2_lcx_rca.preregister import candidates
from research.v2_lcx_rca.run import assert_reproduced, evaluate_fold, preflight


@pytest.fixture
def fixture():
    n = 100
    ids = [f"synthetic-{i:03}" for i in range(n)]
    rng = np.random.default_rng(12)
    X = pd.DataFrame({"number": rng.normal(size=n), "category": ["A", "B"] * 50}, index=ids)
    y = pd.DataFrame({"LCX": [0, 1] * 50, "RCA": [1, 0] * 50}, index=ids)
    data = DevelopmentData(X, y, pd.Series(ids, index=ids), {})
    manifest = {
        "feature_order": list(X),
        "features": [
            {"name": "number", "kind": "number"},
            {"name": "category", "kind": "category", "categories": ["A", "B", "validation-only"]},
        ],
        "targets": {t: {"column": t} for t in ["Cath", "LAD", "LCX", "RCA"]},
        "forbidden_feature_aliases": ["Cath", "CAD", "LAD", "LCX", "RCA"],
    }
    config = {
        "schema_sha256": object_digest(manifest),
        "estimator_seed": 13,
        "reference_fixed": {"n_estimators": 5, "random_state": 42},
        "forest_fixed": {"n_estimators": 7, "n_jobs": 1, "bootstrap": True, "max_features": "sqrt"},
        "elastic_net_fixed": {"solver": "saga", "max_iter": 20000, "tol": 1e-7},
        "xgboost_fixed": {
            "objective": "binary:logistic",
            "tree_method": "hist",
            "n_jobs": 1,
            "n_estimators": 5,
            "learning_rate": 0.03,
            "reg_lambda": 10,
        },
        "threshold_rule": {"sensitivity_min": 0.65, "specificity_min": 0.6},
        "outer_seeds": [1, 2, 3, 4, 5],
        "inner_seeds": {
            t: [[20 + r * 5 + f for f in range(5)] for r in range(5)] for t in ["LCX", "RCA"]
        },
        "final_inner_seeds": {"LCX": 101, "RCA": 102},
        "reproduction": {"probability_atol": 1e-12, "probability_rtol": 1e-10},
    }
    reference = {
        "id": "reference",
        "family": "reference",
        "simplicity_rank": 0,
        "params": {"max_depth": 3, "min_samples_leaf": 5, "class_weight": None},
    }
    cc = [
        next(c for c in candidates() if c["family"] == f)
        for f in ["elastic_net", "forest", "xgboost"]
    ]
    config["candidates"] = cc
    config["references"] = {t: reference for t in ["LCX", "RCA"]}
    return data, manifest, config


def test_small_fixed_search_and_simplicity():
    rows = candidates()
    assert len(rows) == 32
    assert [
        len([r for r in rows if r["family"] == f]) for f in ["elastic_net", "forest", "xgboost"]
    ] == [18, 8, 6]
    assert len({r["id"] for r in rows}) == len(rows)
    assert [r["simplicity_rank"] for r in rows] == list(range(1, 33))


def test_highest_feasible_threshold_and_boundary():
    y, p = [0, 0, 0, 1, 1, 1], [0.1, 0.2, 0.6, 0.3, 0.7, 0.8]
    rule = {"sensitivity_min": 0.65, "specificity_min": 0.6}
    selected = choose_threshold(y, p, rule)
    assert selected["threshold"] == 0.7  # equality at threshold is positive
    assert selected["metrics"]["sensitivity"] == pytest.approx(2 / 3)
    assert selected["metrics"]["specificity"] == 1
    assert not any(np.mean((np.array(p) >= t)[np.array(y) == 1]) >= 0.65 for t in [0.8, 1])


def test_infeasible_rule_no_fallback():
    assert (
        choose_threshold(
            [0, 0, 1, 1], [0.9, 0.8, 0.1, 0.2], {"sensitivity_min": 0.65, "specificity_min": 0.6}
        )
        is None
    )
    assert (
        choose_threshold([0, 0, 1, 1], [0.4] * 4, {"sensitivity_min": 0.65, "specificity_min": 0.6})
        is None
    )


@pytest.mark.parametrize("bad", [[np.nan, 0.2], [-0.1, 0.3], [0.2, 1.1]])
def test_invalid_predictions_rejected(bad):
    with pytest.raises(ValueError):
        choose_threshold([0, 1], bad, {"sensitivity_min": 0.65, "specificity_min": 0.6})


def test_metrics_orientation_pr_auc_ap():
    m = metrics([0, 0, 1, 1], [0.1, 0.5, 0.4, 0.9], [0, 1, 0, 1])
    assert m["confusion_matrix"] == [[1, 1], [1, 1]]
    assert m["sensitivity"] == m["specificity"] == m["precision"] == 0.5
    assert m["balanced_accuracy"] == 0.5 and m["roc_auc"] == 0.75
    dummy = metrics([0, 0, 1, 1], [0.5] * 4, [1] * 4)
    assert dummy["pr_auc"] == 0.75 and dummy["average_precision"] == 0.5


def test_selection_order_is_inner_only():
    rows = []
    for i in range(3):
        rows.append(
            {
                "candidate": {"id": str(i), "family": "forest", "simplicity_rank": i},
                "operating_point": {
                    "threshold": 0.4,
                    "metrics": {"balanced_accuracy": 0.7, "pr_auc": 0.7, "roc_auc": 0.7},
                },
            }
        )
    rows[0]["outer_auc"] = 0.99  # Not a permitted selection input.
    rows[1]["operating_point"]["metrics"]["pr_auc"] = 0.8
    rows[2]["operating_point"]["metrics"]["pr_auc"] = 0.8
    assert choose_candidate(rows)["candidate"]["id"] == "1"
    rows[1]["operating_point"] = None
    assert choose_candidate(rows)["candidate"]["id"] == "2"
    assert choose_candidate(rows, "elastic_net") is None


def test_folds_deterministic_group_integrity_and_inner_parent(fixture):
    data, _, config = fixture
    folds = make_folds(data, config)
    assert folds == make_folds(data, config)
    assert len(folds["LCX"]["repeats"]) == 5
    damaged = copy.deepcopy(folds)
    f = damaged["LCX"]["repeats"][0][0]
    f["inner"][0]["train_ids"][0] = f["validation_ids"][0]
    with pytest.raises(ValueError, match="parent"):
        validate_folds(data, damaged)
    damaged = copy.deepcopy(folds)
    groups = data.groups.copy()
    f = damaged["RCA"]["repeats"][0][0]
    groups.loc[f["validation_ids"][0]] = groups.loc[f["train_ids"][0]]
    with pytest.raises(ValueError, match="group leakage"):
        validate_folds(replace(data, groups=groups), damaged)


def test_duplicate_groups_stay_together(fixture):
    data, _, config = fixture
    groups = pd.Series([f"g-{i // 2}" for i in range(100)], index=data.features.index)
    folds = make_folds(replace(data, groups=groups), config)
    validate_folds(replace(data, groups=groups), folds)


@pytest.mark.parametrize(
    "column", ["Cath", "LAD", "LCX", "RCA", "CAD", "LCX_percent", "derived_RCA"]
)
def test_exact_predictor_order_and_no_target_leakage(fixture, column):
    data, manifest, config = fixture
    pipeline = build_pipeline(config["candidates"][0], manifest, config)
    with pytest.raises(ValueError):
        pipeline.fit(data.features.assign(**{column: 1}), data.targets.LCX)
    with pytest.raises(ValueError, match="order"):
        pipeline.fit(data.features.iloc[:, ::-1], data.targets.LCX)


def test_fold_local_vocabulary_scaling_and_fit_membership(fixture):
    data, manifest, config = fixture
    f = partition(data.targets.LCX, data.groups, 4, 10)[0]
    X = data.features.copy()
    X.loc[f["validation_ids"], "category"] = "validation-only"
    X.loc[f["validation_ids"], "number"] = 1e6
    ledger = FitLedger()
    fitted = ledger.fit(
        config["candidates"][0],
        X.loc[f["train_ids"]],
        data.targets.loc[f["train_ids"], "LCX"],
        manifest,
        config,
        set(f["train_ids"]),
        "test",
    )
    info = preprocessing_metadata(fitted)
    assert "validation-only" not in info["training_categories"]["category"]
    assert info["numeric_scaling"]["mean"][0] == pytest.approx(
        X.loc[f["train_ids"], "number"].mean()
    )
    assert info["fit_record_count"] == len(f["train_ids"])
    assert np.isfinite(positive_probability(fitted, X.loc[f["validation_ids"]])).all()
    with pytest.raises(ValueError, match="escapes"):
        ledger.fit(
            config["candidates"][0],
            X,
            data.targets.LCX,
            manifest,
            config,
            set(f["train_ids"]),
            "poisoned-holdout-id",
        )


def test_inner_oof_threshold_and_outer_outcomes_do_not_select(fixture):
    data, manifest, config = fixture
    folds = make_folds(data, config)
    f = folds["LCX"]["repeats"][0][0]
    a = evaluate_fold(data, "LCX", f, 0, 0, manifest, config)
    changed = data.targets.copy()
    changed.loc[f["validation_ids"], "LCX"] = 1 - changed.loc[f["validation_ids"], "LCX"]
    b = evaluate_fold(replace(data, targets=changed), "LCX", f, 0, 0, manifest, config)
    assert a["decision_sha256"] == b["decision_sha256"]
    assert a["inner_selection"] == b["inner_selection"]
    assert a["arms"]["v1_rf_0.5"]["metrics"] != b["arms"]["v1_rf_0.5"]["metrics"]
    assert "validation" not in inspect.signature(inner_select).parameters
    for r in a["inner_selection"]:
        assert r["oof_ids_sha256"] == object_digest(f["train_ids"])
        if r["operating_point"]:
            p = r["oof_probabilities"]
            assert (
                choose_threshold(
                    data.targets.loc[f["train_ids"], "LCX"], p, config["threshold_rule"]
                )
                == r["operating_point"]
            )


def test_nonconvergence_fails(fixture):
    from sklearn.exceptions import ConvergenceWarning

    data, manifest, config = fixture
    config = copy.deepcopy(config)
    config["elastic_net_fixed"]["max_iter"] = 1
    with pytest.raises(ConvergenceWarning):
        FitLedger().fit(
            config["candidates"][0],
            data.features,
            data.targets.LCX,
            manifest,
            config,
            set(data.features.index),
            "synthetic",
        )


def test_xgboost_cost_weight_uses_only_fit_labels(fixture):
    data, manifest, config = fixture
    candidate = next(
        c for c in candidates() if c["family"] == "xgboost" and c["weighting"] == "balanced"
    )
    y = data.targets.LCX.copy()
    y.iloc[:20] = 0
    fitted = FitLedger().fit(candidate, data.features, y, manifest, config, set(y.index), "test")
    assert fitted.named_steps["classifier"].get_params()["scale_pos_weight"] == float(
        np.sum(y == 0) / np.sum(y == 1)
    )


def test_ineligible_family_has_no_fake_outer_fallback(fixture):
    _, _, config = fixture
    ref = config["references"]["LCX"]
    rows = [{"candidate": c, "operating_point": None} for c in [ref, *config["candidates"]]]
    choices = arm_choices(rows, ref["id"])
    assert choices["v1_rf_0.5"]["threshold"] == 0.5
    assert all(choices[a] is None for a in ARMS if a != "v1_rf_0.5")


def test_missing_folds_not_reported_as_complete_or_success():
    rows = [
        {"repeat": r, "fold": f, "status": "ineligible", "metrics": None}
        for r in range(5)
        for f in range(5)
    ]
    summary = summarize(rows)
    assert summary["evaluated_folds"] == 0 and summary["ineligible_folds"] == 25
    assert all(r["metrics"] is None for r in summary["repeat_pooled"])
    assert not success_gate(summary, summary, {})["passed"]


def test_reserved_access_and_evaluator_fail_loudly():
    import ml.data
    import ml.evaluate_holdout
    import ml.holdout_data

    with development_boundary():
        for f in [
            ml.holdout_data.load_reserved_holdout,
            ml.evaluate_holdout.run_evaluation,
            ml.evaluate_holdout.load_reserved_holdout,
            ml.data.load_workbook,
            pd.read_excel,
        ]:
            with pytest.raises(AssertionError, match="forbidden"):
                f()


def test_actual_safe_loader_exact_development_membership_only():
    data, manifest = load_data()
    split = read_json(ROOT / "artifacts/data/split.json")
    assert data.features.index.tolist() == split["development_ids"]
    assert set(data.features.index).isdisjoint(split["holdout_ids"])
    assert len(data.features) == 242 and list(data.features) == manifest["feature_order"]


def test_synthetic_poisoned_reserved_target_cells_are_never_decoded(tmp_path, fixture):
    import xml.etree.ElementTree as ET
    import zipfile

    from ml.development import NS, read_development_rows
    from ml.splits import build_split

    data, manifest, _ = fixture
    frame = data.features.reset_index(drop=True).copy()
    frame["number"] = np.arange(len(frame), dtype=float)
    frame["LCX"] = np.where(data.targets.LCX.to_numpy() == 1, "Stenotic", "Normal")
    frame["RCA"] = np.where(data.targets.RCA.to_numpy() == 1, "Stenotic", "Normal")
    config = {
        "features": list(data.features),
        "targets": {
            t: {"column": t, "positive_class": "Stenotic", "negative_class": "Normal"}
            for t in ["LCX", "RCA"]
        },
        "forbidden_feature_aliases": ["Cath", "CAD", "LAD", "LCX", "RCA"],
        "expected_rows": len(frame),
        "patient_id_column": None,
    }
    split = build_split(
        frame,
        config,
        {
            "seed": 12,
            "holdout_fraction": 0.2,
            "stratify_target": "LCX",
            "outer_folds": 5,
            "inner_folds": 3,
        },
        {"sha256": "synthetic", "workbook_sha256": "synthetic"},
    )
    path = tmp_path / "synthetic-poison.xlsx"
    frame.to_excel(path, index=False, engine="openpyxl")
    from ml.data import identities

    ids = identities(frame, config).row_id.tolist()
    forbidden_rows = {i + 2 for i, row_id in enumerate(ids) if row_id in split["holdout_ids"]}
    with zipfile.ZipFile(path) as z:
        parts = {n: z.read(n) for n in z.namelist()}
    sheet = ET.fromstring(parts["xl/worksheets/sheet1.xml"])
    for row in sheet.findall(".//" + NS + "row"):
        if int(row.attrib["r"]) in forbidden_rows:
            for c in row:
                if c.attrib["r"].startswith(("C", "D")):
                    c.attrib["t"] = "POISON_RESERVED_TARGET"
    parts["xl/worksheets/sheet1.xml"] = ET.tostring(sheet)
    with zipfile.ZipFile(path, "w") as z:
        for n, content in parts.items():
            z.writestr(n, content)
    result = read_development_rows(path, config, manifest, split)
    assert result.index.tolist() == split["development_ids"]
    assert not set(result.index) & set(split["holdout_ids"])
    assert len(result) == 80


def test_reproduction_tolerances_and_selections():
    p = {"reproduction": {"probability_atol": 1e-12, "probability_rtol": 1e-10}}
    assert_reproduced(
        {"threshold": 0.4, "fit_seconds": 1}, {"threshold": 0.4 + 1e-14, "fit_seconds": 2}, p
    )
    with pytest.raises(ValueError):
        assert_reproduced({"id": "first"}, {"id": "other"}, p)
    with pytest.raises(ValueError):
        assert_reproduced({"threshold": 0.4}, {"threshold": 0.5}, p)


def test_full_development_candidate_fit_is_exact_membership(fixture):
    from research.v2_lcx_rca.run import fit_final

    original, manifest, config = fixture
    ids = [f"synthetic-full-{i:03}" for i in range(242)]
    X = original.features.iloc[np.arange(242) % 100].copy()
    y = original.targets.iloc[np.arange(242) % 100].copy()
    X.index = y.index = ids
    data = DevelopmentData(X, y, pd.Series(ids, index=ids), {})
    config["membership_sha256"] = object_digest(ids)
    folds = {"full_development_inner": partition(y.LCX, data.groups, 4, 71)}
    final = fit_final(data, "LCX", folds, manifest, config, reproduce=True)
    assert final["choice"] is not None
    assert final["preprocessing"]["fit_record_count"] == 242
    assert final["preprocessing"]["fit_row_ids_sha256"] == object_digest(ids)
    assert final["fits"][-1]["fit_records"] == 242


def test_protocol_and_code_are_locked_when_registered():
    path = ROOT / "research/v2_lcx_rca/protocol.json"
    if not path.exists():
        pytest.skip("Protocol registration follows pre-fitting synthetic checks")
    p, data, manifest, folds = preflight()
    assert p["predictors"] == list(data.features) == manifest["feature_order"]
    assert p["experimental_folds_sha256"] == object_digest(folds)
    with patch("research.v2_lcx_rca.run.read_json") as read:
        changed = copy.deepcopy(p)
        changed["threshold_rule"]["sensitivity_min"] = 0.1
        read.return_value = changed
        with pytest.raises(ValueError, match="protocol changed"):
            preflight()

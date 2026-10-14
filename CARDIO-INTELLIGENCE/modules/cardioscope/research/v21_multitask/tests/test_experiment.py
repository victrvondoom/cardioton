"""Synthetic boundary tests; development-only contract checks, no reserved outcomes."""

import copy
import inspect
from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest
import torch

from ml.common import ROOT, object_digest, read_json
from ml.models import preprocessing_metadata
from research.v2_lcx_rca.core import choose_threshold, development_boundary, load_data, partition
from research.v21_multitask.core import (
    TASKS,
    arm,
    context_seed,
    inner_select,
    predict,
    processor,
    select,
    stop_partition,
    train_network,
    validate_training,
)
from research.v21_multitask.preregister import FOLDS, candidates
from scripts.verify_immutable import verify


@pytest.fixture
def synthetic():
    n = 100
    ids = [f"synthetic-{i:03}" for i in range(n)]
    X = pd.DataFrame(
        {"number": np.random.default_rng(12).normal(size=n), "category": ["A", "B"] * 50}, index=ids
    )
    Y = pd.DataFrame({t: [0, 1] * 50 for t in TASKS}, index=ids)
    groups = pd.Series(ids, index=ids)
    manifest = {
        "feature_order": list(X),
        "features": [
            {"name": "number", "kind": "number"},
            {"name": "category", "kind": "category", "categories": ["A", "B", "unseen"]},
        ],
        "targets": {t: {"column": t} for t in ["Cath", "LAD", "LCX", "RCA"]},
        "forbidden_feature_aliases": ["Cath", *TASKS],
    }
    protocol = {
        "schema_sha256": object_digest(manifest),
        "candidates": candidates()[:1],
        "training": {"learning_rate": 0.001, "max_epochs": 5, "patience": 2, "min_delta": 0.0001},
        "threshold_rule": {"sensitivity_min": 0.65, "specificity_min": 0.6},
    }
    return X, Y, groups, manifest, protocol


def test_only_sixteen_predefined_configurations():
    cc = candidates()
    assert len(cc) == len({c["id"] for c in cc}) == 16
    assert {tuple(c["hidden"]) for c in cc} == {(64, 32), (32, 16)}
    assert {c["dropout"] for c in cc} == {0.1, 0.25}
    assert {c["weight_decay"] for c in cc} == {1e-4, 1e-3}
    assert {tuple(c["weights"]) for c in cc} == {(1, 1, 1, 1), (1, 1, 1.5, 1.5)}


@pytest.mark.parametrize(
    "column", ["Cath", "CAD", "LAD", "LCX", "RCA", "derived_RCA", "LCX_percent"]
)
def test_no_target_or_task_derived_input(synthetic, column):
    X, _, _, manifest, p = synthetic
    with pytest.raises(ValueError):
        processor(manifest, p["schema_sha256"]).fit(X.assign(**{column: 1}))


def test_fold_safe_preprocessing_and_no_global_vocab(synthetic):
    X, _, _, manifest, p = synthetic
    X = X.copy()
    X.loc[X.index[80:], "category"] = "unseen"
    X.loc[X.index[80:], "number"] = 1e6
    pre = processor(manifest, p["schema_sha256"]).fit(X.iloc[:80])
    info = preprocessing_metadata(pre)
    assert info["fit_record_count"] == 80
    assert "unseen" not in info["training_categories"]["category"]
    assert info["numeric_scaling"]["mean"][0] == pytest.approx(X.iloc[:80].number.mean())
    assert np.isfinite(pre.transform(X.iloc[80:])).all()


def test_deterministic_seed_dropout_and_four_independent_heads(synthetic):
    X, Y, _, manifest, p = synthetic
    pre = processor(manifest, p["schema_sha256"]).fit(X)
    a, trace_a = train_network(pre.transform(X), Y.to_numpy(), candidates()[0], p["training"], 42)
    b, trace_b = train_network(pre.transform(X), Y.to_numpy(), candidates()[0], p["training"], 42)
    np.testing.assert_array_equal(predict(a, pre, X), predict(b, pre, X))
    assert trace_a == trace_b
    assert list(a.heads) == list(TASKS)
    assert len({id(h.weight) for h in a.heads.values()}) == 4
    assert a.trunk[0].in_features == 3  # two raw variables -> three fitted encoded channels
    assert trace_a["parameter_count"] < 10000
    assert "Y" not in inspect.signature(predict).parameters
    assert context_seed("fixed") == context_seed("fixed")
    assert context_seed("fixed") != context_seed("other")
    a.train()
    a(torch.tensor(pre.transform(X).astype(np.float32))).sum().backward()
    assert all(h.weight.grad is not None for h in a.heads.values())


def test_inner_only_stopping_refit_and_oof_thresholds(synthetic):
    X, Y, groups, manifest, p = synthetic
    inner = partition(Y.LCX, groups, 4, 13)
    rows, ledger = inner_select(X, Y, groups, inner, manifest, p, "LCX/test")
    for entry, fold in zip(ledger, inner, strict=True):
        assert set(entry["fit_ids"]) | set(entry["stop_ids"]) == set(fold["train_ids"])
        assert not set(entry["stop_ids"]) & set(fold["validation_ids"])
        assert not set(entry["fit_ids"]) & set(entry["stop_ids"])
        assert entry["refit_ids"] == fold["train_ids"]
        assert entry["stop_preprocessing"]["fit_row_ids_sha256"] == object_digest(entry["fit_ids"])
        assert entry["refit_preprocessing"]["fit_row_ids_sha256"] == object_digest(
            entry["refit_ids"]
        )
        assert entry["refit"]["executed_epochs"] == entry["stopping"]["best_epoch"]
    row = rows[0]
    for task in ("LCX", "RCA"):
        idx = [z["row_id"] for z in row["oof"]]
        probabilities = [z["probabilities"][TASKS.index(task)] for z in row["oof"]]
        assert row["operating_points"][task] == choose_threshold(
            Y.loc[idx, task], probabilities, p["threshold_rule"]
        )
    # Changing scoring outcomes cannot change private stopping epochs/fit probabilities.
    poisoned = Y.copy()
    poisoned.loc[inner[0]["validation_ids"]] = 1 - poisoned.loc[inner[0]["validation_ids"]]
    fit_ids = inner[0]["train_ids"]
    assert stop_partition(Y.loc[fit_ids], groups.loc[fit_ids], "LCX", "private") == stop_partition(
        poisoned.loc[fit_ids], groups.loc[fit_ids], "LCX", "private"
    )


def test_outer_rows_cannot_enter_inner_training(synthetic):
    X, Y, groups, manifest, p = synthetic
    inner = partition(Y.LCX, groups, 4, 13)
    bad = copy.deepcopy(inner)
    bad[0]["train_ids"][0] = "outer-forbidden"
    with pytest.raises(ValueError, match="escapes"):
        inner_select(X, Y, groups, bad, manifest, p, "LCX/test")
    with pytest.raises(ValueError, match="escapes"):
        validate_training(X, Y, set(X.index[:-1]))
    with pytest.raises(ValueError, match="align"):
        validate_training(X, Y.iloc[:, ::-1], set(X.index))


def test_selection_cannot_consume_outer_scores_and_no_threshold_fallback():
    rows = [
        {
            "candidate": c,
            "operating_points": {t: None for t in ("LCX", "RCA")},
            "ranking_metrics": {t: {"roc_auc": 0.7} for t in TASKS},
        }
        for c in candidates()[:2]
    ]
    rows[1]["outer_auc"] = 1.0
    chosen, eligible = select(rows, "LCX")
    assert chosen["candidate"]["id"] == rows[0]["candidate"]["id"] and not eligible
    assert arm([0, 1], np.array([0.2, 0.8]), ["a", "b"], None, 0, 0)["status"] == "ineligible"


@pytest.mark.parametrize(
    "name",
    [
        "ml.holdout_data.load_reserved_holdout",
        "ml.evaluate_holdout.run_evaluation",
        "ml.data.load_workbook",
        "ml.splits.build_split",
        "pandas.read_excel",
    ],
)
def test_forbidden_access_is_blocked(name):
    import importlib

    module, function = name.rsplit(".", 1)
    with development_boundary(), pytest.raises(AssertionError, match="forbidden"):
        getattr(importlib.import_module(module), function)()


def test_safe_development_loader_and_existing_fold_membership():
    with patch("ml.holdout_data.load_reserved_holdout", side_effect=AssertionError("NO HOLDOUT")):
        data, manifest = load_data()
    assert len(data.features) == 242 and len(data.features.columns) == 55
    assert list(data.targets) == list(TASKS)
    assert not set(TASKS) & set(manifest["feature_order"])
    folds = read_json(FOLDS)
    from research.v2_lcx_rca.core import validate_folds

    validate_folds(data, folds)
    # Audit private holdbacks for ALL planned partitions before any real fit.
    for focus in ("LCX", "RCA"):
        for r, outer in enumerate(folds[focus]["repeats"]):
            for f, fold in enumerate(outer):
                for n, inner in enumerate(fold["inner"]):
                    ids = inner["train_ids"]
                    stop = stop_partition(
                        data.targets.loc[ids],
                        data.groups.loc[ids],
                        focus,
                        f"{focus}/repeat-{r}/outer-{f}/inner-{n}",
                    )
                    for key in ("train_ids", "validation_ids"):
                        assert set(stop[key]).issubset(ids)
                        for task in TASKS:
                            assert set(data.targets.loc[stop[key], task]) == {0, 1}


def test_v1_protected_files_byte_identical():
    assert verify(ROOT)["protected_files"] == 256
    assert verify(ROOT)["byte_identical"]


def test_exactly_242_four_task_target_cells_decoded():
    import re

    import ml.development

    original = ml.development.decode_cell
    target_letters, decoded = set(), []

    def guarded_decode(cell, strings):
        address = cell.get("r")
        number = int(re.search(r"\d+", address).group())
        letter = re.sub(r"\d", "", address)
        value = original(cell, strings)
        if number == 1 and value in ("Cath", "LAD", "LCX", "RCA"):
            target_letters.add(letter)
        elif number != 1 and letter in target_letters:
            decoded.append(address)
        return value

    with development_boundary(), patch("ml.development.decode_cell", side_effect=guarded_decode):
        data, _ = load_data()
    assert len(target_letters) == 4
    assert len(decoded) == 242 * 4
    assert len(set(re.search(r"\d+", address).group() for address in decoded)) == 242
    assert len(data.targets) == 242


def test_registered_protocol_if_present():
    from research.v21_multitask.preregister import HERE
    from research.v21_multitask.run import preflight

    if not (HERE / "protocol.json").exists():
        pytest.skip("Protocol sealed after pre-fitting tests")
    p, data, _, _ = preflight()
    assert p["records"] == len(data.features) == 242

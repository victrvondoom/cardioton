import copy

import pytest

from ml.common import object_digest, read_json
from ml.data import encoded_targets
from ml.splits import (
    assert_disjoint_groups,
    build_split,
    create_or_verify_split,
    development_frame,
    verify_split,
)


def assert_all_partitions(split):
    development, holdout = set(split["development_ids"]), set(split["holdout_ids"])
    lookup = {record["row_id"]: record["group_id"] for record in split["records"]}
    assert_disjoint_groups(development, holdout, lookup)
    assert development | holdout == set(lookup)
    for outer in split["nested_cv"].values():
        seen = []
        assert len(outer) == 5
        for fold in outer:
            train, val = set(fold["train_ids"]), set(fold["validation_ids"])
            assert train | val == development
            assert not (train | val) & holdout
            assert_disjoint_groups(train, val, lookup)
            seen.extend(val)
            inner_seen = []
            assert len(fold["inner"]) == 3
            for inner in fold["inner"]:
                inner_train, inner_val = set(inner["train_ids"]), set(inner["validation_ids"])
                assert inner_train | inner_val == train
                assert not (inner_train | inner_val) & (val | holdout)
                assert_disjoint_groups(inner_train, inner_val, lookup)
                inner_seen.extend(inner_val)
            assert len(inner_seen) == len(set(inner_seen)) == len(train)
        assert len(seen) == len(set(seen)) == len(development)


def test_nested_splits_are_disjoint_complete_and_reproducible(frame, config, strategy, source):
    result = build_split(frame, config, strategy, source)
    assert_all_partitions(result)
    assert result == build_split(frame, config, strategy, source)
    shuffled = frame.sample(frac=1, random_state=17).reset_index(drop=True)
    assert result == build_split(shuffled, config, strategy, source)
    assert len(result["holdout_ids"]) == 24
    assert result["holdout_evaluated"] is False


def test_grouped_duplicates_never_cross_holdout_or_inner_outer_folds(
    frame,
    config,
    strategy,
    source,
):
    for i in range(0, 120, 2):
        for name in config["features"]:
            frame.loc[i + 1, name] = frame.loc[i, name]
    result = build_split(frame, config, strategy, source)
    assert "GroupKFold" in result["holdout_method"]
    assert_all_partitions(result)


def test_locked_manifest_refuses_resampling_or_strategy_change(
    tmp_path,
    frame,
    config,
    strategy,
    source,
):
    path = tmp_path / "split.json"
    initial = create_or_verify_split(frame, config, strategy, source, path)
    original = path.read_bytes()
    assert create_or_verify_split(frame, config, strategy, source, path) == initial
    altered = {**strategy, "seed": 999}
    with pytest.raises(ValueError, match="resampling"):
        create_or_verify_split(frame, config, altered, source, path)
    assert path.read_bytes() == original


def test_manifest_tampering_is_detected_even_with_recomputed_hash(frame, config, strategy, source):
    result = copy.deepcopy(build_split(frame, config, strategy, source))
    result["holdout_ids"][0] = result["development_ids"][0]
    with pytest.raises(ValueError, match="checksum"):
        verify_split(frame, config, strategy, source, result)
    result["manifest_sha256"] = object_digest(
        {k: v for k, v in result.items() if k != "manifest_sha256"}
    )
    with pytest.raises(ValueError, match="resampling"):
        verify_split(frame, config, strategy, source, result)


def test_source_change_is_rejected(frame, config, strategy, source):
    result = build_split(frame, config, strategy, source)
    frame.loc[0, "Age"] += 0.1
    with pytest.raises(ValueError, match="resampling"):
        verify_split(frame, config, strategy, source, result)


def test_development_access_excludes_all_holdout_rows(frame, config, strategy, source):
    result = build_split(frame, config, strategy, source)
    dev = development_frame(frame, config, result)
    assert set(dev.index) == set(result["development_ids"])
    assert not set(dev.index) & set(result["holdout_ids"])
    labels = encoded_targets(dev, config)
    assert labels.index.equals(dev.index)


def test_explicit_group_overlap_check_rejects_different_rows_same_patient():
    with pytest.raises(ValueError, match="group leakage"):
        assert_disjoint_groups(["a"], ["b"], {"a": "same", "b": "same"})


def test_existing_manifest_is_not_overwritten_on_integrity_error(
    tmp_path,
    frame,
    config,
    strategy,
    source,
):
    path = tmp_path / "split.json"
    create_or_verify_split(frame, config, strategy, source, path)
    content = read_json(path)
    content["manifest_sha256"] = "tampered"
    import json

    path.write_text(json.dumps(content))
    corrupted = path.read_bytes()
    with pytest.raises(ValueError):
        create_or_verify_split(frame, config, strategy, source, path)
    assert path.read_bytes() == corrupted

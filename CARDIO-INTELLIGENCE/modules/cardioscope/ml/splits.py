"""Locked holdout and nested, development-only, target-stratified CV partitions.

No model fitting, preprocessing fitting, or final holdout evaluation happens here.
"""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.model_selection import StratifiedGroupKFold, StratifiedKFold, train_test_split

from ml.common import object_digest, read_json, write_json_once
from ml.data import encoded_targets, identities, validate_source


def assert_disjoint_groups(left, right, group_lookup: dict[str, str]) -> None:
    if set(left) & set(right):
        raise ValueError("Record leakage across partitions")
    if {group_lookup[i] for i in left} & {group_lookup[i] for i in right}:
        raise ValueError("Patient/duplicate group leakage across partitions")


def class_counts(y: pd.DataFrame, row_ids: list[str]) -> dict:
    return {
        name: {str(k): int(v) for k, v in y.loc[row_ids, name].value_counts().items()} for name in y
    }


def both_classes(y: pd.DataFrame, row_ids: list[str], targets: list[str]) -> None:
    for target in targets:
        if set(y.loc[row_ids, target]) != {0, 1}:
            raise ValueError(
                f"Partition lacks a class for {target}; explicit split review required"
            )


def cv_partitions(y: pd.Series, groups: pd.Series, count: int, seed: int):
    if int(y.value_counts().min()) < count:
        raise ValueError(
            f"Insufficient class records for {count} folds; do not silently reduce folds"
        )
    if groups.duplicated().any():
        class_groups = [groups[y == label].nunique() for label in [0, 1]]
        if min(class_groups) < count:
            raise ValueError("Insufficient independent groups for stratified grouped folds")
        splitter = StratifiedGroupKFold(n_splits=count, shuffle=True, random_state=seed)
        return list(splitter.split(np.zeros(len(y)), y, groups))
    splitter = StratifiedKFold(n_splits=count, shuffle=True, random_state=seed)
    return list(splitter.split(np.zeros(len(y)), y))


def build_split(frame: pd.DataFrame, config: dict, strategy: dict, source: dict) -> dict:
    validate_source(frame, config)
    ids = identities(frame, config)
    y = encoded_targets(frame, config)
    y.index = ids.row_id
    y = y.sort_index()
    lookup = dict(zip(ids.row_id, ids.group_id, strict=True))
    groups = pd.Series(lookup).loc[y.index]
    seed = strategy["seed"]
    if not 0 < strategy["holdout_fraction"] < 1:
        raise ValueError("Holdout fraction must be between zero and one")
    cad = y[strategy["stratify_target"]]
    if groups.duplicated().any():
        # First predeclared grouped fold, never choose based on model results.
        folds = round(1 / strategy["holdout_fraction"])
        if not np.isclose(1 / folds, strategy["holdout_fraction"]):
            raise ValueError("Grouped holdout requires a reviewed reciprocal fold fraction")
        dev_pos, hold_pos = cv_partitions(cad, groups, folds, seed)[0]
        development = sorted(y.index[dev_pos].tolist())
        holdout = sorted(y.index[hold_pos].tolist())
        method = "first fixed StratifiedGroupKFold partition, stratified on CAD"
    else:
        development, holdout = train_test_split(
            y.index.tolist(),
            test_size=strategy["holdout_fraction"],
            stratify=cad,
            random_state=seed,
        )
        development, holdout = sorted(development), sorted(holdout)
        method = "CAD-stratified fixed train_test_split"
    assert_disjoint_groups(development, holdout, lookup)
    both_classes(y, development, list(y))
    both_classes(y, holdout, list(y))
    nested = {}
    for target in y:
        dev_y = y.loc[development, target]
        dev_groups = groups.loc[development]
        outer = []
        for number, (train_pos, val_pos) in enumerate(
            cv_partitions(dev_y, dev_groups, strategy["outer_folds"], seed)
        ):
            train = dev_y.index[train_pos].tolist()
            validation = dev_y.index[val_pos].tolist()
            assert_disjoint_groups(train, validation, lookup)
            both_classes(y, train, [target])
            both_classes(y, validation, [target])
            inner = []
            train_y = y.loc[train, target]
            train_groups = groups.loc[train]
            for inner_train_pos, inner_val_pos in cv_partitions(
                train_y, train_groups, strategy["inner_folds"], seed + number + 1
            ):
                inner_train = train_y.index[inner_train_pos].tolist()
                inner_val = train_y.index[inner_val_pos].tolist()
                assert_disjoint_groups(inner_train, inner_val, lookup)
                both_classes(y, inner_train, [target])
                both_classes(y, inner_val, [target])
                inner.append({"train_ids": inner_train, "validation_ids": inner_val})
            outer.append({"train_ids": train, "validation_ids": validation, "inner": inner})
        nested[target] = outer
    payload = {
        "schema_version": 1,
        "source_zip_sha256": source["sha256"],
        "workbook_sha256": source["workbook_sha256"],
        "feature_contract_sha256": object_digest(config),
        "strategy": strategy,
        "scikit_learn_version": sklearn.__version__,
        "holdout_method": method,
        "record_identity": "SHA-256 of canonical complete row; not an authoritative patient ID",
        "group_identity": "SHA-256 of canonical predictor values; no source patient IDs available",
        "records": [{"row_id": i, "group_id": lookup[i]} for i in sorted(lookup)],
        "development_ids": development,
        "holdout_ids": holdout,
        "partition_class_counts": {
            "development": class_counts(y, development),
            "holdout": class_counts(y, holdout),
        },
        "nested_cv": nested,
        "holdout_evaluated": False,
    }
    return {**payload, "manifest_sha256": object_digest(payload)}


def verify_split(frame: pd.DataFrame, config: dict, strategy: dict, source: dict, split: dict):
    payload = {k: v for k, v in split.items() if k != "manifest_sha256"}
    if object_digest(payload) != split.get("manifest_sha256"):
        raise ValueError("Split manifest checksum changed")
    # Rebuild the fixed algorithm to check completeness, group integrity and exact membership.
    expected = build_split(frame, config, strategy, source)
    if split != expected:
        raise ValueError("Locked split/data/config/versions differ; resampling is forbidden")


def create_or_verify_split(frame, config, strategy, source, path: Path) -> dict:
    if path.exists():
        existing = read_json(path)
        verify_split(frame, config, strategy, source, existing)
        return existing
    split = build_split(frame, config, strategy, source)
    write_json_once(path, split)
    return split


def development_frame(frame: pd.DataFrame, config: dict, split: dict) -> pd.DataFrame:
    result = frame.copy()
    result.index = identities(frame, config).row_id
    return result.loc[split["development_ids"]].copy()


@dataclass(frozen=True)
class DevelopmentData:
    features: pd.DataFrame
    targets: pd.DataFrame
    groups: pd.Series
    nested_cv: dict


def load_development(root: Path) -> DevelopmentData:
    """Development-only interface: no holdout target decoding or fold regeneration."""
    from ml.development import load_safe_development

    return load_safe_development(root)

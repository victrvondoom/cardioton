"""Synthetic unit fixtures only; separate tests validate the actual UCI cache."""

import copy

import numpy as np
import pandas as pd
import pytest

from ml.data import dataset_config


@pytest.fixture
def config():
    value = copy.deepcopy(dataset_config())
    value["expected_rows"] = 120
    return value


@pytest.fixture
def frame(config):
    rng = np.random.default_rng(42)
    data = {name: rng.normal(size=120) for name in config["features"]}
    data["Sex"] = ["fixture-a", "fixture-b"] * 60
    for offset, target in enumerate(config["targets"].values()):
        data[target["column"]] = [
            target["positive_class"] if (i + offset) % 3 else target["negative_class"]
            for i in range(120)
        ]
    return pd.DataFrame(data)


@pytest.fixture
def strategy():
    return {
        "schema_version": 1,
        "seed": 42,
        "holdout_fraction": 0.2,
        "stratify_target": "CAD",
        "outer_folds": 5,
        "inner_folds": 3,
        "grouping": "identical predictor values",
    }


@pytest.fixture
def source(config):
    return {"sha256": config["zip_sha256"], "workbook_sha256": "a" * 64}

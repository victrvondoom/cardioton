"""Offline integration against downloaded real sources; no training/test evaluation."""

import pytest

from ml.anatomy import inspect_obj, resolve_groups
from ml.common import ROOT, digest, read_json
from ml.data import dataset_config
from ml.development import verify_locked_inputs
from ml.splits import load_development


@pytest.mark.skipif(
    not (ROOT / "data/raw/uci-411/source.zip").exists(),
    reason="Run python -m ml.data prepare to acquire the real source",
)
def test_actual_uci_contract_and_locked_development_access():
    config = dataset_config()
    raw = ROOT / "data/raw/uci-411"
    assert digest((raw / "source.zip").read_bytes()) == config["zip_sha256"]
    verify_locked_inputs(ROOT)
    # The original source audit remains byte-locked. Do not repeat full-label auditing
    # during development: the stronger reader skips holdout target cells entirely.
    split = read_json(ROOT / "artifacts/data/split.json")
    development = load_development(ROOT)
    assert development.features.shape == (242, 55)
    assert set(development.features.columns).isdisjoint(["Cath", "LAD", "LCX", "RCA"])
    assert development.features.index.equals(development.targets.index)
    assert set(development.features.index).isdisjoint(split["holdout_ids"])


@pytest.mark.skipif(
    not (ROOT / "assets/anatomy/manifest.json").exists(),
    reason="Run python -m ml.anatomy prepare to acquire the real mesh subset",
)
def test_actual_anatomy_mapping_integrity_and_shared_transform():
    folder = ROOT / "assets/anatomy"
    config = read_json(ROOT / "config/anatomy.json")
    groups = resolve_groups(
        (folder / "source/parts.tsv").read_text(),
        (folder / "source/elements.tsv").read_text(),
        config,
    )
    assert {k: len(v["leaf_ids"]) for k, v in groups.items()} == {
        "heart": 30,
        "LAD": 18,
        "LCX": 6,
        "RCA": 29,
    }
    manifest = read_json(folder / "manifest.json")
    assert groups == manifest["groups"]
    leaves = [leaf for value in groups.values() for leaf in value["leaf_ids"]]
    assert len(leaves) == len(set(leaves)) == 83
    for leaf, record in manifest["meshes"].items():
        content = (folder / record["path"]).read_bytes()
        assert digest(content) == record["sha256"]
        geometry = inspect_obj(content)
        for key, value in geometry.items():
            assert record[key] == value
        assert record == read_json(folder / f"checksums/{leaf}.json")
    assert manifest["assembly"]["scale"] > 0
    assert manifest["browser_render_verified"] is False

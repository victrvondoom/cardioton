import copy
import io
import zipfile

import pytest

from ml.common import canonical_json, digest, download, write_once
from ml.data import (
    acquire,
    assert_feature_columns,
    audit,
    encoded_targets,
    feature_manifest,
    identities,
    load_workbook,
    validate_source,
)


@pytest.mark.parametrize("target", ["Cath", "LAD", "LCX", "RCA", "C A T H", "overall_CAD"])
def test_target_aliases_never_enter_features(config, target):
    with pytest.raises(ValueError, match="Target leakage"):
        assert_feature_columns([*config["features"], target], config)


def test_unknown_derived_column_and_order_are_rejected(config):
    with pytest.raises(ValueError, match="allowlist"):
        assert_feature_columns([*config["features"], "target_ratio"], config)
    with pytest.raises(ValueError, match="order"):
        assert_feature_columns(config["features"][::-1], config)


def test_binary_targets_have_explicit_positive_labels(frame, config):
    targets = encoded_targets(frame, config)
    for key, spec in config["targets"].items():
        assert targets[key].equals((frame[spec["column"]] == spec["positive_class"]).astype(int))
    assert config["targets"]["CAD"]["column"] == "Cath"


def test_source_contract_rejects_unknown_labels_missing_and_columns(frame, config):
    validate_source(frame, config)
    for altered in [
        frame.drop(columns="Cath"),
        frame.assign(Cath="invented"),
        frame.assign(Age=float("inf")),
        frame.assign(Age=float("nan")),
    ]:
        with pytest.raises(ValueError):
            validate_source(altered, config)


def test_domains_are_development_only_and_units_are_not_guessed(frame, config, source):
    development = frame.iloc[:100].copy()
    frame.loc[119, "Sex"] = "holdout-only-category"
    manifest = feature_manifest(development, config, source)
    sex = next(spec for spec in manifest["features"] if spec["name"] == "Sex")
    assert sex["categories"] == ["fixture-a", "fixture-b"]
    assert all(spec["unit"] is None for spec in manifest["features"])
    assert manifest["preprocessing_fitted"] is False
    assert not set(config["targets"]) & set(manifest["feature_order"])


def test_duplicate_features_share_group_and_label_changes_change_record(frame, config):
    for col in config["features"]:
        frame.loc[1, col] = frame.loc[0, col]
    ids = identities(frame, config)
    assert ids.loc[0, "group_id"] == ids.loc[1, "group_id"]
    assert ids.loc[0, "row_id"] != ids.loc[1, "row_id"]


def test_exact_duplicates_fail_without_silent_deduplication(frame, config):
    frame.loc[1] = frame.loc[0]
    with pytest.raises(ValueError, match="deduplication decision"):
        identities(frame, config)


def test_audit_preserves_cath_label_even_when_vessels_disagree(frame, config):
    before = frame.copy(deep=True)
    report = audit(frame, config)
    assert report["cad_vessel_union_inconsistent_row_ids"]
    assert frame.equals(before)


def test_write_once_refuses_changed_bytes(tmp_path):
    path = tmp_path / "locked.json"
    write_once(path, b"original")
    write_once(path, b"original")
    with pytest.raises(ValueError, match="Immutable"):
        write_once(path, b"replacement")
    assert path.read_bytes() == b"original"


def test_cached_source_checksum_is_checked_without_network(tmp_path):
    path = tmp_path / "source.zip"
    path.write_bytes(b"tampered")
    with pytest.raises(ValueError, match="Checksum"):
        download("https://unused.invalid", path, "0" * 64)


def test_acquisition_extracts_exact_workbook_and_reuses_verified_cache(
    tmp_path,
    config,
    frame,
    monkeypatch,
):
    workbook = io.BytesIO()
    frame.to_excel(workbook, index=False)
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as zip_file:
        zip_file.writestr(config["workbook"], workbook.getvalue())
        zip_file.writestr("../../escape.txt", "must never be extracted")
    data = archive.getvalue()
    cfg = copy.deepcopy(config)
    cfg["zip_sha256"] = digest(data)
    (tmp_path / "config").mkdir()
    (tmp_path / "config/dataset.json").write_bytes(canonical_json(cfg))
    raw = tmp_path / "data/raw/uci-411"
    raw.mkdir(parents=True)
    (raw / "source.zip").write_bytes(data)
    first = acquire(tmp_path)
    assert load_workbook(first, cfg).shape == (120, 59)
    assert not (tmp_path.parent / "escape.txt").exists()
    provenance = (raw / "provenance.json").read_bytes()
    assert acquire(tmp_path) == first
    assert (raw / "provenance.json").read_bytes() == provenance
    first.write_bytes(b"tampered")
    with pytest.raises(ValueError, match="Immutable"):
        acquire(tmp_path)

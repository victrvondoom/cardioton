"""Leakage and reproducibility tests use synthetic outcomes, never real holdout labels."""

import copy
import xml.etree.ElementTree as ET
import zipfile

import numpy as np
import pandas as pd
import pytest

from ml.common import ROOT, digest, object_digest, read_json, write_json_once
from ml.data import encoded_targets, feature_manifest, identities
from ml.development import NS, read_development_rows, validate_folds, verify_locked_inputs
from ml.metrics import choose_candidate, score_predictions
from ml.models import build_pipeline, positive_probability, preprocessing_metadata
from ml.splits import DevelopmentData, build_split, development_frame, load_development
from ml.train import assert_reproduced, compare_development, preflight, save_run


@pytest.fixture
def model_fixture(frame, config, strategy, source):
    split = build_split(frame, config, strategy, source)  # Synthetic source only.
    dev = development_frame(frame, config, split)
    mapping = {r["row_id"]: r["group_id"] for r in split["records"]}
    data = DevelopmentData(
        dev[config["features"]],
        encoded_targets(dev, config),
        pd.Series(mapping).loc[dev.index],
        split["nested_cv"],
    )
    manifest = feature_manifest(dev, config, source)
    search = copy.deepcopy(read_json(ROOT / "config/model_search_v1.json"))
    # Unit-test cost reduction only; the real immutable 15-candidate search is unchanged.
    search["candidates"] = [
        next(c for c in search["candidates"] if c["family"] == family)
        for family in ["dummy", "logistic", "forest"]
    ]
    search["forest_fixed"]["n_estimators"] = 5
    provenance = {
        "development_ids": dev.index.tolist(),
        "schema_sha256": object_digest(manifest),
        "split_sha256": object_digest(split),
        "fixture": True,
    }
    return data, manifest, search, provenance


@pytest.mark.parametrize(
    "column", ["Cath", "LAD", "LCX", "RCA", "CAD", "LAD_percent", "derived_cath"]
)
def test_targets_aliases_and_derived_columns_never_enter_pipeline(model_fixture, column):
    data, manifest, search, provenance = model_fixture
    bad = data.features.assign(**{column: 1})
    pipeline = build_pipeline(
        search["candidates"][1], manifest, provenance["schema_sha256"], search
    )
    with pytest.raises(ValueError):
        pipeline.fit(bad, data.targets.CAD)
    assert not hasattr(pipeline.named_steps["schema"], "fit_row_ids_")


def test_scaler_and_category_vocabulary_fit_only_training_fold(model_fixture):
    data, manifest, search, provenance = model_fixture
    fold = data.nested_cv["CAD"][0]["inner"][0]
    X = data.features.copy()
    # Validation-only category is allowed in the development contract, never learned in train.
    for feature in manifest["features"]:
        if feature["name"] == "Sex":
            feature["categories"].append("validation-only")
    X.loc[fold["validation_ids"], "Sex"] = "validation-only"
    X.loc[fold["validation_ids"], "Age"] = 1e6
    pipeline = build_pipeline(
        search["candidates"][1], manifest, provenance["schema_sha256"], search
    )
    pipeline.fit(X.loc[fold["train_ids"]], data.targets.loc[fold["train_ids"], "CAD"])
    metadata = preprocessing_metadata(pipeline)
    assert metadata["fit_row_ids_sha256"] == object_digest(fold["train_ids"])
    assert "validation-only" not in metadata["training_categories"]["Sex"]
    index = metadata["numeric_scaling"]["features"].index("Age")
    assert metadata["numeric_scaling"]["mean"][index] == pytest.approx(
        X.loc[fold["train_ids"], "Age"].mean()
    )
    assert metadata["numeric_scaling"]["fit_samples"] == len(fold["train_ids"])
    assert np.isfinite(positive_probability(pipeline, X.loc[fold["validation_ids"]])).all()


@pytest.mark.parametrize("damage", ["outer", "inner", "duplicate_group"])
def test_corrupt_folds_fail_before_fitting(model_fixture, damage):
    data, _, _, _ = model_fixture
    nested = copy.deepcopy(data.nested_cv)
    groups = data.groups.copy()
    fold = nested["CAD"][0]
    if damage == "outer":
        fold["validation_ids"][0] = "holdout-like-id"
    elif damage == "inner":
        fold["inner"][0]["train_ids"][0] = fold["validation_ids"][0]
    else:
        groups.loc[fold["train_ids"][0]] = groups.loc[fold["validation_ids"][0]]
    with pytest.raises(ValueError):
        validate_folds(data.features.index, groups, nested, list(data.targets))


def test_trainer_rejects_extra_or_reordered_membership(model_fixture):
    data, manifest, search, provenance = model_fixture
    changed = DevelopmentData(
        data.features.iloc[::-1], data.targets.iloc[::-1], data.groups, data.nested_cv
    )
    with pytest.raises(ValueError, match="locked development membership"):
        preflight(changed, manifest, search, provenance)


def test_metric_class_order_positive_encoding_and_threshold(model_fixture):
    data, manifest, search, provenance = model_fixture
    assert manifest["targets"]["CAD"]["positive_class"] == "CAD"
    for target in ["LAD", "LCX", "RCA"]:
        assert manifest["targets"][target]["positive_class"] == "Stenotic"
    metrics = score_predictions([0, 0, 1, 1], [0.1, 0.5, 0.4, 0.9])
    assert metrics["confusion_matrix"] == [[1, 1], [1, 1]]
    assert metrics["roc_auc"] == 0.75
    assert metrics["precision"] == metrics["recall"] == 0.5
    assert metrics["brier_score"] == pytest.approx((0.01 + 0.25 + 0.36 + 0.01) / 4)
    pipeline = build_pipeline(
        search["candidates"][0], manifest, provenance["schema_sha256"], search
    )
    pipeline.fit(data.features, data.targets.CAD)
    np.testing.assert_allclose(
        positive_probability(pipeline, data.features), data.targets.CAD.mean()
    )
    pipeline.named_steps["classifier"].classes_ = np.array([1, 0])
    with pytest.raises(ValueError, match="positive=1"):
        positive_probability(pipeline, data.features)


@pytest.mark.parametrize(
    "y,p,t",
    [
        ([0, 0], [0.1, 0.2], 0.5),
        ([0, 1], [0.1, float("nan")], 0.5),
        ([0, 1], [-0.1, 1], 0.5),
        ([0, 1], [0.1, 0.9], 0.4),
    ],
)
def test_metric_invalid_inputs_fail(y, p, t):
    with pytest.raises(ValueError):
        score_predictions(y, p, t)


def test_selection_primary_brier_and_simplicity_are_predefined(model_fixture):
    _, _, search, _ = model_fixture
    rows = [
        {
            "candidate": {"id": "simple", "simplicity_rank": 0},
            "mean_inner_roc_auc": 0.7,
            "mean_inner_brier_score": 0.2,
        },
        {
            "candidate": {"id": "better-brier", "simplicity_rank": 2},
            "mean_inner_roc_auc": 0.7,
            "mean_inner_brier_score": 0.1,
        },
    ]
    assert choose_candidate(rows, search)["candidate"]["id"] == "better-brier"
    rows[0]["mean_inner_brier_score"] = 0.1
    assert choose_candidate(rows, search)["candidate"]["id"] == "simple"
    rows[1]["mean_inner_roc_auc"] = 0.8
    assert choose_candidate(rows, search)["candidate"]["id"] == "better-brier"


def test_nested_comparison_is_reproducible_and_artifacts_are_guarded(model_fixture, tmp_path):
    data, manifest, search, provenance = model_fixture
    first, models, timings = compare_development(data, manifest, search, provenance)
    second, rerun_models, rerun_timings = compare_development(data, manifest, search, provenance)
    assert_reproduced(first, second)
    for target, row in first["targets"].items():
        assert len(row["outer_folds"]) == 5
        assert all(s["inner_fold_count"] == 15 for s in row["final_inner_summaries"])
        for fold, persisted in zip(row["outer_folds"], data.nested_cv[target], strict=True):
            assert fold["train_ids"] == persisted["train_ids"]
            assert fold["validation_ids"] == persisted["validation_ids"]
            assert len(fold["inner_results"]) == 9
            assert (
                fold["selected"] == choose_candidate(fold["inner_summaries"], search)["candidate"]
            )
        assert (
            row["selected_configuration"]["candidate"]
            == choose_candidate(row["final_inner_summaries"], search)["candidate"]
        )
        for aggregate in row["aggregate"].values():
            assert {p["row_id"] for p in aggregate["oof_predictions"]} == set(
                provenance["development_ids"]
            )
    save_run(tmp_path, first, models, timings, data)
    original = digest((tmp_path / "results.json").read_bytes())
    save_run(tmp_path, second, rerun_models, rerun_timings, data, reproduce=True)
    assert digest((tmp_path / "results.json").read_bytes()) == original
    metadata_path = tmp_path / "models/CAD.json"
    metadata = read_json(metadata_path)
    assert metadata["schema_sha256"] == provenance["schema_sha256"]
    assert metadata["holdout_evaluated"] is False and metadata["deployed"] is False
    metadata["schema_sha256"] = "wrong"
    import json

    metadata_path.write_text(json.dumps(metadata))
    with pytest.raises(ValueError, match="fingerprint"):
        save_run(tmp_path, second, rerun_models, rerun_timings, data, reproduce=True)


def test_outer_outcomes_cannot_change_selections(model_fixture, monkeypatch):
    import ml.train as training

    data, manifest, search, provenance = model_fixture
    first, _, _ = compare_development(data, manifest, search, provenance)
    actual = training.fit_partition
    outer_validation = {
        tuple(f["validation_ids"]) for folds in data.nested_cv.values() for f in folds
    }

    def poisoned_outer(*args, **kwargs):
        pipeline, probability, metrics = actual(*args, **kwargs)
        if tuple(args[4]) in outer_validation:
            metrics = {**metrics, "roc_auc": 0.01, "brier_score": 0.99}
        return pipeline, probability, metrics

    monkeypatch.setattr(training, "fit_partition", poisoned_outer)
    changed, _, _ = compare_development(data, manifest, search, provenance)
    for target in data.targets:
        assert (
            first["targets"][target]["selected_configuration"]["candidate"]
            == changed["targets"][target]["selected_configuration"]["candidate"]
        )
        assert [f["selected"] for f in first["targets"][target]["outer_folds"]] == [
            f["selected"] for f in changed["targets"][target]["outer_folds"]
        ]


def test_workbook_reader_never_decodes_holdout_target_cells(
    frame, config, strategy, source, tmp_path, monkeypatch
):
    import ml.development as reader

    workbook = tmp_path / "synthetic.xlsx"
    frame.to_excel(workbook, index=False)
    # Excel serializes floats to 15 significant digits; build ONLY this synthetic split
    # from its round-tripped fixture, so source content identities match.
    fixture = pd.read_excel(workbook)
    split = build_split(fixture, config, strategy, source)
    dev = development_frame(fixture, config, split)
    manifest = feature_manifest(dev, config, source)
    ids = identities(fixture, config).row_id
    holdout_rows = {i + 2 for i, row_id in enumerate(ids) if row_id not in split["development_ids"]}
    with zipfile.ZipFile(workbook) as archive:
        files = {name: archive.read(name) for name in archive.namelist()}
    sheet = ET.fromstring(files["xl/worksheets/sheet1.xml"])
    header = next(iter(sheet.find(NS + "sheetData")))
    target_letters = {
        cell.get("r").rstrip("1")
        for cell in header
        if reader.decode_cell(cell, []) in {t["column"] for t in config["targets"].values()}
    }
    forbidden = set()
    for row in sheet.find(NS + "sheetData"):
        if int(row.get("r")) in holdout_rows:
            for cell in row:
                if cell.get("r").rstrip("0123456789") in target_letters:
                    forbidden.add(cell.get("r"))
                    cell.set("t", "DO-NOT-DECODE-HOLDOUT")
    files["xl/worksheets/sheet1.xml"] = ET.tostring(sheet)
    with zipfile.ZipFile(workbook, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    actual_decode = reader.decode_cell

    def guarded(cell, strings):
        assert cell.get("r") not in forbidden, "A holdout target cell was accessed"
        return actual_decode(cell, strings)

    monkeypatch.setattr(reader, "decode_cell", guarded)
    result = read_development_rows(workbook, config, manifest, split)
    pd.testing.assert_frame_equal(result, dev, check_names=False)


def test_real_safe_loader_cannot_call_full_workbook_or_resplit(monkeypatch):
    import ml.data as source_module
    import ml.splits as splits

    if not (ROOT / "data/raw/uci-411/source.zip").exists():
        pytest.skip("Prepare the real source cache")

    def forbidden(*args, **kwargs):
        pytest.fail("Model development attempted full-source target loading or fold regeneration")

    for module, names in [
        (source_module, ["load_workbook", "audit"]),
        (splits, ["verify_split", "build_split", "cv_partitions"]),
    ]:
        for name in names:
            monkeypatch.setattr(module, name, forbidden)
    data = load_development(ROOT)
    assert len(data.features) == 242
    assert not hasattr(data, "holdout")


def test_byte_anchor_rejects_input_tampering(tmp_path):
    (tmp_path / "locked.txt").write_text("original")
    write_json_once(
        tmp_path / "config/development_access.json", {"files": {"locked.txt": digest(b"original")}}
    )
    verify_locked_inputs(tmp_path)
    (tmp_path / "locked.txt").write_text("changed")
    with pytest.raises(ValueError, match="Locked phase-one"):
        verify_locked_inputs(tmp_path)

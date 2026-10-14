"""Final evaluator tests use synthetic workbooks and mock frozen artifacts only."""

import copy
import json
import platform
import xml.etree.ElementTree as ET
import zipfile
from importlib.metadata import version

import joblib
import pandas as pd
import pytest

from ml.common import ROOT, digest, object_digest, read_json, write_json_once
from ml.data import encoded_targets, feature_manifest
from ml.development import NS
from ml.evaluate_holdout import (
    LIBRARIES,
    EvaluationRefused,
    evaluation_status,
    guard_path,
    no_fitting,
    preflight,
    reserve,
    run_evaluation,
    verify_evaluation,
)
from ml.holdout_data import load_reserved_holdout, validate_membership
from ml.holdout_metrics import binomial_interval, uncertainty
from ml.holdout_plots import save_holdout_outputs as render_holdout_outputs
from ml.metrics import aggregate_folds, score_predictions
from ml.models import build_pipeline, positive_probability, preprocessing_metadata
from ml.splits import build_split, development_frame


@pytest.fixture
def frozen_fixture(tmp_path, frame, config, strategy, source, monkeypatch):
    """Train mock artifacts on a synthetic development partition, never real models."""
    config = copy.deepcopy(config)
    config["zip_sha256"] = digest(b"synthetic zip placeholder")
    raw = tmp_path / "data/raw/uci-411"
    raw.mkdir(parents=True)
    path = raw / config["workbook"]
    frame.to_excel(path, index=False)
    frame = pd.read_excel(path)
    source = {
        **source,
        "sha256": config["zip_sha256"],
        "workbook_sha256": digest(path.read_bytes()),
    }
    (raw / "source.zip").write_bytes(b"synthetic zip placeholder")
    write_json_once(raw / "provenance.json", source)
    split = build_split(frame, config, strategy, source)
    dev = development_frame(frame, config, split)
    manifest = feature_manifest(dev, config, source)
    for name, value in [
        ("config/dataset.json", config),
        ("config/split.json", strategy),
        ("artifacts/data/split.json", split),
        ("artifacts/data/feature_manifest.json", manifest),
        ("artifacts/data/audit.json", {"synthetic": True}),
    ]:
        write_json_once(tmp_path / name, value)
    locked = [
        str(p.relative_to(tmp_path))
        for parent in [tmp_path / "config", tmp_path / "artifacts/data", raw]
        for p in parent.rglob("*")
        if p.is_file()
    ]
    write_json_once(
        tmp_path / "config/development_access.json",
        {"files": {name: digest((tmp_path / name).read_bytes()) for name in locked}},
    )
    search = copy.deepcopy(read_json(ROOT / "config/model_search_v1.json"))
    search["access_lock_file_sha256"] = digest(
        (tmp_path / "config/development_access.json").read_bytes()
    )
    write_json_once(tmp_path / "config/model_search_v1.json", search)
    provenance = {
        "development_ids": split["development_ids"],
        "development_ids_sha256": object_digest(split["development_ids"]),
        "schema_sha256": digest((tmp_path / "artifacts/data/feature_manifest.json").read_bytes()),
        "split_sha256": digest((tmp_path / "artifacts/data/split.json").read_bytes()),
        "files_sha256": {
            name: digest((tmp_path / name).read_bytes())
            for name in [
                "config/model_search_v1.json",
                "config/development_access.json",
                "artifacts/data/feature_manifest.json",
                "artifacts/data/split.json",
            ]
        },
        "libraries": {name: version(name) for name in LIBRARIES},
        "python": platform.python_version(),
    }
    protocol = copy.deepcopy(read_json(ROOT / "config/final_evaluation_v1.json"))
    directory = tmp_path / "artifacts/development/synthetic-frozen-run"
    directory.mkdir(parents=True)
    results = {
        "provenance": provenance,
        "training_configuration_sha256": object_digest(provenance),
        "search": search,
        "targets": {},
    }
    y = encoded_targets(dev, config)
    for target, candidate in protocol["frozen_candidates"].items():
        pipeline = build_pipeline(candidate, manifest, provenance["schema_sha256"], search)
        pipeline.fit(dev[config["features"]], y[target])
        selected = {
            "candidate": candidate,
            "estimator_parameters": pipeline.named_steps["classifier"].get_params(),
            "preprocessing": preprocessing_metadata(pipeline),
        }
        metrics = score_predictions(
            y[target], positive_probability(pipeline, dev[config["features"]])
        )
        results["targets"][target] = {
            "selected_configuration": selected,
            "aggregate": {"selection_procedure": {"fold_metrics": aggregate_folds([metrics] * 5)}},
        }
        model_path = directory / "models" / f"{target}.joblib"
        model_path.parent.mkdir(exist_ok=True)
        joblib.dump(pipeline, model_path, compress=3)
        write_json_once(
            model_path.with_suffix(".json"),
            {
                "model_sha256": digest(model_path.read_bytes()),
                "target": target,
                "schema_sha256": provenance["schema_sha256"],
                "split_sha256": provenance["split_sha256"],
                "training_configuration_sha256": object_digest(provenance),
                "selected_configuration": selected,
            },
        )
    write_json_once(directory / "results.json", results)
    protocol.update(
        {
            "development_run_id": directory.name,
            "development_directory": str(directory.relative_to(tmp_path)),
            "development_run_sha256": object_digest(provenance),
            "development_files_sha256": {
                str(p.relative_to(tmp_path)): digest(p.read_bytes())
                for p in directory.rglob("*")
                if p.is_file()
            },
            "schema_sha256": provenance["schema_sha256"],
            "split_sha256": provenance["split_sha256"],
            "search_sha256": digest((tmp_path / "config/model_search_v1.json").read_bytes()),
            "access_lock_sha256": search["access_lock_file_sha256"],
            "holdout_records": len(split["holdout_ids"]),
            "holdout_ids_sha256": object_digest(split["holdout_ids"]),
        }
    )
    protocol["uncertainty"]["bootstrap_repetitions"] = 17  # Test-only fixture protocol.
    protocol["uncertainty"]["minimum_class_count"] = 2
    write_json_once(tmp_path / "config/final_evaluation_v1.json", protocol)
    import ml.holdout_plots as plots

    monkeypatch.setattr(
        plots, "save_holdout_outputs", lambda *args: None
    )  # Avoid repeated test rendering.
    return tmp_path, config, manifest, split, protocol


def test_preflight_and_saved_models_never_fit_or_access_outcomes(frozen_fixture, monkeypatch):
    import ml.evaluate_holdout as evaluator

    root, *_ = frozen_fixture
    monkeypatch.setattr(
        evaluator, "load_reserved_holdout", lambda *args: pytest.fail("Preflight accessed outcomes")
    )
    context = preflight(root)
    assert len(context["models"]) == 4
    pipeline = context["models"]["CAD"]
    with no_fitting(), pytest.raises(RuntimeError, match="Fitting is forbidden"):
        pipeline.fit(pd.DataFrame(), [])
    with no_fitting(), pytest.raises(RuntimeError, match="Fitting is forbidden"):
        pipeline.named_steps["classifier"].fit([], [])


@pytest.mark.parametrize(
    "name",
    [
        "artifacts/data/feature_manifest.json",
        "artifacts/data/split.json",
        "config/model_search_v1.json",
        "config/development_access.json",
        "config/dataset.json",
        "artifacts/development/synthetic-frozen-run/models/CAD.joblib",
        "artifacts/development/synthetic-frozen-run/models/RCA.json",
        "artifacts/development/synthetic-frozen-run/results.json",
    ],
)
def test_fingerprint_tampering_fails_before_guard_or_label_access(
    frozen_fixture, monkeypatch, name
):
    import ml.evaluate_holdout as evaluator

    root, *_ = frozen_fixture
    path = root / name
    path.write_bytes(path.read_bytes() + b" ")
    monkeypatch.setattr(
        evaluator, "load_reserved_holdout", lambda *args: pytest.fail("Labels accessed")
    )
    with pytest.raises(ValueError):
        run_evaluation(root)
    assert not (root / "artifacts/final_holdout/guards").exists()


@pytest.mark.parametrize("damage", ["duplicate", "wrong", "overlap", "group"])
def test_membership_validation_rejects_corruption(frozen_fixture, damage):
    _, _, _, split, protocol = frozen_fixture
    changed = copy.deepcopy(split)
    if damage == "duplicate":
        changed["holdout_ids"][0] = changed["holdout_ids"][1]
    elif damage == "wrong":
        changed["holdout_ids"][0] = "unknown-id"
    elif damage == "overlap":
        changed["holdout_ids"][0] = changed["development_ids"][0]
    else:
        lookup = {r["row_id"]: r for r in changed["records"]}
        lookup[changed["holdout_ids"][0]]["group_id"] = lookup[changed["development_ids"][0]][
            "group_id"
        ]
    with pytest.raises(ValueError):
        validate_membership(changed, protocol["holdout_records"], protocol["holdout_ids_sha256"])


def test_holdout_reader_decodes_only_reserved_records(frozen_fixture, monkeypatch):
    import ml.holdout_data as reader

    root, config, manifest, split, protocol = frozen_fixture
    # A spy rejects any development target decoding, without reading real source outcomes.
    path = root / "data/raw/uci-411" / config["workbook"]
    fixture = pd.read_excel(path)
    from ml.data import identities

    ids = identities(fixture, config).row_id
    dev_rows = {i + 2 for i, row_id in enumerate(ids) if row_id in split["development_ids"]}
    from openpyxl.utils import get_column_letter

    target_letters = {
        get_column_letter(fixture.columns.get_loc(t["column"]) + 1)
        for t in config["targets"].values()
    }
    original = reader.decode_cell

    def guarded(cell, strings):
        import re

        ref = cell.get("r")
        assert not (
            int(re.sub(r"\D", "", ref)) in dev_rows and re.sub(r"\d", "", ref) in target_letters
        )
        return original(cell, strings)

    monkeypatch.setattr(reader, "decode_cell", guarded)
    data = load_reserved_holdout(
        path, config, manifest, split, protocol["holdout_records"], protocol["holdout_ids_sha256"]
    )
    assert data.features.index.tolist() == split["holdout_ids"]
    assert len(data.features) == protocol["holdout_records"]


def test_missing_holdout_record_fails_without_dropping(frozen_fixture):
    root, config, manifest, split, protocol = frozen_fixture
    path = root / "data/raw/uci-411" / config["workbook"]
    with zipfile.ZipFile(path) as archive:
        files = {name: archive.read(name) for name in archive.namelist()}
    tree = ET.fromstring(files["xl/worksheets/sheet1.xml"])
    rows = tree.find(NS + "sheetData")
    rows.remove(list(rows)[1])
    files["xl/worksheets/sheet1.xml"] = ET.tostring(tree)
    with zipfile.ZipFile(path, "w") as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    with pytest.raises(ValueError, match="Missing holdout/source"):
        load_reserved_holdout(
            path,
            config,
            manifest,
            split,
            protocol["holdout_records"],
            protocol["holdout_ids_sha256"],
        )


@pytest.mark.parametrize("damage", ["category", "schema", "target_encoding", "missing_record"])
def test_input_problems_leave_failure_not_success_and_cannot_retry(
    frozen_fixture, monkeypatch, damage
):
    import ml.evaluate_holdout as evaluator

    root, config, manifest, split, protocol = frozen_fixture
    original = evaluator.load_reserved_holdout

    def damaged(*args):
        data = original(*args)
        if damage == "category":
            data.features.loc[data.features.index[0], "Sex"] = "unknown-category"
        elif damage == "schema":
            data.features["Cath"] = "CAD"
        elif damage == "target_encoding":
            data.targets.iloc[0, 0] = 99
        else:
            from ml.holdout_data import HoldoutData

            return HoldoutData(data.features.iloc[:-1], data.targets.iloc[:-1])
        return data

    monkeypatch.setattr(evaluator, "load_reserved_holdout", damaged)
    with pytest.raises(ValueError):
        run_evaluation(root)
    assert evaluation_status(root)["status"] == "failed"
    status = read_json(guard_path(root, protocol["split_sha256"]))
    assert not (root / status["output_directory"] / "evaluation_record.json").exists()
    with pytest.raises(EvaluationRefused):
        run_evaluation(root)
    with pytest.raises(ValueError, match="No completed"):
        verify_evaluation(root)


def test_single_inference_and_saved_pair_verification_without_model_or_workbook_load(
    frozen_fixture, monkeypatch
):
    import ml.evaluate_holdout as evaluator

    root, _, _, split, protocol = frozen_fixture
    calls = []
    actual = evaluator.positive_probability

    def counted(pipeline, X):
        calls.append(X.index.tolist())
        return actual(pipeline, X)

    monkeypatch.setattr(evaluator, "positive_probability", counted)
    record = run_evaluation(root)
    assert record["status"] == "completed" and record["fitting_performed"] is False
    assert len(calls) == 4 and all(ids == split["holdout_ids"] for ids in calls)
    monkeypatch.setattr(
        evaluator, "preflight", lambda *args: pytest.fail("Repeat deserialized models")
    )
    with pytest.raises(EvaluationRefused):
        run_evaluation(root)
    monkeypatch.setattr(
        evaluator,
        "load_reserved_holdout",
        lambda *args: pytest.fail("Verification read target cells"),
    )
    monkeypatch.setattr(
        evaluator.joblib, "load", lambda *args: pytest.fail("Verification loaded a model")
    )
    assert verify_evaluation(root)["verified"] is True
    out = root / record["output_directory"]
    (out / "predictions.json").write_bytes((out / "predictions.json").read_bytes() + b" ")
    with pytest.raises(ValueError, match="fingerprint"):
        verify_evaluation(root)


def test_competing_reservation_is_exclusive_and_interrupted_attempt_remains_consumed(
    frozen_fixture,
):
    root, *_ = frozen_fixture
    context = preflight(root)
    reserve(root, context)
    with pytest.raises(EvaluationRefused):
        reserve(root, context)
    assert evaluation_status(root)["status"] == "reserved_or_interrupted"
    with pytest.raises(EvaluationRefused):
        run_evaluation(root)


def test_binomial_and_bootstrap_edge_cases_are_explicit():
    assert binomial_interval(0, 10, 0.95)["interval"][0] == 0
    assert binomial_interval(10, 10, 0.95)["interval"][1] == 1
    settings = copy.deepcopy(read_json(ROOT / "config/final_evaluation_v1.json")["uncertainty"])
    settings.update(bootstrap_repetitions=17, minimum_class_count=2)
    result = uncertainty([0, 0, 1, 1], [0, 0, 1, 1], settings, 0)
    assert result["intervals"]["roc_auc"]["interval"] is None
    assert "Degenerate" in result["intervals"]["roc_auc"]["reason"]
    scarce = uncertainty([0, 0, 0, 1], [0.1, 0.2, 0.3, 0.4], settings, 0)
    assert scarce["completed_repetitions"] == 0
    assert scarce["intervals"]["roc_auc"]["interval"] is None


def test_failure_after_inference_preserves_pairs_and_never_commits_success(
    frozen_fixture, monkeypatch
):
    import ml.holdout_plots as plots

    root, _, _, _, protocol = frozen_fixture

    def failure(*args):
        raise RuntimeError("Synthetic output failure")

    monkeypatch.setattr(plots, "save_holdout_outputs", failure)
    with pytest.raises(RuntimeError, match="Synthetic output"):
        run_evaluation(root)
    reservation = read_json(guard_path(root, protocol["split_sha256"]))
    out = root / reservation["output_directory"]
    assert (out / "predictions.json").exists()
    assert not (out / "evaluation_record.json").exists()
    assert evaluation_status(root)["status"] == "failed"
    with pytest.raises(EvaluationRefused):
        run_evaluation(root)


def test_completion_receipt_detects_record_tampering(frozen_fixture):
    root, *_ = frozen_fixture
    record = run_evaluation(root)
    path = root / record["output_directory"] / "evaluation_record.json"
    altered = read_json(path)
    altered["model_checksums"]["CAD"] = "wrong"
    path.write_text(json.dumps(altered))
    with pytest.raises(ValueError, match="receipt fingerprint"):
        verify_evaluation(root)


def test_complete_synthetic_run_generates_and_verifies_real_figures(frozen_fixture, monkeypatch):
    import ml.holdout_plots as plots

    root, *_ = frozen_fixture
    monkeypatch.setattr(plots, "save_holdout_outputs", render_holdout_outputs)
    record = run_evaluation(root)
    out = root / record["output_directory"]
    assert len(list((out / "figures").glob("*"))) == 6
    assert (out / "metrics.csv").exists()
    assert verify_evaluation(root)["verified"] is True

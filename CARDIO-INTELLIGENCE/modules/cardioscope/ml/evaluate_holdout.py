"""Guarded final evaluation of frozen pipelines. No fitting, selection, or overwrite mode.

Commands: check (no outcomes), run (once), verify (saved pairs only), status (record only).
"""

import argparse
import contextlib
import os
import platform
import uuid
from importlib.metadata import version
from pathlib import Path
from unittest.mock import patch

import joblib
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from threadpoolctl import threadpool_limits

from ml.common import (
    ROOT,
    canonical_json,
    digest,
    object_digest,
    read_json,
    utc_now,
    write_json_once,
)
from ml.data import dataset_config
from ml.development import verify_locked_inputs
from ml.holdout_data import load_reserved_holdout, validate_membership
from ml.holdout_metrics import summarize_saved_predictions
from ml.models import SchemaGuard, positive_probability, preprocessing_metadata

EXPECTED = {
    "CAD": ("logistic", {"C": 0.1, "class_weight": "balanced"}),
    "LAD": ("logistic", {"C": 0.1, "class_weight": "balanced"}),
    "LCX": ("forest", {"max_depth": 3, "min_samples_leaf": 10, "class_weight": None}),
    "RCA": ("forest", {"max_depth": 5, "min_samples_leaf": 10, "class_weight": None}),
}
LIBRARIES = ("scikit-learn", "numpy", "pandas", "scipy", "joblib", "matplotlib", "threadpoolctl")


class EvaluationRefused(ValueError):
    """A partition already reserved/completed/failed; never infer against it again."""


def hash_files(root: Path, files: dict):
    for name, sha in files.items():
        path = root / name
        if not path.is_file() or digest(path.read_bytes()) != sha:
            raise ValueError("Pinned artifact fingerprint differs: " + name)


def evaluator_fingerprints():
    folder = Path(__file__).resolve().parent
    names = [
        "evaluate_holdout.py",
        "holdout_data.py",
        "holdout_metrics.py",
        "holdout_plots.py",
        "common.py",
        "data.py",
        "development.py",
        "models.py",
        "metrics.py",
    ]
    return {name: digest((folder / name).read_bytes()) for name in names}


def no_fitting():
    """Intercept fitting on every pipeline component, not just the classifier."""

    def forbidden(*args, **kwargs):
        raise RuntimeError("Fitting is forbidden in final evaluation")

    stack = contextlib.ExitStack()
    classes = [
        Pipeline,
        ColumnTransformer,
        StandardScaler,
        OneHotEncoder,
        SchemaGuard,
        LogisticRegression,
        RandomForestClassifier,
        DummyClassifier,
    ]
    for cls in classes:
        stack.enter_context(patch.object(cls, "fit", forbidden))
        if hasattr(cls, "fit_transform"):
            stack.enter_context(patch.object(cls, "fit_transform", forbidden))
    return stack


def preflight(root: Path = ROOT) -> dict:
    """Only IDs, development labels/artifacts and opaque source bytes; no holdout outcomes."""
    protocol_path = root / "config/final_evaluation_v1.json"
    protocol = read_json(protocol_path)
    if protocol["phase"] != "FINAL_HOLDOUT" or protocol["threshold"] != 0.5:
        raise ValueError("Final evaluation protocol scope/threshold differs")
    if set(protocol["targets"]) != set(EXPECTED):
        raise ValueError("Final target definitions differ")
    for target, (family, params) in EXPECTED.items():
        c = protocol["frozen_candidates"][target]
        if c["family"] != family or c["params"] != params:
            raise ValueError("Frozen candidate selection differs: " + target)
    if (
        digest((root / "config/development_access.json").read_bytes())
        != protocol["access_lock_sha256"]
    ):
        raise ValueError("Phase-one access lock fingerprint differs")
    verify_locked_inputs(root, anatomy=True)
    hash_files(root, protocol["development_files_sha256"])
    manifest_path = root / "artifacts/data/feature_manifest.json"
    split_path = root / "artifacts/data/split.json"
    search_path = root / "config/model_search_v1.json"
    for path, field in [
        (manifest_path, "schema_sha256"),
        (split_path, "split_sha256"),
        (search_path, "search_sha256"),
    ]:
        if digest(path.read_bytes()) != protocol[field]:
            raise ValueError("Final " + field + " fingerprint differs")
    manifest, split, search = (
        read_json(manifest_path),
        read_json(split_path),
        read_json(search_path),
    )
    config = dataset_config(root)
    if protocol["targets"] != manifest["targets"] or manifest["targets"] != config["targets"]:
        raise ValueError("Target encodings differ from frozen source contract")
    if manifest["feature_order"] != config["features"]:
        raise ValueError("Predictor feature manifest differs")
    validate_membership(split, protocol["holdout_records"], protocol["holdout_ids_sha256"])
    development_dir = root / protocol["development_directory"]
    development = read_json(development_dir / "results.json")
    p = development["provenance"]
    if (
        object_digest(p) != protocol["development_run_sha256"]
        or development["training_configuration_sha256"] != protocol["development_run_sha256"]
        or development_dir.name != protocol["development_run_id"]
    ):
        raise ValueError("Development run fingerprint differs")
    hash_files(root, p["files_sha256"])
    if (
        p["development_ids"] != split["development_ids"]
        or p["development_ids_sha256"] != object_digest(split["development_ids"])
        or p["schema_sha256"] != protocol["schema_sha256"]
        or p["split_sha256"] != protocol["split_sha256"]
        or development["search"] != search
    ):
        raise ValueError("Development source/schema/split/search membership differs")
    if (
        p["libraries"] != {name: version(name) for name in LIBRARIES}
        or p["python"] != platform.python_version()
    ):
        raise ValueError("Runtime libraries differ from frozen development environment")
    if search["access_lock_file_sha256"] != protocol["access_lock_sha256"]:
        raise ValueError("Search source-access fingerprint differs")
    models, checksums = {}, {}
    with no_fitting():
        for target, (family, _) in EXPECTED.items():
            path = development_dir / "models" / (target + ".joblib")
            metadata = read_json(path.with_suffix(".json"))
            sha = digest(path.read_bytes())
            selected = development["targets"][target]["selected_configuration"]
            if (
                sha != metadata["model_sha256"]
                or metadata["target"] != target
                or metadata["schema_sha256"] != protocol["schema_sha256"]
                or metadata["split_sha256"] != protocol["split_sha256"]
                or metadata["training_configuration_sha256"] != protocol["development_run_sha256"]
                or selected["candidate"] != protocol["frozen_candidates"][target]
                or metadata["selected_configuration"] != selected
            ):
                raise ValueError("Frozen model checksum/metadata differs: " + target)
            pipeline = joblib.load(path)  # Only trusted checksum-verified local artifacts.
            if not isinstance(pipeline, Pipeline) or list(pipeline.named_steps) != [
                "schema",
                "preprocess",
                "classifier",
            ]:
                raise ValueError("Unexpected frozen pipeline structure")
            guard, classifier = pipeline.named_steps["schema"], pipeline.named_steps["classifier"]
            expected_type = LogisticRegression if family == "logistic" else RandomForestClassifier
            if (
                not isinstance(classifier, expected_type)
                or classifier.classes_.tolist() != [0, 1]
                or classifier.get_params() != selected["estimator_parameters"]
                or guard.manifest != manifest
                or guard.schema_sha256 != protocol["schema_sha256"]
                or guard.fit_row_ids_ != split["development_ids"]
                or preprocessing_metadata(pipeline) != selected["preprocessing"]
            ):
                raise ValueError("Fitted pipeline/schema/parameters/membership differs: " + target)
            models[target], checksums[target] = pipeline, sha
    context = {
        "protocol": protocol,
        "protocol_sha256": digest(protocol_path.read_bytes()),
        "manifest": manifest,
        "split": split,
        "source_config": config,
        "development": development,
        "models": models,
        "model_checksums": checksums,
        "evaluator_files_sha256": evaluator_fingerprints(),
    }
    context["evaluation_configuration_sha256"] = object_digest(
        {
            "protocol_sha256": context["protocol_sha256"],
            "evaluator_files_sha256": context["evaluator_files_sha256"],
            "model_checksums": checksums,
        }
    )
    return context


def guard_path(root, split_sha):
    # One partition, one evaluation, even if someone changes code/config/run directory.
    return root / "artifacts/final_holdout/guards" / (split_sha + ".json")


def assert_not_reserved(root, split_sha):
    if guard_path(root, split_sha).exists():
        raise EvaluationRefused(
            "Final holdout already reserved/completed/failed. "
            "Use verify/status; no inference rerun permitted."
        )


def reserve(root, context):
    path = guard_path(root, context["protocol"]["split_sha256"])
    path.parent.mkdir(parents=True, exist_ok=True)
    evaluation_id = "final-v1-" + uuid.uuid4().hex
    reservation = {
        "status": "reserved",
        "evaluation_id": evaluation_id,
        "utc": utc_now(),
        "evaluation_configuration_sha256": context["evaluation_configuration_sha256"],
        "development_run_sha256": context["protocol"]["development_run_sha256"],
        "split_sha256": context["protocol"]["split_sha256"],
        "output_directory": "artifacts/final_holdout/" + evaluation_id,
    }
    try:
        with path.open("xb") as stream:
            stream.write(canonical_json(reservation))
            stream.flush()
            os.fsync(stream.fileno())
    except FileExistsError as error:
        raise EvaluationRefused(
            "Concurrent or earlier final evaluation reservation exists"
        ) from error
    fsync_directory(path.parent)
    return reservation


def fsync_directory(path):
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def publish_exclusive_json(path, value):
    pending = path.with_name("." + path.name + ".pending")
    write_json_once(pending, value)
    fsync_directory(path.parent)
    os.link(pending, path)  # Atomic, exclusive publication of fully fsynced bytes.
    pending.unlink()
    fsync_directory(path.parent)


def publish_success(root, out, record):
    path = out / "evaluation_record.json"
    publish_exclusive_json(path, record)
    receipt_path = guard_path(root, record["split_sha256"]).with_suffix(".completed.json")
    # A completed status requires this independent immutable checksum receipt.
    publish_exclusive_json(
        receipt_path,
        {
            "evaluation_id": record["evaluation_id"],
            "evaluation_record_sha256": digest(path.read_bytes()),
            "reservation_sha256": record["reservation_sha256"],
        },
    )


def run_evaluation(root: Path = ROOT) -> dict:
    # Check the permanent gate before deserializing models, much less reading outcomes.
    protocol = read_json(root / "config/final_evaluation_v1.json")
    assert_not_reserved(root, protocol["split_sha256"])
    context = preflight(root)
    protocol = context["protocol"]
    reservation = reserve(root, context)
    out = root / reservation["output_directory"]
    out.mkdir(parents=True, exist_ok=False)
    try:
        # Reservation is already durable before this sole real outcome-read path.
        data = load_reserved_holdout(
            root / "data/raw/uci-411" / context["source_config"]["workbook"],
            context["source_config"],
            context["manifest"],
            context["split"],
            protocol["holdout_records"],
            protocol["holdout_ids_sha256"],
        )
        if data.features.index.tolist() != context["split"][
            "holdout_ids"
        ] or not data.features.index.equals(data.targets.index):
            raise ValueError("Final input/target membership alignment differs")
        predictions = {"phase": "FINAL_HOLDOUT", "threshold": 0.5, "targets": {}}
        with no_fitting(), threadpool_limits(limits=1):
            for target, pipeline in context["models"].items():
                pipeline.named_steps["schema"].validate(data.features)
                probability = positive_probability(
                    pipeline, data.features
                )  # Exactly one call/target.
                predictions["targets"][target] = [
                    {
                        "row_id": row_id,
                        "label": int(data.targets.loc[row_id, target]),
                        "positive_probability": float(p),
                        "predicted_class": int(p >= 0.5),
                    }
                    for row_id, p in zip(data.features.index, probability, strict=True)
                ]
        # Save raw pairs promptly. All further metrics/uncertainty/plots use these pairs.
        write_json_once(out / "predictions.json", predictions)
        results = summarize_saved_predictions(predictions, protocol, context["development"])
        write_json_once(out / "results.json", results)
        write_json_once(out / "protocol.json", protocol)
        provenance = {
            "phase": "FINAL_HOLDOUT",
            "evaluation_id": reservation["evaluation_id"],
            "reservation_utc": reservation["utc"],
            "development_run_id": protocol["development_run_id"],
            "development_run_sha256": protocol["development_run_sha256"],
            "model_checksums": context["model_checksums"],
            "schema_sha256": protocol["schema_sha256"],
            "feature_manifest_sha256": protocol["schema_sha256"],
            "split_sha256": protocol["split_sha256"],
            "search_sha256": protocol["search_sha256"],
            "holdout_ids_sha256": protocol["holdout_ids_sha256"],
            "evaluator_files_sha256": context["evaluator_files_sha256"],
            "protocol_sha256": context["protocol_sha256"],
            "evaluation_configuration_sha256": context["evaluation_configuration_sha256"],
            "libraries": {name: version(name) for name in LIBRARIES},
            "python": platform.python_version(),
            "targets": protocol["targets"],
            "threshold": 0.5,
            "fitting_performed": False,
            "inference_calls_per_target": 1,
            "calibrated": False,
        }
        write_json_once(out / "provenance.json", provenance)
        from ml.holdout_plots import save_holdout_outputs

        save_holdout_outputs(out, results, context["evaluation_configuration_sha256"])
        # Recheck all immutable old artifacts and models before committing success.
        verify_locked_inputs(root, anatomy=True)
        hash_files(root, protocol["development_files_sha256"])
        files = {
            str(p.relative_to(out)): digest(p.read_bytes())
            for p in sorted(out.rglob("*"))
            if p.is_file()
        }
        record = {
            **provenance,
            "status": "completed",
            "completed_utc": utc_now(),
            "output_directory": reservation["output_directory"],
            "files_sha256": files,
            "predictions_sha256": files["predictions.json"],
            "results_sha256": files["results.json"],
            "reservation_sha256": digest(guard_path(root, protocol["split_sha256"]).read_bytes()),
        }
        # Success is published LAST. Any error/crash leaves a consumed reservation, not success.
        publish_success(root, out, record)
        return record
    except BaseException:
        if (out / "evaluation_record.json").exists():
            raise
        write_json_once(
            out / "failure.json",
            {
                "status": "failed",
                "utc": utc_now(),
                "evaluation_id": reservation["evaluation_id"],
                "success_published": False,
                "reason": (
                    "Evaluation failed or was interrupted; reservation remains consumed; "
                    "inspect traceback without re-running inference"
                ),
            },
        )
        fsync_directory(out)
        raise


def evaluation_status(root: Path = ROOT):
    protocol = read_json(root / "config/final_evaluation_v1.json")
    path = guard_path(root, protocol["split_sha256"])
    if not path.exists():
        return {"status": "not_started"}
    reservation = read_json(path)
    out = root / reservation["output_directory"]
    completed = out / "evaluation_record.json"
    receipt_path = path.with_suffix(".completed.json")
    if completed.exists() and receipt_path.exists():
        receipt = read_json(receipt_path)
        if (
            digest(completed.read_bytes()) != receipt["evaluation_record_sha256"]
            or digest(path.read_bytes()) != receipt["reservation_sha256"]
            or reservation["evaluation_id"] != receipt["evaluation_id"]
        ):
            raise ValueError("Completed evaluation receipt fingerprint differs")
        return read_json(completed)
    failed = out / "failure.json"
    return (
        read_json(failed)
        if failed.exists()
        else {**reservation, "status": "reserved_or_interrupted"}
    )


def verify_evaluation(root: Path = ROOT) -> dict:
    """Recompute everything from saved pairs only; no model load or workbook decoding."""
    status = evaluation_status(root)
    if status["status"] != "completed":
        raise ValueError("No completed final evaluation to verify")
    protocol = read_json(root / "config/final_evaluation_v1.json")
    if status["libraries"] != {name: version(name) for name in LIBRARIES}:
        raise ValueError("Verification library versions differ")
    out = root / status["output_directory"]
    hash_files(out, status["files_sha256"])
    if (
        digest(guard_path(root, status["split_sha256"]).read_bytes())
        != status["reservation_sha256"]
        or digest((root / "config/final_evaluation_v1.json").read_bytes())
        != status["protocol_sha256"]
        or evaluator_fingerprints() != status["evaluator_files_sha256"]
    ):
        raise ValueError("Reservation/protocol/evaluator fingerprint differs")
    verify_locked_inputs(root, anatomy=True)  # Opaque source bytes only.
    hash_files(root, protocol["development_files_sha256"])
    if (
        status["threshold"] != 0.5
        or status["targets"] != protocol["targets"]
        or status["holdout_ids_sha256"] != protocol["holdout_ids_sha256"]
    ):
        raise ValueError("Evaluation metadata scope differs")
    development = read_json(root / protocol["development_directory"] / "results.json")
    predicted = read_json(out / "predictions.json")
    expected = read_json(out / "results.json")
    actual = summarize_saved_predictions(predicted, protocol, development)
    # Canonical saved pairs, seed and locked environment produce the same JSON numbers.
    if object_digest(expected) != object_digest(actual):
        raise ValueError("Saved pairs do not reproduce all metrics/curves/uncertainty/comparisons")
    return {
        "verified": True,
        "evaluation_id": status["evaluation_id"],
        "source": "saved prediction pairs only; no holdout inference or target-cell decoding",
        "phase_one_unchanged": True,
        "development_artifacts_unchanged": True,
        "model_checksums_unchanged": True,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["check", "run", "verify", "status"])
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    try:
        if args.command == "check":
            context = preflight(args.root)
            result = {
                "ready": True,
                "holdout_labels_accessed": False,
                "evaluation_configuration_sha256": context["evaluation_configuration_sha256"],
            }
        elif args.command == "run":
            result = run_evaluation(args.root)
        elif args.command == "verify":
            result = verify_evaluation(args.root)
        else:
            result = evaluation_status(args.root)
    except EvaluationRefused as error:
        parser.exit(2, str(error) + "\n")
    print(__import__("json").dumps(result, indent=2))


if __name__ == "__main__":
    main()

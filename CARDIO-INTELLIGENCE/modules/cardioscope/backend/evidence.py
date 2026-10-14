"""Read-only presentation of completed, fingerprint-verified evaluation outputs.

No dataset decoding, inference, fitting, metric computation or evaluation is
performed here. Patient-level saved prediction pairs are never served.
"""

from pathlib import Path

from backend.explanations import ExplanationService
from ml.common import digest, read_json
from ml.evaluate_holdout import evaluation_status


def application_metadata(inference, root: Path) -> dict:
    # Constructor verifies the pinned configuration/runtime/background identities;
    # it does not import SHAP, transform data or construct an explainer.
    explanations = ExplanationService(inference, root)
    return {
        "model_version": inference.version,
        "schema_fingerprint": inference.protocol["schema_sha256"],
        "model_checksums": inference.checksums,
        "explanation_configuration_fingerprint": explanations.fingerprint,
        "background_fingerprint": explanations.config["background_file_sha256"],
    }


def saved_evidence(inference, root: Path) -> dict:
    record = evaluation_status(root)  # Verifies the durable completion receipt.
    if (
        record.get("status") != "completed"
        or record["model_checksums"] != inference.checksums
        or record["schema_sha256"] != inference.protocol["schema_sha256"]
        or record["development_run_sha256"] != inference.protocol["development_run_sha256"]
        or record["threshold"] != 0.5
        or record["fitting_performed"] is not False
    ):
        raise ValueError("Saved evidence identity differs from the application")
    relative = Path(record["output_directory"]) / "results.json"
    path = root / relative
    if (
        digest(path.read_bytes()) != record["results_sha256"]
        or record["files_sha256"]["results.json"] != record["results_sha256"]
    ):
        raise ValueError("Saved final evidence checksum differs")
    results = read_json(path)
    if results["phase"] != "FINAL_HOLDOUT" or results["threshold"] != 0.5:
        raise ValueError("Evidence is not the completed final holdout")
    targets = {}
    for target, definition in inference.protocol["targets"].items():
        saved = results["targets"][target]
        if (
            saved["encoding"] != definition
            or saved["frozen_candidate"] != inference.protocol["frozen_candidates"][target]
            or saved["metrics"]["threshold"] != 0.5
            or sum(saved["metrics"]["class_counts"].values()) != 61
            or saved["development_comparison"]["roc_auc"]["final_holdout"]
            != saved["metrics"]["roc_auc"]
        ):
            raise ValueError("Target evidence contract differs: " + target)
        # Exact saved values, including uncertainty and nested selection-procedure
        # comparisons. No rounding, recomputation, rankings or patient records.
        targets[target] = {
            "definition": definition,
            "model": saved["frozen_candidate"],
            "metrics": saved["metrics"],
            "uncertainty": saved["uncertainty"],
            "development_roc_auc": saved["development_comparison"]["roc_auc"],
        }
    return {
        "phase": "FINAL_HOLDOUT",
        "evaluation_id": record["evaluation_id"],
        "completed_utc": record["completed_utc"],
        "records": {"total": 303, "development": 242, "holdout": 61},
        "threshold": 0.5,
        "nested_cv": {"outer": 5, "inner": 3},
        "model_version": inference.version,
        "schema_version": inference.manifest.schema_version,
        "schema_fingerprint": record["schema_sha256"],
        "development_run_id": record["development_run_id"],
        "targets": targets,
        "source": {"path": str(relative), "sha256": record["results_sha256"]},
    }

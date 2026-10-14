"""Presentation reads saved aggregates only; never evaluates or fits anything."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sklearn.pipeline import Pipeline

from backend.app import create_app
from backend.evidence import application_metadata, saved_evidence
from backend.explanations import ExplanationService
from ml.common import ROOT, read_json
from ml.evaluate_holdout import evaluation_status


@pytest.fixture(scope="module")
def app():
    return create_app(ROOT)


def test_evidence_is_exact_completed_final_aggregate(app):
    service = app.state.inference
    record = evaluation_status(ROOT)
    results = read_json(ROOT / record["output_directory"] / "results.json")
    with (
        patch.object(Pipeline, "fit", side_effect=AssertionError("No fitting")),
        patch.object(Pipeline, "predict_proba", side_effect=AssertionError("No inference")),
        patch("ml.evaluate_holdout.run_evaluation", side_effect=AssertionError("No evaluation")),
        patch("ml.evaluate_holdout.load_reserved_holdout", side_effect=AssertionError("No labels")),
    ):
        evidence = saved_evidence(service, ROOT)
    assert evidence["phase"] == "FINAL_HOLDOUT"
    assert evidence["records"] == {"total": 303, "development": 242, "holdout": 61}
    assert evidence["evaluation_id"] == record["evaluation_id"]
    assert evidence["source"]["sha256"] == record["results_sha256"]
    matrices = {
        "CAD": [[13, 5], [4, 39]],
        "LAD": [[16, 12], [5, 28]],
        "LCX": [[32, 5], [19, 5]],
        "RCA": [[35, 5], [15, 6]],
    }
    for target, data in evidence["targets"].items():
        saved = results["targets"][target]
        assert data["metrics"] == saved["metrics"]
        assert data["uncertainty"] == saved["uncertainty"]
        assert data["development_roc_auc"] == saved["development_comparison"]["roc_auc"]
        assert data["metrics"]["roc_auc"] == data["development_roc_auc"]["final_holdout"]
        assert (
            data["metrics"]["roc_auc"] != data["development_roc_auc"]["development_nested_cv_mean"]
        )
        assert data["model"] == service.protocol["frozen_candidates"][target]
        assert data["metrics"]["confusion_matrix"] == matrices[target]
        assert data["definition"]["positive_class"] == ("CAD" if target == "CAD" else "Stenotic")
        assert "curves" not in data  # No need to expose unused bulk evidence.
    assert "predictions" not in evidence
    assert "row_id" not in str(evidence)


def test_metadata_pins_exact_unchanged_explanation_identity_without_computation(app):
    inference = app.state.inference
    with patch.object(ExplanationService, "_explainer", side_effect=AssertionError("No SHAP")):
        metadata = application_metadata(inference, ROOT)
        response = TestClient(app).get("/api/metadata")
    assert response.status_code == 200
    assert response.json() == metadata
    explanation = ExplanationService(inference, ROOT)
    assert metadata["explanation_configuration_fingerprint"] == explanation.fingerprint
    assert metadata["background_fingerprint"] == explanation.config["background_file_sha256"]
    assert metadata["model_checksums"] == inference.checksums
    assert metadata["model_version"] == inference.version


def test_evidence_endpoint_rejects_changed_aggregate_without_partial_metrics(app):
    client = TestClient(app)
    assert client.get("/api/evidence").status_code == 200
    with patch("backend.evidence.digest", return_value="0" * 64):
        response = client.get("/api/evidence")
    assert response.status_code == 503
    assert "targets" not in response.json()
    assert client.get("/api/health").json()["models_loaded"] is True


def test_evidence_rejects_mismatched_model_identity(app):
    record = evaluation_status(ROOT)
    record["model_checksums"]["RCA"] = "0" * 64
    with patch("backend.evidence.evaluation_status", return_value=record):
        with pytest.raises(ValueError, match="identity"):
            saved_evidence(app.state.inference, ROOT)

"""Runtime failures/privacy and frozen-boundary tests; never mutate the real artifacts."""

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.inference import InferenceService
from ml.common import ROOT


def test_missing_and_corrupt_models_fail_without_disclosing_paths():
    for error in (
        FileNotFoundError("/private/example/model.joblib"),
        ValueError("checksum mismatch"),
    ):
        with patch("backend.app.InferenceService", side_effect=error):
            client = TestClient(create_app(ROOT))
        assert not client.get("/api/health").json()["models_loaded"]
        response = client.post("/api/predict", json={"features": {}})
        assert response.status_code == 503
        assert "/private/" not in response.text
        assert "outputs" not in response.json()


def test_error_and_prediction_privacy_headers_and_constrained_cors(tmp_path):
    client = TestClient(create_app(tmp_path))
    for route in ("/api/health", "/api/schema", "/api/anatomy", "/api/unknown"):
        r = client.get(route)
        assert r.headers["cache-control"] == "no-store"
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.headers["x-frame-options"] == "DENY"
        assert "connect-src 'self'" in r.headers["content-security-policy"]
        assert "access-control-allow-origin" not in r.headers
    r = client.options(
        "/api/predict",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert "access-control-allow-origin" not in r.headers
    r = client.post("/api/predict", json={"features": {"Age": {"sensitive": "never echo me"}}})
    assert r.status_code == 422
    assert "never echo me" not in r.text


def test_corrupt_anatomy_manifest_is_explicit(tmp_path):
    folder = tmp_path / "assets/anatomy"
    folder.mkdir(parents=True)
    (folder / "manifest.json").write_text("{bad JSON")
    r = TestClient(create_app(tmp_path)).get("/api/anatomy")
    assert r.status_code == 503
    assert "Verified anatomy manifest unavailable" in r.text
    assert str(tmp_path) not in r.text


@pytest.mark.parametrize("failure", ["configuration", "runtime"])
def test_explanation_failures_keep_prediction_valid_and_do_not_echo_profile(failure):
    client = TestClient(create_app(ROOT))
    features = client.get("/api/examples").json()["examples"][0]["features"]
    prediction = client.post("/api/predict", json={"features": features}).json()
    target = "RCA"
    body = dict(
        features=features,
        target=target,
        probability=prediction["outputs"][target]["probability"],
        profile_fingerprint=prediction["profile_fingerprint"],
        model_version=prediction["model_version"],
        schema_fingerprint=prediction["schema_fingerprint"],
        model_sha256=prediction["outputs"][target]["model_sha256"],
    )
    error = (
        ValueError("Corrupt explanation config /private/file")
        if failure == "configuration"
        else ImportError("shap unavailable")
    )
    with patch("backend.app.ExplanationService", side_effect=error):
        r = client.post("/api/explain", json=body)
    assert r.status_code == 503
    assert "numerical predictions remain valid" in r.text
    assert "/private/" not in r.text
    assert "contributions" not in r.json()
    assert client.post("/api/predict", json={"features": features}).json() == prediction


def test_all_protected_files_are_byte_identical():
    import hashlib

    manifest = json.loads((ROOT / "docs/product/IMMUTABLE_INPUTS.json").read_text())
    for relative, sha in manifest.items():
        assert hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() == sha, relative


def test_completed_application_never_invokes_holdout_or_training():
    with (
        patch("ml.holdout_data.load_reserved_holdout", side_effect=AssertionError("No holdout")),
        patch("ml.evaluate_holdout.run_evaluation", side_effect=AssertionError("No evaluation")),
        patch("sklearn.pipeline.Pipeline.fit", side_effect=AssertionError("No fitting")),
    ):
        service = InferenceService(ROOT)
        from backend.contracts import ProfileRequest

        assert set(
            service.predict(ProfileRequest(features=service.examples[0]["features"]))["outputs"]
        ) == {"CAD", "LAD", "LCX", "RCA"}

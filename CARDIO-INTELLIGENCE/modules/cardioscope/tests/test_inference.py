"""Real frozen inference on development examples only; no training/holdout inference."""

import copy
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sklearn.pipeline import Pipeline

from backend.app import create_app
from backend.contracts import ProfileRequest
from backend.inference import InferenceService
from ml.common import ROOT, digest, object_digest, read_json
from ml.evaluate_holdout import EXPECTED


@pytest.fixture(scope="module")
def service():
    return InferenceService(ROOT)


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app(ROOT))


def test_exact_frozen_models_schema_positive_orientation_and_no_fitting(service):
    protocol = read_json(ROOT / "config/final_evaluation_v1.json")
    split = read_json(ROOT / "artifacts/data/split.json")
    assert set(service.models) == set(EXPECTED)
    for target, pipeline in service.models.items():
        path = ROOT / protocol["development_directory"] / "models" / f"{target}.joblib"
        assert digest(path.read_bytes()) == service.checksums[target]
        assert (
            service.checksums[target]
            == protocol["development_files_sha256"][str(path.relative_to(ROOT))]
        )
        assert pipeline.named_steps["classifier"].classes_.tolist() == [0, 1]
        assert pipeline.named_steps["schema"].fit_row_ids_ == split["development_ids"]
    example = service.examples[0]
    with patch.object(Pipeline, "fit", side_effect=AssertionError("Must never fit")):
        result = service.predict(ProfileRequest(features=example["features"]))
    assert result["threshold"] == 0.5
    assert result["schema_fingerprint"] == protocol["schema_sha256"]
    assert result["profile_fingerprint"] == object_digest(example["features"])
    assert result["development_run_fingerprint"] == protocol["development_run_sha256"]
    assert result["model_version"] == service.version
    assert result["feature_manifest_fingerprint"] == result["schema_fingerprint"]
    for target, output in result["outputs"].items():
        assert output["positive"] == (output["probability"] >= 0.5)
        assert output["status"] == (output["positive_class"] if output["positive"] else "Normal")
        assert output["column"] == ("Cath" if target == "CAD" else target)


def test_example_is_complete_development_record_selected_without_outcomes(service, client):
    examples = client.get("/api/examples").json()["examples"]
    split = read_json(ROOT / "artifacts/data/split.json")
    assert len(examples) == 1
    example = examples[0]
    assert example["id"] == min(split["development_ids"])
    assert example["id"] not in split["holdout_ids"]
    assert example["label"] == "Public dataset example — not a real current patient"
    assert set(example["features"]) == set(service.manifest.feature_order)
    assert set(example["features"]).isdisjoint({"Cath", "LAD", "LCX", "RCA"})
    assert client.get("/api/health").json()["models_loaded"] is True
    assert "missed 19/24" in client.get("/api/model-information").text


def test_all_four_outputs_use_one_ordered_profile_and_positive_column(service):
    example = service.examples[0]["features"]
    expected = {"CAD": 0.5, "LAD": 0.01, "LCX": 0.99, "RCA": 0.31}
    seen = []
    import numpy as np

    for target, pipeline in service.models.items():

        def predictor(X, target=target):
            assert X.shape == (1, 55)
            assert X.columns.tolist() == service.manifest.feature_order
            assert X.iloc[0].to_dict() == example
            seen.append(target)
            return np.array([[1 - expected[target], expected[target]]])

        pipeline._application_test_predictor = predictor
    try:
        with (
            patch.object(
                Pipeline, "predict_proba", lambda self, X: self._application_test_predictor(X)
            ),
            patch.object(Pipeline, "fit", side_effect=AssertionError("Must never fit")),
        ):
            result = service.predict(ProfileRequest(features=example))
        assert seen == ["CAD", "LAD", "LCX", "RCA"]
        assert {t: o["probability"] for t, o in result["outputs"].items()} == expected
        assert result["outputs"]["CAD"]["positive"] is True
    finally:
        for pipeline in service.models.values():
            del pipeline._application_test_predictor


@pytest.mark.parametrize(
    "kind",
    ["missing", "extra", "category", "numeric-string", "bool", "null", "fractional", "outer-extra"],
)
def test_api_rejects_invalid_values_without_coercion(client, service, kind):
    request = {"features": copy.deepcopy(service.examples[0]["features"])}
    if kind == "missing":
        request["features"].pop("Age")
    elif kind == "extra":
        request["features"]["Cath"] = "CAD"
    elif kind == "outer-extra":
        request["ignored"] = "forbidden"
    else:
        field, value = {
            "category": ("Sex", "Female"),
            "numeric-string": ("Age", "45"),
            "bool": ("Age", True),
            "null": ("Age", None),
            "fractional": ("Age", 42.5),
        }[kind]
        request["features"][field] = value
    for route in ("/api/profiles/validate", "/api/predict"):
        assert client.post(route, json=request).status_code == 422


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_nonfinite_rejected(service, client, value):
    import json

    features = {**service.examples[0]["features"], "BMI": value}
    with pytest.raises(ValueError, match="finite"):
        service.predict(ProfileRequest(features=features))
    response = client.post(
        "/api/predict",
        content=json.dumps({"features": features}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422


def test_deterministic_api_inference_and_changed_profile(client, service):
    features = service.examples[0]["features"]
    a = client.post("/api/predict", json={"features": features})
    b = client.post("/api/predict", json={"features": dict(reversed(list(features.items())))})
    assert a.status_code == 200 and a.json() == b.json()
    validation = client.post("/api/profiles/validate", json={"features": features}).json()
    assert validation["profile_fingerprint"] == a.json()["profile_fingerprint"]
    assert validation["model_version"] == a.json()["model_version"]
    assert validation["feature_manifest_sha256"] == a.json()["schema_fingerprint"]
    changed = client.post(
        "/api/predict", json={"features": {**features, "Age": features["Age"] + 1}}
    ).json()
    assert changed["profile_fingerprint"] != a.json()["profile_fingerprint"]
    assert changed["model_version"] == a.json()["model_version"]


@pytest.mark.parametrize(
    "message",
    [
        "Frozen model checksum/metadata differs",
        "Development run fingerprint differs",
        "Fitted pipeline/schema/parameters/membership differs",
    ],
)
def test_startup_integrity_failure_disables_predictions(monkeypatch, message):
    def reject(_root):
        raise ValueError(message)

    monkeypatch.setattr("backend.inference.preflight", reject)
    client = TestClient(create_app(ROOT))
    assert client.get("/api/health").json()["models_loaded"] is False
    from ml.development import load_safe_development

    features = load_safe_development(ROOT).features.iloc[0].to_dict()
    response = client.post("/api/predict", json={"features": features})
    assert response.status_code == 503
    assert "Frozen models unavailable" in response.json()["detail"]
    assert message not in response.json()["detail"]  # Internal errors can include private paths.
    assert client.get("/api/examples").status_code == 503


def test_prediction_failure_returns_no_partial_outputs(client):
    service = client.app.state.inference
    with patch.object(service.models["LCX"], "predict_proba", side_effect=ValueError("unexpected")):
        response = client.post("/api/predict", json={"features": service.examples[0]["features"]})
    assert response.status_code == 503
    assert "outputs" not in response.json()


@pytest.mark.parametrize(
    "file",
    [
        "artifacts/development/v1-bb08b3d0230a/models/CAD.joblib",
        "artifacts/data/feature_manifest.json",
        "config/model_search_v1.json",
    ],
)
def test_actual_application_preflight_rejects_private_tampered_copies(
    tmp_path, service, file, monkeypatch
):
    # All shared artifacts are read-only symlinks. Only the selected PRIVATE file
    # is copied and altered; the original repository files remain untouched.
    protocol = read_json(ROOT / "config/final_evaluation_v1.json")
    lock = read_json(ROOT / "config/development_access.json")
    provenance = read_json(ROOT / protocol["development_directory"] / "provenance.json")
    paths = set(lock["files"]) | set(protocol["development_files_sha256"])
    paths |= set(provenance["files_sha256"])
    paths |= {"config/development_access.json", "config/final_evaluation_v1.json"}
    for name in paths:
        destination = tmp_path / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        if name == file:
            destination.write_bytes((ROOT / name).read_bytes() + b"\nALTERED PRIVATE FIXTURE\n")
        else:
            destination.symlink_to(ROOT / name)

    def cannot_deserialize(*args, **kwargs):
        raise AssertionError("Fingerprint mismatch must fail before model deserialization")

    monkeypatch.setattr("joblib.load", cannot_deserialize)
    client = TestClient(create_app(tmp_path))
    assert client.get("/api/health").json()["models_loaded"] is False
    response = client.post("/api/predict", json={"features": service.examples[0]["features"]})
    assert response.status_code == 503
    assert (
        "changed" in response.json()["detail"] or "fingerprint differs" in response.json()["detail"]
    )

from fastapi.testclient import TestClient

from backend.app import create_app
from ml.common import write_json_once
from ml.data import feature_manifest, scalar


def client_with_schema(tmp_path, config, frame, source):
    write_json_once(tmp_path / "config/dataset.json", config)
    write_json_once(
        tmp_path / "artifacts/data/feature_manifest.json",
        feature_manifest(frame.iloc[:100], config, source),
    )
    return TestClient(create_app(tmp_path))


def profile(frame, config):
    return {"features": {name: scalar(frame.iloc[0][name]) for name in config["features"]}}


def test_health_and_missing_artifacts_are_explicit(tmp_path):
    client = TestClient(create_app(tmp_path))
    result = client.get("/api/health")
    assert result.status_code == 200
    assert result.json()["models_loaded"] is False
    assert result.json()["data_prepared"] is False
    assert client.get("/api/schema").status_code == 503
    assert client.get("/api/anatomy").status_code == 503


def test_schema_validation_and_unavailable_predictions(tmp_path, config, frame, source):
    client = client_with_schema(tmp_path, config, frame, source)
    manifest = client.get("/api/schema").json()
    assert manifest["targets"]["CAD"]["column"] == "Cath"
    assert len(manifest["features"]) == 55
    valid = profile(frame, config)
    response = client.post("/api/profiles/validate", json=valid)
    assert response.status_code == 200
    assert response.json()["model_version"] is None
    reordered = {"features": dict(reversed(list(valid["features"].items())))}
    assert client.post("/api/profiles/validate", json=reordered).json() == response.json()
    prediction = client.post("/api/predict", json=valid)
    assert prediction.status_code == 503
    assert "Frozen models unavailable" in prediction.json()["detail"]


def test_api_rejects_labels_unknown_categories_missing_values_and_coercion(
    tmp_path,
    config,
    frame,
    source,
):
    client = client_with_schema(tmp_path, config, frame, source)
    for field, value in [
        ("Cath", "CAD"),
        ("Age", "45"),
        ("Age", None),
        ("Age", True),
        ("Sex", "unknown"),
    ]:
        request = profile(frame, config)
        request["features"][field] = value
        assert client.post("/api/profiles/validate", json=request).status_code == 422
    incomplete = profile(frame, config)
    incomplete["features"].pop("Age")
    assert client.post("/api/profiles/validate", json=incomplete).status_code == 422


def test_raw_data_and_holdout_routes_are_not_exposed(tmp_path, config, frame, source):
    client = client_with_schema(tmp_path, config, frame, source)
    for route in ["/api/data", "/api/holdout", "/data/raw/uci-411/source.zip"]:
        assert client.get(route).status_code == 404


def test_built_frontend_served_without_swallowing_unknown_api(tmp_path):
    dist = tmp_path / "frontend/dist"
    dist.mkdir(parents=True)
    (dist / "index.html").write_text("<h1>CardioScope fixture</h1>")
    client = TestClient(create_app(tmp_path))
    assert client.get("/").status_code == 200
    assert "CardioScope fixture" in client.get("/").text
    assert client.get("/api/not-a-route").status_code == 404

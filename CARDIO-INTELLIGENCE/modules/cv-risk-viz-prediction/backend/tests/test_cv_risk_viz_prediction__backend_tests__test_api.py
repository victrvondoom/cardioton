# FastAPI endpoint tests using TestClient (real artifacts, real inference).
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BACKEND.parent))


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    from cv_risk_viz_prediction__backend__main import app

    with TestClient(app) as tc:
        yield tc


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["models_loaded"] is True


def test_schema(client):
    r = client.get("/api/schema")
    assert r.status_code == 200
    names = [f["feature"] for f in r.json()["features"]]
    assert not set(names) & {"LAD", "LCX", "RCA", "Cath"}


def test_predict(client):
    features = {
        "Age": 62, "Weight": 85, "Length": 172, "Sex": "Male", "BMI": 28.7,
        "DM": 1, "HTN": 1, "Current Smoker": 0, "EX-Smoker": 1, "FH": 0,
        "Obesity": "N", "CRF": "N", "CVA": "N", "Airway disease": "N",
        "Thyroid Disease": "N", "CHF": "N", "DLP": "Y", "BP": 145, "PR": 82,
        "Edema": 0, "Weak Peripheral Pulse": "N", "Lung rales": "N",
        "Systolic Murmur": "N", "Diastolic Murmur": "Y",
        "Typical Chest Pain": 1, "Dyspnea": "Y", "Function Class": 2,
        "Atypical": "N", "Nonanginal": "N", "Exertional CP": "N",
        "LowTH Ang": "N", "Q Wave": 0, "St Elevation": 0, "St Depression": 1,
        "Tinversion": 1, "LVH": "N", "Poor R Progression": "N", "BBB": "N",
        "FBS": 130, "CR": 1.2, "TG": 220, "LDL": 140, "HDL": 33, "BUN": 20,
        "ESR": 12, "HB": 14.0, "K": 4.3, "Na": 140, "WBC": 8000, "Lymph": 30,
        "Neut": 60, "PLT": 240, "EF-TTE": 45, "Region RWMA": 2, "VHD": "mild",
    }
    r = client.post("/api/predict", json={"features": features})
    assert r.status_code == 200
    body = r.json()
    assert len(body["predictions"]) == 4
    for p in body["predictions"]:
        assert 0.0 <= p["probability"] <= 1.0
    assert body["disclaimer"].startswith("Research")


def test_predict_rejects_forbidden(client):
    r = client.post("/api/predict", json={"features": {"LAD": "Stenotic"}})
    assert r.status_code == 422


def test_explain(client):
    features = {"Age": 62, "Weight": 85, "Length": 172, "Sex": "Male", "BMI": 28.7, "DM": 1,
                "HTN": 1, "Current Smoker": 0, "EX-Smoker": 1, "FH": 0, "Obesity": "N",
                "CRF": "N", "CVA": "N", "Airway disease": "N", "Thyroid Disease": "N",
                "CHF": "N", "DLP": "Y", "BP": 145, "PR": 82, "Edema": 0,
                "Weak Peripheral Pulse": "N", "Lung rales": "N", "Systolic Murmur": "N",
                "Diastolic Murmur": "Y", "Typical Chest Pain": 1, "Dyspnea": "Y",
                "Function Class": 2, "Atypical": "N", "Nonanginal": "N", "Exertional CP": "N",
                "LowTH Ang": "N", "Q Wave": 0, "St Elevation": 0, "St Depression": 1,
                "Tinversion": 1, "LVH": "N", "Poor R Progression": "N", "BBB": "N",
                "FBS": 130, "CR": 1.2, "TG": 220, "LDL": 140, "HDL": 33, "BUN": 20,
                "ESR": 12, "HB": 14.0, "K": 4.3, "Na": 140, "WBC": 8000, "Lymph": 30,
                "Neut": 60, "PLT": 240, "EF-TTE": 45, "Region RWMA": 2, "VHD": "mild"}
    r = client.post("/api/explain", json={"features": features, "target": "cad"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["contributions"]) > 0
    assert body["method"].startswith("shap")

"""Safe finished-app smoke check on one public DEVELOPMENT example, never the holdout."""

import json
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app import create_app
from ml.common import ROOT


def smoke():
    with (
        patch("ml.holdout_data.load_reserved_holdout", side_effect=AssertionError("No holdout")),
        patch("ml.evaluate_holdout.run_evaluation", side_effect=AssertionError("No evaluation")),
        patch("sklearn.pipeline.Pipeline.fit", side_effect=AssertionError("No fitting")),
    ):
        client = TestClient(create_app(ROOT))
        assert client.get("/api/health").json()["models_loaded"]
        example = client.get("/api/examples").json()["examples"][0]
        features = example["features"]
        response = client.post("/api/predict", json={"features": features})
        assert response.status_code == 200, response.text
        prediction = response.json()
        before = json.loads((ROOT / "docs/hardening/PERFORMANCE_BEFORE.json").read_text())
        checks = {}
        for target in ("CAD", "LAD", "LCX", "RCA"):
            p = prediction["outputs"][target]["probability"]
            assert abs(p - before["probabilities"][target]) <= 1e-12
            body = dict(
                features=features,
                target=target,
                probability=p,
                profile_fingerprint=prediction["profile_fingerprint"],
                model_version=prediction["model_version"],
                schema_fingerprint=prediction["schema_fingerprint"],
                model_sha256=prediction["outputs"][target]["model_sha256"],
            )
            r = client.post("/api/explain", json=body)
            assert r.status_code == 200, r.text
            explanation = r.json()
            assert len(explanation["contributions"]) == 55
            assert (
                abs(explanation["reconstruction_residual"])
                <= explanation["reconstruction_tolerance"]
            )
            checks[target] = dict(probability=p, residual=explanation["reconstruction_residual"])
        metadata = client.get("/api/metadata").json()
        baseline = json.loads((ROOT / "docs/hardening/BASELINE.json").read_text())
        for key in metadata:
            assert metadata[key] == baseline[key], key
        return dict(
            example_id=example["id"],
            targets=checks,
            identities_unchanged=True,
            holdout_inference=False,
            fitting=False,
        )


if __name__ == "__main__":
    print(json.dumps(smoke(), indent=2))

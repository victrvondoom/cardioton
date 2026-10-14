"""Real frozen positive-class explanations; only locked development features used."""

import copy
import math
from unittest.mock import patch

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sklearn.pipeline import Pipeline

from backend.app import create_app
from backend.contracts import ExplanationRequest, ProfileRequest
from backend.explanations import (
    BACKGROUND_SIZE,
    ExplanationService,
    aggregate_contributions,
    choose_background,
    encoded_groups,
    routing_equivalent_thresholds,
)
from backend.inference import InferenceService
from ml.common import ROOT, read_json
from ml.development import load_safe_development


@pytest.fixture(scope="module")
def services():
    inference = InferenceService(ROOT)
    return inference, ExplanationService(inference, ROOT)


def request_for(inference, features, target):
    prediction = inference.predict(ProfileRequest(features=features))
    return ExplanationRequest(
        features=features,
        target=target,
        probability=prediction["outputs"][target]["probability"],
        profile_fingerprint=prediction["profile_fingerprint"],
        model_version=prediction["model_version"],
        schema_fingerprint=prediction["schema_fingerprint"],
        model_sha256=prediction["outputs"][target]["model_sha256"],
    )


def test_development_only_deterministic_background(services):
    inference, explanations = services
    split = read_json(ROOT / "artifacts/data/split.json")
    ids = choose_background(split["development_ids"])
    assert len(ids) == BACKGROUND_SIZE == 100
    assert ids == choose_background(list(reversed(split["development_ids"])))
    assert set(ids) <= set(split["development_ids"])
    assert set(ids).isdisjoint(split["holdout_ids"])
    assert explanations.background["record_ids"] == ids
    with pytest.raises(ValueError):
        choose_background(ids)
    for pipeline in inference.models.values():
        assert pipeline.named_steps["schema"].fit_row_ids_ == split["development_ids"]


@pytest.mark.parametrize("target", ["CAD", "LAD", "LCX", "RCA"])
def test_multiple_real_profiles_reconstruction_positive_orientation_and_no_fit(services, target):
    inference, explanations = services
    development = load_safe_development(ROOT)
    # Selection by content IDs only, never by outcomes or explanation quality.
    ids = sorted(development.features.index)[::48][:6]
    with (
        patch.object(Pipeline, "fit", side_effect=AssertionError("No fitting")),
        patch(
            "ml.evaluate_holdout.run_evaluation",
            side_effect=AssertionError("No holdout evaluation"),
        ),
        patch("ml.holdout_data.load_reserved_holdout", side_effect=AssertionError("No holdout")),
    ):
        for record in ids:
            features = development.features.loc[record].to_dict()
            request = request_for(inference, features, target)
            result = explanations.explain(request)
            pipeline = inference.models[target]
            assert result["positive_class"] == ("CAD" if target == "CAD" else "Stenotic")
            assert result["probability"] == request.probability
            assert result["positive"] == (request.probability >= 0.5)
            assert result["threshold"] == 0.5
            assert result["model_sha256"] == inference.checksums[target]
            assert result["profile_fingerprint"] == request.profile_fingerprint
            assert result["model_version"] == request.model_version
            assert result["schema_fingerprint"] == request.schema_fingerprint
            assert len(result["contributions"]) == 55
            assert [
                c["feature"] for c in result["contributions"]
            ] == inference.manifest.feature_order
            assert all(c["value"] == features[c["feature"]] for c in result["contributions"])
            assert all(c["unit"] is None for c in result["contributions"])
            assert (
                math.fsum(c["contribution"] for c in result["contributions"])
                == result["total_contribution"]
            )
            assert abs(result["encoded_contribution_sum"] - result["total_contribution"]) < 1e-12
            assert abs(result["reconstruction_residual"]) <= result["reconstruction_tolerance"]
            assert result["remaining_factor_contribution"] == 0
            if target in ("CAD", "LAD"):
                assert result["output_space"] == "log_odds"
                assert result["contribution_units"] == "model log-odds"
                encoded = pipeline[:-1].transform(development.features.loc[[record]])[0]
                reference = pipeline[:-1].transform(explanations._reference()).mean(axis=0)
                coef = pipeline.named_steps["classifier"].coef_[0]
                expected = aggregate_contributions(
                    encoded_groups(pipeline),
                    coef * (encoded - reference),
                    inference.manifest.feature_order,
                )
                assert np.allclose(
                    list(expected.values()),
                    [c["contribution"] for c in result["contributions"]],
                    atol=1e-12,
                )
            else:
                assert result["output_space"] == "probability"
                assert result["contribution_units"] == "probability units"
                assert abs(result["reconstructed_output"] - request.probability) < 1e-6
            explanations.cache.clear()
            assert explanations.explain(request) == result  # Recomputed, not just cache equality.


def test_threshold_adapter_exact_routing_for_float32_inputs():
    # RCA tree 4 has this midpoint; rounding UP changed the branch in vanilla SHAP.
    thresholds = np.array([14.099999904632568, 4.1499998569488525, 0.5, 36.5])
    adapted = routing_equivalent_thresholds(thresholds)
    for old, new in zip(thresholds, adapted, strict=True):
        at = np.float32(old)
        inputs = np.array(
            [np.nextafter(at, np.float32(-np.inf)), at, np.nextafter(at, np.float32(np.inf))],
            dtype=np.float32,
        ).astype(np.float64)
        assert np.array_equal(inputs <= old, inputs <= new)
    assert adapted[0] < np.float32(thresholds[0])


def test_grouping_aggregation_preserves_sum():
    grouped = aggregate_contributions(
        ["Sex", "Sex", "Age"], np.array([0.2, -0.3, 0.4]), ["Age", "Sex"]
    )
    assert grouped["Sex"] == pytest.approx(-0.1)
    assert math.fsum(grouped.values()) == pytest.approx(0.3)
    with pytest.raises(ValueError):
        aggregate_contributions(["Sex"], [float("nan")], ["Sex"])


def test_cached_copy_exact_key_and_identity_rejection(services):
    inference, explanations = services
    req = request_for(inference, inference.examples[0]["features"], "CAD")
    original = explanations.explain(req)
    mutated = explanations.explain(req)
    mutated["contributions"][0]["contribution"] = 999
    assert explanations.explain(req) == original
    for name in ("profile_fingerprint", "model_version", "schema_fingerprint", "model_sha256"):
        bad = req.model_copy(update={name: "0" * 64})
        with pytest.raises(ValueError, match="identity"):
            explanations.explain(bad)
    with pytest.raises(ValueError, match="displayed prediction"):
        explanations.explain(req.model_copy(update={"probability": 0.999}))


def test_failed_reconstruction_returns_no_explanation(services):
    inference, explanations = services
    request = request_for(inference, inference.examples[0]["features"], "RCA")
    explanations.cache.clear()
    explainer = explanations._explainer("RCA")
    original = explainer.shap_values

    def broken(*args, **kwargs):
        return original(*args, **kwargs) + 0.01

    with patch.object(explainer, "shap_values", broken):
        with pytest.raises(RuntimeError, match="reconstruction failed"):
            explanations.explain(request)
    assert not explanations.cache


def test_api_malformed_inputs_identity_and_independent_failure(services):
    inference, _ = services
    app = create_app(ROOT)
    client = TestClient(app)
    request = request_for(inference, inference.examples[0]["features"], "LAD").model_dump()
    good = client.post("/api/explain", json=request)
    assert good.status_code == 200
    for field, value in (
        ("target", "Normal"),
        ("model_version", "0" * 64),
        ("probability", "0.2"),
        ("target", "Cath"),
    ):
        assert client.post("/api/explain", json={**request, field: value}).status_code == 422
    for mutation in (
        lambda f: f.pop("Age"),
        lambda f: f.update(Cath="CAD"),
        lambda f: f.update(Sex="Female"),
    ):
        features = copy.deepcopy(request["features"])
        mutation(features)
        assert (
            client.post("/api/explain", json={**request, "features": features}).status_code == 422
        )
    with patch.object(app.state.explanations, "explain", side_effect=RuntimeError("additivity")):
        failed = client.post("/api/explain", json=request)
        assert failed.status_code == 503 and "predictions remain valid" in failed.text
        assert (
            client.post("/api/predict", json={"features": request["features"]}).status_code == 200
        )

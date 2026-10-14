"""Benchmark verified explanations on deterministic development profiles only.

Never trains, reads holdout outcomes, or invokes final evaluation. Timings are
local backend wall time, not network/browser timings or performance evidence.
"""

import json
import platform
from time import perf_counter

import numpy as np

from backend.contracts import ExplanationRequest, ProfileRequest
from backend.explanations import ExplanationService
from backend.inference import InferenceService
from ml.common import ROOT, object_digest
from ml.data import scalar
from ml.development import load_safe_development


def benchmark(root=ROOT):
    inference = InferenceService(root)
    explanations = ExplanationService(inference, root)
    development = load_safe_development(root)
    example = inference.examples[0]
    others = [record for record in sorted(development.features.index) if record != example["id"]]
    ids = [example["id"], *others[::48][:5]]
    profiles = [
        {name: scalar(value) for name, value in development.features.loc[record].items()}
        for record in ids
    ]
    predictions = [inference.predict(ProfileRequest(features=f)) for f in profiles]

    def request(index, target):
        p = predictions[index]
        return ExplanationRequest(
            features=profiles[index],
            target=target,
            probability=p["outputs"][target]["probability"],
            profile_fingerprint=p["profile_fingerprint"],
            model_version=p["model_version"],
            schema_fingerprint=p["schema_fingerprint"],
            model_sha256=p["outputs"][target]["model_sha256"],
        )

    def timed(req):
        started = perf_counter()
        result = explanations.explain(req)
        return (perf_counter() - started) * 1000, result

    def summarize(values):
        return {
            "median_ms": float(np.median(values)),
            "p95_ms": float(np.percentile(values, 95)),
            "samples": len(values),
        }

    results = {}
    for target in inference.models:
        cold, example_result = timed(request(0, target))
        uncached, cached, residuals = [], [], []
        for _ in range(5):
            for index in range(len(profiles)):
                req = request(index, target)
                explanations.cache.clear()
                elapsed, result = timed(req)
                uncached.append(elapsed)
                residuals.append(abs(result["reconstruction_residual"]))
                elapsed, _ = timed(req)
                cached.append(elapsed)
        top = sorted(
            example_result["contributions"], key=lambda c: abs(c["contribution"]), reverse=True
        )[:5]
        results[target] = {
            "cold_first_ms": cold,
            "warm_uncached": summarize(uncached),
            "warm_cached": summarize(cached),
            "maximum_absolute_reconstruction_residual": max(residuals),
            "example": {
                key: example_result[key]
                for key in (
                    "probability",
                    "baseline",
                    "explained_output",
                    "reconstruction_residual",
                    "output_space",
                )
            },
            "example_top_absolute_contributions": top,
        }
    return {
        "scope": "development-only; backend wall time; no fitting or holdout inference",
        "hardware": platform.platform(),
        "python": platform.python_version(),
        "profile_selection": (
            "existing example plus every 48th sorted remaining development ID, first five"
        ),
        "record_ids": ids,
        "record_ids_sha256": object_digest(ids),
        "repetitions_per_profile": 5,
        "cold_definition": (
            "first call per target in fresh process; CAD also includes SHAP import/reference load"
        ),
        "warm_definition": (
            "uncached computation after explainer creation; cached reported separately"
        ),
        "configuration_fingerprint": explanations.fingerprint,
        "model_version": inference.version,
        "targets": results,
    }


if __name__ == "__main__":
    print(json.dumps(benchmark(), sort_keys=True, indent=2))

"""Positive-class SHAP of unchanged fitted pipelines; development-only reference."""

import argparse
import copy
import math
from collections import OrderedDict
from importlib.metadata import version
from pathlib import Path
from threading import Lock

import numpy as np
import pandas as pd
from scipy.special import expit
from threadpoolctl import threadpool_limits

from backend.contracts import ProfileRequest, validate_profile
from ml.common import ROOT, digest, object_digest, read_json, write_json_once
from ml.data import scalar
from ml.development import load_safe_development
from ml.evaluate_holdout import no_fitting
from ml.models import positive_probability

SEED = 20261002
BACKGROUND_SIZE = 100
LOGIT_TOLERANCE = 1e-10
PROBABILITY_TOLERANCE = 1e-6
BACKGROUND_PATH = "artifacts/explanations/v1/background.json"
CONFIG_PATH = "config/explanations_v1.json"
TREE_INPUT_DTYPE = np.float32  # Frozen sklearn 1.9.1 forest/tree prediction validators.


def choose_background(ids):
    ordered = sorted(ids)
    if len(ordered) != 242 or len(set(ordered)) != 242:
        raise ValueError("Background requires the 242 locked development records")
    return sorted(
        np.random.default_rng(SEED).choice(ordered, BACKGROUND_SIZE, replace=False).tolist()
    )


def background_values(frame):
    return {
        record: {name: scalar(value) for name, value in row.items()}
        for record, row in frame.iterrows()
    }


def prepare(root: Path = ROOT):
    from backend.inference import InferenceService

    service = InferenceService(root)
    development = load_safe_development(root)
    ids = choose_background(development.features.index)
    background = {
        "version": 1,
        "partition": "development",
        "seed": SEED,
        "record_count": BACKGROUND_SIZE,
        "selection": (
            "NumPy default_rng(seed).choice(sorted development IDs, 100, replace=False); "
            "sort selected IDs"
        ),
        "record_ids": ids,
        "record_ids_sha256": object_digest(ids),
        "development_ids_sha256": object_digest(development.features.index.tolist()),
        "feature_values_sha256": object_digest(background_values(development.features.loc[ids])),
        "schema_sha256": service.protocol["schema_sha256"],
        "model_version": service.version,
    }
    write_json_once(root / BACKGROUND_PATH, background)
    config = {
        "version": 1,
        "background_file": BACKGROUND_PATH,
        "background_file_sha256": digest((root / BACKGROUND_PATH).read_bytes()),
        "shap_version": "0.52.0",
        "numba_version": "0.68.0",
        "llvmlite_version": "0.50.0",
        "runtime_lock_sha256": digest((root / "config/explanations-runtime.lock.txt").read_bytes()),
        "methods": {
            "CAD": "LinearExplainer",
            "LAD": "LinearExplainer",
            "LCX": "TreeExplainer",
            "RCA": "TreeExplainer",
        },
        "feature_perturbation": "interventional",
        "tree_input_dtype": "float32 (the frozen sklearn tree classifier input dtype)",
        "tree_threshold_adapter": "floor-to-float32-preserves-sklearn-routing-v1",
        "approximate": False,
        "logit_tolerance": LOGIT_TOLERANCE,
        "probability_tolerance": PROBABILITY_TOLERANCE,
        "cache_capacity": 128,
    }
    write_json_once(root / CONFIG_PATH, config)
    return background


def routing_equivalent_thresholds(thresholds):
    """SHAP's interventional C++ Node stores float thresholds; sklearn stores doubles.

    sklearn first casts each input to float32. The largest float32 <= its saved
    threshold therefore preserves every possible branch decision, including for
    coalition inputs. Never change the saved classifier or leaf values.
    """
    thresholds = np.asarray(thresholds, dtype=np.float64)
    rounded = thresholds.astype(np.float32)
    return np.where(
        rounded.astype(np.float64) > thresholds,
        np.nextafter(rounded, np.float32(-np.inf)),
        rounded,
    ).astype(np.float64)


def encoded_groups(pipeline):
    """Map actual fitted transformer output positions, never split guessed names."""
    processor = pipeline.named_steps["preprocess"]
    numeric = list(processor.transformers_[0][2])
    categorical = list(processor.transformers_[1][2])
    encoder = processor.named_transformers_["categorical"]
    if encoder.drop is not None or encoder.get_params()["min_frequency"] is not None:
        raise ValueError("Unexpected one-hot grouping; frozen encoder must not drop/group levels")
    names = numeric + [
        name
        for name, categories in zip(categorical, encoder.categories_, strict=True)
        for _ in categories
    ]
    if len(names) != len(processor.get_feature_names_out()):
        raise ValueError("Encoded feature mapping is incomplete")
    if processor.output_indices_["numeric"] != slice(0, len(numeric)) or processor.output_indices_[
        "categorical"
    ] != slice(len(numeric), len(names)):
        raise ValueError("Fitted output order differs from encoded mapping")
    return names


def aggregate_contributions(names, values, feature_order):
    if (
        len(names) != len(values)
        or set(names) != set(feature_order)
        or not np.isfinite(values).all()
    ):
        raise ValueError("Invalid encoded contributions")
    grouped = {
        name: math.fsum(float(v) for n, v in zip(names, values, strict=True) if n == name)
        for name in feature_order
    }
    if not math.isclose(
        math.fsum(grouped.values()), math.fsum(values), abs_tol=1e-12, rel_tol=1e-12
    ):
        raise ValueError("Aggregation failed to preserve the contribution sum")
    return grouped


class ExplanationService:
    def __init__(self, inference, root: Path = ROOT):
        self.inference, self.root = inference, root
        self.lock = Lock()
        self.config = read_json(root / CONFIG_PATH)
        self.background = read_json(root / BACKGROUND_PATH)
        if (
            self.config["version"] != 1
            or self.config["background_file"] != BACKGROUND_PATH
            or self.config["background_file_sha256"]
            != digest((root / BACKGROUND_PATH).read_bytes())
            or self.config["runtime_lock_sha256"]
            != digest((root / "config/explanations-runtime.lock.txt").read_bytes())
            or self.config["methods"]
            != {
                "CAD": "LinearExplainer",
                "LAD": "LinearExplainer",
                "LCX": "TreeExplainer",
                "RCA": "TreeExplainer",
            }
            or self.config["tree_threshold_adapter"]
            != "floor-to-float32-preserves-sklearn-routing-v1"
            or self.config["cache_capacity"] != 128
            or self.background["seed"] != SEED
            or self.background["record_count"] != BACKGROUND_SIZE
            or self.config["feature_perturbation"] != "interventional"
            or self.config["approximate"] is not False
            or self.config["logit_tolerance"] != LOGIT_TOLERANCE
            or self.config["probability_tolerance"] != PROBABILITY_TOLERANCE
            or self.background["model_version"] != inference.version
            or self.background["schema_sha256"] != inference.protocol["schema_sha256"]
        ):
            raise ValueError("Explanation configuration/background identity differs")
        for package in ("shap", "numba", "llvmlite"):
            if version(package) != self.config[package + "_version"]:
                raise ValueError("Explanation runtime version differs: " + package)
        self.fingerprint = object_digest(
            {
                "config_sha256": digest((root / CONFIG_PATH).read_bytes()),
                "implementation_sha256": digest(Path(__file__).read_bytes()),
                "model_version": inference.version,
            }
        )
        self.explainers = {}
        self.cache = OrderedDict()
        self.frames = None  # Lazy development access/import: prediction never waits for SHAP.

    def _reference(self):
        if self.frames is None:
            development = load_safe_development(self.root)
            ids = choose_background(development.features.index)
            if (
                self.background["partition"] != "development"
                or self.background["record_ids"] != ids
                or self.background["record_ids_sha256"] != object_digest(ids)
                or self.background["development_ids_sha256"]
                != object_digest(development.features.index.tolist())
                or self.background["feature_values_sha256"]
                != object_digest(background_values(development.features.loc[ids]))
            ):
                raise ValueError("Background is not the exact deterministic development reference")
            self.frames = development.features.loc[ids].copy()
        return self.frames

    def _explainer(self, target):
        if target not in self.explainers:
            import shap

            pipeline = self.inference.models[target]
            reference = pipeline[:-1].transform(self._reference())
            classifier = pipeline.named_steps["classifier"]
            if target in ("CAD", "LAD"):
                explainer = shap.LinearExplainer(
                    classifier, shap.maskers.Independent(reference, max_samples=BACKGROUND_SIZE)
                )
            else:
                # sklearn's saved forest casts input to this dtype before routing.
                # SHAP's background must follow the identical branch comparisons.
                reference = np.asarray(reference, dtype=TREE_INPUT_DTYPE)
                explainer = shap.TreeExplainer(
                    classifier,
                    data=reference,
                    model_output="probability",
                    feature_perturbation="interventional",
                )
                explainer.model.thresholds = routing_equivalent_thresholds(
                    explainer.model.thresholds
                )
                if not np.allclose(
                    explainer.model.predict(reference),
                    classifier.predict_proba(reference),
                    atol=1e-12,
                    rtol=0,
                ):
                    raise ValueError("Explanation tree routing differs from frozen predictor")
            self.explainers[target] = explainer
        return self.explainers[target]

    def explain(self, request):
        profile = ProfileRequest(features=request.features)
        validated = validate_profile(profile, self.inference.manifest)
        if (
            request.profile_fingerprint != validated.profile_fingerprint
            or request.model_version != self.inference.version
            or request.schema_fingerprint != self.inference.protocol["schema_sha256"]
            or request.model_sha256 != self.inference.checksums[request.target]
        ):
            raise ValueError("Explanation profile/model/schema identity mismatch")
        key = (
            validated.profile_fingerprint,
            self.inference.version,
            request.target,
            self.fingerprint,
        )
        with self.lock:
            if key in self.cache:
                if not math.isclose(
                    self.cache[key]["probability"], request.probability, abs_tol=1e-12, rel_tol=0
                ):
                    raise ValueError("Cached explanation does not match displayed prediction")
                self.cache.move_to_end(key)
                return copy.deepcopy(self.cache[key])
            pipeline = self.inference.models[request.target]
            X = pd.DataFrame([profile.features], columns=self.inference.manifest.feature_order)
            with self.inference.lock, no_fitting(), threadpool_limits(limits=1):
                # Independent full-pipeline probability, not SHAP's own model wrapper.
                probability = float(positive_probability(pipeline, X)[0])
                if not math.isclose(probability, request.probability, abs_tol=1e-12, rel_tol=0):
                    raise ValueError("Explanation does not match the displayed prediction")
                transformed = pipeline[:-1].transform(X)
                if request.target in ("LCX", "RCA"):
                    transformed = np.asarray(transformed, dtype=TREE_INPUT_DTYPE)
                explainer = self._explainer(request.target)
                raw = np.asarray(explainer.shap_values(transformed))
                if request.target in ("CAD", "LAD"):
                    if raw.shape != transformed.shape:
                        raise ValueError("Unexpected positive log-odds explanation shape")
                    values, baseline = raw[0], float(explainer.expected_value)
                    output = float(pipeline.decision_function(X)[0])
                    space, units, tolerance = "log_odds", "model log-odds", LOGIT_TOLERANCE
                    if not math.isclose(float(expit(output)), probability, abs_tol=1e-12):
                        raise ValueError(
                            "Raw logit is not the displayed positive-class probability"
                        )
                else:
                    if raw.shape != (*transformed.shape, 2) or pipeline.named_steps[
                        "classifier"
                    ].classes_.tolist() != [0, 1]:
                        raise ValueError("Unexpected positive probability explanation shape")
                    values, baseline = raw[0, :, 1], float(explainer.expected_value[1])
                    output = probability
                    space, units, tolerance = (
                        "probability",
                        "probability units",
                        PROBABILITY_TOLERANCE,
                    )
                groups = aggregate_contributions(
                    encoded_groups(pipeline), values, self.inference.manifest.feature_order
                )
                total = math.fsum(groups.values())
                reconstructed = baseline + total
                residual = reconstructed - output
                if (
                    not all(math.isfinite(v) for v in (baseline, output, total, residual))
                    or abs(residual) > tolerance
                ):
                    raise RuntimeError("SHAP reconstruction failed; no explanation returned")
                contributions = [
                    {
                        "feature": spec.name,
                        "value": profile.features[spec.name],
                        "unit": spec.unit if spec.unit_status == "verified" else None,
                        "contribution": groups[spec.name],
                    }
                    for spec in self.inference.manifest.features
                ]
                definition = self.inference.protocol["targets"][request.target]
                result = {
                    "target": request.target,
                    "positive_class": definition["positive_class"],
                    "probability": probability,
                    "positive": probability >= 0.5,
                    "status": definition["positive_class"] if probability >= 0.5 else "Normal",
                    "threshold": 0.5,
                    "output_space": space,
                    "contribution_units": units,
                    "baseline": baseline,
                    "explained_output": output,
                    "total_contribution": total,
                    "reconstructed_output": reconstructed,
                    "reconstruction_residual": residual,
                    "reconstruction_tolerance": tolerance,
                    "remaining_factor_contribution": 0.0,
                    "contributions": contributions,
                    "encoded_contribution_sum": math.fsum(values),
                    "profile_fingerprint": validated.profile_fingerprint,
                    "model_version": self.inference.version,
                    "schema_fingerprint": self.inference.protocol["schema_sha256"],
                    "model_sha256": self.inference.checksums[request.target],
                    "method": self.config["methods"][request.target],
                    "method_version": "shap-" + version("shap") + "/cardioscope-v1",
                    "explanation_configuration_fingerprint": self.fingerprint,
                    "background_fingerprint": self.config["background_file_sha256"],
                    "background_records": BACKGROUND_SIZE,
                    "feature_perturbation": "interventional",
                    "aggregation": (
                        "sum transformed-feature SHAP values per original source feature"
                    ),
                }
            self.cache[key] = copy.deepcopy(result)
            while len(self.cache) > self.config["cache_capacity"]:
                self.cache.popitem(last=False)
            return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["prepare"])
    parser.parse_args()
    print("Prepared deterministic development-only SHAP background:", prepare()["record_count"])

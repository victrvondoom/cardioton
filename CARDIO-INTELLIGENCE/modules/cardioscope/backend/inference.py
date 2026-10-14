"""Read-only application inference from the checksum-verified evaluated pipelines."""

from pathlib import Path
from threading import Lock

import pandas as pd
from threadpoolctl import threadpool_limits

from backend.contracts import FeatureManifest, ProfileRequest, validate_profile
from ml.common import ROOT, digest, object_digest, read_json
from ml.data import scalar
from ml.development import load_safe_development
from ml.evaluate_holdout import evaluation_status, no_fitting, preflight
from ml.models import positive_probability


class InferenceService:
    def __init__(self, root: Path = ROOT):
        # Preflight checks opaque source/artifact bytes and fitted metadata only.
        # It never opens holdout outcomes or invokes evaluation/training.
        context = preflight(root)
        record = evaluation_status(root)
        protocol = context["protocol"]
        if (
            record.get("status") != "completed"
            or record["model_checksums"] != context["model_checksums"]
            or record["development_run_sha256"] != protocol["development_run_sha256"]
            or record["schema_sha256"] != protocol["schema_sha256"]
            or record["protocol_sha256"] != context["protocol_sha256"]
        ):
            raise ValueError("Application models differ from the completed final evaluation")
        self.manifest = FeatureManifest.model_validate(context["manifest"])
        self.models = context["models"]
        self.checksums = context["model_checksums"]
        self.protocol = protocol
        self.version = object_digest(
            {
                "development_run_sha256": protocol["development_run_sha256"],
                "model_checksums": self.checksums,
            }
        )
        self.lock = Lock()
        results_path = root / record["output_directory"] / "results.json"
        if digest(results_path.read_bytes()) != record["results_sha256"]:
            raise ValueError("Saved final results checksum differs")
        results = read_json(results_path)
        self.model_information = (
            "CardioScope — model performance and limitations\n\n"
            "Educational / decision support only; not a substitute for diagnostic imaging.\n"
            "Four independent classifiers trained on 242 public development records.\n"
            "Once-only final holdout: 61 same-source records; threshold 0.5.\n"
            "Model-estimated probabilities are not established as calibrated clinical risk.\n"
            "Patient identifiers are unverified; this is not external clinical validation.\n\n"
        )
        for target in ("CAD", "LAD", "LCX", "RCA"):
            metrics = results["targets"][target]["metrics"]
            self.model_information += (
                f"{target}: final ROC-AUC {metrics['roc_auc']:.4f}; "
                f"recall {metrics['recall']:.4f}.\n"
            )
        self.model_information += (
            "\nLCX/RCA detection at 0.5 is weak: LCX missed 19/24 positives, "
            "RCA missed 15/21. All four outputs remain visible.\n"
            "Color encodes output magnitude only, not measured narrowing or lesion location.\n"
            "Reference anatomy is not the patient's geometry.\n\n"
            "Complete methods, uncertainty and metrics: docs/FINAL_EVALUATION.md in the project.\n"
            f"Frozen development run: {protocol['development_run_id']}\n"
            f"Application model fingerprint: {self.version}\n"
        )
        development = load_safe_development(root)
        # Exactly one example, chosen by ID before inference; no outcome-based selection.
        record_id = min(development.features.index)
        features = {
            name: scalar(value) for name, value in development.features.loc[record_id].items()
        }
        validate_profile(ProfileRequest(features=features), self.manifest)
        if record_id in context["split"]["holdout_ids"]:
            raise ValueError("A holdout profile cannot be a product example")
        self.examples = [
            {
                "id": record_id,
                "label": "Public dataset example — not a real current patient",
                "source": "UCI 411 Z-Alizadeh Sani; locked development partition",
                "selection_rule": "lexicographically smallest development content record ID",
                "workbook_sha256": self.manifest.workbook_sha256,
                "features": features,
            }
        ]

    def predict(self, profile: ProfileRequest) -> dict:
        validation = validate_profile(profile, self.manifest)
        X = pd.DataFrame([profile.features], columns=self.manifest.feature_order)
        outputs = {}
        # Serializes the temporary fitting prohibition and numerical thread limits.
        # No application path invokes fit, selection, evaluation, or split creation.
        with self.lock, no_fitting(), threadpool_limits(limits=1):
            for target in ("CAD", "LAD", "LCX", "RCA"):
                probability = float(positive_probability(self.models[target], X)[0])
                definition = self.protocol["targets"][target]
                outputs[target] = {
                    "probability": probability,
                    "positive": probability >= 0.5,
                    "status": definition["positive_class"]
                    if probability >= 0.5
                    else definition["negative_class"],
                    "model_id": self.protocol["frozen_candidates"][target]["id"],
                    "model_sha256": self.checksums[target],
                    **definition,
                }
        return {
            "outputs": outputs,
            "probability_label": "model-estimated probability",
            "threshold": 0.5,
            "model_version": self.version,
            "development_run_id": self.protocol["development_run_id"],
            "development_run_fingerprint": self.protocol["development_run_sha256"],
            "profile_fingerprint": validation.profile_fingerprint,
            "schema_version": self.manifest.schema_version,
            "schema_fingerprint": self.protocol["schema_sha256"],
            "feature_manifest_fingerprint": self.protocol["schema_sha256"],
        }

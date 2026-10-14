"""Strict schema guard and small fold-fitted classical-model pipelines."""

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ml.common import object_digest
from ml.data import assert_feature_columns


class SchemaGuard(TransformerMixin, BaseEstimator):
    def __init__(self, manifest: dict, schema_sha256: str):
        self.manifest = manifest
        self.schema_sha256 = schema_sha256

    def validate(self, X):
        if not isinstance(X, pd.DataFrame):
            raise ValueError("Model inputs must retain named, ordered DataFrame columns")
        config = {
            "features": self.manifest["feature_order"],
            "targets": self.manifest["targets"],
            "forbidden_feature_aliases": self.manifest["forbidden_feature_aliases"],
        }
        assert_feature_columns(X.columns, config)
        if X.isna().any().any():
            raise ValueError("Missing inputs are rejected; no imputation is fitted")
        for feature in self.manifest["features"]:
            values = X[feature["name"]]
            if feature["kind"] == "category":
                if not values.isin(feature["categories"]).all():
                    raise ValueError(f"Unknown source category: {feature['name']}")
            elif not pd.api.types.is_numeric_dtype(values) or not np.isfinite(values).all():
                raise ValueError(f"Invalid numeric feature: {feature['name']}")
            elif feature["kind"] == "integer" and not (values == np.floor(values)).all():
                raise ValueError(f"Nonintegral source feature: {feature['name']}")
        return X

    def fit(self, X, y=None):
        self.validate(X)
        if not X.index.is_unique:
            raise ValueError("Training record IDs must be unique")
        self.fit_row_ids_ = X.index.tolist()
        self.feature_names_in_ = np.asarray(X.columns, dtype=object)
        self.n_features_in_ = len(X.columns)
        return self

    def transform(self, X):
        return self.validate(X)

    def get_feature_names_out(self, input_features=None):
        return self.feature_names_in_


def build_pipeline(candidate: dict, manifest: dict, schema_sha256: str, search: dict) -> Pipeline:
    numeric = [f["name"] for f in manifest["features"] if f["kind"] != "category"]
    categorical = [f["name"] for f in manifest["features"] if f["kind"] == "category"]
    family = candidate["family"]
    processor = ColumnTransformer(
        [
            ("numeric", StandardScaler() if family == "logistic" else "passthrough", numeric),
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                categorical,
            ),
        ],
        remainder="drop",
        sparse_threshold=0,
    )
    params = candidate["params"]
    if family == "dummy":
        estimator = DummyClassifier(**params, random_state=search["seed"])
    elif family == "logistic":
        estimator = LogisticRegression(
            **search["logistic_fixed"], **params, random_state=search["seed"]
        )
    elif family == "forest":
        estimator = RandomForestClassifier(
            **search["forest_fixed"], **params, random_state=search["seed"]
        )
    else:
        raise ValueError(f"Unapproved candidate family: {family}")
    return Pipeline(
        [
            ("schema", SchemaGuard(manifest, schema_sha256)),
            ("preprocess", processor),
            ("classifier", estimator),
        ]
    )


def positive_probability(pipeline: Pipeline, X: pd.DataFrame) -> np.ndarray:
    classes = pipeline.named_steps["classifier"].classes_.tolist()
    if classes != [0, 1]:
        raise ValueError("Classifier must encode negative=0, CAD/Stenotic positive=1")
    result = pipeline.predict_proba(X)[:, classes.index(1)]
    if not np.isfinite(result).all() or np.any((result < 0) | (result > 1)):
        raise ValueError("Invalid positive-class probabilities")
    return result


def preprocessing_metadata(pipeline: Pipeline) -> dict:
    guard = pipeline.named_steps["schema"]
    processor = pipeline.named_steps["preprocess"]
    encoder = processor.named_transformers_["categorical"]
    metadata = {
        "schema_sha256": guard.schema_sha256,
        "feature_order": guard.feature_names_in_.tolist(),
        "fit_row_ids_sha256": object_digest(guard.fit_row_ids_),
        "fit_record_count": len(guard.fit_row_ids_),
        "encoded_feature_names": processor.get_feature_names_out().tolist(),
        "training_categories": {
            name: values.tolist()
            for name, values in zip(processor.transformers_[1][2], encoder.categories_, strict=True)
        },
        "unknown_category_encoding": "all-zero one-hot block; no learned validation domain",
        "imputation": None,
        "feature_selection": None,
        "calibration": None,
    }
    scaler = processor.named_transformers_["numeric"]
    if isinstance(scaler, StandardScaler):
        metadata["numeric_scaling"] = {
            "features": processor.transformers_[0][2],
            "mean": scaler.mean_.tolist(),
            "scale": scaler.scale_.tolist(),
            "fit_samples": int(scaler.n_samples_seen_),
        }
    else:
        metadata["numeric_scaling"] = None
    return metadata

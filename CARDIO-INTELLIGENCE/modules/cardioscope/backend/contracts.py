"""Strict source-schema API contracts; no coercion or hidden missing-input defaults."""

import math
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictFloat, StrictInt, StrictStr

from ml.common import object_digest


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TargetDefinition(Contract):
    column: str
    positive_class: str
    negative_class: str


class FeatureDefinition(Contract):
    name: str
    kind: Literal["integer", "number", "category"]
    storage_dtype: str
    unit: str | None
    unit_status: str
    categories: list[str] | None
    categories_source: str | None
    required: bool


class FeatureManifest(Contract):
    schema_version: int
    dataset_zip_sha256: str
    workbook_sha256: str
    feature_order: list[str]
    features: list[FeatureDefinition]
    targets: dict[str, TargetDefinition]
    forbidden_feature_aliases: list[str]
    missing_input_policy: str
    preprocessing_fitted: bool


class ProfileRequest(Contract):
    features: dict[str, StrictInt | StrictFloat | StrictStr]


class ExplanationRequest(ProfileRequest):
    target: Literal["CAD", "LAD", "LCX", "RCA"]
    profile_fingerprint: StrictStr
    model_version: StrictStr
    schema_fingerprint: StrictStr
    model_sha256: StrictStr
    probability: Annotated[StrictFloat | StrictInt, Field(ge=0, le=1, allow_inf_nan=False)]


class ProfileValidation(Contract):
    valid: bool
    profile_fingerprint: str
    feature_manifest_sha256: str
    model_version: str | None = None


class Health(Contract):
    service: Literal["CardioScope"] = "CardioScope"
    version: Literal["0.1.0"] = "0.1.0"
    phase: Literal["inference"] = "inference"
    data_prepared: bool
    anatomy_prepared: bool
    models_loaded: bool = False
    model_error: str | None = None


def validate_profile(profile: ProfileRequest, manifest: FeatureManifest) -> ProfileValidation:
    if set(profile.features) != set(manifest.feature_order):
        missing = sorted(set(manifest.feature_order) - set(profile.features))
        unknown = sorted(set(profile.features) - set(manifest.feature_order))
        raise ValueError(f"Input columns differ: missing={missing}, forbidden/unknown={unknown}")
    for spec in manifest.features:
        value = profile.features[spec.name]
        if spec.kind == "category":
            if not isinstance(value, str) or value not in (spec.categories or []):
                raise ValueError(f"Unknown source category for {spec.name}")
        elif isinstance(value, str) or not math.isfinite(value):
            raise ValueError(f"{spec.name} requires a finite number")
        elif spec.kind == "integer" and int(value) != value:
            raise ValueError(f"{spec.name} requires an integer")
    # No clinical limits or empirical range thresholds are guessed here.
    return ProfileValidation(
        valid=True,
        profile_fingerprint=object_digest(profile.features),
        feature_manifest_sha256=object_digest(manifest.model_dump()),
    )

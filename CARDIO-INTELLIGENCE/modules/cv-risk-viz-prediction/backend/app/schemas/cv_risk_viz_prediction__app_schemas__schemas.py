"""Pydantic request/response schemas for the CardioVision AI API."""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class HealthStatus(BaseModel):
    status: str
    models_loaded: bool
    model_version: str
    readiness: str
    error: str | None = None


class FeatureSpec(BaseModel):
    feature: str
    display_name: str
    type: Literal["categorical", "numeric", "binary"]
    allowed_values: list[Any] | None = None
    min: float | None = None
    max: float | None = None
    group: str | None = None
    required: bool = True


class SchemaResponse(BaseModel):
    features: list[FeatureSpec]
    forbidden_features: list[str]


class VesselPrediction(BaseModel):
    target: Literal["cad", "lad", "lcx", "rca"]
    probability: float
    prediction: Literal[0, 1]
    threshold: float
    model_name: str


class PredictResponse(BaseModel):
    predictions: list[VesselPrediction]
    model_version: str
    input_completeness: dict[str, Any]
    disclaimer: str


class Contribution(BaseModel):
    feature: str
    value: Any
    contribution: float  # positive pushes toward positive class


class ExplanationRecord(BaseModel):
    target: str
    method: str
    baseline: float
    contributions: list[Contribution] = Field(default_factory=list)
    top_features: list[str] = Field(default_factory=list)


class ExplainRequest(BaseModel):
    features: dict[str, Any]
    target: Literal["cad", "lad", "lcx", "rca"]


class ExplainResponse(BaseModel):
    target: str
    method: str
    output_space: str
    baseline: float
    contributions: list[Contribution]
    model_name: str
    model_version: str
    disclaimer: str


class MetricsResponse(BaseModel):
    metrics: dict[str, Any]
    chosen_models: dict[str, Any]
    model_version: str


class ModelsResponse(BaseModel):
    models: dict[str, Any]
    model_version: str

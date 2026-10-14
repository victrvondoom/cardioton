"""API routes: /api/health, /api/schema, /api/models, /api/metrics,
/api/predict, /api/explain."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.schemas.cv_risk_viz_prediction__app_schemas__schemas import (
    HealthStatus, SchemaResponse, VesselPrediction, PredictResponse,
    ExplainRequest, ExplainResponse, MetricsResponse, ModelsResponse, FeatureSpec,
)
from app.services.cv_risk_viz_prediction__app_services__registry import REGISTRY
from app.services.cv_risk_viz_prediction__app_services__inference import predict_all, explain_local, DISCLAIMER

router = APIRouter(prefix="/api")


@router.on_event("startup")
async def _load_models():
    REGISTRY.load()


@router.get("/health", response_model=HealthStatus)
def health():
    return HealthStatus(
        status="ok" if REGISTRY.loaded else "degraded",
        models_loaded=REGISTRY.loaded,
        model_version=REGISTRY.manifest.get("model_version", "unknown"),
        readiness="ready" if REGISTRY.loaded else "unavailable",
        error=REGISTRY.error,
    )


@router.get("/schema", response_model=SchemaResponse)
def schema():
    if not REGISTRY.loaded:
        raise HTTPException(503, "Model artifacts not loaded; schema unavailable.")
    feats: list[FeatureSpec] = []
    groups = {"Age": "demographics", "Weight": "demographics", "Length": "demographics", "BMI": "demographics", "Sex": "demographics",
              "BP": "examinations", "PR": "examinations"}
    for row in REGISTRY.feature_schema:
        f = row["feature"]
        fs = FeatureSpec(feature=f, display_name=f.replace("_", " "), type=row["type"], group=groups.get(f, "laboratory"))
        feats.append(fs)
    return SchemaResponse(features=feats, forbidden_features=["LAD", "LCX", "RCA", "Cath"])


@router.get("/models", response_model=ModelsResponse)
def models():
    if not REGISTRY.loaded:
        raise HTTPException(503, "Model artifacts not loaded.")
    return ModelsResponse(models=REGISTRY.manifest.get("targets", {}), model_version=REGISTRY.manifest.get("model_version", "unknown"))


@router.get("/metrics", response_model=MetricsResponse)
def metrics():
    if not REGISTRY.loaded:
        raise HTTPException(503, "Model artifacts not loaded.")
    return MetricsResponse(
        metrics=REGISTRY.metrics.get("holdout", {}),
        chosen_models=REGISTRY.metrics.get("chosen", {}),
        model_version=REGISTRY.manifest.get("model_version", "unknown"),
    )


@router.post("/predict", response_model=PredictResponse)
def predict(payload: dict[str, Any]):
    if not REGISTRY.loaded:
        raise HTTPException(503, "Model artifacts unavailable; cannot serve predictions.")
    features = payload.get("features") if isinstance(payload, dict) else None
    if not isinstance(features, dict) or not features:
        raise HTTPException(422, "Request body must include non-empty 'features' object.")
    forbidden = {"LAD", "LCX", "RCA", "Cath"} & set(features.keys())
    if forbidden:
        raise HTTPException(422, f"Forbidden angiography outcomes in input: {sorted(forbidden)}")
    try:
        preds = predict_all(features, REGISTRY)
    except Exception as exc:
        raise HTTPException(400, f"Inference failure: {exc}")
    total = len(REGISTRY.feature_schema)
    supplied = len(set(features) & {r["feature"] for r in REGISTRY.feature_schema})
    completeness = round(supplied / total, 3) if total else 0.0
    return PredictResponse(
        predictions=[VesselPrediction(**p) for p in preds],
        model_version=REGISTRY.manifest.get("model_version", "unknown"),
        input_completeness={"supplied": supplied, "total": total, "fraction": completeness},
        disclaimer=DISCLAIMER,
    )


@router.post("/explain", response_model=ExplainResponse)
def explain(payload: ExplainRequest):
    if not REGISTRY.loaded:
        raise HTTPException(503, "Model artifacts unavailable; cannot serve explanations.")
    forbidden = {"LAD", "LCX", "RCA", "Cath"} & set(payload.features.keys())
    if forbidden:
        raise HTTPException(422, f"Forbidden angiography outcomes in input: {sorted(forbidden)}")
    try:
        rec = explain_local(payload.target, payload.features, REGISTRY)
    except Exception as exc:
        raise HTTPException(400, f"Explanation failure: {exc}")
    return ExplainResponse(
        target=rec["target"], method=rec["method"], output_space=rec["output_space"],
        baseline=round(rec["baseline"], 4), contributions=rec["contributions"],
        model_name=rec["model_name"], model_version=REGISTRY.manifest.get("model_version", "unknown"),
        disclaimer=DISCLAIMER,
    )

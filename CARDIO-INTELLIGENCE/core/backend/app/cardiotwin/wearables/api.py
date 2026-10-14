"""Wearable Data API Endpoints.

Provides RESTful API for wearable data streaming, analysis, and integration.
This module is part of CardioTwin and mounted at /api/v1/cardiotwin/wearables.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.cardiotwin.wearables.core__cardiotwin_wearables__models import (
    PatientWearableState,
    WearableDataPoint,
    WearableFeatures,
    WearablePrediction,
)
from app.cardiotwin.wearables.processing import (
    analyze_wearable_data,
    compute_hrv_metrics,
    detect_wearable_anomalies,
    extract_wearable_features,
)
from app.cardiotwin.wearables.simulation import (
    WearableSimulator,
    generate_synthetic_wearable_stream,
)
from app.oncotwin.observability import METRICS

log = structlog.get_logger()
router = APIRouter(prefix="/wearables", tags=["cardiotwin_wearables"])


class WearableDataRequest(BaseModel):
    """Request body for wearable data submission."""

    data_points: list[dict[str, Any]] = Field(
        default_factory=list,
        description="List of wearable data points",
    )


class WearableStreamRequest(BaseModel):
    """Request body for synthetic wearable stream generation."""

    duration_seconds: float = Field(
        default=300.0,
        ge=10.0,
        le=3600.0,
        description="Duration of stream in seconds",
    )

    scenario: str = Field(
        default="normal",
        description="Wearable data scenario",
    )

    base_heart_rate: float = Field(
        default=72.0,
        ge=20.0,
        le=250.0,
        description="Base heart rate in bpm",
    )

    interval_seconds: float = Field(
        default=1.0,
        ge=0.1,
        le=10.0,
        description="Sampling interval in seconds",
    )

    random_seed: int | None = Field(
        default=None,
        ge=0,
        description="Random seed for reproducibility",
    )


class WearableAnalysisRequest(BaseModel):
    """Request body for wearable data analysis."""

    data_points: list[dict[str, Any]] = Field(
        default_factory=list,
        description="List of wearable data points to analyze",
    )


@router.get("/capabilities")
async def wearable_capabilities(
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """List wearable data capabilities."""
    return {
        "capabilities": [
            "heart_rate_analysis",
            "heart_rate_variability",
            "activity_tracking",
            "oxygen_saturation",
            "sleep_detection",
            "anomaly_detection",
            "stress_scoring",
            "arrhythmia_detection",
        ],
        "scenarios": [
            {"id": "normal", "name": "Normal Activity"},
            {"id": "exercise", "name": "Exercise"},
            {"id": "stress", "name": "Stress"},
            {"id": "afib", "name": "Atrial Fibrillation"},
            {"id": "sleep", "name": "Sleep"},
        ],
        "note": "All data is synthetic for research and demonstration purposes.",
    }


@router.post("/stream")
async def stream_wearable_data(
    request: WearableStreamRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Generate and return a stream of synthetic wearable data."""
    data_points = generate_synthetic_wearable_stream(
        duration_seconds=request.duration_seconds,
        interval_seconds=request.interval_seconds,
        scenario=request.scenario,
        base_heart_rate=request.base_heart_rate,
        random_seed=request.random_seed,
    )

    METRICS.inc("wearable_stream_generations_total")

    return {
        "data_points": [dp.to_dict() for dp in data_points],
        "metadata": {
            "duration_seconds": request.duration_seconds,
            "num_points": len(data_points),
            "scenario": request.scenario,
            "base_heart_rate": request.base_heart_rate,
        },
    }


@router.post("/analyze")
async def analyze_wearable_data_endpoint(
    request: WearableAnalysisRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Analyze wearable data and return features and predictions."""
    if not request.data_points:
        raise HTTPException(
            status_code=400,
            detail={"error": "No data points provided"},
        )

    # Convert to WearableDataPoint objects
    data_points = []
    for dp_dict in request.data_points:
        dp = WearableDataPoint(
            timestamp=datetime.fromisoformat(dp_dict.get("timestamp", datetime.now().isoformat())),
            heart_rate=dp_dict.get("heart_rate"),
            rr_intervals=dp_dict.get("rr_intervals"),
            spo2=dp_dict.get("spo2"),
            steps=dp_dict.get("steps"),
            activity_level=dp_dict.get("activity_level"),
            sleep_stage=dp_dict.get("sleep_stage"),
            device_id=dp_dict.get("device_id", ""),
            device_type=dp_dict.get("device_type", ""),
            signal_quality=dp_dict.get("signal_quality", 1.0),
        )
        data_points.append(dp)

    # Analyze data
    features, prediction = analyze_wearable_data(data_points)

    METRICS.inc("wearable_analyses_total")

    return {
        "features": features.to_dict(),
        "prediction": prediction.to_dict(),
        "metadata": {
            "num_data_points": len(data_points),
            "analysis_timestamp": datetime.now().isoformat(timespec="seconds"),
        },
    }


@router.post("/features")
async def extract_wearable_features_endpoint(
    request: WearableAnalysisRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Extract features from wearable data without predictions."""
    if not request.data_points:
        raise HTTPException(
            status_code=400,
            detail={"error": "No data points provided"},
        )

    # Convert to WearableDataPoint objects
    data_points = []
    for dp_dict in request.data_points:
        dp = WearableDataPoint(
            timestamp=datetime.fromisoformat(dp_dict.get("timestamp", datetime.now().isoformat())),
            heart_rate=dp_dict.get("heart_rate"),
            rr_intervals=dp_dict.get("rr_intervals"),
            spo2=dp_dict.get("spo2"),
            steps=dp_dict.get("steps"),
            activity_level=dp_dict.get("activity_level"),
            sleep_stage=dp_dict.get("sleep_stage"),
            device_id=dp_dict.get("device_id", ""),
            device_type=dp_dict.get("device_type", ""),
            signal_quality=dp_dict.get("signal_quality", 1.0),
        )
        data_points.append(dp)

    features = extract_wearable_features(data_points)

    METRICS.inc("wearable_feature_extractions_total")

    return {
        "features": features.to_dict(),
        "metadata": {
            "num_data_points": len(data_points),
        },
    }


@router.post("/anomalies")
async def detect_anomalies_endpoint(
    request: WearableAnalysisRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Detect anomalies in wearable data."""
    if not request.data_points:
        raise HTTPException(
            status_code=400,
            detail={"error": "No data points provided"},
        )

    # Convert to WearableDataPoint objects
    data_points = []
    for dp_dict in request.data_points:
        dp = WearableDataPoint(
            timestamp=datetime.fromisoformat(dp_dict.get("timestamp", datetime.now().isoformat())),
            heart_rate=dp_dict.get("heart_rate"),
            rr_intervals=dp_dict.get("rr_intervals"),
            spo2=dp_dict.get("spo2"),
            steps=dp_dict.get("steps"),
            activity_level=dp_dict.get("activity_level"),
            sleep_stage=dp_dict.get("sleep_stage"),
            device_id=dp_dict.get("device_id", ""),
            device_type=dp_dict.get("device_type", ""),
            signal_quality=dp_dict.get("signal_quality", 1.0),
        )
        data_points.append(dp)

    # Extract features first
    features = extract_wearable_features(data_points)

    # Detect anomalies
    anomalies = detect_wearable_anomalies(data_points, features)

    METRICS.inc("wearable_anomaly_detections_total")

    return {
        "anomalies": anomalies,
        "num_anomalies": len(anomalies),
        "severity": "high" if any(a in ["SPO2_CRITICAL", "BRADYCARDIA_EXTREME", "TACHYCARDIA_EXTREME"] for a in anomalies) else "moderate" if anomalies else "none",
    }


@router.post("/hrv")
async def compute_hrv_endpoint(
    request: WearableAnalysisRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Compute HRV metrics from wearable data."""
    if not request.data_points:
        raise HTTPException(
            status_code=400,
            detail={"error": "No data points provided"},
        )

    # Extract RR intervals from data points
    rr_intervals = []
    for dp_dict in request.data_points:
        if dp_dict.get("rr_intervals"):
            rr_intervals.extend(dp_dict["rr_intervals"])

    # Compute HRV metrics
    hrv_metrics = compute_hrv_metrics(rr_intervals)

    METRICS.inc("wearable_hrv_computations_total")

    return {
        "hrv_metrics": hrv_metrics,
        "rr_intervals_count": len(rr_intervals),
    }


@router.get("/state/{patient_id}")
async def get_wearable_state(
    patient_id: str,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Get current wearable state for a patient (synthetic demo)."""
    # For demo purposes, generate synthetic state
    simulator = WearableSimulator(
        base_heart_rate=72.0,
        scenario="normal",
        random_seed=42,
    )

    # Generate current data point
    current_data = simulator.generate_data_point()

    # Generate some historical data
    historical_data = generate_synthetic_wearable_stream(
        duration_seconds=300.0,
        scenario="normal",
        base_heart_rate=72.0,
        random_seed=42,
    )

    # Extract features from historical data
    features_5min = extract_wearable_features(historical_data[-30:])  # Last 30 points (~5 min)

    # Detect anomalies
    anomalies = detect_wearable_anomalies(historical_data)

    # Make prediction
    prediction = predict_from_wearable_features(features_5min, anomalies)

    state = PatientWearableState(
        patient_id=patient_id,
        current=current_data,
        features_1min=None,
        features_5min=features_5min,
        features_1hour=None,
        predictions=prediction,
        heart_rate_trend="stable",
        activity_trend="stable",
    )

    return state.to_dict()


def predict_from_wearable_features(
    features: WearableFeatures,
    anomalies: list[str],
) -> WearablePrediction:
    """Create prediction from features and anomalies."""
    # This is a helper to avoid circular import
    from app.cardiotwin.wearables.processing import predict_from_wearable
    return predict_from_wearable(features, anomalies)

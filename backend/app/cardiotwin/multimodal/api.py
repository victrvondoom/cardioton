"""Multimodal Fusion API Endpoints.

Provides RESTful API for multimodal cardiovascular risk prediction combining
EHR, ECG, and wearable data. This module is part of CardioTwin and mounted
at /api/v1/cardiotwin/multimodal.
"""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.cardiotwin.multimodal.fusion import (
    MultimodalInput,
    fuse_predictions,
)
from app.cardiotwin.wearables.models import WearableDataPoint
from app.oncotwin.observability import METRICS

log = structlog.get_logger()
router = APIRouter(prefix="/multimodal", tags=["cardiotwin_multimodal"])


class MultimodalRequest(BaseModel):
    """Request body for multimodal prediction."""

    ehr_data: dict[str, Any] = Field(
        default_factory=dict,
        description="EHR/clinical data as feature name-value pairs",
    )

    ecg_signal: list[float] | None = Field(
        default=None,
        description="ECG signal values",
    )
    ecg_sampling_rate: float = Field(
        default=500.0,
        ge=10.0,
        le=10000.0,
        description="ECG sampling rate in Hz",
    )

    wearable_data: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Wearable data points",
    )


class MultimodalDemoRequest(BaseModel):
    """Request body for multimodal demonstration."""

    scenario_id: str = Field(
        default="high_risk_65m",
        description="ID of the scenario to use for demo",
    )

    include_all_modalities: bool = Field(
        default=True,
        description="Include EHR, ECG, and wearable data",
    )


@router.get("/capabilities")
async def multimodal_capabilities(
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """List multimodal fusion capabilities."""
    return {
        "capabilities": [
            "ehr_cad_prediction",
            "ecg_arrhythmia_detection",
            "ecg_ischemia_detection",
            "wearable_stress_analysis",
            "wearable_hrv_analysis",
            "multimodal_fusion",
            "uncertainty_quantification",
            "modality_disagreement_detection",
        ],
        "modalities": [
            {
                "id": "ehr",
                "name": "Electronic Health Records",
                "description": "Clinical features, lab values, exam findings",
                "features": "54 clinical features across 6 groups",
            },
            {
                "id": "ecg",
                "name": "Electrocardiogram",
                "description": "Heart rate, intervals, arrhythmia detection, ischemia detection",
                "features": "20+ ECG features",
            },
            {
                "id": "wearable",
                "name": "Wearable Devices",
                "description": "Heart rate variability, activity, SpO2, stress scoring",
                "features": "15+ wearable features",
            },
        ],
        "fusion_methods": [
            {
                "id": "weighted_ensemble",
                "name": "Weighted Ensemble",
                "description": "Weighted average of modality predictions",
            },
            {
                "id": "uncertainty_aware",
                "name": "Uncertainty-Aware Fusion",
                "description": "Fusion accounting for modality uncertainty",
            },
        ],
        "note": "All implementations use synthetic data for research and demonstration.",
    }


@router.post("/predict")
async def multimodal_prediction(
    request: MultimodalRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Make multimodal prediction combining available modalities.

    This endpoint:
    1. Processes EHR data with the CAD model (if provided)
    2. Processes ECG signal for arrhythmia/ischemia detection (if provided)
    3. Processes wearable data for HRV and stress analysis (if provided)
    4. Fuses all predictions with uncertainty quantification
    """
    # Convert wearable data to DataPoint objects
    wearable_data_points = []
    for dp_dict in request.wearable_data:
        from datetime import datetime
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
        wearable_data_points.append(dp)

    # Create input
    input_data = MultimodalInput(
        ehr_data=request.ehr_data,
        ecg_signal=request.ecg_signal,
        ecg_sampling_rate=request.ecg_sampling_rate,
        wearable_data=wearable_data_points,
    )

    # Fuse predictions
    prediction = fuse_predictions(input_data)

    METRICS.inc("multimodal_predictions_total")

    log.info(
        "cardiotwin.multimodal.predict",
        ehr_features=len(request.ehr_data),
        ecg_samples=len(request.ecg_signal) if request.ecg_signal else 0,
        wearable_points=len(request.wearable_data),
        fused_cad=round(prediction.fused_cad_probability, 4),
        modalities=prediction.available_modalities,
    )

    return {
        "prediction": prediction.to_dict(),
        "input_summary": {
            "ehr_features": len(request.ehr_data),
            "ecg_samples": len(request.ecg_signal) if request.ecg_signal else 0,
            "wearable_points": len(request.wearable_data),
        },
    }


@router.post("/demo")
async def multimodal_demo(
    request: MultimodalDemoRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Run multimodal demonstration with synthetic data.

    This endpoint generates synthetic data for all requested modalities
    and demonstrates the complete multimodal fusion pipeline.
    """
    from app.cardiotwin.ecg import generate_synthetic_ecg
    from app.cardiotwin.wearables.simulation import generate_synthetic_wearable_stream
    from app.iit_mandi.scenarios import create_synthetic_patient, get_scenario

    # Get scenario
    scenario = get_scenario(request.scenario_id)
    if scenario is None:
        scenario = create_synthetic_patient(request.scenario_id)

    # Build input with synthetic data
    input_data = MultimodalInput(
        ehr_data=scenario.ehr_data if request.include_all_modalities else {},
        patient_id=scenario.id,
    )

    if request.include_all_modalities:
        # Add ECG
        signal, _ = generate_synthetic_ecg(
            duration=10,
            heart_rate=scenario.ecg_heart_rate,
            scenario=scenario.ecg_scenario,
        )
        input_data.ecg_signal = signal.tolist()
        input_data.ecg_sampling_rate = 500.0

        # Add wearable
        wearable_data = generate_synthetic_wearable_stream(
            duration_seconds=300.0,
            scenario=scenario.wearable_scenario,
        )
        input_data.wearable_data = wearable_data

    # Fuse predictions
    prediction = fuse_predictions(input_data)

    METRICS.inc("multimodal_demo_executions_total")

    return {
        "scenario": scenario.to_dict(),
        "prediction": prediction.to_dict(),
        "demonstration_complete": True,
    }


@router.get("/status")
async def multimodal_status(
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Get status of multimodal fusion system."""
    return {
        "status": "operational",
        "models": {
            "ehr": "loaded",
            "ecg": "loaded",
            "wearable": "loaded",
        },
        "fusion_engine": "active",
        "capabilities": [
            "multimodal_prediction",
            "uncertainty_quantification",
            "modality_disagreement_detection",
            "evidence_provenance",
        ],
    }

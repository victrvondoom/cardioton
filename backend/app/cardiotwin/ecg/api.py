"""ECG Analysis API Endpoints.

Provides RESTful API for ECG signal analysis, feature extraction, and prediction.
This module is part of CardioTwin and mounted at /api/v1/cardiotwin/ecg.
"""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.cardiotwin.ecg.features import (
    extract_ecg_features,
    generate_synthetic_ecg,
)
from app.cardiotwin.ecg.models import (
    analyze_ecg,
    get_ecg_model,
)
from app.cardiotwin.ecg.signals import (
    detect_qrs_complexes,
    filter_ecg,
)
from app.oncotwin.observability import METRICS

log = structlog.get_logger()
router = APIRouter(prefix="/ecg", tags=["cardiotwin_ecg"])


class ECGSignalRequest(BaseModel):
    """Request body for ECG signal analysis."""

    signal: list[float] | None = Field(
        default=None,
        description="Raw ECG signal values",
        min_length=100,
        max_length=100000,
    )
    sampling_rate: float = Field(
        default=500.0,
        ge=10.0,
        le=10000.0,
        description="Signal sampling rate in Hz",
    )
    lead: str = Field(
        default="II",
        description="ECG lead identifier",
    )


class SyntheticECGRequest(BaseModel):
    """Request body for synthetic ECG generation."""

    duration: float = Field(
        default=10.0,
        ge=1.0,
        le=60.0,
        description="Signal duration in seconds",
    )
    sampling_rate: float = Field(
        default=500.0,
        ge=10.0,
        le=10000.0,
        description="Sampling rate in Hz",
    )
    heart_rate: float = Field(
        default=72.0,
        ge=20.0,
        le=250.0,
        description="Heart rate in bpm",
    )
    scenario: str = Field(
        default="normal",
        description="ECG scenario type",
    )
    noise_level: float = Field(
        default=0.1,
        ge=0.0,
        le=1.0,
        description="Noise level (0-1)",
    )
    random_seed: int | None = Field(
        default=None,
        ge=0,
        description="Random seed for reproducibility",
    )


@router.get("/capabilities")
async def ecg_capabilities(
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """List ECG analysis capabilities."""
    model = get_ecg_model()
    return model.to_dict()


@router.post("/analyze")
async def analyze_ecg_signal(
    request: ECGSignalRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Analyze ECG signal and return comprehensive results."""
    import numpy as np

    if request.signal is None or len(request.signal) < 100:
        raise HTTPException(
            status_code=400,
            detail={"error": "Signal too short", "min_length": 100},
        )

    signal = np.array(request.signal, dtype=np.float64)
    result = analyze_ecg(signal, request.sampling_rate)

    METRICS.inc("ecg_analyses_total")
    METRICS.observe_ms("ecg_analysis_ms", result.duration * 1000)

    log.info(
        "cardiotwin.ecg.analyze",
        signal_length=result.signal_length,
        duration=round(result.duration, 2),
        sampling_rate=request.sampling_rate,
        heart_rate=round(result.features.get("heart_rate", 0), 2),
    )

    return result.to_dict()


@router.post("/features")
async def extract_ecg_features_endpoint(
    request: ECGSignalRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Extract ECG features without predictions."""
    import numpy as np

    if request.signal is None or len(request.signal) < 100:
        raise HTTPException(
            status_code=400,
            detail={"error": "Signal too short", "min_length": 100},
        )

    signal = np.array(request.signal, dtype=np.float64)
    features = extract_ecg_features(signal, request.sampling_rate, request.lead)

    METRICS.inc("ecg_feature_extractions_total")

    return {
        "features": features.to_dict(),
        "signal_metadata": {
            "length": len(signal),
            "sampling_rate": request.sampling_rate,
            "duration": round(len(signal) / request.sampling_rate, 2),
            "lead": request.lead,
        },
    }


@router.post("/generate")
async def generate_synthetic_ecg_signal(
    request: SyntheticECGRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Generate synthetic ECG signal for testing and demonstration."""
    signal, metadata = generate_synthetic_ecg(
        duration=request.duration,
        sampling_rate=request.sampling_rate,
        heart_rate=request.heart_rate,
        scenario=request.scenario,
        noise_level=request.noise_level,
        random_seed=request.random_seed,
    )

    METRICS.inc("ecg_synthetic_generations_total")

    return {
        "signal": signal.tolist(),
        "metadata": metadata,
    }


@router.post("/filter")
async def filter_ecg_signal_endpoint(
    request: ECGSignalRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Apply filtering to ECG signal."""
    import numpy as np

    if request.signal is None or len(request.signal) < 100:
        raise HTTPException(
            status_code=400,
            detail={"error": "Signal too short", "min_length": 100},
        )

    signal = np.array(request.signal, dtype=np.float64)
    filtered = filter_ecg(signal, request.sampling_rate)

    return {
        "filtered_signal": filtered.tolist(),
        "metadata": {
            "original_length": len(signal),
            "filtered_length": len(filtered),
            "sampling_rate": request.sampling_rate,
        },
    }


@router.post("/detect/peaks")
async def detect_peaks_endpoint(
    request: ECGSignalRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Detect R-peaks and compute basic intervals."""
    import numpy as np

    if request.signal is None or len(request.signal) < 100:
        raise HTTPException(
            status_code=400,
            detail={"error": "Signal too short", "min_length": 100},
        )

    signal = np.array(request.signal, dtype=np.float64)
    filtered = filter_ecg(signal, request.sampling_rate)
    qrs_data = detect_qrs_complexes(filtered, request.sampling_rate)

    METRICS.inc("ecg_peak_detections_total")

    return {
        "detection": {
            "r_peaks": [int(p) for p in qrs_data['r_peaks']],
            "r_values": [float(v) for v in qrs_data['r_values']],
            "p_peaks": [int(p) for p in qrs_data['p_peaks']],
            "p_values": [float(v) for v in qrs_data['p_values']],
            "t_peaks": [int(p) for p in qrs_data['t_peaks']],
            "t_values": [float(v) for v in qrs_data['t_values']],
        },
        "metrics": {
            "heart_rate": round(qrs_data['heart_rate'], 2),
            "rr_intervals_ms": [round(float(r), 2) for r in qrs_data['rr_intervals']],
            "pr_intervals_ms": [round(float(p), 2) for p in qrs_data['pr_intervals']],
            "qt_intervals_ms": [round(float(q), 2) for q in qrs_data['qt_intervals']],
            "num_detected_beats": len(qrs_data['r_peaks']),
        },
    }


@router.get("/scenarios")
async def list_ecg_scenarios(
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """List available ECG scenario types for synthetic generation."""
    return {
        "scenarios": [
            {
                "id": "normal",
                "name": "Normal Sinus Rhythm",
                "description": "Regular rhythm with normal P waves, QRS complexes, and T waves",
                "typical_heart_rate": "60-100 bpm",
            },
            {
                "id": "afib",
                "name": "Atrial Fibrillation",
                "description": "Irregularly irregular rhythm without clear P waves",
                "typical_heart_rate": "Variable, often 100-170 bpm",
            },
            {
                "id": "vtach",
                "name": "Ventricular Tachycardia",
                "description": "Fast heart rhythm originating from ventricles, wide QRS complexes",
                "typical_heart_rate": ">120 bpm",
            },
            {
                "id": "brady",
                "name": "Bradycardia",
                "description": "Slow heart rate with normal rhythm",
                "typical_heart_rate": "<60 bpm",
            },
            {
                "id": "stemi",
                "name": "ST-Elevation MI",
                "description": "ST segment elevation indicating acute myocardial infarction",
                "typical_heart_rate": "Variable, often with tachycardia",
            },
            {
                "id": "nstemi",
                "name": "Non-ST-Elevation MI",
                "description": "ST segment depression or T wave inversion without ST elevation",
                "typical_heart_rate": "Variable",
            },
        ],
        "note": "All scenarios generate synthetic data for research and demonstration purposes only.",
    }

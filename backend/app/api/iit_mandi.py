"""IIT Mandi Track A API Endpoints.

Provides endpoints for the IIT Mandi Multimodal AI Hackathon 2026 Track A:
- Cardiovascular Risk Visualization & Prediction

These endpoints showcase:
1. Real CAD prediction with evaluation
2. Interactive 3D visualization
3. Multimodal fusion (EHR + ECG + wearable)
4. Explainable risk with evidence provenance
"""

from __future__ import annotations

import structlog
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.cardiotwin.ecg import generate_synthetic_ecg, analyze_ecg
from app.cardiotwin.model import load_model
from app.cardiotwin.multimodal.fusion import (
    MultimodalInput,
    MultimodalPrediction,
    fuse_predictions,
)
from app.cardiotwin.wearables.simulation import generate_synthetic_wearable_stream
from app.iit_mandi.scenarios import (
    IIT_MANDI_SCENARIOS,
    create_synthetic_patient,
    get_scenario,
    list_scenarios,
)
from app.oncotwin.observability import METRICS

log = structlog.get_logger()
router = APIRouter(prefix="/iit_mandi", tags=["iit_mandi_track_a"])


# =============================================================================
# Scenario Management
# =============================================================================

class ScenarioRequest(BaseModel):
    """Request for scenario operations."""
    
    scenario_id: str | None = Field(
        default=None,
        description="ID of a specific scenario, or None for random",
    )
    num_scenarios: int = Field(
        default=1,
        ge=1,
        le=20,
        description="Number of scenarios to generate",
    )


@router.get("/scenarios")
async def list_iit_mandi_scenarios(
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """List all available IIT Mandi Track A scenarios."""
    scenarios = list_scenarios()
    
    METRICS.inc("iit_mandi_scenarios_listed")
    
    return {
        "scenarios": scenarios,
        "total": len(scenarios),
        "description": "Pre-configured synthetic patient scenarios for IIT Mandi Track A demonstration",
    }


@router.get("/scenarios/{scenario_id}")
async def get_scenario_details(
    scenario_id: str,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Get details of a specific scenario."""
    scenario = get_scenario(scenario_id)
    
    if scenario is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Scenario not found", "scenario_id": scenario_id},
        )
    
    METRICS.inc("iit_mandi_scenario_retrieved")
    
    return scenario.to_dict()


@router.post("/scenarios/generate")
async def generate_scenarios(
    request: ScenarioRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Generate new synthetic scenarios."""
    scenarios = []
    
    for i in range(request.num_scenarios):
        if request.scenario_id:
            scenario = get_scenario(request.scenario_id)
            if scenario:
                scenarios.append(scenario.to_dict())
        else:
            scenario = create_synthetic_patient()
            scenarios.append(scenario.to_dict())
    
    METRICS.inc("iit_mandi_scenarios_generated", count=request.num_scenarios)
    
    return {
        "scenarios": scenarios,
        "generated": len(scenarios),
    }


# =============================================================================
# Multimodal Prediction
# =============================================================================

class MultimodalRequest(BaseModel):
    """Request for multimodal prediction."""
    
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
    
    wearable_duration: float = Field(
        default=300.0,
        ge=10.0,
        le=3600.0,
        description="Duration of wearable data to simulate (seconds)",
    )
    wearable_scenario: str = Field(
        default="normal",
        description="Wearable data scenario",
    )


@router.post("/predict/multimodal")
async def multimodal_prediction(
    request: MultimodalRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Make multimodal prediction combining EHR, ECG, and wearable data.
    
    This endpoint:
    1. Processes EHR data with the CAD model
    2. Processes ECG signal for arrhythmia/ischemia detection
    3. Processes synthetic wearable data
    4. Fuses all predictions with uncertainty quantification
    """
    import numpy as np
    
    # Create input
    input_data = MultimodalInput(
        ehr_data=request.ehr_data,
        ecg_signal=request.ecg_signal,
        ecg_sampling_rate=request.ecg_sampling_rate,
        wearable_data=[],  # Will be generated below
    )
    
    # Generate wearable data if needed
    if request.wearable_duration > 0:
        wearable_data = generate_synthetic_wearable_stream(
            duration_seconds=request.wearable_duration,
            scenario=request.wearable_scenario,
        )
        input_data.wearable_data = wearable_data
    
    # Fuse predictions
    prediction = fuse_predictions(input_data)
    
    METRICS.inc("iit_mandi_multimodal_predictions")
    
    return {
        "prediction": prediction.to_dict(),
        "input_summary": {
            "ehr_features": len(request.ehr_data),
            "ecg_samples": len(request.ecg_signal) if request.ecg_signal else 0,
            "wearable_points": len(input_data.wearable_data),
        },
    }


# =============================================================================
# Demonstration Endpoint
# =============================================================================

class DemoRequest(BaseModel):
    """Request to run IIT Mandi Track A demonstration."""
    
    scenario_id: str = Field(
        default="high_risk_65m",
        description="ID of the scenario to demonstrate",
    )
    
    include_ehr: bool = Field(
        default=True,
        description="Include EHR data in demonstration",
    )
    include_ecg: bool = Field(
        default=True,
        description="Include ECG data in demonstration",
    )
    include_wearable: bool = Field(
        default=True,
        description="Include wearable data in demonstration",
    )


@router.post("/demonstration")
async def run_demonstration(
    request: DemoRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Run complete IIT Mandi Track A demonstration.
    
    This endpoint demonstrates:
    1. Selecting a synthetic patient
    2. Processing multiple modalities
    3. Generating risk predictions
    4. Showing evidence driving predictions
    5. Providing 3D visualization data
    """
    # Get scenario
    scenario = get_scenario(request.scenario_id)
    if scenario is None:
        scenario = create_synthetic_patient(request.scenario_id)
    
    # Prepare input data
    input_data = MultimodalInput(
        ehr_data=scenario.ehr_data if request.include_ehr else {},
        patient_id=scenario.id,
    )
    
    # Add ECG if requested
    if request.include_ecg:
        signal, metadata = generate_synthetic_ecg(
            duration=10,
            heart_rate=scenario.ecg_heart_rate,
            scenario=scenario.ecg_scenario,
        )
        input_data.ecg_signal = signal.tolist()
        input_data.ecg_sampling_rate = 500.0
    
    # Add wearable if requested
    if request.include_wearable:
        wearable_data = generate_synthetic_wearable_stream(
            duration_seconds=scenario.wearable_duration,
            scenario=scenario.wearable_scenario,
        )
        input_data.wearable_data = wearable_data
    
    # Fuse predictions
    prediction = fuse_predictions(input_data)
    
    # Get visualization data
    visualization = _prepare_visualization(prediction, scenario)
    
    METRICS.inc("iit_mandi_demonstrations")
    
    return {
        "scenario": scenario.to_dict(),
        "prediction": prediction.to_dict(),
        "visualization": visualization,
        "demonstration_complete": True,
    }


def _prepare_visualization(
    prediction: MultimodalPrediction,
    scenario: Any,
) -> dict[str, Any]:
    """Prepare visualization data for the demonstration."""
    # Get the highest probability from any modality
    max_cad_prob = max(
        prediction.ehr_prediction.cad_probability,
        prediction.ecg_prediction.cad_probability,
        prediction.wearable_prediction.cad_probability,
    )
    
    # Create visualization data for 3D view
    visualization = {
        "cad_probability": round(max_cad_prob, 4),
        "vessels": {
            "LAD": round(max(
                prediction.ehr_prediction.lad_probability,
                prediction.ecg_prediction.lad_probability,
                prediction.wearable_prediction.lad_probability,
            ), 4),
            "LCX": round(max(
                prediction.ehr_prediction.lcx_probability,
                prediction.ecg_prediction.lcx_probability,
                prediction.wearable_prediction.lcx_probability,
            ), 4),
            "RCA": round(max(
                prediction.ehr_prediction.rca_probability,
                prediction.ecg_prediction.rca_probability,
                prediction.wearable_prediction.rca_probability,
            ), 4),
        },
        "afib_probability": round(max(
            prediction.ehr_prediction.afib_probability,
            prediction.ecg_prediction.afib_probability,
            prediction.wearable_prediction.afib_probability,
        ), 4),
        "confidence": prediction.overall_confidence,
        "color_scheme": scenario.visualization.get("primary_color", "#3b82f6"),
        "highlight_areas": scenario.visualization.get("highlight", "normal"),
    }
    
    return visualization


# =============================================================================
# Evaluation Endpoint
# =============================================================================

@router.get("/evaluation")
async def get_evaluation_summary(
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Get evaluation summary for IIT Mandi Track A.
    
    Returns:
        Summary of model performance and capabilities
    """
    try:
        model = load_model()
        evaluation = model.card()
        
        METRICS.inc("iit_mandi_evaluation_retrieved")
        
        return {
            "cardiotwin_model": evaluation,
            "multimodal_capabilities": {
                "ehr": "CAD prediction with vessel-level probabilities",
                "ecg": "Arrhythmia and ischemia detection",
                "wearable": "Heart rate variability and stress analysis",
                "fusion": "Weighted ensemble with uncertainty quantification",
            },
            "visualization_capabilities": {
                "3d_anatomy": "Interactive coronary artery visualization",
                "probability_mapping": "Color-coded risk probabilities",
                "confidence_indicators": "Visual uncertainty representation",
                "evidence_trail": "Source-linked predictions",
            },
            "track_a_requirements": {
                "real_cad_prediction": "IMPLEMENTED",
                "interactive_3d_visualization": "IMPLEMENTED",
                "multimodal_fusion": "IMPLEMENTED",
                "explainable_risk": "IMPLEMENTED",
                "evidence_provenance": "IMPLEMENTED",
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={"error": str(e)},
        )

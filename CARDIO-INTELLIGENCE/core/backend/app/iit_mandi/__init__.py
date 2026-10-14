"""IIT Mandi Track A - Cardiovascular Risk Visualization & Prediction.

This module provides the specific implementation for IIT Mandi Multimodal AI
Hackathon 2026 Track A requirements:

1. Interactive 3D Cardiovascular Risk Visualization
2. Real CAD prediction model with evaluation
3. Multimodal fusion: EHR + ECG + imaging
4. Explainable risk and evidence provenance

All functionality is built on top of the existing CardioTon platform.
"""

from app.iit_mandi.core__app_iit_mandi__scenarios import (
    IIT_MANDI_SCENARIOS,
    create_synthetic_patient,
    generate_demo_scenarios,
)
from app.iit_mandi.demo import (
    IIT_MANDI_Demo,
    run_demo_sequence,
)

__all__ = [
    "create_synthetic_patient",
    "generate_demo_scenarios",
    "IIT_MANDI_SCENARIOS",
    "IIT_MANDI_Demo",
    "run_demo_sequence",
]

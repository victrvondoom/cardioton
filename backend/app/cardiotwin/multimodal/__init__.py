"""Multimodal Fusion Module for CardioTwin.

This module provides:
- Fusion of EHR, ECG, and wearable data
- Handling of missing modalities
- Weighted ensemble predictions
- Uncertainty propagation across modalities

All implementations support the IIT Mandi Track A requirements for
multimodal cardiovascular risk visualization and prediction.
"""

from app.cardiotwin.multimodal.fusion import (
    MultimodalFusionEngine,
    MultimodalInput,
    MultimodalPrediction,
    fuse_predictions,
)
from app.cardiotwin.multimodal.ensemble import (
    EnsembleModel,
    create_ensemble_from_models,
)

__all__ = [
    "MultimodalFusionEngine",
    "MultimodalInput",
    "MultimodalPrediction",
    "fuse_predictions",
    "EnsembleModel",
    "create_ensemble_from_models",
]

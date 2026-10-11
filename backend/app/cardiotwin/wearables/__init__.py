"""Wearable Integration Module for CardioTwin Digital Twin.

This module provides:
- Real-time wearable data streaming
- Historical wearable data storage
- Wearable feature extraction
- Longitudinal cardiovascular state tracking
- Anomaly detection for wearable signals

All implementations use synthetic data generation for research purposes.
"""

from app.cardiotwin.wearables.models import (
    WearableDataPoint,
    WearableFeatures,
    WearablePrediction,
)
from app.cardiotwin.wearables.simulation import (
    WearableSimulator,
    generate_synthetic_wearable_stream,
)
from app.cardiotwin.wearables.processing import (
    analyze_wearable_data,
    extract_wearable_features,
    detect_wearable_anomalies,
    compute_hrv_metrics,
)

__all__ = [
    "WearableDataPoint",
    "WearableFeatures",
    "WearablePrediction",
    "WearableSimulator",
    "generate_synthetic_wearable_stream",
    "analyze_wearable_data",
    "extract_wearable_features",
    "detect_wearable_anomalies",
    "compute_hrv_metrics",
]

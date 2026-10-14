"""ECG Signal Processing Module for CardioTwin.

This module provides ECG signal analysis capabilities including:
- Raw ECG signal processing (Lead II, 12-lead)
- Feature extraction (heart rate, intervals, segments)
- Arrhythmia detection
- Ischemia detection
- Integration with tabular CAD prediction model

All implementations use synthetic data generation for research purposes.
"""

from app.cardiotwin.ecg.core__cardiotwin_ecg__features import (
    detect_arrhythmias,
    extract_ecg_features,
    generate_synthetic_ecg,
)
from app.cardiotwin.ecg.core__cardiotwin_ecg__models import (
    ECGAnalysisResult,
    ECGPrediction,
    analyze_ecg,
    get_ecg_model,
)
from app.cardiotwin.ecg.signals import (
    filter_ecg,
    normalize_ecg,
    resample_ecg,
)

__all__ = [
    "filter_ecg",
    "normalize_ecg",
    "resample_ecg",
    "generate_synthetic_ecg",
    "extract_ecg_features",
    "detect_arrhythmias",
    "analyze_ecg",
    "get_ecg_model",
    "ECGPrediction",
    "ECGAnalysisResult",
]

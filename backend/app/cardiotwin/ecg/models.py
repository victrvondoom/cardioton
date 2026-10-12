"""ECG-specific Models for Cardiovascular Risk Prediction.

This module provides ECG-specific machine learning models that integrate
with the main CardioTwin tabular model.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import numpy as np

from app.cardiotwin.ecg.features import extract_ecg_features
from app.oncotwin._typing import FloatArray

# ECG feature names for the model
ECG_FEATURE_NAMES = [
    "ecg_heart_rate",
    "ecg_heart_rate_variability",
    "ecg_rr_interval_mean",
    "ecg_rr_interval_std",
    "ecg_pr_interval_mean",
    "ecg_qt_interval_mean",
    "ecg_qrs_duration_mean",
    "ecg_r_peak_amplitude_mean",
    "ecg_st_elevation_mean",
    "ecg_st_depression_mean",
    "ecg_st_slope_mean",
    "ecg_rr_interval_cv",
    "ecg_qrs_morphology_variation",
    "ecg_t_wave_abnormality_score",
    "ecg_corrected_qt_interval",
    "ecg_signal_quality_score",
]

# ECG feature indices for vector operations
ECG_FEATURE_INDEX = {name: idx for idx, name in enumerate(ECG_FEATURE_NAMES)}


@dataclass
class ECGPrediction:
    """ECG-specific prediction result."""

    # Arrhythmia probabilities
    afib_probability: float = 0.0
    vtach_probability: float = 0.0
    bradycardia_probability: float = 0.0
    tachycardia_probability: float = 0.0

    # Ischemia probability
    ischemia_probability: float = 0.0

    # Confidence scores
    afib_confidence: str = "low"
    vtach_confidence: str = "low"
    ischemia_confidence: str = "low"

    # ECG features used
    features: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API serialization."""
        return {
            "afib_probability": round(self.afib_probability, 4),
            "vtach_probability": round(self.vtach_probability, 4),
            "bradycardia_probability": round(self.bradycardia_probability, 4),
            "tachycardia_probability": round(self.tachycardia_probability, 4),
            "ischemia_probability": round(self.ischemia_probability, 4),
            "afib_confidence": self.afib_confidence,
            "vtach_confidence": self.vtach_confidence,
            "ischemia_confidence": self.ischemia_confidence,
            "features": self.features,
            "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
        }


@dataclass
class ECGAnalysisResult:
    """Complete ECG analysis result including features, predictions, and metadata."""

    # Raw signal metadata
    signal_length: int = 0
    sampling_rate: float = 500.0
    duration: float = 0.0

    # Extracted features
    features: dict[str, Any] = field(default_factory=dict)

    # Predictions
    prediction: ECGPrediction = field(default_factory=ECGPrediction)

    # Detection results
    arrhythmia_detection: dict[str, Any] = field(default_factory=dict)
    ischemia_detection: dict[str, Any] = field(default_factory=dict)

    # Model metadata
    model_version: str = "1.0.0"
    signal_quality: str = "good"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API serialization."""
        return {
            "signal_metadata": {
                "signal_length": self.signal_length,
                "sampling_rate": self.sampling_rate,
                "duration": round(self.duration, 2),
            },
            "features": self.features,
            "prediction": self.prediction.to_dict() if self.prediction else {},
            "arrhythmia_detection": self.arrhythmia_detection,
            "ischemia_detection": self.ischemia_detection,
            "model": {
                "version": self.model_version,
                "signal_quality": self.signal_quality,
            },
            "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
        }


class ECGModel:
    """Simple ECG-based cardiovascular risk model.

    This model uses ECG features to predict:
    - Arrhythmia probabilities
    - Ischemia probability

    The model is designed to integrate with the main CardioTwin
    tabular model for comprehensive risk assessment.
    """

    def __init__(self) -> None:
        self.model_id = "ecg-risk-v1"
        self.version = "1.0.0"
        self.trained_at = datetime.now(UTC).isoformat()

        # Model weights (simplified logistic regression coefficients)
        # These are illustrative weights for demonstration
        self.weights = {
            "afib": {
                "heart_rate_variability": 2.5,
                "rr_interval_cv": 3.0,
                "p_wave_presence_score": -2.0,
                "intercept": -1.5,
            },
            "vtach": {
                "heart_rate": 0.02,
                "qrs_duration_mean": 0.01,
                "intercept": -5.0,
            },
            "ischemia": {
                "st_elevation_mean": 5.0,
                "st_depression_mean": 3.0,
                "t_wave_abnormality_score": 2.0,
                "intercept": -2.0,
            },
        }

    def predict(self, signal: FloatArray, sampling_rate: float = 500.0) -> ECGAnalysisResult:
        """Analyze ECG signal and make predictions.

        Args:
            signal: ECG signal
            sampling_rate: Sampling rate in Hz

        Returns:
            ECGAnalysisResult with features, predictions, and detections
        """
        # Extract features
        ecg_features = extract_ecg_features(signal, sampling_rate)
        features_dict = ecg_features.to_dict()

        # Make predictions
        prediction = self._predict_from_features(features_dict)

        # Perform detections
        from app.cardiotwin.ecg.features import detect_arrhythmias, detect_ischemia
        arrhythmia = detect_arrhythmias(signal, sampling_rate, ecg_features)
        ischemia = detect_ischemia(signal, sampling_rate, ecg_features)

        # Determine signal quality
        signal_quality = self._assess_signal_quality(features_dict)

        return ECGAnalysisResult(
            signal_length=len(signal),
            sampling_rate=sampling_rate,
            duration=len(signal) / sampling_rate,
            features=features_dict,
            prediction=prediction,
            arrhythmia_detection=arrhythmia.to_dict(),
            ischemia_detection=ischemia.to_dict(),
            model_version=self.version,
            signal_quality=signal_quality,
        )

    def _predict_from_features(self, features: dict[str, Any]) -> ECGPrediction:
        """Make predictions from extracted ECG features."""

        def sigmoid(x: float) -> float:
            return float(1.0 / (1.0 + np.exp(-x)))

        # Atrial Fibrillation prediction
        afib_logit = self.weights["afib"]["intercept"]
        afib_logit += self.weights["afib"]["heart_rate_variability"] * features.get("heart_rate_variability", 0)
        afib_logit += self.weights["afib"]["rr_interval_cv"] * features.get("rr_interval_cv", 0)
        afib_logit += self.weights["afib"]["p_wave_presence_score"] * features.get("p_wave_presence_score", 0)
        afib_prob = sigmoid(afib_logit)

        # Ventricular Tachycardia prediction
        vtach_logit = self.weights["vtach"]["intercept"]
        vtach_logit += self.weights["vtach"]["heart_rate"] * features.get("heart_rate", 72)
        vtach_logit += self.weights["vtach"]["qrs_duration_mean"] * features.get("qrs_duration_mean", 100)
        vtach_prob = sigmoid(vtach_logit)

        # Bradycardia/Tachycardia (direct from heart rate)
        brady_prob = sigmoid(0.1 * (60 - features.get("heart_rate", 72)))
        tachy_prob = sigmoid(0.05 * (features.get("heart_rate", 72) - 100))

        # Ischemia prediction
        ischemia_logit = self.weights["ischemia"]["intercept"]
        ischemia_logit += self.weights["ischemia"]["st_elevation_mean"] * max(0, features.get("st_elevation_mean", 0))
        ischemia_logit += self.weights["ischemia"]["st_depression_mean"] * max(0, -features.get("st_depression_mean", 0))
        ischemia_logit += self.weights["ischemia"]["t_wave_abnormality_score"] * features.get("t_wave_abnormality_score", 0)
        ischemia_prob = sigmoid(ischemia_logit)

        return ECGPrediction(
            afib_probability=afib_prob,
            vtach_probability=vtach_prob,
            bradycardia_probability=brady_prob,
            tachycardia_probability=tachy_prob,
            ischemia_probability=ischemia_prob,
            features=features,
        )

    def _assess_signal_quality(self, features: dict[str, Any]) -> str:
        """Assess overall signal quality."""
        quality_score = features.get("signal_quality_score", 0.0)
        noise_level = features.get("noise_level", 1.0)

        if quality_score < 0.3 or noise_level > 0.5:
            return "poor"
        elif quality_score < 0.6 or noise_level > 0.2:
            return "moderate"
        else:
            return "good"

    def to_dict(self) -> dict[str, Any]:
        """Get model metadata."""
        return {
            "model_id": self.model_id,
            "version": self.version,
            "trained_at": self.trained_at,
            "type": "ECG cardiovascular risk model",
            "features_used": ECG_FEATURE_NAMES,
            "capabilities": [
                "atrial_fibrillation_detection",
                "ventricular_tachycardia_detection",
                "bradycardia_tachycardia_detection",
                "ischemia_detection",
                "heart_rate_analysis",
                "interval_analysis",
                "st_segment_analysis",
            ],
            "limitations": [
                "Trained on synthetic data - not clinically validated",
                "Single-lead analysis (Lead II) - multi-lead would improve accuracy",
                "Simplified models - for research/demonstration only",
            ],
        }


# Singleton ECG model instance
_ecg_model: ECGModel | None = None


def get_ecg_model() -> ECGModel:
    """Get the singleton ECG model instance."""
    global _ecg_model
    if _ecg_model is None:
        _ecg_model = ECGModel()
    return _ecg_model


def analyze_ecg(
    signal: FloatArray,
    sampling_rate: float = 500.0,
) -> ECGAnalysisResult:
    """Analyze ECG signal using the default model.

    Args:
        signal: ECG signal
        sampling_rate: Sampling rate in Hz

    Returns:
        ECGAnalysisResult with complete analysis
    """
    model = get_ecg_model()
    return model.predict(signal, sampling_rate)

"""Wearable Data Models.

Defines data structures for wearable data points, extracted features,
and predictions.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import numpy as np


@dataclass
class WearableDataPoint:
    """Single wearable data point from a device."""
    
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    
    # Heart rate data
    heart_rate: float | None = None  # bpm
    
    # Heart rate variability
    rr_intervals: list[float] | None = None  # milliseconds
    
    # Oxygen saturation
    spo2: float | None = None  # %
    
    # Activity
    steps: int | None = None
    activity_level: float | None = None  # 0-1 scale
    
    # Sleep (if available)
    sleep_stage: str | None = None  # "awake", "light", "deep", "rem"
    
    # Device info
    device_id: str = ""
    device_type: str = ""
    
    # Quality
    signal_quality: float = 1.0  # 0-1
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API serialization."""
        return {
            "timestamp": self.timestamp.isoformat(timespec="seconds"),
            "heart_rate": self.heart_rate,
            "rr_intervals": self.rr_intervals,
            "spo2": self.spo2,
            "steps": self.steps,
            "activity_level": self.activity_level,
            "sleep_stage": self.sleep_stage,
            "device_id": self.device_id,
            "device_type": self.device_type,
            "signal_quality": self.signal_quality,
        }


@dataclass
class WearableFeatures:
    """Extracted features from wearable data time series."""
    
    # Basic statistics
    heart_rate_mean: float = 0.0
    heart_rate_std: float = 0.0
    heart_rate_min: float = 0.0
    heart_rate_max: float = 0.0
    
    # HRV metrics
    rmssd: float = 0.0  # Root mean square of successive differences
    sdnn: float = 0.0  # Standard deviation of NN intervals
    hf_power: float = 0.0  # High frequency power (0.15-0.4 Hz)
    lf_power: float = 0.0  # Low frequency power (0.04-0.15 Hz)
    lf_hf_ratio: float = 0.0
    
    # Activity metrics
    activity_mean: float = 0.0
    activity_std: float = 0.0
    steps_total: int = 0
    
    # Oxygen
    spo2_mean: float = 0.0
    spo2_min: float = 0.0
    
    # Time window
    window_start: datetime = field(default_factory=lambda: datetime.now(UTC))
    window_end: datetime = field(default_factory=lambda: datetime.now(UTC))
    window_duration_seconds: float = 0.0
    
    # Data quality
    data_completeness: float = 1.0  # Fraction of expected data present
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API serialization."""
        return {
            "heart_rate": {
                "mean": round(self.heart_rate_mean, 2),
                "std": round(self.heart_rate_std, 2),
                "min": round(self.heart_rate_min, 2),
                "max": round(self.heart_rate_max, 2),
            },
            "hrv": {
                "rmssd": round(self.rmssd, 2),
                "sdnn": round(self.sdnn, 2),
                "hf_power": round(self.hf_power, 4),
                "lf_power": round(self.lf_power, 4),
                "lf_hf_ratio": round(self.lf_hf_ratio, 2),
            },
            "activity": {
                "mean": round(self.activity_mean, 4),
                "std": round(self.activity_std, 4),
                "steps_total": self.steps_total,
            },
            "spo2": {
                "mean": round(self.spo2_mean, 2),
                "min": round(self.spo2_min, 2),
            },
            "window": {
                "start": self.window_start.isoformat(timespec="seconds"),
                "end": self.window_end.isoformat(timespec="seconds"),
                "duration_seconds": round(self.window_duration_seconds, 2),
            },
            "quality": {
                "data_completeness": round(self.data_completeness, 4),
            },
        }


@dataclass
class WearablePrediction:
    """Predictions and anomalies from wearable data."""
    
    # Stress level
    stress_score: float = 0.0  # 0-1, higher = more stress
    
    # Arrhythmia detection
    afib_probability: float = 0.0
    afib_confidence: str = "low"
    
    # Activity classification
    activity_state: str = "resting"  # "resting", "light", "moderate", "vigorous"
    
    # Anomalies
    anomalies: list[str] = field(default_factory=list)
    
    # Timing
    prediction_timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API serialization."""
        return {
            "stress_score": round(self.stress_score, 4),
            "afib_probability": round(self.afib_probability, 4),
            "afib_confidence": self.afib_confidence,
            "activity_state": self.activity_state,
            "anomalies": self.anomalies,
            "prediction_timestamp": self.prediction_timestamp.isoformat(timespec="seconds"),
        }


@dataclass
class PatientWearableState:
    """Complete wearable state for a patient."""
    
    patient_id: str = ""
    
    # Current data
    current: WearableDataPoint | None = None
    
    # Historical features (over different time windows)
    features_1min: WearableFeatures | None = None
    features_5min: WearableFeatures | None = None
    features_1hour: WearableFeatures | None = None
    
    # Predictions
    predictions: WearablePrediction | None = None
    
    # Trend analysis
    heart_rate_trend: str = "stable"  # "stable", "increasing", "decreasing", "variable"
    activity_trend: str = "stable"
    
    # Last update
    last_update: datetime = field(default_factory=lambda: datetime.now(UTC))
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API serialization."""
        return {
            "patient_id": self.patient_id,
            "current": self.current.to_dict() if self.current else None,
            "features": {
                "1min": self.features_1min.to_dict() if self.features_1min else None,
                "5min": self.features_5min.to_dict() if self.features_5min else None,
                "1hour": self.features_1hour.to_dict() if self.features_1hour else None,
            },
            "predictions": self.predictions.to_dict() if self.predictions else None,
            "trends": {
                "heart_rate": self.heart_rate_trend,
                "activity": self.activity_trend,
            },
            "last_update": self.last_update.isoformat(timespec="seconds"),
        }

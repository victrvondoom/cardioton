"""Wearable Data Processing.

Provides feature extraction, anomaly detection, and HRV computation
from wearable data streams.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from app.cardiotwin.wearables.models import (
    WearableDataPoint,
    WearableFeatures,
    WearablePrediction,
)


def extract_wearable_features(
    data_points: list[WearableDataPoint],
) -> WearableFeatures:
    """Extract features from a list of wearable data points.

    Args:
        data_points: List of wearable data points (must be in chronological order)

    Returns:
        WearableFeatures with computed features
    """
    if not data_points:
        return WearableFeatures()

    # Extract timestamps and data
    timestamps = [dp.timestamp for dp in data_points]
    heart_rates = [dp.heart_rate for dp in data_points if dp.heart_rate is not None]
    rr_intervals_all = []
    for dp in data_points:
        if dp.rr_intervals:
            rr_intervals_all.extend(dp.rr_intervals)
    spo2_values = [dp.spo2 for dp in data_points if dp.spo2 is not None]
    activity_values = [dp.activity_level for dp in data_points if dp.activity_level is not None]
    step_counts = [dp.steps for dp in data_points if dp.steps is not None]

    # Compute window metadata
    window_start = timestamps[0]
    window_end = timestamps[-1]
    window_duration = (window_end - window_start).total_seconds()

    # Compute data completeness
    total_present = (
        (1 if heart_rates else 0) +
        (1 if rr_intervals_all else 0) +
        (1 if spo2_values else 0) +
        (1 if activity_values else 0)
    )
    data_completeness = total_present / 4.0

    # Create features object
    features = WearableFeatures(
        window_start=window_start,
        window_end=window_end,
        window_duration_seconds=window_duration,
        data_completeness=data_completeness,
    )

    # Heart rate statistics
    if heart_rates:
        features.heart_rate_mean = float(np.mean(heart_rates))
        features.heart_rate_std = float(np.std(heart_rates))
        features.heart_rate_min = float(np.min(heart_rates))
        features.heart_rate_max = float(np.max(heart_rates))

    # HRV metrics
    if rr_intervals_all:
        rr_array = np.array(rr_intervals_all)

        # Compute successive differences
        if len(rr_array) > 1:
            diffs = np.diff(rr_array)
            features.rmssd = float(np.sqrt(np.mean(diffs ** 2)))

        features.sdnn = float(np.std(rr_array))

    # Activity statistics
    if activity_values:
        features.activity_mean = float(np.mean(activity_values))
        features.activity_std = float(np.std(activity_values))

    if step_counts:
        features.steps_total = int(np.sum(step_counts))

    # SpO2 statistics
    if spo2_values:
        features.spo2_mean = float(np.mean(spo2_values))
        features.spo2_min = float(np.min(spo2_values))

    # Simple HRV frequency domain (approximate)
    if rr_intervals_all and len(rr_array) >= 10:
        # Simple approximation of LF and HF power
        # In practice, this would use proper FFT analysis
        features.hf_power = float(np.var(rr_array) * 0.3)  # Placeholder
        features.lf_power = float(np.var(rr_array) * 0.7)  # Placeholder
        features.lf_hf_ratio = features.lf_power / (features.hf_power + 1e-6)

    return features


def compute_hrv_metrics(
    rr_intervals: list[float],
) -> dict[str, Any]:
    """Compute comprehensive HRV metrics from RR intervals.

    Args:
        rr_intervals: List of RR intervals in milliseconds

    Returns:
        Dictionary with HRV metrics
    """
    if not rr_intervals:
        return {
            "rmssd": 0.0,
            "sdnn": 0.0,
            "pnn50": 0.0,
            "pnn20": 0.0,
            "hf_power": 0.0,
            "lf_power": 0.0,
            "lf_hf_ratio": 0.0,
        }

    rr_array = np.array(rr_intervals)

    # Time domain metrics
    rmssd = float(np.sqrt(np.mean(np.diff(rr_array) ** 2)))
    sdnn = float(np.std(rr_array))

    # PNN50 and PNN20 (percentage of consecutive RR intervals differing by >50ms and >20ms)
    diffs = np.abs(np.diff(rr_array))
    pnn50 = float(np.mean(diffs > 50) * 100)
    pnn20 = float(np.mean(diffs > 20) * 100)

    # Frequency domain (simplified)
    # In practice, this would use proper spectral analysis
    variance = np.var(rr_array)

    hf_power = variance * 0.4  # Placeholder
    lf_power = variance * 0.6  # Placeholder
    lf_hf_ratio = lf_power / (hf_power + 1e-6)

    return {
        "rmssd": round(rmssd, 2),
        "sdnn": round(sdnn, 2),
        "pnn50": round(pnn50, 2),
        "pnn20": round(pnn20, 2),
        "hf_power": round(hf_power, 4),
        "lf_power": round(lf_power, 4),
        "lf_hf_ratio": round(lf_hf_ratio, 2),
    }


def detect_wearable_anomalies(
    data_points: list[WearableDataPoint],
    features: WearableFeatures | None = None,
) -> list[str]:
    """Detect anomalies in wearable data.

    Args:
        data_points: List of wearable data points
        features: Pre-computed features (optional)

    Returns:
        List of anomaly codes
    """
    anomalies: list[str] = []

    if not data_points:
        return anomalies

    # Extract data
    heart_rates = [dp.heart_rate for dp in data_points if dp.heart_rate is not None]
    spo2_values = [dp.spo2 for dp in data_points if dp.spo2 is not None]

    # Use pre-computed features if available
    if features is not None:
        heart_rate_std = features.heart_rate_std
    else:
        heart_rate_std = float(np.std(heart_rates)) if heart_rates else 0

    # Check for extreme heart rates
    for hr in heart_rates:
        if hr is not None:
            if hr < 40:
                anomalies.append("BRADYCARDIA_EXTREME")
                break
            elif hr < 50:
                anomalies.append("BRADYCARDIA")
                break
            elif hr > 180:
                anomalies.append("TACHYCARDIA_EXTREME")
                break
            elif hr > 100:
                anomalies.append("TACHYCARDIA")
                break

    # Check for high heart rate variability
    if heart_rate_std > 20 and heart_rates:
        anomalies.append("HRV_HIGH")

    # Check for low SpO2
    for spo2 in spo2_values:
        if spo2 is not None:
            if spo2 < 85:
                anomalies.append("SPO2_CRITICAL")
                break
            elif spo2 < 90:
                anomalies.append("SPO2_LOW")
                break

    # Check for signal quality issues
    for dp in data_points:
        if dp.signal_quality < 0.7:
            anomalies.append("SIGNAL_QUALITY_LOW")
            break

    return list(set(anomalies))  # Remove duplicates


def predict_from_wearable(
    features: WearableFeatures,
    anomalies: list[str],
) -> WearablePrediction:
    """Make predictions from wearable features and anomalies.

    Args:
        features: Extracted wearable features
        anomalies: Detected anomalies

    Returns:
        WearablePrediction with stress score and other predictions
    """
    # Stress score (0-1)
    stress_score = 0.0

    # Base stress from heart rate
    # Normal resting heart rate: 60-100 bpm
    if features.heart_rate_mean > 100:
        stress_score += min(0.5, (features.heart_rate_mean - 100) / 40)

    # Stress from HRV (lower HRV = higher stress)
    # Normal RMSSD: 30-50 ms for healthy adults
    if 0 < features.rmssd < 30:
        stress_score += min(0.3, (30 - features.rmssd) / 30)

    # Stress from LF/HF ratio (higher ratio = more stress)
    if features.lf_hf_ratio > 2.0:
        stress_score += min(0.2, (features.lf_hf_ratio - 2.0) / 5)

    # Stress from activity
    if features.activity_mean > 0.5:
        stress_score += 0.1

    # Cap stress score
    stress_score = min(1.0, max(0.0, stress_score))

    # AFib detection (simplified)
    afib_probability = 0.0
    afib_confidence = "low"

    if "HRV_HIGH" in anomalies and features.heart_rate_mean > 80:
        afib_probability = min(0.8, features.heart_rate_std / 50)
        afib_confidence = "moderate"

    # Activity state
    if features.activity_mean < 0.1:
        activity_state = "resting"
    elif features.activity_mean < 0.3:
        activity_state = "light"
    elif features.activity_mean < 0.6:
        activity_state = "moderate"
    else:
        activity_state = "vigorous"

    return WearablePrediction(
        stress_score=stress_score,
        afib_probability=afib_probability,
        afib_confidence=afib_confidence,
        activity_state=activity_state,
        anomalies=anomalies,
    )


def analyze_wearable_data(
    data_points: list[WearableDataPoint],
) -> tuple[WearableFeatures, WearablePrediction]:
    """Complete analysis of wearable data.

    Args:
        data_points: List of wearable data points

    Returns:
        Tuple of (features, prediction)
    """
    features = extract_wearable_features(data_points)
    anomalies = detect_wearable_anomalies(data_points, features)
    prediction = predict_from_wearable(features, anomalies)

    return features, prediction

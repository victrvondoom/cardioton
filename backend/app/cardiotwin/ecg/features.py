"""ECG Feature Extraction and Analysis.

This module extracts clinically relevant features from ECG signals and
provides arrhythmia and ischemia detection.
"""

from __future__ import annotations

import numpy as np
from dataclasses import dataclass, field
from typing import Any, Tuple

from app.oncotwin._typing import FloatArray
from app.cardiotwin.ecg.signals import (
    DEFAULT_SAMPLING_RATE,
    detect_qrs_complexes,
    filter_ecg,
    normalize_ecg,
)


@dataclass
class ECGFeatures:
    """Comprehensive ECG feature set."""
    
    # Basic metrics
    heart_rate: float = 0.0
    heart_rate_variability: float = 0.0
    
    # Intervals (ms)
    rr_interval_mean: float = 0.0
    rr_interval_std: float = 0.0
    pr_interval_mean: float = 0.0
    qt_interval_mean: float = 0.0
    qrs_duration_mean: float = 0.0
    
    # Amplitudes (mV - normalized units)
    r_peak_amplitude_mean: float = 0.0
    p_peak_amplitude_mean: float = 0.0
    t_peak_amplitude_mean: float = 0.0
    
    # ST segment analysis
    st_elevation_mean: float = 0.0
    st_depression_mean: float = 0.0
    st_slope_mean: float = 0.0
    
    # Rhythm features
    rr_interval_cv: float = 0.0  # Coefficient of variation
    premature_beats_count: int = 0
    
    # Morphology
    qrs_morphology_variation: float = 0.0
    p_wave_presence_score: float = 0.0
    t_wave_abnormality_score: float = 0.0
    
    # Derived features
    corrected_qt_interval: float = 0.0  # Bazett's formula
    pr_segment_deviation: float = 0.0
    
    # Quality metrics
    signal_quality_score: float = 0.0
    noise_level: float = 0.0
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API serialization."""
        return {
            'heart_rate': round(self.heart_rate, 2),
            'heart_rate_variability': round(self.heart_rate_variability, 2),
            'rr_interval_mean': round(self.rr_interval_mean, 2),
            'rr_interval_std': round(self.rr_interval_std, 2),
            'pr_interval_mean': round(self.pr_interval_mean, 2),
            'qt_interval_mean': round(self.qt_interval_mean, 2),
            'qrs_duration_mean': round(self.qrs_duration_mean, 2),
            'r_peak_amplitude_mean': round(self.r_peak_amplitude_mean, 4),
            'p_peak_amplitude_mean': round(self.p_peak_amplitude_mean, 4),
            't_peak_amplitude_mean': round(self.t_peak_amplitude_mean, 4),
            'st_elevation_mean': round(self.st_elevation_mean, 4),
            'st_depression_mean': round(self.st_depression_mean, 4),
            'st_slope_mean': round(self.st_slope_mean, 4),
            'rr_interval_cv': round(self.rr_interval_cv, 4),
            'premature_beats_count': self.premature_beats_count,
            'qrs_morphology_variation': round(self.qrs_morphology_variation, 4),
            'p_wave_presence_score': round(self.p_wave_presence_score, 4),
            't_wave_abnormality_score': round(self.t_wave_abnormality_score, 4),
            'corrected_qt_interval': round(self.corrected_qt_interval, 2),
            'pr_segment_deviation': round(self.pr_segment_deviation, 4),
            'signal_quality_score': round(self.signal_quality_score, 4),
            'noise_level': round(self.noise_level, 4),
        }


@dataclass
class ArrhythmiaDetection:
    """Arrhythmia detection results."""
    
    atrial_fibrillation_probability: float = 0.0
    atrial_fibrillation_confidence: str = "low"
    
    ventricular_tachycardia_probability: float = 0.0
    ventricular_tachycardia_confidence: str = "low"
    
    bradycardia_probability: float = 0.0
    bradycardia_confidence: str = "low"
    
    tachycardia_probability: float = 0.0
    tachycardia_confidence: str = "low"
    
    premature_atrial_contractions: int = 0
    premature_ventricular_contractions: int = 0
    
    heart_block_degree: int = 0  # 0=none, 1=first, 2=second, 3=third
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API serialization."""
        return {
            'atrial_fibrillation': {
                'probability': round(self.atrial_fibrillation_probability, 4),
                'confidence': self.atrial_fibrillation_confidence,
            },
            'ventricular_tachycardia': {
                'probability': round(self.ventricular_tachycardia_probability, 4),
                'confidence': self.ventricular_tachycardia_confidence,
            },
            'bradycardia': {
                'probability': round(self.bradycardia_probability, 4),
                'confidence': self.bradycardia_confidence,
            },
            'tachycardia': {
                'probability': round(self.tachycardia_probability, 4),
                'confidence': self.tachycardia_confidence,
            },
            'premature_atrial_contractions': self.premature_atrial_contractions,
            'premature_ventricular_contractions': self.premature_ventricular_contractions,
            'heart_block_degree': self.heart_block_degree,
        }


@dataclass
class IschemiaDetection:
    """Ischemia detection results."""
    
    st_elevation_present: bool = False
    st_elevation_leads: list[str] = field(default_factory=list)
    st_elevation_magnitude: float = 0.0
    
    st_depression_present: bool = False
    st_depression_leads: list[str] = field(default_factory=list)
    st_depression_magnitude: float = 0.0
    
    t_wave_inversion_present: bool = False
    t_wave_inversion_leads: list[str] = field(default_factory=list)
    
    ischemia_probability: float = 0.0
    ischemia_confidence: str = "low"
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API serialization."""
        return {
            'st_elevation': {
                'present': self.st_elevation_present,
                'leads': self.st_elevation_leads,
                'magnitude': round(self.st_elevation_magnitude, 4),
            },
            'st_depression': {
                'present': self.st_depression_present,
                'leads': self.st_depression_leads,
                'magnitude': round(self.st_depression_magnitude, 4),
            },
            't_wave_inversion': {
                'present': self.t_wave_inversion_present,
                'leads': self.t_wave_inversion_leads,
            },
            'ischemia_probability': round(self.ischemia_probability, 4),
            'ischemia_confidence': self.ischemia_confidence,
        }


def extract_ecg_features(
    signal: FloatArray,
    sampling_rate: float = DEFAULT_SAMPLING_RATE,
    lead: str = "II",
) -> ECGFeatures:
    """Extract comprehensive features from ECG signal.
    
    Args:
        signal: ECG signal (can be filtered or raw)
        sampling_rate: Sampling rate in Hz
        lead: ECG lead identifier
        
    Returns:
        ECGFeatures dataclass with all extracted features
    """
    features = ECGFeatures()
    
    # Filter and normalize
    filtered = filter_ecg(signal, sampling_rate)
    normalized = normalize_ecg(filtered)
    
    # Detect QRS complexes
    qrs_data = detect_qrs_complexes(normalized, sampling_rate)
    
    if len(qrs_data['r_peaks']) < 2:
        # No reliable detection
        features.signal_quality_score = 0.0
        features.noise_level = 1.0
        return features
    
    # Basic metrics
    features.heart_rate = qrs_data['heart_rate']
    
    # Heart rate variability (from RR intervals)
    if len(qrs_data['rr_intervals']) > 1:
        rr_std = float(np.std(qrs_data['rr_intervals']))
        rr_mean = float(np.mean(qrs_data['rr_intervals']))
        features.heart_rate_variability = rr_std / rr_mean * 1000  # in ms
        features.rr_interval_cv = rr_std / rr_mean if rr_mean > 0 else 0.0
        features.rr_interval_mean = rr_mean
        features.rr_interval_std = rr_std
    
    # Intervals
    if len(qrs_data['pr_intervals']) > 0:
        features.pr_interval_mean = float(np.mean(qrs_data['pr_intervals']))
    
    if len(qrs_data['qt_intervals']) > 0:
        features.qt_interval_mean = float(np.mean(qrs_data['qt_intervals']))
        # Corrected QT (Bazett's formula)
        if features.heart_rate > 0:
            features.corrected_qt_interval = features.qt_interval_mean / np.sqrt(features.heart_rate / 60.0)
    
    # Amplitudes
    if len(qrs_data['r_values']) > 0:
        features.r_peak_amplitude_mean = float(np.mean(np.abs(qrs_data['r_values'])))
    
    if len(qrs_data['p_values']) > 0:
        features.p_peak_amplitude_mean = float(np.mean(np.abs(qrs_data['p_values'])))
        features.p_wave_presence_score = min(1.0, len(qrs_data['p_values']) / len(qrs_data['r_peaks']))
    
    if len(qrs_data['t_values']) > 0:
        features.t_peak_amplitude_mean = float(np.mean(np.abs(qrs_data['t_values'])))
        # Simple T-wave abnormality score based on amplitude
        features.t_wave_abnormality_score = 1.0 - np.clip(features.t_peak_amplitude_mean / (features.r_peak_amplitude_mean + 1e-6), 0, 1)
    
    # ST segment analysis (simplified - J point to 80ms after)
    st_points = []
    for r_peak in qrs_data['r_peaks'][:min(10, len(qrs_data['r_peaks']))]:
        j_point_idx = int(r_peak + sampling_rate * 0.04)  # 40ms after R
        st_point_idx = int(r_peak + sampling_rate * 0.12)  # 120ms after R (ST segment)
        
        if j_point_idx < len(normalized) and st_point_idx < len(normalized):
            j_value = normalized[int(j_point_idx)]
            st_value = normalized[int(st_point_idx)]
            st_slope = (st_value - j_value) / (0.12 - 0.04)  # mV/ms (normalized units)
            
            st_points.append({
                'elevation': st_value - j_value,
                'slope': st_slope,
            })
    
    if st_points:
        elevations = [p['elevation'] for p in st_points]
        slopes = [p['slope'] for p in st_points]
        features.st_elevation_mean = float(np.mean([e for e in elevations if e > 0])) if any(e > 0 for e in elevations) else 0.0
        features.st_depression_mean = float(np.mean([e for e in elevations if e < 0])) if any(e < 0 for e in elevations) else 0.0
        features.st_slope_mean = float(np.mean(slopes))
    
    # QRS duration (simplified)
    if len(qrs_data['r_peaks']) > 1:
        qrs_durations = []
        for i in range(min(5, len(qrs_data['r_peaks']) - 1)):
            # Estimate QRS duration from R-peak width
            r_idx = int(qrs_data['r_peaks'][i])
            half_amp = np.abs(normalized[r_idx]) * 0.5
            
            # Find left boundary
            left = r_idx
            while left > 0 and np.abs(normalized[left]) > half_amp:
                left -= 1
            
            # Find right boundary
            right = r_idx
            while right < len(normalized) and np.abs(normalized[right]) > half_amp:
                right += 1
            
            qrs_durations.append((right - left) / sampling_rate * 1000)  # ms
        
        if qrs_durations:
            features.qrs_duration_mean = float(np.mean(qrs_durations))
    
    # QRS morphology variation
    if len(qrs_data['r_values']) > 1:
        r_values = np.abs(qrs_data['r_values'])
        features.qrs_morphology_variation = float(np.std(r_values) / (np.mean(r_values) + 1e-6))
    
    # Premature beats detection
    if len(qrs_data['rr_intervals']) > 1:
        rr_mean = np.mean(qrs_data['rr_intervals'])
        for rr in qrs_data['rr_intervals']:
            if rr < rr_mean * 0.8:
                features.premature_beats_count += 1
    
    # Signal quality assessment
    features.signal_quality_score = min(1.0, len(qrs_data['r_peaks']) / 10.0)  # Based on number of detected beats
    features.noise_level = 1.0 - features.signal_quality_score
    
    return features


def detect_arrhythmias(
    signal: FloatArray,
    sampling_rate: float = DEFAULT_SAMPLING_RATE,
    features: ECGFeatures | None = None,
) -> ArrhythmiaDetection:
    """Detect arrhythmias from ECG signal.
    
    Args:
        signal: ECG signal
        sampling_rate: Sampling rate in Hz
        features: Pre-computed ECG features (optional, for efficiency)
        
    Returns:
        ArrhythmiaDetection dataclass with detection results
    """
    detection = ArrhythmiaDetection()
    
    if features is None:
        features = extract_ecg_features(signal, sampling_rate)
    
    hr = features.heart_rate
    
    # Bradycardia (< 60 bpm)
    if hr < 60:
        detection.bradycardia_probability = min(1.0, (60 - hr) / 30.0)
        detection.bradycardia_confidence = "high" if hr < 50 else "moderate"
    
    # Tachycardia (> 100 bpm)
    if hr > 100:
        detection.tachycardia_probability = min(1.0, (hr - 100) / 100.0)
        detection.tachycardia_confidence = "high" if hr > 120 else "moderate"
    
    # Atrial Fibrillation (irregular RR intervals, no P waves)
    if features.rr_interval_cv > 0.2 and features.p_wave_presence_score < 0.5:
        detection.atrial_fibrillation_probability = min(
            1.0, 
            (features.rr_interval_cv - 0.2) / 0.5 + (1 - features.p_wave_presence_score)
        )
        detection.atrial_fibrillation_confidence = "high" if features.rr_interval_cv > 0.4 else "moderate"
    
    # Ventricular Tachycardia (fast rate + wide QRS)
    if hr > 120 and features.qrs_duration_mean > 120:
        detection.ventricular_tachycardia_probability = min(
            1.0,
            (hr - 120) / 80.0 + (features.qrs_duration_mean - 120) / 60.0
        )
        detection.ventricular_tachycardia_confidence = "high" if hr > 140 else "moderate"
    
    # Premature beats
    detection.premature_atrial_contractions = features.premature_beats_count
    
    # Heart block (very long PR or missed beats)
    if features.pr_interval_mean > 200:
        detection.heart_block_degree = 1
    elif features.pr_interval_mean > 300:
        detection.heart_block_degree = 2
    
    return detection


def detect_ischemia(
    signal: FloatArray,
    sampling_rate: float = DEFAULT_SAMPLING_RATE,
    features: ECGFeatures | None = None,
    leads: list[str] = ["II"],
) -> IschemiaDetection:
    """Detect ischemia from ECG signal.
    
    Args:
        signal: ECG signal
        sampling_rate: Sampling rate in Hz
        features: Pre-computed ECG features (optional)
        leads: List of lead identifiers
        
    Returns:
        IschemiaDetection dataclass with detection results
    """
    detection = IschemiaDetection()
    
    if features is None:
        features = extract_ecg_features(signal, sampling_rate)
    
    # ST elevation detection
    if features.st_elevation_mean > 0.1:  # Threshold in normalized units
        detection.st_elevation_present = True
        detection.st_elevation_magnitude = features.st_elevation_mean
        detection.st_elevation_leads = leads
        detection.ischemia_probability = min(1.0, features.st_elevation_mean * 5.0)
        detection.ischemia_confidence = "high" if features.st_elevation_mean > 0.2 else "moderate"
    
    # ST depression detection
    if features.st_depression_mean < -0.1:
        detection.st_depression_present = True
        detection.st_depression_magnitude = abs(features.st_depression_mean)
        detection.st_depression_leads = leads
        detection.ischemia_probability = max(detection.ischemia_probability, min(1.0, abs(features.st_depression_mean) * 5.0))
        detection.ischemia_confidence = "high" if abs(features.st_depression_mean) > 0.2 else "moderate"
    
    # T-wave inversion
    if features.t_wave_abnormality_score > 0.7:
        detection.t_wave_inversion_present = True
        detection.t_wave_inversion_leads = leads
        detection.ischemia_probability = max(detection.ischemia_probability, features.t_wave_abnormality_score * 0.8)
        detection.ischemia_confidence = "high" if features.t_wave_abnormality_score > 0.8 else "moderate"
    
    return detection


def generate_synthetic_ecg(
    duration: float = 10.0,
    sampling_rate: float = DEFAULT_SAMPLING_RATE,
    heart_rate: float = 72.0,
    scenario: str = "normal",
    noise_level: float = 0.1,
    random_seed: int | None = None,
) -> Tuple[FloatArray, dict[str, Any]]:
    """Generate synthetic ECG signal for testing.
    
    Args:
        duration: Signal duration in seconds
        sampling_rate: Sampling rate in Hz
        heart_rate: Heart rate in bpm
        scenario: ECG scenario type
            - "normal": Normal sinus rhythm
            - "afib": Atrial fibrillation
            - "vtach": Ventricular tachycardia
            - "brady": Bradycardia
            - "stemi": ST elevation MI
            - "nstemi": Non-ST elevation MI
        noise_level: Amount of noise to add (0-1)
        random_seed: Random seed for reproducibility
        
    Returns:
        Tuple of (signal, metadata) where metadata contains scenario details
    """
    if random_seed is not None:
        np.random.seed(random_seed)
    
    n_samples = int(duration * sampling_rate)
    time = np.linspace(0, duration, n_samples)
    
    # Generate base signal
    signal = _generate_base_ecg(time, heart_rate, sampling_rate, scenario)
    
    # Add noise
    if noise_level > 0:
        signal += noise_level * np.random.randn(n_samples)
    
    # Normalize to reasonable amplitude
    signal = signal / (np.max(np.abs(signal)) + 1e-6)
    
    metadata = {
        'duration': duration,
        'sampling_rate': sampling_rate,
        'heart_rate': heart_rate,
        'scenario': scenario,
        'noise_level': noise_level,
        'n_samples': n_samples,
    }
    
    return signal.astype(np.float32), metadata


def _generate_base_ecg(
    time: FloatArray,
    heart_rate: float,
    sampling_rate: float,
    scenario: str,
) -> FloatArray:
    """Generate base ECG waveform."""
    
    # R-peak positions
    rr_interval = 60.0 / heart_rate  # seconds
    r_peaks = np.arange(0, time[-1], rr_interval)
    
    signal = np.zeros_like(time)
    
    for r_time in r_peaks:
        if r_time >= time[-1]:
            break
        
        # Find closest index
        r_idx = np.argmin(np.abs(time - r_time))
        
        if scenario == "normal":
            signal += _generate_normal_beat(time, r_idx, heart_rate)
        elif scenario == "afib":
            signal += _generate_afib_beat(time, r_idx, heart_rate, r_peaks)
        elif scenario == "vtach":
            signal += _generate_vtach_beat(time, r_idx, heart_rate)
        elif scenario == "brady":
            signal += _generate_brady_beat(time, r_idx, heart_rate)
        elif scenario == "stemi":
            signal += _generate_stemi_beat(time, r_idx, heart_rate)
        elif scenario == "nstemi":
            signal += _generate_nstemi_beat(time, r_idx, heart_rate)
        else:
            signal += _generate_normal_beat(time, r_idx, heart_rate)
    
    return signal


def _generate_normal_beat(
    time: FloatArray,
    r_idx: int,
    heart_rate: float,
) -> FloatArray:
    """Generate a normal ECG beat."""
    rr_interval = 60.0 / heart_rate
    signal = np.zeros_like(time)
    
    # P wave (0.05-0.1s before R)
    p_start = max(0, r_idx - int(0.1 * DEFAULT_SAMPLING_RATE))
    p_end = r_idx - int(0.05 * DEFAULT_SAMPLING_RATE)
    if p_end > p_start:
        p_time = np.linspace(-0.1, -0.05, p_end - p_start)
        p_wave = 0.2 * np.sin(2 * np.pi * (p_time + 0.075) / 0.05)
        p_wave = p_wave * np.exp(-((p_time + 0.075) / 0.025) ** 2)
        signal[p_start:p_end] += p_wave
    
    # QRS complex
    qrs_start = max(0, r_idx - int(0.02 * DEFAULT_SAMPLING_RATE))
    qrs_end = min(len(time), r_idx + int(0.1 * DEFAULT_SAMPLING_RATE))
    qrs_time = np.linspace(-0.02, 0.1, qrs_end - qrs_start)
    
    # R wave (main peak)
    r_wave = 1.0 * np.exp(-((qrs_time - 0.02) / 0.015) ** 2)
    
    # Q wave (before R)
    q_wave = -0.3 * np.exp(-((qrs_time + 0.01) / 0.008) ** 2)
    
    # S wave (after R)
    s_wave = -0.4 * np.exp(-((qrs_time - 0.05) / 0.012) ** 2)
    
    qrs = r_wave + q_wave + s_wave
    signal[qrs_start:qrs_end] += qrs
    
    # T wave
    t_start = qrs_end
    t_end = min(len(time), r_idx + int(0.4 * DEFAULT_SAMPLING_RATE))
    if t_end > t_start:
        t_time = np.linspace(0.1, 0.4, t_end - t_start)
        t_wave = 0.3 * np.exp(-((t_time - 0.25) / 0.08) ** 2)
        signal[t_start:t_end] += t_wave
    
    return signal


def _generate_afib_beat(
    time: FloatArray,
    r_idx: int,
    heart_rate: float,
    all_r_peaks: FloatArray,
) -> FloatArray:
    """Generate AFib-like beat with irregular rhythm and no clear P waves."""
    signal = _generate_normal_beat(time, r_idx, heart_rate)
    
    # Add fibrillation waves (high frequency, low amplitude)
    fib_time = np.linspace(0, len(time) / DEFAULT_SAMPLING_RATE, len(time))
    fib_wave = 0.15 * np.sin(2 * np.pi * 8.0 * fib_time)  # 8 Hz fibrillation
    signal += fib_wave
    
    # Remove P waves
    p_start = max(0, r_idx - int(0.1 * DEFAULT_SAMPLING_RATE))
    p_end = r_idx
    signal[p_start:p_end] *= 0.3  # Reduce P wave amplitude
    
    return signal


def _generate_vtach_beat(
    time: FloatArray,
    r_idx: int,
    heart_rate: float,
) -> FloatArray:
    """Generate VTach-like beat with wide QRS."""
    signal = _generate_normal_beat(time, r_idx, heart_rate)
    
    # Widen QRS complex
    qrs_start = max(0, r_idx - int(0.04 * DEFAULT_SAMPLING_RATE))
    qrs_end = min(len(time), r_idx + int(0.15 * DEFAULT_SAMPLING_RATE))
    qrs_time = np.linspace(-0.04, 0.15, qrs_end - qrs_start)
    
    # Wide, monomorphic QRS
    r_wave = 1.2 * np.exp(-((qrs_time - 0.02) / 0.03) ** 2)
    s_wave = -0.5 * np.exp(-((qrs_time - 0.08) / 0.025) ** 2)
    
    signal[qrs_start:qrs_end] = r_wave + s_wave
    
    return signal


def _generate_brady_beat(
    time: FloatArray,
    r_idx: int,
    heart_rate: float,
) -> FloatArray:
    """Generate bradycardia beat (same as normal but slower rate)."""
    return _generate_normal_beat(time, r_idx, heart_rate)


def _generate_stemi_beat(
    time: FloatArray,
    r_idx: int,
    heart_rate: float,
) -> FloatArray:
    """Generate STEMI-like beat with ST elevation."""
    signal = _generate_normal_beat(time, r_idx, heart_rate)
    
    # Add ST elevation
    st_start = r_idx + int(0.06 * DEFAULT_SAMPLING_RATE)
    st_end = min(len(time), r_idx + int(0.15 * DEFAULT_SAMPLING_RATE))
    if st_end > st_start:
        st_time = np.linspace(0.06, 0.15, st_end - st_start)
        st_elevation = 0.3 * (1 - np.exp(-((st_time - 0.08) / 0.03) ** 2))
        signal[st_start:st_end] += st_elevation
    
    return signal


def _generate_nstemi_beat(
    time: FloatArray,
    r_idx: int,
    heart_rate: float,
) -> FloatArray:
    """Generate NSTEMI-like beat with ST depression."""
    signal = _generate_normal_beat(time, r_idx, heart_rate)
    
    # Add ST depression
    st_start = r_idx + int(0.06 * DEFAULT_SAMPLING_RATE)
    st_end = min(len(time), r_idx + int(0.15 * DEFAULT_SAMPLING_RATE))
    if st_end > st_start:
        st_time = np.linspace(0.06, 0.15, st_end - st_start)
        st_depression = -0.2 * (1 - np.exp(-((st_time - 0.08) / 0.03) ** 2))
        signal[st_start:st_end] += st_depression
    
    # Add T wave inversion
    t_start = r_idx + int(0.15 * DEFAULT_SAMPLING_RATE)
    t_end = min(len(time), r_idx + int(0.35 * DEFAULT_SAMPLING_RATE))
    if t_end > t_start:
        signal[t_start:t_end] *= -0.5
    
    return signal

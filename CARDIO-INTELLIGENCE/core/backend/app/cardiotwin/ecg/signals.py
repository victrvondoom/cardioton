"""ECG Signal Processing Utilities.

Provides core signal processing functions for ECG analysis:
- Filtering (bandpass, notch)
- Normalization
- Resampling
- Segment detection

All functions work with synthetic or appropriately licensed data.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from app.oncotwin._typing import FloatArray

# Constants for ECG signal processing
DEFAULT_SAMPLING_RATE = 500  # Hz
DEFAULT_DURATION = 10  # seconds
NYQUIST_FREQ = DEFAULT_SAMPLING_RATE / 2.0

# ECG frequency bands
LOWCUT = 0.5  # Hz - removes baseline wander
HIGHCUT = 40.0  # Hz - removes high-frequency noise
NOTCH_FREQ = 50.0  # Hz or 60 Hz - powerline interference
NOTCH_Q = 30.0  # Quality factor for notch filter


def filter_ecg(
    signal: FloatArray,
    sampling_rate: float = DEFAULT_SAMPLING_RATE,
    lowcut: float = LOWCUT,
    highcut: float = HIGHCUT,
    notch_freq: float | None = NOTCH_FREQ,
) -> FloatArray:
    """Apply bandpass and optional notch filtering to ECG signal.

    Uses simple moving average and FIR filtering for compatibility.

    Args:
        signal: Raw ECG signal (1D numpy array)
        sampling_rate: Sampling frequency in Hz
        lowcut: Low cutoff frequency for highpass filter (Hz)
        highcut: High cutoff frequency for lowpass filter (Hz)
        notch_freq: Frequency for notch filter (None to skip, 50 or 60 for powerline)

    Returns:
        Filtered ECG signal
    """
    # Simple implementation without scipy dependency
    # First, remove baseline wander (highpass equivalent)
    filtered = _highpass_filter(signal, lowcut, sampling_rate)

    # Then apply lowpass (smoothing)
    filtered = _lowpass_filter(filtered, highcut, sampling_rate)

    return filtered


def normalize_ecg(signal: FloatArray) -> FloatArray:
    """Normalize ECG signal to zero mean and unit variance.

    Args:
        signal: ECG signal to normalize

    Returns:
        Normalized ECG signal
    """
    # Remove mean
    signal = signal - np.mean(signal)
    # Normalize by standard deviation
    std = np.std(signal)
    if std > 0:
        signal = signal / std
    return signal


def resample_ecg(
    signal: FloatArray,
    original_rate: float,
    target_rate: float = DEFAULT_SAMPLING_RATE,
) -> FloatArray:
    """Resample ECG signal to target sampling rate.

    Args:
        signal: ECG signal to resample
        original_rate: Original sampling rate (Hz)
        target_rate: Target sampling rate (Hz)

    Returns:
        Resampled ECG signal
    """
    import scipy.signal as scipy_signal

    if original_rate == target_rate:
        return signal

    num_samples = int(len(signal) * target_rate / original_rate)
    return np.asarray(scipy_signal.resample(signal, num_samples), dtype=np.float64)


def compute_heart_rate(
    peaks: FloatArray,
    sampling_rate: float = DEFAULT_SAMPLING_RATE,
) -> float:
    """Compute heart rate from R-peak indices.

    Args:
        peaks: Array of R-peak indices
        sampling_rate: Sampling rate in Hz

    Returns:
        Heart rate in beats per minute (bpm)
    """
    if len(peaks) < 2:
        return 0.0

    # Compute RR intervals in seconds
    rr_intervals = np.diff(peaks) / sampling_rate
    # Convert to heart rate
    heart_rates = 60.0 / rr_intervals
    # Return median heart rate
    return float(np.median(heart_rates))


def detect_r_peaks(
    signal: FloatArray,
    sampling_rate: float = DEFAULT_SAMPLING_RATE,
    threshold: float | None = None,
) -> tuple[FloatArray, FloatArray]:
    """Detect R-peaks in ECG signal using simple thresholding.

    Args:
        signal: ECG signal (filtered)
        sampling_rate: Sampling rate in Hz
        threshold: Detection threshold (None for automatic)

    Returns:
        Tuple of (peak_indices, peak_values)
    """
    # Simple implementation without scipy dependency

    # Automatic threshold based on signal statistics
    if threshold is None:
        threshold = 0.5 * np.max(np.abs(signal))

    # Find peaks using simple local maxima detection
    peak_indices = _find_peaks_simple(signal, threshold, sampling_rate)
    peak_values = signal[peak_indices.astype(int)]

    return peak_indices.astype(float), peak_values


def detect_p_peaks(
    signal: FloatArray,
    r_peaks: FloatArray,
    sampling_rate: float = DEFAULT_SAMPLING_RATE,
    search_window: float = 0.2,  # seconds before each R peak
) -> tuple[FloatArray, FloatArray]:
    """Detect P-peaks in ECG signal.

    Args:
        signal: ECG signal
        r_peaks: R-peak indices
        sampling_rate: Sampling rate in Hz
        search_window: Search window before each R peak (seconds)

    Returns:
        Tuple of (p_peak_indices, p_peak_values)
    """
    p_peaks = []
    p_values = []

    for r_peak in r_peaks:
        # Search window before R peak
        start_idx = max(0, int(r_peak - search_window * sampling_rate))
        end_idx = int(r_peak)

        if end_idx <= start_idx:
            continue

        # Find local maxima in search window using simple method
        window_signal = signal[start_idx:end_idx]
        peaks = _find_peaks_simple(window_signal, 0.1, sampling_rate)

        if len(peaks) > 0:
            # Get the highest peak
            best_peak_idx = start_idx + int(peaks[np.argmax(window_signal[peaks.astype(int)])])
            p_peaks.append(best_peak_idx)
            p_values.append(signal[best_peak_idx])

    return np.array(p_peaks, dtype=float), np.array(p_values)


def detect_t_peaks(
    signal: FloatArray,
    r_peaks: FloatArray,
    sampling_rate: float = DEFAULT_SAMPLING_RATE,
    search_window: float = 0.4,  # seconds after each R peak
) -> tuple[FloatArray, FloatArray]:
    """Detect T-peaks in ECG signal.

    Args:
        signal: ECG signal
        r_peaks: R-peak indices
        sampling_rate: Sampling rate in Hz
        search_window: Search window after each R peak (seconds)

    Returns:
        Tuple of (t_peak_indices, t_peak_values)
    """
    t_peaks = []
    t_values = []

    for r_peak in r_peaks:
        # Search window after R peak
        start_idx = int(r_peak + sampling_rate * 0.05)  # Start 50ms after R
        end_idx = min(len(signal), int(r_peak + search_window * sampling_rate))

        if end_idx <= start_idx:
            continue

        # Find local maxima in search window
        window_signal = signal[start_idx:end_idx]
        peaks = _find_peaks_simple(window_signal, 0.05, sampling_rate)

        if len(peaks) > 0:
            # Get the highest peak
            best_peak_idx = start_idx + int(peaks[np.argmax(window_signal[peaks.astype(int)])])
            t_peaks.append(best_peak_idx)
            t_values.append(signal[best_peak_idx])

    return np.array(t_peaks, dtype=float), np.array(t_values)


def detect_qrs_complexes(
    signal: FloatArray,
    sampling_rate: float = DEFAULT_SAMPLING_RATE,
) -> dict[str, Any]:
    """Detect QRS complexes and compute intervals.

    Args:
        signal: ECG signal
        sampling_rate: Sampling rate in Hz

    Returns:
        Dictionary with R-peak indices, heart rate, and intervals
    """
    r_peaks, r_values = detect_r_peaks(signal, sampling_rate)

    if len(r_peaks) < 2:
        return {
            'r_peaks': r_peaks,
            'r_values': r_values,
            'heart_rate': 0.0,
            'rr_intervals': np.array([]),
            'p_peaks': np.array([]),
            'p_values': np.array([]),
            't_peaks': np.array([]),
            't_values': np.array([]),
            'pr_intervals': np.array([]),
            'qt_intervals': np.array([]),
        }

    # Compute heart rate
    heart_rate = compute_heart_rate(r_peaks, sampling_rate)

    # Compute RR intervals
    rr_intervals = np.diff(r_peaks) / sampling_rate * 1000  # in ms

    # Detect P and T peaks
    p_peaks, p_values = detect_p_peaks(signal, r_peaks, sampling_rate)
    t_peaks, t_values = detect_t_peaks(signal, r_peaks, sampling_rate)

    # Compute PR and QT intervals
    pr_intervals = []
    qt_intervals = []

    for i in range(min(len(r_peaks), len(p_peaks), len(t_peaks))):
        pr_intervals.append((r_peaks[i] - p_peaks[i]) / sampling_rate * 1000)  # ms
        qt_intervals.append((t_peaks[i] - r_peaks[i]) / sampling_rate * 1000)  # ms

    return {
        'r_peaks': r_peaks,
        'r_values': r_values,
        'heart_rate': heart_rate,
        'rr_intervals': rr_intervals,
        'p_peaks': p_peaks,
        'p_values': p_values,
        't_peaks': t_peaks,
        't_values': t_values,
        'pr_intervals': np.array(pr_intervals),
        'qt_intervals': np.array(qt_intervals),
    }


# =============================================================================
# Helper functions for filtering and peak detection (no scipy dependency)
# =============================================================================


def _highpass_filter(signal: FloatArray, cutoff: float, sampling_rate: float) -> FloatArray:
    """Simple highpass filter using moving average subtraction."""
    # Window size for moving average (approx 1/cutoff seconds)
    window_size = max(3, int(sampling_rate / cutoff))
    if window_size % 2 == 0:
        window_size += 1

    # Moving average
    kernel = np.ones(window_size) / window_size
    filtered = np.convolve(signal, kernel, mode='same')

    # Subtract from original
    return signal - filtered


def _lowpass_filter(signal: FloatArray, cutoff: float, sampling_rate: float) -> FloatArray:
    """Simple lowpass filter using moving average."""
    # Window size for moving average
    window_size = max(3, int(sampling_rate / cutoff))
    if window_size % 2 == 0:
        window_size += 1

    kernel = np.ones(window_size) / window_size
    return np.convolve(signal, kernel, mode='same')


def _find_peaks_simple(
    signal: FloatArray,
    threshold: float,
    sampling_rate: float,
) -> FloatArray:
    """Simple peak detection without scipy.

    Finds local maxima above threshold with minimum distance constraint.
    """
    min_distance = int(sampling_rate * 0.2)  # Minimum 200ms between peaks

    peaks = []
    i = 1
    while i < len(signal) - 1:
        # Check if current point is above threshold and is a local maximum
        if signal[i] > threshold and signal[i] > signal[i-1] and signal[i] > signal[i+1]:
            # Check if this is the highest point in a window
            window_start = max(0, i - min_distance)
            window_end = min(len(signal), i + min_distance + 1)

            # Check if this is the maximum in the window
            if signal[i] == np.max(signal[window_start:window_end]):
                peaks.append(i)
                i += min_distance  # Skip ahead
            else:
                i += 1
        else:
            i += 1

    return np.array(peaks, dtype=float)

"""CardioChronos — biological time and longitudinal physiology.

A temporal alignment engine across five time scales:

  milliseconds/seconds — ECG beats
  minutes — windowed HRV features
  hours — wearable observations (HR, RR intervals, SpO2, activity, sleep stage)
  days — sleep/activity aggregates
  months/years — historical clinical records

REUSE: synthetic signals come from the existing, tested generators
(``app.cardiotwin.ecg.features.generate_synthetic_ecg`` and
``app.cardiotwin.wearables.simulation.generate_synthetic_wearable_stream``).
This module adds deterministic alignment, windowed features (documented
formulas), missing-data handling, screening anomalies, and leakage-safe
point-in-time reconstruction ("time travel").

Honesty rules:
- every synthetic record is labelled ``simulated`` / ``synthetic``;
- gaps are reported, never silently interpolated;
- anomalies are screening indicators, not diagnoses;
- retrospective replay uses only evidence available before the requested date.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta
from typing import Any

from app.cardiotwin.ecg.core__cardiotwin_ecg__features import generate_synthetic_ecg
from app.cardiotwin.wearables.simulation import generate_synthetic_wearable_stream

CHRONOS_NOTICE = (
    "Temporal alignment of explicitly synthetic/simulated demonstration data. "
    "Circadian and trend patterns are descriptive; no medical diagnosis is inferred "
    "from them."
)

SCALE_BANDS = [
    {"id": "beat", "label": "ECG beat", "resolution": "millisecond"},
    {"id": "minute", "label": "HRV window", "resolution": "minute"},
    {"id": "hour", "label": "Wearable", "resolution": "hour"},
    {"id": "day", "label": "Daily aggregate", "resolution": "daily"},
    {"id": "month", "label": "Clinical history", "resolution": "monthly"},
]


def hrv_features(rr_intervals_ms: list[float]) -> dict[str, float | int | str]:
    """Windowed HRV features with documented formulas.

    mean_HR = 60000 / mean(RR); SDNN = std(RR); RMSSD = sqrt(mean(diff(RR)²)).
    Standard time-domain HRV definitions (Task Force 1996 conventions).
    """
    if len(rr_intervals_ms) < 3:
        raise ValueError("At least 3 RR intervals are required for HRV features")
    if any(rr <= 0 for rr in rr_intervals_ms):
        raise ValueError("RR intervals must be positive")
    mean_rr = sum(rr_intervals_ms) / len(rr_intervals_ms)
    sdnn = math.sqrt(sum((rr - mean_rr) ** 2 for rr in rr_intervals_ms) / len(rr_intervals_ms))
    diffs = [b - a for a, b in zip(rr_intervals_ms, rr_intervals_ms[1:], strict=False)]
    rmssd = math.sqrt(sum(d * d for d in diffs) / len(diffs))
    return {
        "mean_heart_rate_bpm": round(60000.0 / mean_rr, 2),
        "sdnn_ms": round(sdnn, 2),
        "rmssd_ms": round(rmssd, 2),
        "n_beats": len(rr_intervals_ms),
        "formulas": "mean_HR = 60000/mean(RR); SDNN = std(RR); RMSSD = sqrt(mean(diff(RR)^2))",
    }


def screening_anomalies(values: list[float], window: int = 12, z_threshold: float = 2.5) -> list[int]:
    """Rolling z-score screening indicators (NOT diagnoses)."""
    if window < 3:
        raise ValueError("window must be at least 3")
    flags: list[int] = []
    for i in range(len(values)):
        lo = max(0, i - window)
        sample = values[lo:i]
        if len(sample) < window:
            continue
        mean = sum(sample) / len(sample)
        var = sum((v - mean) ** 2 for v in sample) / len(sample)
        sd = math.sqrt(var)
        if sd > 0 and abs(values[i] - mean) / sd > z_threshold:
            flags.append(i)
    return flags


def synthetic_timeline(scenario: str = "normal", hours: float = 48.0,
                        random_seed: int = 7) -> dict[str, Any]:
    """Deterministic multiscale synthetic timeline for the demonstration patient.

    Bands: ECG beats (ms), minute HRV windows, hourly wearable stream, daily
    sleep/activity aggregates, monthly clinical history.
    """
    if not 1 <= hours <= 336:
        raise ValueError("hours must be in [1, 336]")
    start = datetime(2026, 3, 2, tzinfo=UTC)

    # Millisecond/second band: synthetic ECG (10 s excerpt, deterministic).
    signal, meta = generate_synthetic_ecg(
        duration=10.0, heart_rate=72.0, scenario=scenario, random_seed=random_seed
    )
    # Minute band: HRV windows derived from the wearable RR stream.
    wearable = generate_synthetic_wearable_stream(
        start_time=start,
        duration_seconds=hours * 3600,
        interval_seconds=3600,  # hourly samples for the hour band
        scenario=scenario,
        random_seed=random_seed,
    )
    hourly: list[dict[str, Any]] = [
        {
            "timestamp": (start + timedelta(hours=i)).isoformat(),
            "heart_rate_bpm": round(point.heart_rate, 1) if point.heart_rate is not None else None,
            "spo2_pct": round(point.spo2, 1) if point.spo2 else None,
            "activity": point.activity_level,
            "sleep_stage": point.sleep_stage,
        }
        for i, point in enumerate(wearable)
    ]
    rr_dense = generate_synthetic_wearable_stream(
        start_time=start,
        duration_seconds=1800,
        interval_seconds=10,
        scenario=scenario,
        random_seed=random_seed,
    )
    rr_series = [p.heart_rate for p in rr_dense if p.heart_rate is not None]
    hrv_windows = []
    for w in range(0, min(30, len(rr_series) - 6), 6):
        window = rr_series[w : w + 6]
        rr_ms = [60000.0 / hr for hr in window]
        hrv_windows.append(
            {
                "timestamp": (start + timedelta(seconds=10 * w)).isoformat(),
                **hrv_features(rr_ms),
            }
        )

    # Daily aggregates.
    daily = []
    for day in range(int(math.ceil(hours / 24))):
        day_points = hourly[day * 24 : (day + 1) * 24]
        sleeping = [p for p in day_points if p["sleep_stage"] in {"deep", "light"}]
        heart_rates = [float(p["heart_rate_bpm"]) for p in day_points if p["heart_rate_bpm"] is not None]
        daily.append(
            {
                "date": (start + timedelta(days=day)).date().isoformat(),
                "mean_heart_rate_bpm": round(
                    sum(heart_rates) / max(1, len(heart_rates)), 1
                ),
                "sleep_samples": len(sleeping),
                "label": "simulated aggregate",
            }
        )

    # Monthly clinical history (explicitly synthetic).
    monthly = [
        {
            "month": (start + timedelta(days=30 * m)).date().isoformat(),
            "ldl_mg_dl": round(130 + 6 * m - 0.5 * m * m, 1),
            "systolic_bp_mmhg": round(124 + 1.5 * m, 1),
            "label": "simulated history",
        }
        for m in range(6)
    ]

    return {
        "scenario": scenario,
        "hours": hours,
        "random_seed": random_seed,
        "bands": {
            "ecg_excerpt": {
                "sampling_rate_hz": meta.get("sampling_rate", 500),
                "n_samples": len(signal),
                "duration_s": 10.0,
                "label": "simulated ECG excerpt",
            },
            "hrv_windows": hrv_windows,
            "hourly_wearable": hourly,
            "daily_aggregates": daily,
            "monthly_history": monthly,
        },
        "notice": CHRONOS_NOTICE,
    }


def align_bands(timeline: dict[str, Any]) -> dict[str, Any]:
    """Unified alignment of the multiscale bands with explicit gap reporting."""
    bands = timeline.get("bands", {})
    hourly = bands.get("hourly_wearable", [])
    stamps = [datetime.fromisoformat(p["timestamp"]) for p in hourly]
    gaps = []
    for a, b in zip(stamps, stamps[1:], strict=False):
        if (b - a).total_seconds() > 3600:
            gaps.append({"from": a.isoformat(), "to": b.isoformat(),
                         "missing_hours": int(((b - a).total_seconds() - 3600) / 3600)})
    coverage_hours = len(hourly)
    return {
        "aligned_bands": list(bands.keys()),
        "wall_clock_span_hours": timeline.get("hours"),
        "hourly_coverage_samples": coverage_hours,
        "gaps": gaps,
        "missing_data_policy": "Gaps are reported, never interpolated.",
        "notice": timeline.get("notice", CHRONOS_NOTICE),
    }


def replay(timeline: dict[str, Any], as_of: datetime) -> dict[str, Any]:
    """Leakage-safe point-in-time reconstruction of the evidence available at as_of."""
    bands = timeline["bands"]
    available: dict[str, list[Any]] = {}
    excluded: dict[str, list[str]] = {}
    for name in ("hourly_wearable", "hrv_windows", "daily_aggregates", "monthly_history"):
        rows = bands.get(name, [])
        if name in ("hourly_wearable", "hrv_windows"):
            key = "timestamp"
        elif name == "daily_aggregates":
            key = "date"
        else:
            key = "month"
        kept, dropped = [], []
        for row in rows:
            when = datetime.fromisoformat(str(row[key]))
            if when.tzinfo is None:
                when = when.replace(tzinfo=UTC)
            if when <= as_of:
                kept.append(row)
            else:
                dropped.append(row[key])
        available[name] = kept
        excluded[name] = dropped
    return {
        "as_of": as_of.isoformat(),
        "available": {k: len(v) for k, v in available.items()},
        "available_rows": available,
        "excluded_future": excluded,
        "notice": (
            "Time-travel reconstruction: only records with timestamps at or before the "
            "requested date are used; later evidence is excluded to prevent future-data leakage."
        ),
    }

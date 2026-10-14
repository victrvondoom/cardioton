"""Wearable Data Simulation.

Provides synthetic wearable data generation for testing and demonstration.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import numpy as np

from app.cardiotwin.wearables.core__cardiotwin_wearables__models import WearableDataPoint


@dataclass
class WearableSimulator:
    """Simulates wearable device data for a patient.

    Generates realistic synthetic wearable data including:
    - Heart rate with circadian variation
    - Heart rate variability
    - Activity patterns
    - Oxygen saturation
    - Sleep stages

    Can simulate various scenarios:
    - Normal daily activity
    - Exercise sessions
    - Stress events
    - Arrhythmia episodes
    """

    # Patient parameters
    base_heart_rate: float = 72.0  # bpm
    heart_rate_variability: float = 5.0  # bpm std dev

    # Current state
    current_time: datetime = field(default_factory=lambda: datetime.now(UTC))
    scenario: str = "normal"

    # Simulation parameters
    sampling_interval: float = 1.0  # seconds between data points

    # Random state
    random_seed: int | None = None
    _rng: np.random.Generator = field(default_factory=np.random.default_rng, repr=False)

    def __post_init__(self) -> None:
        if self.random_seed is not None:
            self._rng = np.random.default_rng(self.random_seed)

    def set_scenario(self, scenario: str) -> None:
        """Set the simulation scenario."""
        self.scenario = scenario

    def generate_data_point(self, timestamp: datetime | None = None) -> WearableDataPoint:
        """Generate a single wearable data point.

        Args:
            timestamp: Optional timestamp (defaults to current_time + interval)

        Returns:
            WearableDataPoint with synthetic data
        """
        if timestamp is None:
            timestamp = self.current_time

        # Determine time of day
        hour = timestamp.hour
        minute = timestamp.minute
        total_minutes = hour * 60 + minute

        # Circadian variation in heart rate (lower at night, higher during day)
        circadian_factor = 0.8 + 0.2 * np.sin(2 * np.pi * total_minutes / (24 * 60))

        # Generate heart rate based on scenario
        if self.scenario == "exercise":
            base_hr = self.base_heart_rate * 1.8 + self._rng.normal(0, 3)
        elif self.scenario == "stress":
            base_hr = self.base_heart_rate * 1.3 + self._rng.normal(0, 5)
        elif self.scenario == "sleep":
            base_hr = self.base_heart_rate * 0.85 + self._rng.normal(0, 2)
        elif self.scenario == "afib":
            # Highly variable heart rate for AFib
            base_hr = self.base_heart_rate + self._rng.normal(0, 15)
            base_hr = np.clip(base_hr, 40, 180)
        elif self.scenario == "bradycardia":
            base_hr = self.base_heart_rate * 0.6 + self._rng.normal(0, 2)
        elif self.scenario == "tachycardia":
            base_hr = self.base_heart_rate * 1.5 + self._rng.normal(0, 5)
        else:
            # Normal with circadian variation
            base_hr = self.base_heart_rate * circadian_factor + self._rng.normal(0, self.heart_rate_variability)

        # Ensure heart rate is within physiological range
        heart_rate = float(np.clip(base_hr, 30, 220))

        # Generate RR intervals with variability
        rr_intervals = self._generate_rr_intervals(heart_rate, timestamp)

        # Generate activity level
        activity_level = self._generate_activity_level(timestamp)

        # Generate SpO2
        spo2 = self._generate_spo2(timestamp)

        # Generate steps
        steps = self._generate_steps(timestamp)

        # Determine sleep stage
        sleep_stage = self._determine_sleep_stage(timestamp)

        return WearableDataPoint(
            timestamp=timestamp,
            heart_rate=round(heart_rate, 2),
            rr_intervals= rr_intervals,
            spo2=round(spo2, 2),
            steps=steps,
            activity_level=round(activity_level, 4),
            sleep_stage=sleep_stage,
            device_id="simulator_001",
            device_type="chest_strap",
            signal_quality=0.95 + self._rng.random() * 0.1,
        )

    def _generate_rr_intervals(self, heart_rate: float, timestamp: datetime) -> list[float]:
        """Generate RR intervals with realistic variability."""
        # Mean RR interval in ms
        mean_rr = 60000.0 / heart_rate

        std_rr = mean_rr * (0.3 if self.scenario == "afib" else 0.05)

        # Generate several RR intervals (e.g., 5-10 for a 1-second sample)
        num_intervals = self._rng.integers(5, 11)
        intervals = []
        for _ in range(num_intervals):
            rr = mean_rr + self._rng.normal(0, std_rr)
            intervals.append(float(np.clip(rr, 400, 2000)))  # 400-2000 ms range

        return intervals

    def _generate_activity_level(self, timestamp: datetime) -> float:
        """Generate activity level (0-1)."""
        hour = timestamp.hour

        if self.scenario == "exercise":
            # High activity during exercise
            return 0.7 + self._rng.random() * 0.3
        elif self.scenario == "stress":
            # Moderate activity during stress
            return 0.4 + self._rng.random() * 0.3
        elif self.scenario == "sleep":
            # Low activity during sleep
            return 0.05 + self._rng.random() * 0.1
        else:
            # Normal daily variation
            # Higher activity during daytime
            if 6 <= hour < 22:
                base = 0.3 + 0.2 * np.sin(2 * np.pi * (hour - 6) / 16)
            else:
                base = 0.05 + self._rng.random() * 0.1

            return float(np.clip(base + self._rng.normal(0, 0.1), 0, 1))

    def _generate_spo2(self, timestamp: datetime) -> float:
        """Generate oxygen saturation (%)"""
        if self.scenario == "exercise":
            # Slightly lower SpO2 during intense exercise
            return 94 + self._rng.random() * 6
        elif self.scenario == "stress":
            return 96 + self._rng.random() * 4
        elif self.scenario in ["afib", "tachycardia"]:
            # Potentially lower SpO2
            return 92 + self._rng.random() * 8
        else:
            # Normal SpO2
            return 97 + self._rng.random() * 3

    def _generate_steps(self, timestamp: datetime) -> int:
        """Generate step count."""
        if self.scenario == "exercise":
            return self._rng.integers(1, 3)  # Steps per second during exercise
        elif self.scenario == "sleep":
            return 0
        else:
            # Random steps during normal activity
            return self._rng.integers(0, 1)

    def _determine_sleep_stage(self, timestamp: datetime) -> str | None:
        """Determine sleep stage based on time and scenario."""
        hour = timestamp.hour

        if self.scenario == "sleep":
            total_minutes = hour * 60 + timestamp.minute
            # Sleep from 10 PM to 7 AM
            if 22 * 60 <= total_minutes < 7 * 60 + 24 * 60:
                sleep_minutes = (total_minutes - 22 * 60) % (24 * 60)
                if sleep_minutes < 30:
                    return "light"
                elif sleep_minutes < 90:
                    return "deep"
                elif sleep_minutes < 120:
                    return "rem"
                else:
                    # Cycle through sleep stages
                    cycle_pos = (sleep_minutes - 120) % 180
                    if cycle_pos < 60:
                        return "deep"
                    elif cycle_pos < 90:
                        return "light"
                    else:
                        return "rem"

        return None  # Not sleeping


def generate_synthetic_wearable_stream(
    start_time: datetime | None = None,
    duration_seconds: float = 60.0,
    interval_seconds: float = 1.0,
    scenario: str = "normal",
    base_heart_rate: float = 72.0,
    random_seed: int | None = None,
) -> list[WearableDataPoint]:
    """Generate a stream of synthetic wearable data points.

    Args:
        start_time: Start timestamp (defaults to now)
        duration_seconds: Total duration in seconds
        interval_seconds: Time between data points
        scenario: Simulation scenario
        base_heart_rate: Base heart rate in bpm
        random_seed: Random seed for reproducibility

    Returns:
        List of WearableDataPoint
    """
    if start_time is None:
        start_time = datetime.now(UTC)

    simulator = WearableSimulator(
        current_time=start_time,
        scenario=scenario,
        base_heart_rate=base_heart_rate,
        sampling_interval=interval_seconds,
        random_seed=random_seed,
    )

    data_points = []
    num_points = int(duration_seconds / interval_seconds)

    for i in range(num_points):
        timestamp = start_time + timedelta(seconds=i * interval_seconds)
        data_point = simulator.generate_data_point(timestamp)
        data_points.append(data_point)

    return data_points


class WearableStreamIterator(Iterator[WearableDataPoint]):
    """Iterator for streaming wearable data."""

    def __init__(
        self,
        start_time: datetime | None = None,
        scenario: str = "normal",
        base_heart_rate: float = 72.0,
        interval_seconds: float = 1.0,
        max_points: int = 1000,
        random_seed: int | None = None,
    ):
        if start_time is None:
            start_time = datetime.now(UTC)

        self.simulator = WearableSimulator(
            current_time=start_time,
            scenario=scenario,
            base_heart_rate=base_heart_rate,
            sampling_interval=interval_seconds,
            random_seed=random_seed,
        )
        self.interval = interval_seconds
        self.max_points = max_points
        self.generated = 0
        self.current_time = start_time

    def __iter__(self) -> WearableStreamIterator:
        return self

    def __next__(self) -> WearableDataPoint:
        if self.generated >= self.max_points:
            raise StopIteration

        data_point = self.simulator.generate_data_point(self.current_time)
        self.current_time += timedelta(seconds=self.interval)
        self.generated += 1
        return data_point

"""Reference-frame registry for the CROSS-5 system.

Each frame declares its scale, coordinate reference, data kinds and evidence
status policy. Frames are independent scientific domains; the registry is the
single place that describes what each frame can and cannot claim.
"""

from __future__ import annotations

from typing import Any, Literal

FrameId = Literal["cardiotwin", "cardioearth", "cardioflow", "cardiochronos", "cardiocity"]

FRAMES: dict[FrameId, dict[str, Any]] = {
    "cardiotwin": {
        "id": "cardiotwin",
        "number": 1,
        "name": "CardioTwin",
        "title": "The Human Heart",
        "scale": "human organ",
        "coordinate_reference": "cardiac anatomy (vessel ids: LAD, LCX, RCA; structure ids)",
        "primary_data": [
            "3D cardiac anatomy (reference geometry, not patient imaging)",
            "CAD / LAD / LCX / RCA probability estimates (evaluated logistic model)",
            "ECG analysis, wearable observations, EHR features (synthetic demo patients)",
            "hemodynamic state (0D coronary solver)",
        ],
        "claims_policy": (
            "Statistical probability estimates from tabular clinical features. Never a "
            "diagnosis, never anatomical disease localisation."
        ),
        "existing": True,
    },
    "cardioearth": {
        "id": "cardioearth",
        "number": 2,
        "name": "CardioEarth",
        "title": "Planetary Health",
        "scale": "planet (WGS84, country/region)",
        "coordinate_reference": "geographic (EPSG:4326 latitude/longitude, ISO country codes)",
        "primary_data": [
            "country-level cardiovascular mortality estimates (published WHO GHO snapshot)",
            "air quality and weather (Open-Meteo adapters, cached, quota-bounded)",
            "geocoding for region selection",
        ],
        "claims_policy": (
            "Aggregated population statistics with publication years and sources. Historical "
            "estimates are not live disease surveillance; regional values do not apply to "
            "any individual patient."
        ),
        "existing": True,
    },
    "cardioflow": {
        "id": "cardioflow",
        "number": 3,
        "name": "CardioFlow",
        "title": "Vascular Microphysics",
        "scale": "millimetres to micrometres",
        "coordinate_reference": "vessel centreline (arc-length in mm from ostium, luminal area)",
        "primary_data": [
            "reduced-order 0D/1D coronary hemodynamics (Poiseuille + Bernoulli circuit solver)",
            "time-dependent pressure / flow waveforms over the cardiac cycle",
            "hypothetical stenosis scenarios on nominal reference geometry",
        ],
        "claims_policy": (
            "Hypothetical simulation on nominal reference geometry. Results become "
            "patient-specific only with validated patient geometry and boundary conditions, "
            "which this deployment does not have."
        ),
        "existing": False,
    },
    "cardiochronos": {
        "id": "cardiochronos",
        "number": 4,
        "name": "CardioChronos",
        "title": "Biological Time",
        "scale": "milliseconds to years",
        "coordinate_reference": "UTC timestamps and temporal intervals (multiple resolutions)",
        "primary_data": [
            "millisecond ECG / beat-level observations",
            "hourly wearable streams (HR, RR intervals, SpO2, activity, sleep stage)",
            "daily/monthly aggregates and historical EHR alignment",
            "leakage-safe point-in-time reconstruction (time travel)",
        ],
        "claims_policy": (
            "Measured or explicitly simulated physiological time series. Circadian patterns "
            "are descriptive; no medical diagnosis is inferred from them."
        ),
        "existing": False,
    },
    "cardiocity": {
        "id": "cardiocity",
        "number": 5,
        "name": "CardioCity",
        "title": "Urban Systems & Healthcare Access",
        "scale": "streets to metropolitan regions",
        "coordinate_reference": "city graph (nodes, edges, facility positions; local metres)",
        "primary_data": [
            "synthetic demonstration city network (labelled as synthetic)",
            "facility locations by public category",
            "Dijkstra travel-time access analysis and hypothetical access scenarios",
        ],
        "claims_policy": (
            "Graph routing estimates on a synthetic demonstration network. Not emergency "
            "dispatch guidance; no live traffic, bed availability or ambulance positions."
        ),
        "existing": False,
    },
}


def frame_registry() -> dict[str, Any]:
    return {
        "frames": list(FRAMES.values()),
        "notice": (
            "Frames are linked through a typed evidence model, never physically merged. "
            "Quantities from different frames are combined only via documented mathematical relations."
        ),
    }

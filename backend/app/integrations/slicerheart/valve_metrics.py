"""Valve metric vocabulary and probe-position presets adapted from SlicerHeart.

Source (attribution):
* ``ValveQuantification/ValveQuantificationLib/MeasurementPreset*.py`` — metric
  names, landmark labels and annulus/leaflet measurement semantics.
* ``ValveAnnulusAnalysis/HeartValveLib/Constants.py`` — valve type presets and
  echocardiography probe-position RAS transforms (BSD 3-Clause, SlicerHeart
  Contributors).

This module exposes terminology and definitions only. Every metric here is
marked ``requires_imaging_data`` because computing it needs segmentations that
only a 3D Slicer runtime (with SlicerHeart installed) can produce from medical
imaging. CardioTon serves the vocabulary so agents and interfaces can explain
anatomy correctly — it never computes or fabricates the values themselves.
"""

from __future__ import annotations

from typing import Any

VALVE_TYPES: dict[str, dict[str, Any]] = {
    "mitral": {
        "shortname": "MV",
        "approximate_flow_direction": "anterior",
        "papillary_short_names": ["AL", "PM"],
        "phase_compare_point_labels": ["A", "P", "PM", "AL"],
        "annulus_labels": ["A", "P", "AL", "PM"],
    },
    "tricuspid": {
        "shortname": "TV",
        "approximate_flow_direction": "anterior",
        "papillary_short_names": ["A", "P", "S"],
        "phase_compare_point_labels": ["A", "P", "S", "L"],
        "annulus_labels": ["A", "P", "S", "L"],
    },
    "aortic": {
        "shortname": "AV",
        "approximate_flow_direction": "posterior",
        "papillary_short_names": ["P1", "P2", "P3"],
        "phase_compare_point_labels": None,
        "annulus_labels": ["R", "L", "S", "A"],
    },
    "pulmonary": {
        "shortname": "PV",
        "approximate_flow_direction": "posterior",
        "papillary_short_names": ["P1", "P2", "P3"],
        "phase_compare_point_labels": None,
        "annulus_labels": ["R", "L", "A", "P"],
    },
    "cavc": {
        "shortname": "CAVC",
        "approximate_flow_direction": "anterior",
        "papillary_short_names": ["P1", "P2", "P3", "P4"],
        "phase_compare_point_labels": ["R", "MA", "L", "MP"],
        "annulus_labels": ["R", "A", "L", "P"],
    },
    "lavv": {
        "shortname": "LAVV",
        "approximate_flow_direction": "anterior",
        "papillary_short_names": ["P1", "P2"],
        "phase_compare_point_labels": ["PMC", "ALC", "SIC"],
        "annulus_labels": ["SIC", "ALC", "PMC"],
    },
}

PROBE_POSITIONS: list[dict[str, Any]] = [
    {
        "id": "TTE_APICAL",
        "name": "TTE apical",
        "description": "Apical view using transthoracic probe. Dot on the probe is at 3 o'clock direction.",
    },
    {
        "id": "TTE_APICAL_NONSTANDARD_DOT_AT_9OCLOCK",
        "name": "TTE apical (non-standard 9 o'clock)",
        "description": "Apical view using transthoracic probe. Dot on the probe is at (non-standard) 9 o'clock direction.",
    },
    {
        "id": "TTE_SUBCOSTAL",
        "name": "TTE sub-costal short-axis",
        "description": "Sub-costal view, dot at 6 o'clock.",
    },
    {
        "id": "TTE_SUBCOSTAL_NONSTANDARD_DOT_AT_12OCLOCK",
        "name": "TTE sub-costal short-axis (non-standard 12 o'clock)",
        "description": "Sub-costal view. Dot on the probe is at (non-standard) 12 o'clock direction.",
    },
    {
        "id": "TEE_APICAL",
        "name": "TEE mid-esophageal",
        "description": "TEE probe at mid-esophageal position.",
    },
    {
        "id": "PATIENT_ANATOMICAL_AXES",
        "name": "Patient anatomical axes",
        "description": "Image axes are aligned with patient anatomical axes (right-anterior-superior). Typical for CT and MRI acquisitions.",
    },
]

COMMON_ANNULUS_METRICS: list[dict[str, Any]] = [
    {
        "id": "annulus_circumference",
        "name": "Annulus circumference",
        "unit": "mm",
        "definition": "Length of the closed annulus contour curve.",
    },
    {
        "id": "annulus_area",
        "name": "Annulus area",
        "unit": "mm2",
        "definition": "Area of the annulus contour projected onto its best-fit plane.",
    },
    {
        "id": "annulus_diameter_anteroposterior",
        "name": "Antero-posterior annulus diameter",
        "unit": "mm",
        "definition": "Distance between the anterior and posterior annulus landmarks.",
    },
    {
        "id": "annulus_diameter_transverse",
        "name": "Transverse annulus diameter",
        "unit": "mm",
        "definition": "Distance between the lateral annulus landmarks (e.g. AL-PM for the mitral valve).",
    },
    {
        "id": "annulus_sphericity_index",
        "name": "Annulus sphericity index",
        "unit": "ratio",
        "definition": "Ratio of the transverse to the antero-posterior diameter.",
    },
    {
        "id": "annulus_height",
        "name": "Annulus height (subtotal)",
        "unit": "mm",
        "definition": "Maximal excursion of annulus points from the best-fit annulus plane.",
    },
]

VALVE_METRICS: dict[str, list[dict[str, Any]]] = {
    "mitral": COMMON_ANNULUS_METRICS
    + [
        {
            "id": "leaflet_tenting_area",
            "name": "Leaflet tenting area",
            "unit": "mm2",
            "definition": "Area between the leaflet surface and the annulus plane.",
        },
        {
            "id": "coaptation_length",
            "name": "Coaptation length",
            "unit": "mm",
            "definition": "Length of the leaflet coaptation zone.",
        },
        {
            "id": "papillary_displacement",
            "name": "Papillary muscle displacement",
            "unit": "mm",
            "definition": "Displacement of papillary muscle tips relative to the annulus plane.",
        },
    ],
    "tricuspid": COMMON_ANNULUS_METRICS
    + [
        {
            "id": "tricuspid_annular_plane_systolic_excursion",
            "name": "TAPSE-like annular excursion",
            "unit": "mm",
            "definition": "Longitudinal annulus motion between systole and diastole.",
        },
    ],
    "aortic": COMMON_ANNULUS_METRICS,
    "pulmonary": COMMON_ANNULUS_METRICS,
    "cavc": COMMON_ANNULUS_METRICS,
    "lavv": COMMON_ANNULUS_METRICS,
}

METRIC_NOTICE = (
    "Definitions adapted from SlicerHeart (BSD 3-Clause). Each metric requires segmented "
    "patient imaging and is computed by SlicerHeart inside a 3D Slicer runtime; CardioTon "
    "serves the terminology only and does not produce these values."
)


def metric_catalog() -> dict[str, Any]:
    return {
        "notice": METRIC_NOTICE,
        "valve_types": VALVE_TYPES,
        "probe_positions": PROBE_POSITIONS,
        "metrics_by_valve": VALVE_METRICS,
        "all_metric_ids": sorted({m["id"] for metrics in VALVE_METRICS.values() for m in metrics}),
    }


def explain_metric(metric_id: str) -> dict[str, Any] | None:
    for valve, metrics in VALVE_METRICS.items():
        for metric in metrics:
            if metric["id"] == metric_id:
                return {**metric, "valve": valve, "notice": METRIC_NOTICE}
    return None

"""Entirely synthetic, fixed longitudinal FHIR scenario; never a real patient."""

from __future__ import annotations

from typing import Any

from .core__cardiotwin_hemodynamics__fhir import LOCAL_SYSTEM, LOINC, UCUM

PATIENT_REF = "Patient/synthetic-cardio-hemo"
DEMO_END = "2026-08-21T23:59:59Z"
DEMO_DATES = [f"2026-08-{day:02d}T23:59:59Z" for day in (1, 7, 10, 12, 15, 17, 19, 21)]


def demo_bundle() -> dict[str, Any]:
    """Native R4 resources with both event and publication times."""
    entries: list[dict[str, Any]] = [
        {
            "resource": {
                "resourceType": "Patient",
                "id": "synthetic-cardio-hemo",
                "meta": {"tag": [{"system": LOCAL_SYSTEM, "code": "synthetic"}]},
            }
        }
    ]
    codes = {
        "weight": "29463-7",
        "bnp": "30934-4",
        "creatinine": "2160-0",
        "egfr": "62238-1",
        "heart_rate": "8867-4",
        "systolic_bp": "8480-6",
        "diastolic_bp": "8462-4",
        "spo2": "59408-5",
        "lvef": "10230-1",
        "sodium": "2951-2",
        "potassium": "2823-3",
    }
    units = {
        "weight": "kg",
        "bnp": "pg/mL",
        "creatinine": "mg/dL",
        "egfr": "mL/min/{1.73_m2}",
        "heart_rate": "/min",
        "systolic_bp": "mm[Hg]",
        "diastolic_bp": "mm[Hg]",
        "spo2": "%",
        "lvef": "%",
        "sodium": "mmol/L",
        "potassium": "mmol/L",
        "oxygen_requirement": "L/min",
    }

    def obs(
        day: int, kind: str, value: float | str, *, month: str = "08", issued_day: int | None = None
    ) -> None:
        stamp = f"2026-{month}-{day:02d}T08:00:00Z"
        issued = f"2026-{month}-{issued_day or day:02d}T10:00:00Z"
        resource: dict[str, Any] = {
            "resourceType": "Observation",
            "id": f"demo-{month}-{day:02d}-{kind}",
            "status": "final",
            "code": {
                "coding": [
                    {
                        "system": LOINC if kind in codes else LOCAL_SYSTEM,
                        "code": codes.get(kind, kind),
                    }
                ]
            },
            "subject": {"reference": PATIENT_REF},
            "effectiveDateTime": stamp,
            "issued": issued,
            "meta": {"lastUpdated": issued},
        }
        if isinstance(value, str):
            resource["valueString"] = value
        else:
            resource["valueQuantity"] = {
                "value": value,
                "unit": units[kind],
                "system": UCUM,
                "code": units[kind],
            }
        entries.append({"resource": resource})

    obs(1, "lvef", 42.0, month="04")  # deliberately stale at all August replays
    observations: dict[int, dict[str, float | str]] = {
        1: {
            "weight": 72.0,
            "edema": "absent",
            "dyspnea": "absent",
            "bnp": 80.0,
            "creatinine": 1.0,
            "egfr": 75.0,
            "heart_rate": 74.0,
            "systolic_bp": 118.0,
            "diastolic_bp": 72.0,
            "spo2": 98.0,
            "oxygen_requirement": 0.0,
            "rhythm": "sinus",
            "functional_capacity": "normal",
            "sodium": 138.0,
            "potassium": 4.2,
        },
        7: {
            "weight": 72.8,
            "edema": "mild",
            "dyspnea": "absent",
            "heart_rate": 82.0,
            "spo2": 96.0,
            "functional_capacity": "reduced",
        },
        10: {"weight": 73.8, "edema": "mild", "dyspnea": "absent", "heart_rate": 86.0},
        12: {
            "weight": 74.4,
            "edema": "moderate",
            "dyspnea": "moderate",
            "bnp": 420.0,
            "creatinine": 1.3,
            "egfr": 61.0,
            "spo2": 94.0,
            "oxygen_requirement": 1.0,
            "functional_capacity": "reduced",
        },
        15: {
            "weight": 75.2,
            "edema": "severe",
            "dyspnea": "severe",
            "bnp": 700.0,
            "creatinine": 1.5,
            "egfr": 51.0,
            "spo2": 91.0,
            "oxygen_requirement": 2.0,
            "heart_rate": 104.0,
            "systolic_bp": 142.0,
            "functional_capacity": "severe",
        },
        17: {"weight": 75.0, "edema": "moderate", "dyspnea": "moderate"},
        19: {
            "weight": 73.9,
            "edema": "mild",
            "dyspnea": "mild",
            "spo2": 95.0,
            "oxygen_requirement": 1.0,
            "creatinine": 1.6,
            "egfr": 48.0,
        },
        21: {
            "weight": 72.8,
            "edema": "absent",
            "dyspnea": "mild",
            "bnp": 260.0,
            "creatinine": 1.3,
            "egfr": 61.0,
            "oxygen_requirement": 0.0,
            "spo2": 97.0,
            "functional_capacity": "reduced",
            "heart_rate": 80.0,
            "sodium": 137.0,
            "potassium": 4.3,
        },
    }
    for day, values in observations.items():
        for kind, value in values.items():
            obs(day, kind, value)
    # Result measured on 10 August but unavailable until 12 August.
    obs(10, "bnp", 380.0, issued_day=12)
    for day in (15,):
        stamp = f"2026-08-{day:02d}T12:00:00Z"
        entries.append(
            {
                "resource": {
                    "resourceType": "Encounter",
                    "id": "demo-admission",
                    "status": "in-progress",
                    "class": {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        "code": "IMP",
                    },
                    "subject": {"reference": PATIENT_REF},
                    "period": {"start": stamp},
                    "meta": {"lastUpdated": stamp},
                }
            }
        )
    stamp = "2026-08-17T09:00:00Z"
    entries.append(
        {
            "resource": {
                "resourceType": "MedicationRequest",
                "id": "demo-diuretic-change",
                "status": "active",
                "intent": "order",
                "subject": {"reference": PATIENT_REF},
                "authoredOn": stamp,
                "meta": {"lastUpdated": stamp},
                "medicationCodeableConcept": {
                    "coding": [{"system": LOCAL_SYSTEM, "code": "diuretic_change"}],
                    "text": "Synthetic documented diuretic regimen change; dose intentionally omitted",
                },
            }
        }
    )
    return {"resourceType": "Bundle", "type": "collection", "entry": entries}


def demo_metadata() -> dict[str, Any]:
    """Fixed navigation schedule, not future evidence or outcome labels."""
    return {
        "label": "Synthetic longitudinal scenario — no real patient information",
        "start_at": DEMO_DATES[0],
        "end_at": DEMO_END,
        "replay_dates": list(DEMO_DATES),
        "guide": [
            "Choose 10 August: a BNP collected that day is still unavailable.",
            "Choose 12 August, then WHY: trace each change to original evidence.",
            "Compare 17 and 21 August: inspect observations after the documented intervention.",
            "Unknown pump/rhythm and residual renal uncertainty remain visible.",
        ],
    }

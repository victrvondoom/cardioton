"""One synthetic patient story composed over the original Cardio-Hemo demo."""

from __future__ import annotations

import math

from app.cardiotwin.hemodynamics.demo import PATIENT_REF, demo_bundle

from .schema import AtlasInput


def demo_input(as_of: str) -> AtlasInput:
    baseline = "2026-08-01T10:00:00Z"

    def source(identifier: str, modality: str, stamp: str, **kwargs: object) -> dict[str, object]:
        return {
            "id": identifier,
            "modality": modality,
            "event_at": stamp,
            "available_at": stamp,
            "provider_mode": "SYNTHETIC",
            "provider": "Synthetic research source",
            **kwargs,
        }

    samples = []
    for i in range(1000):
        t = (i / 250) % 0.84
        samples.append(
            round(
                0.04 * math.sin(i * 0.12)
                + 0.9 * math.exp(-(((t - 0.21) / 0.013) ** 2))
                - 0.18 * math.exp(-(((t - 0.24) / 0.014) ** 2))
                + 0.17 * math.exp(-(((t - 0.47) / 0.07) ** 2)),
                4,
            )
        )
    loc = {
        "id": "demo-home",
        "label": "Synthetic patient location",
        "latitude": 12.97,
        "longitude": 77.59,
        "event_at": baseline,
        "available_at": baseline,
        "synthetic": True,
    }

    def place(
        identifier: str, label: str, lat: float, lon: float, stamp: str, **kwargs: object
    ) -> dict[str, object]:
        return {
            **loc,
            "id": identifier,
            "label": label,
            "latitude": lat,
            "longitude": lon,
            "event_at": stamp,
            "available_at": stamp,
            **kwargs,
        }

    return AtlasInput.model_validate(
        {
            "as_of": as_of,
            "patient_ref": PATIENT_REF,
            "bundle": demo_bundle(),
            "modalities": [
                source(
                    "demo-ecg",
                    "ecg",
                    baseline,
                    waveform={
                        "samples": samples,
                        "sampling_rate_hz": 250,
                        "lead": "Synthetic lead II",
                    },
                    observations=[{"kind": "rhythm", "value": "sinus", "unit": None}],
                    uncertainties=[
                        "Synthetic waveform and separately authored rhythm finding; no waveform classifier was used."
                    ],
                ),
                source(
                    "demo-echo",
                    "imaging",
                    "2026-04-01T10:00:00Z",
                    media={
                        "kind": "metadata",
                        "filename": "synthetic-echo-metadata.json",
                        "description": "Schematic echo source context; no patient imaging and no imaging model.",
                    },
                    observations=[],
                    uncertainties=[
                        "Echo is stale in August. Current pump function remains UNKNOWN."
                    ],
                ),
                source(
                    "demo-voice",
                    "voice",
                    "2026-08-07T12:00:00Z",
                    text="I am getting breathless walking upstairs and my legs feel swollen.",
                    uncertainties=[
                        "Synthetic transcript, not a transcribed audio recording. Patient-reported symptoms require review."
                    ],
                ),
                source(
                    "demo-note",
                    "clinical_text",
                    "2026-08-12T12:00:00Z",
                    text="Patient reports reduced exercise tolerance. No diagnosis is extracted.",
                    uncertainties=["Synthetic note. Conservative symptom parser only."],
                ),
                source(
                    "demo-wearable",
                    "wearables",
                    "2026-08-07T11:00:00Z",
                    media={
                        "kind": "metadata",
                        "filename": "synthetic-wearable-summary.json",
                        "description": "Steps 8100 → 3400/day; sleep 6.5 h. Context only: steps and sleep have no new clinical-state rules.",
                    },
                ),
            ],
            "spatial": {
                "consent": True,
                "location": loc,
                "facilities": [
                    place(
                        "care-a",
                        "Atlas Research Hospital A",
                        12.99,
                        77.60,
                        baseline,
                        capabilities={"emergency": "YES", "cardiology": "YES", "cath_lab": "YES"},
                    ),
                    place(
                        "care-b",
                        "Atlas Research Clinic B",
                        12.94,
                        77.62,
                        baseline,
                        capabilities={
                            "emergency": "NO",
                            "cardiology": "YES",
                            "cath_lab": "UNKNOWN",
                        },
                    ),
                    place(
                        "care-c",
                        "Atlas Rehabilitation C",
                        13.01,
                        77.56,
                        baseline,
                        capabilities={"rehabilitation": "YES", "cardiac_icu": "UNKNOWN"},
                    ),
                ],
                "events": [
                    place(
                        "spatial-symptom",
                        "Patient-reported breathlessness",
                        12.972,
                        77.592,
                        "2026-08-07T12:00:00Z",
                        evidence_refs=["atlas-source:demo-voice:0"],
                    ),
                    place(
                        "spatial-encounter",
                        "Synthetic clinical encounter",
                        12.99,
                        77.60,
                        "2026-08-15T12:00:00Z",
                    ),
                    place(
                        "spatial-intervention",
                        "Documented intervention context",
                        12.99,
                        77.60,
                        "2026-08-17T12:00:00Z",
                    ),
                ],
                "environment": [
                    place(
                        "context-heat",
                        "Synthetic temperature context",
                        12.97,
                        77.59,
                        "2026-08-07T12:00:00Z",
                        kind="temperature",
                        value=32.0,
                        unit="Cel",
                    ),
                    place(
                        "context-air",
                        "Synthetic PM2.5 context",
                        12.97,
                        77.59,
                        "2026-08-12T12:00:00Z",
                        kind="PM2.5",
                        value=28.0,
                        unit="ug/m3",
                    ),
                ],
            },
        }
    )

"""The three flagship CROSS-5 experiments.

Each experiment is a deterministic orchestration over the frame modules, with
every component carrying its own provenance and limitations. Experiments
produce research artefacts — never diagnoses, never causal claims, never
invented intersections.

A  Earth to Heart   — region context + synthetic patient timeline + real model prediction
B  Artery to Time   — coronary microphysics scenarios + waveform replay + (kept separate) CAD probability
C  Planet to City to Heart — full chain with unified provenance report
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from app.cardiotwin.cross5 import chronos, city, earth, intersections, microphysics
from app.cardiotwin.multimodal.fusion import MultimodalInput, fuse_predictions
from app.iit_mandi.scenarios import get_scenario

EXPERIMENT_NOTICE = (
    "Research demonstration over synthetic patients, published aggregate statistics and "
    "hypothetical simulations. No clinical validation; no causal claims."
)

EXPERIMENTS = [
    {
        "id": "earth_to_heart",
        "title": "Experiment A — Earth to Heart",
        "frames": ["cardioearth", "cardiochronos", "cardiotwin"],
        "description": (
            "Select a country for planetary context, align a synthetic patient's timeline, "
            "run the real CAD model, and show the declared (association-only) intersections."
        ),
    },
    {
        "id": "artery_to_time",
        "title": "Experiment B — Artery to Time",
        "frames": ["cardiotwin", "cardioflow"],
        "description": (
            "Inspect a coronary vessel's hypothetical microphysics: geometry scenarios, "
            "cardiac-cycle waveform replay, and — kept explicitly separate — the vessel's "
            "statistical CAD probability."
        ),
    },
    {
        "id": "planet_to_city_to_heart",
        "title": "Experiment C — Planet to City to Heart",
        "frames": ["cardioearth", "cardiocity", "cardiochronos", "cardiotwin", "cardioflow"],
        "description": (
            "Full-chain research scenario: regional context, city access analysis, time-aligned "
            "synthetic patient history, CAD prediction and coronary microphysics — each step labelled."
        ),
    },
]


def _patient_prediction(scenario_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    scenario = get_scenario(scenario_id)
    if scenario is None:
        raise ValueError(f"Unknown synthetic scenario: {scenario_id}")
    prediction = fuse_predictions(
        MultimodalInput(ehr_data=scenario.ehr_data, patient_id=scenario.id)
    )
    return scenario.to_dict(), prediction.to_dict()


def _temporal_alignment(day: date, timeline_hours: float) -> dict[str, Any]:
    """Declared temporal alignment between an environmental day and the patient timeline."""
    env_start = datetime(day.year, day.month, day.day, tzinfo=UTC)
    env_end = env_start + timedelta(days=1)
    patient_start = datetime(2026, 3, 2, tzinfo=UTC)
    patient_end = patient_start + timedelta(hours=timeline_hours)
    start = max(env_start, patient_start)
    end = min(env_end, patient_end)
    overlap = max(0.0, (end - start).total_seconds()) if end > start else 0.0
    return {
        "environment_window": [env_start.isoformat(), env_end.isoformat()],
        "patient_window": [patient_start.isoformat(), patient_end.isoformat()],
        "overlap_seconds": overlap,
        "link_type": "temporal alignment (interval overlap only)",
        "caution": (
            "Co-occurrence of environmental and physiological observations is an alignment, "
            "not evidence that exposure caused any physiological change."
        ),
    }


def run_earth_to_heart(country_iso: str, scenario_id: str = "high_risk_65m",
                       day: date | None = None) -> dict[str, Any]:
    profile = earth.country_profile(country_iso)
    if profile is None:
        raise ValueError(f"Country {country_iso} is not in the committed snapshot")
    day = day or date(2026, 3, 2)
    timeline = chronos.synthetic_timeline("normal", hours=48)
    scenario, prediction = _patient_prediction(scenario_id)
    available = intersections.available_intersections(["cardioearth", "cardiochronos", "cardiotwin"])
    return {
        "experiment": "earth_to_heart",
        "country": profile,
        "patient": {
            "scenario": scenario,
            "fused_prediction": prediction["fused_predictions"],
            "confidence": prediction["confidence"],
            "uncertainty": prediction["uncertainty"],
            "label": "synthetic patient; real evaluated model inference",
        },
        "temporal_alignment": _temporal_alignment(day, timeline["hours"]),
        "timeline_bands": {k: len(v) if isinstance(v, list) else v for k, v in timeline["bands"].items() if k != "ecg_excerpt"},
        "declared_intersections": available,
        "provenance": {
            "country_statistics": "WHO GHO published estimates (static snapshot; verify at source)",
            "patient_timeline": "synthetic generators (CardioTon ecg/wearables modules)",
            "cad_prediction": "CardioTwin evaluated logistic model (multimodal fusion)",
        },
        "limitations": [
            "Country mortality is an aggregate population statistic and does not apply to the individual patient.",
            "Temporal alignment does not establish causation between environment and physiology.",
            "Environmental co-window uses fixed demonstration dates.",
        ],
        "notice": EXPERIMENT_NOTICE,
    }


def run_artery_to_time(vessel_id: str = "LAD", stenosis_pct: float = 70.0,
                       scenario_id: str = "high_risk_65m") -> dict[str, Any]:
    simulation = microphysics.simulate_vessel(vessel_id, stenosis_pct)
    scenarios = microphysics.compare_scenarios(vessel_id, [0, 30, 50, 70, 85])
    scenario, prediction = _patient_prediction(scenario_id)
    vessel_probability = {
        "LAD": prediction["fused_predictions"]["lad_probability"],
        "LCX": prediction["fused_predictions"]["lcx_probability"],
        "RCA": prediction["fused_predictions"]["rca_probability"],
    }.get(vessel_id)
    return {
        "experiment": "artery_to_time",
        "vessel_id": vessel_id,
        "simulation": simulation,
        "scenario_comparison": scenarios,
        "statistical_prediction_kept_separate": {
            "vessel": vessel_id,
            "cad_probability": vessel_probability,
            "label": (
                "Statistical probability from tabular features (evaluated model). It is NOT "
                "the simulated stenosis: the 0D solver explores hypothetical geometry only, "
                "and the probability never places a lesion."
            ),
        },
        "time_axis_note": intersections.UNSUPPORTED.get(
            ("cardiochronos", "cardioflow"),
            "CardioFlow time is model time (cardiac cycle), not wall-clock.",
        ),
        "provenance": {
            "physics": "shared 0D Poiseuille-Bernoulli coronary solver (hemodynamics/physics.py)",
            "prediction": "CardioTwin evaluated logistic model",
        },
        "limitations": [
            "Hypothetical geometry on nominal reference vessels; not patient-specific.",
            "FFR values are model indices of hypothetical lesions, not clinical measurements.",
        ],
        "notice": EXPERIMENT_NOTICE,
    }


def run_planet_to_city_to_heart(country_iso: str = "IN",
                                scenario_id: str = "high_risk_65m",
                                vessel_id: str = "LAD") -> dict[str, Any]:
    profile = earth.country_profile(country_iso)
    if profile is None:
        raise ValueError(f"Country {country_iso} is not in the committed snapshot")
    baseline_access = city.access_analysis()
    scenario_access = city.access_analysis(
        added_facility={"id": "h3", "name": "Hypothetical Cardiac Satellite Clinic",
                        "category": "clinic", "node": "n03"}
    )
    timeline = chronos.synthetic_timeline("normal", hours=48)
    scenario, prediction = _patient_prediction(scenario_id)
    flow_summary = microphysics.compare_scenarios(vessel_id, [0, 50, 70])
    available = intersections.available_intersections(
        ["cardioearth", "cardiocity", "cardiochronos", "cardiotwin", "cardioflow"]
    )
    return {
        "experiment": "planet_to_city_to_heart",
        "country": profile,
        "city_access": {
            "baseline": baseline_access["city_wide"],
            "hypothetical_scenario": scenario_access["city_wide"],
            "scenario_label": scenario_access["scenario_label"],
        },
        "patient_timeline": {k: len(v) if isinstance(v, list) else v for k, v in timeline["bands"].items() if k != "ecg_excerpt"},
        "patient_prediction": {
            "fused": prediction["fused_predictions"],
            "confidence": prediction["confidence"],
            "label": "synthetic patient; real evaluated model inference",
        },
        "coronary_microphysics_summary": flow_summary,
        "declared_intersections": available,
        "provenance_chain": [
            "WHO GHO country snapshot (aggregate, verify at source)",
            "synthetic city graph (Dijkstra travel-time analysis)",
            "synthetic patient timeline (CardioTon generators)",
            "CardioTwin logistic model inference (evaluated artifact)",
            "0D coronary solver hypothetical scenarios (nominal geometry)",
        ],
        "limitations": [
            "Each quantity keeps its own frame, units and evidence status; nothing was merged.",
            "City access and coronary physics are hypothetical demonstrations, not measurements.",
            "Population statistics never become individual risk inputs.",
        ],
        "notice": EXPERIMENT_NOTICE,
    }


def run_experiment(experiment_id: str, **kwargs) -> dict[str, Any]:
    if experiment_id == "earth_to_heart":
        return run_earth_to_heart(
            kwargs.get("country_iso", "IN"), kwargs.get("scenario_id", "high_risk_65m"),
            kwargs.get("day"),
        )
    if experiment_id == "artery_to_time":
        return run_artery_to_time(
            kwargs.get("vessel_id", "LAD"), kwargs.get("stenosis_pct", 70.0),
            kwargs.get("scenario_id", "high_risk_65m"),
        )
    if experiment_id == "planet_to_city_to_heart":
        return run_planet_to_city_to_heart(
            kwargs.get("country_iso", "IN"), kwargs.get("scenario_id", "high_risk_65m"),
            kwargs.get("vessel_id", "LAD"),
        )
    raise ValueError(f"Unknown experiment: {experiment_id}")

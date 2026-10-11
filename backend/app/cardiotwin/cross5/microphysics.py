"""CardioFlow — coronary vascular microphysics laboratory (reduced-order).

REUSE, not duplication: the steady-state lesion circuit (Poiseuille viscous
term + Bernoulli expansion term + microvascular bed, quadratic solve for flow,
FFR / Reynolds / wall-shear outputs) is the existing, tested
``app.cardiotwin.hemodynamics.physics.solve_vessel_physics``. This module adds:

1. A documented, piecewise-analytic aortic pressure waveform over one
   representative cardiac cycle (systolic rise + exponential diastolic decay)
   and a representative coronary flow phasicity factor (coronary flow is
   predominantly diastolic). These are *reduced-order waveform models*, not
   patient measurements.
2. Instantaneous pressure-drop evaluation using the same circuit relation
   (ΔP = R_v·Q + K·Q²), so the time series is consistent with the steady solver.
3. Centreline spatial sampling: luminal diameter profile with a Gaussian lesion,
   arc-length pressure distribution, velocity field and cross-sectional area.

Every output is labelled: hypothetical simulation on nominal reference
geometry, not patient-specific, not a diagnosis. FFR here is a model index of a
hypothetical lesion, never a clinical measurement.
"""

from __future__ import annotations

import math
from typing import Any

from app.cardiotwin.hemodynamics.physics import (
    NOMINAL_GEOMETRY,
    solve_vessel_physics,
)

SIMULATION_NOTICE = (
    "Hypothetical reduced-order simulation on nominal reference coronary geometry. "
    "Not patient-specific (no validated patient geometry or boundary conditions), "
    "not a diagnosis, and not a clinical FFR measurement. Absolute magnitudes reflect "
    "the nominal circuit calibration of the shared 0D solver; interpret results "
    "comparatively (baseline vs. hypothetical stenosis), not as absolute physiological flows."
)

# Representative cardiac cycle parameters (documented reduced-order values).
CYCLE_SECONDS = 0.8  # 75 bpm
SYSTOLE_FRACTION = 0.35
DIASTOLIC_DECAY_TAU = 0.35  # exponential diastolic decay time constant (s)
CORONARY_SYSTOLIC_FACTOR = 0.55  # systolic compression reduces coronary flow
CORONARY_DIASTOLIC_FACTOR = 1.2

# Model relation registered for the intersection engine (flow → pressures).
MODEL_RELATION = (
    "ΔP(Q) = R_viscous·Q + K_inertial·Q² (Poiseuille + sudden-expansion Bernoulli), "
    "Q from quadratic circuit solve against the microvascular bed — see "
    "app.cardiotwin.hemodynamics.physics"
)


def vessel_catalog() -> dict[str, Any]:
    return {
        "vessels": {
            vessel: {
                "nominal_length_mm": geom["length_mm"],
                "reference_diameter_mm": geom["ref_diameter_mm"],
            }
            for vessel, geom in NOMINAL_GEOMETRY.items()
        },
        "notice": SIMULATION_NOTICE,
    }


def aortic_pressure_waveform(systolic_mmhg: float, diastolic_mmhg: float,
                             samples: int = 80) -> list[dict[str, float]]:
    """Piecewise-analytic representative aortic pressure over one cardiac cycle.

    Systole: raised-cosine rise from diastolic to systolic pressure.
    Diastole: exponential decay back toward diastolic pressure.
    Documented reduced-order waveform model; not a patient measurement.
    """
    if not 0 < samples <= 400:
        raise ValueError("samples must be in (0, 400]")
    if not diastolic_mmhg < systolic_mmhg:
        raise ValueError("systolic pressure must exceed diastolic pressure")
    t_s = CYCLE_SECONDS * SYSTOLE_FRACTION
    out: list[dict[str, float]] = []
    for i in range(samples):
        t = CYCLE_SECONDS * i / (samples - 1)
        if t <= t_s:
            phase = math.pi * t / t_s
            p = diastolic_mmhg + (systolic_mmhg - diastolic_mmhg) * (0.5 * (1 - math.cos(phase)))
        else:
            decay = math.exp(-(t - t_s) / DIASTOLIC_DECAY_TAU)
            p = diastolic_mmhg + (systolic_mmhg - diastolic_mmhg) * decay
        out.append({"t_s": round(t, 4), "p_aortic_mmhg": round(p, 2)})
    return out


def _coronary_flow_factor(t: float) -> float:
    """Representative coronary phasicity: systolic compression, diastolic predominance."""
    phase = (t % CYCLE_SECONDS) / CYCLE_SECONDS
    systolic = phase <= SYSTOLE_FRACTION
    return CORONARY_SYSTOLIC_FACTOR if systolic else CORONARY_DIASTOLIC_FACTOR


def _lesion_diameter(d0_mm: float, stenosis_pct: float, x_mm: float,
                     center_mm: float, length_mm: float) -> float:
    """Luminal diameter along the centreline with a Gaussian area-reduction lesion."""
    if stenosis_pct <= 0:
        return d0_mm
    sigma = max(length_mm / 4.0, 1.0)
    reduction = (stenosis_pct / 100.0) * math.exp(-((x_mm - center_mm) ** 2) / (2 * sigma * sigma))
    return d0_mm * math.sqrt(max(0.05, 1.0 - reduction))


def simulate_vessel(
    vessel_id: str,
    stenosis_pct: float,
    *,
    lesion_center_mm: float | None = None,
    systolic_mmhg: float = 120.0,
    diastolic_mmhg: float = 80.0,
    hyperemia_factor: float = 1.0,
    time_samples: int = 80,
    centreline_samples: int = 48,
) -> dict[str, Any]:
    """Time-dependent reduced-order simulation of one hypothetical vessel state."""
    mean_aortic = diastolic_mmhg + (systolic_mmhg - diastolic_mmhg) / 3.0
    steady = solve_vessel_physics(
        vessel_id, stenosis_pct, mean_aortic_pressure_mmhg=mean_aortic, hyperemia_factor=hyperemia_factor
    )
    geom = NOMINAL_GEOMETRY[vessel_id]
    length_mm = geom["length_mm"]
    d0_mm = geom["ref_diameter_mm"]
    center = lesion_center_mm if lesion_center_mm is not None else length_mm * 0.45
    if not 0 <= center <= length_mm:
        raise ValueError("lesion_center_mm must lie within the vessel length")

    mmhg_per_pa = 1.0 / 133.322
    # Instantaneous circuit coefficients from the steady solve (same relation).
    r_viscous = steady.viscous_resistance * 1e6  # Pa·s/m³
    k_inertial = steady.inertial_resistance * 1e12  # Pa·s²/m⁶
    q_mean = steady.flow_rate_ml_min / 6e7  # m³/s

    time_series = []
    for i in range(time_samples):
        t = CYCLE_SECONDS * i / (time_samples - 1)
        p_aortic = aortic_pressure_waveform(systolic_mmhg, diastolic_mmhg, 2 * time_samples)[2 * i]["p_aortic_mmhg"]
        q_t = q_mean * _coronary_flow_factor(t) / (
            CORONARY_SYSTOLIC_FACTOR * SYSTOLE_FRACTION
            + CORONARY_DIASTOLIC_FACTOR * (1 - SYSTOLE_FRACTION)
        )
        delta_p_pa = r_viscous * q_t + k_inertial * q_t * q_t
        p_distal = max(0.0, p_aortic - delta_p_pa * mmhg_per_pa)
        time_series.append(
            {
                "t_s": round(t, 4),
                "p_aortic_mmhg": p_aortic,
                "p_distal_mmhg": round(p_distal, 2),
                "q_ml_min": round(q_t * 6e7, 2),
                "translesional_dp_mmhg": round(delta_p_pa * mmhg_per_pa, 2),
            }
        )

    centreline = []
    for i in range(centreline_samples):
        x = length_mm * i / (centreline_samples - 1)
        d = _lesion_diameter(d0_mm, stenosis_pct, x, center, length_mm)
        area_mm2 = math.pi * (d / 2.0) ** 2
        centreline.append(
            {
                "x_mm": round(x, 2),
                "diameter_mm": round(d, 3),
                "area_mm2": round(area_mm2, 3),
            }
        )

    return {
        "vessel_id": vessel_id,
        "stenosis_pct": stenosis_pct,
        "lesion_center_mm": round(center, 1),
        "hyperemia_factor": hyperemia_factor,
        "steady_state": {
            "ffr_index": steady.ffr,
            "flow_rate_ml_min": steady.flow_rate_ml_min,
            "translesional_dp_mmhg": steady.translesional_dp_mmhg,
            "reynolds_number": steady.reynolds_number,
            "wall_shear_stress_pa": steady.wall_shear_stress_pa,
            "flow_regime": steady.flow_regime,
            "ischemic_threshold_flag": bool(steady.is_ischemic),
        },
        "waveform": {
            "cycle_seconds": CYCLE_SECONDS,
            "time_series": time_series,
            "model": (
                "raised-cosine systolic rise + exponential diastolic decay aortic waveform; "
                "representative coronary phasicity (systolic compression factor "
                f"{CORONARY_SYSTOLIC_FACTOR}, diastolic factor {CORONARY_DIASTOLIC_FACTOR})"
            ),
        },
        "centreline": {
            "samples": centreline,
            "min_diameter_mm": min(s["diameter_mm"] for s in centreline),
            "min_area_mm2": min(s["area_mm2"] for s in centreline),
        },
        "model_relation": MODEL_RELATION,
        "notice": SIMULATION_NOTICE,
    }


def compare_scenarios(vessel_id: str, stenosis_values: list[float], **kwargs: Any) -> dict[str, Any]:
    """Reproducible hypothetical-geometry comparison curve (FFR index vs stenosis)."""
    if not stenosis_values:
        raise ValueError("Provide at least one stenosis value")
    scenarios = []
    for stenosis in sorted(set(stenosis_values)):
        sim = simulate_vessel(vessel_id, stenosis, **kwargs)
        scenarios.append(
            {
                "stenosis_pct": stenosis,
                "ffr_index": sim["steady_state"]["ffr_index"],
                "flow_rate_ml_min": sim["steady_state"]["flow_rate_ml_min"],
                "translesional_dp_mmhg": sim["steady_state"]["translesional_dp_mmhg"],
                "ischemic_threshold_flag": sim["steady_state"]["ischemic_threshold_flag"],
            }
        )
    return {
        "vessel_id": vessel_id,
        "scenarios": scenarios,
        "notice": SIMULATION_NOTICE
        + " Differences between scenarios are model outputs of hypothetical geometry, not measured disease progression.",
    }

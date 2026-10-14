"""0D/1D Lumped-Parameter Coronary Hemodynamic Circuit Solver.

Replaces heuristic linear formulas with physics-grounded fluid mechanics:
- Translesional pressure drop governed by non-linear Poiseuille-Bernoulli resistance:
    ΔP = R_viscous · Q + R_inertial · Q²
- The terminal bed is a steady resistance; no pulsatile compliance is solved.
- Flow Q is the stable positive root of the quadratic circuit equation.
- The simulated distal/aortic pressure ratio is not a measured clinical FFR.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

# Physical constants for human blood in epicardial coronaries
BLOOD_DENSITY_KG_M3 = 1050.0       # ρ (kg/m³)
BLOOD_VISCOSITY_PA_S = 0.0035      # μ (Pa·s, dynamic viscosity)
TURBULENT_REYNOLDS_LIMIT = 2000.0  # Screening heuristic, not a universal transition

# Anatomical baselines for epicardial vessels (nominal length in mm, nominal diameter in mm)
NOMINAL_GEOMETRY: dict[str, dict[str, float]] = {
    "LAD": {"length_mm": 95.0, "ref_diameter_mm": 3.6, "microvascular_resistance_base": 0.85},
    "LCX": {"length_mm": 75.0, "ref_diameter_mm": 3.2, "microvascular_resistance_base": 1.10},
    "RCA": {"length_mm": 110.0, "ref_diameter_mm": 3.4, "microvascular_resistance_base": 0.95},
}


@dataclass(frozen=True)
class HemodynamicState:
    vessel_id: str
    stenosis_pct: float
    aortic_pressure_mmhg: float
    distal_pressure_mmhg: float
    ffr: float
    flow_rate_ml_min: float
    translesional_dp_mmhg: float
    reynolds_number: float
    wall_shear_stress_pa: float
    viscous_resistance: float
    inertial_resistance: float
    flow_regime: str
    is_ischemic: bool


def solve_vessel_physics(
    vessel_id: str,
    stenosis_pct: float,
    mean_aortic_pressure_mmhg: float = 93.3,
    hyperemia_factor: float = 1.0,
    *,
    blood_viscosity_pa_s: float = BLOOD_VISCOSITY_PA_S,
    blood_density_kg_m3: float = BLOOD_DENSITY_KG_M3,
    vessel_diameter_mm: float | None = None,
    lesion_length_mm: float | None = None,
    microvascular_resistance_factor: float = 1.0,
) -> HemodynamicState:
    """Solve 0D/1D Poiseuille-Bernoulli Navier-Stokes approximation for a coronary vessel.

    Parameters:
    - stenosis_pct: percentage luminal area reduction (0 to 95%).
    - mean_aortic_pressure_mmhg: MAP in mmHg (e.g., 93.3 for 120/80).
    - hyperemia_factor: inotropic stress multiplier (1.0 = rest, 1.45 = dobutamine / adenosine).
    """
    if vessel_id not in NOMINAL_GEOMETRY:
        raise ValueError(f"Unsupported vessel: {vessel_id}")
    if isinstance(stenosis_pct, bool) or not isinstance(stenosis_pct, int | float) or not math.isfinite(stenosis_pct) or not 0 <= stenosis_pct <= 95:
        raise ValueError("stenosis_pct must be finite and in [0, 95] (area reduction)")
    geom = NOMINAL_GEOMETRY[vessel_id]
    length = lesion_length_mm if lesion_length_mm is not None else geom["length_mm"]
    diameter = vessel_diameter_mm if vessel_diameter_mm is not None else geom["ref_diameter_mm"]
    for name, value in {
        "mean_aortic_pressure_mmhg": mean_aortic_pressure_mmhg,
        "hyperemia_factor": hyperemia_factor,
        "blood_viscosity_pa_s": blood_viscosity_pa_s,
        "blood_density_kg_m3": blood_density_kg_m3,
        "vessel_diameter_mm": diameter,
        "lesion_length_mm": length,
        "microvascular_resistance_factor": microvascular_resistance_factor,
    }.items():
        if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value) or value <= 0:
            raise ValueError(f"{name} must be finite and positive")
    l_m = length * 1e-3
    d0_m = diameter * 1e-3
    a0_m2 = math.pi * (d0_m / 2.0) ** 2

    s = stenosis_pct / 100.0
    d_sten_m = d0_m * math.sqrt(1.0 - s)
    a_sten_m2 = math.pi * (d_sten_m / 2.0) ** 2

    # Viscous resistance coefficient (Poiseuille term): Pa / (m³/s)
    # R_v = 128 * μ * L / (π * D_sten^4)
    r_viscous = (128.0 * blood_viscosity_pa_s * l_m) / (math.pi * (d_sten_m**4))

    # Inertial / expansion loss coefficient (Bernoulli separation term): Pa / (m³/s)²
    # Sudden-expansion approximation: ΔP = ρ/2 * (Q/A_sten - Q/A0)².
    k_inertial = (blood_density_kg_m3 / 2.0) * (1.0 / a_sten_m2 - 1.0 / a0_m2) ** 2

    # Microvascular bed resistance (dilates under hyperemia): Pa / (m³/s)
    # Nominal resting microvascular resistance scaled to ~ 1.2e9 Pa·s/m³
    base_micro_r = geom["microvascular_resistance_base"] * 1.3e9 * microvascular_resistance_factor
    r_microvascular = base_micro_r / (hyperemia_factor * 2.8)

    # Paortic in Pascals (1 mmHg = 133.322 Pa)
    p_aortic_pa = mean_aortic_pressure_mmhg * 133.322

    # Solve non-linear equation for flow Q (m³/s):
    # P_aortic = ΔP_lesion + P_microvascular
    # P_aortic = (R_v * Q + K_inertial * Q²) + R_microvascular * Q
    # K_inertial * Q² + (R_v + R_micro) * Q - P_aortic = 0
    # Quadratic formula: Q = (-b + sqrt(b² - 4ac)) / (2a)
    a_quad = k_inertial
    b_quad = r_viscous + r_microvascular
    # Rationalized quadratic root avoids catastrophic cancellation near zero stenosis.
    discriminant = b_quad**2 + 4.0 * a_quad * p_aortic_pa
    q_m3_s = 2.0 * p_aortic_pa / (b_quad + math.sqrt(discriminant))
    if not math.isfinite(q_m3_s) or q_m3_s <= 0:
        raise ArithmeticError("Nonfinite or nonpositive flow from circuit solver")

    # Calculate translesional drop & distal pressure
    delta_p_pa = (r_viscous * q_m3_s) + (k_inertial * (q_m3_s**2))
    p_distal_pa = max(0.0, p_aortic_pa - delta_p_pa)

    delta_p_mmhg = delta_p_pa / 133.322
    p_distal_mmhg = p_distal_pa / 133.322
    ffr = p_distal_mmhg / mean_aortic_pressure_mmhg

    # Flow rate in mL/min (1 m³/s = 60,000,000 mL/min)
    q_ml_min = q_m3_s * 6e7

    # Fluid velocity at stenosis v = Q / A_sten
    v_sten_m_s = q_m3_s / a_sten_m2

    # Reynolds number at throat
    reynolds = (blood_density_kg_m3 * v_sten_m_s * d_sten_m) / blood_viscosity_pa_s

    # Wall shear stress τ_w = 4 * μ * Q / (π * r³) (in Pascals)
    r_sten_m = d_sten_m / 2.0
    wall_shear_pa = (4.0 * blood_viscosity_pa_s * q_m3_s) / (math.pi * (r_sten_m**3))

    flow_regime = "Elevated Reynolds screening indicator; regime unresolved" if reynolds > TURBULENT_REYNOLDS_LIMIT else "Low Reynolds screening indicator; laminar approximation assumed"

    return HemodynamicState(
        vessel_id=vessel_id,
        stenosis_pct=round(stenosis_pct, 1),
        aortic_pressure_mmhg=round(mean_aortic_pressure_mmhg, 1),
        distal_pressure_mmhg=round(p_distal_mmhg, 1),
        ffr=round(ffr, 6),
        flow_rate_ml_min=round(q_ml_min, 1),
        translesional_dp_mmhg=round(delta_p_mmhg, 1),
        reynolds_number=round(reynolds, 1),
        wall_shear_stress_pa=round(wall_shear_pa, 2),
        viscous_resistance=round(r_viscous / 1e6, 2),    # MPa·s/m³
        inertial_resistance=round(k_inertial / 1e12, 3), # TPa·s²/m⁶
        flow_regime=flow_regime,
        is_ischemic=ffr <= 0.80,
    )


def solve_coronary_tree_physics(
    vessel_stenoses: dict[str, float],
    mean_aortic_pressure_mmhg: float = 93.3,
    stress_mode: bool = False,
) -> dict[str, Any]:
    """Solve full coronary tree with 3 epicardial branches."""
    hyperemia = 1.45 if stress_mode else 1.0
    results: dict[str, Any] = {}
    total_flow = 0.0

    for v in ("LAD", "LCX", "RCA"):
        sten = vessel_stenoses.get(v, 20.0)
        state = solve_vessel_physics(v, sten, mean_aortic_pressure_mmhg, hyperemia)
        total_flow += state.flow_rate_ml_min
        results[v] = {
            "vessel_id": state.vessel_id,
            "stenosis_pct": state.stenosis_pct,
            "mean_aortic_pressure_mmhg": state.aortic_pressure_mmhg,
            "distal_coronary_pressure_mmhg": state.distal_pressure_mmhg,
            "translesional_pressure_gradient_mmhg": state.translesional_dp_mmhg,
            "ffr_physics": state.ffr,
            "coronary_flow_ml_min": state.flow_rate_ml_min,
            "reynolds_number": state.reynolds_number,
            "wall_shear_stress_pa": state.wall_shear_stress_pa,
            "viscous_resistance_mpa_s_m3": state.viscous_resistance,
            "inertial_resistance_tpa_s2_m6": state.inertial_resistance,
            "flow_regime": state.flow_regime,
            "is_ischemic": state.is_ischemic,
        }

    return {
        "solver_type": "Steady 0D lumped Poiseuille and sudden-expansion resistance circuit",
        "governing_equations": "P_aortic = (R_viscous + R_terminal) Q + K_expansion Q²; K_expansion = rho/2 (1/A_sten - 1/A_ref)²",
        "assumptions": ["Nominal synthetic geometry", "Stenosis is luminal area reduction, not diameter reduction", "Steady incompressible Newtonian flow", "Zero terminal venous pressure", "Terminal resistance only; no Windkessel compliance or pulsatile dynamics", "Pressure ratios are simulated; clinical FFR is not measured", "Reynolds indicator does not determine an exact turbulence transition"],
        "defaulted_stenosis_vessels": [v for v in ("LAD", "LCX", "RCA") if v not in vessel_stenoses],
        "fluid_properties": {
            "blood_density_kg_m3": BLOOD_DENSITY_KG_M3,
            "dynamic_viscosity_pa_s": BLOOD_VISCOSITY_PA_S,
        },
        "hyperemic_stress_state": stress_mode,
        "total_myocardial_perfusion_ml_min": round(total_flow, 1),
        "vessels": results,
    }

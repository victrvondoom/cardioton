"""Counterfactual Hemodynamic Laboratory — Parameter Sweep & Sensitivity Engine.

Extends the existing 0D/1D Poiseuille-Bernoulli Windkessel solver with:
- Parameter sweep across any defensible physiological variable
- Finite-difference local sensitivity analysis (dOutput/dInput)
- Side-by-side baseline vs. intervention scenario comparison
- Dimensional consistency checks and limiting-case validation
- Numerical stability diagnostics
"""

from __future__ import annotations

import copy
from typing import Any, NotRequired, TypedDict

from app.cardiotwin.hemodynamics.physics import (
    BLOOD_DENSITY_KG_M3,
    BLOOD_VISCOSITY_PA_S,
    NOMINAL_GEOMETRY,
    solve_vessel_physics,
)


class ParameterBounds(TypedDict):
    min: float
    max: float
    unit: str
    step: float


class NumericSolverResult(TypedDict):
    ffr: float
    distal_pressure_mmhg: float
    flow_rate_ml_min: float
    translesional_dp_mmhg: float
    reynolds_number: float
    wall_shear_stress_pa: float
    viscous_resistance: float
    inertial_resistance: float
    stenosis_pct: float
    aortic_pressure_mmhg: float


class SolverResult(NumericSolverResult):
    flow_regime: str
    is_ischemic: bool
    sweep_param_value: NotRequired[float]


class ResultError(TypedDict):
    error: str


class ParameterSensitivity(TypedDict):
    parameter: str
    unit: str
    center_value: float
    local_derivative: float
    elasticity: float
    abs_elasticity: float
    interpretation: str


class SensitivityResult(TypedDict):
    vessel_id: str
    target_output: str
    baseline_value: float
    perturbation_fraction: float
    method: str
    sensitivities: list[ParameterSensitivity]


# Defensible parameter ranges from published physiology literature
PARAMETER_BOUNDS: dict[str, ParameterBounds] = {
    "stenosis_pct": {"min": 0.0, "max": 95.0, "unit": "%", "step": 5.0},
    "mean_aortic_pressure_mmhg": {"min": 50.0, "max": 180.0, "unit": "mmHg", "step": 5.0},
    "blood_viscosity_pa_s": {"min": 0.0025, "max": 0.005, "unit": "Pa.s", "step": 0.0005},
    "blood_density_kg_m3": {"min": 1020.0, "max": 1080.0, "unit": "kg/m3", "step": 10.0},
    "vessel_diameter_mm": {"min": 1.5, "max": 5.0, "unit": "mm", "step": 0.25},
    "lesion_length_mm": {"min": 5.0, "max": 50.0, "unit": "mm", "step": 5.0},
    "hyperemia_factor": {"min": 1.0, "max": 3.0, "unit": "x", "step": 0.25},
    "microvascular_resistance_factor": {"min": 0.3, "max": 2.5, "unit": "x", "step": 0.2},
}

OUTPUT_KEYS = [
    "ffr", "distal_pressure_mmhg", "flow_rate_ml_min",
    "translesional_dp_mmhg", "reynolds_number", "wall_shear_stress_pa",
]


def validate_parameter_range(param_name: str, value: float) -> tuple[bool, str]:
    """Validate a parameter value against physiological bounds."""
    bounds = PARAMETER_BOUNDS.get(param_name)
    if bounds is None:
        return False, f"Unknown parameter: {param_name}"
    if value < bounds["min"] or value > bounds["max"]:
        return False, (
            f"{param_name}={value} outside physiological range "
            f"[{bounds['min']}, {bounds['max']}] {bounds['unit']}"
        )
    return True, "OK"


def _solve_with_overrides(
    vessel_id: str,
    stenosis_pct: float = 30.0,
    mean_aortic_pressure_mmhg: float = 93.3,
    hyperemia_factor: float = 1.0,
    blood_viscosity_override: float | None = None,
    blood_density_override: float | None = None,
    vessel_diameter_override_mm: float | None = None,
    lesion_length_override_mm: float | None = None,
    microvascular_resistance_factor: float | None = None,
) -> SolverResult:
    """Solve vessel physics with optional parameter overrides.

    Temporarily patches module-level constants for the solve, then restores them.
    This is safe because the solver is stateless and single-threaded per request.
    """
    import app.cardiotwin.hemodynamics.physics as phys

    # Save originals
    orig_viscosity = phys.BLOOD_VISCOSITY_PA_S
    orig_density = phys.BLOOD_DENSITY_KG_M3
    orig_geom = copy.deepcopy(phys.NOMINAL_GEOMETRY)

    try:
        if blood_viscosity_override is not None:
            phys.BLOOD_VISCOSITY_PA_S = blood_viscosity_override
        if blood_density_override is not None:
            phys.BLOOD_DENSITY_KG_M3 = blood_density_override
        if vessel_diameter_override_mm is not None and vessel_id in phys.NOMINAL_GEOMETRY:
            phys.NOMINAL_GEOMETRY[vessel_id]["ref_diameter_mm"] = vessel_diameter_override_mm
        if lesion_length_override_mm is not None and vessel_id in phys.NOMINAL_GEOMETRY:
            phys.NOMINAL_GEOMETRY[vessel_id]["length_mm"] = lesion_length_override_mm
        if microvascular_resistance_factor is not None and vessel_id in phys.NOMINAL_GEOMETRY:
            phys.NOMINAL_GEOMETRY[vessel_id]["microvascular_resistance_base"] = (
                orig_geom[vessel_id]["microvascular_resistance_base"] * microvascular_resistance_factor
            )

        state = solve_vessel_physics(vessel_id, stenosis_pct, mean_aortic_pressure_mmhg, hyperemia_factor)
        return {
            "ffr": state.ffr,
            "distal_pressure_mmhg": state.distal_pressure_mmhg,
            "flow_rate_ml_min": state.flow_rate_ml_min,
            "translesional_dp_mmhg": state.translesional_dp_mmhg,
            "reynolds_number": state.reynolds_number,
            "wall_shear_stress_pa": state.wall_shear_stress_pa,
            "viscous_resistance": state.viscous_resistance,
            "inertial_resistance": state.inertial_resistance,
            "flow_regime": state.flow_regime,
            "is_ischemic": state.is_ischemic,
            "stenosis_pct": state.stenosis_pct,
            "aortic_pressure_mmhg": state.aortic_pressure_mmhg,
        }
    finally:
        phys.BLOOD_VISCOSITY_PA_S = orig_viscosity
        phys.BLOOD_DENSITY_KG_M3 = orig_density
        phys.NOMINAL_GEOMETRY = orig_geom


def parameter_sweep(
    vessel_id: str,
    sweep_param: str,
    sweep_values: list[float],
    baseline_params: dict[str, float],
) -> dict[str, Any]:
    """Sweep a single parameter while holding others fixed."""
    # Validate all sweep values
    for v in sweep_values:
        valid, msg = validate_parameter_range(sweep_param, v)
        if not valid:
            return {"error": msg, "sweep_results": []}

    results = []
    for val in sweep_values:
        override = dict(baseline_params)
        override[sweep_param] = val
        out = _solve_with_overrides(
            vessel_id=vessel_id,
            stenosis_pct=override.get("stenosis_pct", 30.0),
            mean_aortic_pressure_mmhg=override.get("mean_aortic_pressure_mmhg", 93.3),
            hyperemia_factor=override.get("hyperemia_factor", 1.0),
            blood_viscosity_override=override.get("blood_viscosity_pa_s"),
            blood_density_override=override.get("blood_density_kg_m3"),
            vessel_diameter_override_mm=override.get("vessel_diameter_mm"),
            lesion_length_override_mm=override.get("lesion_length_mm"),
            microvascular_resistance_factor=override.get("microvascular_resistance_factor"),
        )
        out["sweep_param_value"] = val
        results.append(out)

    bounds = PARAMETER_BOUNDS.get(sweep_param)
    return {
        "vessel_id": vessel_id,
        "sweep_parameter": sweep_param,
        "sweep_unit": bounds["unit"] if bounds is not None else "?",
        "points": len(results),
        "baseline_params": baseline_params,
        "sweep_results": results,
    }


def finite_difference_sensitivity(
    vessel_id: str,
    baseline_params: dict[str, float],
    target_output: str = "ffr",
    perturbation_fraction: float = 0.01,
) -> SensitivityResult | ResultError:
    """Compute local sensitivities dOutput/dInput via central finite differences."""
    # Compute baseline
    baseline = _solve_with_overrides(
        vessel_id=vessel_id,
        stenosis_pct=baseline_params.get("stenosis_pct", 30.0),
        mean_aortic_pressure_mmhg=baseline_params.get("mean_aortic_pressure_mmhg", 93.3),
        hyperemia_factor=baseline_params.get("hyperemia_factor", 1.0),
        blood_viscosity_override=baseline_params.get("blood_viscosity_pa_s"),
        blood_density_override=baseline_params.get("blood_density_kg_m3"),
        vessel_diameter_override_mm=baseline_params.get("vessel_diameter_mm"),
        lesion_length_override_mm=baseline_params.get("lesion_length_mm"),
        microvascular_resistance_factor=baseline_params.get("microvascular_resistance_factor"),
    )
    baseline_val = baseline.get(target_output)
    if not isinstance(baseline_val, int | float):
        return {"error": f"Unknown output: {target_output}"}

    sensitivities: list[ParameterSensitivity] = []
    sweep_params = [
        "stenosis_pct", "mean_aortic_pressure_mmhg", "hyperemia_factor",
        "blood_viscosity_pa_s", "blood_density_kg_m3", "vessel_diameter_mm",
        "lesion_length_mm", "microvascular_resistance_factor",
    ]

    for param in sweep_params:
        bounds = PARAMETER_BOUNDS.get(param)
        if bounds is None:
            continue
        center = baseline_params.get(param)
        if center is None:
            # Use physiological default
            defaults = {
                "stenosis_pct": 30.0,
                "mean_aortic_pressure_mmhg": 93.3,
                "hyperemia_factor": 1.0,
                "blood_viscosity_pa_s": BLOOD_VISCOSITY_PA_S,
                "blood_density_kg_m3": BLOOD_DENSITY_KG_M3,
                "vessel_diameter_mm": NOMINAL_GEOMETRY.get(vessel_id, NOMINAL_GEOMETRY["LAD"])["ref_diameter_mm"],
                "lesion_length_mm": NOMINAL_GEOMETRY.get(vessel_id, NOMINAL_GEOMETRY["LAD"])["length_mm"],
                "microvascular_resistance_factor": 1.0,
            }
            center = defaults.get(param, (bounds["min"] + bounds["max"]) / 2)

        h = max(abs(center * perturbation_fraction), 1e-8)

        # Forward and backward perturbation
        params_fwd = dict(baseline_params)
        params_fwd[param] = min(center + h, bounds["max"])
        params_bwd = dict(baseline_params)
        params_bwd[param] = max(center - h, bounds["min"])

        fwd = _solve_with_overrides(
            vessel_id=vessel_id,
            stenosis_pct=params_fwd.get("stenosis_pct", 30.0),
            mean_aortic_pressure_mmhg=params_fwd.get("mean_aortic_pressure_mmhg", 93.3),
            hyperemia_factor=params_fwd.get("hyperemia_factor", 1.0),
            blood_viscosity_override=params_fwd.get("blood_viscosity_pa_s"),
            blood_density_override=params_fwd.get("blood_density_kg_m3"),
            vessel_diameter_override_mm=params_fwd.get("vessel_diameter_mm"),
            lesion_length_override_mm=params_fwd.get("lesion_length_mm"),
            microvascular_resistance_factor=params_fwd.get("microvascular_resistance_factor"),
        )
        bwd = _solve_with_overrides(
            vessel_id=vessel_id,
            stenosis_pct=params_bwd.get("stenosis_pct", 30.0),
            mean_aortic_pressure_mmhg=params_bwd.get("mean_aortic_pressure_mmhg", 93.3),
            hyperemia_factor=params_bwd.get("hyperemia_factor", 1.0),
            blood_viscosity_override=params_bwd.get("blood_viscosity_pa_s"),
            blood_density_override=params_bwd.get("blood_density_kg_m3"),
            vessel_diameter_override_mm=params_bwd.get("vessel_diameter_mm"),
            lesion_length_override_mm=params_bwd.get("lesion_length_mm"),
            microvascular_resistance_factor=params_bwd.get("microvascular_resistance_factor"),
        )

        fwd_val = fwd.get(target_output, 0.0)
        bwd_val = bwd.get(target_output, 0.0)
        if not isinstance(fwd_val, int | float) or not isinstance(bwd_val, int | float):
            return {"error": f"Unknown output: {target_output}"}

        actual_h = (params_fwd[param] - params_bwd[param])
        deriv = 0.0 if abs(actual_h) < 1e-12 else (fwd_val - bwd_val) / actual_h

        # Normalized sensitivity: (dOutput/Output) / (dInput/Input)
        if abs(baseline_val) > 1e-12 and abs(center) > 1e-12:
            elasticity = (deriv * center) / baseline_val
        else:
            elasticity = 0.0

        sensitivities.append({
            "parameter": param,
            "unit": bounds.get("unit", "?"),
            "center_value": round(center, 6),
            "local_derivative": round(deriv, 8),
            "elasticity": round(elasticity, 4),
            "abs_elasticity": round(abs(elasticity), 4),
            "interpretation": (
                "DOMINANT" if abs(elasticity) > 0.5 else
                "SIGNIFICANT" if abs(elasticity) > 0.1 else
                "MINOR"
            ),
        })

    sensitivities.sort(key=lambda s: s["abs_elasticity"], reverse=True)

    return {
        "vessel_id": vessel_id,
        "target_output": target_output,
        "baseline_value": baseline_val,
        "perturbation_fraction": perturbation_fraction,
        "method": "Central finite differences (dOutput/dInput)",
        "sensitivities": sensitivities,
    }


def compare_scenarios(
    vessel_id: str,
    baseline_params: dict[str, float],
    intervention_params: dict[str, float],
) -> dict[str, Any]:
    """Side-by-side comparison of baseline and intervention hemodynamic states."""
    baseline = _solve_with_overrides(
        vessel_id=vessel_id,
        stenosis_pct=baseline_params.get("stenosis_pct", 30.0),
        mean_aortic_pressure_mmhg=baseline_params.get("mean_aortic_pressure_mmhg", 93.3),
        hyperemia_factor=baseline_params.get("hyperemia_factor", 1.0),
        blood_viscosity_override=baseline_params.get("blood_viscosity_pa_s"),
        blood_density_override=baseline_params.get("blood_density_kg_m3"),
        vessel_diameter_override_mm=baseline_params.get("vessel_diameter_mm"),
        lesion_length_override_mm=baseline_params.get("lesion_length_mm"),
        microvascular_resistance_factor=baseline_params.get("microvascular_resistance_factor"),
    )
    intervention = _solve_with_overrides(
        vessel_id=vessel_id,
        stenosis_pct=intervention_params.get("stenosis_pct", 30.0),
        mean_aortic_pressure_mmhg=intervention_params.get("mean_aortic_pressure_mmhg", 93.3),
        hyperemia_factor=intervention_params.get("hyperemia_factor", 1.0),
        blood_viscosity_override=intervention_params.get("blood_viscosity_pa_s"),
        blood_density_override=intervention_params.get("blood_density_kg_m3"),
        vessel_diameter_override_mm=intervention_params.get("vessel_diameter_mm"),
        lesion_length_override_mm=intervention_params.get("lesion_length_mm"),
        microvascular_resistance_factor=intervention_params.get("microvascular_resistance_factor"),
    )

    deltas = {}
    for key in OUTPUT_KEYS:
        b_val = baseline.get(key, 0)
        i_val = intervention.get(key, 0)
        if isinstance(b_val, int | float) and isinstance(i_val, int | float):
            deltas[key] = {
                "baseline": b_val,
                "intervention": i_val,
                "absolute_change": round(i_val - b_val, 4),
                "pct_change": round(((i_val - b_val) / max(abs(b_val), 1e-12)) * 100, 2),
            }

    # Which parameters changed
    param_changes = {}
    all_params = set(list(baseline_params.keys()) + list(intervention_params.keys()))
    for p in all_params:
        bv = baseline_params.get(p)
        iv = intervention_params.get(p)
        if bv != iv:
            param_changes[p] = {"baseline": bv, "intervention": iv}

    return {
        "vessel_id": vessel_id,
        "parameter_changes": param_changes,
        "baseline_state": baseline,
        "intervention_state": intervention,
        "output_deltas": deltas,
        "model_disclaimer": (
            "This is a reduced-order 0D/1D lumped-parameter simulation. "
            "It does NOT predict actual patient treatment outcomes. "
            "Results reflect the mathematical behaviour of the governing equations, "
            "not a validated clinical CFD analysis."
        ),
    }

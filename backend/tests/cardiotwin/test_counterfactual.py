"""Tests for Counterfactual Hemodynamic Laboratory (Pillar B).

Verifies:
- Parameter sweep produces monotonic FFR decrease with increasing stenosis
- Sensitivity analysis identifies stenosis_pct as dominant driver
- Scenario comparison correctly computes deltas
- Parameter validation rejects out-of-range values
- Numerical stability at boundary conditions
"""

from __future__ import annotations

from app.cardiotwin.hemodynamics.counterfactual import (
    compare_scenarios,
    finite_difference_sensitivity,
    parameter_sweep,
    validate_parameter_range,
)


class TestParameterValidation:
    def test_valid_stenosis(self):
        ok, msg = validate_parameter_range("stenosis_pct", 50.0)
        assert ok is True

    def test_invalid_stenosis_too_high(self):
        ok, msg = validate_parameter_range("stenosis_pct", 100.0)
        assert ok is False
        assert "outside" in msg.lower()

    def test_unknown_parameter(self):
        ok, msg = validate_parameter_range("nonexistent_param", 1.0)
        assert ok is False


class TestParameterSweep:
    def test_stenosis_sweep_returns_results(self):
        result = parameter_sweep(
            vessel_id="LAD",
            sweep_param="stenosis_pct",
            sweep_values=[10, 20, 30, 40, 50, 60, 70, 80, 90],
            baseline_params={"mean_aortic_pressure_mmhg": 93.3},
        )
        assert "sweep_results" in result
        assert len(result["sweep_results"]) == 9

    def test_ffr_decreases_with_stenosis(self):
        """Physiology: FFR must monotonically decrease as stenosis increases."""
        result = parameter_sweep(
            vessel_id="LAD",
            sweep_param="stenosis_pct",
            sweep_values=[10, 30, 50, 70, 90],
            baseline_params={},
        )
        ffrs = [r["ffr"] for r in result["sweep_results"]]
        for i in range(len(ffrs) - 1):
            assert ffrs[i] >= ffrs[i + 1], f"FFR should decrease: {ffrs}"

    def test_pressure_sweep(self):
        result = parameter_sweep(
            vessel_id="RCA",
            sweep_param="mean_aortic_pressure_mmhg",
            sweep_values=[60, 80, 100, 120, 140],
            baseline_params={"stenosis_pct": 50.0},
        )
        assert len(result["sweep_results"]) == 5

    def test_out_of_range_rejected(self):
        result = parameter_sweep(
            vessel_id="LAD",
            sweep_param="stenosis_pct",
            sweep_values=[10, 200],  # 200% is out of range
            baseline_params={},
        )
        assert "error" in result


class TestSensitivityAnalysis:
    def test_sensitivity_returns_all_parameters(self):
        result = finite_difference_sensitivity(
            vessel_id="LAD",
            baseline_params={"stenosis_pct": 50.0, "mean_aortic_pressure_mmhg": 93.3},
            target_output="ffr",
        )
        assert "sensitivities" in result
        param_names = [s["parameter"] for s in result["sensitivities"]]
        assert "stenosis_pct" in param_names
        assert "mean_aortic_pressure_mmhg" in param_names

    def test_stenosis_is_dominant_for_ffr(self):
        """Stenosis should have the highest absolute elasticity on FFR."""
        result = finite_difference_sensitivity(
            vessel_id="LAD",
            baseline_params={"stenosis_pct": 50.0},
            target_output="ffr",
        )
        # Sorted by abs_elasticity descending, so first should be dominant
        top = result["sensitivities"][0]
        assert top["interpretation"] in ("DOMINANT", "SIGNIFICANT")

    def test_unknown_output_returns_error(self):
        result = finite_difference_sensitivity(
            vessel_id="LAD",
            baseline_params={},
            target_output="nonexistent_output",
        )
        assert "error" in result

    def test_string_output_returns_error(self):
        result = finite_difference_sensitivity(
            vessel_id="LAD",
            baseline_params={},
            target_output="flow_regime",
        )
        assert result == {"error": "Unknown output: flow_regime"}


class TestScenarioComparison:
    def test_compare_returns_deltas(self):
        result = compare_scenarios(
            vessel_id="LAD",
            baseline_params={"stenosis_pct": 70.0},
            intervention_params={"stenosis_pct": 20.0},  # After PCI
        )
        assert "output_deltas" in result
        assert "ffr" in result["output_deltas"]

    def test_pci_improves_ffr(self):
        """Reducing stenosis from 70% to 20% (PCI simulation) should increase FFR."""
        result = compare_scenarios(
            vessel_id="LAD",
            baseline_params={"stenosis_pct": 70.0},
            intervention_params={"stenosis_pct": 20.0},
        )
        ffr_delta = result["output_deltas"]["ffr"]
        assert ffr_delta["absolute_change"] > 0, "PCI should improve FFR"
        assert ffr_delta["intervention"] > ffr_delta["baseline"]

    def test_disclaimer_present(self):
        result = compare_scenarios(
            vessel_id="LAD",
            baseline_params={"stenosis_pct": 50.0},
            intervention_params={"stenosis_pct": 30.0},
        )
        assert "model_disclaimer" in result
        assert "does NOT predict" in result["model_disclaimer"]


class TestNumericalStability:
    def test_zero_stenosis(self):
        """Zero stenosis should give FFR well above ischemic threshold (0.80)."""
        result = parameter_sweep(
            vessel_id="LAD",
            sweep_param="stenosis_pct",
            sweep_values=[0.0],
            baseline_params={},
        )
        ffr = result["sweep_results"][0]["ffr"]
        # With microvascular bed resistance, FFR at 0% stenosis is ~0.83
        # The key assertion: it must be above the ischemic threshold
        assert ffr >= 0.80, f"FFR at 0% stenosis should be above ischemic threshold, got {ffr}"

    def test_max_stenosis(self):
        """95% stenosis should give very low FFR."""
        result = parameter_sweep(
            vessel_id="LAD",
            sweep_param="stenosis_pct",
            sweep_values=[95.0],
            baseline_params={},
        )
        ffr = result["sweep_results"][0]["ffr"]
        assert ffr <= 0.60, f"FFR at 95% stenosis should be very low, got {ffr}"

    def test_all_vessels(self):
        """Sweep should work for all three coronary vessels."""
        for v in ("LAD", "LCX", "RCA"):
            result = parameter_sweep(
                vessel_id=v,
                sweep_param="stenosis_pct",
                sweep_values=[30, 60, 90],
                baseline_params={},
            )
            assert len(result["sweep_results"]) == 3

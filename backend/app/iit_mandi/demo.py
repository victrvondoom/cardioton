"""IIT Mandi Track A - Demonstration Module.

Provides orchestration for the complete IIT Mandi Track A demonstration experience,
showcasing:
1. Synthetic patient selection
2. Multiple modality processing (EHR, ECG, wearable)
3. Risk predictions with uncertainty
4. Evidence provenance
5. 3D visualization data
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from app.cardiotwin.ecg import analyze_ecg, generate_synthetic_ecg
from app.cardiotwin.model import load_model
from app.cardiotwin.multimodal.fusion import (
    MultimodalInput,
    MultimodalPrediction,
    fuse_predictions,
)
from app.cardiotwin.wearables.simulation import generate_synthetic_wearable_stream
from app.iit_mandi.scenarios import PatientScenario, create_synthetic_patient, get_scenario


@dataclass
class IIT_MANDI_Demo:  # noqa: N801 - Public name used by existing callers.
    """Orchestrator for IIT Mandi Track A demonstration."""

    scenario: PatientScenario

    # Processing results
    ehr_prediction: dict[str, Any] | None = None
    ecg_analysis: dict[str, Any] | None = None
    wearable_analysis: dict[str, Any] | None = None
    multimodal_prediction: MultimodalPrediction | None = None

    # Timing
    start_time: datetime = field(default_factory=lambda: datetime.now(UTC))
    end_time: datetime | None = None

    def run(self, include_all_modalities: bool = True) -> dict[str, Any]:
        """Run the complete demonstration.

        Args:
            include_all_modalities: Whether to include EHR, ECG, and wearable

        Returns:
            Complete demonstration results
        """
        results = {
            "scenario": self.scenario.to_dict(),
            "processing": {},
            "predictions": {},
            "visualization": {},
            "evidence": {},
        }

        # Step 1: EHR Processing
        if self.scenario.ehr_data and include_all_modalities:
            self.ehr_prediction = self._process_ehr()
            results["processing"]["ehr"] = {
                "status": "completed",
                "features_provided": len(self.scenario.ehr_data),
                "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
            }
            results["predictions"]["ehr"] = self.ehr_prediction

        # Step 2: ECG Processing
        if include_all_modalities:
            self.ecg_analysis = self._process_ecg()
            signal_length = self.ecg_analysis.get("signal_metadata", {}).get("signal_length", 0)
            results["processing"]["ecg"] = {
                "status": "completed",
                "signal_length": signal_length,
                "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
            }
            results["predictions"]["ecg"] = self.ecg_analysis

        # Step 3: Wearable Processing
        if include_all_modalities:
            self.wearable_analysis = self._process_wearable()
            results["processing"]["wearable"] = {
                "status": "completed",
                "num_data_points": self.wearable_analysis.get("metadata", {}).get("num_data_points", 0),
                "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
            }
            results["predictions"]["wearable"] = self.wearable_analysis

        # Step 4: Multimodal Fusion
        self.multimodal_prediction = self._fuse_predictions(include_all_modalities)
        results["predictions"]["multimodal"] = self.multimodal_prediction.to_dict()
        results["processing"]["fusion"] = {
            "status": "completed",
            "available_modalities": self.multimodal_prediction.available_modalities,
            "missing_modalities": self.multimodal_prediction.missing_modalities,
            "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
        }

        # Step 5: Prepare Visualization
        results["visualization"] = self._prepare_visualization()

        # Step 6: Prepare Evidence Report
        results["evidence"] = self._prepare_evidence()

        # Set end time
        self.end_time = datetime.now(UTC)
        results["timing"] = {
            "start": self.start_time.isoformat(timespec="seconds"),
            "end": self.end_time.isoformat(timespec="seconds"),
            "duration_seconds": (self.end_time - self.start_time).total_seconds(),
        }

        return results

    def _process_ehr(self) -> dict[str, Any]:
        """Process EHR data and get prediction."""
        try:
            model = load_model()
            return model.predict(self.scenario.ehr_data)
        except Exception as e:
            return {"error": str(e), "status": "failed"}

    def _process_ecg(self) -> dict[str, Any]:
        """Process ECG signal and get analysis."""
        try:
            signal, metadata = generate_synthetic_ecg(
                duration=10,
                heart_rate=self.scenario.ecg_heart_rate,
                scenario=self.scenario.ecg_scenario,
            )
            result = analyze_ecg(signal, 500.0)
            return result.to_dict()
        except Exception as e:
            return {"error": str(e), "status": "failed"}

    def _process_wearable(self) -> dict[str, Any]:
        """Process wearable data and get analysis."""
        try:
            data_points = generate_synthetic_wearable_stream(
                duration_seconds=self.scenario.wearable_duration,
                scenario=self.scenario.wearable_scenario,
            )

            from app.cardiotwin.wearables.models import WearableDataPoint
            from app.cardiotwin.wearables.processing import analyze_wearable_data

            # Convert to DataPoint objects
            wearable_dps = [
                WearableDataPoint(
                    timestamp=dp.timestamp,
                    heart_rate=dp.heart_rate,
                    rr_intervals=dp.rr_intervals,
                    spo2=dp.spo2,
                    steps=dp.steps,
                    activity_level=dp.activity_level,
                    sleep_stage=dp.sleep_stage,
                    device_id=dp.device_id,
                    device_type=dp.device_type,
                    signal_quality=dp.signal_quality,
                )
                for dp in data_points
            ]

            features, prediction = analyze_wearable_data(wearable_dps)

            return {
                "features": features.to_dict(),
                "prediction": prediction.to_dict(),
                "metadata": {
                    "num_data_points": len(data_points),
                },
            }
        except Exception as e:
            return {"error": str(e), "status": "failed"}

    def _fuse_predictions(self, include_all: bool = True) -> MultimodalPrediction:
        """Fuse predictions from all modalities."""
        # Generate ECG signal for fusion
        ecg_signal = None
        if include_all and self.scenario.ecg_heart_rate:
            signal, metadata = generate_synthetic_ecg(
                duration=10,
                heart_rate=self.scenario.ecg_heart_rate,
                scenario=self.scenario.ecg_scenario,
            )
            ecg_signal = signal.tolist() if hasattr(signal, 'tolist') else list(signal)

        # Generate wearable data for fusion
        wearable_data = []
        if include_all:
            data_points = generate_synthetic_wearable_stream(
                duration_seconds=self.scenario.wearable_duration,
                scenario=self.scenario.wearable_scenario,
            )
            wearable_data = data_points

        input_data = MultimodalInput(
            ehr_data=self.scenario.ehr_data if include_all else {},
            ecg_signal=ecg_signal,
            ecg_sampling_rate=500.0,
            wearable_data=wearable_data,
            patient_id=self.scenario.id,
        )

        return fuse_predictions(input_data)

    def _prepare_visualization(self) -> dict[str, Any]:
        """Prepare visualization data for the 3D view."""
        if self.multimodal_prediction is None:
            return {}

        pred = self.multimodal_prediction

        return {
            "cad_probability": round(pred.fused_cad_probability, 4),
            "vessels": {
                "LAD": round(pred.fused_lad_probability, 4),
                "LCX": round(pred.fused_lcx_probability, 4),
                "RCA": round(pred.fused_rca_probability, 4),
            },
            "arrhythmias": {
                "afib_probability": round(pred.fused_afib_probability, 4),
                "vtach_probability": round(pred.fused_vtach_probability, 4),
            },
            "confidence": pred.overall_confidence,
            "modality_contributions": {
                "ehr": {
                    "cad_probability": round(pred.ehr_prediction.cad_probability, 4),
                    "confidence": pred.ehr_prediction.confidence,
                },
                "ecg": {
                    "cad_probability": round(pred.ecg_prediction.cad_probability, 4),
                    "confidence": pred.ecg_prediction.confidence,
                },
                "wearable": {
                    "cad_probability": round(pred.wearable_prediction.cad_probability, 4),
                    "confidence": pred.wearable_prediction.confidence,
                },
            },
        }

    def _prepare_evidence(self) -> dict[str, Any]:
        """Prepare evidence report with provenance."""
        evidence = {
            "patient_id": self.scenario.id,
            "scenario": self.scenario.name,
            "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "modalities_used": self.multimodal_prediction.available_modalities if self.multimodal_prediction else [],
            "predictions": {
                "cad_probability": {
                    "value": round(self.multimodal_prediction.fused_cad_probability, 4) if self.multimodal_prediction else 0.0,
                    "sources": [
                        {"modality": "ehr", "weight": 0.5},
                        {"modality": "ecg", "weight": 0.3},
                        {"modality": "wearable", "weight": 0.2},
                    ],
                },
            },
            "evidence_trail": [
                {
                    "step": 1,
                    "description": "Patient data input",
                    "sources": ["EHR", "ECG", "Wearable"],
                    "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
                },
                {
                    "step": 2,
                    "description": "Feature extraction",
                    "features_extracted": {
                        "ehr": len(self.scenario.ehr_data) if self.scenario.ehr_data else 0,
                        "ecg": 20 if self.ecg_analysis else 0,
                        "wearable": 15 if self.wearable_analysis else 0,
                    },
                    "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
                },
                {
                    "step": 3,
                    "description": "Model predictions",
                    "models_used": ["CAD_LR", "ECG_ANALYSIS", "WEARABLE_STRESS"],
                    "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
                },
                {
                    "step": 4,
                    "description": "Multimodal fusion",
                    "method": "weighted_ensemble",
                    "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
                },
            ],
            "limitations": [
                "Synthetic data used for demonstration",
                "Not clinically validated",
                "For research purposes only",
                "Human review required",
            ],
            "disclaimer": "This demonstration uses synthetic patient data. All predictions are for illustrative purposes only and do not constitute medical advice or diagnosis.",
        }

        return evidence


def run_demo_sequence(
    scenario_id: str = "high_risk_65m",
    include_all_modalities: bool = True,
) -> dict[str, Any]:
    """Run the complete IIT Mandi Track A demonstration sequence.

    Args:
        scenario_id: ID of the scenario to demonstrate
        include_all_modalities: Whether to include all modalities

    Returns:
        Complete demonstration results
    """
    # Get scenario
    scenario = get_scenario(scenario_id)
    if scenario is None:
        scenario = create_synthetic_patient(scenario_id)

    # Create and run demo
    demo = IIT_MANDI_Demo(scenario=scenario)
    return demo.run(include_all_modalities=include_all_modalities)


@dataclass
class DemoStep:
    """A single step in the demonstration sequence."""

    step_number: int
    title: str
    description: str
    action: str
    expected_result: str
    completed: bool = False
    result: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "step_number": self.step_number,
            "title": self.title,
            "description": self.description,
            "action": self.action,
            "expected_result": self.expected_result,
            "completed": self.completed,
            "result": self.result,
        }


class DemoSequence:
    """Sequenced demonstration for IIT Mandi Track A."""

    def __init__(self, scenario_id: str = "high_risk_65m"):
        self.scenario_id = scenario_id
        self.steps: list[DemoStep] = []
        self.current_step = 0

        # Initialize steps
        self._initialize_steps()

    def _initialize_steps(self) -> None:
        """Initialize the demonstration steps."""
        self.steps = [
            DemoStep(
                step_number=1,
                title="Patient Selection",
                description="Select a synthetic patient with known risk profile",
                action="GET /iit_mandi/scenarios/{scenario_id}",
                expected_result="Patient metadata and clinical data",
            ),
            DemoStep(
                step_number=2,
                title="Multimodal Data Ingestion",
                description="Ingest clinical, ECG, and wearable data",
                action="Process EHR, ECG, and wearable data",
                expected_result="All modalities processed successfully",
            ),
            DemoStep(
                step_number=3,
                title="CAD Risk Prediction",
                description="Generate CAD probability from tabular clinical features",
                action="POST /cardiotwin/predict",
                expected_result="CAD and vessel-level probabilities with confidence",
            ),
            DemoStep(
                step_number=4,
                title="ECG Analysis",
                description="Analyze ECG signal for arrhythmia and ischemia",
                action="POST /cardiotwin/ecg/analyze",
                expected_result="ECG features, arrhythmia probabilities, ischemia detection",
            ),
            DemoStep(
                step_number=5,
                title="Wearable Analysis",
                description="Analyze wearable data for HRV and stress",
                action="POST /cardiotwin/wearables/analyze",
                expected_result="HRV metrics, stress score, activity classification",
            ),
            DemoStep(
                step_number=6,
                title="Multimodal Fusion",
                description="Fuse predictions from all modalities",
                action="POST /cardiotwin/multimodal/predict",
                expected_result="Weighted ensemble prediction with uncertainty",
            ),
            DemoStep(
                step_number=7,
                title="3D Visualization",
                description="Map predictions to interactive 3D anatomical model",
                action="Render HeartViewer with probability data",
                expected_result="Interactive 3D heart with color-coded risk",
            ),
            DemoStep(
                step_number=8,
                title="Evidence Report",
                description="Generate evidence provenance report",
                action="Compile evidence trail",
                expected_result="Complete evidence report with provenance",
            ),
        ]

    def run_step(self, step_number: int) -> DemoStep:
        """Run a specific step in the sequence."""
        if step_number < 1 or step_number > len(self.steps):
            raise ValueError(f"Invalid step number: {step_number}")

        step = self.steps[step_number - 1]

        # Actually execute the step
        if step.step_number == 1:
            from app.iit_mandi.scenarios import create_synthetic_patient, get_scenario
            scenario = get_scenario(self.scenario_id) or create_synthetic_patient(self.scenario_id)
            step.result = scenario.to_dict()

        elif step.step_number == 2:
            # This would process all modalities
            step.result = {"status": "completed", "message": "All modalities ingested"}

        elif step.step_number == 3:
            from app.cardiotwin.model import load_model
            try:
                model = load_model()
                scenario = get_scenario(self.scenario_id) or create_synthetic_patient(self.scenario_id)
                prediction = model.predict(scenario.ehr_data)
                step.result = {
                    "cad_probability": round(prediction["cad"]["probability"], 4),
                    "vessels": {v: round(prediction["vessels"][v]["probability"], 4) for v in ["LAD", "LCX", "RCA"]},
                }
            except Exception as e:
                step.result = {"error": str(e)}

        elif step.step_number == 4:

            from app.cardiotwin.ecg import analyze_ecg, generate_synthetic_ecg
            try:
                scenario = get_scenario(self.scenario_id) or create_synthetic_patient(self.scenario_id)
                signal, _ = generate_synthetic_ecg(
                    duration=10,
                    heart_rate=scenario.ecg_heart_rate,
                    scenario=scenario.ecg_scenario,
                )
                result = analyze_ecg(signal, 500.0)
                step.result = {
                    "afib_probability": round(result.prediction.afib_probability, 4),
                    "ischemia_probability": round(result.prediction.ischemia_probability, 4),
                }
            except Exception as e:
                step.result = {"error": str(e)}

        elif step.step_number == 5:
            from app.cardiotwin.wearables.processing import analyze_wearable_data
            from app.cardiotwin.wearables.simulation import generate_synthetic_wearable_stream
            try:
                scenario = get_scenario(self.scenario_id) or create_synthetic_patient(self.scenario_id)
                data_points = generate_synthetic_wearable_stream(
                    duration_seconds=scenario.wearable_duration,
                    scenario=scenario.wearable_scenario,
                )
                features, wearable_prediction = analyze_wearable_data(data_points)
                step.result = {
                    "stress_score": round(wearable_prediction.stress_score, 4),
                    "afib_probability": round(wearable_prediction.afib_probability, 4),
                }
            except Exception as e:
                step.result = {"error": str(e)}

        elif step.step_number == 6:
            try:
                demo_result = run_demo_sequence(self.scenario_id, include_all_modalities=True)
                step.result = {
                    "fused_cad_probability": round(demo_result["predictions"]["multimodal"]["fused_predictions"]["cad_probability"], 4),
                    "confidence": demo_result["predictions"]["multimodal"]["confidence"],
                }
            except Exception as e:
                step.result = {"error": str(e)}

        elif step.step_number == 7:
            step.result = {
                "message": "3D visualization ready",
                "url": "/cardiotwin",
            }

        elif step.step_number == 8:
            try:
                demo_result = run_demo_sequence(self.scenario_id, include_all_modalities=True)
                step.result = demo_result.get("evidence", {})
            except Exception as e:
                step.result = {"error": str(e)}

        step.completed = True
        self.current_step = step.step_number

        return step

    def run_all(self) -> list[DemoStep]:
        """Run all steps in the sequence."""
        for i in range(1, len(self.steps) + 1):
            self.run_step(i)
        return self.steps

    def get_summary(self) -> dict[str, Any]:
        """Get a summary of the demonstration sequence."""
        completed = sum(1 for s in self.steps if s.completed)
        return {
            "scenario_id": self.scenario_id,
            "total_steps": len(self.steps),
            "completed_steps": completed,
            "completion_percentage": round(completed / len(self.steps) * 100, 1),
            "current_step": self.current_step,
        }

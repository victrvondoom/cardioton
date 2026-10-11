"""IIT Mandi Track A - Synthetic Patient Scenarios.

Provides pre-configured synthetic patient scenarios that demonstrate:
- Real CAD prediction with multimodal evidence
- Interactive 3D visualization
- Explainable AI with provenance
- What-if simulation capabilities

Each scenario is designed to showcase specific aspects of the platform.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.cardiotwin.schema import FEATURES, FEATURE_INDEX


@dataclass
class PatientScenario:
    """A synthetic patient scenario for demonstration."""
    
    id: str
    name: str
    description: str
    
    # Patient metadata
    age: int
    sex: str
    
    # Clinical features (EHR data)
    ehr_data: dict[str, Any] = field(default_factory=dict)
    
    # ECG scenario
    ecg_scenario: str = "normal"
    ecg_heart_rate: float = 72.0
    
    # Wearable scenario
    wearable_scenario: str = "normal"
    wearable_duration: float = 300.0  # seconds
    
    # Expected outcomes
    expected_cad_probability: float = 0.0
    expected_afib_probability: float = 0.0
    
    # Demonstration focus
    focus_areas: list[str] = field(default_factory=list)
    
    # Visualization preferences
    visualization: dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "metadata": {
                "age": self.age,
                "sex": self.sex,
            },
            "ehr_data": self.ehr_data,
            "ecg": {
                "scenario": self.ecg_scenario,
                "heart_rate": self.ecg_heart_rate,
            },
            "wearable": {
                "scenario": self.wearable_scenario,
                "duration": self.wearable_duration,
            },
            "expected_outcomes": {
                "cad_probability": self.expected_cad_probability,
                "afib_probability": self.expected_afib_probability,
            },
            "focus_areas": self.focus_areas,
            "visualization": self.visualization,
        }


def _generate_basic_ehr_data(
    age: int,
    sex: str,
    add_risk_factors: bool = False,
    add_ecg_abnormalities: bool = False,
    add_lab_abnormalities: bool = False,
) -> dict[str, Any]:
    """Generate basic EHR data for a synthetic patient."""
    data = {
        "Age": age,
        "Sex": sex,
        "BMI": round(22 + np.random.random() * 8, 1),
        "BP": round(120 + np.random.random() * 20, 1),  # Systolic
        "PR": round(72 + np.random.random() * 10, 1),  # Pulse rate
    }
    
    # Add risk factors
    if add_risk_factors:
        data["DM"] = 1 if random.random() > 0.7 else 0  # Diabetes
        data["HTN"] = 1 if random.random() > 0.7 else 0  # Hypertension
        data["Current Smoker"] = 1 if random.random() > 0.8 else 0
        data["FH"] = 1 if random.random() > 0.6 else 0  # Family history
        data["DLP"] = 1 if random.random() > 0.7 else 0  # Dyslipidaemia
    else:
        data["DM"] = 0
        data["HTN"] = 0
        data["Current Smoker"] = 0
        data["FH"] = 0
        data["DLP"] = 0
    
    # Add ECG findings
    if add_ecg_abnormalities:
        data["St Depression"] = 1 if random.random() > 0.8 else 0
        data["Tinversion"] = 1 if random.random() > 0.7 else 0
        data["LVH"] = "Y" if random.random() > 0.6 else "N"
    else:
        data["St Depression"] = 0
        data["Tinversion"] = 0
        data["LVH"] = "N"
    
    # Add lab values
    if add_lab_abnormalities:
        data["LDL"] = round(100 + np.random.random() * 80, 1)  # Elevated
        data["HDL"] = round(30 + np.random.random() * 15, 1)  # Low
        data["TG"] = round(150 + np.random.random() * 100, 1)  # Elevated
        data["FBS"] = round(90 + np.random.random() * 40, 1)  # Elevated
    else:
        data["LDL"] = round(80 + np.random.random() * 20, 1)
        data["HDL"] = round(45 + np.random.random() * 15, 1)
        data["TG"] = round(100 + np.random.random() * 40, 1)
        data["FBS"] = round(70 + np.random.random() * 20, 1)
    
    # Add exam findings
    data["Typical Chest Pain"] = 1 if add_risk_factors and random.random() > 0.8 else 0
    data["Dyspnea"] = 1 if add_risk_factors and random.random() > 0.7 else 0
    
    # Add echo findings
    data["EF-TTE"] = round(55 + np.random.random() * 20, 1) if add_risk_factors else round(60 + np.random.random() * 10, 1)
    data["Region RWMA"] = 2 if add_risk_factors and random.random() > 0.7 else 0
    
    return data


# Pre-defined scenarios for IIT Mandi Track A
IIT_MANDI_SCENARIOS: list[PatientScenario] = [
    PatientScenario(
        id="healthy_50m",
        name="Healthy 50-year-old Male",
        description="Low-risk patient with normal clinical profile and unremarkable ECG",
        age=50,
        sex="Male",
        ehr_data=_generate_basic_ehr_data(50, "Male", add_risk_factors=False),
        ecg_scenario="normal",
        ecg_heart_rate=68.0,
        wearable_scenario="normal",
        wearable_duration=600.0,
        expected_cad_probability=0.1,
        expected_afib_probability=0.05,
        focus_areas=[
            "Normal cardiovascular profile",
            "Low CAD probability",
            "Interactive 3D visualization of normal coronary anatomy",
            "Baseline for comparison",
        ],
        visualization={
            "primary_color": "#10b981",  # Green
            "highlight": "normal_anatomy",
        },
    ),
    
    PatientScenario(
        id="high_risk_65m",
        name="High-Risk 65-year-old Male",
        description="Multiple cardiac risk factors, abnormal ECG, elevated lipids",
        age=65,
        sex="Male",
        ehr_data=_generate_basic_ehr_data(65, "Male", add_risk_factors=True, add_ecg_abnormalities=True, add_lab_abnormalities=True),
        ecg_scenario="stemi",
        ecg_heart_rate=85.0,
        wearable_scenario="stress",
        wearable_duration=600.0,
        expected_cad_probability=0.9,
        expected_afib_probability=0.1,
        focus_areas=[
            "High CAD probability with risk factors",
            "ST elevation on ECG",
            "Multimodal evidence fusion",
            "Elevated uncertainty with conflicting signals",
        ],
        visualization={
            "primary_color": "#ef4444",  # Red
            "highlight": "high_risk_areas",
        },
    ),
    
    PatientScenario(
        id="afib_72f",
        name="Atrial Fibrillation in 72-year-old Female",
        description="Patient with AFib, variable heart rate, and palpitations",
        age=72,
        sex="Female",
        ehr_data=_generate_basic_ehr_data(72, "Female", add_risk_factors=True, add_ecg_abnormalities=False),
        ecg_scenario="afib",
        ecg_heart_rate=110.0,
        wearable_scenario="afib",
        wearable_duration=600.0,
        expected_cad_probability=0.6,
        expected_afib_probability=0.9,
        focus_areas=[
            "AFib detection from ECG and wearable",
            "Heart rate variability analysis",
            "Arrhythmia contribution to CAD risk",
            "Temporal correlation across modalities",
        ],
        visualization={
            "primary_color": "#8b5cf6",  # Purple
            "highlight": "electrical_conduction",
            "show_animation": True,
        },
    ),
    
    PatientScenario(
        id="exercise_40m",
        name="Exercise Stress Test Simulation",
        description="40-year-old male during exercise, demonstrating physiological changes",
        age=40,
        sex="Male",
        ehr_data=_generate_basic_ehr_data(40, "Male", add_risk_factors=False),
        ecg_scenario="normal",
        ecg_heart_rate=140.0,
        wearable_scenario="exercise",
        wearable_duration=300.0,
        expected_cad_probability=0.2,
        expected_afib_probability=0.05,
        focus_areas=[
            "Dynamic cardiovascular response to exercise",
            "Heart rate and activity correlation",
            "Stress score computation",
            "Real-time monitoring simulation",
        ],
        visualization={
            "primary_color": "#f59e0b",  # Amber
            "highlight": "hemodynamics",
            "show_realtime": True,
        },
    ),
    
    PatientScenario(
        id="asymptomatic_55f",
        name="Asymptomatic High-Risk Female",
        description="55-year-old female with silent ischemia, normal exam but abnormal tests",
        age=55,
        sex="Female",
        ehr_data=_generate_basic_ehr_data(55, "Female", add_risk_factors=True, add_ecg_abnormalities=True),
        ecg_scenario="nstemi",
        ecg_heart_rate=78.0,
        wearable_scenario="normal",
        wearable_duration=600.0,
        expected_cad_probability=0.75,
        expected_afib_probability=0.05,
        focus_areas=[
            "Silent ischemia detection",
            "Subtle ECG abnormalities",
            "Importance of multimodal screening",
            "Gender-specific risk factors",
        ],
        visualization={
            "primary_color": "#f97316",  # Orange
            "highlight": "subtle_changes",
            "sensitivity_mode": True,
        },
    ),
]


def create_synthetic_patient(
    scenario_id: str | None = None,
    custom_data: dict[str, Any] | None = None,
) -> PatientScenario:
    """Create a synthetic patient scenario.
    
    Args:
        scenario_id: ID of a predefined scenario, or None for random
        custom_data: Optional custom EHR data
        
    Returns:
        PatientScenario with synthetic data
    """
    if scenario_id is not None:
        # Find matching scenario
        for scenario in IIT_MANDI_SCENARIOS:
            if scenario.id == scenario_id:
                return scenario
        
        # If not found, create a random one
        raise ValueError(f"Scenario {scenario_id} not found")
    
    # Create random scenario
    age = np.random.randint(30, 80)
    sex = np.random.choice(["Male", "Female"])
    
    has_risk = np.random.random() > 0.5
    has_ecg_abnormal = np.random.random() > 0.7
    has_lab_abnormal = np.random.random() > 0.6
    
    ehr_data = _generate_basic_ehr_data(
        age, sex, 
        add_risk_factors=has_risk,
        add_ecg_abnormalities=has_ecg_abnormal,
        add_lab_abnormalities=has_lab_abnormal,
    )
    
    # Select ECG scenario
    if has_risk and has_ecg_abnormal:
        ecg_scenario = np.random.choice(["afib", "stemi", "nstemi"])
    else:
        ecg_scenario = "normal"
    
    # Select wearable scenario
    if has_risk:
        wearable_scenario = np.random.choice(["stress", "afib", "exercise"])
    else:
        wearable_scenario = "normal"
    
    return PatientScenario(
        id=f"random_{age}_{sex.lower()}",
        name=f"Random {age}-year-old {sex}",
        description="Randomly generated patient scenario",
        age=age,
        sex=sex,
        ehr_data=ehr_data,
        ecg_scenario=ecg_scenario,
        ecg_heart_rate=72 + np.random.random() * 40,
        wearable_scenario=wearable_scenario,
        wearable_duration=300.0,
        expected_cad_probability=0.7 if has_risk else 0.2,
        expected_afib_probability=0.5 if ecg_scenario == "afib" else 0.1,
        focus_areas=["Multimodal integration", "Risk stratification"],
        visualization={
            "primary_color": "#3b82f6",  # Blue
        },
    )


def generate_demo_scenarios(num_scenarios: int = 5) -> list[PatientScenario]:
    """Generate multiple demo scenarios.
    
    Args:
        num_scenarios: Number of scenarios to generate
        
    Returns:
        List of PatientScenario
    """
    scenarios = []
    
    for i in range(num_scenarios):
        scenario = create_synthetic_patient()
        scenario.id = f"demo_{i+1}_{scenario.id}"
        scenarios.append(scenario)
    
    return scenarios


def get_scenario(scenario_id: str) -> PatientScenario | None:
    """Get a specific scenario by ID.
    
    Args:
        scenario_id: Scenario ID
        
    Returns:
        PatientScenario or None if not found
    """
    for scenario in IIT_MANDI_SCENARIOS:
        if scenario.id == scenario_id:
            return scenario
    return None


def list_scenarios() -> list[dict[str, Any]]:
    """List all available scenarios.
    
    Returns:
        List of scenario metadata
    """
    return [s.to_dict() for s in IIT_MANDI_SCENARIOS]

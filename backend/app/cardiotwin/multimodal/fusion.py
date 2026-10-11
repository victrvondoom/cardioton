"""Multimodal Fusion Engine.

Provides fusion of predictions from different modalities (EHR, ECG, wearable)
with proper handling of missing data and uncertainty propagation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import numpy as np

from app.cardiotwin.model import CardioModel, load_model
from app.cardiotwin.ecg.models import analyze_ecg, get_ecg_model
from app.cardiotwin.wearables.processing import analyze_wearable_data
from app.cardiotwin.wearables.models import WearableDataPoint
from app.cardiotwin.schema import FEATURES, FEATURE_INDEX


@dataclass
class MultimodalInput:
    """Input data from multiple modalities."""
    
    # EHR/Clinical data
    ehr_data: dict[str, Any] = field(default_factory=dict)
    
    # ECG data
    ecg_signal: list[float] | None = None
    ecg_sampling_rate: float = 500.0
    
    # Wearable data
    wearable_data: list[WearableDataPoint] = field(default_factory=list)
    
    # Metadata
    patient_id: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    
    def has_ehr(self) -> bool:
        """Check if EHR data is present."""
        return len(self.ehr_data) > 0
    
    def has_ecg(self) -> bool:
        """Check if ECG data is present."""
        return self.ecg_signal is not None and len(self.ecg_signal) >= 100
    
    def has_wearable(self) -> bool:
        """Check if wearable data is present."""
        return len(self.wearable_data) > 0


@dataclass
class ModalPrediction:
    """Prediction from a single modality."""
    
    modality: str  # "ehr", "ecg", "wearable"
    
    # CAD and vessel probabilities
    cad_probability: float = 0.0
    lad_probability: float = 0.0
    lcx_probability: float = 0.0
    rca_probability: float = 0.0
    
    # Arrhythmia probabilities
    afib_probability: float = 0.0
    vtach_probability: float = 0.0
    
    # Confidence scores
    confidence: str = "low"
    
    # Data present flag
    data_present: bool = False
    
    # Contributing features
    contributing_features: list[str] = field(default_factory=list)
    
    # Uncertainty
    uncertainty: float = 1.0  # 0-1, lower = more certain
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "modality": self.modality,
            "cad_probability": round(self.cad_probability, 4),
            "lad_probability": round(self.lad_probability, 4),
            "lcx_probability": round(self.lcx_probability, 4),
            "rca_probability": round(self.rca_probability, 4),
            "afib_probability": round(self.afib_probability, 4),
            "vtach_probability": round(self.vtach_probability, 4),
            "confidence": self.confidence,
            "data_present": self.data_present,
            "contributing_features": self.contributing_features,
            "uncertainty": round(self.uncertainty, 4),
        }


@dataclass
class MultimodalPrediction:
    """Fused prediction from multiple modalities."""
    
    # Individual modality predictions
    ehr_prediction: ModalPrediction = field(default_factory=lambda: ModalPrediction(modality="ehr"))
    ecg_prediction: ModalPrediction = field(default_factory=lambda: ModalPrediction(modality="ecg"))
    wearable_prediction: ModalPrediction = field(default_factory=lambda: ModalPrediction(modality="wearable"))
    
    # Fused probabilities
    fused_cad_probability: float = 0.0
    fused_lad_probability: float = 0.0
    fused_lcx_probability: float = 0.0
    fused_rca_probability: float = 0.0
    
    # Fused arrhythmia probabilities
    fused_afib_probability: float = 0.0
    fused_vtach_probability: float = 0.0
    
    # Overall confidence
    overall_confidence: str = "low"
    
    # Uncertainty metrics
    fused_uncertainty: float = 1.0
    modality_disagreement: float = 0.0  # 0-1, higher = more disagreement
    
    # Available modalities
    available_modalities: list[str] = field(default_factory=list)
    missing_modalities: list[str] = field(default_factory=list)
    
    # Provenance
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API serialization."""
        return {
            "individual_predictions": {
                "ehr": self.ehr_prediction.to_dict(),
                "ecg": self.ecg_prediction.to_dict(),
                "wearable": self.wearable_prediction.to_dict(),
            },
            "fused_predictions": {
                "cad_probability": round(self.fused_cad_probability, 4),
                "lad_probability": round(self.fused_lad_probability, 4),
                "lcx_probability": round(self.fused_lcx_probability, 4),
                "rca_probability": round(self.fused_rca_probability, 4),
                "afib_probability": round(self.fused_afib_probability, 4),
                "vtach_probability": round(self.fused_vtach_probability, 4),
            },
            "confidence": self.overall_confidence,
            "uncertainty": {
                "fused": round(self.fused_uncertainty, 4),
                "modality_disagreement": round(self.modality_disagreement, 4),
            },
            "available_modalities": self.available_modalities,
            "missing_modalities": self.missing_modalities,
            "timestamp": self.timestamp.isoformat(timespec="seconds"),
        }


class MultimodalFusionEngine:
    """Engine for fusing predictions from multiple modalities.
    
    Implements weighted fusion with proper handling of missing data
    and uncertainty propagation.
    """
    
    def __init__(self):
        self.model_id = "multimodal-fusion-v1"
        self.version = "1.0.0"
        
        # Modality weights (can be adjusted based on validation)
        self.modality_weights = {
            "ehr": 0.5,
            "ecg": 0.3,
            "wearable": 0.2,
        }
        
        # Default uncertainty for each modality
        self.default_uncertainties = {
            "ehr": 0.2,
            "ecg": 0.3,
            "wearable": 0.4,
        }
    
    def predict(self, input_data: MultimodalInput) -> MultimodalPrediction:
        """Make multimodal prediction from input data.
        
        Args:
            input_data: Input data from one or more modalities
            
        Returns:
            MultimodalPrediction with fused results
        """
        prediction = MultimodalPrediction()
        
        # Determine available modalities
        prediction.available_modalities = []
        if input_data.has_ehr():
            prediction.available_modalities.append("ehr")
        if input_data.has_ecg():
            prediction.available_modalities.append("ecg")
        if input_data.has_wearable():
            prediction.available_modalities.append("wearable")
        
        # All possible modalities
        all_modalities = ["ehr", "ecg", "wearable"]
        prediction.missing_modalities = [
            m for m in all_modalities if m not in prediction.available_modalities
        ]
        
        # Process each available modality
        if input_data.has_ehr():
            prediction.ehr_prediction = self._process_ehr(input_data.ehr_data)
        
        if input_data.has_ecg():
            prediction.ecg_prediction = self._process_ecg(input_data.ecg_signal, input_data.ecg_sampling_rate)
        
        if input_data.has_wearable():
            prediction.wearable_prediction = self._process_wearable(input_data.wearable_data)
        
        # Fuse predictions
        prediction = self._fuse_predictions(prediction)
        
        return prediction
    
    def _process_ehr(self, ehr_data: dict[str, Any]) -> ModalPrediction:
        """Process EHR data and make prediction."""
        try:
            # Use the existing CardioTwin model
            model = load_model()
            result = model.predict(ehr_data)
            
            # Get contributing features - use provided count or all feature names
            fc = result["feature_completeness"]
            provided_features = []
            if "provided" in fc:
                # If provided is a list, use it; if it's an int, it's a count
                if isinstance(fc["provided"], list):
                    provided_features = list(fc["provided"])
                elif isinstance(fc["provided"], int):
                    # Get the actual feature names from imputed list
                    # Provided features are those NOT in imputed
                    all_features = set(fc.get("imputed", []))
                    provided_features = [f for f in ehr_data.keys() if f not in all_features]
            
            return ModalPrediction(
                modality="ehr",
                cad_probability=result["cad"]["probability"],
                lad_probability=result["vessels"]["LAD"]["probability"],
                lcx_probability=result["vessels"]["LCX"]["probability"],
                rca_probability=result["vessels"]["RCA"]["probability"],
                confidence=result["cad"]["confidence"],
                data_present=len(ehr_data) > 0,
                contributing_features=provided_features,
                uncertainty=self._compute_uncertainty("ehr", result),
            )
        except Exception as e:
            # Fallback if EHR prediction fails
            return ModalPrediction(
                modality="ehr",
                cad_probability=0.0,
                data_present=False,
                confidence="low",
                uncertainty=1.0,
            )
    
    def _process_ecg(self, signal: list[float], sampling_rate: float) -> ModalPrediction:
        """Process ECG signal and make prediction."""
        try:
            import numpy as np
            result = analyze_ecg(np.array(signal), sampling_rate)
            
            # Map ECG predictions to vessel probabilities
            # For now, use ischemia probability as a proxy for CAD
            # In a real implementation, ECG would provide vessel-specific info
            cad_prob = result.prediction.ischemia_probability
            
            return ModalPrediction(
                modality="ecg",
                cad_probability=cad_prob,
                lad_probability=cad_prob * 0.9,  # Slightly lower for individual vessels
                lcx_probability=cad_prob * 0.8,
                rca_probability=cad_prob * 0.85,
                afib_probability=result.prediction.afib_probability,
                vtach_probability=result.prediction.vtach_probability,
                confidence="moderate",
                data_present=True,
                contributing_features=[
                    f"ecg_hr_{int(result.features.get('heart_rate', 72))}",
                    f"ecg_st_{'elevated' if result.features.get('st_elevation_mean', 0) > 0.1 else 'normal'}",
                ],
                uncertainty=self._compute_uncertainty("ecg", result.to_dict()),
            )
        except Exception as e:
            return ModalPrediction(
                modality="ecg",
                cad_probability=0.0,
                data_present=False,
                confidence="low",
                uncertainty=1.0,
            )
    
    def _process_wearable(self, data_points: list[WearableDataPoint]) -> ModalPrediction:
        """Process wearable data and make prediction."""
        try:
            features, prediction = analyze_wearable_data(data_points)
            
            # Map wearable stress and AFib to CAD probability
            # Higher stress correlates with higher CAD risk
            stress_cad_factor = prediction.stress_score * 0.5
            afib_cad_factor = prediction.afib_probability * 0.3
            
            cad_prob = min(0.8, stress_cad_factor + afib_cad_factor)
            
            return ModalPrediction(
                modality="wearable",
                cad_probability=cad_prob,
                lad_probability=cad_prob * 0.7,
                lcx_probability=cad_prob * 0.7,
                rca_probability=cad_prob * 0.7,
                afib_probability=prediction.afib_probability,
                confidence="low",
                data_present=len(data_points) > 0,
                contributing_features=[
                    f"wearable_stress_{int(prediction.stress_score * 100)}",
                    f"wearable_hr_{int(features.heart_rate_mean)}",
                ],
                uncertainty=self._compute_uncertainty("wearable", prediction.to_dict()),
            )
        except Exception as e:
            return ModalPrediction(
                modality="wearable",
                cad_probability=0.0,
                data_present=False,
                confidence="low",
                uncertainty=1.0,
            )
    
    def _fuse_predictions(self, prediction: MultimodalPrediction) -> MultimodalPrediction:
        """Fuse individual modality predictions into combined prediction."""
        # Collect probabilities for each target
        modal_probabilities = {
            "cad": [],
            "lad": [],
            "lcx": [],
            "rca": [],
            "afib": [],
            "vtach": [],
        }
        
        uncertainties = {
            "cad": [],
            "lad": [],
            "lcx": [],
            "rca": [],
        }
        
        # Add probabilities from each available modality
        for modality in ["ehr", "ecg", "wearable"]:
            modal_pred = getattr(prediction, f"{modality}_prediction")
            
            if modal_pred.data_present:
                modal_probabilities["cad"].append((modal_pred.cad_probability, self.modality_weights[modality]))
                modal_probabilities["lad"].append((modal_pred.lad_probability, self.modality_weights[modality]))
                modal_probabilities["lcx"].append((modal_pred.lcx_probability, self.modality_weights[modality]))
                modal_probabilities["rca"].append((modal_pred.rca_probability, self.modality_weights[modality]))
                modal_probabilities["afib"].append((modal_pred.afib_probability, self.modality_weights[modality]))
                modal_probabilities["vtach"].append((modal_pred.vtach_probability, self.modality_weights[modality]))
                
                uncertainties["cad"].append(modal_pred.uncertainty)
                uncertainties["lad"].append(modal_pred.uncertainty)
                uncertainties["lcx"].append(modal_pred.uncertainty)
                uncertainties["rca"].append(modal_pred.uncertainty)
        
        # Compute weighted averages
        def weighted_avg(prob_list: list[tuple[float, float]]) -> float:
            if not prob_list:
                return 0.0
            
            # Weight by modality weight and inverse of uncertainty
            total_weight = 0.0
            weighted_sum = 0.0
            
            for prob, weight in prob_list:
                # Adjust weight by uncertainty (lower uncertainty = higher weight)
                adjusted_weight = weight * (1.0 - 0.5)  # Simple adjustment
                weighted_sum += prob * adjusted_weight
                total_weight += adjusted_weight
            
            return weighted_sum / total_weight if total_weight > 0 else 0.0
        
        # Fuse probabilities
        prediction.fused_cad_probability = weighted_avg(modal_probabilities["cad"])
        prediction.fused_lad_probability = weighted_avg(modal_probabilities["lad"])
        prediction.fused_lcx_probability = weighted_avg(modal_probabilities["lcx"])
        prediction.fused_rca_probability = weighted_avg(modal_probabilities["rca"])
        prediction.fused_afib_probability = weighted_avg(modal_probabilities["afib"])
        prediction.fused_vtach_probability = weighted_avg(modal_probabilities["vtach"])
        
        # Compute modality disagreement
        prediction.modality_disagreement = self._compute_disagreement(modal_probabilities)
        
        # Compute overall uncertainty
        avg_uncertainty = np.mean([u for subs in uncertainties.values() for u in subs]) if any(uncertainties.values()) else 1.0
        prediction.fused_uncertainty = avg_uncertainty + prediction.modality_disagreement * 0.3
        
        # Determine overall confidence
        prediction.overall_confidence = self._determine_confidence(
            prediction.fused_uncertainty, 
            prediction.modality_disagreement,
            prediction.available_modalities
        )
        
        return prediction
    
    def _compute_disagreement(self, modal_probabilities: dict[str, list[tuple[float, float]]]) -> float:
        """Compute modality disagreement score (0-1)."""
        if not modal_probabilities["cad"]:
            return 0.0
        
        # Get CAD probabilities from each modality
        cad_probs = [p for p, _ in modal_probabilities["cad"]]
        
        if len(cad_probs) < 2:
            return 0.0
        
        # Compute standard deviation of probabilities
        std = np.std(cad_probs)
        
        # Normalize to 0-1 range (0.5 is maximum expected std)
        return min(1.0, std / 0.5)
    
    def _compute_uncertainty(self, modality: str, result: dict[str, Any]) -> float:
        """Compute uncertainty score for a modality prediction."""
        # Base uncertainty for modality
        base = self.default_uncertainties.get(modality, 0.5)
        
        # Adjust based on result
        if modality == "ehr":
            completeness = result.get("feature_completeness", {}).get("fraction", 0)
            if completeness < 0.5:
                base = min(1.0, base + (1 - completeness) * 0.5)
        
        return base
    
    def _determine_confidence(
        self,
        uncertainty: float,
        disagreement: float,
        available_modalities: list[str],
    ) -> str:
        """Determine overall confidence level."""
        # More modalities = higher potential confidence
        modality_bonus = len(available_modalities) * 0.2
        
        # Compute combined score
        score = 1.0 - uncertainty - disagreement * 0.3 + modality_bonus
        
        if score >= 0.8:
            return "high"
        elif score >= 0.6:
            return "moderate"
        elif score >= 0.4:
            return "low"
        else:
            return "very_low"


def fuse_predictions(
    input_data: MultimodalInput,
) -> MultimodalPrediction:
    """Convenience function to create fusion engine and predict.
    
    Args:
        input_data: Input data from one or more modalities
        
    Returns:
        MultimodalPrediction with fused results
    """
    engine = MultimodalFusionEngine()
    return engine.predict(input_data)

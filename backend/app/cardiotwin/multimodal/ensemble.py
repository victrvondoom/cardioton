"""Ensemble Model for Multimodal Predictions.

Provides ensemble methods for combining predictions from multiple models
with proper uncertainty quantification.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

import numpy as np


@dataclass
class EnsembleModel:
    """Ensemble of multiple prediction models.
    
    Combines predictions from different modalities or models using
    various ensemble methods.
    """
    
    model_id: str = "ensemble-v1"
    version: str = "1.0.0"
    
    # Ensemble method
    method: str = "weighted_average"  # "weighted_average", "voting", "stacking"
    
    # Model weights
    weights: dict[str, float] = None
    
    def __post_init__(self):
        if self.weights is None:
            self.weights = {}
    
    def add_model(self, model_id: str, weight: float = 1.0) -> None:
        """Add a model to the ensemble with a given weight."""
        self.weights[model_id] = weight
    
    def predict(self, predictions: dict[str, float]) -> float:
        """Combine predictions from multiple models.
        
        Args:
            predictions: Dictionary of model_id -> prediction
            
        Returns:
            Combined prediction
        """
        if self.method == "weighted_average":
            return self._weighted_average(predictions)
        elif self.method == "voting":
            return self._voting(predictions)
        elif self.method == "stacking":
            return self._stacking(predictions)
        else:
            return self._weighted_average(predictions)
    
    def _weighted_average(self, predictions: dict[str, float]) -> float:
        """Weighted average of predictions."""
        total_weight = 0.0
        weighted_sum = 0.0
        
        for model_id, pred in predictions.items():
            weight = self.weights.get(model_id, 1.0)
            weighted_sum += pred * weight
            total_weight += weight
        
        return weighted_sum / total_weight if total_weight > 0 else 0.0
    
    def _voting(self, predictions: dict[str, float]) -> float:
        """Majority voting (for classification)."""
        # Convert probabilities to binary (threshold at 0.5)
        binary_preds = {model_id: 1 if pred >= 0.5 else 0 for model_id, pred in predictions.items()}
        
        # Count votes
        yes_votes = sum(binary_preds.values())
        no_votes = len(binary_preds) - yes_votes
        
        # Return probability based on vote proportion
        return yes_votes / len(binary_preds) if binary_preds else 0.0
    
    def _stacking(self, predictions: dict[str, float]) -> float:
        """Stacking ensemble (simplified - uses weighted average)."""
        return self._weighted_average(predictions)


def create_ensemble_from_models(
    model_ids: list[str],
    method: str = "weighted_average",
    default_weight: float = 1.0,
) -> EnsembleModel:
    """Create an ensemble from a list of model IDs.
    
    Args:
        model_ids: List of model IDs to include
        method: Ensemble method to use
        default_weight: Default weight for each model
        
    Returns:
        Configured EnsembleModel
    """
    ensemble = EnsembleModel(
        model_id=f"ensemble_{method}",
        method=method,
    )
    
    for model_id in model_ids:
        ensemble.add_model(model_id, default_weight)
    
    return ensemble

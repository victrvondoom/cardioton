"""Deterministic, evidence-linked heart-failure research twin.

This extends the existing CardioTwin domain; the coronary-risk model is unchanged.
"""

from app.cardiotwin.hemodynamics.core__cardiotwin_hemodynamics__engine import (
    ENGINE_VERSION,
    reconstruct,
)
from app.cardiotwin.hemodynamics.schema import Evidence, ReconstructionRequest

__all__ = ["ENGINE_VERSION", "Evidence", "ReconstructionRequest", "reconstruct"]

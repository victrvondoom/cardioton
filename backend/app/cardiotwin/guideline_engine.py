"""Deterministic research screening with explicit source and clinical-review limits.

This is a narrow threshold illustration, not verification of the complete ESC
guideline. Simulated FFR cannot establish a clinical indication or select
treatment. Anatomy inputs are not substituted for measured physiology.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import UTC, datetime
from typing import Any

GUIDELINE_VERSION = "CardioTwin-research-ffr-screen-v2"
GUIDELINE_SOURCE = "https://academic.oup.com/eurheartj/article/45/36/3415/7743115"


def evaluate_guidelines(
    patient_features: dict[str, Any],
    vessel_stenoses: dict[str, float],
    ffr_values: dict[str, float],
) -> dict[str, Any]:
    """Expose every threshold outcome without filling missing clinical values."""
    rules: list[dict[str, Any]] = []
    flagged: list[str] = []
    missing: list[str] = []
    for vessel in ("LAD", "LCX", "RCA"):
        value = ffr_values.get(vessel)
        valid = (not isinstance(value, bool) and isinstance(value, int | float)
                 and math.isfinite(value) and 0 <= value <= 1)
        if value is not None and not valid:
            raise ValueError(f"{vessel} FFR must be a finite value in [0, 1]")
        result = value <= 0.80 if valid else None
        if result:
            flagged.append(vessel)
        if not valid:
            missing.append(f"ffr_values.{vessel}")
        rules.append({
            "rule_id": f"CT-RESEARCH-FFR-{vessel}-001",
            "rule_version": GUIDELINE_VERSION,
            "citation": "2024 ESC Guidelines for the management of chronic coronary syndromes, section 3.3.3.2",
            "source_url": GUIDELINE_SOURCE,
            "class_of_rec": None,
            "level_of_evidence": None,
            "condition": "Supplied FFR <= 0.80",
            "relevant_inputs": {"ffr": value, "stenosis_supplied": vessel_stenoses.get(vessel)},
            "satisfied_conditions": ["Supplied FFR <= 0.80"] if result else [],
            "missing_information": [] if valid else [f"ffr_values.{vessel}"],
            "execution_outcome": "MATCHED" if result else ("NOT_MATCHED" if valid else "NOT_EVALUABLE"),
            "passed": result,
            "guideline_action": "Human clinical review required; no treatment selected",
            "rationale": "An FFR threshold is one input to clinical assessment. Supplied values may be simulations; symptoms, anatomy, measurement validity and other clinical factors remain unassessed.",
        })
    timestamp = datetime.now(UTC).isoformat()
    payload = {
        "guideline_standard": GUIDELINE_VERSION, "timestamp": timestamp,
        "input_features": patient_features, "vessel_stenoses": vessel_stenoses,
        "ffr_values": ffr_values, "rules_executed": rules,
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, allow_nan=False, separators=(",", ":")).encode()).hexdigest()
    return {
        "verification_status": "RESEARCH_SCREENING_REQUIRES_REVIEW",
        "guideline_standard": GUIDELINE_VERSION,
        "timestamp_utc": timestamp,
        "passport_sha256": digest,
        "passport_payload": payload,
        "human_governance": {
            "clinician_approval_status": "PENDING_CLINICAL_SIGN_OFF",
            "ai_autonomous_prescribing": False,
            "audit_trail_immutable": False,
        },
        "primary_recommendation": {
            "action": "Human clinical review required; no treatment selected",
            "class_of_recommendation": None, "level_of_evidence": None,
            "rule_id": "CT-RESEARCH-FFR-SUMMARY-001",
            "citation": "2024 ESC Guidelines for the management of chronic coronary syndromes",
            "source_url": GUIDELINE_SOURCE,
            "clinical_rationale": "This research screen cannot establish clinical eligibility for any intervention.",
        },
        "flagged_vessels": flagged,
        "missing_information": missing,
        "all_rules_evaluated": rules,
    }

"""Evidence sensitivity and knowledge-arrival ledger; never treatment simulation."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from .core__cardiotwin_hemodynamics__engine import AXES, evaluate_state
from .schema import Evidence

MODALITIES = {
    "Weight": {"weight"},
    "Edema": {"edema"},
    "Dyspnea": {"dyspnea"},
    "Natriuretic peptides": {"bnp", "ntprobnp"},
    "Oxygenation / support": {"spo2", "oxygen_requirement"},
    "Renal markers": {"creatinine", "egfr"},
    "Echo": {"lvef"},
    "Rhythm": {"rhythm"},
    "Blood pressure": {"systolic_bp", "diastolic_bp"},
    "Functional capacity": {"functional_capacity"},
    "Documented intervention": {"diuretic_change"},
}


def inspect_reconstruction(result: dict[str, Any]) -> dict[str, Any]:
    """Analyze only evidence already admitted to the as-of reconstruction.

    Withholding an evidence modality tests rule dependence. It is not a patient
    counterfactual, causal attribution, a probability or a treatment forecast.
    """
    as_of = datetime.fromisoformat(result["as_of"])
    evidence = [Evidence.model_validate(e) for e in result["evidence"]]
    actual = result["snapshot"]
    sensitivity = []
    for label, kinds in MODALITIES.items():
        withheld = [e for e in evidence if e.kind in kinds]
        if not withheld:
            continue
        reduced = evaluate_state(
            [e for e in evidence if e.kind not in kinds], as_of, result["patient_ref"]
        )
        changed = [
            {
                "axis": axis,
                "with_all_evidence": actual[axis]["level"],
                "with_modality_withheld": reduced[axis]["level"],
            }
            for axis in AXES
            if actual[axis]["level"] != reduced[axis]["level"]
        ]
        sensitivity.append(
            {
                "modality": label,
                "withheld_kinds": sorted(kinds),
                "evidence_refs": sorted(e.id for e in withheld),
                "changed_axes": changed,
                "original_stage": actual["congestion"]["stage"],
                "withheld_stage": reduced["congestion"]["stage"],
                "original_confidence": actual["confidence"],
                "withheld_confidence": reduced["confidence"],
                "stage_changed": actual["congestion"]["stage"] != reduced["congestion"]["stage"],
                "classification": "DERIVED",
                "review_required": True,
            }
        )
    frontier = []
    for e in evidence:
        delay = round((e.available_at - e.event_at).total_seconds() / 3600, 2)
        if delay < 24:
            continue
        changes = [
            {"axis": t["axis"], "from_level": t["from_level"], "to_level": t["to_level"]}
            for t in result["transitions"]
            if datetime.fromisoformat(t["timestamp"]) == e.available_at
        ]
        frontier.append(
            {
                "id": f"arrival-{e.id}",
                "kind": e.kind,
                "event_at": e.event_at.isoformat(),
                "available_at": e.available_at.isoformat(),
                "delay_hours": delay,
                "evidence_refs": [e.id],
                "changes_at_release": changes,
                "classification": "DERIVED",
                "explanation": "This source became knowable after its clinical event. Earlier replays exclude it; changes at release may also involve other evidence arriving at the same time.",
            }
        )
    return {
        "evidence_sensitivity": sensitivity,
        "knowledge_frontier": frontier,
        "sensitivity_notice": "Evidence withholding checks dependence on documented inputs using the same rules. It does not simulate physiology, infer causality, recommend treatment or estimate diagnostic probability.",
    }

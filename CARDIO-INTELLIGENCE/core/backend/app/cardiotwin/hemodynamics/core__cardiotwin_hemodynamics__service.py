"""Stateless reconstruction and existing Evidence Passport integration."""

from __future__ import annotations

import copy
from datetime import UTC, datetime
from typing import Any

from app.onehealth.passport import digest, portable, seal_artifact

from .core__cardiotwin_hemodynamics__engine import AXES, ENGINE_VERSION, reconstruct
from .core__cardiotwin_hemodynamics__fhir import LOCAL_SYSTEM, ingest_bundle, parse_time
from .demo import DEMO_END, PATIENT_REF, demo_bundle, demo_metadata
from .diagnostics import inspect_reconstruction
from .schema import ReconstructionRequest


def from_fhir(
    bundle: dict[str, Any],
    *,
    as_of: datetime,
    patient_ref: str | None = None,
    received_at: datetime | None = None,
) -> dict[str, Any]:
    selected, evidence, issues = ingest_bundle(
        bundle, as_of=as_of, patient_ref=patient_ref, received_at=received_at
    )
    result = reconstruct(evidence, as_of=as_of, patient_ref=selected)
    result["issues"].extend(issues)
    result.update(inspect_reconstruction(result))
    result["fhir_contract"] = {
        "target": "FHIR R4 4.0.1",
        "validation_scope": "Selected exact-code cardiology application contract",
        "full_hl7_profile_validation": False,
        "mapping_approval": "Not granted; source facts and research interpretations remain separate",
        "availability": "Both clinical event and current resource-version availability must precede as_of",
    }
    return result


def demo_result(as_of: datetime | None = None) -> dict[str, Any]:
    when = parse_time(as_of or DEMO_END)
    result = from_fhir(demo_bundle(), as_of=when, patient_ref=PATIENT_REF)
    result["demo"] = demo_metadata()
    return result


def snapshot_fhir(result: dict[str, Any]) -> dict[str, Any]:
    """Separate derived Observations + Provenance; never writes patient records.

    The subject reference points to the source Patient; this collection is an
    artifact, not an automatically accepted clinical transaction.
    """
    entries: list[dict[str, Any]] = []
    for axis in AXES:
        state = result["snapshot"][axis]
        identifier = "hemo-" + digest({"axis": axis, "state": state, "as_of": result["as_of"]})[:24]
        ref = f"Observation/{identifier}"
        obs = {
            "resourceType": "Observation",
            "id": identifier,
            "status": "preliminary",
            "meta": {"tag": [{"system": LOCAL_SYSTEM, "code": "twin-inference"}]},
            "code": {
                "coding": [{"system": LOCAL_SYSTEM, "code": axis}],
                "text": f"Research inferred cardiovascular state: {axis}",
            },
            "subject": {"reference": result["patient_ref"]},
            "effectiveDateTime": result["as_of"],
            "note": [
                {"text": state["explanation"]},
                {
                    "text": f"Classification: {state['classification']}. Confidence: {state['confidence']}. Human review REQUIRED. No clinical approval."
                },
            ],
            "derivedFrom": [
                {"reference": e["source_ref"]}
                for e in result["evidence"]
                if e["id"] in state["evidence_refs"]
            ],
        }
        if state["level"] == "UNKNOWN":
            obs["dataAbsentReason"] = {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/data-absent-reason",
                        "code": "unknown",
                    }
                ]
            }
        else:
            obs["valueCodeableConcept"] = {
                "coding": [{"system": LOCAL_SYSTEM, "code": state["level"]}]
            }
        entries.append({"resource": obs})
        entities = [
            {"role": "source", "what": {"reference": e["source_ref"]}}
            for e in result["evidence"]
            if e["id"] in state["evidence_refs"]
        ]
        provenance = {
            "resourceType": "Provenance",
            "id": f"prov-{identifier}",
            "target": [{"reference": ref}],
            "recorded": datetime.now(UTC).isoformat(),
            "occurredDateTime": result["as_of"],
            "activity": {
                "text": f"Deterministic reconstruction {ENGINE_VERSION}; research artifact, not human approval"
            },
            "agent": [{"who": {"display": "CLINI-CASE Cardio-Hemo deterministic engine"}}],
        }
        if entities:
            provenance["entity"] = entities
        entries.append({"resource": provenance})
    return {"resourceType": "Bundle", "type": "collection", "entry": entries}


def snapshot_passport(
    result: dict[str, Any], *, actor: str, organization_id: str
) -> dict[str, Any]:
    """Reuse the platform passport chain, portable export and optional signing.

    Identity comes from authenticated user, never supplied reconstruction fields.
    Source provenance assertions remain unverified; hashes establish integrity.
    """
    snapshot = copy.deepcopy(result)
    stable_id = digest({"tenant": organization_id, "reconstruction": snapshot})
    record = seal_artifact(
        {
            "id": f"cardio-hemo-{stable_id[:24]}",
            "version": 1,
            "organization_id": organization_id,
            "reconstruction": snapshot,
            "clinical_review": {"status": "REQUIRED", "clinical_approval": False},
        },
        actor=actor,
        action="research_snapshot_exported",
        timestamp=datetime.now(UTC).isoformat(),
        trust_states={
            "source": "SOURCE_ASSERTIONS_UNVERIFIED",
            "interpretation": "RESEARCH_INFERENCE",
            "clinical_review": "REQUIRED",
            "clinical_approval": False,
        },
    )
    return portable(record, derived_fhir=snapshot_fhir(result))


def request_result(request: ReconstructionRequest) -> dict[str, Any]:
    result = reconstruct(request.evidence, as_of=request.as_of, patient_ref=request.patient_ref)
    result.update(inspect_reconstruction(result))
    return result

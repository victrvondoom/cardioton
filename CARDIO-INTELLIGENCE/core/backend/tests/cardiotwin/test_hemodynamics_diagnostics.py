"""Evidence-dependence diagnostics, late knowledge, module and identity regressions."""

from __future__ import annotations

import copy
from datetime import UTC, datetime

import pytest

from app.cardiotwin.hemodynamics.core__cardiotwin_hemodynamics__engine import (
    AXES,
    evaluate_state,
    reconstruct,
)
from app.cardiotwin.hemodynamics.core__cardiotwin_hemodynamics__fhir import ingest_bundle
from app.cardiotwin.hemodynamics.core__cardiotwin_hemodynamics__service import (
    demo_result,
    from_fhir,
    request_result,
    snapshot_fhir,
)
from app.cardiotwin.hemodynamics.demo import PATIENT_REF, demo_bundle
from app.cardiotwin.hemodynamics.schema import Evidence, ReconstructionRequest


def when(day):
    return datetime(2026, 8, day, 23, 59, 59, tzinfo=UTC)


def test_demo_progression_and_delayed_result_magic_moment():
    stages = [
        demo_result(when(day))["snapshot"]["congestion"]["stage"] for day in (1, 7, 10, 12, 17, 21)
    ]
    assert stages == [
        "STABLE",
        "MILD_SIGNAL",
        "INCREASING_CONCERN",
        "HIGH_CONCERN",
        "INTERVENTION",
        "IMPROVING",
    ]
    before = demo_result(when(10))
    after = demo_result(when(12))
    assert not before["knowledge_frontier"]
    assert all(e["source_ref"] != "Observation/demo-08-10-bnp" for e in before["evidence"])
    delayed = next(e for e in after["knowledge_frontier"] if e["kind"] == "bnp")
    assert delayed["delay_hours"] == 50
    assert delayed["event_at"] < delayed["available_at"] <= after["as_of"]


def test_delayed_release_matches_transitions_for_equivalent_timezone_offsets():
    base = {"patient_ref": PATIENT_REF, "original_record": {"synthetic": True}}
    evidence = [
        {
            **base,
            "id": f"baseline-{kind}",
            "kind": kind,
            "value": "absent",
            "event_at": "2026-08-01T07:00:00+05:30",
            "available_at": "2026-08-01T07:00:00+05:30",
            "source_ref": f"Observation/baseline-{kind}",
        }
        for kind in ("edema", "dyspnea")
    ]
    evidence.append(
        {
            **base,
            "id": "delayed-edema",
            "kind": "edema",
            "value": "present",
            "event_at": "2026-08-01T08:00:00+05:30",
            "available_at": "2026-08-03T08:00:00+05:30",
            "source_ref": "Observation/delayed-edema",
        }
    )
    result = request_result(
        ReconstructionRequest(
            patient_ref=PATIENT_REF,
            as_of="2026-08-03T09:00:00+05:30",
            evidence=evidence,
        )
    )
    arrival = result["knowledge_frontier"][0]
    assert arrival["delay_hours"] == 48
    assert {change["axis"] for change in arrival["changes_at_release"]} == {
        "volume_status", "congestion"
    }
    assert all(t["timestamp"] == "2026-08-03T02:30:00+00:00" for t in result["transitions"])

    # A replay before this instant must still exclude the delayed source.
    earlier = request_result(
        ReconstructionRequest(
            patient_ref=PATIENT_REF,
            as_of="2026-08-03T02:29:59Z",
            evidence=evidence,
        )
    )
    assert earlier["snapshot"]["congestion"]["stage"] == "STABLE"
    assert not earlier["knowledge_frontier"]


def test_sensitivity_uses_exactly_same_engine_and_retains_withheld_sources():
    result = demo_result(when(10))
    sources = [Evidence.model_validate(e) for e in result["evidence"]]
    for row in result["evidence_sensitivity"]:
        smaller = [e for e in sources if e.kind not in row["withheld_kinds"]]
        expected = evaluate_state(smaller, when(10), PATIENT_REF)
        assert row["withheld_stage"] == expected["congestion"]["stage"]
        assert row["withheld_confidence"] == expected["confidence"]
        assert set(row["evidence_refs"]) <= {e.id for e in sources}
        assert row["classification"] == "DERIVED"
        assert row["review_required"] is True
    weight = next(r for r in result["evidence_sensitivity"] if r["modality"] == "Weight")
    assert weight["original_stage"] == "INCREASING_CONCERN"
    assert weight["withheld_stage"] == "MILD_SIGNAL"


def test_diagnostics_and_full_fhir_payload_do_not_see_future_records():
    complete = demo_bundle()
    reduced = copy.deepcopy(complete)
    reduced["entry"] = [
        entry
        for entry in reduced["entry"]
        if entry["resource"]["resourceType"] == "Patient"
        or (
            entry["resource"].get(
                "issued", entry["resource"].get("meta", {}).get("lastUpdated", "")
            )
            <= when(10).isoformat()
        )
    ]
    assert from_fhir(complete, as_of=when(10), patient_ref=PATIENT_REF) == from_fhir(
        reduced, as_of=when(10), patient_ref=PATIENT_REF
    )


def test_reconstruct_api_service_and_fhir_diagnostics_match():
    result = demo_result(when(12))
    direct = request_result(
        ReconstructionRequest(patient_ref=PATIENT_REF, as_of=when(12), evidence=result["evidence"])
    )
    for key in (
        "snapshot",
        "timeline",
        "transitions",
        "knowledge_frontier",
        "evidence_sensitivity",
    ):
        assert direct[key] == result[key]


def test_confidence_exposes_coverage_and_does_not_become_a_probability():
    result = demo_result(when(21))
    detail = result["snapshot"]["confidence_details"]
    assert detail["known_axes"] == sum(
        result["snapshot"][axis]["level"] != "UNKNOWN" for axis in AXES
    )
    assert detail["total_axes"] == 8
    assert "pump_function" in detail["unknown_axes"]
    assert "rhythm_stability" in detail["unknown_axes"]
    assert "not diagnostic probability" in detail["meaning"]


@pytest.mark.parametrize("value", [None, "unknown", "no change", "unchanged"])
def test_unknown_or_negative_medication_change_cannot_create_intervention(value):
    result = demo_result(when(12))
    evidence = [Evidence.model_validate(e) for e in result["evidence"]]
    evidence.append(
        Evidence(
            id="negative-change",
            patient_ref=PATIENT_REF,
            kind="diuretic_change",
            value=value,
            event_at=when(12),
            available_at=when(12),
            source_ref="MedicationRequest/negative",
            original_record={"synthetic": True},
        )
    )
    actual = reconstruct(evidence, when(12), PATIENT_REF)
    assert actual["snapshot"]["congestion"]["stage"] == "HIGH_CONCERN"
    assert not actual["intervention_responses"]


def test_ambiguous_fullurl_patient_identity_is_rejected():
    bundle = demo_bundle()
    bundle["entry"][0]["fullUrl"] = "urn:uuid:shared"
    bundle["entry"].append(
        {
            "fullUrl": "urn:uuid:shared",
            "resource": {"resourceType": "Patient", "id": "other-synthetic"},
        }
    )
    with pytest.raises(ValueError, match="Ambiguous"):
        ingest_bundle(bundle, as_of=when(12), patient_ref=PATIENT_REF)


@pytest.mark.parametrize(
    "attribute,value",
    [
        ("code", {"coding": [{"system": "http://loinc.org", "code": []}]}),
        ("code", {"coding": None}),
        ("valueQuantity", {"value": 72, "system": "http://unitsofmeasure.org", "code": []}),
        (
            "valueQuantity",
            {"value": 72, "system": "http://unitsofmeasure.org", "code": "kg", "unit": "lb"},
        ),
    ],
)
def test_partial_coding_and_quantity_never_raise_server_errors(attribute, value):
    bundle = demo_bundle()
    source = next(
        entry["resource"]
        for entry in bundle["entry"]
        if entry["resource"].get("id") == "demo-08-01-weight"
    )
    source[attribute] = value
    result = from_fhir(bundle, as_of=when(1), patient_ref=PATIENT_REF, received_at=when(1))
    assert all(e["source_ref"] != "Observation/demo-08-01-weight" for e in result["evidence"])
    assert result["issues"]


def test_derived_fhir_bundle_passes_existing_base_shape_validator():
    from fhir.resources.R4B.bundle import Bundle

    exported = snapshot_fhir(demo_result(when(12)))
    assert Bundle.parse_obj(exported).type == "collection"


def test_tenant_scope_does_not_accept_body_identity_override():
    # No state review API exists. The engine always emits an unapproved draft.
    for day in (1, 12, 21):
        result = demo_result(when(day))
        assert result["review"] == {"status": "REQUIRED", "clinical_approval": False}
        assert all(t["review_required"] for t in result["transitions"])


@pytest.mark.parametrize("field", ["original_record", "provenance"])
def test_nonfinite_nested_source_json_cannot_break_response_serialization(field):
    from pydantic import ValidationError

    source = demo_result(when(1))["evidence"][0]
    source[field] = {"invalid_nested_quantity": float("nan")}
    with pytest.raises(ValidationError, match="finite JSON"):
        Evidence.model_validate(source)


@pytest.mark.parametrize("resource,kind", [
    ({"resourceType": "DiagnosticReport", "status": "final", "effectiveDateTime": "2026-08-01T08:00:00Z",
      "issued": "2026-08-01T09:00:00Z", "code": {"text": "Synthetic echocardiography report"}}, "diagnostic_report"),
    ({"resourceType": "Procedure", "status": "completed", "performedDateTime": "2026-08-01T08:00:00Z",
      "meta": {"lastUpdated": "2026-08-01T09:00:00Z"}, "code": {"text": "Synthetic procedure"}}, "procedure"),
    ({"resourceType": "MedicationAdministration", "status": "completed", "effectiveDateTime": "2026-08-01T08:00:00Z",
      "meta": {"lastUpdated": "2026-08-01T09:00:00Z"}, "medicationCodeableConcept": {"text": "Synthetic medication"}}, "medication"),
])
def test_native_source_event_resources_preserve_provenance_without_invented_state(resource, kind):
    source = {"id": "synthetic-context", "subject": {"reference": PATIENT_REF}, **resource}
    bundle = {"resourceType": "Bundle", "type": "collection", "entry": [
        {"resource": {"resourceType": "Patient", "id": PATIENT_REF.split("/")[1]}}, {"resource": source},
    ]}
    result = from_fhir(bundle, as_of=when(1), patient_ref=PATIENT_REF)
    assert result["evidence"][0]["kind"] == kind
    assert result["evidence"][0]["original_record"] == source
    assert result["evidence"][0]["provenance"]["source_sha256"]
    assert all(result["snapshot"][axis]["level"] == "UNKNOWN" for axis in AXES)


def test_fhir_blood_pressure_components_keep_one_original_record_and_distinct_operands():
    source = {"resourceType": "Observation", "id": "bp-panel", "status": "final",
              "subject": {"reference": PATIENT_REF}, "effectiveDateTime": "2026-08-01T08:00:00Z",
              "issued": "2026-08-01T09:00:00Z", "code": {"text": "Blood pressure panel"},
              "component": [{"code": {"coding": [{"system": "http://loinc.org", "code": code}]},
                             "valueQuantity": {"value": value, "system": "http://unitsofmeasure.org", "code": "mm[Hg]"}}
                            for code, value in (("8480-6", 118), ("8462-4", 72))]}
    bundle = {"resourceType": "Bundle", "type": "collection", "entry": [
        {"resource": {"resourceType": "Patient", "id": PATIENT_REF.split("/")[1]}}, {"resource": source},
    ]}
    result = from_fhir(bundle, as_of=when(1), patient_ref=PATIENT_REF)
    assert {e["kind"] for e in result["evidence"]} == {"systolic_bp", "diastolic_bp"}
    assert len({e["id"] for e in result["evidence"]}) == 2
    assert result["snapshot"]["vascular_load"]["level"] == "NORMAL"
    assert all(e["original_record"] == source for e in result["evidence"])

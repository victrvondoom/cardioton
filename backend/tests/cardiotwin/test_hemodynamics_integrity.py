"""Independent temporal, evidentiary and governance invariants for Cardio-Hemo Twin.

These tests exercise the pure reconstruction boundary. They neither connect to a
database nor invoke a model provider, and all patient records are synthetic.
"""

from __future__ import annotations

import copy
import itertools
import json
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from pydantic import ValidationError

from app.cardiotwin.hemodynamics.engine import reconstruct
from app.cardiotwin.hemodynamics.schema import Evidence

PATIENT = "Patient/synthetic-integrity-case"
START = datetime(2026, 8, 1, 12, tzinfo=UTC)
AXES = (
    "pump_function",
    "volume_status",
    "filling_pressure_proxy",
    "rhythm_stability",
    "vascular_load",
    "renal_interaction",
    "respiratory_interaction",
    "functional_capacity",
)


def observation(
    identifier: str,
    kind: str,
    value: float | str | None,
    day: int,
    *,
    available_day: int | None = None,
    unit: str | None = None,
    patient_ref: str = PATIENT,
    **overrides: Any,
) -> Evidence:
    """Use separate synthetic clinical and availability clocks deliberately."""
    values = {
        "id": identifier,
        "patient_ref": patient_ref,
        "kind": kind,
        "value": value,
        "unit": unit,
        "event_at": START + timedelta(days=day - 1),
        "available_at": START + timedelta(days=(available_day or day) - 1),
        "source_ref": f"Observation/{identifier}",
        "original_record": {
            "resourceType": "Observation",
            "id": identifier,
            "value": value,
            "synthetic": True,
        },
        "provenance": {"source": "synthetic-test", "record_id": identifier},
        "classification": "OBSERVED",
    }
    values.update(overrides)
    return Evidence.model_validate(values)


def replay(evidence: list[Evidence], day: int) -> dict[str, Any]:
    return reconstruct(evidence, START + timedelta(days=day - 1), PATIENT)


def sequence() -> list[Evidence]:
    return [
        observation("weight-1", "weight", 72.0, 1, unit="kg"),
        observation("edema-1", "edema", 0.0, 1),
        observation("dyspnea-1", "dyspnea", 0.0, 1),
        observation("bnp-1", "bnp", 80.0, 1, unit="pg/mL"),
        observation("weight-2", "weight", 74.0, 2, unit="kg"),
        observation("edema-3", "edema", 1.0, 3),
        observation("bnp-4", "bnp", 450.0, 4, unit="pg/mL"),
        observation("hospital-5", "hospitalization", "admitted", 5),
    ]


def all_evidence_refs(value: Any) -> set[str]:
    if isinstance(value, dict):
        found = set(value.get("evidence_refs", []))
        for child in value.values():
            found.update(all_evidence_refs(child))
        return found
    if isinstance(value, list):
        return set().union(*(all_evidence_refs(child) for child in value)) if value else set()
    return set()


def test_no_evidence_is_unknown_without_inventing_normality():
    result = replay([], 3)
    assert result["snapshot"]["confidence"] == "LOW"
    assert result["snapshot"]["evidence_refs"] == []
    for axis in AXES:
        state = result["snapshot"][axis]
        assert state["level"] == "UNKNOWN", axis
        assert state["classification"] == "UNKNOWN", axis
        assert state["confidence"] == "LOW", axis
        assert state["uncertainties"], axis
    assert result["snapshot"]["uncertainties"]


def test_day_three_entire_replay_is_identical_with_or_without_future_records():
    records = sequence()
    known = [item for item in records if item.available_at <= START + timedelta(days=2)]
    assert replay(records, 3) == replay(known, 3)
    serialized = json.dumps(replay(records, 3))
    assert "hospital-5" not in serialized
    assert "bnp-4" not in serialized


def test_delayed_publication_cannot_retroactively_change_what_was_known():
    known = sequence()[:5]
    late = observation("late-edema", "edema", 3.0, 2, available_day=5)
    assert replay([*known, late], 3) == replay(known, 3)
    assert "late-edema" not in json.dumps(replay([*known, late], 3))
    assert "late-edema" in all_evidence_refs(replay([*known, late], 5))


def test_future_conflicts_and_future_other_patient_identity_are_not_replay_information():
    known = sequence()[:5]
    future_collision = observation("weight-1", "weight", 99.0, 5, unit="kg")
    other = observation(
        "future-private-patient", "edema", 2.0, 6, patient_ref="Patient/future-other-person"
    )
    assert replay([*known, future_collision, other], 3) == replay(known, 3)


def test_timezone_equivalent_replay_instants_have_identical_payloads():
    records = sequence()
    instant = START + timedelta(days=2)
    offset_instant = datetime.fromisoformat("2026-08-03T17:30:00+05:30")
    assert reconstruct(records, instant, PATIENT) == reconstruct(records, offset_instant, PATIENT)


def test_reconstruction_is_independent_of_input_order():
    records = sequence()
    expected = replay(records, 4)
    assert replay(list(reversed(records)), 4) == expected
    for order in itertools.permutations(records[:3]):
        assert replay([*order, *records[3:]], 4) == expected


def test_duplicate_delivery_does_not_create_transitions_or_increase_confidence():
    records = sequence()[:7]
    expected = replay(records, 4)
    assert replay([*records, *records, copy.deepcopy(records[0])], 4) == expected


def test_progressive_observations_change_the_twin_and_preserve_transition_evidence():
    records = sequence()
    states = [replay(records, day) for day in (1, 2, 3, 4)]
    stages = [result["snapshot"]["congestion"]["stage"] for result in states]
    assert len(set(stages)) >= 3, stages
    assert states[0]["snapshot"]["volume_status"]["level"] != states[-1]["snapshot"][
        "volume_status"
    ]["level"]
    assert states[-1]["transitions"]
    for result, day in zip(states, (1, 2, 3, 4), strict=True):
        known_ids = {item.id for item in records if item.available_at <= START + timedelta(days=day - 1)}
        assert all_evidence_refs(result) <= known_ids
        for transition in result["transitions"]:
            assert transition["evidence_refs"]
            assert transition["explanation"]
            assert transition["review_required"] is True


def test_evidence_refs_resolve_to_original_record_and_provenance():
    result = replay(sequence(), 4)
    evidence = {item["id"]: item for item in result["evidence"]}
    refs = all_evidence_refs(result)
    assert refs and refs <= set(evidence)
    for reference in refs:
        item = evidence[reference]
        assert item["source_ref"] == f"Observation/{reference}"
        assert item["original_record"]["id"] == reference
        assert item["provenance"]["record_id"] == reference
        assert item["classification"] == "OBSERVED"


def test_old_echo_does_not_supply_unqualified_current_pump_function():
    old = observation("old-echo", "lvef", 38.0, 1, unit="%")
    result = replay([old], 140)
    state = result["snapshot"]["pump_function"]
    assert state["level"] == "UNKNOWN"
    assert state["confidence"] == "LOW"
    assert state["uncertainties"]
    assert "old-echo" in {item["id"] for item in result["evidence"]}


def test_contradictory_same_time_measurements_do_not_choose_an_arbitrary_winner():
    records = [
        observation("weight-a", "weight", 72.0, 1, unit="kg"),
        observation("weight-b", "weight", 79.0, 1, unit="kg"),
        observation("edema-a", "edema", 0.0, 1),
        observation("edema-b", "edema", 3.0, 1),
    ]
    result = replay(records, 1)
    assert result == replay(list(reversed(records)), 1)
    axis = result["snapshot"]["volume_status"]
    assert axis["level"] == "UNKNOWN" or axis["confidence"] == "LOW"
    assert axis["uncertainties"] or result["issues"]
    assert {"weight-a", "weight-b", "edema-a", "edema-b"} <= {
        item["id"] for item in result["evidence"]
    }


def test_conflicting_duplicate_ids_are_rejected_or_quarantined_deterministically():
    original = observation("collision", "weight", 72.0, 1, unit="kg")
    conflict = observation("collision", "weight", 79.0, 1, unit="kg")
    try:
        result = replay([original, conflict], 1)
    except ValueError:
        with pytest.raises(ValueError):
            replay([conflict, original], 1)
    else:
        assert result == replay([conflict, original], 1)
        assert result["issues"]
        assert result["snapshot"]["volume_status"]["confidence"] == "LOW"


def test_supported_quantity_with_wrong_unit_remains_unknown():
    result = replay([observation("weight-unit", "weight", 72.0, 1, unit="mL")], 1)
    assert result["snapshot"]["volume_status"]["level"] == "UNKNOWN"
    assert result["issues"] or result["snapshot"]["uncertainties"]
    assert not result["derived_measures"]


def test_input_observations_are_not_mutated_by_reconstruction():
    records = sequence()
    before = [item.model_dump(mode="json") for item in records]
    replay(records, 4)
    assert [item.model_dump(mode="json") for item in records] == before


def test_derived_state_never_claims_to_be_an_observed_measurement_or_clinical_approval():
    result = replay(sequence(), 4)
    assert result["review"]["status"] == "REQUIRED"
    assert result["review"]["clinical_approval"] is False
    for axis in AXES:
        item = result["snapshot"][axis]
        assert item["classification"] in {"OBSERVED", "DERIVED", "INFERRED", "UNKNOWN"}
        if axis in ("volume_status", "filling_pressure_proxy") and item["level"] != "UNKNOWN":
            assert item["classification"] == "INFERRED"
    assert result["research_label"]
    assert result["safety_notice"]


def test_llm_unavailable_does_not_change_reconstruction(monkeypatch):
    expected = replay(sequence(), 4)

    def unavailable(*_args: Any, **_kwargs: Any) -> None:
        raise AssertionError("Deterministic twin must never call a model provider")

    monkeypatch.setattr("app.llm.get_llm_client", unavailable)
    monkeypatch.setattr("app.llm.factory.get_llm_client", unavailable)
    monkeypatch.setattr("app.llm.gateway.GenAIGateway.complete", unavailable)
    assert replay(sequence(), 4) == expected


@pytest.mark.parametrize("field", ["event_at", "available_at"])
def test_naive_timestamps_cannot_enter_the_evidence_clock(field):
    values = observation("aware", "edema", 1.0, 1).model_dump()
    values[field] = START.replace(tzinfo=None)
    with pytest.raises(ValidationError):
        Evidence.model_validate(values)


def test_availability_cannot_precede_the_clinical_event():
    values = observation("clock", "edema", 1.0, 1).model_dump()
    values["available_at"] = START - timedelta(hours=1)
    with pytest.raises(ValidationError):
        Evidence.model_validate(values)


@pytest.mark.parametrize("value", [True, float("nan"), float("inf"), {"measurement": 3}, [3]])
def test_invalid_values_are_rejected_instead_of_coerced_to_measurements(value):
    values = observation("invalid", "edema", 1.0, 1).model_dump()
    values["value"] = value
    with pytest.raises(ValidationError):
        Evidence.model_validate(values)


@pytest.mark.parametrize("classification", ["DERIVED", "INFERRED", "APPROVED"])
def test_inference_or_imported_approval_cannot_masquerade_as_observed_evidence(classification):
    values = observation("trust", "edema", 1.0, 1).model_dump()
    values["classification"] = classification
    with pytest.raises(ValidationError):
        Evidence.model_validate(values)


def test_naive_replay_timestamp_is_rejected():
    with pytest.raises((ValueError, TypeError)):
        reconstruct(sequence(), START.replace(tzinfo=None), PATIENT)


def test_later_conflicting_version_does_not_erase_known_historical_timeline():
    records = sequence()[:5]
    prior = replay(records, 2)
    conflicting_version = observation(
        "weight-2", "weight", 80.0, 2, available_day=3, unit="kg"
    )
    try:
        result = replay([*records, conflicting_version], 3)
    except ValueError:
        # Rejecting an ambiguous source identity is an equally safe boundary.
        return
    historical = {item["timestamp"]: item for item in result["timeline"]}
    for item in prior["timeline"]:
        assert historical[item["timestamp"]] == item


def test_every_transition_reference_resolves_even_after_duplicate_id_quarantine():
    records = sequence()[:5]
    conflicting_version = observation(
        "weight-2", "weight", 80.0, 2, available_day=3, unit="kg"
    )
    try:
        result = replay([*records, conflicting_version], 3)
    except ValueError:
        return
    returned_refs = {item["id"] for item in result["evidence"]}
    assert all_evidence_refs(result) <= returned_refs


@pytest.mark.parametrize("unit,value", [("mL", 72.0), ("kg", 900.0)])
def test_intervention_deltas_never_reinterpret_invalid_numeric_evidence(unit, value):
    records = [
        observation("invalid-before", "weight", value, 1, unit=unit),
        observation("change", "diuretic_change", "documented_change", 2),
        observation("invalid-after", "weight", value - 1, 3, unit=unit),
    ]
    result = replay(records, 3)
    assert result["intervention_responses"]
    for response in result["intervention_responses"]:
        assert not any(
            change["kind"] == "weight" and change.get("delta") is not None
            for change in response["changes"]
        )


def test_remote_old_baseline_cannot_create_a_post_intervention_improvement_inference():
    records = [
        observation("remote-weight", "weight", 90.0, 1, unit="kg"),
        observation("change", "diuretic_change", "documented_change", 100),
        observation("recent-weight", "weight", 72.0, 101, unit="kg"),
        observation("recent-edema", "edema", 1.0, 101),
    ]
    result = replay(records, 101)
    assert result["snapshot"]["congestion"]["stage"] != "IMPROVING"


def test_conflicting_pre_intervention_weight_does_not_support_recovery():
    records = [
        observation("baseline-a", "weight", 72.0, 1, unit="kg"),
        observation("baseline-z", "weight", 80.0, 1, unit="kg"),
        observation("change", "diuretic_change", "documented_change", 2),
        observation("after", "weight", 75.0, 3, unit="kg"),
        observation("edema", "edema", 1.0, 3),
        observation("dyspnea", "dyspnea", 1.0, 3),
    ]
    result = replay(records, 3)
    assert result["snapshot"]["congestion"]["stage"] != "IMPROVING"


def test_derived_deltas_are_labelled_and_trace_each_operand():
    result = replay(sequence(), 4)
    measures = {item["kind"]: item for item in result["derived_measures"]}
    weight = measures["weight_change"]
    assert weight["value"] == 2.0
    assert weight["classification"] == "DERIVED"
    assert set(weight["evidence_refs"]) == {"weight-1", "weight-2"}
    assert weight["transformation"]
    assert measures["bnp_change"]["value"] == 370.0


def test_sparse_confidence_is_explicit_and_does_not_exceed_richer_supported_evidence():
    sparse_records = [observation("edema", "edema", 1.0, 3)]
    sparse = replay(sparse_records, 3)
    rich_records = [*sparse_records,
                    observation("echo", "lvef", 42.0, 3, unit="%"),
                    observation("rhythm", "rhythm", "sinus", 3),
                    observation("bp", "systolic_bp", 118.0, 3, unit="mmHg"),
                    observation("capacity", "functional_capacity", "normal", 3)]
    rich = replay(rich_records, 3)
    assert sparse["snapshot"]["confidence"] == "LOW"
    assert any("sparse" in note.lower() for note in sparse["snapshot"]["uncertainties"])
    order = {"LOW": 0, "MODERATE": 1, "HIGH": 2}
    assert order[rich["snapshot"]["confidence"]] > order[sparse["snapshot"]["confidence"]]


def test_cardiorenal_interaction_reports_temporal_association_without_causal_approval():
    records = [*sequence()[:7],
               observation("renal-1", "creatinine", 1.0, 1, unit="mg/dL"),
               observation("renal-4", "creatinine", 1.4, 4, unit="mg/dL")]
    result = replay(records, 4)
    renal = result["snapshot"]["renal_interaction"]
    assert renal["level"] == "ELEVATED"
    assert {"renal-1", "renal-4"} <= set(renal["evidence_refs"])
    assert "temporal association" in renal["explanation"].lower()
    assert result["review"]["clinical_approval"] is False


def test_intervention_response_compares_observations_without_claiming_effect():
    records = [
        observation("before-weight", "weight", 75.0, 1, unit="kg"),
        observation("before-edema", "edema", 2.0, 1),
        observation("change", "diuretic_change", "documented_change", 2),
        observation("after-weight", "weight", 73.0, 3, unit="kg"),
        observation("after-edema", "edema", 1.0, 3),
    ]
    result = replay(records, 3)
    response = result["intervention_responses"][0]
    weights = [change for change in response["changes"] if change["kind"] == "weight"]
    assert len(weights) == 1 and weights[0]["delta"] == -2.0
    assert set(weights[0]["evidence_refs"]) == {"before-weight", "after-weight"}
    assert weights[0]["transformation"]
    assert response["review_required"] is True
    assert "temporal association" in response["interpretation"].lower()
    assert "no medication effect" in response["interpretation"].lower()


def test_intervention_response_does_not_use_late_backdated_baseline_or_future_response():
    records = [
        observation("known-before", "weight", 75.0, 1, unit="kg"),
        observation("late-before", "weight", 95.0, 1, available_day=3, unit="kg"),
        observation("change", "diuretic_change", "documented_change", 2),
        observation("known-after", "weight", 73.0, 3, unit="kg"),
        observation("future-after", "weight", 70.0, 4, unit="kg"),
    ]
    result = replay(records, 3)
    assert result == replay(records[:-1], 3)
    response = result["intervention_responses"][0]
    weight_changes = [change for change in response["changes"] if change["kind"] == "weight"]
    assert weight_changes[0]["before"] == 75.0
    assert "late-before" not in response["evidence_refs"]


def test_multiple_ids_for_same_source_fact_do_not_increase_confidence():
    source = observation("source-a", "edema", 1.0, 1)
    renamed = source.model_copy(update={"id": "source-z"})
    single = replay([source], 1)
    repeated = replay([renamed, source], 1)
    assert repeated == single

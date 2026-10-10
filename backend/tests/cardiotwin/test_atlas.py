"""Atlas composition invariants, independent of any LLM or external service."""

from __future__ import annotations

import copy
import json
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.auth import get_current_user
from app.cardiotwin.atlas.api import router
from app.cardiotwin.atlas.demo import demo_input
from app.cardiotwin.atlas.fusion import normalize, patient_report
from app.cardiotwin.atlas.schema import AtlasInput, ExplainRequest, ScenarioRequest, Source
from app.cardiotwin.atlas.service import explain, passport, reconstruct_atlas, sandbox
from app.cardiotwin.hemodynamics.schema import Evidence
from app.config import settings
from app.onehealth.passport import verify_package

AT = "2026-08-10T23:59:59Z"
FUTURE = "2026-08-15T12:00:00Z"


def evidence(identifier="weight-a", **kwargs):
    return Evidence.model_validate(
        {
            "id": identifier,
            "patient_ref": "Patient/test",
            "kind": "weight",
            "value": 72.0,
            "unit": "kg",
            "event_at": "2026-08-01T10:00:00Z",
            "available_at": "2026-08-01T10:00:00Z",
            "source_ref": "Observation/test",
            "original_record": {"synthetic": True},
            **kwargs,
        }
    )


def source(**kwargs):
    return Source.model_validate(
        {
            "id": "synthetic-source",
            "modality": "ecg",
            "event_at": "2026-08-01T10:00:00Z",
            "available_at": "2026-08-01T10:00:00Z",
            "provider_mode": "SYNTHETIC",
            **kwargs,
        }
    )


def request(**kwargs):
    return AtlasInput.model_validate({"patient_ref": "Patient/test", "as_of": AT, **kwargs})


def test_source_reference_metadata_uses_only_admitted_evidence():
    baseline = source(observations=[{"kind": "rhythm", "value": "sinus"}])
    referenced = baseline.model_copy(update={"evidence_refs": ["future-hospitalization"]})
    original = reconstruct_atlas(request(modalities=[baseline]))
    extended = reconstruct_atlas(request(modalities=[referenced]))
    assert original == extended
    assert "future-hospitalization" not in json.dumps(extended)
    assert "reference_projection" in extended["twin"]["evidence"][0]["provenance"]


def test_materialized_synthetic_evidence_retains_its_provider_mode():
    demo = reconstruct_atlas(request(demo=True))
    assert all(e["provenance"]["provider_mode"] == "SYNTHETIC" for e in demo["twin"]["evidence"])
    submitted = reconstruct_atlas(AtlasInput(as_of=AT, patient_ref=demo["twin"]["patient_ref"], evidence=demo["twin"]["evidence"]))
    assert next(m for m in submitted["modalities"] if m["id"] == "labs")["provider_mode"] == "SYNTHETIC"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "PASSPORT_SIGNING_KEY", "")
    app = FastAPI()
    app.include_router(router, prefix="/api/v1/cardiotwin")
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "synthetic-reviewer",
        "organization_id": "synthetic-org",
        "role": "reviewer",
    }
    with TestClient(app, raise_server_exceptions=False) as session:
        yield session, app


def test_empty_input_remains_unknown_and_models_unavailable():
    result = reconstruct_atlas(request())
    assert result["twin"]["snapshot"]["confidence"] == "LOW"
    assert all(d["state"] == "UNKNOWN" for d in result["dimensions"])
    assert all(m["status"] == "UNAVAILABLE" for m in result["modalities"])
    assert result["review"] == {
        "status": "REQUIRED",
        "clinical_approval": False,
        "source_review": "UNREVIEWED",
    }


@pytest.mark.parametrize("day", [1, 7, 10, 12, 15, 17, 19, 21])
def test_demo_every_view_obeys_both_clocks(day):
    at = datetime(2026, 8, day, 23, 59, 59, tzinfo=UTC)
    result = reconstruct_atlas(request(demo=True, as_of=at))
    records = (
        result["twin"]["evidence"]
        + result["evidence_graph"]["nodes"]
        + result["spatial"]["events"]
        + result["spatial"]["environment"]
    )
    records += [s for m in result["modalities"] for s in m["sources"]]
    for row in records:
        for clock in ("event_at", "available_at"):
            if row.get(clock):
                assert datetime.fromisoformat(row[clock]) <= at
    assert result["as_of"] == result["twin"]["as_of"]


def test_future_data_cannot_change_any_early_view_or_counts():
    old = evidence()
    extra = evidence(
        "future-hospital",
        kind="hospitalization",
        value="admission",
        unit=None,
        event_at=FUTURE,
        available_at=FUTURE,
    )
    early = reconstruct_atlas(request(evidence=[old]))
    with_future = reconstruct_atlas(
        request(
            evidence=[old, extra],
            modalities=[
                source(
                    id="future-voice",
                    modality="voice",
                    text="breathless",
                    event_at=FUTURE,
                    available_at=FUTURE,
                )
            ],
        )
    )
    assert early == with_future
    assert "future-hospital" not in json.dumps(with_future)
    assert "future-voice" not in json.dumps(with_future)


def test_delayed_bnp_and_later_map_events_are_absent_until_available():
    early = reconstruct_atlas(request(demo=True))
    late = reconstruct_atlas(request(demo=True, as_of="2026-08-12T23:59:59Z"))
    early_bnp = [e for e in early["twin"]["evidence"] if e["kind"] == "bnp"]
    late_bnp = [e for e in late["twin"]["evidence"] if e["kind"] == "bnp"]
    assert len(late_bnp) > len(early_bnp)
    assert "spatial-encounter" not in json.dumps(early)
    assert "demo-admission" not in json.dumps(early)
    assert any(e["kind"] == "bnp" for e in late["twin"]["knowledge_frontier"])


@pytest.mark.parametrize(
    "text,expected",
    [
        (
            "I am breathless and my legs feel swollen.",
            [("dyspnea", "present"), ("edema", "present")],
        ),
        ("No breathlessness. My ankles are swollen.", [("edema", "present")]),
        ("I am not short of breath.", []),
        ("Maybe I am breathless.", []),
        ("Previously breathless, no symptoms now.", []),
        ("I have heart failure and need 20 mg medication.", []),
        ("Reduced exercise tolerance.", [("functional_capacity", "reduced")]),
    ],
)
def test_conservative_report_parser(text, expected):
    assert patient_report(text) == expected


def test_waveform_alone_never_invents_rhythm():
    waveform = source(waveform={"samples": [0, 0.1, 1, -0.2, 0], "sampling_rate_hz": 250})
    result = reconstruct_atlas(request(modalities=[waveform]))
    assert not result["twin"]["evidence"]
    assert result["twin"]["snapshot"]["rhythm_stability"]["level"] == "UNKNOWN"
    assert result["modalities"][0]["status"] == "AVAILABLE"
    assert result["modalities"][0]["provider_mode"] == "SYNTHETIC"


@pytest.mark.parametrize("status", ["FAILED", "PROCESSING", "UNAVAILABLE"])
def test_failed_or_unprocessed_modalities_do_not_feed_engine(status):
    result = reconstruct_atlas(
        request(
            modalities=[
                source(status=status, observations=[{"kind": "rhythm", "value": "unstable"}])
            ]
        )
    )
    assert not result["twin"]["evidence"]
    assert result["modalities"][0]["status"] == status


def test_environment_cannot_infer_physiology_even_with_structured_findings():
    result = reconstruct_atlas(
        request(
            modalities=[
                source(
                    modality="environment",
                    observations=[{"kind": "bnp", "value": 800.0, "unit": "pg/mL"}],
                )
            ]
        )
    )
    assert not result["twin"]["evidence"]
    row = next(r for r in result["sensitivity"] if r["modality"] == "environment")
    assert row["changed_axes"] == []


def test_consent_omits_location_from_map_graph_and_passport(monkeypatch):
    monkeypatch.setattr(settings, "PASSPORT_SIGNING_KEY", "")
    body = demo_input(AT)
    body.spatial.consent = False
    result = reconstruct_atlas(body)
    assert result["spatial"]["location"] is None
    assert not result["spatial"]["events"]
    assert not result["spatial"]["environment"]
    package = passport(body, actor="reviewer", organization_id="org")
    assert "latitude" not in json.dumps(package)
    assert "longitude" not in json.dumps(package)


def test_facility_distances_are_derived_and_live_capacity_unknown():
    result = reconstruct_atlas(request(demo=True))
    facilities = result["spatial"]["facilities"]
    assert facilities
    assert all(f["live_capacity"] == "UNKNOWN" and f["distance_km"] >= 0 for f in facilities)
    assert any("UNKNOWN" in f["capabilities"].values() for f in facilities)


def test_graph_preserves_all_classifications_and_resolves_every_edge():
    result = reconstruct_atlas(request(demo=True, as_of="2026-08-12T23:59:59Z"))
    graph = result["evidence_graph"]
    assert {n["classification"] for n in graph["nodes"]} == {
        "OBSERVED",
        "DERIVED",
        "INFERRED",
        "UNKNOWN",
    }
    ids = {n["id"] for n in graph["nodes"]}
    assert len(ids) == len(graph["nodes"])
    assert all(e["source"] in ids and e["target"] in ids for e in graph["edges"])
    assert all("caus" not in e["relationship"] for e in graph["edges"])
    assert all(
        n.get("source_record") is not None for n in graph["nodes"] if n["type"] == "Observation"
    )


def test_duplicate_sources_collapse_but_known_identity_conflicts_reject():
    s = source(observations=[{"kind": "rhythm", "value": "sinus"}])
    rows, _ = normalize([s, s], datetime.fromisoformat(AT), "Patient/test")
    assert len(rows) == 1
    with pytest.raises(ValueError, match="Conflicting modality"):
        normalize(
            [s, s.model_copy(update={"provider": "other"})],
            datetime.fromisoformat(AT),
            "Patient/test",
        )


def test_conflicting_observations_remain_unknown_and_low_confidence():
    a = evidence(kind="rhythm", value="sinus", unit=None)
    b = evidence("rhythm-b", kind="rhythm", value="unstable", unit=None)
    result = reconstruct_atlas(request(evidence=[a, b]))
    assert result["twin"]["snapshot"]["rhythm_stability"]["level"] == "UNKNOWN"
    assert result["twin"]["snapshot"]["confidence"] == "LOW"


def test_scenario_does_not_mutate_original_and_is_explicitly_hypothetical():
    body = request(demo=True)
    original = reconstruct_atlas(body)
    original_serialized = json.dumps(original, sort_keys=True)
    scenario = sandbox(
        ScenarioRequest(input=body, changes=[{"kind": "spo2", "value": 88.0, "unit": "%"}])
    )
    assert json.dumps(scenario["current"], sort_keys=True) == original_serialized
    assert scenario["simulated"]["scenario"] is True
    assert (
        scenario["simulated"]["twin"]["snapshot"]["respiratory_interaction"]["level"]
        != original["twin"]["snapshot"]["respiratory_interaction"]["level"]
    )
    assert any(
        e["provenance"].get("hypothetical") for e in scenario["simulated"]["twin"]["evidence"]
    )
    assert "hypothetical:" not in json.dumps(reconstruct_atlas(body))


@pytest.mark.parametrize(
    "change",
    [
        {"kind": "medication", "value": "increase"},
        {"kind": "diuretic_change", "value": "escalated"},
        {"kind": "weight", "value": -1.0, "unit": "kg"},
        {"kind": "spo2", "value": 88.0, "unit": "mmHg"},
        {"kind": "edema", "value": "definite diagnosis"},
    ],
)
def test_scenario_rejects_treatment_or_invalid_operands(change):
    with pytest.raises(ValueError):
        sandbox(ScenarioRequest(input=request(), changes=[change]))


@pytest.mark.parametrize(
    "question",
    [
        "What changed since yesterday?",
        "What information is missing?",
        "Which modality contributes most?",
        "Show state before BNP became available",
        "What changed after the intervention?",
        "What does the map show?",
        "What evidence supports volume?",
    ],
)
def test_copilot_uses_only_retrieved_available_sources(question):
    body = request(demo=True)
    result = reconstruct_atlas(body)
    answer = explain(ExplainRequest(input=body, question=question))
    assert set(answer["evidence_refs"]) <= {e["id"] for e in result["twin"]["evidence"]}
    assert "demo-admission" not in json.dumps(answer)
    assert answer["mode"] == "DETERMINISTIC_RETRIEVAL"
    assert answer["clinical_approval"] is False


def test_copilot_denies_treatment_and_future_comparison():
    body = request(demo=True)
    assert (
        "cannot diagnose"
        in explain(ExplainRequest(input=body, question="Prescribe a dose"))["answer"]
    )
    with pytest.raises(ValueError):
        explain(ExplainRequest(input=body, question="Compare", compare_as_of=FUTURE))


def test_deterministic_reconstruction_and_existing_passport_integrity(monkeypatch):
    monkeypatch.setattr(settings, "PASSPORT_SIGNING_KEY", "")
    body = request(demo=True)
    assert reconstruct_atlas(body) == reconstruct_atlas(copy.deepcopy(body))
    package = passport(body, actor="server-reviewer", organization_id="server-org")
    assert verify_package(package)["hash_chain"]["valid"] is True
    raw = json.dumps(package)
    assert "server-org" in raw and '"clinical_approval": false' in raw
    assert "evidence_graph" in raw and "derived_fhir" in raw


def test_native_fhir_mapping_and_invalid_partial_fhir_fail_closed(client):
    session, _ = client
    native = demo_input(AT)
    response = session.post(
        "/api/v1/cardiotwin/atlas/reconstruct", json=native.model_dump(mode="json")
    )
    assert response.status_code == 200
    assert response.json()["twin"]["fhir_contract"]["full_hl7_profile_validation"] is False
    response = session.post(
        "/api/v1/cardiotwin/atlas/reconstruct",
        json={"as_of": AT, "bundle": {"resourceType": "Patient"}},
    )
    assert response.status_code == 422


def test_api_auth_and_identity_override_boundaries(client):
    session, app = client
    for field in ("clinical_approval", "organization_id", "reviewer"):
        response = session.post(
            "/api/v1/cardiotwin/atlas/reconstruct", json={"as_of": AT, field: "forged"}
        )
        assert response.status_code == 422
    app.dependency_overrides.clear()
    assert session.get("/api/v1/cardiotwin/atlas/demo").status_code in {401, 403}


def test_api_bounds_and_sanitized_errors(client):
    session, _ = client
    assert (
        session.post("/api/v1/cardiotwin/atlas/reconstruct", content="x" * 2_000_001).status_code
        == 413
    )
    assert (
        session.post("/api/v1/cardiotwin/atlas/reconstruct", content="{" + "x" * 100).status_code
        == 422
    )
    bad = source().model_dump(mode="json")
    bad["text"] = "PRIVATE-RAW-TEXT"
    bad["available_at"] = "invalid"
    response = session.post(
        "/api/v1/cardiotwin/atlas/reconstruct", json={"as_of": AT, "modalities": [bad]}
    )
    assert response.status_code == 422
    assert "PRIVATE-RAW-TEXT" not in response.text


@pytest.mark.parametrize("value", [float("nan"), float("inf")])
def test_non_finite_waveforms_rejected(value):
    with pytest.raises(ValidationError):
        source(waveform={"samples": [0.0, value], "sampling_rate_hz": 250})

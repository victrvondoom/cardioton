"""Independent hostile-FHIR, authenticated-API and passport boundary tests."""

from __future__ import annotations

import copy
import json
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.cardiotwin.hemodynamics.api import router
from app.cardiotwin.hemodynamics.core__cardiotwin_hemodynamics__fhir import (
    LOINC,
    UCUM,
    ingest_bundle,
)
from app.cardiotwin.hemodynamics.core__cardiotwin_hemodynamics__service import (
    from_fhir,
    snapshot_fhir,
)
from app.cardiotwin.hemodynamics.demo import PATIENT_REF, demo_bundle
from app.core__backend_app__config import settings
from app.onehealth.passport import verify_package

BASE = "/api/v1/cardiotwin/hemo"
AS_OF = datetime(2026, 8, 3, 23, 59, 59, tzinfo=UTC)
AT = "2026-08-01T12:00:00Z"
USER = {"id": "synthetic-reviewer", "role": "reviewer", "organization_id": "synthetic-org"}


def test_extreme_json_integer_returns_validation_error_instead_of_500(client):
    session, _ = client
    response = session.post(BASE + "/reconstruct", content='{"too_large":' + "9" * 5000 + '}',
                            headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert "9" * 100 not in response.text


def test_fhir_overflowing_quantity_is_quarantined_without_server_error(client):
    session, _ = client
    quantity = {"value": 10**400, "system": UCUM, "code": "kg", "unit": "kg"}
    response = session.post(BASE + "/fhir", json=fhir_payload(bundle(weight(valueQuantity=quantity))))
    assert response.status_code == 200
    result = response.json()
    assert not result["evidence"]
    assert result["snapshot"]["volume_status"]["level"] == "UNKNOWN"
    assert result["issues"][0]["code"] == "FHIR_SOURCE_QUARANTINED"
    assert "100000000000000000000" not in response.text


def test_fhir_deeply_nested_source_is_quarantined_without_server_error(client):
    session, _ = client
    nested = {}
    for _ in range(600):
        nested = {"nested": nested}
    response = session.post(BASE + "/fhir", json=fhir_payload(bundle(weight(extension=nested))))
    assert response.status_code == 200
    result = response.json()
    assert not result["evidence"]
    assert result["issues"][0]["code"] == "FHIR_SOURCE_QUARANTINED"
    assert "maximum recursion" not in response.text


def weight(identifier: str = "source-weight", **overrides: Any) -> dict[str, Any]:
    resource = {
        "resourceType": "Observation", "id": identifier, "status": "final",
        "subject": {"reference": PATIENT_REF}, "effectiveDateTime": AT, "issued": AT,
        "code": {"coding": [{"system": LOINC, "code": "29463-7"}]},
        "valueQuantity": {"value": 72.0, "system": UCUM, "code": "kg", "unit": "kg"},
    }
    resource.update(overrides)
    return resource


def bundle(*resources: dict[str, Any]) -> dict[str, Any]:
    return {
        "resourceType": "Bundle", "type": "collection",
        "entry": [{"resource": {"resourceType": "Patient", "id": PATIENT_REF.split("/")[1]}},
                  *[{"resource": resource} for resource in resources]],
    }


def ingest(value: dict[str, Any]):
    return ingest_bundle(value, patient_ref=PATIENT_REF, as_of=AS_OF, received_at=AS_OF)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "PASSPORT_SIGNING_KEY", "")
    app = FastAPI()
    app.include_router(router, prefix="/api/v1/cardiotwin")
    app.dependency_overrides[get_current_user] = lambda: dict(USER)
    with TestClient(app, raise_server_exceptions=False) as session:
        yield session, app


def fhir_payload(value: dict[str, Any]) -> dict[str, Any]:
    return {"bundle": value, "patient_ref": PATIENT_REF,
            "as_of": AS_OF.isoformat(), "received_at": AS_OF.isoformat()}


def reconstruction_payload() -> dict[str, Any]:
    return {"patient_ref": PATIENT_REF, "as_of": AS_OF.isoformat(), "evidence": []}


@pytest.mark.parametrize("method,path", [
    ("get", "/demo"), ("get", "/demo/passport"),
    ("post", "/reconstruct"), ("post", "/fhir"), ("post", "/passport"),
])
def test_every_hemodynamic_route_requires_authentication(client, method, path):
    session, app = client
    app.dependency_overrides.clear()
    response = getattr(session, method)(BASE + path, **({"json": {}} if method == "post" else {}))
    assert response.status_code == 401


@pytest.mark.parametrize("field,value", [
    ("clinical_approval", True), ("reviewer_id", "forged-identity"),
    ("organization_id", "another-tenant"), ("review", {"status": "APPROVED"}),
])
@pytest.mark.parametrize("endpoint", ["/reconstruct", "/passport"])
def test_body_cannot_approve_or_spoof_review_and_tenant(client, field, value, endpoint):
    session, _ = client
    payload = reconstruction_payload()
    payload[field] = value
    response = session.post(BASE + endpoint, json=payload)
    assert response.status_code == 422
    assert str(value) not in response.text


def test_fhir_numeric_conversion_preserves_original_and_transformation():
    resource = weight(valueQuantity={"value": 158.7328288, "system": UCUM,
                                    "code": "[lb_av]", "unit": "lb"})
    selected, records, issues = ingest(bundle(resource))
    assert selected == PATIENT_REF and not issues
    assert len(records) == 1
    source = records[0]
    assert source.kind == "weight" and source.value == pytest.approx(72.0, abs=1e-6)
    assert source.unit == "kg"
    assert source.original_record == resource
    assert source.provenance["transformation"]["source_quantity"] == resource["valueQuantity"]


def test_bnp_and_ntprobnp_remain_distinct_source_concepts():
    sources = [weight("bnp", code={"coding": [{"system": LOINC, "code": "30934-4"}]},
                      valueQuantity={"value": 80.0, "system": UCUM, "code": "pg/mL"}),
               weight("ntprobnp", code={"coding": [{"system": LOINC, "code": "33762-6"}]},
                      valueQuantity={"value": 200.0, "system": UCUM, "code": "pg/mL"})]
    _, records, issues = ingest(bundle(*sources))
    assert not issues
    assert {source.kind for source in records} == {"bnp", "ntprobnp"}


@pytest.mark.parametrize("status", ["preliminary", "registered", "cancelled", "entered-in-error"])
def test_ineligible_source_status_is_quarantined(status):
    _, records, issues = ingest(bundle(weight(status=status)))
    assert not records
    assert issues


@pytest.mark.parametrize("quantity", [
    {"value": 72, "system": UCUM, "code": "kg", "comparator": ">"},
    {"value": 72, "system": UCUM, "code": "kg", "unit": "lb"},
    {"value": 72, "system": "http://untrusted-units", "code": "kg"},
    {"value": True, "system": UCUM, "code": "kg"},
    {"value": "72", "system": UCUM, "code": "kg"},
    {"value": 72, "system": UCUM, "code": "mL"},
])
def test_invalid_quantity_does_not_become_an_exact_measurement(quantity):
    _, records, issues = ingest(bundle(weight(valueQuantity=quantity)))
    assert not records and issues


@pytest.mark.parametrize("source_update", [
    {"issued": "2026-08-05T12:00:00Z"},
    {"meta": {"lastUpdated": "2026-08-05T12:00:00Z"}},
])
def test_resource_version_knowledge_time_prevents_backdated_future_information(source_update):
    future = weight(**source_update)
    actual = from_fhir(bundle(future), as_of=AS_OF, patient_ref=PATIENT_REF)
    empty = from_fhir(bundle(), as_of=AS_OF, patient_ref=PATIENT_REF)
    assert actual == empty


def test_later_provenance_does_not_backfill_an_old_observation():
    provenance = {"resourceType": "Provenance", "id": "late-prov",
                  "target": [{"reference": "Observation/source-weight"}],
                  "recorded": "2026-08-05T12:00:00Z"}
    actual = from_fhir(bundle(weight(), provenance), as_of=AS_OF, patient_ref=PATIENT_REF)
    assert actual == from_fhir(bundle(), as_of=AS_OF, patient_ref=PATIENT_REF)


def test_patient_alias_and_provenance_target_alias_preserve_original_source():
    value = bundle(weight(subject={"reference": "urn:uuid:patient"}))
    value["entry"][0]["fullUrl"] = "urn:uuid:patient"
    value["entry"][1]["fullUrl"] = "urn:uuid:weight"
    value["entry"].append({"resource": {
        "resourceType": "Provenance", "id": "source-prov", "recorded": AT,
        "target": [{"reference": "urn:uuid:weight"}],
    }})
    _, records, issues = ingest(value)
    assert not issues and len(records) == 1
    assert records[0].provenance["source_provenance"][0]["id"] == "source-prov"


def test_condition_is_preserved_as_context_without_generating_a_new_diagnosis():
    condition = {"resourceType": "Condition", "id": "context-condition",
                 "subject": {"reference": PATIENT_REF}, "recordedDate": AT,
                 "onsetDateTime": AT, "meta": {"lastUpdated": AT},
                 "code": {"text": "Synthetic pre-existing condition"}}
    result = from_fhir(bundle(condition), as_of=AS_OF, patient_ref=PATIENT_REF)
    assert result["evidence"][0]["kind"] == "condition"
    assert all(result["snapshot"][axis]["level"] == "UNKNOWN" for axis in (
        "pump_function", "volume_status", "filling_pressure_proxy"))
    assert result["review"]["clinical_approval"] is False


def test_exported_inference_cannot_feed_back_as_source_measurement():
    result = from_fhir(bundle(weight()), as_of=AS_OF, patient_ref=PATIENT_REF)
    exported = snapshot_fhir(result)
    exported["entry"].insert(0, {"resource": bundle()["entry"][0]["resource"]})
    _, records, _ = ingest(exported)
    assert not records
    # Even changing status/coding/value cannot bypass the explicit inference tag.
    source = exported["entry"][1]["resource"]
    source.update(status="final", code=weight()["code"], valueQuantity=weight()["valueQuantity"],
                  issued=AT, effectiveDateTime=AT)
    for entry in exported["entry"]:
        if entry["resource"]["resourceType"] == "Provenance":
            entry["resource"]["recorded"] = AT
    _, records, issues = ingest(exported)
    assert not records and issues


@pytest.mark.parametrize("malformation", [
    "patient_fullurl_object", "subject_reference_list", "provenance_target_object",
    "provenance_reference_list", "provenance_target_null", "observation_meta_null",
    "observation_component_object", "observation_status_list", "entry_resource_list",
])
def test_malformed_nested_fhir_never_produces_server_error(client, malformation):
    session, _ = client
    value = bundle(weight())
    source = value["entry"][1]["resource"]
    if malformation == "patient_fullurl_object":
        value["entry"][0]["fullUrl"] = {"untrusted": "object"}
    elif malformation == "subject_reference_list":
        source["subject"] = {"reference": ["not-a-reference"]}
    elif malformation.startswith("provenance_"):
        target: Any = [{"reference": "Observation/source-weight"}]
        if malformation == "provenance_target_object":
            target = {"reference": "Observation/source-weight"}
        elif malformation == "provenance_target_null":
            target = None
        elif malformation == "provenance_reference_list":
            target = [{"reference": ["not-a-reference"]}]
        value["entry"].append({"resource": {"resourceType": "Provenance", "id": "hostile",
                                             "target": target, "recorded": AT}})
    elif malformation == "observation_meta_null":
        source["meta"] = None
    elif malformation == "observation_component_object":
        source["component"] = {"valueQuantity": 12}
    elif malformation == "observation_status_list":
        source["status"] = ["final"]
    elif malformation == "entry_resource_list":
        value["entry"].append({"resource": ["not-a-resource"]})
    response = session.post(BASE + "/fhir", json=fhir_payload(value))
    assert response.status_code in (200, 422), response.text


def test_contract_errors_do_not_echo_original_records_or_sensitive_input(client):
    session, _ = client
    marker = "synthetic-private-secret-must-not-appear"
    payload = reconstruction_payload()
    payload["evidence"] = [{"id": "invalid", "original_record": {"credential": marker}}]
    response = session.post(BASE + "/reconstruct", json=payload)
    assert response.status_code == 422
    assert marker not in response.text
    assert "credential" not in response.text


def test_synthetic_demo_replay_reaches_api_without_future_bnp_or_admission(client):
    session, _ = client
    response = session.get(BASE + "/demo", params={"as_of": "2026-08-10T23:59:59Z"})
    assert response.status_code == 200
    result = response.json()
    raw = json.dumps({key: value for key, value in result.items() if key != "demo"})
    assert "demo-admission" not in raw
    assert "demo-08-10-bnp" not in raw
    assert result["snapshot"]["pump_function"]["level"] == "UNKNOWN"
    assert result["review"] == {"status": "REQUIRED", "clinical_approval": False}
    assert any(item["original_record"] for item in result["evidence"])


def test_demo_source_resources_are_entirely_synthetic():
    value = demo_bundle()
    patient = next(item["resource"] for item in value["entry"]
                   if item["resource"]["resourceType"] == "Patient")
    assert patient["id"].startswith("synthetic-")
    assert not patient.get("name") and not patient.get("identifier")


def test_snapshot_passport_uses_authenticated_actor_tenant_and_detects_tampering(client):
    session, _ = client
    response = session.get(BASE + "/demo/passport", params={"as_of": "2026-08-10T23:59:59Z"})
    assert response.status_code == 200
    package = response.json()
    record = package["content"]["record"]
    assert record["organization_id"] == USER["organization_id"]
    assert record["passport"][-1]["actor"] == USER["id"]
    assert record["clinical_review"] == {"status": "REQUIRED", "clinical_approval": False}
    assert verify_package(package)["hash_chain"]["valid"] is True
    tampered = copy.deepcopy(package)
    tampered["content"]["record"]["reconstruction"]["snapshot"]["volume_status"]["level"] = "UNKNOWN"
    assert verify_package(tampered)["overall"] == "FAILED"


def test_conflicting_source_identity_is_an_actionable_rejection_instead_of_500(client):
    session, _ = client
    payload = reconstruction_payload()
    _, evidence, _ = ingest(bundle(weight()))
    first = evidence[0].model_dump(mode="json")
    second = copy.deepcopy(first)
    second["value"] = 80.0
    payload["evidence"] = [first, second]
    for endpoint in ("/reconstruct", "/passport"):
        response = session.post(BASE + endpoint, json=payload)
        assert response.status_code == 422, (endpoint, response.text)

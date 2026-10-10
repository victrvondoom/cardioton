"""FHIR export fidelity, temporal precision and event-loop isolation regressions."""

from __future__ import annotations

import asyncio
import copy
import threading
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.cardiotwin.hemodynamics import api
from app.cardiotwin.hemodynamics.demo import PATIENT_REF, demo_bundle
from app.cardiotwin.hemodynamics.engine import reconstruct
from app.cardiotwin.hemodynamics.schema import Evidence
from app.config import settings
from app.onehealth.passport import verify_package

BASE = "/api/v1/cardiotwin/hemo"
USER = {"id": "synthetic-export-reviewer", "organization_id": "synthetic-export-org"}
AT = datetime(2026, 8, 12, 23, 59, 59, 999999, tzinfo=UTC)


@pytest.fixture
def application(monkeypatch):
    monkeypatch.setattr(settings, "PASSPORT_SIGNING_KEY", "")
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1/cardiotwin")
    app.dependency_overrides[get_current_user] = lambda: dict(USER)
    return app


def fhir_payload():
    source = demo_bundle()
    bad = next(
        entry["resource"] for entry in source["entry"]
        if entry["resource"].get("id") == "demo-08-01-weight"
    )
    bad["valueQuantity"]["comparator"] = ">"
    return {
        "bundle": source,
        "patient_ref": PATIENT_REF,
        "as_of": AT.isoformat(),
        "received_at": AT.isoformat(),
    }


def test_fhir_passport_requires_authentication(application):
    application.dependency_overrides.clear()
    with TestClient(application) as client:
        response = client.post(BASE + "/fhir/passport", json=fhir_payload())
    assert response.status_code == 401


@pytest.mark.parametrize("field,value", [
    ("review", {"status": "APPROVED"}),
    ("clinical_approval", True),
    ("organization_id", "forged-tenant"),
    ("reviewer_id", "forged-reviewer"),
])
def test_fhir_passport_rejects_review_and_tenant_overrides(application, field, value):
    payload = fhir_payload()
    payload[field] = value
    with TestClient(application) as client:
        response = client.post(BASE + "/fhir/passport", json=payload)
    assert response.status_code == 422


def test_fhir_passport_retains_intake_issues_contract_sources_and_governance(application):
    payload = fhir_payload()
    with TestClient(application) as client:
        state_response = client.post(BASE + "/fhir", json=payload)
        passport_response = client.post(BASE + "/fhir/passport", json=payload)
    assert state_response.status_code == passport_response.status_code == 200
    state = state_response.json()
    package = passport_response.json()
    record = package["content"]["record"]
    exported = record["reconstruction"]
    assert state["issues"] and state["evidence"]
    assert exported == state
    assert exported["fhir_contract"] == state["fhir_contract"]
    assert exported["evidence"] == state["evidence"]
    assert all(e["original_record"] and e["provenance"]["source_sha256"] for e in exported["evidence"])
    assert record["organization_id"] == USER["organization_id"]
    assert record["passport"][-1]["actor"] == USER["id"]
    assert record["clinical_review"] == {"status": "REQUIRED", "clinical_approval": False}
    assert exported["review"] == record["clinical_review"]
    assert verify_package(package)["hash_chain"]["valid"] is True
    tampered = copy.deepcopy(package)
    tampered["content"]["record"]["reconstruction"]["issues"] = []
    assert verify_package(tampered)["overall"] == "FAILED"


def source(identifier, kind, value, event_at, *, available_at=None, source_ref=None, unit=None):
    return Evidence(
        id=identifier,
        patient_ref=PATIENT_REF,
        kind=kind,
        value=value,
        unit=unit,
        event_at=event_at,
        available_at=available_at or event_at,
        source_ref=source_ref or f"Observation/{identifier}",
        original_record={"synthetic": True, "kind": kind, "value": value},
    )


def test_end_of_day_microsecond_boundary_includes_fractional_final_second(application):
    instant = datetime(2026, 8, 3, 23, 59, 59, 500000, tzinfo=UTC)
    records = [
        source("last-second", "edema", "present", instant),
        source("next-day", "hospitalization", "admitted", instant + timedelta(seconds=1)),
    ]
    with TestClient(application) as client:
        response = client.post(BASE + "/reconstruct", json={
            "patient_ref": PATIENT_REF,
            "as_of": "2026-08-03T23:59:59.999999Z",
            "evidence": [e.model_dump(mode="json") for e in records],
        })
    assert response.status_code == 200
    result = response.json()
    assert [e["id"] for e in result["evidence"]] == ["last-second"]
    assert result["snapshot"]["congestion"]["stage"] == "MILD_SIGNAL"


def test_each_timeline_point_matches_its_known_prefix_with_duplicates_and_delays():
    start = datetime(2026, 8, 1, 8, tzinfo=UTC)
    baseline = source("baseline-weight", "weight", 72.0, start, unit="kg")
    records = [
        baseline,
        source("negative-edema", "edema", "absent", start),
        source("negative-dyspnea", "dyspnea", "absent", start),
        source("higher-weight", "weight", 74.0, start + timedelta(days=1), unit="kg"),
        source("late-edema", "edema", "present", start + timedelta(days=1),
               available_at=start + timedelta(days=3)),
        # An equivalent source with a different delivery ID has the same clocks.
        baseline.model_copy(update={"id": "aaa-duplicate-weight"}),
        copy.deepcopy(baseline),
        # A later conflicting version cannot affect this earlier reconstruction.
        baseline.model_copy(update={"value": 99.0, "available_at": start + timedelta(days=10)}),
    ]
    result = reconstruct(records, start + timedelta(days=5), PATIENT_REF)
    for state in result["timeline"]:
        cutoff = datetime.fromisoformat(state["timestamp"])
        prefix = [e for e in records if e.event_at <= cutoff and e.available_at <= cutoff]
        assert state == reconstruct(prefix, cutoff, PATIENT_REF)["snapshot"]
    before_release = reconstruct(records, start + timedelta(days=2), PATIENT_REF)
    assert all(e["id"] != "late-edema" for e in before_release["evidence"])
    assert before_release["snapshot"]["congestion"]["stage"] == "MILD_SIGNAL"


@pytest.mark.asyncio
async def test_reconstruction_worker_does_not_block_independent_async_requests(application, monkeypatch):
    started = threading.Event()
    release = threading.Event()
    finished = threading.Event()
    original = api.request_result

    def delayed(request):
        started.set()
        try:
            if not release.wait(timeout=5):
                raise RuntimeError("Bounded test worker was not released")
            return original(request)
        finally:
            finished.set()

    monkeypatch.setattr(api, "request_result", delayed)

    @application.get("/async-probe")
    async def probe():
        await asyncio.sleep(0)
        return {"responsive": True}

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application), base_url="http://test"
    ) as client:
        work = asyncio.create_task(client.post(BASE + "/reconstruct", json={
            "patient_ref": PATIENT_REF, "as_of": AT.isoformat(), "evidence": [],
        }))
        try:
            assert await asyncio.wait_for(asyncio.to_thread(started.wait, 2), timeout=3)
            assert not finished.is_set()
            response = await asyncio.wait_for(client.get("/async-probe"), timeout=1)
            assert response.status_code == 200
            assert response.json() == {"responsive": True}
            assert not work.done()
        finally:
            release.set()
            response = await asyncio.wait_for(work, timeout=3)
        assert response.status_code == 200
        assert finished.is_set()

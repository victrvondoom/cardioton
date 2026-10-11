"""Preparation automation resumes real SQLite jobs and never grants approval or sends records."""

import asyncio

import httpx
import pytest
from fastapi import FastAPI

from app.api import interop as interop_api
from app.api import journey as journey_api
from app.api import onehealth as onehealth_api
from app.auth import get_current_user
from app.config import settings
from app.db import db
from app.interop import repository, service
from app.onehealth import repository as exposures

BASE = "/api/v1/interop"


@pytest.fixture
async def session(monkeypatch, tmp_path):
    monkeypatch.setattr(db, "_pool", None)
    monkeypatch.setattr(settings, "ENVIRONMENT", "dev")
    monkeypatch.setattr(settings, "TRACK7_DEMO_DB", str(tmp_path / "automation.sqlite"))
    app = FastAPI()
    for router in (interop_api.router, onehealth_api.router, journey_api.router):
        app.include_router(router, prefix="/api/v1")
    user = {"id": "automation-reviewer", "role": "reviewer", "organization_id": "automation-org"}
    app.dependency_overrides[get_current_user] = lambda: user
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client, user, app


async def imported(client, variant="dissolved"):
    response = await client.post(f"{BASE}/demo?variant={variant}", json={})
    assert response.status_code == 201, response.text
    return response.json()


async def state(client, job_id):
    response = await client.get(f"/api/v1/journey/{job_id}/automation")
    assert response.status_code == 200, response.text
    return response.json()


async def advance(client, job_id, version):
    return await client.post(
        f"/api/v1/journey/{job_id}/automation", json={"expected_version": version}
    )


async def reviewed(client, job):
    response = await advance(client, job["id"], job["version"])
    assert response.status_code == 200, response.text
    job = (await client.get(f"{BASE}/jobs/{job['id']}")).json()
    for mapping in list(job["mappings"]):
        action = "approve" if mapping["target"] else "reject"
        response = await client.post(
            f"{BASE}/mappings/{job['id']}/{action}",
            json={
                "job_id": job["id"], "expected_version": job["version"],
                "source_field": mapping["source_field"], "target": mapping["target"],
                "concept": "total_arsenic" if mapping["source_field"] == "arsenic" else None,
            },
        )
        assert response.status_code == 200, response.text
        job = response.json()
    return job


async def prepared(client):
    job = await reviewed(client, await imported(client))
    response = await advance(client, job["id"], job["version"])
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "ready_for_exchange"
    return (await client.get(f"{BASE}/jobs/{job['id']}")).json()


async def test_maps_once_then_waits_for_every_human_decision(session, monkeypatch):
    client, user, _ = session
    async def forbidden(*args, **kwargs):
        pytest.fail("Automation crossed an approval or external exchange boundary")
    for name in ("approve", "approve_safe", "transfer", "returned", "external_check"):
        monkeypatch.setattr(interop_api, name, forbidden)
    job = await imported(client, "ambiguous")
    initial = await state(client, job["id"])
    assert initial["next_step"] == "map" and initial["status"] == "running"
    mapped = await advance(client, job["id"], job["version"])
    assert mapped.status_code == 200
    result = mapped.json()
    assert result["status"] == "waiting_review" and result["next_step"] is None
    persisted = await repository.get(user["organization_id"], job["id"])
    assert all(mapping.decision == "pending" and mapping.reviewer is None for mapping in persisted.mappings)
    assert persisted.bundle is None and not persisted.transfers
    event = persisted.events[-1]
    assert event.event_type == "automation_step_completed" and event.actor == user["id"]
    assert event.provenance["step"] == "map"
    same = await advance(client, job["id"], persisted.version)
    assert same.status_code == 200 and same.json()["job_version"] == persisted.version
    assert len((await repository.get(user["organization_id"], job["id"])).events) == len(persisted.events)


async def test_reload_resumes_persisted_preparation_after_explicit_review(session):
    client, user, _ = session
    job = await reviewed(client, await imported(client))
    repository._memory.clear()  # SQLite, not an in-process automation store, is the authority.
    resumed = await state(client, job["id"])
    assert resumed["status"] == "running" and resumed["next_step"] == "generate"
    response = await advance(client, job["id"], resumed["job_version"])
    result = response.json()
    assert result["status"] == "ready_for_exchange" and result["next_step"] is None
    assert all(step["status"] == "complete" for step in result["steps"])
    saved = await repository.get(user["organization_id"], job["id"])
    assert saved.version == job["version"] + 1
    assert saved.validation["valid"] and not saved.transfers
    assert saved.events[-2].actor == user["id"]
    assert result["view"]["current_stage"] == "exchange"
    assert (await advance(client, saved.id, saved.version)).json()["job_version"] == saved.version


async def test_auth_tenant_and_stale_version_are_enforced(session):
    client, user, app = session
    job = await imported(client)
    assert (await advance(client, job["id"], job["version"] + 1)).status_code == 409
    user["organization_id"] = "another-org"
    assert (await client.get(f"/api/v1/journey/{job['id']}/automation")).status_code == 404
    assert (await advance(client, job["id"], job["version"])).status_code == 404
    user["organization_id"], user["role"] = "automation-org", "coordinator"
    assert (await client.get(f"/api/v1/journey/{job['id']}/automation")).status_code == 403
    assert (await advance(client, job["id"], job["version"])).status_code == 403
    app.dependency_overrides.clear()
    assert (await client.get(f"/api/v1/journey/{job['id']}/automation")).status_code in (401, 403)


@pytest.mark.parametrize("extra", [{"action": "approve_safe"}, {"use_ai": True}, {"bundle": {}}])
async def test_browser_cannot_choose_an_action_or_supply_a_bundle(session, extra):
    client, _, _ = session
    job = await imported(client)
    response = await client.post(
        f"/api/v1/journey/{job['id']}/automation",
        json={"expected_version": job["version"], **extra},
    )
    assert response.status_code == 422
    assert (await state(client, job["id"]))["job_version"] == job["version"]


async def test_concurrent_mapping_requests_have_one_cas_winner(session, monkeypatch):
    client, user, _ = session
    job = await imported(client)
    original = service.analyze
    both_started = asyncio.Event()
    started = 0
    async def concurrent_analyze(current, use_ai):
        nonlocal started
        started += 1
        if started == 2:
            both_started.set()
        await asyncio.wait_for(both_started.wait(), timeout=3)
        await original(current, use_ai)
    monkeypatch.setattr(service, "analyze", concurrent_analyze)
    responses = await asyncio.gather(
        advance(client, job["id"], job["version"]),
        advance(client, job["id"], job["version"]),
    )
    assert sorted(response.status_code for response in responses) == [200, 409]
    saved = await repository.get(user["organization_id"], job["id"])
    assert saved.version == job["version"] + 1
    assert sum(event.event_type == "mappings_proposed" for event in saved.events) == 1


async def test_failed_exact_package_validation_blocks_without_retry(session, monkeypatch):
    client, user, _ = session
    job = await prepared(client)
    saved = await repository.get(user["organization_id"], job["id"])
    saved.bundle["entry"] = []  # Simulate a persisted generated package with a failed contract.
    saved.validation = service.validate(saved.bundle)
    assert not saved.validation["valid"]
    saved = await repository.save(saved, saved.version)
    before = saved.version
    async def forbidden(*args, **kwargs):
        pytest.fail("A failed exact-bundle validation must not be blindly retried")
    monkeypatch.setattr(interop_api, "validate", forbidden)
    result = (await advance(client, saved.id, saved.version)).json()
    assert result["status"] == "blocked" and result["next_step"] is None
    assert result["job_version"] == before


async def test_mismatched_validation_checks_server_bundle_not_prior_challenge(session):
    client, user, _ = session
    job = await prepared(client)
    saved = await repository.get(user["organization_id"], job["id"])
    actual_bundle = saved.bundle
    saved.validation = {"valid": False, "sha256": "edited-challenge-digest"}
    saved = await repository.save(saved, saved.version)
    before = await state(client, saved.id)
    assert before["next_step"] == "validate"
    response = await advance(client, saved.id, saved.version)
    assert response.status_code == 200
    assert response.json()["status"] == "ready_for_exchange"
    after = await repository.get(user["organization_id"], saved.id)
    assert after.bundle == actual_bundle and after.validation["valid"]


async def test_withdrawn_bound_evidence_blocks_and_redacts_automation_view(session):
    client, user, _ = session
    job = await prepared(client)
    saved = await repository.get(user["organization_id"], job["id"])
    record = service.normalize(saved)
    record.consent_withdrawn = True
    record = await exposures.save(record)
    saved.exposure_id, saved.exposure_version = record.id, record.version
    saved = await repository.save(saved, saved.version)
    result = await state(client, saved.id)
    assert result["status"] == "blocked" and result["next_step"] is None
    assert result["view"]["consent_status"] == "WITHDRAWN"
    assert (await advance(client, saved.id, saved.version)).json()["job_version"] == saved.version
    assert all(step["status"] != "complete" for step in result["steps"] if step["id"] in {"generate", "validate"})

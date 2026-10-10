"""In-process dashboard contracts. No running server or availability skips."""
from __future__ import annotations

from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.api import cardio_global
from app.auth import get_current_user
from app.cardiotwin.analytics.global_service import CardioGlobalService
from app.cardiotwin.analytics.repository import ResearchRepository
from app.cardiotwin.evidence.passport import compute_content_sha256
from app.config import settings
from app.main import app

BASE = "/api/cardiotwin/global"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "CARDIOTWIN_GLOBAL_LIVE_SOURCES", "")
    monkeypatch.setattr(cardio_global, "service", CardioGlobalService(repository=ResearchRepository(tmp_path / "research.sqlite3")))
    previous = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = lambda: {"id": "researcher-a", "organization_id": "org-a", "role": "coordinator"}
    api = TestClient(app)
    yield api
    api.close()
    if previous is None:
        app.dependency_overrides.pop(get_current_user, None)
    else:
        app.dependency_overrides[get_current_user] = previous


@pytest.mark.parametrize("prefix", [BASE, "/api/v1/cardiotwin/global"])
def test_overview_counts_actual_corpus(client, prefix):
    response = client.get(prefix + "/overview")
    assert response.status_code == 200
    assert "application/json" in response.headers["content-type"]
    overview = response.json()
    records = client.get(prefix + "/records").json()["records"]
    assert overview["indexed_research_records"] == len(records) == 4
    assert overview["clinical_trials_discovered"] == sum(r["record_type"] == "trial" for r in records)
    assert overview["data_mode"] == "synthetic_demo"
    assert overview["open_safety_events"] is None
    assert overview["agent_tasks_running"] is None


def test_graph_filter_counts_and_records(client):
    result = client.get(BASE + "/evidence-map", params={"clinical_area": "Heart failure"}).json()
    assert result["graph"]["total_records"] == 1
    assert result["graph"]["data_mode"] == "synthetic_demo"
    assert result["graph"]["nodes"] and result["graph"]["edges"]
    for edge in result["graph"]["edges"]:
        assert edge["value"] == 1
        assert edge["evidence_ids"] == ["demo-trial-hf"]


def test_unmatched_search_is_empty(client):
    result = client.get(BASE + "/evidence-map", params={"query": "zzznomatchzzz"}).json()
    assert result["graph"]["total_records"] == 0
    assert result["graph"]["nodes"] == []
    assert result["graph"]["edges"] == []


def test_record_detail_source_snapshot_and_history(client):
    result = client.get(BASE + "/records/demo-trial-cad").json()
    record = result["record"]
    assert record["data_mode"] == "synthetic_demo"
    assert record["source_identifier"].startswith("DEMO-")
    assert record["human_verified"] is False
    assert record["source_version_hash"] == compute_content_sha256(record["provenance"]["raw_snapshot"])
    assert len(result["history"]) == 1
    assert client.get(BASE + "/records/unknown").status_code == 404


def test_trial_search_and_missing_results(client):
    trials = client.get(BASE + "/trials").json()
    assert len(trials) == 2
    assert all(r["record_type"] == "trial" for r in trials)
    filtered = client.get(BASE + "/trials", params={"query": "SGLT2"}).json()
    assert [r["id"] for r in filtered] == ["demo-trial-hf"]
    assert filtered[0]["trial_metadata"]["reported_results"] is None
    assert client.get(BASE + "/trials", params={"query": "zzznomatchzzz"}).json() == []


def test_pipeline_counts_and_empty_safety(client):
    pipeline = client.get(BASE + "/pipeline").json()
    assert pipeline
    assert all(item["evidence_count"] > 0 for item in pipeline)
    assert client.get(BASE + "/safety").json() == []


def test_research_task_trace_and_passport(client):
    response = client.post(BASE + "/copilot", json={"query": "coronary"})
    assert response.status_code == 200
    brief = response.json()
    assert brief["query"] == "coronary"
    assert len(brief["evidence_citations"]) == 2
    assert len(brief["passport_hash"]) == 64
    assert brief["verified"] is False
    assert "synthetic" in brief["summary_response"].lower()
    tasks = client.get(BASE + "/agents").json()
    assert tasks["tasks"] and tasks["trace_logs"]
    assert all(t["status"] != "running" for t in tasks["tasks"])
    result = client.get(BASE + "/passport/verify", params={"hash": brief["passport_hash"]}).json()
    assert result["integrity_check"] == "PASSED"
    assert result["tamper_detected"] is False


@pytest.mark.parametrize("query", ["", "   ", "x" * 2001])
def test_invalid_input_before_execution(client, query):
    assert client.post(BASE + "/copilot", json={"query": query}).status_code == 422
    assert client.get(BASE + "/agents").json()["tasks"] == []


def test_unknown_hash_never_verifies(client):
    result = client.get(BASE + "/passport/verify", params={"hash": "a" * 64}).json()
    assert result["integrity_check"] == "NOT_FOUND"
    assert result["verified"] is False
    assert result["tamper_detected"] is None
    assert client.get(BASE + "/passport/verify", params={"hash": "invalid"}).status_code == 422


@pytest.mark.parametrize(("method", "path", "body"), [
    ("post", "/copilot", {"query": "coronary"}),
    ("get", "/agents", None),
    ("get", "/passport/verify?hash=" + "a" * 64, None),
])
def test_research_routes_require_auth(client, method, path, body):
    app.dependency_overrides.pop(get_current_user, None)
    response = client.request(method, BASE + path, **({"json": body} if body else {}))
    assert response.status_code in (401, 403)


def test_other_owner_and_tenant_cannot_read_artifacts(client):
    brief = client.post(BASE + "/copilot", json={"query": "coronary"}).json()
    for owner, organization in [("researcher-b", "org-a"), ("researcher-a", "org-b")]:
        app.dependency_overrides[get_current_user] = lambda u=owner, o=organization: {"id": u, "organization_id": o, "role": "admin"}
        assert client.get(BASE + "/agents").json()["tasks"] == []
        result = client.get(BASE + "/passport/verify", params={"hash": brief["passport_hash"]}).json()
        assert result["verified"] is False
        assert result["integrity_check"] == "NOT_FOUND"


def test_exported_passport_tamper_detected(client):
    brief = client.post(BASE + "/copilot", json={"query": "coronary"}).json()
    exported = client.get(BASE + "/passport/" + brief["passport_hash"]).json()
    assert exported["passport_hash"] == compute_content_sha256(exported["payload"])
    assert client.post(BASE + "/passport/verify", json=exported).json()["integrity_check"] == "PASSED"
    changed = deepcopy(exported)
    changed["payload"]["query"] = "tampered"
    result = client.post(BASE + "/passport/verify", json=changed).json()
    assert result["integrity_check"] == "FAILED"
    assert result["tamper_detected"] is True


def test_mapping_review_requires_role_curator_organization_and_current_snapshot(client, monkeypatch):
    detail = client.get(BASE + "/records/demo-trial-cad").json()
    payload = {"decision": "approve", "expected_snapshot_hash": detail["history"][-1]["snapshot_hash"],
               "rationale": "Inspected the fixture category definitions; source remains synthetic."}
    path = BASE + "/records/demo-trial-cad/mapping-review"
    assert client.post(path, json=payload).status_code == 403
    app.dependency_overrides[get_current_user] = lambda: {"id": "reviewer-a", "organization_id": "org-a", "role": "reviewer"}
    assert client.post(path, json=payload).status_code == 403
    monkeypatch.setattr(settings, "CARDIOTWIN_GLOBAL_CURATOR_ORGS", "org-a")
    result = client.post(path, json=payload)
    assert result.status_code == 200
    assert result.json()["record"]["mapping_status"] == "verified"
    assert result.json()["record"]["quality"]["risk_of_bias"] == "not_assessed"
    assert client.post(path, json=payload).status_code == 409
    versions = client.get(BASE + "/records/demo-trial-cad").json()["history"]
    assert len(versions) == 2
    assert versions[0]["record"]["mapping_status"] == "proposed"
    assert versions[1]["parent_hash"] == versions[0]["snapshot_hash"]

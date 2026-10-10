"""Public research corpus reads and authenticated owner-scoped research artifacts."""
from __future__ import annotations

from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.auth import get_current_user
from app.cardiotwin.agents.orchestrator import ResearchExecutionError, now
from app.cardiotwin.analytics.global_service import (
    CardioGlobalService,
    public_record_projection,
    verify_research_artifact,
)
from app.cardiotwin.analytics.repository import IdempotencyConflict
from app.cardiotwin.evidence.passport import canonical_json_bytes, compute_content_sha256
from app.config import settings

router = APIRouter(prefix="/cardiotwin/global", tags=["cardiotwin-global"])
service = CardioGlobalService()


def owner_scope(user: dict[str, Any] = Depends(get_current_user)) -> str:
    if not user.get("id") or not user.get("organization_id"):
        raise HTTPException(403, "Authenticated research owner and organization are required")
    return compute_content_sha256({"organization_id": str(user["organization_id"]), "user_id": str(user["id"])})


def filters(query: str | None = Query(None, max_length=2000), clinical_area: str | None = Query(None, max_length=200),
            modality: str | None = Query(None, max_length=200), task_category: str | None = Query(None, max_length=200),
            validation_grade: str | None = Query(None, max_length=200), intervention: str | None = Query(None, max_length=200),
            study_type: str | None = Query(None, max_length=200), date_from: date | None = None, date_to: date | None = None) -> dict[str, Any]:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Source date range is reversed")
    return {"query": query, "clinical_area": clinical_area, "modality": modality, "task_category": task_category,
            "validation_grade": validation_grade, "intervention": intervention, "study_type": study_type,
            "date_from": date_from.isoformat() if date_from else None, "date_to": date_to.isoformat() if date_to else None}


class ResearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=1, max_length=2000)
    idempotency_key: str | None = Field(None, min_length=1, max_length=120)

    @field_validator("query")
    @classmethod
    def nonempty_query(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Research question cannot be blank")
        return value.strip()


class PassportArtifact(BaseModel):
    model_config = ConfigDict(extra="forbid")
    passport_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    payload: dict[str, Any]


class MappingReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["approve", "reject"]
    expected_snapshot_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    rationale: str = Field(min_length=5, max_length=1000)


@router.post("/records/{record_id}/mapping-review")
def review_mapping(record_id: str, payload: MappingReviewRequest,
                   user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if user.get("role") not in {"reviewer", "admin"}:
        raise HTTPException(403, "Reviewer permission is required for mapping decisions")
    curator_orgs = {item.strip() for item in settings.CARDIOTWIN_GLOBAL_CURATOR_ORGS.split(",") if item.strip()}
    if str(user.get("organization_id")) not in curator_orgs:
        raise HTTPException(403, "Shared public mapping review requires a designated curator organization")
    scope = owner_scope(user)
    if len(payload.rationale.strip()) < 5:
        raise HTTPException(422, "An inspectable mapping review rationale is required")
    try:
        result = service.repository.review_mapping(record_id, payload.expected_snapshot_hash,
            payload.decision, payload.rationale.strip(), scope, now())
        result["record"] = public_record_projection(result["record"])
        return result
    except KeyError as exc:
        raise HTTPException(404, "Research record not found") from exc
    except IdempotencyConflict as exc:
        raise HTTPException(409, "Record changed; inspect the latest version before review") from exc


@router.get("/overview")
def get_overview() -> dict[str, Any]:
    return service.get_overview_metrics()


@router.get("/evidence-map")
def get_evidence_map(selected: dict[str, Any] = Depends(filters)) -> dict[str, Any]:
    return service.get_evidence_map(**selected)


@router.get("/records")
def get_records(selected: dict[str, Any] = Depends(filters), limit: int = Query(100, ge=1, le=500),
                offset: int = Query(0, ge=0)) -> dict[str, Any]:
    return service.records_page(limit, offset, **selected)


@router.get("/records/export")
def export_records(selected: dict[str, Any] = Depends(filters)) -> dict[str, Any]:
    page = service.records_page(500, 0, **selected)
    return {"schema_version": "cardiotwin-record-export-v1", "exported_at": now(), "filters": selected,
            "truncated": page["total"] > 500, **page}


@router.get("/records/{record_id}")
def get_record(record_id: str) -> dict[str, Any]:
    result = service.get_record(record_id)
    if result is None:
        raise HTTPException(404, "Research record not found")
    return result


@router.post("/copilot")
def ask_copilot(payload: ResearchRequest, scope: str = Depends(owner_scope)) -> dict[str, Any]:
    try:
        return service.ask_copilot(payload.query, scope, payload.idempotency_key)
    except IdempotencyConflict as exc:
        raise HTTPException(409, "Idempotency key is bound to different research inputs") from exc
    except ResearchExecutionError as exc:
        raise HTTPException(503, {"code": exc.code, "task_id": exc.task_id, "message": "Research task failed or remains in progress; inspect its persisted trace."}) from exc


@router.get("/trials")
def get_trials(query: str | None = Query(None, max_length=2000), phase: str | None = Query(None, max_length=200),
               indication: str | None = Query(None, max_length=200)) -> list[dict[str, Any]]:
    return service.get_clinical_trials(query, phase, indication)


@router.get("/pipeline")
def get_pipeline() -> list[dict[str, Any]]:
    return service.get_pipeline_intelligence()


@router.get("/safety")
def get_safety() -> list[dict[str, Any]]:
    return service.get_safety_intelligence()


@router.get("/agents")
def get_agents(scope: str = Depends(owner_scope)) -> dict[str, Any]:
    return {"agents": service.orchestrator.get_agent_registry(scope), "tasks": service.orchestrator.get_tasks(scope),
            "trace_logs": service.orchestrator.get_trace_logs(scope=scope)}


@router.get("/tasks/{task_id}")
def get_task(task_id: str, scope: str = Depends(owner_scope)) -> dict[str, Any]:
    task = service.repository.task(task_id, scope)
    if task is None:
        raise HTTPException(404, "Research task not found")
    return task | {"trace_logs": service.repository.traces(scope, task_id)}


@router.get("/passport/verify")
def verify_passport(hash: str = Query(..., pattern=r"^[a-f0-9]{64}$"), scope: str = Depends(owner_scope)) -> dict[str, Any]:
    return service.verify_passport(hash, scope) | {"verified_at": now()}


@router.post("/passport/verify")
def verify_supplied_passport(artifact: PassportArtifact, scope: str = Depends(owner_scope)) -> dict[str, Any]:
    data = artifact.model_dump(mode="json")
    try:
        if len(canonical_json_bytes(data)) > 5_000_000:
            raise HTTPException(413, "Research passport exceeds supported size")
    except ValueError as exc:
        raise HTTPException(422, "Passport must contain finite JSON primitives") from exc
    return verify_research_artifact(data) | {"verified_at": now()}


@router.get("/passport/{digest}")
def get_passport(digest: str, scope: str = Depends(owner_scope)) -> dict[str, Any]:
    payload = service.repository.passport(digest, scope)
    if payload is None:
        raise HTTPException(404, "Research passport not found")
    return {"passport_hash": digest, "payload": payload}

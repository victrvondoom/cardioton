"""Authenticated upload → review → reference anatomy APIs (isolated additive router)."""

from __future__ import annotations

import json
from collections.abc import Callable, Coroutine
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.routing import APIRoute
from pydantic import AwareDatetime, Field, ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile

from app.auth import get_current_user
from app.cardiotwin.anatomy import repository
from app.cardiotwin.anatomy.core__cardiotwin_anatomy__models import ReviewRequest, StrictModel
from app.cardiotwin.anatomy.core__cardiotwin_anatomy__service import (
    LIMITATIONS,
    apply_review,
    build_report,
    export_passport,
    project_report,
)
from app.cardiotwin.anatomy.core__cardiotwin_anatomy__validation import MAX_BYTES
from app.cardiotwin.hemodynamics.core__cardiotwin_hemodynamics__fhir import parse_time


class BoundedReportRoute(APIRoute):
    """Enforce total multipart size while streaming, before form parsing."""

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        handler = super().get_route_handler()

        async def bounded(request: Request) -> Response:
            limit = MAX_BYTES + 64 * 1024 if request.url.path.endswith("/reports") else 32_768
            if request.method == "POST":
                declared = request.headers.get("content-length")
                if declared is not None:
                    try:
                        length = int(declared)
                    except ValueError as exc:
                        raise HTTPException(422, "Invalid Content-Length") from exc
                    if length > limit:
                        raise HTTPException(413, "Cardiovascular report request exceeds size limit")
                received = 0
                original_receive = request.receive

                async def receive() -> Any:
                    nonlocal received
                    message = await original_receive()
                    received += len(message.get("body", b""))
                    if received > limit:
                        raise HTTPException(413, "Cardiovascular report request exceeds size limit")
                    return message

                request._receive = receive
            response = await handler(request)
            response.headers["Cache-Control"] = "no-store"
            return response

        return bounded


router = APIRouter(prefix="/cardiotwin/anatomy", tags=["cardiovascular-reports"], route_class=BoundedReportRoute)
AuthenticatedUser = Annotated[dict[str, Any], Depends(get_current_user)]


class UploadMetadata(StrictModel):
    case_ref: str = Field(min_length=1, max_length=180, pattern=r"^[\w./:@ -]+$")
    patient_ref: str = Field(min_length=1, max_length=180, pattern=r"^[\w./:@ -]+$")
    synthetic: bool = False
    study_at: AwareDatetime | None = None


def _identity(user: dict[str, Any]) -> tuple[str, str]:
    org, owner = str(user.get("organization_id", "")), str(user.get("id", ""))
    if not org or not owner:
        raise HTTPException(403, "Authenticated organization and user ownership are required")
    return org, owner


def _as_of(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        return parse_time(value)
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, "as_of requires an ISO timestamp with timezone") from exc


def _validation(exc: ValidationError) -> HTTPException:
    errors = [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors(include_input=False, include_context=False)]
    return HTTPException(422, {"error": "Invalid cardiovascular report contract", "problems": errors})


@router.post("/reports", status_code=201)
async def upload_report(request: Request, user: AuthenticatedUser) -> dict[str, Any]:
    org, owner = _identity(user)
    if not request.headers.get("content-type", "").startswith("multipart/form-data"):
        raise HTTPException(415, "Report upload requires multipart/form-data")
    async with request.form(max_files=1, max_fields=4) as form:
        file = form.get("file")
        if not isinstance(file, UploadFile):
            raise HTTPException(422, "A single report file is required")
        if len(form.getlist("file")) != 1 or any(len(form.getlist(k)) != 1 for k in form):
            raise HTTPException(422, "Duplicate upload fields are not accepted")
        try:
            metadata = UploadMetadata.model_validate({k: v for k, v in form.items() if k != "file"})
        except ValidationError as exc:
            raise _validation(exc) from exc
        storage = repository.require_storage(metadata.synthetic)
        data = await file.read(MAX_BYTES + 1)
        report = await run_in_threadpool(build_report, data,
            filename=file.filename or "report", media_type=file.content_type or "",
            case_ref=metadata.case_ref.strip(), patient_ref=metadata.patient_ref.strip(),
            organization_id=org, owner_user_id=owner, synthetic=metadata.synthetic,
            storage_mode=storage, study_at=metadata.study_at)
    return (await repository.save(report)).model_dump(mode="json")


@router.get("/reports")
async def reports(user: AuthenticatedUser, case_ref: str, as_of: str | None = None) -> dict[str, Any]:
    if not case_ref.strip() or len(case_ref) > 180:
        raise HTTPException(422, "case_ref is required and limited to 180 characters")
    org, owner = _identity(user)
    boundary = _as_of(as_of)
    rows = await repository.list_reports(org, owner, case_ref)
    visible = [v for row in rows if (v := project_report(row, boundary)) is not None]
    return {"reports": [r.model_dump(mode="json") for r in visible], "as_of": boundary.isoformat() if boundary else None, "storage_mode": repository.mode(), "limitations": LIMITATIONS}


@router.get("/reports/{report_id}")
async def report_detail(report_id: str, user: AuthenticatedUser, as_of: str | None = None) -> dict[str, Any]:
    org, owner = _identity(user)
    report = project_report(await repository.get(org, owner, report_id), _as_of(as_of))
    if report is None:
        raise HTTPException(404, "Report not available at this replay boundary")
    return report.model_dump(mode="json")


@router.post("/reports/{report_id}/review")
async def review_report(report_id: str, request: Request, user: AuthenticatedUser) -> dict[str, Any]:
    org, owner = _identity(user)
    if user.get("role") not in ("reviewer", "admin"):
        raise HTTPException(403, "Requires reviewer or admin role")
    try:
        payload = ReviewRequest.model_validate(json.loads(await request.body()))
    except (ValueError, RecursionError) as exc:
        if isinstance(exc, ValidationError):
            raise _validation(exc) from exc
        raise HTTPException(422, "Expected a bounded review JSON object") from exc
    report = await repository.get(org, owner, report_id)
    reviewed = apply_review(report, payload, owner)
    return (await repository.save(reviewed, expected=payload.expected_version)).model_dump(mode="json")


@router.get("/reports/{report_id}/passport")
async def report_passport(report_id: str, user: AuthenticatedUser, as_of: str | None = None) -> dict[str, Any]:
    org, owner = _identity(user)
    report = await repository.get(org, owner, report_id)
    return await run_in_threadpool(export_passport, report, owner, _as_of(as_of))


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str, user: AuthenticatedUser) -> dict[str, Any]:
    org, owner = _identity(user)
    await repository.delete(org, owner, report_id, datetime.now(UTC).isoformat())
    return {"deleted": True, "id": report_id, "retained_audit": "Report id, authenticated tenant/user and erasure timestamp only; downloaded exports and database backups require their own retention controls"}

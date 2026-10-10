"""Authenticated, stateless hemodynamic APIs; no approval or record mutation."""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import AwareDatetime, Field, ValidationError
from starlette.concurrency import run_in_threadpool

from app.auth import get_current_user
from app.oncotwin.observability import METRICS
from app.onehealth.passport import digest

from .counterfactual import (
    PARAMETER_BOUNDS,
    compare_scenarios,
    finite_difference_sensitivity,
    parameter_sweep,
)
from .fhir import parse_time
from .schema import ReconstructionRequest, StrictModel
from .service import demo_result, from_fhir, request_result, snapshot_passport

router = APIRouter(prefix="/hemo", tags=["cardio-hemo-twin"])
log = structlog.get_logger()
AuthenticatedUser = Annotated[dict[str, Any], Depends(get_current_user)]


class FhirRequest(StrictModel):
    bundle: dict[str, Any]
    patient_ref: str | None = Field(default=None, max_length=180)
    as_of: AwareDatetime
    received_at: AwareDatetime | None = None


async def _body(request: Request, model: type[StrictModel]) -> Any:
    # Validation output includes paths/reasons, never submitted raw records.
    raw = await request.body()
    if len(raw) > 2_000_000:
        raise HTTPException(413, "Reconstruction exceeds 2 MB request limit")
    try:
        payload = json.loads(raw)
    except (ValueError, RecursionError) as exc:
        raise HTTPException(422, "Expected a JSON object") from exc
    try:
        return model.model_validate(payload)
    except ValidationError as exc:
        errors = [
            {"loc": list(e["loc"]), "type": e["type"], "msg": e["msg"]}
            for e in exc.errors(include_input=False, include_context=False)
        ]
        raise HTTPException(
            422, {"error": "Invalid evidence contract", "problems": errors}
        ) from exc


def _as_of(value: str | None) -> datetime | None:
    try:
        return parse_time(value) if value is not None else None
    except (ValueError, ValidationError) as exc:
        raise HTTPException(422, "as_of requires an ISO timestamp with timezone") from exc


def _trace(result: dict[str, Any], start: float) -> dict[str, Any]:
    METRICS.inc("cardio_hemo_reconstructions_total")
    METRICS.observe_ms("cardio_hemo_reconstruct_ms", (time.perf_counter() - start) * 1000)
    log.info(
        "cardio_hemo.reconstruct",
        engine_version=result["engine_version"],
        input_sha256=digest(result["evidence"]),
        evidence_count=len(result["evidence"]),
        transition_count=len(result["transitions"]),
        clinical_approval=False,
    )
    return result


def _fhir_result(body: FhirRequest) -> dict[str, Any]:
    return from_fhir(
        body.bundle,
        as_of=body.as_of,
        patient_ref=body.patient_ref,
        received_at=body.received_at or datetime.now(UTC),
    )


@router.get("/demo")
async def demo(_: AuthenticatedUser, as_of: str | None = None) -> dict[str, Any]:
    start = time.perf_counter()
    return _trace(await run_in_threadpool(demo_result, _as_of(as_of)), start)


@router.post("/reconstruct")
async def reconstruct_api(request: Request, _: AuthenticatedUser) -> dict[str, Any]:
    body = await _body(request, ReconstructionRequest)
    start = time.perf_counter()
    try:
        return _trace(await run_in_threadpool(request_result, body), start)
    except ValueError as exc:
        raise HTTPException(422, "Conflicting evidence identity; reconstruction rejected") from exc


@router.post("/fhir")
async def fhir_api(request: Request, _: AuthenticatedUser) -> dict[str, Any]:
    body = await _body(request, FhirRequest)
    start = time.perf_counter()
    try:
        result = await run_in_threadpool(_fhir_result, body)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return _trace(result, start)


@router.post("/fhir/passport")
async def fhir_passport_api(request: Request, user: AuthenticatedUser) -> dict[str, Any]:
    """Retain FHIR intake issues and mapping context in the exported artifact."""
    body = await _body(request, FhirRequest)
    try:
        result = await run_in_threadpool(_fhir_result, body)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return await run_in_threadpool(
        snapshot_passport,
        result,
        actor=str(user["id"]),
        organization_id=str(user["organization_id"]),
    )


@router.post("/passport")
async def passport_api(request: Request, user: AuthenticatedUser) -> dict[str, Any]:
    body = await _body(request, ReconstructionRequest)
    try:
        result = await run_in_threadpool(request_result, body)
    except ValueError as exc:
        raise HTTPException(422, "Conflicting evidence identity; snapshot rejected") from exc
    return await run_in_threadpool(
        snapshot_passport,
        result, actor=str(user["id"]), organization_id=str(user["organization_id"])
    )


@router.get("/demo/passport")
async def demo_passport(user: AuthenticatedUser, as_of: str | None = None) -> dict[str, Any]:
    return await run_in_threadpool(
        snapshot_passport,
        await run_in_threadpool(demo_result, _as_of(as_of)),
        actor=str(user["id"]),
        organization_id=str(user["organization_id"]),
    )


# ───────── Counterfactual Hemodynamic Laboratory ──────────

class SweepRequest(StrictModel):
    vessel_id: str = Field(default="LAD", max_length=10)
    sweep_param: str = Field(max_length=80)
    sweep_min: float | None = None
    sweep_max: float | None = None
    sweep_steps: int = Field(default=10, ge=3, le=50)
    baseline_params: dict[str, float] = Field(default_factory=dict)


class SensitivityRequest(StrictModel):
    vessel_id: str = Field(default="LAD", max_length=10)
    baseline_params: dict[str, float] = Field(default_factory=dict)
    target_output: str = Field(default="ffr", max_length=60)
    perturbation_fraction: float = Field(default=0.01, gt=0, le=0.1)


class ScenarioCompareRequest(StrictModel):
    vessel_id: str = Field(default="LAD", max_length=10)
    baseline_params: dict[str, float] = Field(default_factory=dict)
    intervention_params: dict[str, float] = Field(default_factory=dict)


@router.get("/counterfactual/parameters")
async def list_parameters(_: AuthenticatedUser) -> dict[str, Any]:
    """List all tunable parameters with physiological bounds."""
    return {"parameters": PARAMETER_BOUNDS}


@router.post("/counterfactual/sweep")
async def sweep_endpoint(request: Request, _: AuthenticatedUser) -> dict[str, Any]:
    """Sweep a single parameter across a range and observe output changes."""
    body = await _body(request, SweepRequest)
    bounds = PARAMETER_BOUNDS.get(body.sweep_param)
    if bounds is None:
        raise HTTPException(422, f"Unknown sweep parameter: {body.sweep_param}")

    lo = body.sweep_min if body.sweep_min is not None else bounds["min"]
    hi = body.sweep_max if body.sweep_max is not None else bounds["max"]
    step = (hi - lo) / max(1, body.sweep_steps - 1)
    values = [round(lo + i * step, 6) for i in range(body.sweep_steps)]

    result = await run_in_threadpool(
        parameter_sweep, body.vessel_id, body.sweep_param, values, body.baseline_params
    )
    if "error" in result:
        raise HTTPException(422, result["error"])
    return result


@router.post("/counterfactual/sensitivity")
async def sensitivity_endpoint(request: Request, _: AuthenticatedUser) -> dict[str, Any]:
    """Compute local finite-difference sensitivities of outputs w.r.t. all inputs."""
    body = await _body(request, SensitivityRequest)
    result = await run_in_threadpool(
        finite_difference_sensitivity,
        body.vessel_id,
        body.baseline_params,
        body.target_output,
        body.perturbation_fraction,
    )
    return dict(result)


@router.post("/counterfactual/compare")
async def compare_endpoint(request: Request, _: AuthenticatedUser) -> dict[str, Any]:
    """Side-by-side comparison of baseline vs intervention hemodynamic states."""
    body = await _body(request, ScenarioCompareRequest)
    return await run_in_threadpool(
        compare_scenarios, body.vessel_id, body.baseline_params, body.intervention_params
    )

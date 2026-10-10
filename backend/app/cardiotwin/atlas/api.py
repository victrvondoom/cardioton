"""Authenticated bounded APIs, using the existing CardioTwin boundary."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from app.cardiotwin.hemodynamics.api import AuthenticatedUser, _as_of, _body
from app.cardiotwin.hemodynamics.demo import DEMO_END

from .copilot import assist
from .schema import AtlasInput, ExplainRequest, ScenarioRequest
from .service import explain, passport, provider_catalog, reconstruct_atlas, sandbox

router = APIRouter(prefix="/atlas", tags=["cardiotwin-atlas"])


async def _run(function: Any, *args: Any, **kwargs: Any) -> dict[str, Any]:
    try:
        return await run_in_threadpool(function, *args, **kwargs)
    except (ValueError, OverflowError, RecursionError) as exc:
        # Do not echo raw records, patient identifiers, locations or source text.
        raise HTTPException(
            422,
            "Atlas evidence contract rejected; check identities, units, timestamps and scenario bounds",
        ) from exc


@router.get("/demo")
async def demo(_: AuthenticatedUser, as_of: str | None = None) -> dict[str, Any]:
    cutoff = _as_of(as_of or DEMO_END)
    assert cutoff is not None
    return await _run(reconstruct_atlas, AtlasInput(as_of=cutoff, demo=True))


@router.get("/providers")
async def providers(_: AuthenticatedUser) -> dict[str, Any]:
    return provider_catalog()


@router.post("/reconstruct")
async def reconstruct_api(request: Request, _: AuthenticatedUser) -> dict[str, Any]:
    return await _run(reconstruct_atlas, await _body(request, AtlasInput))


@router.post("/scenarios")
async def scenario_api(request: Request, _: AuthenticatedUser) -> dict[str, Any]:
    return await _run(sandbox, await _body(request, ScenarioRequest))


@router.post("/explain")
async def explain_api(request: Request, user: AuthenticatedUser) -> dict[str, Any]:
    body = await _body(request, ExplainRequest)
    answer = await _run(explain, body)
    return await assist(body, answer, user)


@router.post("/passport")
async def passport_api(request: Request, user: AuthenticatedUser) -> dict[str, Any]:
    return await _run(
        passport,
        await _body(request, AtlasInput),
        actor=str(user["id"]),
        organization_id=str(user["organization_id"]),
    )

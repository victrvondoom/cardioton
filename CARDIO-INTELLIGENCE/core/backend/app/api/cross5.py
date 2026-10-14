"""CROSS-5 API — five-frame multiscale cardiovascular intelligence (additive router).

All endpoints are auth-gated and read-mostly. Simulation and analysis endpoints
are deterministic; the environmental endpoint reuses the bounded Open-Meteo
adapters and reports provider unavailability honestly.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.cardiotwin.cross5 import (
    chronos,
    city,
    earth,
    frames,
    intersections,
    microphysics,
)
from app.cardiotwin.cross5 import (
    core__cardiotwin_cross5__experiments as experiments,
)
from app.cardiotwin.environment import service as environment_service

router = APIRouter(prefix="/cross5", tags=["cross5"])

Auth = Depends(get_current_user)


class FlowSimulateRequest(BaseModel):
    vessel_id: str = Field(pattern=r"^(LAD|LCX|RCA)$")
    stenosis_pct: float = Field(ge=0, le=95)
    lesion_center_mm: float | None = Field(default=None, ge=0)
    systolic_mmhg: float = Field(default=70, le=220)
    diastolic_mmhg: float = Field(default=30, le=160)
    time_samples: int = Field(default=80, ge=8, le=400)
    centreline_samples: int = Field(default=48, ge=8, le=200)


class ChronosReplayRequest(BaseModel):
    scenario: str = "normal"
    hours: float = Field(default=48, ge=1, le=336)
    as_of: datetime


class CityScenarioRequest(BaseModel):
    from_node: str | None = None
    closed_edges: list[tuple[str, str]] = Field(default_factory=list, max_length=20)
    added_facility: dict[str, Any] | None = None


@router.get("/frames")
async def frame_registry(_: dict[str, Any] = Auth) -> dict[str, Any]:
    return frames.frame_registry()


@router.get("/intersections")
async def declared_intersections(
    frames_param: str = Query(..., alias="frames", description="Comma-separated frame ids"),
    _: dict[str, Any] = Auth,
) -> dict[str, Any]:
    selected = [f.strip() for f in frames_param.split(",") if f.strip()]
    valid = {f["id"] for f in frames.FRAMES.values()}
    unknown = [f for f in selected if f not in valid]
    if unknown:
        raise HTTPException(422, f"Unknown frames: {', '.join(unknown)}")
    if not selected:
        raise HTTPException(422, "Select at least one frame")
    return intersections.available_intersections(selected)


@router.get("/flow/vessels")
async def flow_vessels(_: dict[str, Any] = Auth) -> dict[str, Any]:
    return microphysics.vessel_catalog()


@router.post("/flow/simulate")
async def flow_simulate(request: FlowSimulateRequest, _: dict[str, Any] = Auth) -> dict[str, Any]:
    try:
        return microphysics.simulate_vessel(
            request.vessel_id,
            request.stenosis_pct,
            lesion_center_mm=request.lesion_center_mm,
            systolic_mmhg=request.systolic_mmhg,
            diastolic_mmhg=request.diastolic_mmhg,
            time_samples=request.time_samples,
            centreline_samples=request.centreline_samples,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/flow/compare")
async def flow_compare(
    body: dict[str, Any],
    _: dict[str, Any] = Auth,
) -> dict[str, Any]:
    vessel_id = body.get("vessel_id")
    values = body.get("stenosis_values", [])
    if vessel_id not in {"LAD", "LCX", "RCA"}:
        raise HTTPException(422, "vessel_id must be LAD, LCX or RCA")
    if not isinstance(values, list) or not values or len(values) > 20:
        raise HTTPException(422, "stenosis_values must be a non-empty list (max 20)")
    try:
        return microphysics.compare_scenarios(vessel_id, [float(v) for v in values])
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get("/chronos/timeline")
async def chronos_timeline(
    scenario: str = "normal",
    hours: float = Query(default=48, ge=1, le=336),
    _: dict[str, Any] = Auth,
) -> dict[str, Any]:
    try:
        timeline = chronos.synthetic_timeline(scenario, hours=hours)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {**timeline, "alignment": chronos.align_bands(timeline)}


@router.post("/chronos/replay")
async def chronos_replay(request: ChronosReplayRequest, _: dict[str, Any] = Auth) -> dict[str, Any]:
    try:
        timeline = chronos.synthetic_timeline(request.scenario, hours=request.hours)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return chronos.replay(timeline, request.as_of)


@router.get("/earth/countries")
async def earth_countries(_: dict[str, Any] = Auth) -> dict[str, Any]:
    return earth.countries()


@router.get("/earth/countries/{iso}")
async def earth_country(iso: str, _: dict[str, Any] = Auth) -> dict[str, Any]:
    profile = earth.country_profile(iso)
    if profile is None:
        raise HTTPException(404, f"Country {iso} is not in the committed snapshot")
    return profile


@router.get("/earth/environment")
async def earth_environment(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    day: date | None = None,
    _: dict[str, Any] = Auth,
) -> dict[str, Any]:
    try:
        return await earth.environment_context(latitude, longitude, day or earth.utc_today())
    except environment_service.ProviderUnavailableError as exc:
        raise HTTPException(
            503,
            detail={
                "reason": "environmental_provider_unavailable",
                "message": str(exc),
            },
        ) from exc


@router.get("/city")
async def city_view(_: dict[str, Any] = Auth) -> dict[str, Any]:
    graph = city.city_graph()
    return {**graph, "baseline_access": city.access_analysis()["city_wide"]}


@router.post("/city/access")
async def city_access(request: CityScenarioRequest, _: dict[str, Any] = Auth) -> dict[str, Any]:
    try:
        return city.access_analysis(
            request.from_node,
            closed_edges=request.closed_edges,
            added_facility=request.added_facility,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get("/experiments")
async def experiment_catalog(_: dict[str, Any] = Auth) -> dict[str, Any]:
    return {"experiments": experiments.EXPERIMENTS, "notice": experiments.EXPERIMENT_NOTICE}


@router.post("/experiments/{experiment_id}/run")
async def run_experiment(
    experiment_id: str,
    body: dict[str, Any] | None = None,
    _: dict[str, Any] = Auth,
) -> dict[str, Any]:
    try:
        return experiments.run_experiment(experiment_id, **(body or {}))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

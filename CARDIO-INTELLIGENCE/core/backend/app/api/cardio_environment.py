"""Authenticated, PHI-free public ambient context extension."""

from datetime import UTC, date, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_current_user
from app.cardiotwin.environment import service

router = APIRouter(
    prefix="/cardiotwin/environment",
    tags=["cardiotwin-environment"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/locations")
async def locations(q: str = Query(min_length=2, max_length=80)) -> dict[str, Any]:
    query = q.strip()
    if len(query) < 2 or any(ord(char) < 32 for char in q):
        raise HTTPException(422, "Supply a city or country name (2–80 printable characters).")
    try:
        return await service.locations(query)
    except service.ProviderUnavailableError as exc:
        raise HTTPException(503, str(exc)) from exc


@router.get("/observations")
async def observations(
    date: date,
    lat: float = Query(ge=-90, le=90, allow_inf_nan=False),
    lon: float = Query(ge=-180, le=180, allow_inf_nan=False),
) -> dict[str, Any]:
    try:
        return await service.observations(lat, lon, date)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get("/layer")
async def layer(
    date: date,
    variable: Literal["pm2_5", "pm10", "nitrogen_dioxide", "ozone"] = "pm2_5",
    lat: float = Query(ge=-90, le=90, allow_inf_nan=False),
    lon: float = Query(ge=-180, le=180, allow_inf_nan=False),
) -> dict[str, Any]:
    try:
        return await service.layer(lat, lon, date, variable, datetime.now(UTC))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except service.ProviderUnavailableError as exc:
        raise HTTPException(503, str(exc)) from exc

"""Ambient context normalization, auth, historical availability and provider failures."""

from __future__ import annotations

import copy
from datetime import UTC, date, datetime

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.cardio_environment import router
from app.auth import get_current_user
from app.cardiotwin.environment import service

DAY = date(2026, 8, 10)
NOW = datetime(2026, 10, 9, 12, tzinfo=UTC)
BASE = "/api/v1/cardiotwin/environment"


def source(day: date = DAY) -> dict:
    return {
        "latitude": 13.0,
        "longitude": 80.4,
        "utc_offset_seconds": 0,
        "hourly": {
            "time": [f"{day.isoformat()}T{hour:02}:00" for hour in range(24)],
            **{key: [float(10 + hour) for hour in range(24)] for key in service.VARIABLES},
        },
        "hourly_units": {key: value[1] for key, value in service.VARIABLES.items()},
    }


@pytest.fixture
def app():
    application = FastAPI()
    application.include_router(router, prefix="/api/v1")
    application.dependency_overrides[get_current_user] = lambda: {
        "id": "synthetic-user",
        "organization_id": "synthetic-org",
    }
    return application


@pytest.fixture(autouse=True)
def clear_cache():
    service.provider.clear()
    yield
    service.provider.clear()


def test_units_utc_complete_day_and_reference():
    payload = source()
    payload["hourly_units"]["pm2_5"] = "μg/m³"
    row = service.normalize(payload, ["pm2_5"], DAY, NOW, NOW)[0]
    assert row["unit"] == "µg/m³"
    assert row["points"][0] == {
        "time": "2026-08-10T00:00:00+00:00",
        "value": 10.0,
        "classification": "MODELLED",
    }
    assert row["summary"]["mean_24h"] == 21.5
    assert row["summary"]["reference"]["value"] == 15
    assert row["summary"]["reference"]["averaging_period"] == "24 hours (UTC day)"
    assert row["original_available_at"] is None
    assert row["original_availability"] == "UNKNOWN"
    assert row["ingested_at"] == NOW.isoformat()


@pytest.mark.parametrize(
    "issue",
    [
        "missing",
        "wrong_unit",
        "duplicate",
        "wrong_offset",
        "offset_stamp",
        "negative",
        "nonfinite",
        "bool",
    ],
)
def test_bad_data_never_fills_or_compares_a_partial_day(issue):
    payload = source()
    if issue == "missing":
        payload["hourly"]["pm2_5"][5] = None
    elif issue == "wrong_unit":
        payload["hourly_units"]["pm2_5"] = "mg/m³"
    elif issue == "duplicate":
        payload["hourly"]["time"][1] = payload["hourly"]["time"][0]
    elif issue == "wrong_offset":
        payload["utc_offset_seconds"] = 19800
    elif issue == "offset_stamp":
        payload["hourly"]["time"][0] = "2026-08-10T00:00:00+05:30"
    else:
        payload["hourly"]["pm2_5"][0] = {"negative": -1, "nonfinite": float("nan"), "bool": True}[
            issue
        ]
    row = service.normalize(payload, ["pm2_5"], DAY, NOW, NOW)[0]
    assert row["summary"]["hours_present"] < 24
    assert row["summary"]["mean_24h"] is None
    assert row["summary"]["reference"] is None
    assert len(row["points"]) == 24


def test_future_hours_are_forecast_and_not_compared_to_daily_guideline():
    payload = source(NOW.date())
    row = service.normalize(payload, ["pm2_5"], NOW.date(), NOW, NOW)[0]
    assert row["points"][11]["classification"] == "MODELLED"
    assert row["points"][13]["classification"] == "FORECAST"
    assert row["summary"]["hours_present"] == 24
    assert row["summary"]["mean_24h"] is None
    assert row["summary"]["reference"] is None


def test_ozone_has_no_invalid_24h_reference():
    row = service.normalize(source(), ["ozone"], DAY, NOW, NOW)[0]
    assert row["summary"]["mean_24h"] == 21.5
    assert row["summary"]["reference"] is None


@pytest.mark.asyncio
async def test_partial_provider_failure_retains_independent_weather(monkeypatch):
    calls = []

    async def get(url, params):
        calls.append((url, params))
        if url == service.AIR_URL:
            raise service.ProviderUnavailableError("Air provider unavailable")
        return source(), NOW, False

    monkeypatch.setattr(service.provider, "get", get)
    result = await service.observations(13.08, 80.27, DAY, NOW)
    assert result["sources"][0]["status"] == "unavailable"
    assert result["sources"][1]["status"] == "available"
    assert result["sources"][1]["endpoint"] == service.ARCHIVE_URL
    assert result["series"][0]["summary"]["hours_present"] == 0
    assert result["series"][4]["summary"]["hours_present"] == 24
    assert result["personal_exposure_established"] is False
    assert all("patient" not in repr(params) for _, params in calls)
    assert calls[1][1]["models"] == "era5"


@pytest.mark.asyncio
async def test_older_history_fetches_weather_only_without_fabricating_air(monkeypatch):
    calls = []
    old_day = date(2020, 1, 1)

    async def get(url, params):
        calls.append(url)
        return source(old_day), NOW, False

    monkeypatch.setattr(service.provider, "get", get)
    result = await service.observations(13, 80, old_day, NOW)
    assert calls == [service.ARCHIVE_URL]
    assert result["sources"][0]["status"] == "unavailable"
    assert "August 2022" in result["sources"][0]["error"]
    assert result["series"][0]["summary"]["hours_present"] == 0


@pytest.mark.asyncio
async def test_regional_layer_batches_only_nine_public_coordinates(monkeypatch):
    calls = []

    async def get(url, params):
        calls.append((url, params))
        return [source() for _ in range(9)], NOW, False

    monkeypatch.setattr(service.provider, "get", get)
    result = await service.layer(13, 179.8, DAY, "pm10", NOW)
    assert len(calls) == 1
    assert len(calls[0][1]["latitude"].split(",")) == 9
    assert len(result["samples"]) == 9
    assert all(-180 <= sample["longitude"] <= 180 for sample in result["samples"])
    assert result["samples"][0]["points"][0]["value"] == 10
    assert "illustrative" in result["note"]


@pytest.mark.asyncio
async def test_provider_cache_separates_coordinates_dates_and_providers(monkeypatch):
    calls = []
    original = httpx.AsyncClient

    def handle(request):
        calls.append(request)
        return httpx.Response(200, json=source())

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs),
    )
    adapter = service.Provider()
    params = {"latitude": 13, "longitude": 80, "start_date": "2026-08-10"}
    first = await adapter.get(service.AIR_URL, params)
    first[0]["hourly"]["pm2_5"][0] = 999  # Caller mutation cannot contaminate another response.
    second = await adapter.get(service.AIR_URL, params)
    assert first[2] is False and second[2] is True
    assert second[0]["hourly"]["pm2_5"][0] == 10
    assert first[1] == second[1]
    await adapter.get(service.AIR_URL, {**params, "latitude": 14})
    await adapter.get(service.AIR_URL, {**params, "start_date": "2026-08-11"})
    await adapter.get(service.WEATHER_URL, params)
    assert len(calls) == 4
    assert all("authorization" not in request.headers for request in calls)


@pytest.mark.asyncio
@pytest.mark.parametrize("status,expected", [(503, 2), (429, 1), (400, 1)])
async def test_provider_retries_are_bounded_and_failures_not_cached(monkeypatch, status, expected):
    original = httpx.AsyncClient
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(
            status, json={"reason": "untrusted upstream message and user details"}
        )

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs),
    )
    adapter = service.Provider()
    with pytest.raises(service.ProviderUnavailableError, match="no substitute") as exc:
        await adapter.get(service.AIR_URL, {"latitude": 13})
    assert len(calls) == expected
    assert not adapter.cache
    assert "untrusted" not in str(exc.value)


def test_routes_require_authentication(app):
    app.dependency_overrides.clear()
    with TestClient(app) as client:
        assert client.get(BASE + "/observations?lat=13&lon=80&date=2026-08-10").status_code == 401
        assert client.get(BASE + "/locations?q=Chennai").status_code == 401
        assert client.get(BASE + "/layer?lat=13&lon=80&date=2026-08-10").status_code == 401


@pytest.mark.parametrize(
    "query",
    [
        "lat=91&lon=80&date=2026-08-10",
        "lat=13&lon=-181&date=2026-08-10",
        "lat=nan&lon=80&date=2026-08-10",
        "lat=13&lon=inf&date=2026-08-10",
        "lat=13&lon=80&date=1899-01-01",
        "lat=13&lon=80&date=2099-01-01",
        "lat=13&lon=80&date=not-a-date",
    ],
)
def test_routes_validate_coordinates_and_dates(app, query):
    with TestClient(app) as client:
        assert client.get(BASE + "/observations?" + query).status_code == 422


def test_api_forwards_only_public_geo_and_date_not_auth_or_clinical_query(app, monkeypatch):
    received = []

    async def observe(lat, lon, day):
        received.append((lat, lon, day))
        return {"context_only": True}

    monkeypatch.setattr(service, "observations", observe)
    with TestClient(app) as client:
        response = client.get(
            BASE + "/observations?lat=13&lon=80&date=2026-08-10&patient_ref=secret-case",
            headers={"Authorization": "Bearer private-token"},
        )
    assert response.status_code == 200
    assert received == [(13.0, 80.0, DAY)]
    assert "private-token" not in response.text and "secret-case" not in response.text


@pytest.mark.asyncio
async def test_search_drops_invalid_coordinates_and_bounds_results(monkeypatch):
    rows = [
        {"id": 1, "name": "Chennai", "latitude": 13.08, "longitude": 80.27},
        {"id": 2, "name": "Invalid", "latitude": True, "longitude": 80},
        {"id": 3, "name": "Invalid", "latitude": float("inf"), "longitude": 80},
    ]

    async def get(url, params):
        assert url == service.GEOCODE_URL and params["count"] == 8
        return {"results": copy.deepcopy(rows)}, NOW, False

    monkeypatch.setattr(service.provider, "get", get)
    result = await service.locations("Chennai")
    assert len(result["results"]) == 1
    assert result["results"][0]["name"] == "Chennai"
    assert result["attribution"] == "Open-Meteo / GeoNames"


def test_search_bounds_and_provider_failure(app, monkeypatch):
    async def unavailable(query):
        raise service.ProviderUnavailableError("Location provider unavailable")

    monkeypatch.setattr(service, "locations", unavailable)
    with TestClient(app) as client:
        assert client.get(BASE + "/locations", params={"q": "x"}).status_code == 422
        assert client.get(BASE + "/locations", params={"q": "x" * 81}).status_code == 422
        assert client.get(BASE + "/locations", params={"q": "  "}).status_code == 422
        assert client.get(BASE + "/locations", params={"q": "\n\nChennai"}).status_code == 422
        assert client.get(BASE + "/locations", params={"q": "Chennai"}).status_code == 503

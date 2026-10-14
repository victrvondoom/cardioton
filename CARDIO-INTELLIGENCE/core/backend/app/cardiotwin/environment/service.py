"""Bounded Open-Meteo adapters with explicit model, UTC and availability provenance.

No request headers, user identifiers, clinical evidence or location histories are sent
upstream. Returned historical models are retrieved now, never historical clinical knowledge.
"""

from __future__ import annotations

import asyncio
import copy
import json
import math
import ssl
import threading
import time
from collections import OrderedDict, deque
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
AIR_DOC = "https://open-meteo.com/en/docs/air-quality-api"
WEATHER_DOC = "https://open-meteo.com/en/docs"
ARCHIVE_DOC = "https://open-meteo.com/en/docs/historical-weather-api"
WHO_DOC = "https://www.who.int/publications/i/item/9789240034228"
AIR_START = date(2022, 8, 1)
WEATHER_START = date(1940, 1, 1)
VARIABLES = {
    "pm2_5": ("PM2.5", "µg/m³", "air", 15.0),
    "pm10": ("PM10", "µg/m³", "air", 45.0),
    "nitrogen_dioxide": ("NO₂", "µg/m³", "air", 25.0),
    "ozone": ("O₃", "µg/m³", "air", None),
    "temperature_2m": ("Temperature", "°C", "weather", None),
    "relative_humidity_2m": ("Relative humidity", "%", "weather", None),
    "apparent_temperature": ("Apparent temperature", "°C", "weather", None),
}


class ProviderUnavailableError(Exception):
    """A provider failed; messages intentionally exclude upstream bodies and query strings."""


class Provider:
    """Per-process TTL/LRU cache and quota. Public coordinates are the complete key.

    Request counts are bounded below free-service limits. Multi-replica production
    deployments still require a shared quota and a commercial provider agreement.
    """

    def __init__(self) -> None:
        self.cache: OrderedDict[tuple[Any, ...], tuple[float, Any, datetime]] = OrderedDict()
        self.calls: deque[float] = deque()
        self.lock = threading.Lock()

    def clear(self) -> None:
        with self.lock:
            self.cache.clear()
            self.calls.clear()

    async def get(self, url: str, params: dict[str, Any]) -> tuple[Any, datetime, bool]:
        key = (url, *sorted(params.items()))
        clock = time.monotonic()
        with self.lock:
            cached = self.cache.get(key)
            if cached and clock - cached[0] < 600:
                self.cache.move_to_end(key)
                return copy.deepcopy(cached[1]), cached[2], True
        # Windows default trust includes its certificate store, while certifi alone
        # can reject institution-managed TLS chains. Verification stays enabled.
        trust = ssl.create_default_context()
        for attempt in range(2):
            with self.lock:
                while self.calls and clock - self.calls[0] >= 86400:
                    self.calls.popleft()
                if len(self.calls) >= 4500 or sum(clock - at < 60 for at in self.calls) >= 60:
                    raise ProviderUnavailableError(
                        "Local environmental provider budget reached; retry later."
                    )
                self.calls.append(clock)
            try:
                async with (
                    httpx.AsyncClient(
                        timeout=httpx.Timeout(6, connect=3),
                        verify=trust,
                        follow_redirects=False,
                        headers={"User-Agent": "CLINI-CASE-Environmental-Context/1.0"},
                    ) as client,
                    client.stream("GET", url, params=params) as response,
                ):
                    if response.status_code >= 500 and attempt == 0:
                        await asyncio.sleep(0.2)
                        clock = time.monotonic()
                        continue
                    response.raise_for_status()
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > 1_000_000:
                            raise ProviderUnavailableError(
                                "Environmental provider response exceeds size limit."
                            )
                    data = json.loads(body)
                    if (
                        not isinstance(data, dict | list)
                        or isinstance(data, dict)
                        and data.get("error")
                    ):
                        raise ProviderUnavailableError(
                            "Environmental provider returned an invalid response."
                        )
                    ingested = datetime.now(UTC)
                    with self.lock:
                        self.cache[key] = (time.monotonic(), copy.deepcopy(data), ingested)
                        self.cache.move_to_end(key)
                        while len(self.cache) > 256:
                            self.cache.popitem(last=False)
                    return data, ingested, False
            except (httpx.HTTPError, ValueError) as exc:
                if isinstance(exc, httpx.TransportError) and attempt == 0:
                    await asyncio.sleep(0.2)
                    clock = time.monotonic()
                    continue
                raise ProviderUnavailableError(
                    "Environmental provider unavailable or date unsupported; no substitute values were generated."
                ) from exc
        raise ProviderUnavailableError("Environmental provider unavailable.")


provider = Provider()


def validate_day(day: date, now: datetime) -> None:
    if day < WEATHER_START or day > now.date() + timedelta(days=4):
        raise ValueError("Choose a date from 1940-01-01 through four days after today (UTC).")


def _canonical_unit(unit: Any) -> str:
    return str(unit).replace("μ", "µ")


def _number(value: Any, key: str) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        return None
    if key in {"pm2_5", "pm10", "nitrogen_dioxide", "ozone"} and value < 0:
        return None
    if key == "relative_humidity_2m" and not 0 <= value <= 100:
        return None
    return float(value)


def normalize(
    data: dict[str, Any],
    keys: list[str],
    day: date,
    now: datetime,
    ingested: datetime | None,
) -> list[dict[str, Any]]:
    """Accept exact UTC hourly timestamps and known units; preserve null gaps.

    No interpolation or missing-value filling is done here. CAMS's own hourly
    interpolation from its native three-hourly global model is disclosed at source.
    """
    raw_hourly, raw_units = data.get("hourly"), data.get("hourly_units")
    hourly: dict[str, Any] = raw_hourly if isinstance(raw_hourly, dict) else {}
    units: dict[str, Any] = raw_units if isinstance(raw_units, dict) else {}
    times = hourly.get("time", [])
    index: dict[str, int] = {}
    duplicate: set[str] = set()
    if data.get("utc_offset_seconds", 0) == 0 and isinstance(times, list):
        for sample_index, stamp in enumerate(times[:500]):
            try:
                at = datetime.fromisoformat(str(stamp))
            except ValueError:
                continue
            if at.tzinfo is not None and at.utcoffset() != timedelta(0):
                continue
            at = at.replace(tzinfo=UTC)
            if at.date() == day and at.minute == 0 and at.second == 0:
                text = at.isoformat()
                if text in index:
                    duplicate.add(text)
                index[text] = sample_index
    result = []
    for key in keys:
        label, unit, source, guideline = VARIABLES[key]
        values = hourly.get(key, [])
        unit_ok = _canonical_unit(units.get(key)) == unit
        points: list[dict[str, Any]] = []
        for hour in range(24):
            at = datetime(day.year, day.month, day.day, hour, tzinfo=UTC)
            stamp = at.isoformat()
            i = index.get(stamp)
            value = None
            if (
                unit_ok
                and isinstance(values, list)
                and i is not None
                and i < len(values)
                and stamp not in duplicate
            ):
                value = _number(values[i], key)
            points.append(
                {
                    "time": stamp,
                    "value": value,
                    "classification": "FORECAST" if at > now else "MODELLED",
                }
            )
        numbers = [p["value"] for p in points if p["value"] is not None]
        complete = len(numbers) == 24 and day < now.date()
        mean = sum(numbers) / 24 if complete else None
        reference = None
        if guideline is not None and mean is not None:
            reference = {
                "value": guideline,
                "unit": unit,
                "averaging_period": "24 hours (UTC day)",
                "ratio": round(mean / guideline, 2),
                "url": WHO_DOC,
                "note": "WHO 2021 24-hour reference; a modeled-day comparison, not a compliance assessment. Annual 99th-percentile interpretation requires a full year.",
            }
        result.append(
            {
                "variable": key,
                "label": label,
                "unit": unit,
                "source_id": source,
                "points": points,
                "ingested_at": ingested.isoformat() if ingested else None,
                "original_available_at": None,
                "original_availability": "UNKNOWN",
                "summary": {
                    "hours_present": len(numbers),
                    "hours_expected": 24,
                    "complete_past_day": complete,
                    "mean_24h": mean,
                    "min": min(numbers) if numbers else None,
                    "max": max(numbers) if numbers else None,
                    "reference": reference,
                },
                "warnings": []
                if unit_ok
                else ["Provider unit absent or unrecognized; values withheld."],
            }
        )
    return result


async def locations(query: str) -> dict[str, Any]:
    data, ingested, cached = await provider.get(
        GEOCODE_URL, {"name": query, "count": 8, "language": "en", "format": "json"}
    )
    if not isinstance(data, dict):
        raise ProviderUnavailableError("Location provider returned invalid results.")
    rows = data.get("results", [])
    results = []
    for row in rows[:8] if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        lat, lon = row.get("latitude"), row.get("longitude")
        if (
            isinstance(lat, bool)
            or isinstance(lon, bool)
            or not isinstance(lat, int | float)
            or not isinstance(lon, int | float)
            or not math.isfinite(lat)
            or not math.isfinite(lon)
            or not -90 <= lat <= 90
            or not -180 <= lon <= 180
        ):
            continue
        results.append(
            {
                "id": str(row.get("id", "")),
                "name": str(row.get("name", "Location"))[:120],
                "country": str(row.get("country", ""))[:120],
                "region": str(row.get("admin1", ""))[:120],
                "latitude": lat,
                "longitude": lon,
            }
        )
    return {
        "results": results,
        "attribution": "Open-Meteo / GeoNames",
        "source_url": "https://open-meteo.com/en/docs/geocoding-api",
        "ingested_at": ingested.isoformat(),
        "cached": cached,
    }


async def observations(
    lat: float, lon: float, day: date, now: datetime | None = None
) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    validate_day(day, now)
    air_keys = [key for key, value in VARIABLES.items() if value[2] == "air"]
    weather_keys = [key for key, value in VARIABLES.items() if value[2] == "weather"]
    common = {
        "latitude": lat,
        "longitude": lon,
        "start_date": day.isoformat(),
        "end_date": day.isoformat(),
        "timezone": "UTC",
    }
    archive = day < now.date() - timedelta(days=5)
    requests: dict[str, tuple[str, dict[str, Any]]] = {
        "air": (AIR_URL, {**common, "domains": "cams_global", "hourly": ",".join(air_keys)}),
        "weather": (
            ARCHIVE_URL if archive else WEATHER_URL,
            {
                **common,
                "hourly": ",".join(weather_keys),
                "temperature_unit": "celsius",
                **({"models": "era5"} if archive else {}),
            },
        ),
    }

    async def fetch(source: str) -> tuple[Any, datetime | None, bool, str | None]:
        if source == "air" and day < AIR_START:
            return (
                {},
                None,
                False,
                "Global CAMS air-quality archive begins August 2022; air data unavailable for this date.",
            )
        try:
            data, ingested, cached = await provider.get(*requests[source])
            if not isinstance(data, dict):
                raise ProviderUnavailableError("Environmental provider returned unexpected data.")
            return data, ingested, cached, None
        except ProviderUnavailableError as exc:
            return {}, None, False, str(exc)

    air, weather = await asyncio.gather(fetch("air"), fetch("weather"))
    sources = []
    series = []
    for key, response, keys in [("air", air, air_keys), ("weather", weather, weather_keys)]:
        data, ingested, cached, error = response
        rows = normalize(data, keys, day, now, ingested)
        sources.append(
            {
                "id": key,
                "provider": "Open-Meteo / Copernicus CAMS"
                if key == "air"
                else "Open-Meteo / ERA5"
                if archive
                else "Open-Meteo / weather model ensemble",
                "url": AIR_DOC if key == "air" else ARCHIVE_DOC if archive else WEATHER_DOC,
                "endpoint": requests[key][0],
                "status": "unavailable"
                if error or not any(row["summary"]["hours_present"] for row in rows)
                else "available",
                "ingested_at": ingested.isoformat() if ingested else None,
                "cached": cached,
                "original_available_at": None,
                "model_issued_at": None,
                "grid_latitude": data.get("latitude"),
                "grid_longitude": data.get("longitude"),
                "resolution": "0.4° (~45 km); native 3-hourly, provider interpolates hourly"
                if key == "air"
                else "ERA5 0.25° (~25 km), hourly"
                if archive
                else "Automatic weather models; variable grid resolution, hourly output",
                "error": error,
            }
        )
        series.extend(rows)
    return {
        "date": day.isoformat(),
        "requested_location": {"latitude": lat, "longitude": lon},
        "time_basis": "UTC",
        "retrieved_at": now.isoformat(),
        "sources": sources,
        "series": series,
        "context_only": True,
        "personal_exposure_established": False,
        "warnings": [
            "Ambient grid estimates are not personal exposure or proof of individual clinical causation.",
            "Historical data are retrieved now. Original publication time is unknown; these records cannot establish what was known at a clinical replay boundary.",
            "Air-quality hourly values are provider-interpolated from native three-hourly CAMS output; they are not independent hourly station measurements.",
        ],
    }


async def layer(
    lat: float, lon: float, day: date, variable: str, now: datetime | None = None
) -> dict[str, Any]:
    """Nine authentic regional model samples, batched upstream; no invented raster."""
    now = now or datetime.now(UTC)
    validate_day(day, now)
    if day < AIR_START:
        raise ProviderUnavailableError("Global air layer is unavailable before August 2022.")
    positions = [
        (round(max(-89.8, min(89.8, lat + dy)), 4), round((lon + dx + 180) % 360 - 180, 4))
        for dy in (-1, 0, 1)
        for dx in (-1, 0, 1)
    ]
    data, ingested, cached = await provider.get(
        AIR_URL,
        {
            "latitude": ",".join(str(p[0]) for p in positions),
            "longitude": ",".join(str(p[1]) for p in positions),
            "start_date": day.isoformat(),
            "end_date": day.isoformat(),
            "timezone": "UTC",
            "domains": "cams_global",
            "hourly": variable,
        },
    )
    if not isinstance(data, list) or len(data) != 9:
        raise ProviderUnavailableError("Regional layer returned incomplete sample locations.")
    rows = []
    for position, response in zip(positions, data, strict=True):
        if not isinstance(response, dict):
            raise ProviderUnavailableError("Regional layer returned invalid sample locations.")
        series = normalize(response, [variable], day, now, ingested)[0]
        rows.append({"latitude": position[0], "longitude": position[1], "points": series["points"]})
    return {
        "date": day.isoformat(),
        "variable": variable,
        "unit": VARIABLES[variable][1],
        "samples": rows,
        "ingested_at": ingested.isoformat(),
        "cached": cached,
        "source_url": AIR_DOC,
        "note": "Nine regional CAMS model samples. Heatmap smoothing is illustrative; unsampled areas and personal exposure are unknown.",
    }

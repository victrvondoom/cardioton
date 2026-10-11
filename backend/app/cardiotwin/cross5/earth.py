"""CardioEarth — planetary cardiovascular health context.

Two data families:

1. **Country-level cardiovascular mortality estimates** — a small committed
   static snapshot of published WHO Global Health Observatory age-standardized
   CVD mortality estimates (rounded demonstration values). The snapshot exists
   so the platform works offline and tests stay deterministic; the provenance of
   every row names the WHO GHO as the upstream source and instructs the user to
   verify at source before any publication use. These are historical
   population statistics — NOT live disease surveillance and NOT applicable to
   any individual patient.

2. **Environmental observations** — reuses the existing, tested Open-Meteo
   adapters in ``app.cardiotwin.environment.service`` (caching, quota bounds,
   explicit provider-unavailable errors). No substitute values are generated
   when the provider is unreachable.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from app.cardiotwin.environment import service as environment_service

WHO_GHO_URL = "https://www.who.int/data/gho"
SNAPSHOT_NOTICE = (
    "Committed static research snapshot of published WHO Global Health Observatory "
    "age-standardized CVD mortality estimates (rounded demonstration values). "
    "Historical population statistics — not live surveillance, not individual risk. "
    "Verify values at the WHO GHO before any publication use."
)

# Rounded, order-of-magnitude published estimates (age-standardized CVD
# mortality per 100,000, ~2019 reporting year). Demonstration snapshot only.
COUNTRY_SNAPSHOT: list[dict[str, Any]] = [
    {"iso": "IN", "country": "India", "region": "South-East Asia", "cvd_mortality_per_100k": 272.0, "year": 2019},
    {"iso": "US", "country": "United States", "region": "Americas", "cvd_mortality_per_100k": 128.0, "year": 2019},
    {"iso": "GB", "country": "United Kingdom", "region": "Europe", "cvd_mortality_per_100k": 122.0, "year": 2019},
    {"iso": "DE", "country": "Germany", "region": "Europe", "cvd_mortality_per_100k": 151.0, "year": 2019},
    {"iso": "BR", "country": "Brazil", "region": "Americas", "cvd_mortality_per_100k": 176.0, "year": 2019},
    {"iso": "ZA", "country": "South Africa", "region": "Africa", "cvd_mortality_per_100k": 204.0, "year": 2019},
    {"iso": "CN", "country": "China", "region": "Western Pacific", "cvd_mortality_per_100k": 276.0, "year": 2019},
    {"iso": "JP", "country": "Japan", "region": "Western Pacific", "cvd_mortality_per_100k": 100.0, "year": 2019},
    {"iso": "AU", "country": "Australia", "region": "Western Pacific", "cvd_mortality_per_100k": 96.0, "year": 2019},
    {"iso": "FR", "country": "France", "region": "Europe", "cvd_mortality_per_100k": 94.0, "year": 2019},
]


def countries() -> dict[str, Any]:
    return {
        "countries": [
            {
                **row,
                "status": "observed",
                "population_level": True,
                "unit": "age-standardized deaths per 100,000 population",
                "source": "WHO Global Health Observatory (published estimates)",
                "source_url": WHO_GHO_URL,
                "uncertainty": "Published point estimates rounded for demonstration; see WHO GHO for uncertainty intervals.",
            }
            for row in COUNTRY_SNAPSHOT
        ],
        "notice": SNAPSHOT_NOTICE,
    }


def country_profile(iso: str) -> dict[str, Any] | None:
    code = iso.strip().upper()
    for row in COUNTRY_SNAPSHOT:
        if row["iso"] == code:
            payload = countries()
            match = next(c for c in payload["countries"] if c["iso"] == code)
            return {**match, "notice": SNAPSHOT_NOTICE}
    return None


async def environment_context(latitude: float, longitude: float, day: date,
                              now: datetime | None = None) -> dict[str, Any]:
    """Environmental observations via the existing Open-Meteo adapters.

    Raises ``environment_service.ProviderUnavailableError`` when the provider
    is unreachable or out of quota — surfaced honestly by the API layer.
    """
    observations = await environment_service.observations(latitude, longitude, day, now)
    observations["notice"] = (
        "Environmental context from Open-Meteo (cached, quota-bounded). Aggregated regional "
        "context only — environmental observations do not establish individual disease causation."
    )
    return observations


def utc_today() -> date:
    return datetime.now(UTC).date()

"""Typed evidence records for CROSS-5.

Every observation that enters an intersection must carry: frame, subject/
population, spatial reference, temporal interval, units, provenance, evidence
status (observed / derived / modeled / simulated), uncertainty, consent class
and model version. The intersection engine refuses records that are not fully
typed — this is the mechanism that keeps five scientific domains honest.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EvidenceStatus(str, Enum):
    OBSERVED = "observed"
    DERIVED = "derived"
    MODELED = "modeled"
    SIMULATED = "simulated"


class ConsentClass(str, Enum):
    SYNTHETIC = "synthetic"
    AGGREGATE_PUBLIC = "aggregate_public"
    INDIVIDUAL_RESTRICTED = "individual_restricted"


class SpatialRef(BaseModel):
    system: str = Field(description="e.g. 'epsg:4326', 'vessel_centreline', 'city_graph'")
    country_iso: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    vessel_id: str | None = None
    arc_position_mm: float | None = Field(default=None, ge=0)
    node_id: str | None = None


class TemporalRef(BaseModel):
    start: datetime
    end: datetime
    resolution: str = Field(description="e.g. 'millisecond', 'hourly', 'daily', 'annual'")

    @field_validator("end")
    @classmethod
    def _ordered(cls, end: datetime, info: Any) -> datetime:
        start = info.data.get("start")
        if start is not None and end < start:
            raise ValueError("temporal end precedes start")
        return end


class EvidenceRecord(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    observation_id: str
    frame: str
    observation_type: str
    subject: str = Field(description="subject id (synthetic patient) or population label")
    population_level: bool = Field(description="True: aggregated population statistic; False: individual subject")
    status: EvidenceStatus
    quantity: str
    value: float
    unit: str
    spatial: SpatialRef | None = None
    temporal: TemporalRef
    provenance: str
    source_url: str | None = None
    uncertainty: str | None = None
    consent: ConsentClass
    model_version: str | None = None
    computation: str | None = Field(
        default=None,
        description="how the value was produced (formula / pipeline summary)",
    )

    def available_at(self, as_of: datetime) -> bool:
        """Leakage-safe availability: only evidence whose interval ended before as_of."""
        return self.temporal.end <= as_of


def now_utc() -> datetime:
    return datetime.now(UTC)

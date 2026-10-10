"""Offline spatial context. No external requests or causal physiology inputs."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any

from .fusion import known
from .schema import Spatial


def distance_km(a: dict[str, Any], b: dict[str, Any]) -> float:
    p1, p2 = math.radians(a["latitude"]), math.radians(b["latitude"])
    dp = p2 - p1
    dl = math.radians(b["longitude"] - a["longitude"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(6371.0088 * 2 * math.asin(min(1.0, math.sqrt(h))), 2)


def compose_spatial(data: Spatial | None, at: datetime, evidence_ids: set[str]) -> dict[str, Any]:
    empty: dict[str, Any] = {
        "location": None,
        "events": [],
        "facilities": [],
        "environment": [],
        "context_only": True,
        "synthetic": False,
        "consent": False,
        "radius_km": 15,
        "notice": "CONTEXT ONLY. No geographic data is sent to a public map or care service. Live facility capacity is UNKNOWN.",
    }
    if data is None:
        return empty

    def project(item: Any) -> dict[str, Any]:
        value: dict[str, Any] = item.model_dump(mode="json")
        value["evidence_refs"] = [r for r in item.evidence_refs if r in evidence_ids]
        value["classification"] = "OBSERVED"
        value["review_status"] = "UNREVIEWED"
        value["context_only"] = True
        return value

    location = (
        project(data.location)
        if data.consent and data.location and known(data.location, at)
        else None
    )
    # Consent gates all patient-linked spatial events and environmental context.
    events = [project(p) for p in data.events if known(p, at)] if location else []
    environment = [project(p) for p in data.environment if known(p, at)] if location else []
    facilities = []
    if location:
        for f in data.facilities:
            if not known(f, at):
                continue
            row = project(f)
            row["distance_km"] = distance_km(location, row)
            row["distance_kind"] = "DERIVED straight-line distance; not travel time"
            row["live_capacity"] = "UNKNOWN"
            if row["distance_km"] <= data.radius_km:
                facilities.append(row)
    return {
        **empty,
        "location": location,
        "events": events,
        "environment": environment,
        "facilities": sorted(facilities, key=lambda f: (f["distance_km"], f["id"])),
        "consent": bool(location),
        "synthetic": bool(location and location["synthetic"]),
        "radius_km": data.radius_km,
    }

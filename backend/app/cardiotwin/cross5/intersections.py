"""CROSS-5 intersection engine.

Three scientifically justified link types — temporal, spatial and model-based —
and an explicit registry of which frame pairs support which links. Anything
not registered is reported as unsupported with an explanation; the engine never
invents a relation between two biomedical quantities merely because both are
available.

A deliberate honesty rule: CardioFlow's time axis is *model time* (a
representative cardiac cycle), not a patient's wall-clock. It therefore cannot
participate in wall-clock temporal intersections with CardioChronos; that pair
is registered as unsupported with exactly that reason.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from .evidence import EvidenceRecord

LinkType = str  # "temporal" | "spatial" | "model"

# Registry of supported frame-pair link types.
SUPPORTED_LINKS: dict[tuple[str, str], list[dict[str, Any]]] = {
    ("cardiotwin", "cardiochronos"): [
        {
            "link": "temporal",
            "description": "A subject's clinical/physiological observations share wall-clock time with their measurement timeline.",
            "mechanism": "Temporal interval overlap on identical subject ids (UTC).",
        },
    ],
    ("cardiochronos", "cardioearth"): [
        {
            "link": "temporal+spatial",
            "description": "Patient-exposure windows can be aligned with regional environmental history at the same place and period.",
            "mechanism": "Interval overlap plus geographic containment (ISO country).",
            "caution": "Ecological alignment of an individual timeline with regional aggregates; association only, never causation.",
        },
    ],
    ("cardiocity", "cardioearth"): [
        {
            "link": "spatial",
            "description": "A city is contained in a country; planetary statistics contextualise city-level analysis.",
            "mechanism": "Geographic containment (city coordinates inside country, shared ISO code).",
        },
    ],
    ("cardiotwin", "cardioflow"): [
        {
            "link": "anatomical",
            "description": "Coronary vessel ids (LAD/LCX/RCA) are shared anatomical references between the risk twin and the microphysics laboratory.",
            "mechanism": "Identity mapping of vessel ids; the CAD probability and the hypothetical stenosis simulation stay separate quantities.",
            "caution": "A CAD probability is never used to place a simulated stenosis, and a simulated FFR never becomes a diagnosis.",
        },
    ],
    ("cardiotwin", "cardioearth"): [
        {
            "link": "contextual",
            "description": "Regional population statistics can contextualise an individual's risk profile — as background, not as an input.",
            "mechanism": "Reported side-by-side with explicit individual-vs-aggregate separation; no quantitative merge.",
        },
    ],
    ("cardiochronos", "cardiocity"): [
        {
            "link": "contextual",
            "description": "City access analysis can be placed on the same wall-clock research timeline as population context.",
            "mechanism": "Temporal co-occurrence of independent quantities; no physiological relation is computed.",
        },
    ],
}

UNSUPPORTED: dict[tuple[str, str], str] = {
    ("cardioflow", "cardiochronos"): (
        "CardioFlow's time axis is simulated cardiac-cycle model time, not wall-clock time; "
        "aligning it with a patient's real timeline would fabricate a temporal correspondence."
    ),
    ("cardioflow", "cardioearth"): (
        "No implemented, documented mathematical relation connects planetary population "
        "statistics to hypothetical coronary microphysics."
    ),
    ("cardioflow", "cardiocity"): (
        "No implemented, documented mathematical relation connects urban access networks "
        "to hypothetical coronary microphysics."
    ),
}


def _pair(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a <= b else (b, a)


def _normalize(registry: dict[tuple[str, str], Any]) -> dict[tuple[str, str], Any]:
    out: dict[tuple[str, str], Any] = {}
    for (a, b), value in registry.items():
        out[_pair(a, b)] = value
    return out


SUPPORTED_LINKS = _normalize(SUPPORTED_LINKS)
UNSUPPORTED = _normalize(UNSUPPORTED)


def available_intersections(selected_frames: list[str]) -> dict[str, Any]:
    """Declared intersections for a frame selection, with honest unsupported entries."""
    supported: list[dict[str, Any]] = []
    unsupported: list[dict[str, Any]] = []
    selected = list(dict.fromkeys(selected_frames))
    for i, a in enumerate(selected):
        for b in selected[i + 1 :]:
            key = _pair(a, b)
            if key in SUPPORTED_LINKS:
                for link in SUPPORTED_LINKS[key]:
                    supported.append({"frames": list(key), **link})
            elif key in UNSUPPORTED:
                unsupported.append({"frames": list(key), "reason": UNSUPPORTED[key]})
            else:
                unsupported.append(
                    {
                        "frames": list(key),
                        "reason": (
                            "No typed evidence relation is implemented between these frames; "
                            "combining them would be scientifically unsupported."
                        ),
                    }
                )
    return {
        "selected_frames": selected,
        "supported": supported,
        "unsupported": unsupported,
        "notice": (
            "Intersections are declared, typed relations — not automatic correlations. "
            "Unsupported pairs are listed explicitly instead of being computed."
        ),
    }


def temporal_overlap(records: list[EvidenceRecord]) -> dict[str, Any]:
    """Pairwise wall-clock interval overlaps across frames for one subject."""
    wall_clock = [r for r in records if r.temporal.resolution not in ("model_time",)]
    if len(wall_clock) < 2:
        return {"overlaps": [], "note": "Need at least two wall-clock records to intersect."}
    overlaps = []
    for i, a in enumerate(wall_clock):
        for b in wall_clock[i + 1 :]:
            start = max(a.temporal.start, b.temporal.start)
            end = min(a.temporal.end, b.temporal.end)
            if start >= end:
                continue
            span_a = (a.temporal.end - a.temporal.start).total_seconds()
            span_b = (b.temporal.end - b.temporal.start).total_seconds()
            overlap_s = (end - start).total_seconds()
            overlaps.append(
                {
                    "record_a": a.observation_id,
                    "record_b": b.observation_id,
                    "frames": [a.frame, b.frame],
                    "overlap_start": start.isoformat(),
                    "overlap_end": end.isoformat(),
                    "overlap_seconds": overlap_s,
                    "coverage_a": round(overlap_s / span_a, 4) if span_a else 1.0,
                    "coverage_b": round(overlap_s / span_b, 4) if span_b else 1.0,
                    "status": f"{a.status.value}/{b.status.value}",
                    "subject_match": a.subject == b.subject,
                }
            )
    overlaps.sort(key=lambda o: -o["overlap_seconds"])
    return {
        "overlaps": overlaps,
        "notice": (
            "Interval co-occurrence is a temporal alignment, not a causal relation. "
            "Individual and population records are matched only by place and period."
        ),
    }


def spatial_match(records: list[EvidenceRecord]) -> dict[str, Any]:
    """Spatial containment/identity matches across frames."""
    matches = []
    for i, a in enumerate(records):
        for b in records[i + 1 :]:
            kind = None
            if (
                a.spatial is not None
                and b.spatial is not None
                and a.spatial.country_iso
                and a.spatial.country_iso == b.spatial.country_iso
            ):
                kind = "country_iso_identity"
            elif (
                a.spatial is not None
                and b.spatial is not None
                and a.spatial.vessel_id
                and a.spatial.vessel_id == b.spatial.vessel_id
            ):
                kind = "vessel_id_anatomical_identity"
            if kind:
                matches.append(
                    {
                        "record_a": a.observation_id,
                        "record_b": b.observation_id,
                        "frames": [a.frame, b.frame],
                        "match": kind,
                        "population_vs_individual": a.population_level != b.population_level,
                    }
                )
    return {
        "matches": matches,
        "notice": (
            "Spatial identity means the records describe the same place or the same anatomical "
            "reference — not that their quantities are physically comparable."
        ),
    }


def leakage_check(records: list[EvidenceRecord], as_of: datetime) -> dict[str, Any]:
    """Partition evidence into available-before / after a point in time (time travel)."""
    available = [r for r in records if r.available_at(as_of)]
    excluded = [r for r in records if not r.available_at(as_of)]
    return {
        "as_of": as_of.isoformat(),
        "available": [r.observation_id for r in available],
        "excluded_future": [r.observation_id for r in excluded],
        "notice": "Retrospective reconstruction uses only evidence whose interval ended before the requested date (no future-data leakage).",
    }

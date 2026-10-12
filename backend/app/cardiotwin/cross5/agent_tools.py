"""Typed, auditable agent tools over the CROSS-5 frame system.

Deterministic lookup functions — not LLM agents. They let the CardioTon agent
layer explain the five reference frames, their declared intersections and the
flagship experiments without ever inventing data:

* ``explain_frame`` returns a frame's scale, data kinds and claims policy.
* ``explain_intersection`` returns the declared supported/unsupported links
  for a frame pair, with the honest reasons.
* ``experiment_catalog`` returns the experiment descriptions.

No tool computes or estimates any patient-specific value, statistic or causal
relation; anything numeric stays inside the frame modules and their APIs.
"""

from __future__ import annotations

from typing import Any, cast

from . import city, earth, experiments, frames, intersections

AGENT_TOOL_NOTICE = (
    "Deterministic reference lookups only. These tools explain frame semantics "
    "and declared intersections; they never produce measurements, statistics, "
    "diagnoses or causal claims."
)


def explain_frame(frame_id: str) -> dict[str, Any]:
    frame = frames.FRAMES.get(cast(frames.FrameId, frame_id))
    if frame is None:
        return {
            "found": False,
            "frame_id": frame_id,
            "known_frame_ids": list(frames.FRAMES),
            "notice": AGENT_TOOL_NOTICE,
        }
    return {"found": True, **frame, "agent_tool_notice": AGENT_TOOL_NOTICE}


def explain_intersection(first: str, second: str) -> dict[str, Any]:
    if first not in frames.FRAMES or second not in frames.FRAMES:
        return {
            "found": False,
            "known_frame_ids": list(frames.FRAMES),
            "notice": AGENT_TOOL_NOTICE,
        }
    declared = intersections.available_intersections([first, second])
    return {
        "found": True,
        "supported": declared["supported"],
        "unsupported": declared["unsupported"],
        "agent_tool_notice": AGENT_TOOL_NOTICE,
    }


def experiment_catalog() -> dict[str, Any]:
    return {
        "experiments": experiments.EXPERIMENTS,
        "notice": experiments.EXPERIMENT_NOTICE,
        "agent_tool_notice": AGENT_TOOL_NOTICE,
    }


def registry_entry() -> dict[str, Any]:
    return {
        "role": "CROSS-5 Multiscale Reference Guide",
        "status": "idle",
        "active_tasks": 0,
        "tools": [
            "cross5.explain_frame",
            "cross5.explain_intersection",
            "cross5.experiment_catalog",
        ],
        "tool_endpoints": [
            "GET /api/v1/cross5/frames",
            "GET /api/v1/cross5/intersections",
            "GET /api/v1/cross5/experiments",
        ],
        "notice": AGENT_TOOL_NOTICE,
        "population_statistics_note": earth.SNAPSHOT_NOTICE,
        "city_network_note": city.CITY_NOTICE,
    }

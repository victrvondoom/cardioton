"""Typed, auditable agent tools over the SlicerHeart integration.

These are deterministic lookup functions — not LLM agents. They let
CardioTon's agent layer explain cardiac anatomical terminology and
integration capabilities without ever inventing measurements:

* ``explain_metric`` returns a SlicerHeart-sourced definition with its
  requires-imaging notice.
* ``integration_catalog`` returns the classification matrix.
* ``imaging_runtime_status`` reports bridge availability honestly.

No tool here computes or estimates any patient-specific value. Computed
imaging metrics only exist when a Slicer runtime worker produces them (see
``bridge``), and even then they enter CardioTon as explicitly provenanced
results — never as agent-generated numbers.
"""

from __future__ import annotations

from typing import Any

from . import bridge, catalog, provenance, valve_metrics

AGENT_TOOL_NOTICE = (
    "Deterministic reference lookups only. This tool never produces patient-specific "
    "measurements, stenosis percentages or diagnoses; imaging metrics require a "
    "3D Slicer runtime and human review."
)


def explain_metric(metric_id: str) -> dict[str, Any]:
    """SlicerHeart-sourced definition of a valve metric, or an explicit miss."""
    metric = valve_metrics.explain_metric(metric_id)
    if metric is None:
        known = valve_metrics.metric_catalog()["all_metric_ids"]
        return {
            "found": False,
            "metric_id": metric_id,
            "known_metric_ids": known,
            "notice": AGENT_TOOL_NOTICE,
        }
    return {"found": True, **metric, "agent_tool_notice": AGENT_TOOL_NOTICE}


def integration_catalog() -> dict[str, Any]:
    """Classification matrix and provenance for the SlicerHeart integration."""
    return {
        "provenance": provenance.provenance_summary(),
        "summary": catalog.catalog_summary(),
        "notice": AGENT_TOOL_NOTICE,
    }


def imaging_runtime_status() -> dict[str, Any]:
    """Honest availability of the Slicer imaging runtime and its job catalogue."""
    return {
        "bridge": bridge.detect_runtime().model_dump(),
        "job_catalog": bridge.job_catalog(),
        "notice": AGENT_TOOL_NOTICE,
    }


def registry_entry() -> dict[str, Any]:
    """Static registry description for the CardioTwin agent registry."""
    return {
        "role": "Cardiac Imaging & Anatomy Reference (SlicerHeart)",
        "status": "idle",
        "active_tasks": 0,
        "tools": ["slicerheart.explain_metric", "slicerheart.integration_catalog", "slicerheart.imaging_runtime_status"],
        "tool_endpoints": [
            "GET /api/v1/integrations/slicerheart/valve-metrics",
            "GET /api/v1/integrations/slicerheart/catalog",
            "GET /api/v1/integrations/slicerheart/bridge/status",
        ],
        "notice": AGENT_TOOL_NOTICE,
    }

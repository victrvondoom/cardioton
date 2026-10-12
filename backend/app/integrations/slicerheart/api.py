"""SlicerHeart integration API (isolated, additive router).

Exposes the integration matrix, upstream provenance, the valve-metric
vocabulary, the research annulus-shape statistics and the Slicer runtime
bridge to the CardioTon frontend and agents. Read endpoints are reference
data; the research endpoint computes real cohort statistics on user-supplied
SlicerHeart exports; the bridge reports honest runtime availability.
"""

from __future__ import annotations

import csv
import io
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.auth import get_current_user

from . import annulus_shape, bridge, catalog, provenance, valve_metrics

router = APIRouter(prefix="/integrations/slicerheart", tags=["slicerheart_integration"])

MAX_CSV_BYTES = 4 * 1024 * 1024  # 4 MiB of exported contour text
MAX_CSV_ROWS = 200_000

RESEARCH_NOTICE = (
    "Research statistics computed on user-supplied SlicerHeart ValveBatchExport contour data. "
    "Population shape descriptors only — no clinical interpretation, no patient-specific diagnosis."
)


class AnnulusShapeRequest(BaseModel):
    csv_text: str = Field(min_length=1, max_length=MAX_CSV_BYTES)
    label_order: list[str] = Field(min_length=3, max_length=12)
    valve_type: str | None = None
    phases: list[str] | None = None
    points_per_segment: int = Field(default=30, ge=2, le=200)
    normalize_size: bool = False


def _parse_rows(csv_text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(csv_text))
    rows: list[dict[str, str]] = []
    for raw in reader:
        if len(rows) >= MAX_CSV_ROWS:
            raise HTTPException(422, "Contour export exceeds the maximum row count")
        if None in raw.values():
            raise HTTPException(422, "Malformed CSV row (more fields than header)")
        rows.append({k: v for k, v in raw.items() if k is not None})
    missing = [c for c in annulus_shape.REQUIRED_COLUMNS if rows and c not in rows[0]]
    if missing:
        raise HTTPException(422, f"Contour export is missing required columns: {', '.join(missing)}")
    return rows


@router.get("/overview")
async def overview(_: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {
        **provenance.provenance_summary(),
        "catalog": catalog.catalog_summary(),
        "bridge": bridge.detect_runtime().model_dump(),
    }


@router.get("/catalog")
async def integration_catalog(_: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"summary": catalog.catalog_summary(), "matrix": catalog.integration_matrix()}


@router.get("/valve-metrics")
async def metrics_catalog(_: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return valve_metrics.metric_catalog()


@router.get("/valve-metrics/{metric_id}")
async def metric_detail(metric_id: str, _: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    metric = valve_metrics.explain_metric(metric_id)
    if metric is None:
        raise HTTPException(404, f"Unknown metric id: {metric_id}")
    return metric


@router.post("/research/annulus-shape")
async def annulus_shape_analysis(
    request: AnnulusShapeRequest,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Cohort annulus-shape statistics (adapted SlicerHeart HeartValveBatchAnalysis)."""
    rows = _parse_rows(request.csv_text)
    try:
        result = await run_in_threadpool(
            annulus_shape.analyze_cohort,
            rows,
            request.label_order,
            valve_type=request.valve_type,
            annulus_phases=request.phases,
            number_of_points_per_segment=request.points_per_segment,
            normalize_size=request.normalize_size,
        )
    except annulus_shape.ContourDataError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {
        "notice": RESEARCH_NOTICE,
        "provenance": {
            "upstream": provenance.UPSTREAM_REPO,
            "adapted_from": "SlicerHeart-master/ValveBatchExport/HeartValveBatchAnalysis/annulus_shape_analysis.py",
            "license": provenance.UPSTREAM_LICENSE,
            "snapshot_source_fingerprint": provenance.snapshot_fingerprint(),
        },
        "cases_requested": len({row.get("Filename") for row in rows if row.get("Filename")}),
        "result": result,
    }


@router.get("/bridge/status")
async def bridge_status(_: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {**bridge.detect_runtime().model_dump(), "jobs": bridge.job_catalog()}


@router.post("/bridge/jobs")
async def submit_bridge_job(
    request: bridge.SlicerHeartJobRequest,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        job = bridge.submit_job(request)
    except bridge.BridgeUnavailableError as exc:
        raise HTTPException(
            503,
            detail={
                "reason": "slicer_runtime_unavailable",
                "message": exc.status.reason,
                "setup_instructions": exc.status.setup_instructions,
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return job


@router.get("/bridge/jobs/{job_id}")
async def bridge_job_status(
    job_id: str,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    status = bridge.job_status(job_id)
    if status is None:
        raise HTTPException(404, f"Unknown bridge job: {job_id}")
    return status

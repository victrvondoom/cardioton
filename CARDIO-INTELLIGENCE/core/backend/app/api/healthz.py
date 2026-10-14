"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.db import db

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str | bool]:
    """Process-only liveness; database traffic gating belongs to /readyz."""
    return {
        "status": "ok",
        "db": "not_checked",
        # Pool initialization is a capability hint, not a database health probe.
        # DB-less clients can avoid unsupported calls without inventing counts.
        "case_storage_configured": bool(db.pool_snapshot()["writer_pool"]["configured"]),
    }


@router.get("/readyz")
async def readyz() -> JSONResponse:
    """Do not send traffic to an API unable to persist cases and queue jobs."""
    try:
        await db.fetchval("SELECT id FROM cases LIMIT 1")
        await db.fetchval("SELECT id FROM case_jobs LIMIT 1")
    except Exception:  # noqa: BLE001
        return JSONResponse({"status": "not_ready", "database": "unavailable"}, status_code=503)
    return JSONResponse({"status": "ready", "database": "ok"})

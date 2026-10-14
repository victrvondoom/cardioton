"""Intelligence Hub API: every absorbed cardiovascular project, served from the unified catalog.

Catalog, files and dataset previews require a signed-in user. The built web apps of the modules
(static UI bundles with no data) are public so the dashboard can embed them in an iframe.
"""

from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from app.auth import get_current_user
from app.hub import module_catalog as catalog

router = APIRouter(prefix="/hub", tags=["intelligence-hub"])
public_router = APIRouter(prefix="/hub", tags=["intelligence-hub"])

# Explicit types: the OS registry can map .js to text/plain, which browsers refuse as a module.
MEDIA_TYPES = {
    ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
    ".json": "application/json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
    ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".stl": "model/stl", ".obj": "text/plain",
    ".ply": "application/octet-stream", ".bin": "application/octet-stream", ".csv": "text/csv",
    ".tsv": "text/tab-separated-values", ".md": "text/markdown", ".txt": "text/plain", ".pdf": "application/pdf",
    ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".hdr": "application/octet-stream",
}


def _media_type(path: Path) -> str:
    return MEDIA_TYPES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"


@router.get("/overview")
async def hub_overview(
    refresh: bool = Query(False, description="Rescan the modules folder before answering"),
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if refresh:
        catalog.refresh_catalog()
    return catalog.overview()


@router.get("/modules")
async def hub_modules(_: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    return [record.summary() for record in catalog.list_modules()]


@router.get("/modules/{slug}")
async def hub_module(slug: str, _: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    record = catalog.get_module(slug)
    if record is None:
        raise HTTPException(status_code=404, detail="Unknown module")
    return record.detail()


@router.get("/modules/{slug}/files/{path:path}")
async def hub_module_file(slug: str, path: str, _: dict[str, Any] = Depends(get_current_user)) -> FileResponse:
    target = catalog.resolve_module_file(slug, path)
    if target is None:
        raise HTTPException(status_code=404, detail="File not available")
    return FileResponse(target, media_type=_media_type(target))


@router.get("/modules/{slug}/datasets/{path:path}")
async def hub_dataset_preview(
    slug: str,
    path: str,
    rows: int = Query(25, ge=1, le=200),
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    target = catalog.resolve_module_file(slug, path)
    if target is None or target.suffix.lower() not in catalog.DATASET_EXTS:
        raise HTTPException(status_code=404, detail="Dataset not available")
    return {"path": path, **catalog.preview_dataset(target, rows)}


@public_router.get("/apps/{slug}/{path:path}")
async def hub_live_app(slug: str, path: str) -> FileResponse:
    """Static bundle of a module's own web app (UI code only), embedded by the hub."""
    target = catalog.resolve_live_app_file(slug, path)
    if target is None:
        raise HTTPException(status_code=404, detail="No live app for this module")
    return FileResponse(target, media_type=_media_type(target))

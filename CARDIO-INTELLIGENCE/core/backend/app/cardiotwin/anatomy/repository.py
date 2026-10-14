"""Atomic owner+tenant scoped JSONB storage; opted-in SQLite is synthetic/dev only."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool

from app.core__backend_app__config import settings
from app.db import db

from .core__cardiotwin_anatomy__models import Report

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS cardio_anatomy_reports (
 organization_id TEXT NOT NULL, owner_user_id TEXT NOT NULL,
 id TEXT NOT NULL, version INTEGER NOT NULL, case_ref TEXT NOT NULL,
 payload JSONB NOT NULL, PRIMARY KEY (organization_id, owner_user_id, id)
);
CREATE INDEX IF NOT EXISTS cardio_anatomy_reports_case
 ON cardio_anatomy_reports (organization_id, owner_user_id, case_ref);
CREATE TABLE IF NOT EXISTS cardio_anatomy_erasure_audit (
 organization_id TEXT NOT NULL, owner_user_id TEXT NOT NULL,
 report_id TEXT NOT NULL, erased_at TEXT NOT NULL,
 PRIMARY KEY (organization_id, owner_user_id, report_id)
);
"""


def mode() -> str:
    if db._pool is not None:
        return "postgresql"
    if settings.ENVIRONMENT == "dev" and settings.TRACK7_DEMO_DB:
        return "sqlite_synthetic_demo_only"
    return "unavailable"


def require_storage(synthetic: bool = True) -> str:
    storage = mode()
    if storage == "unavailable" or (storage != "postgresql" and not synthetic):
        raise HTTPException(503, "Persistent PostgreSQL is required for real clinical reports; SQLite is opt-in synthetic development storage only")
    return storage


async def ensure_schema() -> None:
    if mode() == "postgresql":
        await db.execute(SCHEMA_SQL)


@contextmanager
def _sqlite() -> Iterator[sqlite3.Connection]:
    if mode() != "sqlite_synthetic_demo_only":
        raise HTTPException(503, "Synthetic development storage is unavailable")
    path = Path(settings.TRACK7_DEMO_DB).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    try:
        connection.execute("PRAGMA secure_delete=ON")
        connection.execute("CREATE TABLE IF NOT EXISTS cardio_anatomy_reports (organization_id TEXT, owner_user_id TEXT, id TEXT, version INTEGER, case_ref TEXT, payload TEXT, PRIMARY KEY (organization_id, owner_user_id, id))")
        connection.execute("CREATE TABLE IF NOT EXISTS cardio_anatomy_erasure_audit (organization_id TEXT, owner_user_id TEXT, report_id TEXT, erased_at TEXT, PRIMARY KEY (organization_id, owner_user_id, report_id))")
        connection.execute("BEGIN IMMEDIATE")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _list_sqlite(org: str, owner: str, case_ref: str) -> list[Report]:
    with _sqlite() as conn:
        rows = conn.execute("SELECT payload FROM cardio_anatomy_reports WHERE organization_id=? AND owner_user_id=? AND case_ref=? ORDER BY id", (org, owner, case_ref)).fetchall()
        return [Report.model_validate_json(row[0]) for row in rows]


async def list_reports(org: str, owner: str, case_ref: str) -> list[Report]:
    require_storage()
    if mode() == "postgresql":
        await ensure_schema()
        rows = await db.fetch("SELECT payload FROM cardio_anatomy_reports WHERE organization_id=$1 AND owner_user_id=$2 AND case_ref=$3 ORDER BY id", org, owner, case_ref)
        return [Report.model_validate_json(row["payload"]) for row in rows]
    return await run_in_threadpool(_list_sqlite, org, owner, case_ref)


def _get_sqlite(org: str, owner: str, identifier: str) -> Report:
    with _sqlite() as conn:
        row = conn.execute("SELECT payload FROM cardio_anatomy_reports WHERE organization_id=? AND owner_user_id=? AND id=?", (org, owner, identifier)).fetchone()
    if row is None:
        raise HTTPException(404, "Cardiovascular report not found")
    return Report.model_validate_json(row[0])


async def get(org: str, owner: str, identifier: str) -> Report:
    require_storage()
    if mode() == "postgresql":
        await ensure_schema()
        row = await db.fetchrow("SELECT payload FROM cardio_anatomy_reports WHERE organization_id=$1 AND owner_user_id=$2 AND id=$3", org, owner, identifier)
        if row is None:
            raise HTTPException(404, "Cardiovascular report not found")
        return Report.model_validate_json(row["payload"])
    return await run_in_threadpool(_get_sqlite, org, owner, identifier)


def _save_sqlite(report: Report, expected: int | None) -> Report:
    require_storage(report.synthetic)
    with _sqlite() as conn:
        key = (report.organization_id, report.owner_user_id, report.id)
        if expected is None:
            try:
                conn.execute("INSERT INTO cardio_anatomy_reports VALUES (?,?,?,?,?,?)", (*key, report.version, report.case_ref, report.model_dump_json()))
            except sqlite3.IntegrityError as exc:
                raise HTTPException(409, "Report already exists") from exc
        else:
            result = conn.execute("UPDATE cardio_anatomy_reports SET version=?, payload=? WHERE organization_id=? AND owner_user_id=? AND id=? AND version=?", (report.version, report.model_dump_json(), *key, expected))
            if result.rowcount != 1:
                raise HTTPException(409, "Report changed; reload before reviewing")
    return report


async def save(report: Report, expected: int | None = None) -> Report:
    require_storage(report.synthetic)
    if report.version != (1 if expected is None else expected + 1):
        raise ValueError("Invalid report revision")
    if mode() == "postgresql":
        await ensure_schema()
        if expected is None:
            result = await db.fetchval("INSERT INTO cardio_anatomy_reports VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING RETURNING version", report.organization_id, report.owner_user_id, report.id, report.version, report.case_ref, report.model_dump_json())
        else:
            result = await db.fetchval("UPDATE cardio_anatomy_reports SET version=$4,payload=$5::jsonb WHERE organization_id=$1 AND owner_user_id=$2 AND id=$3 AND version=$6 RETURNING version", report.organization_id, report.owner_user_id, report.id, report.version, report.model_dump_json(), expected)
        if result is None:
            raise HTTPException(409, "Report changed; reload before reviewing")
        return report
    return await run_in_threadpool(_save_sqlite, report, expected)


def _delete_sqlite(org: str, owner: str, identifier: str, erased_at: str) -> None:
    with _sqlite() as conn:
        result = conn.execute("DELETE FROM cardio_anatomy_reports WHERE organization_id=? AND owner_user_id=? AND id=?", (org, owner, identifier))
        if result.rowcount != 1:
            raise HTTPException(404, "Cardiovascular report not found")
        conn.execute("INSERT INTO cardio_anatomy_erasure_audit VALUES (?,?,?,?)", (org, owner, identifier, erased_at))


async def delete(org: str, owner: str, identifier: str, erased_at: str) -> None:
    require_storage()
    if mode() == "postgresql":
        await ensure_schema()
        async with db.pool.acquire() as conn, conn.transaction():
            result = await conn.fetchval("DELETE FROM cardio_anatomy_reports WHERE organization_id=$1 AND owner_user_id=$2 AND id=$3 RETURNING id", org, owner, identifier)
            if result is None:
                raise HTTPException(404, "Cardiovascular report not found")
            await conn.execute("INSERT INTO cardio_anatomy_erasure_audit VALUES ($1,$2,$3,$4)", org, owner, identifier, erased_at)
        return
    await run_in_threadpool(_delete_sqlite, org, owner, identifier, erased_at)

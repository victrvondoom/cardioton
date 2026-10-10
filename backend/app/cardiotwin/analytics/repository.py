"""Embedded public-evidence workspace storage, separate from clinical persistence.

Records are public metadata or explicit fixtures. Research tasks and passports
are partitioned by authenticated organization AND owner. No clinical imports
are supported. SQLite is a single-host research/demo boundary, not multi-host
production persistence. All material source/parser changes append a snapshot.
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from app.cardiotwin.evidence.passport import canonical_json_bytes, compute_content_sha256
from app.cardiotwin.evidence.schema import EvidenceRecord
from app.config import settings


class IdempotencyConflict(ValueError):  # noqa: N818 - preserved public contract
    pass


class ResearchRepository:
    def __init__(self, path: str | Path | None = None) -> None:
        self.path = str(path if path is not None else settings.CARDIOTWIN_GLOBAL_DB)

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        if self.path == ":memory:":
            raise ValueError("Use an explicit file for durable research storage")
        Path(self.path).resolve().parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.path, timeout=10)
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS research_records (
                    id TEXT PRIMARY KEY, source_name TEXT NOT NULL, source_identifier TEXT NOT NULL,
                    snapshot_hash TEXT NOT NULL, payload TEXT NOT NULL,
                    UNIQUE(source_name, source_identifier)
                );
                CREATE TABLE IF NOT EXISTS research_snapshots (
                    record_id TEXT NOT NULL, snapshot_hash TEXT NOT NULL, parent_hash TEXT,
                    payload TEXT NOT NULL, PRIMARY KEY(record_id, snapshot_hash)
                );
                CREATE TABLE IF NOT EXISTS research_tasks (
                    task_id TEXT PRIMARY KEY, scope TEXT NOT NULL, idempotency_key TEXT,
                    input_hash TEXT NOT NULL, payload TEXT NOT NULL,
                    UNIQUE(scope, idempotency_key)
                );
                CREATE TABLE IF NOT EXISTS research_traces (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL,
                    scope TEXT NOT NULL, payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS research_passports (
                    digest TEXT NOT NULL, scope TEXT NOT NULL, payload TEXT NOT NULL,
                    PRIMARY KEY(digest, scope)
                );
                CREATE TABLE IF NOT EXISTS research_sources (
                    name TEXT PRIMARY KEY, payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS research_mapping_reviews (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT, record_id TEXT NOT NULL,
                    reviewer_scope TEXT NOT NULL, payload TEXT NOT NULL
                );
            """)
            conn.execute("BEGIN IMMEDIATE")
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    @staticmethod
    def _json(data: Any) -> str:
        return canonical_json_bytes(data).decode("utf-8")

    def ingest(self, records: list[EvidenceRecord]) -> dict[str, int]:
        result = {"inserted": 0, "updated": 0, "unchanged": 0}
        with self.connection() as conn:
            for record in records:
                data = record.model_dump(mode="json")
                raw = record.provenance.get("raw_snapshot")
                if not isinstance(raw, dict) or compute_content_sha256(raw) != record.source_version_hash:
                    raise ValueError("Source snapshot digest does not match retained provenance")
                # Retrieval repetition does not create a new source/parser version.
                identity = {k: v for k, v in data.items() if k != "retrieved_at"}
                digest = compute_content_sha256(identity)
                previous = conn.execute("SELECT id,snapshot_hash FROM research_records WHERE source_name=? AND source_identifier=?", (record.source_name, record.source_identifier)).fetchone()
                if previous and previous[0] != record.id:
                    raise ValueError("Canonical identifier changed for existing source identity")
                if previous:
                    stored = json.loads(conn.execute("SELECT payload FROM research_records WHERE id=?", (record.id,)).fetchone()[0])
                    same_source_parser = (stored["source_version_hash"] == data["source_version_hash"]
                        and stored["provenance"].get("parser_version") == data["provenance"].get("parser_version"))
                    if same_source_parser and stored["provenance"].get("mapping_review"):
                        data["mapping_status"] = stored["mapping_status"]
                        data["human_verified"] = stored["human_verified"]
                        data["provenance"]["mapping_review"] = stored["provenance"]["mapping_review"]
                        identity = {k: v for k, v in data.items() if k != "retrieved_at"}
                        digest = compute_content_sha256(identity)
                if previous and previous[1] == digest:
                    result["unchanged"] += 1
                    continue
                conn.execute("INSERT OR IGNORE INTO research_snapshots VALUES (?,?,?,?)", (record.id, digest, previous[1] if previous else None, self._json(data)))
                conn.execute("INSERT INTO research_records VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET snapshot_hash=excluded.snapshot_hash,payload=excluded.payload", (record.id, record.source_name, record.source_identifier, digest, self._json(data)))
                result["updated" if previous else "inserted"] += 1
        return result

    def records(self) -> list[EvidenceRecord]:
        with self.connection() as conn:
            rows = conn.execute("SELECT payload FROM research_records ORDER BY id").fetchall()
        return [EvidenceRecord.model_validate_json(row[0]) for row in rows]

    def history(self, record_id: str) -> list[dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute("SELECT snapshot_hash,parent_hash,payload FROM research_snapshots WHERE record_id=? ORDER BY rowid", (record_id,)).fetchall()
        return [{"snapshot_hash": digest, "parent_hash": parent, "record": json.loads(payload)} for digest, parent, payload in rows]

    def reserve_task(self, task: dict[str, Any], scope: str, idempotency_key: str | None) -> tuple[dict[str, Any], bool]:
        input_hash = compute_content_sha256(task["inputs"])
        with self.connection() as conn:
            if idempotency_key:
                row = conn.execute("SELECT input_hash,payload FROM research_tasks WHERE scope=? AND idempotency_key=?", (scope, idempotency_key)).fetchone()
                if row:
                    if row[0] != input_hash:
                        raise IdempotencyConflict("Idempotency key was used for different inputs")
                    return json.loads(row[1]), False
            conn.execute("INSERT INTO research_tasks VALUES (?,?,?,?,?)", (task["task_id"], scope, idempotency_key, input_hash, self._json(task)))
        return task, True

    def save_task(self, task: dict[str, Any], scope: str) -> None:
        with self.connection() as conn:
            conn.execute("UPDATE research_tasks SET payload=? WHERE task_id=? AND scope=?", (self._json(task), task["task_id"], scope))

    def tasks(self, scope: str) -> list[dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute("SELECT payload FROM research_tasks WHERE scope=? ORDER BY rowid DESC LIMIT 100", (scope,)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def task(self, task_id: str, scope: str) -> dict[str, Any] | None:
        with self.connection() as conn:
            row = conn.execute("SELECT payload FROM research_tasks WHERE task_id=? AND scope=?", (task_id, scope)).fetchone()
        return json.loads(row[0]) if row else None

    def trace(self, data: dict[str, Any], scope: str) -> None:
        with self.connection() as conn:
            conn.execute("INSERT INTO research_traces(task_id,scope,payload) VALUES (?,?,?)", (data["task_id"], scope, self._json(data)))

    def traces(self, scope: str, task_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute("SELECT payload FROM research_traces WHERE scope=? AND (? IS NULL OR task_id=?) ORDER BY seq DESC LIMIT ?", (scope, task_id, task_id, limit)).fetchall()
        return [json.loads(row[0]) for row in reversed(rows)]

    def save_passport(self, payload: dict[str, Any], scope: str) -> str:
        digest = compute_content_sha256(payload)
        with self.connection() as conn:
            conn.execute("INSERT OR IGNORE INTO research_passports VALUES (?,?,?)", (digest, scope, self._json(payload)))
        return digest

    def passport(self, digest: str, scope: str) -> dict[str, Any] | None:
        with self.connection() as conn:
            row = conn.execute("SELECT payload FROM research_passports WHERE digest=? AND scope=?", (digest, scope)).fetchone()
        return json.loads(row[0]) if row else None

    def source_event(self, name: str, data: dict[str, Any]) -> None:
        with self.connection() as conn:
            previous = conn.execute("SELECT payload FROM research_sources WHERE name=?", (name,)).fetchone()
            value = json.loads(previous[0]) if previous else {}
            value.update(data)
            conn.execute("INSERT INTO research_sources VALUES (?,?) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload", (name, self._json(value)))

    def review_mapping(self, record_id: str, expected_snapshot_hash: str, decision: str,
                       rationale: str, reviewer_scope: str, reviewed_at: str) -> dict[str, Any]:
        """Atomic, optimistic review of category proposals; source quality is separate."""
        with self.connection() as conn:
            row = conn.execute("SELECT snapshot_hash,payload FROM research_records WHERE id=?", (record_id,)).fetchone()
            if row is None:
                raise KeyError(record_id)
            if row[0] != expected_snapshot_hash:
                raise IdempotencyConflict("Record changed; inspect its latest snapshot before review")
            data = json.loads(row[1])
            data["mapping_status"] = "verified" if decision == "approve" else "rejected"
            data["human_verified"] = decision == "approve"
            event = {"decision": decision, "rationale": rationale, "reviewed_at": reviewed_at,
                     "reviewed_snapshot_hash": row[0], "scope": "Category mapping only; scientific validity unassessed"}
            data["provenance"]["mapping_review"] = event
            digest = compute_content_sha256({k: v for k, v in data.items() if k != "retrieved_at"})
            conn.execute("INSERT INTO research_snapshots VALUES (?,?,?,?)", (record_id, digest, row[0], self._json(data)))
            conn.execute("UPDATE research_records SET snapshot_hash=?,payload=? WHERE id=?", (digest, self._json(data), record_id))
            conn.execute("INSERT INTO research_mapping_reviews(record_id,reviewer_scope,payload) VALUES (?,?,?)", (record_id, reviewer_scope, self._json(event)))
        return {"record": data, "snapshot_hash": digest, "review": event}

    def sources(self) -> dict[str, Any]:
        with self.connection() as conn:
            rows = conn.execute("SELECT name,payload FROM research_sources").fetchall()
        return {name: json.loads(data) for name, data in rows}

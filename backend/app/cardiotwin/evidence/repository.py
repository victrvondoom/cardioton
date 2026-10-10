"""Evidence Passport repository and audit-chain persistence.

Stores immutable passports with append-only revision histories and tamper-detection.
"""

from __future__ import annotations

import copy
import threading
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException

from .passport import seal_passport, verify_evidence_passport

# Thread-safe in-memory store for passports (mirrors demo repository pattern)
_LOCK = threading.Lock()
_PASSPORTS: dict[str, dict[str, Any]] = {}
_CASE_INDEX: dict[str, list[str]] = {}


def save_passport(passport: dict[str, Any]) -> dict[str, Any]:
    """Persist an evidence passport and index by case_id."""
    pid = passport["passport_id"]
    cid = passport["case_id"]

    with _LOCK:
        if not verify_evidence_passport(passport)["is_valid"]:
            raise HTTPException(422, "Cannot save an invalid evidence passport")
        if pid in _PASSPORTS:
            if _PASSPORTS[pid] != passport:
                raise HTTPException(409, "Existing evidence passports cannot be overwritten")
            return copy.deepcopy(_PASSPORTS[pid])
        parent_id = passport.get("parent_passport_id")
        if parent_id:
            parent = _PASSPORTS.get(parent_id)
            if not parent or parent.get("case_id") != cid:
                raise HTTPException(422, "Parent passport must exist in the same case")
            if passport.get("previous_passport_hash") != parent["integrity"]["content_sha256"]:
                raise HTTPException(422, "Parent passport digest does not match")
        elif passport.get("previous_passport_hash") is not None:
            raise HTTPException(422, "A previous digest requires an explicit parent")
        _PASSPORTS[pid] = copy.deepcopy(passport)
        if cid not in _CASE_INDEX:
            _CASE_INDEX[cid] = []
        if pid not in _CASE_INDEX[cid]:
            _CASE_INDEX[cid].append(pid)

    return passport


def get_passport(passport_id: str) -> dict[str, Any] | None:
    """Retrieve an evidence passport by ID."""
    with _LOCK:
        res = _PASSPORTS.get(passport_id)
        return copy.deepcopy(res) if res is not None else None


def list_passports_for_case(case_id: str) -> list[dict[str, Any]]:
    """List all passports associated with a given case, ordered chronologically."""
    with _LOCK:
        pids = _CASE_INDEX.get(case_id, [])
        return [copy.deepcopy(_PASSPORTS[pid]) for pid in pids if pid in _PASSPORTS]


def sign_off_passport(
    passport_id: str,
    approver_id: str,
    approver_name: str,
    approver_role: str,
    scope: str = "Cardiology Multidisciplinary Team Sign-off",
    notes: str | None = None,
) -> dict[str, Any]:
    """Execute authenticated human clinical sign-off on an existing passport."""
    with _LOCK:
        if passport_id not in _PASSPORTS:
            raise HTTPException(404, f"Evidence passport '{passport_id}' not found")

        if not approver_id.strip() or not approver_name.strip():
            raise HTTPException(422, "Authenticated reviewer identity is required")
        if approver_role not in {"reviewer", "admin", "cardiologist"}:
            raise HTTPException(403, "Reviewer permission is required")
        p = _PASSPORTS[passport_id]
        if not verify_evidence_passport(p)["is_valid"]:
            raise HTTPException(409, "Invalid or modified passports cannot be reviewed")
        if p["governance"].get("status") in {"CLINICALLY_APPROVED", "RESEARCH_REVIEWED"}:
            raise HTTPException(409, "A completed review cannot be silently overwritten")
        content_hash = p["integrity"]["content_sha256"]

        # Record authenticated sign-off
        now_iso = datetime.now(UTC).isoformat()
        p["governance"] = {
            "status": "RESEARCH_REVIEWED",
            "clinical_approval": False,
            "approver_id": approver_id,
            "approver_name": approver_name,
            "approver_role": approver_role,
            "approval_timestamp": now_iso,
            "approval_scope": scope,
            "reviewed_content_sha256": content_hash,
            "ai_autonomous_prescribing_forbidden": True,
            "notes": notes,
        }
        # This records an authenticated workspace review, not clinical credential
        # verification. Seal the review state so fabricated approvals are detected.
        seal_passport(p)
        return copy.deepcopy(p)


def tamper_passport_for_testing(passport_id: str, modified_field: str, new_value: Any) -> dict[str, Any]:
    """Simulate malicious tampering for testing / demonstration verification."""
    with _LOCK:
        if passport_id not in _PASSPORTS:
            raise HTTPException(404, f"Evidence passport '{passport_id}' not found")
        p = _PASSPORTS[passport_id]
        p["clinical_facts"][modified_field] = new_value
        return copy.deepcopy(p)


def clear_store() -> None:
    """Reset repository for unit test isolation."""
    with _LOCK:
        _PASSPORTS.clear()
        _CASE_INDEX.clear()

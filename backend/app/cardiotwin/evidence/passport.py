"""Global Evidence Passport for CardioTwin.

Implements Pillar A:
- Deterministic JSON serialization (local format, not RFC 8785)
- Immutable SHA-256 content digest over clinically relevant facts
- Ed25519 digital signature
- Sealed assessment metadata and explicit parent links
- Tamper-detection verification
- Clinician sign-off governance gating
"""

from __future__ import annotations

import base64
import hashlib
import json
import math
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.cardiotwin.schema import FEATURES

# Ephemeral demonstration key. No published private seed, author identity,
# persistent trust root, or production key management is implied.
_DEMO_PRIVATE_KEY = Ed25519PrivateKey.generate()
_DEMO_PUBLIC_KEY = _DEMO_PRIVATE_KEY.public_key()
_DEMO_PUBLIC_BYTES = _DEMO_PUBLIC_KEY.public_bytes(
    encoding=Encoding.Raw, format=PublicFormat.Raw
)
DEMO_PUBLIC_KEY_B64 = base64.b64encode(_DEMO_PUBLIC_BYTES).decode("ascii")

PASSPORT_SCHEMA_VERSION = "2.5.0"
SOFTWARE_RELEASE = "CardioTwin-GlobalEvidence-v2.4.0-rev12"


def canonical_json_bytes(obj: Any) -> bytes:
    """Finite deterministic JSON, preserving all nonintegral float precision.

    This local Python serialization is not an RFC 8785 implementation. A digest
    establishes byte integrity, not scientific truth or the author's identity.
    """
    def _normalize(val: Any) -> Any:
        if isinstance(val, float):
            if not math.isfinite(val):
                raise ValueError("Passport values must be finite JSON numbers")
            if val.is_integer():
                return int(val)
            return val
        if isinstance(val, dict):
            if not all(isinstance(k, str) for k in val):
                raise ValueError("Passport JSON object keys must be strings")
            return {k: _normalize(v) for k, v in val.items()}
        if isinstance(val, list | tuple):
            return [_normalize(x) for x in val]
        if val is not None and not isinstance(val, str | int | bool):
            raise ValueError("Passport values must be JSON primitives")
        return val

    normalized = _normalize(obj)
    return json.dumps(normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode("utf-8")


def compute_content_sha256(clinical_facts: dict[str, Any]) -> str:
    """Compute deterministic SHA-256 over canonical representation of clinical facts."""
    return hashlib.sha256(canonical_json_bytes(clinical_facts)).hexdigest()


def sign_content_hash(content_hash_hex: str) -> str:
    """Sign content hash with Ed25519 private key."""
    sig_bytes = _DEMO_PRIVATE_KEY.sign(content_hash_hex.encode("ascii"))
    return base64.b64encode(sig_bytes).decode("ascii")


def verify_signature(content_hash_hex: str, signature_b64: str, public_key_b64: str = DEMO_PUBLIC_KEY_B64) -> bool:
    """Verify Ed25519 signature over content hash."""
    try:
        pub_bytes = base64.b64decode(public_key_b64)
        pub_key = Ed25519PublicKey.from_public_bytes(pub_bytes)
        sig_bytes = base64.b64decode(signature_b64)
        pub_key.verify(sig_bytes, content_hash_hex.encode("ascii"))
        return True
    except (InvalidSignature, ValueError, TypeError, UnicodeError):
        return False


def seal_passport(passport: dict[str, Any]) -> dict[str, Any]:
    """Seal all record content, including metadata, lineage and review state."""
    record = {key: value for key, value in passport.items() if key != "integrity"}
    record_hash = compute_content_sha256(record)
    passport["integrity"] = {
        "content_sha256": compute_content_sha256(passport["clinical_facts"]),
        "record_sha256": record_hash,
        "signature_ed25519": sign_content_hash(record_hash),
        "signer_public_key_b64": DEMO_PUBLIC_KEY_B64,
        "canonical_format": "CardioTwin deterministic JSON v2 (not RFC 8785)",
        "signing_purpose": "EPHEMERAL_DEMONSTRATION_INTEGRITY_ONLY",
        "author_identity_verified": False,
        "tamper_evident": True,
    }
    return passport


def build_evidence_passport(
    case_id: str,
    input_features: dict[str, Any],
    model_predictions: dict[str, Any],
    hemodynamics_results: dict[str, Any],
    guideline_results: dict[str, Any],
    conformal_bounds: dict[str, Any],
    parent_passport_id: str | None = None,
    previous_passport_hash: str | None = None,
    synthetic_demo: bool = True,
    reviewer_notes: str | None = None,
) -> dict[str, Any]:
    """Assemble and seal a complete, tamper-evident Global Evidence Passport."""
    now_utc = datetime.now(UTC).isoformat()
    passport_id = f"ct-pass-{uuid4().hex[:12]}"

    # Missing features audit
    legacy_features = [
        "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg",
        "thalach", "exang", "oldpeak", "slope", "ca", "thal"
    ]
    legacy_namespace = bool(set(input_features).intersection(legacy_features))
    expected_core_features = legacy_features if legacy_namespace else [feature.name for feature in FEATURES]
    provided_keys = {k for k, v in input_features.items() if v is not None}
    missing_keys = sorted([k for k in expected_core_features if k not in provided_keys])
    completeness_score = round((len(provided_keys.intersection(expected_core_features)) / len(expected_core_features)) * 100, 1)

    # Core clinical facts subject to cryptographic seal (everything except the envelope metadata)
    clinical_facts: dict[str, Any] = {
        "case_id": case_id,
        "input_features": dict(sorted(input_features.items())),
        "data_quality": {
            "completeness_score_pct": completeness_score,
            "missing_features": missing_keys,
            "synthetic_demonstration": synthetic_demo,
            "feature_schema": "legacy-demonstration-13" if legacy_namespace else "cardiotwin-served-model",
            "expected_feature_count": len(expected_core_features),
            "completeness_semantics": "Nonmissing supplied schema fields; not clinical sufficiency or measurement validity",
        },
        "model_assessment": {
            "cad_risk": model_predictions.get("cad", {}),
            "vessels": model_predictions.get("vessels", {}),
            "model_version": model_predictions.get("provenance", {}).get("model_version", "CardioTwin-v1.0"),
        },
        "hemodynamics": {
            "solver": hemodynamics_results.get("solver_type"),
            "governing_equations": hemodynamics_results.get("governing_equations", "ΔP = R_v·Q + R_i·Q²"),
            "total_flow_ml_min": hemodynamics_results.get("total_myocardial_perfusion_ml_min"),
            "vessels": hemodynamics_results.get("vessels", {}),
            "assumptions": hemodynamics_results.get("assumptions", []),
            "analysis_parameters": hemodynamics_results.get("analysis_parameters", {}),
        },
        "guidelines": {
            "standard": guideline_results.get("guideline_standard"),
            "primary_action": guideline_results.get("primary_recommendation", {}).get("action"),
            "rules_evaluated": guideline_results.get("all_rules_evaluated", []),
            "verification_status": guideline_results.get("verification_status"),
        },
        "uncertainty": {
            "conformal_method": conformal_bounds.get("conformal_method"),
            "guaranteed_coverage": conformal_bounds.get("guaranteed_coverage"),
            "bounded_targets": conformal_bounds.get("bounded_targets", {}),
            "calibration_provenance": conformal_bounds.get("calibration_provenance"),
            "coverage_assumptions": conformal_bounds.get("coverage_assumptions", []),
            "missingness_method": conformal_bounds.get("missingness_method"),
            "interval_semantics": conformal_bounds.get("interval_semantics"),
        },
        "reproducibility": {
            "model_provenance": model_predictions.get("provenance", {}),
            "input_digest_sha256": compute_content_sha256(input_features),
            "source_references": model_predictions.get("source_references", []),
        },
    }

    content_hash = compute_content_sha256(clinical_facts)
    signature = sign_content_hash(content_hash)

    passport = {
        "passport_id": passport_id,
        "case_id": case_id,
        "schema_version": PASSPORT_SCHEMA_VERSION,
        "software_release": SOFTWARE_RELEASE,
        "created_at_utc": now_utc,
        "parent_passport_id": parent_passport_id,
        "previous_passport_hash": previous_passport_hash,
        "clinical_facts": clinical_facts,
        "integrity": {
            "content_sha256": content_hash,
            "signature_ed25519": signature,
            "signer_public_key_b64": DEMO_PUBLIC_KEY_B64,
            "canonical_format": "CardioTwin deterministic finite JSON v1 (not RFC 8785)",
            "tamper_evident": True,
        },
        "governance": {
            "status": "PENDING_CLINICAL_SIGN_OFF",
            "approver_id": None,
            "approver_name": None,
            "approval_timestamp": None,
            "approval_scope": None,
            "reviewed_content_sha256": None,
            "ai_autonomous_prescribing_forbidden": True,
            "notes": reviewer_notes,
        },
    }

    return seal_passport(passport)


def verify_evidence_passport(
    passport_data: dict[str, Any], *, trusted_public_key_b64: str = DEMO_PUBLIC_KEY_B64,
) -> dict[str, Any]:
    """Independent verification of passport cryptographic integrity and governance."""
    try:
        clinical_facts = passport_data["clinical_facts"]
        integrity = passport_data["integrity"]
        recorded_hash = integrity["content_sha256"]
        signature = integrity["signature_ed25519"]
        pub_key = integrity["signer_public_key_b64"]
        recorded_record_hash = integrity["record_sha256"]
        computed_hash = compute_content_sha256(clinical_facts)
        record = {key: value for key, value in passport_data.items() if key != "integrity"}
        computed_record_hash = compute_content_sha256(record)
        if not isinstance(recorded_hash, str) or not isinstance(recorded_record_hash, str):
            raise ValueError("Digests must be hexadecimal strings")
    except (KeyError, ValueError, TypeError, AttributeError, RecursionError) as exc:
        return {
            "is_valid": False,
            "tamper_detected": True,
            "error": f"Missing passport structural field: {exc}",
            "checklist": [],
        }

    # 1. Recompute canonical content SHA-256
    hash_match = (computed_hash == recorded_hash)
    record_match = computed_record_hash == recorded_record_hash

    # 2. Verify digital signature over content hash
    key_trusted = pub_key == trusted_public_key_b64
    sig_valid = key_trusted and verify_signature(recorded_record_hash, signature, trusted_public_key_b64)

    # 3. Check governance sign-off consistency if approved
    gov = passport_data.get("governance", {})
    gov_valid = True
    gov_message = "Governance state valid"
    if gov.get("status") in ("CLINICALLY_APPROVED", "RESEARCH_REVIEWED"):
        if gov.get("reviewed_content_sha256") != computed_hash:
            gov_valid = False
            gov_message = "Clinician signed off on a different content digest; record has been modified post-approval!"
        elif not gov.get("approver_id"):
            gov_valid = False
            gov_message = "Approval status marked APPROVED without recorded approver identity."

    tamper_detected = not (hash_match and record_match and sig_valid and gov_valid)

    checklist = [
        {
            "check": "CardioTwin deterministic finite JSON serialization",
            "status": "PASSED",
            "details": "Deterministic representation successfully reconstructed",
        },
        {
            "check": "Record metadata, lineage and governance digest equality",
            "status": "PASSED" if record_match else "FAILED",
            "details": "All record fields excluding the integrity envelope are sealed",
        },
        {
            "check": "SHA-256 Content Hash Equality",
            "status": "PASSED" if hash_match else "FAILED",
            "details": f"Recorded: {recorded_hash[:16]}... vs Computed: {computed_hash[:16]}...",
        },
        {
            "check": "Ed25519 Asymmetric Digital Signature",
            "status": "PASSED" if sig_valid else "FAILED",
            "details": "Verified using independently pinned public key" if sig_valid else "Untrusted signing key or invalid record signature",
        },
        {
            "check": "Human Governance Post-Approval Integrity",
            "status": "PASSED" if gov_valid else "FAILED",
            "details": gov_message,
        },
    ]

    return {
        "is_valid": not tamper_detected,
        "tamper_detected": tamper_detected,
        "computed_sha256": computed_hash,
        "recorded_sha256": recorded_hash,
        "signature_valid": sig_valid,
        "signing_key_trusted": key_trusted,
        "record_integrity_valid": record_match,
        "author_identity_verified": False,
        "limitations": ["Hash integrity does not establish scientific truth", "Default signer is ephemeral and does not establish clinician identity", "Parent references are sealed but independent verification of the full chain requires the referenced records"],
        "governance_valid": gov_valid,
        "checklist": checklist,
        "verified_at_utc": datetime.now(UTC).isoformat(),
    }

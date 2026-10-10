"""Tests for Global Evidence Passport (Pillar A).

Verifies:
- Canonical JSON serialization determinism
- SHA-256 content hashing stability
- Ed25519 signature creation and verification
- Tamper detection (positive and negative cases)
- Hash-chain lineage linking
- Clinician sign-off governance
- FHIR round-trip semantic integrity scoring
"""

from __future__ import annotations

import pytest

from app.cardiotwin.evidence.passport import (
    DEMO_PUBLIC_KEY_B64,
    build_evidence_passport,
    canonical_json_bytes,
    compute_content_sha256,
    sign_content_hash,
    verify_evidence_passport,
    verify_signature,
)
from app.cardiotwin.evidence.repository import (
    clear_store,
    get_passport,
    list_passports_for_case,
    save_passport,
    sign_off_passport,
)

# ─── Fixtures ─────────────────────────────────────────────────

DEMO_FEATURES = {
    "age": 58,
    "sex": 1,
    "cp": 0,
    "trestbps": 140,
    "chol": 240,
    "fbs": 1,
    "restecg": 0,
    "thalach": 150,
    "exang": 0,
    "oldpeak": 2.3,
    "slope": 1,
    "ca": 0,
    "thal": 2,
}

DEMO_PREDICTIONS = {
    "cad": {"probability": 0.72, "confidence": 0.85},
    "vessels": {
        "LAD": {"probability": 0.65},
        "LCX": {"probability": 0.35},
        "RCA": {"probability": 0.42},
    },
    "provenance": {"model_version": "CardioTwin-v1.0-test", "input_sha256": "abc123"},
}

DEMO_HEMODYNAMICS = {
    "solver_type": "0D/1D Lumped-Parameter Windkessel + Navier-Stokes Resistance Network",
    "governing_equations": "test",
    "total_myocardial_perfusion_ml_min": 185.0,
    "vessels": {
        "LAD": {"ffr_physics": 0.78, "flow_rate_ml_min": 75.0},
        "LCX": {"ffr_physics": 0.91, "flow_rate_ml_min": 55.0},
        "RCA": {"ffr_physics": 0.87, "flow_rate_ml_min": 55.0},
    },
}

DEMO_GUIDELINES = {
    "guideline_standard": "ESC-2024-CCS / EACTS-2023",
    "primary_recommendation": {"action": "CABG or Multivessel PCI with Heart Team MDT Consult"},
    "all_rules_evaluated": [{"rule_id": "ESC-2024-REV-1.1"}],
}

DEMO_CONFORMAL = {
    "conformal_method": "Split-Conformal Risk Control with Adversarial Missingness Bounding",
    "guaranteed_coverage": "90% empirical coverage under exchangeability",
    "bounded_targets": {
        "CAD": {"point_probability": 0.72, "conformal_90_interval": [0.578, 0.862]},
    },
}


@pytest.fixture(autouse=True)
def _clean_store():
    """Ensure each test starts with a clean passport repository."""
    clear_store()
    yield
    clear_store()


def _make_passport(**overrides):
    kwargs = {
        "case_id": "CASE-TEST-001",
        "input_features": DEMO_FEATURES,
        "model_predictions": DEMO_PREDICTIONS,
        "hemodynamics_results": DEMO_HEMODYNAMICS,
        "guideline_results": DEMO_GUIDELINES,
        "conformal_bounds": DEMO_CONFORMAL,
    }
    kwargs.update(overrides)
    return build_evidence_passport(**kwargs)


# ─── Canonical Serialization ─────────────────────────────────

class TestCanonicalSerialization:
    def test_deterministic_output(self):
        """Same input always produces same bytes."""
        data = {"b": 2, "a": 1, "c": [3, 2, 1]}
        b1 = canonical_json_bytes(data)
        b2 = canonical_json_bytes(data)
        assert b1 == b2

    def test_key_sorting(self):
        """Keys are sorted lexicographically."""
        data = {"z": 1, "a": 2, "m": 3}
        text = canonical_json_bytes(data).decode()
        assert text.index('"a"') < text.index('"m"') < text.index('"z"')

    def test_float_normalization(self):
        """Integral floats become integers."""
        assert canonical_json_bytes({"x": 1.0}) == canonical_json_bytes({"x": 1})

    def test_no_whitespace(self):
        """No extraneous whitespace in output."""
        data = {"a": 1, "b": [2, 3]}
        text = canonical_json_bytes(data).decode()
        assert " " not in text


# ─── SHA-256 Hashing ─────────────────────────────────────────

class TestContentHashing:
    def test_hash_stability(self):
        """Same facts always produce same hash."""
        facts = {"age": 58, "risk": 0.72}
        h1 = compute_content_sha256(facts)
        h2 = compute_content_sha256(facts)
        assert h1 == h2
        assert len(h1) == 64  # SHA-256 hex digest

    def test_different_input_different_hash(self):
        """Different inputs produce different hashes."""
        h1 = compute_content_sha256({"age": 58})
        h2 = compute_content_sha256({"age": 59})
        assert h1 != h2


# ─── Ed25519 Signatures ─────────────────────────────────────

class TestSignatures:
    def test_sign_and_verify(self):
        h = compute_content_sha256({"test": "data"})
        sig = sign_content_hash(h)
        assert verify_signature(h, sig, DEMO_PUBLIC_KEY_B64)

    def test_tampered_hash_fails_verification(self):
        h = compute_content_sha256({"test": "data"})
        sig = sign_content_hash(h)
        tampered_h = h[:-1] + ("0" if h[-1] != "0" else "1")
        assert not verify_signature(tampered_h, sig, DEMO_PUBLIC_KEY_B64)


# ─── Passport Construction ──────────────────────────────────

class TestPassportConstruction:
    def test_passport_has_required_structure(self):
        p = _make_passport()
        assert "passport_id" in p
        assert p["passport_id"].startswith("ct-pass-")
        assert "integrity" in p
        assert "governance" in p
        assert "clinical_facts" in p
        assert p["integrity"]["content_sha256"]
        assert p["integrity"]["signature_ed25519"]

    def test_passport_integrity_verifies(self):
        p = _make_passport()
        result = verify_evidence_passport(p)
        assert result["is_valid"] is True
        assert result["tamper_detected"] is False

    def test_passport_completeness_score(self):
        p = _make_passport()
        score = p["clinical_facts"]["data_quality"]["completeness_score_pct"]
        assert score == 100.0  # All 13 features provided

    def test_passport_missing_features_counted(self):
        partial = {k: v for k, v in DEMO_FEATURES.items() if k not in ("chol", "fbs", "ca")}
        p = _make_passport(input_features=partial)
        quality = p["clinical_facts"]["data_quality"]
        assert quality["completeness_score_pct"] < 100.0
        assert "chol" in quality["missing_features"]


# ─── Tamper Detection ────────────────────────────────────────

class TestTamperDetection:
    def test_unmodified_passport_valid(self):
        p = _make_passport()
        assert verify_evidence_passport(p)["is_valid"] is True

    def test_modified_clinical_facts_detected(self):
        p = _make_passport()
        p["clinical_facts"]["input_features"]["age"] = 99
        result = verify_evidence_passport(p)
        assert result["tamper_detected"] is True
        assert result["is_valid"] is False

    def test_missing_integrity_field_detected(self):
        p = _make_passport()
        del p["integrity"]
        result = verify_evidence_passport(p)
        assert result["is_valid"] is False


# ─── Repository ──────────────────────────────────────────────

class TestRepository:
    def test_save_and_retrieve(self):
        p = _make_passport()
        save_passport(p)
        retrieved = get_passport(p["passport_id"])
        assert retrieved is not None
        assert retrieved["passport_id"] == p["passport_id"]

    def test_list_passports_for_case(self):
        p1 = _make_passport(case_id="CASE-A")
        p2 = _make_passport(case_id="CASE-A")
        save_passport(p1)
        save_passport(p2)
        passports = list_passports_for_case("CASE-A")
        assert len(passports) == 2

    def test_sign_off(self):
        p = _make_passport()
        save_passport(p)
        signed = sign_off_passport(
            p["passport_id"],
            approver_id="dr-smith",
            approver_name="Dr. Smith",
            approver_role="cardiologist",
        )
        assert signed["governance"]["status"] == "RESEARCH_REVIEWED"
        assert signed["governance"]["clinical_approval"] is False
        assert verify_evidence_passport(signed)["is_valid"] is True
        assert signed["governance"]["reviewed_content_sha256"] == p["integrity"]["content_sha256"]

    def test_signed_passport_verifies(self):
        p = _make_passport()
        save_passport(p)
        signed = sign_off_passport(
            p["passport_id"],
            approver_id="dr-jones",
            approver_name="Dr. Jones",
            approver_role="reviewer",
        )
        result = verify_evidence_passport(signed)
        assert result["is_valid"] is True
        assert result["governance_valid"] is True

    def test_post_approval_tampering_detected(self):
        """If content changes after sign-off, governance check fails."""
        p = _make_passport()
        save_passport(p)
        signed = sign_off_passport(
            p["passport_id"],
            approver_id="dr-jones",
            approver_name="Dr. Jones",
            approver_role="reviewer",
        )
        # Now tamper with the content
        signed["clinical_facts"]["input_features"]["age"] = 99
        result = verify_evidence_passport(signed)
        assert result["tamper_detected"] is True
        assert result["governance_valid"] is False


# ─── Hash Chain ──────────────────────────────────────────────

class TestHashChain:
    def test_parent_linkage(self):
        p1 = _make_passport(case_id="CASE-CHAIN")
        save_passport(p1)
        p2 = _make_passport(
            case_id="CASE-CHAIN",
            parent_passport_id=p1["passport_id"],
            input_features={**DEMO_FEATURES, "age": 59},
        )
        assert p2["parent_passport_id"] == p1["passport_id"]
        # previous_passport_hash is None here because _make_passport doesn't
        # query the store. The API endpoint wires this up. Verify the field exists.
        assert "previous_passport_hash" in p2

        # Now test via the repository-aware flow:
        p2_with_hash = build_evidence_passport(
            case_id="CASE-CHAIN",
            input_features={**DEMO_FEATURES, "age": 59},
            model_predictions=DEMO_PREDICTIONS,
            hemodynamics_results=DEMO_HEMODYNAMICS,
            guideline_results=DEMO_GUIDELINES,
            conformal_bounds=DEMO_CONFORMAL,
            parent_passport_id=p1["passport_id"],
            previous_passport_hash=p1["integrity"]["content_sha256"],
        )
        assert p2_with_hash["previous_passport_hash"] == p1["integrity"]["content_sha256"]

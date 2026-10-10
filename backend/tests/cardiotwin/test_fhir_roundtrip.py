"""Tests for FHIR R4 Semantic Round-Trip (Pillar D).

Verifies:
- FHIR Bundle export produces valid structure
- Import reconstructs assessment fields
- Semantic integrity score correctly identifies preserved vs dropped fields
- Hash integrity survives round-trip
"""

from __future__ import annotations

import pytest

from app.cardiotwin.evidence.passport import build_evidence_passport
from app.cardiotwin.interop.fhir_exchange import (
    compute_semantic_round_trip_score,
    export_to_fhir_bundle,
    import_from_fhir_bundle,
)

# ─── Shared test data ────────────────────────────────────────

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
    "cad": {"probability": 0.72},
    "vessels": {
        "LAD": {"probability": 0.65},
        "LCX": {"probability": 0.35},
        "RCA": {"probability": 0.42},
    },
    "provenance": {"model_version": "test-v1"},
}

DEMO_HEMODYNAMICS = {
    "solver_type": "0D/1D Windkessel",
    "governing_equations": "test eq",
    "total_myocardial_perfusion_ml_min": 185.0,
    "vessels": {
        "LAD": {"ffr_physics": 0.78, "flow_rate_ml_min": 75.0},
        "LCX": {"ffr_physics": 0.91, "flow_rate_ml_min": 55.0},
        "RCA": {"ffr_physics": 0.87, "flow_rate_ml_min": 55.0},
    },
}

DEMO_GUIDELINES = {
    "guideline_standard": "ESC-2024",
    "primary_recommendation": {"action": "CABG Consult"},
    "all_rules_evaluated": [{"rule_id": "ESC-2024-REV-1.1"}],
}

DEMO_CONFORMAL = {
    "conformal_method": "Split-Conformal",
    "guaranteed_coverage": "90%",
    "bounded_targets": {"CAD": {"point_probability": 0.72}},
}


def _make_passport():
    return build_evidence_passport(
        case_id="CASE-FHIR-TEST",
        input_features=DEMO_FEATURES,
        model_predictions=DEMO_PREDICTIONS,
        hemodynamics_results=DEMO_HEMODYNAMICS,
        guideline_results=DEMO_GUIDELINES,
        conformal_bounds=DEMO_CONFORMAL,
    )


# ─── Export Tests ────────────────────────────────────────────

class TestFhirExport:
    def test_bundle_structure(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "collection"
        assert len(bundle["entry"]) > 0

    def test_contains_patient_resource(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        types = [e["resource"]["resourceType"] for e in bundle["entry"]]
        assert "Patient" in types

    def test_contains_observations(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        obs_count = sum(1 for e in bundle["entry"] if e["resource"]["resourceType"] == "Observation")
        assert obs_count >= 3  # At least some inputs + FFR values

    def test_contains_diagnostic_report(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        types = [e["resource"]["resourceType"] for e in bundle["entry"]]
        assert "DiagnosticReport" in types

    def test_contains_provenance(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        types = [e["resource"]["resourceType"] for e in bundle["entry"]]
        assert "Provenance" in types

    def test_passport_hash_in_diagnostic_report(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        for entry in bundle["entry"]:
            r = entry["resource"]
            if r["resourceType"] == "DiagnosticReport":
                exts = r.get("extension", [])
                hash_ext = [e for e in exts if e.get("url") == "urn:cardiotwin:passport-integrity"]
                assert len(hash_ext) == 1
                assert hash_ext[0]["valueString"] == passport["integrity"]["content_sha256"]
                return
        pytest.fail("DiagnosticReport not found")


# ─── Import Tests ────────────────────────────────────────────

class TestFhirImport:
    def test_extracts_patient(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        extracted = import_from_fhir_bundle(bundle)
        assert extracted["patient"]["case_id"] == "CASE-FHIR-TEST"

    def test_extracts_observations(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        extracted = import_from_fhir_bundle(bundle)
        # Should have at least some LOINC-mapped features
        assert len(extracted["observations"]) > 0

    def test_extracts_ffr_values(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        extracted = import_from_fhir_bundle(bundle)
        assert "LAD" in extracted["ffr_values"]
        assert "LCX" in extracted["ffr_values"]
        assert "RCA" in extracted["ffr_values"]

    def test_extracts_passport_hash(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        extracted = import_from_fhir_bundle(bundle)
        assert extracted["passport_sha256"] == passport["integrity"]["content_sha256"]


# ─── Semantic Round-Trip Score ───────────────────────────────

class TestSemanticRoundTrip:
    def test_score_computed(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        score = compute_semantic_round_trip_score(passport, bundle)
        integrity = score["semantic_integrity_score"]
        assert "total_fields" in integrity
        assert "preserved" in integrity
        assert "score_pct" in integrity

    def test_loinc_mapped_fields_preserved(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        score = compute_semantic_round_trip_score(passport, bundle)
        preserved_fields = [
            f["field"] for f in score["field_results"] if f["status"] == "PRESERVED"
        ]
        # age, trestbps, chol, thalach, oldpeak, fbs all have LOINC mappings
        assert "age" in preserved_fields
        assert "trestbps" in preserved_fields

    def test_ffr_values_preserved(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        score = compute_semantic_round_trip_score(passport, bundle)
        preserved_fields = [
            f["field"] for f in score["field_results"] if f["status"] == "PRESERVED"
        ]
        assert "ffr_LAD" in preserved_fields

    def test_hash_preserved(self):
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        score = compute_semantic_round_trip_score(passport, bundle)
        hash_result = [f for f in score["field_results"] if f["field"] == "passport_sha256"]
        assert len(hash_result) == 1
        assert hash_result[0]["status"] == "PRESERVED"

    def test_unmapped_features_counted_as_dropped(self):
        """Features without LOINC codes should appear as NO_LOINC_MAPPING."""
        passport = _make_passport()
        bundle = export_to_fhir_bundle(passport)
        score = compute_semantic_round_trip_score(passport, bundle)
        statuses = {f["field"]: f["status"] for f in score["field_results"]}
        # 'cp' has no LOINC mapping
        assert statuses.get("cp") in ("NO_LOINC_MAPPING", "DROPPED")

    def test_non_bundle_returns_error(self):
        extracted = import_from_fhir_bundle({"resourceType": "Patient"})
        assert "error" in extracted

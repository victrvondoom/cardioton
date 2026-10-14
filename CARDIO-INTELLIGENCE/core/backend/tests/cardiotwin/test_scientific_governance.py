"""Meaningful scientific/integrity regressions for the continuation repairs."""
from __future__ import annotations

import base64
from copy import deepcopy

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.cardiotwin.analytics.core__cardiotwin_analytics__fixtures import demo_records
from app.cardiotwin.core__app_cardiotwin__conformal import (
    analyze_missingness_bounds,
    compute_conformal_interval,
    split_conformal_quantile,
)
from app.cardiotwin.evidence.core__cardiotwin_evidence__passport import (
    compute_content_sha256,
    verify_evidence_passport,
)
from app.cardiotwin.evidence.core__cardiotwin_evidence__repository import (
    clear_store,
    get_passport,
    save_passport,
)
from app.cardiotwin.guideline_engine import evaluate_guidelines
from app.cardiotwin.hemodynamics.physics import solve_vessel_physics
from app.cardiotwin.interop.fhir_exchange import (
    LOCAL_SYSTEM,
    compute_semantic_round_trip_score,
    export_to_fhir_bundle,
    import_from_fhir_bundle,
)
from app.cardiotwin.mapping.core__cardiotwin_mapping__engine import EvidenceMappingEngine
from app.main import app

from .test_evidence_passport import _make_passport


def test_finite_sample_conformal_order_statistic_and_alpha():
    assert split_conformal_quantile([.1, .2, .3, .4], .2) == .4
    assert split_conformal_quantile([.1, .2, .3, .4], .4) == .3
    assert split_conformal_quantile([.1], .1) == 1
    assert compute_conformal_interval("CAD", .7) == (0, 1)
    with pytest.raises(ValueError):
        split_conformal_quantile([float("nan")])
    with pytest.raises(ValueError):
        compute_conformal_interval("CAD", .7, 0)


def test_missingness_does_not_claim_coverage_or_order_tests():
    result = analyze_missingness_bounds({"age": 50, "chol": None}, ["age", "chol"], {"CAD": .7})
    assert result["guaranteed_coverage"] is None
    assert result["missing_features"] == ["chol"]
    assert result["bounded_targets"]["CAD"]["calibration_sample_count"] == 0
    assert result["bounded_targets"]["CAD"]["robust_missingness_bounds"] == [0, 1]
    assert result["critical_information_deficit"][0]["clinical_recommendation"] is None


def test_guideline_missing_inputs_remain_unresolved_and_treatment_unselected():
    result = evaluate_guidelines({}, {}, {"LAD": .8})
    assert result["flagged_vessels"] == ["LAD"]
    assert set(result["missing_information"]) == {"ffr_values.LCX", "ffr_values.RCA"}
    assert result["all_rules_evaluated"][1]["execution_outcome"] == "NOT_EVALUABLE"
    assert result["primary_recommendation"]["class_of_recommendation"] is None
    assert result["human_governance"]["ai_autonomous_prescribing"] is False
    assert all(rule["source_url"].startswith("https:") for rule in result["all_rules_evaluated"])
    with pytest.raises(ValueError):
        evaluate_guidelines({}, {}, {"LAD": float("inf")})


@pytest.mark.parametrize("field,value", [("case_id", "other-case"), ("parent_passport_id", "forged-parent"), ("created_at_utc", "changed")])
def test_passport_seals_envelope_and_lineage(field, value):
    passport = _make_passport()
    assert verify_evidence_passport(passport)["is_valid"]
    passport[field] = value
    assert verify_evidence_passport(passport)["tamper_detected"]


def test_passport_precision_nan_and_untrusted_signer():
    assert compute_content_sha256({"measurement": .12345671}) != compute_content_sha256({"measurement": .12345672})
    with pytest.raises(ValueError):
        compute_content_sha256({"measurement": float("nan")})
    passport = _make_passport()
    attacker = Ed25519PrivateKey.generate()
    passport["integrity"]["signer_public_key_b64"] = base64.b64encode(attacker.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)).decode()
    passport["integrity"]["signature_ed25519"] = base64.b64encode(attacker.sign(passport["integrity"]["record_sha256"].encode())).decode()
    assert verify_evidence_passport(passport)["signing_key_trusted"] is False


def test_append_only_passport_identity():
    clear_store()
    try:
        passport = _make_passport()
        save_passport(passport)
        changed = deepcopy(passport)
        changed["clinical_facts"]["input_features"]["age"] += 1
        with pytest.raises(Exception) as error:
            save_passport(changed)
        assert error.value.status_code == 422
        assert get_passport(passport["passport_id"])["clinical_facts"]["input_features"]["age"] == 58
    finally:
        clear_store()


def test_steady_solver_limiting_geometry_and_reproducibility():
    baseline = solve_vessel_physics("LAD", 0)
    near = solve_vessel_physics("LAD", 1e-8)
    severe = solve_vessel_physics("LAD", 80)
    assert baseline.ffr == near.ffr
    assert baseline.ffr > severe.ffr and baseline.flow_rate_ml_min > severe.flow_rate_ml_min
    assert baseline.aortic_pressure_mmhg == pytest.approx(baseline.distal_pressure_mmhg + baseline.translesional_dp_mmhg, abs=.11)
    assert baseline == solve_vessel_physics("LAD", 0)
    with pytest.raises(ValueError):
        solve_vessel_physics("LAD", -1)
    with pytest.raises(ValueError):
        solve_vessel_physics("LAD", 20, blood_viscosity_pa_s=0)


def test_fhir_binary_glucose_retains_encoding_without_false_concentration():
    passport = _make_passport()
    bundle = export_to_fhir_bundle(passport)
    coded = [e["resource"] for e in bundle["entry"] if e["resource"].get("code", {}).get("coding", [{}])[0].get("code") == "fbs"]
    assert len(coded) == 1
    assert coded[0]["code"]["coding"][0]["system"] == LOCAL_SYSTEM
    assert "valueQuantity" not in coded[0]
    assert import_from_fhir_bundle(bundle)["observations"]["fbs"] == 1
    report = compute_semantic_round_trip_score(passport, bundle)
    assert "fbs" in report["transformed_fields"]
    patient_url = next(entry["fullUrl"] for entry in bundle["entry"] if entry["resource"]["resourceType"] == "Patient")
    assert import_from_fhir_bundle(bundle)["resource_metadata"][patient_url]["identifier"][0]["value"] == passport["case_id"]


def test_served_model_schema_is_sealed_and_roundtripped_without_fake_terminology():
    from app.cardiotwin.schema import FEATURES

    values = {feature.name: None for feature in FEATURES}
    values.update({"Age": 64, "BP": 150, "Sex": "Female", "LDL": None})
    passport = _make_passport(input_features=values)
    quality = passport["clinical_facts"]["data_quality"]
    assert quality["feature_schema"] == "cardiotwin-served-model"
    assert quality["expected_feature_count"] == len(FEATURES)
    assert "BP" not in quality["missing_features"]
    bundle = export_to_fhir_bundle(passport)
    imported = import_from_fhir_bundle(bundle)
    assert imported["observations"]["BP"] == 150
    assert imported["observations"]["Sex"] == "Female"
    assert imported["observations"]["LDL"] is None
    assert "LOINC" not in str(next(entry["resource"] for entry in bundle["entry"] if entry["resource"].get("code", {}).get("coding", [{}])[0].get("code") == "input:BP"))
    assert imported["patient"]["gender"] == "female"
    assert compute_semantic_round_trip_score(passport, bundle)["semantic_integrity_score"]["preserved"] >= len(FEATURES)


def test_fhir_invalid_units_and_references_do_not_silently_roundtrip():
    passport = _make_passport()
    bundle = export_to_fhir_bundle(passport)
    pressure = next(e["resource"] for e in bundle["entry"] if e["resource"].get("code", {}).get("coding", [{}])[0].get("code") == "8480-6")
    pressure["valueQuantity"]["code"] = "kPa"
    result = import_from_fhir_bundle(bundle)
    assert "trestbps" not in result["observations"]
    assert any(item["field"] == "trestbps" for item in result["unresolved_fields"])
    pressure["subject"]["reference"] = "Patient/unknown"
    assert "error" in import_from_fhir_bundle(bundle)


@pytest.mark.parametrize("malformed", [
    {"resourceType": "Bundle", "type": "collection", "entry": [None]},
    {"resourceType": "Bundle", "type": "collection", "entry": [{"fullUrl": [], "resource": {}}]},
    {"resourceType": "Bundle", "type": "collection", "entry": [{"fullUrl": "urn:uuid:broken", "resource": None}]},
])
def test_malformed_fhir_shapes_are_rejected(malformed):
    assert "error" in import_from_fhir_bundle(malformed)


def test_fhir_requires_one_patient_and_valid_subject_type():
    bundle = export_to_fhir_bundle(_make_passport())
    second = deepcopy(next(entry for entry in bundle["entry"] if entry["resource"]["resourceType"] == "Patient"))
    second["fullUrl"] = "urn:uuid:second-patient"
    bundle["entry"].append(second)
    assert "error" in import_from_fhir_bundle(bundle)
    bundle["entry"].pop()
    observation = next(entry for entry in bundle["entry"] if entry["resource"]["resourceType"] == "Observation")
    observation["resource"]["subject"]["reference"] = observation["fullUrl"]
    assert "error" in import_from_fhir_bundle(bundle)


@pytest.mark.parametrize("design,metadata,expected", [
    ("Nonrandomized trial", {}, 0),
    ("Randomized controlled trial", {}, 100),
    ("INTERVENTIONAL", {"study_design": {"allocation": "RANDOMIZED"}}, 100),
    ("INTERVENTIONAL", {"study_design": {"allocation": "NON_RANDOMIZED"}}, 0),
])
def test_design_statistics_require_explicit_randomization(design, metadata, expected):
    record = demo_records()[0]
    record.study_design = design
    record.trial_metadata = metadata
    engine = object.__new__(EvidenceMappingEngine)
    assert engine.get_review_stats([record]).rct_percentage == expected


def test_passport_api_owner_isolation_review_roles_and_copy_tamper():
    clear_store()
    client = TestClient(app)
    original = app.dependency_overrides.get(get_current_user)
    user = {"id": "owner-a", "organization_id": "org-a", "email": "owner@example.test", "role": "coordinator"}
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        passport = _make_passport()
        passport["access_context"] = {"organization_id": "org-a", "owner_user_id": "owner-a"}
        from app.cardiotwin.evidence.core__cardiotwin_evidence__passport import seal_passport
        seal_passport(passport)
        save_passport(passport)
        other_owner = _make_passport(case_id=passport["case_id"])
        other_owner["access_context"] = {"organization_id": "org-a", "owner_user_id": "owner-b"}
        seal_passport(other_owner)
        save_passport(other_owner)
        base = "/api/v1/cardiotwin/evidence/passports/" + passport["passport_id"]
        assert client.get(base).status_code == 200
        assessments = client.get(base + "/history").json()["all_case_assessments"]
        assert [item["passport_id"] for item in assessments] == [passport["passport_id"]]
        assert client.post(base + "/sign-off", json={}).status_code == 403
        user["organization_id"] = "org-b"
        assert client.get(base).status_code == 404
        user.update(organization_id="org-a", role="reviewer")
        tamper = client.post(base + "/tamper-test", json={}).json()
        assert tamper["verification_result"]["tamper_detected"] is True
        assert client.post(base + "/verify").json()["is_valid"] is True
        reviewed = client.post(base + "/sign-off", json={})
        assert reviewed.status_code == 200
        assert reviewed.json()["governance"]["status"] == "RESEARCH_REVIEWED"
        assert client.post(base + "/sign-off", json={}).status_code == 409
    finally:
        clear_store()
        client.close()
        if original is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original

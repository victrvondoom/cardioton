"""Evidence Passport API Router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.cardiotwin.conformal import analyze_missingness_bounds
from app.cardiotwin.evidence.passport import (
    build_evidence_passport,
    verify_evidence_passport,
)
from app.cardiotwin.evidence.repository import (
    get_passport,
    list_passports_for_case,
    save_passport,
    sign_off_passport,
    tamper_passport_for_testing,
)
from app.cardiotwin.guideline_engine import evaluate_guidelines
from app.cardiotwin.hemodynamics.physics import solve_coronary_tree_physics
from app.cardiotwin.interop.fhir_exchange import (
    compute_semantic_round_trip_score,
    export_to_fhir_bundle,
    import_from_fhir_bundle,
)
from app.cardiotwin.model import load_model
from app.cardiotwin.schema import FEATURES

router = APIRouter(prefix="/evidence", tags=["cardiotwin-evidence"])


class CreatePassportRequest(BaseModel):
    case_id: str = Field(default="CASE-SYNTH-8492", max_length=120)
    features: dict[str, Any]
    parent_passport_id: str | None = None
    synthetic_demo: bool = True
    reviewer_notes: str | None = None


class SignOffRequest(BaseModel):
    scope: str = Field(default="ESC/ACC Guideline Team Clinical Review", max_length=200)
    notes: str | None = Field(default=None, max_length=1000)


class TamperTestRequest(BaseModel):
    modified_field: str = Field(default="data_quality", max_length=100)
    new_value: Any = Field(default={"completeness_score_pct": 100.0, "tampered": True})


@router.post("/passports")
async def create_passport_endpoint(
    req: CreatePassportRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate, cryptographically seal, and store an evidence passport."""
    model = load_model()
    predictions = model.predict(req.features)

    # 1. Hemodynamics
    vessel_stenoses = {
        v: round(predictions["vessels"][v]["probability"] * 85.0, 1)
        for v in ("LAD", "LCX", "RCA")
    }
    raw_trestbps = req.features.get("trestbps")
    sbp = float(raw_trestbps) if isinstance(raw_trestbps, int | float) else 124.0
    dbp = sbp * 0.65
    map_val = dbp + (sbp - dbp) / 3.0
    hemo = solve_coronary_tree_physics(vessel_stenoses, mean_aortic_pressure_mmhg=map_val)

    # 2. Guidelines
    ffr_values = {v: hemo["vessels"][v]["ffr_physics"] for v in ("LAD", "LCX", "RCA")}
    guidelines = evaluate_guidelines(
        patient_features=req.features,
        vessel_stenoses=vessel_stenoses,
        ffr_values=ffr_values,
    )

    # 3. Conformal bounds
    point_preds = {
        "CAD": predictions["cad"]["probability"],
        "LAD": predictions["vessels"]["LAD"]["probability"],
        "LCX": predictions["vessels"]["LCX"]["probability"],
        "RCA": predictions["vessels"]["RCA"]["probability"],
    }
    all_feature_keys = [f.name for f in FEATURES]
    conformal = analyze_missingness_bounds(
        provided_features=req.features,
        all_features=all_feature_keys,
        baseline_predictions=point_preds,
    )

    # Parent passport linking for hash chain
    prev_hash = None
    if req.parent_passport_id:
        parent = get_passport(req.parent_passport_id)
        if parent:
            prev_hash = parent["integrity"]["content_sha256"]

    passport = build_evidence_passport(
        case_id=req.case_id,
        input_features=req.features,
        model_predictions=predictions,
        hemodynamics_results=hemo,
        guideline_results=guidelines,
        conformal_bounds=conformal,
        parent_passport_id=req.parent_passport_id,
        previous_passport_hash=prev_hash,
        synthetic_demo=req.synthetic_demo,
        reviewer_notes=req.reviewer_notes,
    )

    save_passport(passport)
    return passport


@router.get("/passports/{passport_id}")
async def get_passport_endpoint(
    passport_id: str,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Retrieve an evidence passport by ID."""
    p = get_passport(passport_id)
    if not p:
        raise HTTPException(404, f"Passport '{passport_id}' not found")
    return p


@router.post("/passports/{passport_id}/verify")
async def verify_passport_endpoint(
    passport_id: str,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Independently verify canonical serialization, SHA-256 hash, and Ed25519 signature."""
    p = get_passport(passport_id)
    if not p:
        raise HTTPException(404, f"Passport '{passport_id}' not found")
    return verify_evidence_passport(p)


@router.get("/passports/{passport_id}/history")
async def passport_history_endpoint(
    passport_id: str,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Retrieve the lineage and audit chain for this passport."""
    p = get_passport(passport_id)
    if not p:
        raise HTTPException(404, f"Passport '{passport_id}' not found")

    chain = [p]
    curr = p
    while curr.get("parent_passport_id"):
        parent = get_passport(curr["parent_passport_id"])
        if not parent:
            break
        chain.insert(0, parent)
        curr = parent

    case_passports = list_passports_for_case(p["case_id"])
    return {
        "case_id": p["case_id"],
        "target_passport_id": passport_id,
        "lineage_depth": len(chain),
        "chain": chain,
        "all_case_assessments": case_passports,
    }


@router.post("/passports/{passport_id}/sign-off")
async def sign_off_passport_endpoint(
    passport_id: str,
    req: SignOffRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Execute authenticated clinician sign-off on an evidence passport."""
    approver_id = str(current_user.get("id", "user-clinician-1"))
    approver_name = str(current_user.get("email", "Dr. A. Vance, MD (Cardiology)"))
    approver_role = str(current_user.get("role", "reviewer"))

    return sign_off_passport(
        passport_id=passport_id,
        approver_id=approver_id,
        approver_name=approver_name,
        approver_role=approver_role,
        scope=req.scope,
        notes=req.notes,
    )


@router.post("/passports/{passport_id}/tamper-test")
async def tamper_test_endpoint(
    passport_id: str,
    req: TamperTestRequest,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Test utility: injects deliberate tampering into a passport to prove detection."""
    tampered = tamper_passport_for_testing(passport_id, req.modified_field, req.new_value)
    verification = verify_evidence_passport(tampered)
    return {
        "tampered_passport": tampered,
        "verification_result": verification,
    }


# ───────── FHIR R4 Semantic Round-Trip Interoperability (Pillar D) ──────────

class FhirImportRequest(BaseModel):
    bundle: dict[str, Any]


@router.post("/passports/{passport_id}/export-fhir")
async def export_passport_fhir(
    passport_id: str,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Export an evidence passport as a FHIR R4 collection Bundle."""
    p = get_passport(passport_id)
    if not p:
        raise HTTPException(404, f"Passport '{passport_id}' not found")
    bundle = export_to_fhir_bundle(p)
    return {
        "fhir_bundle": bundle,
        "resource_count": len(bundle.get("entry", [])),
        "source_passport_id": passport_id,
    }


@router.post("/interop/import-fhir")
async def import_fhir_bundle_endpoint(
    req: FhirImportRequest,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Import a FHIR R4 Bundle and reconstruct CardioTwin assessment fields."""
    extracted = import_from_fhir_bundle(req.bundle)
    return {"extracted_assessment": extracted}


@router.post("/passports/{passport_id}/roundtrip")
async def fhir_round_trip_endpoint(
    passport_id: str,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Execute full FHIR export -> re-import -> semantic comparison and return integrity score."""
    p = get_passport(passport_id)
    if not p:
        raise HTTPException(404, f"Passport '{passport_id}' not found")

    bundle = export_to_fhir_bundle(p)
    score = compute_semantic_round_trip_score(p, bundle)

    return {
        "passport_id": passport_id,
        "fhir_bundle_id": bundle.get("id"),
        "fhir_resource_count": len(bundle.get("entry", [])),
        "semantic_integrity": score,
    }

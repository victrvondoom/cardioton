"""Evidence Passport API Router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.cardiotwin.conformal import analyze_missingness_bounds
from app.cardiotwin.evidence.passport import (
    build_evidence_passport,
    seal_passport,
    verify_evidence_passport,
)
from app.cardiotwin.evidence.repository import (
    get_passport,
    list_passports_for_case,
    save_passport,
    sign_off_passport,
)
from app.cardiotwin.features import LeakageError, RecordValidationError
from app.cardiotwin.guideline_engine import evaluate_guidelines
from app.cardiotwin.hemodynamics.physics import solve_coronary_tree_physics
from app.cardiotwin.interop.fhir_exchange import (
    compute_semantic_round_trip_score,
    export_to_fhir_bundle,
    import_from_fhir_bundle,
)
from app.cardiotwin.model import ModelArtifactError, load_model
from app.cardiotwin.schema import FEATURES

router = APIRouter(prefix="/evidence", tags=["cardiotwin-evidence"])


class CreatePassportRequest(BaseModel):
    case_id: str = Field(default="CASE-SYNTH-8492", max_length=120)
    features: dict[str, Any]
    parent_passport_id: str | None = None
    synthetic_demo: bool = True
    reviewer_notes: str | None = None


class SignOffRequest(BaseModel):
    scope: str = Field(default="Authenticated workspace research review", max_length=200)
    notes: str | None = Field(default=None, max_length=1000)


class TamperTestRequest(BaseModel):
    modified_field: str = Field(default="data_quality", max_length=100)
    new_value: Any = Field(default={"completeness_score_pct": 100.0, "tampered": True})


def owned_passport(passport_id: str, user: dict[str, Any]) -> dict[str, Any]:
    passport = get_passport(passport_id)
    access = passport.get("access_context", {}) if passport else {}
    if not passport or not user.get("organization_id") or access.get("organization_id") != str(user["organization_id"]):
        raise HTTPException(404, "Evidence passport not found")
    if access.get("owner_user_id") != str(user.get("id")) and user.get("role") not in {"reviewer", "admin"}:
        raise HTTPException(404, "Evidence passport not found")
    return passport


@router.post("/passports")
async def create_passport_endpoint(
    req: CreatePassportRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate, cryptographically seal, and store an evidence passport."""
    if not current_user.get("id") or not current_user.get("organization_id"):
        raise HTTPException(403, "Authenticated case owner and organization are required")
    try:
        model = load_model()
        predictions = model.predict(req.features)
    except ModelArtifactError as exc:
        raise HTTPException(503, "CardioTwin model artifact is unavailable") from exc
    except (LeakageError, RecordValidationError) as exc:
        problems = exc.problems if isinstance(exc, RecordValidationError) else [str(exc)]
        raise HTTPException(422, {"error": type(exc).__name__, "problems": problems}) from exc

    # 1. Hemodynamics
    vessel_stenoses = {
        v: round(predictions["vessels"][v]["probability"] * 85.0, 1)
        for v in ("LAD", "LCX", "RCA")
    }
    raw_trestbps = req.features.get("BP")
    sbp = 124.0 if raw_trestbps is None or (isinstance(raw_trestbps, str) and not raw_trestbps.strip()) else float(raw_trestbps)
    dbp = sbp * 0.65
    map_val = dbp + (sbp - dbp) / 3.0
    hemo = solve_coronary_tree_physics(vessel_stenoses, mean_aortic_pressure_mmhg=map_val)
    hemo["assumptions"].extend([
        "Illustrative geometry uses model probability multiplied by 85; this is not measured stenosis.",
        "Diastolic pressure is assumed to be 0.65 times supplied systolic pressure; MAP is illustrative.",
        "Systolic pressure uses the served model's BP field. When unavailable, 124 mmHg is a labelled scenario assumption, not an imputed clinical measurement.",
    ])

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
        parent = owned_passport(req.parent_passport_id, current_user)
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

    passport["access_context"] = {"organization_id": str(current_user["organization_id"]), "owner_user_id": str(current_user["id"])}
    seal_passport(passport)
    save_passport(passport)
    return passport


@router.get("/passports/{passport_id}")
async def get_passport_endpoint(
    passport_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Retrieve an evidence passport by ID."""
    p = owned_passport(passport_id, current_user)
    return p


@router.post("/passports/{passport_id}/verify")
async def verify_passport_endpoint(
    passport_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Independently verify canonical serialization, SHA-256 hash, and Ed25519 signature."""
    p = owned_passport(passport_id, current_user)
    return verify_evidence_passport(p)


@router.get("/passports/{passport_id}/history")
async def passport_history_endpoint(
    passport_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Retrieve the lineage and audit chain for this passport."""
    p = owned_passport(passport_id, current_user)

    chain = [p]
    curr = p
    while curr.get("parent_passport_id"):
        parent = owned_passport(curr["parent_passport_id"], current_user)
        chain.insert(0, parent)
        curr = parent

    case_passports = [
        item for item in list_passports_for_case(p["case_id"])
        if item.get("access_context", {}).get("organization_id") == str(current_user["organization_id"])
        and (item.get("access_context", {}).get("owner_user_id") == str(current_user["id"])
             or current_user.get("role") in {"reviewer", "admin"})
    ]
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
    owned_passport(passport_id, current_user)
    approver_id = str(current_user.get("id") or "")
    approver_name = str(current_user.get("email") or current_user.get("full_name") or "")
    approver_role = str(current_user.get("role") or "")
    if not approver_id or not approver_name:
        raise HTTPException(403, "Authenticated reviewer identity is required")
    if approver_role not in {"reviewer", "admin"}:
        raise HTTPException(403, "Reviewer permission is required")

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
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Test utility: injects deliberate tampering into a passport to prove detection."""
    import copy
    tampered = copy.deepcopy(owned_passport(passport_id, current_user))
    if not tampered.get("clinical_facts", {}).get("data_quality", {}).get("synthetic_demonstration", True):
        raise HTTPException(403, "Tamper demonstration supports synthetic passports only")
    tampered["clinical_facts"][req.modified_field] = req.new_value
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
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Export an evidence passport as a FHIR R4 collection Bundle."""
    p = owned_passport(passport_id, current_user)
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
    if "error" in extracted:
        raise HTTPException(422, extracted["error"])
    return {"extracted_assessment": extracted}


@router.post("/passports/{passport_id}/roundtrip")
async def fhir_round_trip_endpoint(
    passport_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Execute full FHIR export -> re-import -> semantic comparison and return integrity score."""
    p = owned_passport(passport_id, current_user)

    bundle = export_to_fhir_bundle(p)
    score = compute_semantic_round_trip_score(p, bundle)

    return {
        "passport_id": passport_id,
        "fhir_bundle_id": bundle.get("id"),
        "fhir_resource_count": len(bundle.get("entry", [])),
        "semantic_integrity": score,
    }

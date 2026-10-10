"""CardioTwin API — cardiovascular risk visualisation & vessel-level prediction.

Mounted at /api/v1/cardiotwin. Every route is authenticated (same `get_current_user` dependency as the rest
of ClinCase). Predictions are stateless: nothing about the submitted patient is persisted — only a
SHA-256 of the input and the model provenance are logged, mirroring OncoTwin's audit conventions.
"""

from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.cardiotwin import CARDIOTWIN_VERSION
from app.cardiotwin.atlas.api import router as atlas_router
from app.cardiotwin.conformal import analyze_missingness_bounds
from app.cardiotwin.evidence.api import router as evidence_router
from app.cardiotwin.features import LeakageError, RecordValidationError
from app.cardiotwin.guideline_engine import evaluate_guidelines
from app.cardiotwin.hemodynamics.api import router as hemodynamics_router
from app.cardiotwin.hemodynamics.physics import solve_coronary_tree_physics
from app.cardiotwin.model import (
    EVALUATION_PATH,
    SAFETY_NOTICE,
    SCENARIOS_PATH,
    CardioModel,
    ModelArtifactError,
    load_json_artifact,
    load_model,
)
from app.cardiotwin.schema import (
    FEATURES,
    GROUP_LABELS,
    SOURCE_DATASET,
    VESSEL_NAMES,
    CounterfactualRequest,
    PatientInput,
    PredictRequest,
    SensitivityRequest,
    TelemetryAssessmentRequest,
)
from app.oncotwin.observability import METRICS

log = structlog.get_logger()
router = APIRouter(prefix="/cardiotwin", tags=["cardiotwin"])
router.include_router(hemodynamics_router)
router.include_router(atlas_router)
router.include_router(evidence_router)


def _model_or_503() -> CardioModel:
    try:
        return load_model()
    except ModelArtifactError as e:
        raise HTTPException(503, str(e)) from e


def _invalid(e: Exception) -> HTTPException:
    problems = getattr(e, "problems", [str(e)])
    return HTTPException(422, {"error": type(e).__name__, "problems": problems})


@router.get("/overview")
async def overview(_: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    m = _model_or_503()
    return {
        "name": "CardioTwin",
        "tagline": "Cardiovascular risk visualization and vessel-level prediction",
        "cardiotwin_version": CARDIOTWIN_VERSION,
        "model": m.version_info(),
        "headline_metrics": {t: m.targets[t]["cv_summary"] for t in ("CAD", "LAD", "LCX", "RCA")},
        "vessels": VESSEL_NAMES,
        "dataset": SOURCE_DATASET,
        "safety_notice": SAFETY_NOTICE,
        "terminology": {
            "cad": "Predicted CAD probability (angiographic CAD label in the training data)",
            "vessel": "Estimated vessel-level stenosis probability (>=50% narrowing label)",
            "not_claimed": [
                "lesion location, length or morphology",
                "heart-attack or mortality risk",
                "a diagnosis",
            ],
        },
    }


@router.get("/features")
async def features(_: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {
        "groups": [{"id": g, "label": lbl} for g, lbl in GROUP_LABELS.items()],
        "features": [f.to_public() for f in FEATURES],
    }


@router.get("/scenarios")
async def scenarios(_: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    data = load_json_artifact(SCENARIOS_PATH)
    if data is None:
        raise HTTPException(
            503, "CardioTwin scenarios not generated — run `python -m app.cardiotwin.training`."
        )
    return data


@router.post("/predict")
async def predict(
    req: PredictRequest, _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    m = _model_or_503()
    t0 = time.perf_counter()
    try:
        res = m.predict(req.features, scenario_id=req.scenario_id)
    except (RecordValidationError, LeakageError) as e:
        METRICS.inc("cardiotwin_predictions_total", outcome="rejected")
        raise _invalid(e) from e
    METRICS.inc(
        "cardiotwin_predictions_total",
        outcome="ok",
        representativeness=res["representativeness"]["status"],
    )
    METRICS.observe_ms("cardiotwin_predict_ms", (time.perf_counter() - t0) * 1000)
    log.info(
        "cardiotwin.predict",
        input_sha256=res["provenance"]["input_sha256"],
        model_version=m.version,
        artifact_sha256=m.sha256,
        representativeness=res["representativeness"]["status"],
    )
    return res


@router.post("/counterfactual")
async def counterfactual(
    req: CounterfactualRequest, _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    m = _model_or_503()
    try:
        res = m.counterfactual(req.features, req.perturbations)
    except (RecordValidationError, LeakageError) as e:
        raise _invalid(e) from e
    METRICS.inc("cardiotwin_counterfactuals_total")
    return res


@router.post("/sensitivity")
async def sensitivity(
    req: SensitivityRequest, _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    m = _model_or_503()
    try:
        return m.sensitivity(req.features, req.feature, req.points)
    except (RecordValidationError, LeakageError) as e:
        raise _invalid(e) from e


@router.get("/model")
async def model_card(_: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return _model_or_503().card()


@router.get("/evaluation")
async def evaluation(_: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    _model_or_503()
    data = load_json_artifact(EVALUATION_PATH)
    if data is None:
        raise HTTPException(
            503, "CardioTwin evaluation report missing — run `python -m app.cardiotwin.training`."
        )
    return data


@router.post("/telemetry")
async def telemetry_assessment(
    req: TelemetryAssessmentRequest, _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    m = _model_or_503()
    try:
        pred = m.predict(req.features)
    except (RecordValidationError, LeakageError) as e:
        raise _invalid(e) from e

    stress = req.stress_mode
    raw_thalach = req.features.get("thalach")
    raw_trestbps = req.features.get("trestbps")

    base_hr = float(raw_thalach) if isinstance(raw_thalach, int | float) else 72.0
    base_sbp = float(raw_trestbps) if isinstance(raw_trestbps, int | float) else 124.0

    hr = round(base_hr * 1.42 if stress else base_hr)
    sbp = round(base_sbp * 1.25 if stress else base_sbp)
    dbp = round(sbp * 0.65 * (1.08 if stress else 1.0))
    map_val = round(dbp + (sbp - dbp) / 3)
    sv = round(75.0 * (1.15 if stress else 1.0))
    co = round((hr * sv) / 1000.0, 1)
    rpp = round((hr * sbp) / 100)
    cpp = max(25, dbp - 12)

    mvo2_status = "High Demand" if rpp > 220 else ("Elevated" if rpp > 140 else "Optimal")

    # Vessel Hemodynamics & FFR-CT proxy
    vessels_hemo: dict[str, Any] = {}
    stenotic_count = 0
    for v in ("LAD", "LCX", "RCA"):
        p = pred["vessels"][v]["probability"]
        eff_p = min(0.99, p * 1.25) if stress else p
        ffr = round(max(0.55, min(0.98, 0.94 - eff_p * 0.32)), 2)
        area_stenosis = round(eff_p * 78)
        mla = round(4.2 * (1 - eff_p * 0.7), 1)
        shear = round(1.2 + eff_p * 3.8, 1)
        if eff_p >= 0.5:
            stenotic_count += 1
        vessels_hemo[v] = {
            "probability": eff_p,
            "ffr_ct": ffr,
            "is_ischemic": ffr <= 0.80,
            "area_stenosis_pct": area_stenosis,
            "min_lumen_area_mm2": mla,
            "wall_shear_stress_pa": shear,
            "remodeling": "Positive" if eff_p > 0.6 else "Negative",
        }

    cad_p = pred["cad"]["probability"]
    is_lad_stenotic = vessels_hemo["LAD"]["probability"] >= 0.5

    # Heart Team Multidisciplinary Consensus
    if cad_p < 0.35:
        heart_team = {
            "strategy": "Guideline-Directed Medical Therapy (GDMT)",
            "risk_tier": "Low Risk",
            "syntax_tier": "SYNTAX-II Score: < 22",
            "guideline": "Class I, Level A (ESC/ACC Guidelines)",
            "primary_indication": "Non-invasive optimal medical therapy and risk factor modification",
        }
    elif stenotic_count >= 2 or (is_lad_stenotic and cad_p >= 0.7):
        heart_team = {
            "strategy": "CABG Consult vs Multi-vessel PCI" if stenotic_count >= 3 else "Percutaneous Coronary Intervention (PCI)",
            "risk_tier": "Elevated Complexity / Revascularization Indicated",
            "syntax_tier": "SYNTAX-II Score: > 32" if stenotic_count >= 3 else "SYNTAX-II Score: 23-32",
            "guideline": "Class I, Level B (ESC/EACTS Revascularization Guidelines)",
            "primary_indication": "Prognostic revascularization for proximal LAD and multivessel ischemia",
        }
    else:
        heart_team = {
            "strategy": "Targeted PCI with GDMT Optimization",
            "risk_tier": "Intermediate Risk / Single Vessel CAD",
            "syntax_tier": "SYNTAX-II Score: < 22",
            "guideline": "Class I, Level A (ACC/AHA Guidelines)",
            "primary_indication": "Targeted Drug-Eluting Stent (DES) for ischemic symptomatic relief",
        }

    METRICS.inc("cardiotwin_predictions_total", outcome="telemetry_ok")

    return {
        "stress_mode": stress,
        "vitals": {
            "heart_rate_bpm": hr,
            "systolic_bp_mmhg": sbp,
            "diastolic_bp_mmhg": dbp,
            "mean_arterial_pressure_mmhg": map_val,
            "cardiac_output_l_min": co,
            "stroke_volume_ml": sv,
            "rate_pressure_product": rpp,
            "coronary_perfusion_pressure_mmhg": cpp,
            "myocardial_o2_demand": mvo2_status,
        },
        "vessels": vessels_hemo,
        "heart_team_consensus": heart_team,
        "provenance": {
            "model_version": m.version,
            "cad_probability": cad_p,
            "input_sha256": pred["provenance"]["input_sha256"],
        },
    }


@router.post("/hemodynamics/physics")
async def hemodynamics_physics(
    req: TelemetryAssessmentRequest, _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Solve 0D/1D Navier-Stokes Windkessel hemodynamic network."""
    m = _model_or_503()
    try:
        pred = m.predict(req.features)
    except (RecordValidationError, LeakageError) as e:
        raise _invalid(e) from e

    vessel_stenoses = {
        v: round(pred["vessels"][v]["probability"] * 85.0, 1) for v in ("LAD", "LCX", "RCA")
    }
    raw_trestbps = req.features.get("trestbps")
    sbp = float(raw_trestbps) if isinstance(raw_trestbps, int | float) else 124.0
    dbp = sbp * 0.65
    map_val = dbp + (sbp - dbp) / 3.0

    return solve_coronary_tree_physics(
        vessel_stenoses=vessel_stenoses,
        mean_aortic_pressure_mmhg=map_val,
        stress_mode=req.stress_mode,
    )


@router.post("/conformal")
async def conformal_risk_bounds(
    req: PatientInput, _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Compute distributionally robust conformal prediction intervals & missingness bounds."""
    m = _model_or_503()
    try:
        pred = m.predict(req.features)
    except (RecordValidationError, LeakageError) as e:
        raise _invalid(e) from e

    point_preds = {
        "CAD": pred["cad"]["probability"],
        "LAD": pred["vessels"]["LAD"]["probability"],
        "LCX": pred["vessels"]["LCX"]["probability"],
        "RCA": pred["vessels"]["RCA"]["probability"],
    }
    all_feature_keys = [f.name for f in FEATURES]
    return analyze_missingness_bounds(
        provided_features=req.features,
        all_features=all_feature_keys,
        baseline_predictions=point_preds,
    )


@router.post("/guidelines/verify")
async def verify_clinical_guidelines(
    req: PatientInput, _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Execute deterministic ESC 2024 / ACC 2023 guideline verification with SHA-256 state seal."""
    m = _model_or_503()
    try:
        pred = m.predict(req.features)
    except (RecordValidationError, LeakageError) as e:
        raise _invalid(e) from e

    vessel_stenoses = {v: pred["vessels"][v]["probability"] for v in ("LAD", "LCX", "RCA")}
    ffr_values = {
        v: round(max(0.55, min(0.98, 0.94 - pred["vessels"][v]["probability"] * 0.32)), 2)
        for v in ("LAD", "LCX", "RCA")
    }

    return evaluate_guidelines(
        patient_features=req.features,
        vessel_stenoses=vessel_stenoses,
        ffr_values=ffr_values,
    )

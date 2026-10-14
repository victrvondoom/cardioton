"""
FastAPI Backend for Track A Cardiovascular Risk Visualization & Prediction.
Endpoints:
- GET  /health
- GET  /schema
- POST /predict
- POST /explain
- GET  /metrics
- GET  /samples
- POST /agent/chat
- POST /agent/what_if
- GET  /reports/{filename} (serves generated PNG plots)
"""
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from pathlib import Path
from typing import Dict, Any, Optional, List
import joblib
import json
import logging
import pandas as pd
import numpy as np

from backend.arterylens__backend__preprocess import preprocess_single_patient, get_demo_patients, FEATURE_ORDER
from backend.arterylens__backend__agent import ClinicalExplainerAgent, DISCLAIMER_TEXT

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cardio-backend")

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"
REPORT_DIR = BASE_DIR / "reports"

app = FastAPI(
    title="Cardiovascular Risk 3D Visualization & Prediction API",
    description="Multimodal AI Hackathon 2026 - Track A: CAD and LAD/LCX/RCA Coronary Artery Stenosis Prediction",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage for loaded models and artifacts
MODELS = {}
EXPLAINERS = {}
SCHEMA = []
METRICS = {}
AGENT = None


def load_artifacts():
    global MODELS, EXPLAINERS, SCHEMA, METRICS, AGENT
    logger.info("Loading ML models and explainers...")
    
    # Load calibrated prediction models
    for target in ["cad", "lad", "lcx", "rca"]:
        model_path = MODEL_DIR / f"model_{target}.joblib"
        if model_path.exists():
            MODELS[target.upper()] = joblib.load(model_path)
            logger.info(f"Loaded model for {target.upper()}")
        else:
            logger.warning(f"Model file missing: {model_path}")

    # Load explainers
    for target in ["cad", "lad", "lcx", "rca"]:
        explainer_path = MODEL_DIR / f"explainer_{target}.joblib"
        if explainer_path.exists():
            EXPLAINERS[target.upper()] = joblib.load(explainer_path)
            logger.info(f"Loaded explainer for {target.upper()}")
        else:
            logger.warning(f"Explainer file missing: {explainer_path}")

    # Load schema
    schema_path = MODEL_DIR / "schema.json"
    if schema_path.exists():
        with open(schema_path, "r") as f:
            SCHEMA = json.load(f)
    else:
        logger.warning(f"Schema file missing: {schema_path}")

    # Load metrics
    metrics_path = REPORT_DIR / "metrics.json"
    if metrics_path.exists():
        with open(metrics_path, "r") as f:
            METRICS = json.load(f)
    else:
        logger.warning(f"Metrics file missing: {metrics_path}")

    # Initialize AI Explainer Agent
    AGENT = ClinicalExplainerAgent(
        predict_fn=predict_internal,
        explain_fn=explain_internal,
        metrics_data=METRICS
    )
    logger.info("Artifact loading and AI Explainer agent initialization complete.")


def predict_internal(patient_dict: dict) -> dict:
    """Core prediction function returning calibrated vessel probabilities."""
    df_patient = preprocess_single_patient(patient_dict)
    probabilities = {}
    vessel_status = {}
    
    # Decision thresholds: standard 0.50 for CAD/LAD, 0.40 for LCX and 0.45 for RCA
    thresholds = {"CAD": 0.50, "LAD": 0.50, "LCX": 0.40, "RCA": 0.45}

    for target in ["CAD", "LAD", "LCX", "RCA"]:
        if target in MODELS:
            prob = float(MODELS[target].predict_proba(df_patient)[0, 1])
        else:
            prob = 0.5
        probabilities[target] = round(prob, 4)
        vessel_status[target] = "Stenotic / High Risk" if prob >= thresholds[target] else "Normal / Low Risk"

    cad_p = probabilities["CAD"]
    if cad_p >= 0.70:
        risk_tier = "High Risk"
    elif cad_p >= 0.35:
        risk_tier = "Moderate Risk"
    else:
        risk_tier = "Low Risk"

    return {
        "probabilities": probabilities,
        "vessel_status": vessel_status,
        "risk_tier": risk_tier,
        "thresholds": thresholds,
        "disclaimer": DISCLAIMER_TEXT
    }


def explain_internal(patient_dict: dict, target: str = "CAD") -> dict:
    """Core explanation function returning SHAP feature contributions for a target."""
    target_key = target.upper()
    if target_key not in EXPLAINERS:
        target_key = "CAD"
        
    df_patient = preprocess_single_patient(patient_dict)
    expl_data = EXPLAINERS[target_key]
    pipe = expl_data["pipeline"]
    explainer = expl_data["explainer"]

    # Transform patient through preprocessing pipeline steps before the classifier
    Xt = pd.DataFrame(pipe[:-1].transform(df_patient), columns=FEATURE_ORDER)
    sv = explainer.shap_values(Xt)
    
    if isinstance(sv, list):
        sv = sv[1]
    sv = np.asarray(sv)
    if sv.ndim == 3:
        sv = sv[:, :, 1]
    sv = sv[0]  # shape (57,)

    raw_values = df_patient.iloc[0].to_dict()
    feature_impacts = []
    
    for feat_name, shap_val in zip(FEATURE_ORDER, sv):
        feature_impacts.append({
            "feature": feat_name,
            "value": round(float(raw_values.get(feat_name, 0.0)), 2),
            "shap": round(float(shap_val), 4),
            "abs_shap": round(abs(float(shap_val)), 4)
        })

    # Sort descending by absolute impact
    feature_impacts.sort(key=lambda x: x["abs_shap"], reverse=True)

    pos_features = [f for f in feature_impacts if f["shap"] > 0][:8]
    neg_features = [f for f in feature_impacts if f["shap"] < 0][:8]

    return {
        "target": target_key,
        "positive_features": pos_features,
        "negative_features": neg_features,
        "all_top_features": feature_impacts[:16],
        "disclaimer": DISCLAIMER_TEXT
    }


# Models
class PredictRequest(BaseModel):
    patient: Dict[str, Any]

class ExplainRequest(BaseModel):
    patient: Dict[str, Any]
    target: Optional[str] = "CAD"

class ChatRequest(BaseModel):
    query: str
    patient: Dict[str, Any]
    target: Optional[str] = "CAD"

class WhatIfRequest(BaseModel):
    patient: Dict[str, Any]
    changes: Dict[str, Any]


# Initialize artifacts on module import
load_artifacts()


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "models_loaded": list(MODELS.keys()),
        "explainers_loaded": list(EXPLAINERS.keys()),
        "features_count": len(FEATURE_ORDER)
    }


@app.get("/schema")
def get_schema():
    if not SCHEMA:
        # Fallback if schema.json wasn't loaded
        return [{"name": f, "type": "numeric"} for f in FEATURE_ORDER]
    return SCHEMA


@app.get("/metrics")
def get_metrics():
    return METRICS


@app.get("/samples")
def get_samples():
    return get_demo_patients()


@app.post("/predict")
def predict_endpoint(req: PredictRequest):
    try:
        return predict_internal(req.patient)
    except Exception as e:
        logger.error(f"Error during prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/explain")
def explain_endpoint(req: ExplainRequest):
    try:
        target = req.target or "CAD"
        return explain_internal(req.patient, target)
    except Exception as e:
        logger.error(f"Error during explanation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent/chat")
def agent_chat_endpoint(req: ChatRequest):
    try:
        if not AGENT:
            raise HTTPException(status_code=503, detail="Agent not initialized")
        
        narrative = AGENT.answer_query(req.query, req.patient, req.target or "CAD")
        explanation_details = AGENT.generate_clinical_explanation(req.patient, req.target or "CAD")
        
        return {
            "reply": narrative,
            "target": req.target or "CAD",
            "probabilities": explanation_details["probabilities"],
            "risk_tier": explanation_details["risk_tier"],
            "disclaimer": DISCLAIMER_TEXT
        }
    except Exception as e:
        logger.error(f"Error during agent chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent/what_if")
def agent_what_if_endpoint(req: WhatIfRequest):
    try:
        if not AGENT:
            raise HTTPException(status_code=503, detail="Agent not initialized")
        return AGENT.tool_what_if(req.patient, req.changes)
    except Exception as e:
        logger.error(f"Error during what-if analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/reports/{filename}")
def get_report_image(filename: str):
    image_path = REPORT_DIR / filename
    if not image_path.exists() or not image_path.is_file():
        raise HTTPException(status_code=404, detail="Report image not found")
    return FileResponse(image_path)

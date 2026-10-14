import os
import json
import pandas as pd
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from models.inference_engine import CardioInferenceEngine

app = FastAPI(
    title="Cardiovascular 3D Risk Visualization & Prediction API",
    description="Multi-vessel coronary stenosis & CAD prediction with real-time SHAP explainability and 3D anatomical mapping",
    version="2.0.0"
)

# Enable CORS for local testing and embedding
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = CardioInferenceEngine.get_instance()

# Preloaded Clinical Patient Presets
PATIENT_PRESETS = {
    "triple_vessel": {
        "id": "triple_vessel",
        "title": "Critical Triple-Vessel Disease (LAD + LCX + RCA)",
        "category": "High Risk / Critical",
        "description": "68-year-old male with severe chest pain, diabetic history, multi-territory RWMA, reduced EF (34%), and diffuse ST changes.",
        "data": {
            "Age": 68, "Sex": "Male", "Weight": 86, "Length": 170, "BMI": 29.8,
            "DM": 1, "HTN": 1, "Current Smoker": 1, "EX-Smoker": 0, "FH": 1,
            "Obesity": "Y", "CRF": "N", "CVA": "N", "Airway disease": "N", "Thyroid Disease": "N",
            "CHF": "Y", "DLP": "Y", "BP": 160, "PR": 88, "Edema": 1,
            "Weak Peripheral Pulse": "Y", "Lung rales": "Y", "Systolic Murmur": "Y", "Diastolic Murmur": "N",
            "Typical Chest Pain": 1, "Dyspnea": "Y", "Function Class": 3, "Atypical": "N",
            "Nonanginal": "N", "Exertional CP": "N", "LowTH Ang": "Y", "Q Wave": 1,
            "St Elevation": 1, "St Depression": 1, "Tinversion": 1, "LVH": "Y",
            "Poor R Progression": "Y", "BBB": "LBBB", "FBS": 185, "CR": 1.4, "TG": 260,
            "LDL": 180, "HDL": 32, "BUN": 24, "ESR": 28, "HB": 13.5, "K": 4.4, "Na": 138,
            "WBC": 9200, "Lymph": 22, "Neut": 72, "PLT": 245, "EF-TTE": 34, "Region RWMA": 4, "VHD": "Moderate"
        }
    },
    "isolated_lad": {
        "id": "isolated_lad",
        "title": "Severe Anterior LAD Stenosis (STEMI Risk)",
        "category": "High Risk LAD",
        "description": "56-year-old male with acute exertional angina, anterior wall motion abnormality (RWMA=1), ST elevation, and Poor R progression.",
        "data": {
            "Age": 56, "Sex": "Male", "Weight": 80, "Length": 175, "BMI": 26.1,
            "DM": 0, "HTN": 1, "Current Smoker": 1, "EX-Smoker": 0, "FH": 1,
            "Obesity": "N", "CRF": "N", "CVA": "N", "Airway disease": "N", "Thyroid Disease": "N",
            "CHF": "N", "DLP": "Y", "BP": 140, "PR": 76, "Edema": 0,
            "Weak Peripheral Pulse": "N", "Lung rales": "N", "Systolic Murmur": "N", "Diastolic Murmur": "N",
            "Typical Chest Pain": 1, "Dyspnea": "N", "Function Class": 2, "Atypical": "N",
            "Nonanginal": "N", "Exertional CP": "N", "LowTH Ang": "N", "Q Wave": 0,
            "St Elevation": 1, "St Depression": 0, "Tinversion": 1, "LVH": "N",
            "Poor R Progression": "Y", "BBB": "N", "FBS": 110, "CR": 1.0, "TG": 195,
            "LDL": 165, "HDL": 36, "BUN": 16, "ESR": 14, "HB": 14.8, "K": 4.2, "Na": 140,
            "WBC": 7800, "Lymph": 28, "Neut": 65, "PLT": 210, "EF-TTE": 42, "Region RWMA": 1, "VHD": "N"
        }
    },
    "isolated_rca": {
        "id": "isolated_rca",
        "title": "Dominant RCA Stenosis (Inferior Ischemia)",
        "category": "Moderate-High Risk RCA",
        "description": "63-year-old hypertensive patient with inferior wall motion hypokinesis (RWMA=2), pathological Q waves, and ST depressions in lead III/aVF.",
        "data": {
            "Age": 63, "Sex": "Male", "Weight": 78, "Length": 168, "BMI": 27.6,
            "DM": 1, "HTN": 1, "Current Smoker": 0, "EX-Smoker": 1, "FH": 0,
            "Obesity": "N", "CRF": "N", "CVA": "N", "Airway disease": "N", "Thyroid Disease": "N",
            "CHF": "N", "DLP": "N", "BP": 155, "PR": 64, "Edema": 0,
            "Weak Peripheral Pulse": "N", "Lung rales": "N", "Systolic Murmur": "N", "Diastolic Murmur": "N",
            "Typical Chest Pain": 1, "Dyspnea": "N", "Function Class": 2, "Atypical": "N",
            "Nonanginal": "N", "Exertional CP": "N", "LowTH Ang": "N", "Q Wave": 1,
            "St Elevation": 0, "St Depression": 1, "Tinversion": 0, "LVH": "Y",
            "Poor R Progression": "N", "BBB": "N", "FBS": 140, "CR": 1.1, "TG": 160,
            "LDL": 135, "HDL": 42, "BUN": 18, "ESR": 18, "HB": 13.9, "K": 4.5, "Na": 139,
            "WBC": 6900, "Lymph": 30, "Neut": 62, "PLT": 230, "EF-TTE": 48, "Region RWMA": 2, "VHD": "mild"
        }
    },
    "isolated_lcx": {
        "id": "isolated_lcx",
        "title": "Moderate LCX Stenosis (Lateral Ischemia)",
        "category": "Moderate Risk LCX",
        "description": "59-year-old female with severe hyperlipidemia, lateral wall motion abnormality (RWMA=3), T-wave inversions, and atypical angina.",
        "data": {
            "Age": 59, "Sex": "Female", "Weight": 72, "Length": 160, "BMI": 28.1,
            "DM": 0, "HTN": 1, "Current Smoker": 0, "EX-Smoker": 0, "FH": 1,
            "Obesity": "N", "CRF": "N", "CVA": "N", "Airway disease": "N", "Thyroid Disease": "N",
            "CHF": "N", "DLP": "Y", "BP": 135, "PR": 72, "Edema": 0,
            "Weak Peripheral Pulse": "N", "Lung rales": "N", "Systolic Murmur": "N", "Diastolic Murmur": "N",
            "Typical Chest Pain": 0, "Dyspnea": "Y", "Function Class": 2, "Atypical": "Y",
            "Nonanginal": "N", "Exertional CP": "N", "LowTH Ang": "N", "Q Wave": 0,
            "St Elevation": 0, "St Depression": 0, "Tinversion": 1, "LVH": "N",
            "Poor R Progression": "N", "BBB": "N", "FBS": 98, "CR": 0.9, "TG": 240,
            "LDL": 175, "HDL": 44, "BUN": 15, "ESR": 12, "HB": 13.2, "K": 4.1, "Na": 141,
            "WBC": 6400, "Lymph": 32, "Neut": 60, "PLT": 250, "EF-TTE": 50, "Region RWMA": 3, "VHD": "mild"
        }
    },
    "healthy_control": {
        "id": "healthy_control",
        "title": "Healthy Young Control (Patent Vessels)",
        "category": "Low / Normal Risk",
        "description": "34-year-old healthy male with normal hemodynamics, preserved ejection fraction (60%), normal ECG, and no wall motion abnormalities.",
        "data": {
            "Age": 34, "Sex": "Male", "Weight": 70, "Length": 178, "BMI": 22.1,
            "DM": 0, "HTN": 0, "Current Smoker": 0, "EX-Smoker": 0, "FH": 0,
            "Obesity": "N", "CRF": "N", "CVA": "N", "Airway disease": "N", "Thyroid Disease": "N",
            "CHF": "N", "DLP": "N", "BP": 115, "PR": 68, "Edema": 0,
            "Weak Peripheral Pulse": "N", "Lung rales": "N", "Systolic Murmur": "N", "Diastolic Murmur": "N",
            "Typical Chest Pain": 0, "Dyspnea": "N", "Function Class": 1, "Atypical": "N",
            "Nonanginal": "N", "Exertional CP": "N", "LowTH Ang": "N", "Q Wave": 0,
            "St Elevation": 0, "St Depression": 0, "Tinversion": 0, "LVH": "N",
            "Poor R Progression": "N", "BBB": "N", "FBS": 88, "CR": 0.8, "TG": 95,
            "LDL": 85, "HDL": 58, "BUN": 12, "ESR": 6, "HB": 15.2, "K": 4.2, "Na": 142,
            "WBC": 5800, "Lymph": 36, "Neut": 55, "PLT": 220, "EF-TTE": 60, "Region RWMA": 0, "VHD": "N"
        }
    },
    "metabolic_borderline": {
        "id": "metabolic_borderline",
        "title": "Borderline Metabolic Risk (Early Atherosclerosis)",
        "category": "Borderline / Moderate Risk",
        "description": "51-year-old with borderline hypertension, elevated triglycerides, normal resting ECG, preserved EF (55%), and no wall motion defect.",
        "data": {
            "Age": 51, "Sex": "Male", "Weight": 88, "Length": 172, "BMI": 29.7,
            "DM": 0, "HTN": 1, "Current Smoker": 1, "EX-Smoker": 0, "FH": 1,
            "Obesity": "Y", "CRF": "N", "CVA": "N", "Airway disease": "N", "Thyroid Disease": "N",
            "CHF": "N", "DLP": "Y", "BP": 138, "PR": 74, "Edema": 0,
            "Weak Peripheral Pulse": "N", "Lung rales": "N", "Systolic Murmur": "N", "Diastolic Murmur": "N",
            "Typical Chest Pain": 0, "Dyspnea": "N", "Function Class": 1, "Atypical": "Y",
            "Nonanginal": "N", "Exertional CP": "N", "LowTH Ang": "N", "Q Wave": 0,
            "St Elevation": 0, "St Depression": 0, "Tinversion": 0, "LVH": "N",
            "Poor R Progression": "N", "BBB": "N", "FBS": 105, "CR": 0.9, "TG": 210,
            "LDL": 145, "HDL": 38, "BUN": 15, "ESR": 10, "HB": 14.5, "K": 4.3, "Na": 140,
            "WBC": 6800, "Lymph": 31, "Neut": 61, "PLT": 215, "EF-TTE": 55, "Region RWMA": 0, "VHD": "N"
        }
    }
}

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "dataset": "UCI Z-Alizadeh Sani Coronary Artery Disease Dataset (303 patients)",
        "models": {k: v['model_name'] for k, v in engine.best_models.items()},
        "targets": engine.target_cols,
        "features_count": len(engine.feature_cols)
    }

@app.get("/api/metrics")
def get_metrics():
    metrics_path = os.path.join(os.path.dirname(__file__), "..", "models", "cardiospatial_3d__models__validation_metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path, "r") as f:
            return json.load(f)
    return engine.metrics

@app.get("/api/feature_meta")
def get_feature_metadata():
    meta_path = os.path.join(os.path.dirname(__file__), "..", "models", "cardiospatial_3d__models__feature_metadata.json")
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Feature metadata not found")

@app.get("/api/patient/presets")
def get_presets():
    return PATIENT_PRESETS

@app.get("/api/patients")
def get_sample_patients(limit: int = 10):
    if engine.df_baseline is not None:
        sample_df = engine.df_baseline.head(limit)
        return sample_df.to_dict(orient="records")
    return []

class PredictRequest(BaseModel):
    features: Dict[str, Any]

@app.post("/api/predict")
def predict_cardio(req: PredictRequest):
    try:
        results = engine.predict(req.features)
        hemodynamics = engine.calculate_hemodynamics(results, req.features)
        results['hemodynamics'] = hemodynamics
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

class ExplainRequest(BaseModel):
    features: Dict[str, Any]
    target: Optional[str] = "CAD"
    top_k: Optional[int] = 10

@app.post("/api/explain")
def explain_cardio(req: ExplainRequest):
    try:
        results = engine.explain(req.features, target=req.target, top_k=req.top_k)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explainability error: {str(e)}")

class InterventionRequest(BaseModel):
    features: Dict[str, Any]
    interventions: Dict[str, bool]

@app.post("/api/simulate_intervention")
def simulate_intervention(req: InterventionRequest):
    try:
        results = engine.simulate_intervention(req.features, req.interventions)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Intervention simulation error: {str(e)}")

class SoapRequest(BaseModel):
    features: Dict[str, Any]

@app.post("/api/generate_soap_note")
def generate_soap_note(req: SoapRequest):
    try:
        predictions = engine.predict(req.features)
        hemodynamics = engine.calculate_hemodynamics(predictions, req.features)
        note = engine.generate_soap_note(req.features, predictions, hemodynamics)
        return note
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SOAP note generation error: {str(e)}")

@app.get("/api/cohort")
def get_cohort_samples():
    """
    Returns 15 curated benchmark cohort patients from UCI Z-Alizadeh Sani dataset
    with diverse clinical risk profiles for demo and judging inspection.
    """
    clean_csv = os.path.join(os.path.dirname(__file__), "..", "data", "cardiac_dataset_clean.csv")
    if not os.path.exists(clean_csv):
        return []
    
    import pandas as pd
    df = pd.read_csv(clean_csv)
    
    # Select 15 stratified diverse cases
    indices = [0, 4, 11, 23, 42, 57, 85, 102, 134, 158, 189, 214, 245, 276, 299]
    valid_idx = [i for i in indices if i < len(df)]
    subset = df.iloc[valid_idx].copy()
    
    records = []
    for rank, (idx, row) in enumerate(subset.iterrows(), 1):
        cad_status = str(row.get('CAD', 'Cad'))
        lad_status = str(row.get('LAD', 'Stenotic'))
        lcx_status = str(row.get('LCX', 'Normal'))
        rca_status = str(row.get('RCA', 'Normal'))
        
        # Categorize
        if 'cad' in cad_status.lower():
            if 'stenot' in lad_status.lower() and ('stenot' in lcx_status.lower() or 'stenot' in rca_status.lower()):
                category = "Multi-Vessel CAD"
            elif 'stenot' in lad_status.lower():
                category = "Isolated LAD Stenosis"
            elif 'stenot' in rca_status.lower():
                category = "Isolated RCA Stenosis"
            else:
                category = "Isolated LCX Stenosis"
        else:
            category = "Non-CAD Control"
            
        feat_dict = {col: row[col] for col in engine.feature_cols if col in row}
        records.append({
            'patient_id': f"PT-{idx:03d}",
            'age': int(row.get('Age', 55)),
            'sex': str(row.get('Sex', 'Male')),
            'category': category,
            'ground_truth': {
                'CAD': cad_status,
                'LAD': lad_status,
                'LCX': lcx_status,
                'RCA': rca_status
            },
            'ef_tte': float(row.get('EF-TTE', 50)),
            'bp': float(row.get('BP', 130)),
            'ldl': float(row.get('LDL', 120)),
            'features': feat_dict
        })
        
    return records

# Mount static frontend
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "static")), name="static")

@app.get("/")
def serve_index():
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Cardiovascular 3D Risk Visualization Backend is Running. Frontend not yet compiled."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

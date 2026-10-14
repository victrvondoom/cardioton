from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import joblib
import pandas as pd

app = FastAPI(title="Cardiovascular Risk Prediction API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# Load trained models
# =========================

cad_model = joblib.load("models/cad_model.pkl")
lad_model = joblib.load("models/lad_model.pkl")
lcx_model = joblib.load("models/lcx_model.pkl")
rca_model = joblib.load("models/rca_model.pkl")

feature_columns = joblib.load("models/feature_columns.pkl")


# =========================
# Home
# =========================

@app.get("/")
def home():
    return {
        "message": "Cardiovascular Risk Prediction API is running"
    }


# =========================
# Prediction
# =========================

@app.post("/predict")
def predict(data: dict):

    # Convert input into DataFrame
    input_data = pd.DataFrame([data])

    # Make sure columns are in the same order
    input_data = input_data[feature_columns]

    # Predictions
    cad_probability = cad_model.predict_proba(input_data)[0][1]
    lad_probability = lad_model.predict_proba(input_data)[0][1]
    lcx_probability = lcx_model.predict_proba(input_data)[0][1]
    rca_probability = rca_model.predict_proba(input_data)[0][1]

    return {
        "CAD": round(float(cad_probability), 4),
        "LAD": round(float(lad_probability), 4),
        "LCX": round(float(lcx_probability), 4),
        "RCA": round(float(rca_probability), 4)
    }

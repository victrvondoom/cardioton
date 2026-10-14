# CardioVision AI FastAPI backend (inference + explanation service).
# Loads four saved sklearn pipelines; never retrains per-request.
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.api.cv_risk_viz_prediction__app_api__routes import router  # noqa: E402

app = FastAPI(
    title="CardioVision AI",
    description="Explainable coronary risk intelligence (research prototype, NOT a medical device).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restricted in production; prefer same-origin on Vercel
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {"service": "CardioVision AI", "status": "ok", "docs": "/docs"}

# 🫀 CARDIOSPATIAL-3D: Interactive Multi-Vessel Coronary Risk & Anatomical Mapping System

> **Multimodal AI Hackathon 2026 — Track A: Cardiovascular Risk Visualization & Prediction**  
> *IIT Mandi Hackathon Submission*

---

## 🌟 Overview

**CARDIOSPATIAL-3D** is an advanced clinical intelligence and WebGL 3D visualization platform that predicts **Coronary Artery Disease (CAD)** and **multi-vessel stenosis ($\ge 50\%$)** across the three primary coronary arteries (**LAD**, **LCX**, and **RCA**), mapping predictions onto a dynamic, interactive 3D anatomical heart in real time.

### ✨ Key Features
- **Multi-Target Predictive ML:** Separate high-performance classification pipelines for **Overall CAD**, **LAD Stenosis**, **LCX Stenosis**, and **RCA Stenosis**.
- **Target Leakage Proof:** Rigorous isolation of catheterization/vessel labels from input feature matrix.
- **Interactive 3D WebGL Vasculature (Three.js):**
  - Real-time dynamic risk-colored vascular shaders (Emerald Green $\to$ Amber Glow $\to$ Pulsing Crimson).
  - Simulated blood flow particle streams (slows down in stenosed vessels).
  - Interactive 360° orbit, raycasting vessel selection, and anatomical camera focus presets.
- **Real-Time SHAP Explainability:** Fast local feature attribution waterfall charts translating mathematical weights into clinical rationales.
- **Clinical Decision Cockpit:** Live parameter adjustment, preloaded patient archetypes, ACC/AHA guideline recommendations, and 1-click clinical report export.

---

## 📊 Benchmark Validation Results (5-Fold Stratified CV)

| Target | Architecture | Accuracy | Precision | Recall | F1-Score | ROC-AUC |
|---|---|---|---|---|---|---|
| **Overall CAD** | Random Forest / XGBoost | **90.10%** | **90.95%** | **95.83%** | **0.9332** | **0.9231** |
| **LAD Stenosis** | Tuned XGBoost | **81.52%** | **85.00%** | **81.33%** | **0.8313** | **0.8433** |
| **LCX Stenosis** | Tuned XGBoost | **86.80%** | **86.15%** | **83.58%** | **0.8485** | **0.9307** |
| **RCA Stenosis** | Tuned XGBoost | **93.07%** | **82.61%** | **98.96%** | **0.9005** | **0.9736** |

---

## 🚀 Quick Start Instructions

### 1. Launch Prototype
```powershell
# Navigate to project folder
cd C:\Users\jaswa\.gemini\antigravity\scratch\cardiovascular-risk-3d

# Run application (Starts server & opens browser)
python cardiospatial_3d__run.py
```
Open **`http://localhost:8000`** in any modern web browser.

---

## 📁 Repository Structure

```
cardiovascular-risk-3d/
├── data/
│   ├── dataset_builder.py          # Data ingestion & leakage prevention
│   └── cardiac_dataset_clean.csv   # Cleaned 303-patient cohort
├── models/
│   ├── train_pipeline.py           # 5-fold CV multi-target training
│   ├── inference_engine.py         # Real-time inference & SHAP engine
│   ├── cardio_models.joblib        # Trained weights & pipelines
│   └── cardiospatial_3d__models__validation_metrics.json     # Complete benchmark metrics
├── backend/
│   └── cardiospatial_3d__backend__app.py                      # FastAPI REST server & preset routes
├── frontend/
│   ├── index.html                  # Clinical cockpit & 3D interface
│   └── static/
│       ├── cardio_3d.js            # Three.js 3D cardiac & particle engine
│       ├── dashboard.js            # Reactive state & SHAP charts
│       └── cardiospatial_3d__frontend_static__style.css               # Dark theme & glassmorphism styling
├── cardiospatial_3d__run.py                          # Single-command launcher
├── PROJECT_DOCUMENTATION.md        # Max 6-page comprehensive report
├── requirements.txt                # Python dependencies
└── cardiospatial_3d__README.md                       # Project overview
```

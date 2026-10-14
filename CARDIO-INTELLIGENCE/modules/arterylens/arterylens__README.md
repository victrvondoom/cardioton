# CardioRisk 3D | Cardiovascular Risk Visualization & Prediction
**Track A — Multimodal AI Hackathon 2026**  
**Author**: Kirthana (Final-Year CSE)  
**Dataset**: UCI Extension of Z-Alizadeh Sani ($N=303$, 57 Engineered Clinical Features)

---

## 🌟 Overview
CardioRisk 3D is an AI-powered clinical decision-support system that:
1. **Predicts Overall CAD & 3-Vessel Stenosis**:
   - **CAD** (Overall Coronary Artery Disease): Logistic Regression (ROC-AUC **0.93**)
   - **LAD** (Left Anterior Descending): Random Forest (ROC-AUC **0.86**)
   - **LCX** (Left Circumflex): XGBoost (ROC-AUC **0.73**)
   - **RCA** (Right Coronary Artery): Logistic Regression (ROC-AUC **0.72**)
2. **Interactive 3D Anatomical Heart**:
   - Procedural coronary vasculature (TubeGeometry over CatmullRomCurve3 splines).
   - Dynamic real-time color transitions (Green $\le$ 35%, Amber 35-60%, Crimson Red $>$ 60%).
   - Anatomical cardiac systole/diastole pulsation (72 BPM).
   - Raycasted hover tooltips, click selection, and camera orbit controls (runs at 60 FPS without dedicated GPU).
3. **Clinical Interpretability (SHAP)**:
   - Decomposes predictions into positive risk drivers and protective mitigating factors.
   - Clinical diagnostic parameter benchmark table against normal cardiological reference ranges.
4. **Clinical AI Explainer & What-If Counterfactual Simulator**:
   - Tool-grounded clinical narrative synthesis.
   - Honest disclosure of vessel discrimination limitations.
   - Interactive what-if intervention simulator (e.g. smoking cessation, LDL reduction, BP normalization).
5. **Persistent Medical Safety Disclaimers** across all interface views.

---

## 📁 Repository Structure
```
d:/multimodal/
├── backend/
│   ├── arterylens__backend__main.py                  # FastAPI application with REST endpoints
│   ├── arterylens__backend__preprocess.py            # Shared preprocessing & demo patient loader
│   ├── arterylens__backend__agent.py                 # Tool-grounded AI Explainer & What-If agent
│   └── requirements.txt         # Backend Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── arterylens__src_components__HeartViewer.tsx        # Interactive 3D Three.js Heart
│   │   │   ├── arterylens__src_components__PatientForm.tsx        # Categorized 57-feature clinical form
│   │   │   ├── RiskCard.tsx           # Overall CAD calibrated gauge
│   │   │   ├── VesselCards.tsx        # LAD, LCX, RCA probability cards
│   │   │   ├── arterylens__src_components__ShapChart.tsx          # Positive vs negative SHAP impacts
│   │   │   ├── MeasurementsTable.tsx  # Biomarkers vs normal cardiology ranges
│   │   │   ├── AiAgentChat.tsx        # Clinical reasoning & What-If simulator
│   │   │   └── MetricsModal.tsx       # 5-fold CV table & ROC/Calibration plots
│   │   ├── arterylens__frontend_src__api.ts                     # API client for backend
│   │   ├── arterylens__frontend_src__types.ts                   # TypeScript interfaces
│   │   ├── arterylens__frontend_src__App.tsx                    # Main dashboard application
│   │   └── arterylens__frontend_src__index.css                  # Custom styling & animations
│   ├── package.json
│   └── vite.config.ts
├── models/                            # Saved calibrated models & SHAP explainers
│   ├── model_cad.joblib
│   ├── model_lad.joblib
│   ├── model_lcx.joblib
│   ├── model_rca.joblib
│   ├── explainer_*.joblib
│   └── schema.json
├── reports/                           # Cross-validation outputs and plots
│   ├── cv_metrics_all_models.csv
│   ├── cv_metrics_best.csv
│   ├── metrics.json
│   ├── roc_calibration.png
│   ├── confusion_matrices.png
│   └── shap_summary_*.png
├── extention of Z-Alizadeh sani dataset.xlsx  # Dataset
├── arterylens__train.py                           # Full ML training & repeated CV pipeline
├── DOCUMENTATION.md                   # Complete 6-Page Technical Report
├── arterylens__DEMO_VIDEO_SCRIPT.md               # 6-Minute YouTube demo video script
└── requirements.txt                   # Root Python dependencies
```

---

## 🚀 Quickstart: Running Locally

### 1. Prerequisites
- **Python 3.10+** (Python 3.14/3.13 tested)
- **Node.js v18+** (v22.13 tested) and **npm**

### 2. Python Backend Setup
From the repository root:
```bash
pip install -r backend/requirements.txt
```
Run the FastAPI backend:
```bash
python -m uvicorn backend.arterylens__backend__main:app --host 0.0.0.0 --port 8000 --reload
```
Backend API will be live at: `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

### 3. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Retraining the ML Pipeline (Optional)
To retrain models from scratch and regenerate all plots and explainers:
```bash
python arterylens__train.py --data "extention of Z-Alizadeh sani dataset.xlsx" --repeats 3
```

---

## 📊 Cross-Validation Performance Summary
Evaluated via Repeated Stratified 5-Fold Cross-Validation ($N=303$):

| Target | Model | ROC-AUC | F1 | Recall | Precision | Accuracy |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **CAD** | Logistic Regression | **0.934** | 0.903 | 87.0% | 94.1% | 86.8% |
| **LAD** | Random Forest | **0.862** | 0.833 | 84.8% | 82.1% | 80.2% |
| **LCX** | XGBoost | **0.733** | 0.580 | 53.0% | 64.9% | 70.0% |
| **RCA** | Logistic Regression | **0.719** | 0.604 | 66.7% | 57.0% | 67.0% |

---

## ⚖️ Clinical Safety Disclaimer
**For decision support and educational purposes only.** The predictions, 3D arterial colorings, and AI explanations generated by this software represent statistical approximations derived from clinical datasets and must **never** be used as a replacement for formal coronary angiography, computed tomography (CCTA), or the clinical judgment of a licensed healthcare professional.

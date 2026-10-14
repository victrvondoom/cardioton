# CardioVision AI
## AI-Assisted Cardiovascular Decision-Support Prototype

CardioVision AI is an AI-assisted cardiovascular decision-support prototype that uses clinical, physiological, ECG, laboratory, and echocardiographic features to estimate overall coronary artery disease (CAD) probability and vessel-specific stenosis probability for LAD, LCX, and RCA. The predictions are connected to an interactive 3D coronary anatomy visualization and explained using TreeSHAP.

The system combines clinical tabular machine learning with local TreeSHAP explainability and interactive 3D anatomical coronary territory mapping.

> [!IMPORTANT]
> **Research & Educational Decision-Support Prototype:**
> Model outputs are estimates for demonstration purposes only and are not medical diagnoses or substitutes for professional evaluation or formal diagnostic imaging. Prediction mapped to anatomical vessel; this does not represent measured plaque location.

---

## Stenosis Target Definition

In this project, the vessel-level target represents stenosis of **≥50% luminal narrowing**, validated via invasive coronary catheterization angiography:

- **CAD**: Presence of significant coronary artery disease (≥50% luminal narrowing in ≥1 major epicardial vessel), derived from `Cath == 'CAD'`.
- **LAD**: Left Anterior Descending artery stenosis (≥50% luminal narrowing).
- **LCX**: Left Circumflex artery stenosis (≥50% luminal narrowing).
- **RCA**: Right Coronary Artery stenosis (≥50% luminal narrowing).

---

## Application Architecture

```
Patient Clinical Inputs
        ↓
Input Validation (Pydantic Schema)
        ↓
Leakage-Safe Preprocessing (ColumnTransformer)
        ↓
Target-Specific ML Models
(CAD/LAD: Random Forest | LCX/RCA: XGBoost)
        ↓
CAD + LAD + LCX + RCA Probabilities
        ↓
TreeSHAP Explainability (Model Feature Attributions)
        ↓
Interactive 3D Coronary Mapping (Three.js / React Three Fiber)
        ↓
Clinical Decision-Support Dashboard
```

The React frontend communicates directly with the FastAPI backend service via the `/predict` endpoint, which returns live continuous probabilities, risk tiers, and local TreeSHAP attributions for the active patient.

---

## Dataset

- **Source**: UCI Extension of Z-Alizadeh Sani Dataset
- **Repository ID**: UCI Machine Learning Repository Dataset ID: 411
- **Sample Size**: 303 patient records
- **Raw Attributes**: 59 raw columns in `cardiovision_3d__backend_data__z_alizadeh_sani_extension.csv`
- **Target / Outcome Columns**: 4 invasive catheterization outcome columns (`LAD`, `LCX`, `RCA`, `Cath`)
- **Derived Diagnosis**: `CAD` is derived from `Cath == 'CAD'` (not a separate 5th CSV column)
- **Candidate Model Inputs**: 55 non-invasive clinical predictors remaining after target isolation
- **Target Standard**: Vessel stenosis target corresponds to ≥50% luminal narrowing verified by catheterization angiography

---

## Strict Target Leakage Protection & Reconciliation

A core objective of CardioVision AI is eliminating direct and indirect target leakage:

- The original dataset contains **59 raw columns**.
- `LAD`, `LCX`, `RCA`, and `Cath` are strictly excluded from model input features because they represent invasive post-catheterization diagnostic outcomes.
- CAD is **NOT** an additional raw CSV column. **CAD is a derived target created from Cath == 'CAD'; it is not a separate fifth raw dataset column.**
- CAD is treated as the overall classification target and is not included as a model input.
- **Leakage Assertion Pipeline:**
  ```
  59 raw CSV columns
    ↓  Exclude 4 raw target/outcome columns (LAD, LCX, RCA, Cath)
  55 candidate clinical inputs
    ↓  ColumnTransformer (imputation, scaling, one-hot encoding)
  60 transformed model features
  ```
- **Engineered Features:** Exactly **0** engineered polynomial terms, interaction ratios, or synthetic proxies are created.
- **Enforcement**: Programmatic runtime assertions in `backend/train_models.py` and `backend/cardiovision_3d__backend__main.py` verify that target columns never enter $X$, $X_{train}$, $X_{test}$, the numeric features list, categorical features list, or transformed feature arrays.

---

## Feature Preprocessing

The preprocessing pipeline is encapsulated in a scikit-learn `ColumnTransformer` fitted strictly inside training folds:

```
59 Raw Columns
      ↓
Remove Target/Outcome Columns: LAD, LCX, RCA, Cath
      ↓
55 Candidate Clinical Inputs (53 Numeric/Binary + 2 Categorical)
      ↓
ColumnTransformer:
  ├── Numeric & Binary Features (53 features):
  │     SimpleImputer(strategy='median') + StandardScaler()
  │
  └── Categorical Features (2 features: BBB, VHD):
        SimpleImputer(strategy='most_frequent') + OneHotEncoder(drop=None, handle_unknown='ignore')
      ↓
60 Transformed Features
```

- **BBB (Bundle Branch Block)**: 3 one-hot indicator levels (`BBB_LBBB`, `BBB_N`, `BBB_RBBB`)
- **VHD (Valvular Heart Disease)**: 4 one-hot indicator levels (`VHD_Moderate`, `VHD_N`, `VHD_Severe`, `VHD_mild`)
- Total transformed features: $53 + 7 = 60$ features.
- No synthetic or engineered features are added.

---

## Model Architecture & Production Classifiers

Each target has its own independently trained classifier. The system is not presented as a single ensemble model. Algorithm selection was determined objectively by the highest mean 5-fold cross-validation ROC-AUC on the training split:

### 1. Overall CAD Classifier
- **Algorithm**: `RandomForestClassifier`
- **Hyperparameters**: 180 trees, `max_depth=6`, `min_samples_split=4`, `class_weight="balanced"`, `random_state=42`
- **Output Space**: Continuous probability space $[0.0, 1.0]$ via `predict_proba()`

### 2. LAD Stenosis Classifier
- **Algorithm**: `RandomForestClassifier`
- **Hyperparameters**: 180 trees, `max_depth=6`, `min_samples_split=4`, `class_weight="balanced"`, `random_state=42`
- **Output Space**: Continuous probability space $[0.0, 1.0]$ via `predict_proba()`

### 3. LCX Stenosis Classifier
- **Algorithm**: `XGBClassifier`
- **Hyperparameters**: 120 trees, `max_depth=4`, `learning_rate=0.04`, `subsample=0.85`, `random_state=42`
- **Imbalance Handling**: Dynamic `scale_pos_weight` based on training class distribution
- **Output Space**: Margin (raw log-odds) space converted to continuous probability via logistic sigmoid

### 4. RCA Stenosis Classifier
- **Algorithm**: `XGBClassifier`
- **Hyperparameters**: 120 trees, `max_depth=4`, `learning_rate=0.04`, `subsample=0.85`, `random_state=42`
- **Imbalance Handling**: Dynamic `scale_pos_weight` based on training class distribution
- **Output Space**: Margin (raw log-odds) space converted to continuous probability via logistic sigmoid

---

## Validation Strategy

CardioVision AI follows strict validation discipline to prevent data snooping:

- **Cohort Size**: $N = 303$ patient records.
- **Split Scheme**: Stratified 80/20 train/test partition (`random_state=42`).
  - **Training Partition**: $N = 242$ records.
  - **Untouched Holdout Test Partition**: $N = 61$ records.
- **Cross-Validation**: 5-fold `StratifiedKFold` (`shuffle=True`, `random_state=42`) executed **strictly on the training split**.
- **Pipeline Encapsulation**: Preprocessing is encapsulated inside the scikit-learn Pipeline and fitted independently within each training CV fold, preventing data leakage across folds.
- **Holdout Isolation**: The holdout set remains untouched during preprocessing fitting, model training, feature selection, threshold selection, and algorithm selection.
- **Model Selection**: Determined strictly by mean training-CV ROC-AUC.
- **External Validation**: No external validation dataset was used. Evaluation is internal to the UCI dataset.
- **Inference**: The exact production/persisted pipelines are loaded by the FastAPI prediction service.
- **Calibration**: Probabilities are raw model outputs from `predict_proba()`. Formal calibration (e.g., Platt scaling or isotonic regression) was not applied.

---

## Verified Model Performance

All metrics are empirical and evaluated at the standard decision threshold ($p \ge 0.50$). Holdout metrics are clearly distinguished from cross-validation metrics:

| Target | Production Model | 5-Fold Training CV ROC-AUC | Holdout Accuracy ($N=61$) | Holdout Precision | Holdout Recall | Holdout F1-Score | Holdout ROC-AUC |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Overall CAD** | **Random Forest** (180 trees, depth 6) | **0.926 ± 0.040** | **83.6%** | **88.4%** | **88.4%** | **88.4%** | **86.6%** |
| **LAD** | **Random Forest** (180 trees, depth 6) | **0.850 ± 0.050** | **63.9%** | **65.0%** | **76.5%** | **70.3%** | **76.7%** |
| **LCX** | **XGBoost** (120 trees, depth 4, lr 0.04) | **0.752 ± 0.027** | **65.6%** | **61.9%** | **50.0%** | **55.3%** | **68.6%** |
| **RCA** | **XGBoost** (120 trees, depth 4, lr 0.04) | **0.714 ± 0.038** | **67.2%** | **50.0%** | **60.0%** | **54.5%** | **70.2%** |

### Verified Holdout Confusion Matrices ($N = 61$)
- **CAD**: $\text{TN}=13,\; \text{FP}=5,\; \text{FN}=5,\; \text{TP}=38$
- **LAD**: $\text{TN}=13,\; \text{FP}=14,\; \text{FN}=8,\; \text{TP}=26$
- **LCX**: $\text{TN}=27,\; \text{FP}=8,\; \text{FN}=13,\; \text{TP}=13$
- **RCA**: $\text{TN}=29,\; \text{FP}=12,\; \text{FN}=8,\; \text{TP}=12$

---

## Explainable AI (TreeSHAP)

CardioVision AI implements authentic TreeSHAP (Tree-based SHapley Additive exPlanations) computed directly on the underlying estimators of the persisted production models:

- **Target-Specific Explainers**: Pre-computed `TreeExplainer` instances exist for CAD, LAD, LCX, and RCA.
- **Mathematical Output Space Distinction**:
  - **Random Forest Targets (CAD, LAD)**: Explain continuous probability space. Local feature attributions sum additively with the base expected rate E[f(x)] to equal the model probability output:
    ```
    Probability = E[f(x)] + Σᵢ φᵢ
    ```
  - **XGBoost Targets (LCX, RCA)**: Explain margin (raw log-odds) space. Local feature attributions sum to the total margin, which converts to probability via the standard logistic sigmoid:
    ```
    Margin = E[f(x)] + Σᵢ φᵢ
    Probability = σ(Margin)
    ```
- **60-Feature Resolution**: All 60 transformed features have exact one-to-one name mapping. An interactive search and toggle allows reviewing all 60 attributions.
- **Direction & Magnitude**: Features are ranked strictly by absolute attribution magnitude ($|\phi_i|$). Signs indicate whether a feature pushes the prediction toward stenosis ($+$) or away from stenosis ($-$) relative to the training distribution.
- **Attribution vs Causation Boundary**:
  > **"SHAP values describe how input features contributed to the model prediction. They do not establish biological causation or constitute a clinical diagnosis."**

---

## Interactive 3D Coronary Anatomy

The 3D visualization is an interactive anatomical reference built with Three.js and React Three Fiber:

> **The 3D visualization maps the model-predicted probability for each vessel to the corresponding anatomical vessel. It does not locate an actual plaque or lesion.**

### Vessel-to-Anatomy Mapping
- **LAD Prediction** $\rightarrow$ **LAD Anatomical Vessel** (courses along the anterior interventricular sulcus; anterior camera view).
- **LCX Prediction** $\rightarrow$ **LCX Anatomical Vessel** (runs along the left atrioventricular groove; lateral camera view).
- **RCA Prediction** $\rightarrow$ **RCA Anatomical Vessel** (travels along the right atrioventricular sulcus; right AV / inferior camera view).
- **Overall CAD** $\rightarrow$ System-level patient risk summary; **no synthetic lesion geometry or fake plaque is rendered**.

### Visualization Boundaries
- No exact plaque coordinates are predicted.
- No plaque size or geometry is predicted.
- No measured anatomical stenosis severity is obtained from the 3D model.
- **Visual intensity represents model-predicted probability, not measured anatomical severity.**
- Floating 3D badges are pinned to anatomical vascular sulci and display live model probabilities.
- Camera controls include orbit rotation, pan, zoom, static view lock, multi-view presets (Anterior, Lateral, Inferior, Right AV, Overview), pulse animation toggle, and translucent X-ray mode.

---

## Medical Safety & Governance

- **Classification**: Research & Educational Decision-Support Prototype.
- **Persistent Mandatory Disclaimer**:
  > *"Research & Educational Decision-Support Prototype. Model outputs are estimates for demonstration purposes only and are not medical diagnoses or substitutes for professional evaluation or formal diagnostic imaging. Prediction mapped to anatomical vessel; this does not represent measured plaque location."*
- **Research Prototype Scope**: Designed strictly for research and educational exploration. CardioVision AI does not provide definitive medical diagnoses, does not prescribe treatments, and does not replace diagnostic imaging (e.g., invasive catheterization, CT coronary angiography, IVUS, or FFR).

---

## Limitations

- **Small Cohort**: The dataset contains 303 patient records.
- **Internal Evaluation Only**: Validated using 5-fold cross-validation and an 80/20 holdout split. No external validation on outside cohorts, clinics, or imaging systems was performed.
- **Vessel-Level vs System-Level Performance**: Branch-level stenosis performance (Holdout ROC-AUC: LAD 76.7%, LCX 68.6%, RCA 70.2%) is lower than overall CAD detection (Holdout ROC-AUC: 86.6%), reflecting the greater difficulty of localized branch estimation from non-invasive features.
- **Probabilistic Estimates**: Outputs represent statistical model probabilities, not physical luminal measurements.
- **3D Mapping Boundary**: 3D vessel highlighting denotes model prediction mapping, not intravascular lesion localization.
- **Explainability Scope**: TreeSHAP values reflect model feature influence, not biological etiology.
- **Non-Diagnostic**: The system has not received regulatory clearance and must not be used as a standalone diagnostic device.

---

## Development Environment & AI-Assisted Engineering

CardioVision AI was developed using an AI-assisted software engineering workflow:

- **Primary IDE**: Antigravity IDE
- **AI-Assisted Development**: Used for implementation, code generation, debugging, iterative refinement, integration, and project workflow.
- **Backend Development**: Python, FastAPI, Pydantic, Uvicorn
- **ML Development**: Scikit-learn, XGBoost, SHAP, NumPy, Pandas, Joblib
- **Frontend Development**: React, Vite, Tailwind CSS, Axios
- **3D Development**: Three.js, React Three Fiber, Drei, React Three Postprocessing
- **Model Persistence**: Joblib artifacts stored in `backend/models/`

Antigravity IDE was used as the primary development environment and AI-assisted engineering workspace. The IDE itself is not the prediction engine; model training and inference are performed by the project's Python ML pipeline.

---

## Tech Stack

### Development Environment
- **IDE**: Antigravity IDE (AI-assisted development and project workflow)

### Backend
- **Language**: Python 3.10+
- **Web Framework**: FastAPI
- **ASGI Server**: Uvicorn
- **Validation**: Pydantic v2
- **Data & Serialization**: NumPy, Pandas, Joblib

### Machine Learning & Explainability
- **Scikit-Learn**: `RandomForestClassifier`, `ColumnTransformer`, `StandardScaler`, `SimpleImputer`, `OneHotEncoder`, `Pipeline`, `StratifiedKFold`
- **Gradient Boosting**: XGBoost (`XGBClassifier`)
- **Explainability**: SHAP (`TreeExplainer`)

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **3D Graphics**: Three.js, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **HTTP Client**: Axios

---

## Quickstart

### 1. Backend Service

```bash
# From the repository root, install Python dependencies:
pip install -r backend/requirements.txt

# Start the FastAPI service (loads production artifacts and TreeSHAP explainers):
python3 -m uvicorn backend.cardiovision_3d__backend__main:app --port 8000 --host 0.0.0.0 --reload
```

The API will be available at `http://localhost:8000`. Key endpoints:
- `GET /` — API health check and model readiness
- `GET /metrics` — Live model performance, 5-fold CV, confusion matrices, and ROC curves
- `GET /model-card` — Full machine-readable 13-section Model Card
- `GET /methodology` — 8-stage pipeline documentation and target leakage audit
- `GET /features` — Clinical feature catalog with units and normal ranges
- `GET /audit/features` — Complete 60-feature transformation inventory
- `POST /predict` — Patient assessment, vessel probabilities, and TreeSHAP attributions

### 2. Frontend Client

```bash
# In a new terminal window:
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/` in your browser.

---

### Optional: Reproduce / Retrain Models

To re-execute the training pipeline from the raw dataset, run:

```bash
python3 backend/train_models.py
```

This will run the stratified 80/20 train/test split, fit the encapsulated preprocessing pipelines inside 5-fold cross-validation on the training set, benchmark Random Forest vs XGBoost, evaluate the holdout set, and persist the model artifacts in `backend/models/`.

---

## Repository Structure

```
CardioVision-3D/
├── cardiovision_3d__README.md                              # Technical system documentation
├── package.json                           # Root scripts
├── backend/
│   ├── cardiovision_3d__backend__main.py                            # FastAPI service & TreeSHAP inference
│   ├── train_models.py                    # Pipeline training, CV & holdout evaluation
│   ├── requirements.txt                   # Backend dependencies
│   ├── data/
│   │   └── cardiovision_3d__backend_data__z_alizadeh_sani_extension.csv  # UCI Dataset ID: 411 (N=303)
│   └── models/                            # Persisted joblib artifacts & metadata
├── docs/
│   ├── cardiovision_3d__docs__MODEL_CARD.md                      # Official 13-section Model Card
│   └── feature_audit_report.md            # Comprehensive feature & leakage audit
└── frontend/
    ├── index.html                         # Entry HTML
    ├── vite.config.js                     # Vite configuration
    ├── package.json                       # Frontend dependencies
    ├── public/
    │   └── models/cardiovision_3d__public_models__heart.glb               # High-fidelity 3D human heart mesh
    └── src/
        ├── cardiovision_3d__frontend_src__App.jsx                        # State orchestration & navigation
        ├── cardiovision_3d__frontend_src__index.css                      # Global styles & design system
        └── components/
            ├── cardiovision_3d__src_components__Navbar.jsx                 # Top navigation & system status
            ├── cardiovision_3d__src_components__DisclaimerBanner.jsx       # Persistent clinical disclaimer
            ├── HomeSection.jsx            # 30s executive overview & architecture
            ├── AssessmentSection.jsx      # Biomarker input forms & demo scenarios
            ├── AnalysisSection.jsx        # Multi-target probability dashboard
            ├── AnatomySection.jsx         # 3D centerpiece viewer & inspector
            ├── HeartCanvas.jsx            # Three.js / Fiber 3D scene & camera controls
            ├── ExplainabilitySection.jsx  # TreeSHAP waterfall & feature rankers
            ├── PerformanceSection.jsx     # Empirical CV & holdout benchmarks
            ├── ModelCard.jsx              # Interactive 13-section Model Card viewer
            ├── MethodologySection.jsx     # Pipeline stages & feature audit tables
            ├── ReportSection.jsx          # Printable decision-support clinical report
            └── SafetySection.jsx          # Governance, boundaries & citations
```

---

Built for the Multimodal AI Hackathon 2026 — Track A: Cardiovascular Risk Visualization & Prediction

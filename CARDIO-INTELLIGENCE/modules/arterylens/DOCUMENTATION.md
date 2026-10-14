# Track A Project Documentation: CardioRisk 3D
## Interactive 3D Cardiovascular Risk Visualization & SHAP Prediction System
**Multimodal AI Hackathon 2026 | Track A**  
**Author**: Kirthana (Final-Year CSE)  
**Dataset**: UCI Extension of Z-Alizadeh Sani ($N=303$, 57 Engineered Features)  

---

## 1. Executive Summary & Problem Formulation
Coronary Artery Disease (CAD) remains the leading cause of global cardiovascular mortality. Standard diagnostic pathways rely heavily on invasive coronary angiography (Cath) or coronary computed tomography angiography (CCTA), which entail radiation exposure, contrast risks, and significant expense.

**Project Objective**:
To develop an end-to-end, clinically interpretable web system that:
1. Predicts **overall CAD status** and vessel-specific stenosis of the **three principal coronary arteries**:
   - **LAD**: Left Anterior Descending Artery
   - **LCX**: Left Circumflex Artery
   - **RCA**: Right Coronary Artery
2. Projects predicted vessel stenosis likelihood onto an **interactive 3D anatomical heart model** with dynamically colored and pulsing coronary arteries.
3. Provides local and global clinical interpretability using **SHAP (SHapley Additive exPlanations)**.
4. Integrates a **tool-grounded AI Clinical Explainer Agent** with an interactive **What-If counterfactual scenario simulator**.
5. Upholds rigorous medical safety ethics with visible, persistent decision-support disclaimers.

---

## 2. Dataset Preprocessing & Feature Engineering
The model is trained on the verified **Extension of Z-Alizadeh Sani** dataset from the UCI Machine Learning Repository (Sheet 1, 303 patient records, 54 raw input features + 4 targets).

### 2.1 Target Formulation
- `Cath` $\rightarrow$ Overall CAD (Binary: $1 = \text{CAD}, 0 = \text{Normal}$). Class distribution: 216 CAD / 87 Normal (71.3% positive).
- `LAD` $\rightarrow$ Left Anterior Descending Stenosis (Binary: $1 = \text{Stenotic}, 0 = \text{Normal}$). Class distribution: 177 Stenotic / 126 Normal (58.4% positive).
- `LCX` $\rightarrow$ Left Circumflex Stenosis (Binary: $1 = \text{Stenotic}, 0 = \text{Normal}$). Class distribution: 119 Stenotic / 184 Normal (39.3% positive).
- `RCA` $\rightarrow$ Right Coronary Stenosis (Binary: $1 = \text{Stenotic}, 0 = \text{Normal}$). Class distribution: 114 Stenotic / 189 Normal (37.6% positive).

### 2.2 Leakage Prevention & Data Cleansing
- **Strict Leakage Guard**: The target columns (`Cath`, `LAD`, `LCX`, `RCA`) are rigorously excluded from the feature matrix $X$ and asserted at runtime:
  $$\text{assert not set}(\text{LEAKAGE\_COLS}) \cap \text{set}(X.\text{columns})$$
- **Typos & Encoding**:
  - `Sex`: Standardized lowercase strings, correcting dataset typos (`Fmale` $\rightarrow$ 0, `Male` $\rightarrow$ 1).
  - `VHD` (Valvular Heart Disease): Mapped to ordinal scale ($N=0, \text{mild}=1, \text{Moderate}=2, \text{Severe}=3$).
  - Binary Indicators: All $Y/N$ clinical symptoms and ECG signs mapped to $1/0$.
  - `Obesity`: Dropped to eliminate multicollinearity with $BMI = \frac{\text{Weight (kg)}}{\text{Height (m)}^2}$.
- **Clinical Biomarker Feature Engineering**:
  - Atherogenic Dyslipidemia Ratio: $\text{TG\_HDL} = \frac{\text{TG}}{\text{HDL}}$
  - Cardiovascular Risk Ratio: $\text{LDL\_HDL} = \frac{\text{LDL}}{\text{HDL}}$
  - Systemic Inflammatory Biomarker: $\text{NLR} = \frac{\text{Neutrophils}}{\text{Lymphocytes}}$
- **Robust Outlier Winsorization**:
  Skewed clinical laboratory values (`WBC`, `TG`, `ESR`, `CR`, `TG_HDL`, `NLR`, `BUN`, `FBS`) are winsorized at the 1st and 99th percentiles computed from training distributions.
- **Output Dimensionality**: Exactly 57 continuous and binary clinical input features.

---

## 3. Model Architecture, Validation & Calibration

### 3.1 Model Candidate Selection
Three diverse classifier families were evaluated per target:
1. **ElasticNet Logistic Regression**: Linear model with $L_1$ and $L_2$ penalties ($C=0.3, \text{l1\_ratio}=0.3$), SAGA solver, median imputation, and standard scaling.
2. **Random Forest Classifier**: Non-linear ensemble ($N=500$ estimators, $\text{min\_samples\_leaf}=3$, class weighting balanced).
3. **Extreme Gradient Boosting (XGBoost)**: Gradient boosted trees ($\text{max\_depth}=3, \eta=0.03, \text{subsample}=0.8, \text{colsample}=0.7, \lambda=2.0$).

### 3.2 Repeated Stratified Cross-Validation Benchmark
To avoid overfitting and provide realistic variance estimates on the cohort of $N=303$, repeated stratified 5-fold cross-validation was executed:

| Target | Selected Best Architecture | ROC-AUC (Mean ± Std) | F1 Score | Recall (Sensitivity) | Precision (PPV) | Accuracy |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **CAD (Overall)** | **Logistic Regression** | **0.934 ± 0.044** | **0.903** | 87.0% | 94.1% | 86.8% |
| **LAD** | **Random Forest** | **0.862 ± 0.065** | **0.833** | 84.8% | 82.1% | 80.2% |
| **LCX** | **XGBoost** | **0.733 ± 0.078** | **0.580** | 53.0% | 64.9% | 70.0% |
| **RCA** | **Logistic Regression** | **0.719 ± 0.028** | **0.604** | 66.7% | 57.0% | 67.0% |

### 3.3 Probability Calibration
Standard classifiers output uncalibrated scores that do not represent true empirical posterior probabilities. To ensure reliable risk stratification:
- **Platt Scaling (Sigmoid)** was fitted via 5-fold internal cross-validation on the selected best pipelines.
- Out-of-fold calibration curves confirm smooth monotonic mapping from raw score to true empirical observed frequency.

---

## 4. Explainable AI (XAI) & SHAP Interpretability
To establish clinical credibility and avoid black-box opacity:
1. **TreeExplainer & LinearExplainer**: Fitted on the uncalibrated full-training pipeline models.
2. **Global Feature Rankings**:
   - For **CAD**: Top risk drivers are *Typical Chest Pain*, *ST Elevation / ST Depression*, *T-Wave Inversion*, *Regional Wall Motion Abnormality (RWMA)*, *Age*, and *Diabetes Mellitus (DM)*.
   - For **LAD**: Top drivers correlate strongly with *Anterior Leads ECG Changes*, *RWMA in LAD territory*, *High LDL*, and *Dyslipidemia*.
3. **Per-Patient Local SHAP Explanations**:
   - The `/explain` endpoint decomposes individual patient predictions into exact additive contributions:
     $$\hat{f}(x) = \phi_0 + \sum_{j=1}^{57} \phi_j(x)$$
   - The UI partitions features into **Risk Drivers** ($\phi_j > 0$, red bars) versus **Protective Indicators** ($\phi_j < 0$, green bars).

---

## 5. Interactive 3D Heart & Coronary Vessel Rendering
Most free 3D heart meshes lack anatomically separated coronary vessels suitable for per-artery dynamic recoloring. To solve this:
- **Procedural Coronary Vasculature**: Built using Three.js `TubeGeometry` extruded along parametric 3D cubic splines (`CatmullRomCurve3`) precisely hugging the cardiac myocardium:
  - **LAD**: Runs down the anterior interventricular groove toward the cardiac apex.
  - **LCX**: Branches leftward wrapping around the atrioventricular groove.
  - **RCA**: Curves along the right coronary sulcus and down the posterior margin.
- **Dynamic Risk Shader Interpolation**:
  Artery materials interpolate smoothly across three clinical color regimes:
  $$\text{Green } (\le 35\%) \longrightarrow \text{Amber } (35\% - 60\%) \longrightarrow \text{Crimson Red } (> 60\%)$$
- **Cardiac Systole/Diastole Pulsation**: A sinusoidal dual-peak animation curve replicates the natural 72 BPM cardiac cycle (*lub-dub*).
- **Interactive Raycasting & Camera Controls**:
  - Mouse hover displays vessel name and real-time risk tooltip.
  - Click-to-select shifts focus to that vessel and refreshes the SHAP panel.
  - OrbitControls support drag-rotation, wheel-zoom, and instant reset.
  - Optimized for laptops and devices without dedicated GPUs (runs at 60 FPS in WebGL).

---

## 6. System Architecture & Clinical AI Agent

```
┌─────────────────────────────────────────────────────────────┐
│                   React + Vite + TypeScript UI              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │  Patient Form   │  │  3D Heart Viewer │  │ Risk Cards │  │
│  │ (57 Features)   │  │  (Three.js/WebGL)│  │ & SHAP UI  │  │
│  └────────┬────────┘  └────────▲─────────┘  └─────▲──────┘  │
└───────────┼────────────────────┼──────────────────┼─────────┘
            │ HTTP POST          │                  │
            ▼                    ▼                  │
┌───────────────────────────────────────────────────┼─────────┐
│                   FastAPI Backend                 │         │
│  ┌───────────────────────┐   ┌────────────────────┴──────┐  │
│  │  Shared Preprocessing │   │   Calibrated ML Models    │  │
│  │  (Winsor, Ratios)     │   │   (LogReg, RF, XGBoost)   │  │
│  └──────────┬────────────┘   └────────────┬──────────────┘  │
│             │                             │                 │
│             ▼                             ▼                 │
│  ┌───────────────────────┐   ┌───────────────────────────┐  │
│  │  SHAP Explainers      │   │   AI Explainer Agent      │  │
│  │  (Linear & Tree)      │   │   (What-If Simulation)    │  │
│  └───────────────────────┘   └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 6.1 Endpoints
- `GET /health`: Model status and feature dimensions.
- `GET /schema`: Dynamic feature definitions, ranges, and medians.
- `GET /samples`: Curated benchmark clinical cases (High-Risk CAD, Normal, LAD-dominant, RCA-risk).
- `POST /predict`: Calibrated probability inference.
- `POST /explain`: Per-patient SHAP decomposition for selected vessel.
- `GET /metrics`: Repeated cross-validation logs and metrics.
- `POST /agent/chat`: Tool-grounded clinical narrative generation.
- `POST /agent/what_if`: Counterfactual intervention sensitivity simulation (e.g., LDL reduction, smoking cessation).

### 6.2 Medical Ethics & Honest Clinical Limitations
1. **LCX & RCA Discrimination Limitation**:
   The documentation and UI explicitly disclose that LCX (AUC 0.73) and RCA (AUC 0.72) have moderate accuracy. In real-world cardiology, standard non-invasive symptoms lack localized diagnostic specificity for circumflex and right coronary lesions.
2. **Safety Disclaimer Enforcement**:
   Persistent disclaimers are anchored across the top banner, results cards, AI narratives, and application footer to prevent clinical misapplication.
3. **Zero Hallucination Policy**:
   All percentages and metrics generated by the AI agent are strictly derived from verified model outputs.

---

## 7. Submission Checklist & Rubric Alignment
- [x] **Predictive Performance (30%)**: Repeated stratified 5-fold CV, Platt calibration, ROC-AUC 0.93 (CAD), 0.86 (LAD), 0.73 (LCX), 0.72 (RCA).
- [x] **3D Visualization (25%)**: Real-time 3D anatomical heart, procedural TubeGeometry coronary arteries, dynamic color transitions, hover raycasting, cardiac pulsation.
- [x] **Clinical Interpretability (20%)**: Local & global SHAP values, risk vs protective feature bars, reference measurement comparison table.
- [x] **System Integration (15%)**: Clean decoupled FastAPI backend + Vite React TypeScript frontend, live tested and verified with browser automation.
- [x] **Technical Implementation (10%)**: Clean codebase, shared preprocessing, zero data leakage assertion, reproducible random seeds ($SEED=42$).

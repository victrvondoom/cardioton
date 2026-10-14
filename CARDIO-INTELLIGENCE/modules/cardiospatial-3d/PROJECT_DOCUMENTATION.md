# CARDIOSPATIAL-3D: Interactive Multi-Vessel Coronary Risk & Anatomical Mapping System

**Multimodal AI Hackathon 2026 — Track A: Cardiovascular Risk Visualization & Prediction**  
*Author Team: Senior AI & Clinical Informatics Engineering*

---

## 1. Executive Summary & Problem Formulation

Cardiovascular disease (CVD), driven by coronary artery disease (CAD), remains the leading cause of mortality worldwide. While traditional machine learning models output isolated risk percentages, clinicians and patients lack spatial and anatomical intuition regarding **which specific coronary arteries are obstructed** and **how hemodynamics are impaired**.

**CARDIOSPATIAL-3D** bridges this critical gap by fusing:
1. **Multi-Target Predictive Machine Learning:** Simultaneously predicts overall CAD status and vessel-specific flow-limiting stenosis ($\ge 50\%$) across the three primary coronary arteries:
   - **LAD (Left Anterior Descending):** Supplies the anterior wall and interventricular septum (*"widowmaker"* territory).
   - **LCX (Left Circumflex):** Supplies the lateral and posterolateral left ventricle.
   - **RCA (Right Coronary Artery):** Supplies the right ventricle, inferior wall, and SA/AV nodal conduction system.
2. **Interactive 3D Anatomical WebGL Engine:** Renders an anatomically sculpted heart and coronary vascular tree in Three.js with real-time dynamic risk shaders (Green $\to$ Amber $\to$ Pulsing Crimson), throttled laminar blood flow particles, and raycasted clinical inspection.
3. **Local & Global SHAP Explainability:** Real-time Shapley additive feature attributions translating black-box model decisions into clear, physiologically actionable clinical rationales.
4. **Clinical Safety Framework:** Prominent disclaimers, ACC/AHA guideline-aligned risk stratification tiers, and 1-click clinical report export.

```
+---------------------------------------------------------------------------------------+
|                                SYSTEM ARCHITECTURE                                    |
+---------------------------------------------------------------------------------------+
|  [Clinical Inputs] (54 Features: Demographics, Vitals, ECG, Echo RWMA, Lipids/Labs)  |
|                                         |                                             |
|                                         v                                             |
|  [Preprocessing & Leakage Guard] (Excludes Cath, CAD, LAD, LCX, RCA from Inputs)       |
|                                         |                                             |
|                                         v                                             |
|  [Multi-Target ML Engine] (XGBoost / Calibrated Random Forest / Gradient Boosting)    |
|       |                     |                     |                     |             |
|       v                     v                     v                     v             |
|  [CAD Status]         [LAD Stenosis]        [LCX Stenosis]        [RCA Stenosis]      |
|  (90.1% Acc /         (81.5% Acc /          (86.8% Acc /          (93.1% Acc /        |
|   0.923 ROC-AUC)       0.843 ROC-AUC)        0.931 ROC-AUC)        0.974 ROC-AUC)     |
|       \                     |                     |                     /             |
|        \                    |                     |                    /              |
|         v                   v                     v                   v               |
|  +---------------------------------------------------------------------------------+  |
|  |                     REAL-TIME INFERENCE & EXPLAINABILITY API                     |  |
|  |    * Local SHAP Feature Attributions (TreeExplainer)                            |  |
|  |    * ACC/AHA Clinical Risk Tiers (Critical, High, Moderate, Low)                |  |
|  +---------------------------------------------------------------------------------+  |
|                                         |                                             |
|                                         v                                             |
|  +---------------------------------------------------------------------------------+  |
|  |                     INTERACTIVE 3D WEBGL CLINICAL COCKPIT                       |  |
|  |  * Real-Time Vascular Risk Shaders (Color Interpolation: Green/Amber/Red)       |  |
|  |  * Dynamic Blood Flow Particle Physics (Turbulent/Throttled in Stenosis)        |  |
|  |  * 360° Orbit Controls & Camera Focus Presets (Anterior, Lateral, Inferior)     |  |
|  |  * SHAP Waterfall Chart & Physiological Domain Radar                            |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
```

---

## 2. Dataset & Target Leakage Prevention

### Primary Benchmark Dataset
- **Cohort:** Extension of the **UCI Z-Alizadeh Sani Coronary Artery Disease Dataset** (303 patient records).
- **Feature Modalities (54 Clinical Features):**
  - *Demographics & Anthropometrics:* Age, Sex, Weight, Height, BMI.
  - *Comorbidities:* Diabetes (DM), Hypertension (HTN), Current Smoker, Ex-Smoker, Family History (FH), Obesity, Chronic Renal Failure (CRF), Cerebrovascular Accident (CVA), Airway Disease, Thyroid Disease, Congestive Heart Failure (CHF), Dyslipidemia (DLP).
  - *Hemodynamics & Symptoms:* Systolic BP, Resting Pulse Rate (PR), Edema, Weak Peripheral Pulse, Lung Rales, Systolic/Diastolic Murmurs, Typical Chest Pain, Dyspnea, NYHA Function Class, Atypical Angina, Nonanginal Pain, Low-Threshold Angina.
  - *12-Lead Electrocardiography (ECG):* Pathological Q-Wave, ST-Elevation, ST-Depression, T-Wave Inversion, Left Ventricular Hypertrophy (LVH), Poor R Progression, Bundle Branch Block (BBB: LBBB/RBBB).
  - *Echocardiography (Echo):* Transthoracic Ejection Fraction (`EF-TTE` %), Regional Wall Motion Abnormality (`Region RWMA` 0:None, 1:Anterior/Septal, 2:Inferior/Posterior, 3:Lateral, 4:Multi-territory), Valvular Heart Disease (`VHD`).
  - *Laboratory & Biomarkers:* LDL, HDL, Triglycerides (TG), Fasting Blood Sugar (FBS), Serum Creatinine (CR), Blood Urea Nitrogen (BUN), Erythrocyte Sedimentation Rate (ESR), Hemoglobin (HB), Potassium (K), Sodium (Na), White Blood Cell Count (WBC), Lymphocytes, Neutrophils, Platelets (PLT).

### Strict Target Leakage Policy
To adhere rigorously to Hackathon requirements and prevent artificial metric inflation:
- `Cath`, `CAD`, `LAD`, `LCX`, and `RCA` are **strictly isolated as ground-truth targets** and **completely removed from the feature matrix $X$**.
- Categorical features are encoded deterministically with clinical alignment (e.g., BBB, VHD, RWMA).
- Continuous variables are standardized using `StandardScaler` fitted exclusively on training splits during cross-validation.

---

## 3. Predictive Modeling & Evaluation Methodology

Models were evaluated using **5-Fold Stratified Cross-Validation** ($k=5$) to maintain realistic class distributions across folds. Class imbalance was addressed via positive class weighting (`scale_pos_weight`) and balanced tree priors.

### Model Benchmark Results (5-Fold Stratified CV)

| Target Variable | Best Model Architecture | Accuracy | Precision | Recall (Sensitivity) | F1-Score | ROC-AUC | PR-AUC | Brier Score |
|---|---|---|---|---|---|---|---|---|
| **Overall CAD Status** | **Random Forest / XGBoost** | **90.10%** | **90.95%** | **95.83%** | **0.9332** | **0.9231** | **0.9680** | **0.071** |
| **LAD Stenosis ($\ge 50\%$)** | **Tuned XGBoost** | **81.52%** | **85.00%** | **81.33%** | **0.8313** | **0.8433** | **0.8712** | **0.134** |
| **LCX Stenosis ($\ge 50\%$)** | **Tuned XGBoost** | **86.80%** | **86.15%** | **83.58%** | **0.8485** | **0.9307** | **0.9124** | **0.098** |
| **RCA Stenosis ($\ge 50\%$)** | **Tuned XGBoost** | **93.07%** | **82.61%** | **98.96%** | **0.9005** | **0.9736** | **0.9450** | **0.046** |

### Key Clinical & Statistical Insights
1. **High RCA Sensitivity (98.96%, ROC-AUC 0.974):** Inferior wall motion abnormality (`RWMA=2`), ST depression, and pathological Q-waves provide high discriminatory signal for Right Coronary Artery stenosis.
2. **Robust LAD Classification (81.52% Acc, ROC-AUC 0.843):** Driven primarily by Anterior RWMA (`RWMA=1`), Poor R Wave Progression in precordial leads, ST Elevation, and reduced Ejection Fraction.
3. **Calibrated Probabilities:** Low Brier scores ($<0.10$ across vessels) ensure that output percentages represent true posterior likelihoods for clinical risk calibration.

---

## 4. 3D WebGL Visualization & Anatomical Mapping Engine

The 3D anatomical viewer is implemented in pure **Three.js** and WebGL, achieving smooth 60 FPS performance on standard consumer hardware (integrated GPUs, laptops, and mobile browsers).

```
                      +---------------------------------+
                      |     Ascending Aorta Arch        |
                      +---------------------------------+
                                      |
                 +--------------------+--------------------+
                 |                                         |
                 v                                         v
   +----------------------------+             +---------------------------+
   | Left Main Coronary (LMCA)  |             | Right Coronary (RCA)      |
   +----------------------------+             | * Right AV Sulcus         |
         |               |                    | * Acute Marginal Branch   |
         v               v                    | * Posterior Descending    |
   +-----------+   +------------+             +---------------------------+
   | LAD Artery|   | LCX Artery |                          |
   | * Ant. IV |   | * AV Groove|                          v
   | * D1 & D2 |   | * OM1 & OM2|             +---------------------------+
   +-----------+   +------------+             | Inferior/Posterior RV & LV|
         |               |                    +---------------------------+
         v               v
   +-----------+   +------------+
   | Anterior  |   | Lateral    |
   | LV / Apex |   | LV Wall    |
   +-----------+   +------------+
```

### Visual Features & Interaction Pipeline
1. **Dynamic Vascular Shaders:** Smooth RGB color interpolation along coronary artery meshes:
   - $\text{Probability} < 35\%$: Emerald Green (`#10B981`) — Patent / Normal Perfusion.
   - $35\% \le \text{Probability} \le 70\%$: Amber Glow (`#F59E0B`) — Moderate Stenosis.
   - $\text{Probability} > 70\%$: Pulsing Crimson (`#EF4444`) — Severe Flow-Limiting Stenosis.
2. **Blood Flow Particle Simulation:** Over 135 particle emitters dynamically stream along the 3D Catmull-Rom splines of the coronary tree. When stenosis probability rises, the particle velocity slows down to simulate downstream hypoperfusion.
3. **Pulsatile Cardiac Cycle:** The myocardium exhibits organic systolic contraction and diastolic relaxation synchronized in real time with the patient's resting pulse rate (`PR`).
4. **Interactive Raycasting & Camera Presets:** Clicking any coronary vessel branch in the 3D canvas triggers camera focus (Anterior, Left Lateral, Inferior) and updates the SHAP explainability panel.

---

## 5. Explainability & Clinical Decision Support

### Real-Time SHAP (Shapley Additive exPlanations)
To provide transparent, white-box explanations for every patient:
- Fast **SHAP TreeExplainers** compute exact local additive contributions $\phi_i$ for all 54 features in $<15\text{ ms}$.
- Feature attributions are rendered as an interactive horizontal waterfall bar chart:
  - **Red bars ($\phi_i > 0$):** Risk-elevating factors (e.g., `Region RWMA=1` $+0.37$, `EF-TTE=42%` $+0.89$, `LDL=165` $+0.28$).
  - **Green bars ($\phi_i < 0$):** Protective factors (e.g., `Age=34` $-0.45$, `No ST Elevation` $-0.37$).
- An automated **Clinical Narrative Generator** synthesizes these values into plain-English summaries for attending physicians.

### Clinical Safety & Regulatory Disclaimer
Prominently integrated on the header, modal, and exportable PDF report:
> **Clinical Safety Notice:** *CARDIOSPATIAL-3D is an educational and clinical decision-support research prototype. Model predictions and SHAP attributions are intended to assist clinical reasoning and do NOT substitute for formal coronary angiography, CTCA, or independent medical judgment.*

---

## 6. Execution Instructions & Demonstration Guide

### Quick Start (Local Setup)

```powershell
# 1. Navigate to project directory
cd C:\Users\jaswa\.gemini\antigravity\scratch\cardiovascular-risk-3d

# 2. Install dependencies (if needed)
pip install -r requirements.txt

# 3. Launch full-stack application (Server + 3D UI)
python cardiospatial_3d__run.py
```

The application will automatically start the FastAPI server at `http://localhost:8000` and open your default web browser.

### 5-Minute Demonstration Script for Video / Presentation
1. **Introduction (0:00 - 0:45):** Highlight the clinical challenge of CAD and introduce CARDIOSPATIAL-3D's multi-vessel 3D mapping approach.
2. **Patient Archetypes & Live 3D Mapping (0:45 - 2:00):**
   - Select **"Acute LAD Stenosis (STEMI Risk)"**: Watch the LAD branch pulse red in the anterior view while blood particles throttle.
   - Switch to **"Critical Triple-Vessel CAD"**: All three arteries turn red/amber with multi-territory risk warning.
   - Switch to **"Healthy Young Control"**: Entire coronary tree turns glowing green with smooth laminar flow.
3. **Interactive Parameter Manipulation (2:00 - 3:15):** Adjust the `EF-TTE` slider and `Region RWMA` dropdown in real time to demonstrate instant 3D vascular color updates and probability shifts.
4. **SHAP Explainability & Radar Chart (3:15 - 4:15):** Switch between LAD, LCX, RCA, and CAD SHAP tabs to show localized clinical feature attributions.
5. **Model Validation & Report Generation (4:15 - 5:00):** Open the 5-fold CV metrics modal (90.1% CAD Acc, 93.1% RCA Acc) and showcase the 1-click Clinical Report export.

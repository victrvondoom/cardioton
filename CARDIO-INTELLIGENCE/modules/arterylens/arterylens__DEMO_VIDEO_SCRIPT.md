# 6-Minute YouTube Demo Video Script & Shot List
## Track A: CardioRisk 3D — Cardiovascular Risk Visualization & Prediction
**Multimodal AI Hackathon 2026** | **Author**: Kirthana

---

### Shot 1: Title & Project Overview (0:00 - 0:45)
- **On Screen**: Full-screen view of CardioRisk 3D web application with the 3D heart pulsing smoothly in the center, dark cyber-clinical theme, and persistent safety disclaimer banner at the top.
- **Narrator**:
  > *"Hello everyone! I'm Kirthana, and this is **CardioRisk 3D**, built for Track A of the Multimodal AI Hackathon 2026.
  > Cardiovascular diseases, specifically coronary artery stenosis, are the leading cause of mortality worldwide. 
  > Our objective in this project is to take non-invasive clinical patient records and predict both overall Coronary Artery Disease (CAD) as well as localized stenosis in the three main coronary arteries: the Left Anterior Descending (LAD), Left Circumflex (LCX), and Right Coronary Artery (RCA).
  > Crucially, rather than just returning isolated numbers, we project these risks onto an interactive 3D beating heart, explain every prediction using SHAP interpretability, and provide a clinical AI agent with counterfactual what-if simulations."*

---

### Shot 2: High-Risk Triple-Vessel Patient Workflow (0:45 - 2:00)
- **On Screen**: Cursor selects **Patient 1: High-Risk Triple Vessel CAD** from the preset dropdown. The input form populates with: Age 68, Male, Smoker, DM, HTN, Typical Chest Pain, ST-Elevation, and EF 35%. 
- **Action**: Click **"Run Clinical Assessment"**.
- **On Screen Visual Transition**:
  - The Overall CAD Risk Card shows **100% CAD Likelihood** (High Risk badge).
  - Vessel cards update: LAD **95%**, LCX **66%**, RCA **93%**.
  - Center 3D Heart: All three coronary arteries (LAD, LCX, RCA) illuminate in vibrant red.
- **Narrator**:
  > *"Let's test our first benchmark case: Patient 1, a 68-year-old male presenting with diabetes, hypertension, typical angina, ST-elevation, and reduced ejection fraction of 35%.
  > Notice what happens when we run the clinical assessment:
  > The calibrated logistic regression model identifies a near 100% CAD likelihood.
  > Looking at the three coronary arteries: LAD is at 95%, RCA is at 93%, and LCX is at 66%.
  > In the 3D viewer, all three coronary arteries glow crimson red, indicating high-risk multi-vessel stenosis."*

---

### Shot 3: 3D Heart Interaction & Vessel Inspection (2:00 - 3:00)
- **On Screen**: Mouse cursor drags to rotate the 3D heart 360 degrees. Cursor hovers over LAD (tooltip pops up: "LAD Artery - Estimated Risk: 95%"). Cursor clicks on LAD to select it.
- **Action**: Click "Rotate" toggle, mouse wheel to zoom in on the anterior interventricular sulcus where LAD branches, then click "Reset Camera".
- **Narrator**:
  > *"Let's explore the 3D viewer. The heart is rendered directly in WebGL without needing a dedicated GPU.
  > We built the coronary arteries procedurally along 3D cubic splines hugging the myocardium.
  > As I hover over the LAD, we get an instant risk tooltip. 
  > Clicking any vessel highlights it and shifts our clinical diagnostic view to that vessel's specific SHAP drivers.
  > We can freely orbit, inspect posterior wall branches, zoom in on bifurcations, or reset the camera view with one click."*

---

### Shot 4: SHAP Explainability & Contrast with Low-Risk Patient (3:00 - 4:15)
- **On Screen**: Switch to **Patient 2: Low-Risk Normal Patient** (Age 46, Female, normal ECG, EF 55%, normal lipids). Click "Run Clinical Assessment".
- **On Screen Visual Transition**:
  - Overall CAD drops to **12%** (Low Risk, green badge).
  - LAD drops to **7%**, LCX to **17%**, RCA to **11%**.
  - 3D Heart: All three arteries transition to smooth emerald green!
  - Click on **"SHAP Feature Impacts"** tab.
- **Narrator**:
  > *"Now let's contrast this with Patient 2: a 46-year-old female with normal ECG, ejection fraction of 55%, and normal lipid profile.
  > As soon as we run assessment, observe the immediate transformation: CAD likelihood drops to 12%, LAD drops to 7%, and all three arteries turn emerald green on the 3D heart.
  > Looking at the SHAP interpretability panel:
  > For the low-risk patient, absence of typical chest pain, normal ST segments, preserved EF, and normal regional wall motion are the primary protective forces driving the risk downward.
  > This provides physicians with transparent, mathematically grounded rationale behind every single prediction."*

---

### Shot 5: Tool-Grounded AI Explainer & What-If Simulator (4:15 - 5:15)
- **On Screen**: Click **"AI Clinical Explainer & What-If"** tab. Click **"Explain Case Findings"**. AI response streams in. 
- **Action**: Slide the **What-If Counterfactual Simulator** sliders: Target LDL to 70 mg/dL, Target BP to 120 mmHg, toggle "Cessate Smoking", and click **"Simulate Risk Delta"**.
- **On Screen Visual Transition**: Counterfactual risk reductions display (ARR and relative risk reduction percentages).
- **Narrator**:
  > *"Here is our Clinical Explainer Agent. When we click 'Explain Case Findings', the agent synthesizes the findings in plain clinical language.
  > Notice the strict safety guardrails: it quotes numbers only from verified model outputs, explicitly warns that LCX and RCA models have moderate discriminative power (AUC ~0.72), and reminds us that this is decision-support only.
  > Even better, clinicians can use our What-If Simulator: if our patient ceases smoking, lowers LDL to 70, and normalizes blood pressure, the system computes the exact counterfactual risk reduction in real time!"*

---

### Shot 6: Technical Architecture, Validation Benchmark & Conclusion (5:15 - 6:00)
- **On Screen**: Click **"Validation Benchmark"** in top right. Display the 5-fold cross-validation table and ROC/Calibration curves.
- **Narrator**:
  > *"Under the hood, the system is backed by a modular FastAPI backend and a Vite React TypeScript frontend.
  > All models were evaluated with repeated stratified 5-fold cross-validation on the Z-Alizadeh Sani cohort:
  > Logistic Regression achieved an ROC-AUC of 0.93 for CAD; Random Forest achieved 0.86 for LAD; and XGBoost achieved 0.73 for LCX.
  > Probabilities are Platt-calibrated, and all leakage columns are rigorously asserted and excluded.
  > Thank you for watching our Track A demo of CardioRisk 3D!"*

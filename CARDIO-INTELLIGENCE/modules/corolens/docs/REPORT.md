# CoroLens: project documentation

Multimodal AI Hackathon 2026, IIT Mandi. Track A: Cardiovascular Risk Visualization & Prediction. Author: Ritesh Kumar Mahato.

*Decision support and education only. This is not a medical device.*

## 1. Problem and approach

A risk percentage does not tell a clinician or a patient *where* coronary disease is likely, or how far to trust the number.
CoroLens predicts overall coronary artery disease (CAD) and stenosis of each target vessel (LAD, LCX, RCA). It maps the vessel probabilities onto
an interactive 3D heart and attaches two things to every number:

- a calibrated **90% conformal prediction set**, which shows when the model is unsure;
- an **exact SHAP explanation**, which shows why it gave that number.

A TypeSafe-powered intake turns a free-text referral note into the 55 structured inputs. It never generates values: it only selects them from the note.

## 2. Data and preprocessing

- **Dataset:** UCI "Extension of Z-Alizadeh Sani" (DOI 10.24432/C5461K, CC BY 4.0): 303 patients, 55 features after encoding, with angiography labels for CAD (216 positive), LAD (177), LCX (119) and RCA (114).
- **Encoding:**
  - Y/N and 0/1 flags become 0/1.
  - Sex becomes male = 1.
  - Valvular heart disease becomes ordinal (none, mild, moderate, severe).
  - Bundle branch block is one-hot encoded (LBBB, RBBB).
  - Numeric values are kept as they are; logistic models standardise them inside the pipeline.
  - "Exertional CP" is constant across all rows and is dropped.
- **Leakage control:** LAD, LCX, RCA and Cath are never inputs (enforced by an assertion and a unit test).
- **Label check:** in the data, "Cath = CAD" coincides with "at least one stenotic vessel" in 302 of 303 rows. CoroLens reports how consistent its own CAD and vessel predictions are.

## 3. Models and validation

- **Split:** 80/20, stratified on CAD (seed 2026), giving 242 development and 61 held-out test patients. The test set is used once, for the final numbers.
- **Model choice:** for each target, L1-regularised logistic regression and a random forest (200 trees, depth 8 or less, at least 3 samples per leaf) are compared by 5x3 repeated stratified CV ROC-AUC on the development set.
- **Calibration:** Platt scaling fitted on out-of-fold development predictions.
- **Uncertainty:** split-conformal sets with the score 1 - p(true class), alpha = 0.1, using out-of-fold calibrated probabilities. The set is {Normal}, {Stenotic} or {Normal, Stenotic}.
- **Unbiased estimate:** nested CV wraps model choice, calibration and conformal fitting in an outer 5x2 CV.
- **Explanations:**
  - exact path-dependent TreeSHAP (Lundberg et al., 2018) for forests, in probability units;
  - exact linear SHAP for logistic models, in log-odds.

  Global importance is the mean |SHAP| on the development set.

| Target | Model | Test ROC-AUC (95% CI) | Acc. | Prec. | Recall | F1 (95% CI) | Brier | 90% set coverage | Nested CV AUC |
|---|---|---|---|---|---|---|---|---|---|
| CAD | L1 logistic | 0.906 (0.81-0.98) | 0.852 | 0.886 | 0.907 | 0.897 (0.82-0.96) | 0.108 | 90.2% | 0.927 +/- 0.041 |
| LAD | Random forest | 0.910 (0.83-0.98) | 0.852 | 0.846 | 0.917 | 0.880 (0.79-0.95) | 0.119 | 95.1% | 0.811 +/- 0.074 |
| LCX | Random forest | 0.730 (0.60-0.85) | 0.639 | 0.647 | 0.407 | 0.500 (0.30-0.66) | 0.209 | 93.4% | 0.689 +/- 0.088 |
| RCA | L1 logistic | 0.699 (0.56-0.82) | 0.623 | 0.562 | 0.360 | 0.439 (0.24-0.61) | 0.226 | 85.2% | 0.741 +/- 0.041 |

**Reading the results:**

- Overall CAD and LAD are predicted well.
- LCX and RCA are hard from non-invasive data. Their conformal sets are two-label for 56% and 49% of test patients (13% for CAD), so the interface marks those vessels as uncertain instead of over-claiming.
- The LAD test AUC (0.910) is above its nested-CV estimate (0.811 +/- 0.074). With 61 test patients, the nested-CV figure is the more reliable expectation.
- The CAD call agrees with "any vessel stenotic" for 90.2% of test patients.

Top features (mean |SHAP|, development set):

- **CAD:** typical chest pain, age, RWMA regions, diabetes, T inversion.
- **LAD:** typical chest pain, RWMA regions, age, ejection fraction, atypical chest pain.
- **LCX:** age, typical chest pain, platelets, creatinine, fasting sugar.
- **RCA:** age, diabetes, dyspnoea, functional class, typical chest pain.

## 4. System and 3D pipeline

- **Inference in the browser.** `corolens/corolens__corolens__train.py` exports a 0.7 MB JSON bundle containing:
  - the forest trees (split features, float thresholds, node values and covers);
  - the logistic coefficients and scaler;
  - the Platt parameters and conformal thresholds.

  `web/engine.js` re-implements encoding, prediction, calibration, conformal sets and TreeSHAP.
- **Parity tests (Node):**
  - JS probabilities equal scikit-learn's on all 61 test patients (difference below 1e-9);
  - JS TreeSHAP equals `shap.TreeExplainer` (difference below 1e-9);
  - SHAP values sum exactly to the model output.

  Inputs are cast to float32 before tree traversal, as scikit-learn does, so splits are identical.
- **3D heart.** `web/heart.js` builds a procedural heart (a deformed sphere with an apex, aorta and pulmonary trunk). The three arteries are tubes that follow the anterior interventricular groove (LAD), the left AV groove (LCX) and the right AV groove (RCA), each with proximal, mid and distal nodes.
  - Colour follows a teal-amber-red ramp by calibrated probability.
  - Vessels with a two-label conformal set pulse.
  - OrbitControls give rotate and zoom; raycasting selects a vessel and opens its explanation.
  - It renders with software WebGL (SwiftShader), so it needs no dedicated GPU.
- **Dashboard.** It shows CAD and vessel cards (probability, conformal set, model type), signed SHAP bars with the patient's values, a model card, and editable inputs (what-if updates instantly). Held-out patients come with their angiography result for comparison.

## 5. TypeSafe note intake (multimodal: text to structured)

`web/intake_core.js` follows TypeSafe's "pre-parsed value extraction" pattern:

1. A regex finds every number, including thousands separators and decimals, and tags it in the note, for example `LDL [n7]145`.
2. One request to `POST /v1/systemone` (`jev-latest`) carries 57 questions:
   - 21 Choice questions select which tagged number is each lab or vital, or `none`;
   - 23 Noul questions give the probability of each yes/no finding;
   - 5 Choice questions pick categories;
   - 2 Choice questions cover mutually exclusive groups (chest-pain type, smoking status).
3. Code copies the selected numbers verbatim, normalises units (platelets per microlitre to thousands, WBC in thousands, height in metres to centimetres) and computes BMI. Fields with confidence below 0.6, or a Noul between 0.3 and 0.7, are flagged "check".

**Evaluation** used 61 notes per seed, built from the held-out patients' real records with randomised phrasing, omissions, negations and distractor numbers (drug doses, dates, follow-up intervals). All calls were live to `jev-1.13.0`.

- Version 1, on development notes (seed 7): 100% numeric and categorical accuracy, but 98.19% on yes/no findings. The errors were chest-pain type and ex-smoker confusions.
- Version 2 groups those mutually exclusive findings into single Choice questions. On fresh test notes (seed 11), it scored:
  - 100% (1003/1003) on numbers in the note assigned to the right field;
  - 100% (217/217) on absent fields left empty;
  - 99.94% (1707/1708) on yes/no findings;
  - 100% (305/305) on categorical fields.
- The mean change in predicted probability against hand entry of the same facts was at most 0.0031. Each note used about 16.7k input tokens.

## 6. Usage

- `npm test` runs the 12 JS tests.
- `node server.mjs` serves the app at http://localhost:8787. Setting `TYPESAFE_API_KEY` enables intake.
- `python -m corolens.corolens__corolens__train` retrains the models (about 6 minutes on a CPU).
- **Deployment:** the static `web/` directory plus one Vercel function (`api/intake.js`). The API key exists only as a server environment variable.

## 7. Limitations

- The data comes from a single centre with 303 patients, and the confidence intervals are wide.
- The models are not validated externally and are not intended for clinical use.
- Vessel labels are per vessel, so CoroLens does not localise lesions within a vessel. The heart is schematic, not patient-specific anatomy.
- Conformal coverage is a marginal guarantee under exchangeability.
- SHAP values describe the model, not causation.
- The intake was tested only on synthetic English notes.

**Attribution and AI assistance.** The dataset is by Alizadehsani, Roshanzamir & Sani (2013), UCI, CC BY 4.0. Three.js is MIT-licensed. The code and documentation were drafted with an AI coding assistant (Grok Bot), as disclosed in the README.

# Cardia Atlas Demonstration Script

**Target length: 5 minutes**  
**Recording status:** Script and local demo are ready; video has not been recorded or uploaded.  
**Audience:** Hackathon judges and technical reviewers.

## Before recording

1. Use a clean browser window and ensure the local app runs: `bash scripts/run_local.sh`; open `http://127.0.0.1:8000/`.
2. Confirm `/api/health` reports all four models and close private/personal browser tabs.
3. Keep the on-screen synthetic demo label visible. Do not enter or show a real patient's identifiable data.
4. Use the included report and dashboard results; do not state that this is a clinical diagnosis or a validated medical device.
5. Record at 1080p if available, with readable browser zoom. Narrate the exact experiment limits and disclose OpenAI Codex in the project submission's Built With field.

## Timed narration and actions

### 0:00–0:30 | Problem and safety

**Say:** “Cardia Atlas is our Track A prototype for visualizing model-estimated overall CAD and LAD, LCX, and RCA stenosis probabilities from clinical and physiological features. It is an educational research prototype, not a diagnosis or substitute for diagnostic imaging. The vessel colors show model probabilities, not measured lesions or stenosis percentages.”

**Show:** Project title and visible safety disclaimer.

### 0:30–1:15 | Inputs and missing values

**Say:** “The form follows the UCI feature schema. Demographic, history and exam, ECG, lab, and echo values are grouped; dropdowns retain source-coded categories. The UCI variable table does not specify units for many fields, so the interface shows source ranges instead of guessing. Blank values are accepted and handled by imputers fit inside the model pipeline.”

**Do:** Show the demographic and history sections. Click **Load demo values** and point out the explicit note that these are synthetic feature-wise median/mode demo values, not a study patient or test observation.

### 1:15–2:00 | Generate four predictions

**Say:** “The API returns one overall CAD score and three vessel-specific model probabilities. CAD uses Extra Trees, LAD and LCX use Random Forest, and RCA uses Logistic Regression, each selected independently using the documented cross-validation procedure.”

**Do:** Click **Generate analysis**. Show the four probabilities and model families. State: “A displayed probability is the model's positive-class probability on this dataset task; the 0.50 class threshold is a fixed demonstration convention, not a clinical decision threshold.” If you edit an input, point out that the demo label changes to “Edited profile,” then generate the updated analysis.

### 2:00–2:50 | Explore the 3D view

**Say:** “This is an original schematic generated in Three.js, not a medical anatomical mesh. In anterior view, RCA is routed on viewer-left for the patient's right, LAD down the center, and LCX toward viewer-right. The color legend uses lower, middle, and higher probability bands.”

**Do:** Drag to rotate, scroll to zoom, point out that vessel labels track the selected 3D branches, and click the LAD, LCX, and RCA cards. Explain that the visual does not map an exact lesion location.

### 2:50–3:40 | Patient-specific SHAP

**Say:** “For the selected outcome, this chart shows the ten largest absolute approximate permutation SHAP contributions for the deployed preprocessing-plus-model pipeline. The additivity check uses the full 54-feature explanation, including contributions not shown in this compact chart. Blank values are imputed in the fitted pipeline and are labeled in the display. These contributions are associations in this fitted model, not causal effects; correlated clinical inputs and finite permutations limit interpretation.”

**Do:** Select a vessel, read the baseline and probability, and show a few positive and negative feature contributions. Avoid describing a contribution as a medical cause.

### 3:40–4:30 | Performance and limitations

**Say:** “We evaluated with nested repeated stratified five-fold cross-validation and a three-fold inner model comparison. The displayed metrics include ROC-AUC, sensitivity, specificity, F1, Brier score, and a five-bin calibration diagnostic. CAD ranked best in this small cohort; vessel results are weaker, particularly for LCX and RCA. These are internal estimates with fold variability, not external clinical validation. We did not recalibrate probabilities or validate a treatment threshold.”

**Do:** Scroll to **Performance & limitations**. Show ROC-AUC and calibration diagnostics. State clearly that no independent cohort, prospective study, clinician review, or clinical threshold validation was available.

### 4:30–5:00 | Architecture and reproducibility

**Say:** “The browser calls the FastAPI service; the local and hosted versions use the same inference contract. The serialized artifacts include all preprocessing and four fitted models; the data audit, nested evaluation, feature schema, setup scripts, source attribution, five-page report, and this demo script are included. The UCI dataset is CC BY 4.0; Three.js is MIT-licensed. OpenAI Codex assisted implementation and is disclosed in the README; I am responsible for understanding and explaining this code.”

**Do:** Briefly show README or report artifact list, then end on the safety disclaimer.

## Recording and submission steps

1. Start the app and rehearse once with the synthetic demo data.
2. Record a 3–10 minute screen-and-voice walkthrough; the script above targets five minutes.
3. Review the video for readable text, audio, and visible synthetic-data/safety disclaimers.
4. Upload the required 3–10 minute recording to YouTube and add the video link to the Devpost entry.
5. Check the current Devpost submission form and any file-size/asset constraints; the official pages reviewed did not specify them.
6. Enter **OpenAI Codex** in Devpost Built With, disclose AI assistance in the README, verify that you meet the event's age-14+ requirement, and submit before **15 October 2026, 12:15 AM IST**.

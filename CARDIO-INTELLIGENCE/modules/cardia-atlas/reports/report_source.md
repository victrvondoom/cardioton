# Cardia Atlas

**Track A: Cardiovascular Risk Visualization & Prediction**  
Multimodal AI Hackathon 2026 · 4 October 2026

**Developed by Pavitra Gangwar**

## Summary
Cardia Atlas is a public web application and locally runnable educational prototype that estimates overall CAD and LAD, LCX, and RCA stenosis probabilities using 54 non-target clinical, examination, ECG, laboratory, and echocardiographic predictors from the UCI Extension of Z-Alizadeh Sani dataset. A FastAPI service serves four trained pipelines. The browser presents probabilities, an original interactive 3D schematic, and approximate patient-specific SHAP explanations. It is not a clinical risk calculator or diagnostic system.

## Access and usage

- Live application: https://cardia-atlas.onrender.com
- Source repository: https://github.com/pavitra-G16/cardia-atlas-multimodal-ai-hackathon-2026
- Local prerequisite: Python 3.14+ and internet access for the first pinned dependency install. Start with `bash scripts/run_local.sh`, then open http://127.0.0.1:8000/. Trained models and preprocessing are included; ordinary inference does not retrain.
- Workflow: load the synthetic feature-wise median/mode profile, generate analysis, edit inputs and generate again if desired, then rotate/zoom and select an artery to review the matching explanation. “Clear all” resets the form and results.
- The screen shows the 10 largest absolute SHAP contributions of 54 predictors; the full contribution set supports the additivity check. Blank source values are shown as imputed.

## Data and target handling
The UCI workbook's primary sheet contains 303 records and 59 columns. It has no missing cells and no exact duplicate rows. `Cath` has 216 CAD and 87 Normal labels; LAD 177 Stenotic/126 Normal; LCX 119/184; RCA 114/189. The UCI definition calls CAD diameter narrowing of at least 50%, with one or more stenotic major arteries. 302 of 303 Cath labels agree with the OR of LAD/LCX/RCA labels; the supplied Cath target was retained, including the single mismatch. No record identifier is present. `Cath`, `LAD`, `LCX`, and `RCA` were excluded from every predictor matrix. Constant `Exertional CP` (303/303 N) was removed. Source spelling `Fmale` was normalized to `Female`. Other clinical, ECG, lab, and echo measurements were retained; `Region RWMA` is an echocardiographic feature, not a spatial lesion label. Numeric units are not supplied in UCI's variable table, so the form explicitly says “as recorded” instead of inventing units.

Documented feature shorthand is expanded in display labels from a published description of this dataset. Source-coded numeric values and category levels stay unchanged; where UCI metadata does not define code meanings, the interface says so rather than assigning a guessed meaning.

## Methods and evaluation
Logistic Regression, Extra Trees, and Random Forest were compared using nested repeated stratified 5-fold outer validation (two repeats), with 3-fold ROC-AUC model selection performed only within each outer training partition. Every imputer, encoder, scaler, candidate fit, and model-family choice is confined to the relevant training fold. The threshold was fixed at 0.50, without threshold tuning. The reported outer-fold metrics estimate this fold-wise model-selection procedure: in each outer fold, inner CV selects a family, that pipeline is fit on the outer training fold, and the untouched outer fold is evaluated. Separately, 5-fold ROC-AUC comparisons using all 303 records select the final deployed family, which is then refit on all records. That final refit has no independent performance estimate; the outer metrics are not a score for that particular final model. PR-AUC is average precision. Brier, 5-bin expected calibration error (ECE), and five-bin reliability are descriptive checks; no recalibration or calibration validation was performed.

| Target | Final refit family | Accuracy | Precision | Sensitivity | Specificity | F1 | ROC-AUC | PR-AUC | Brier | ECE |
|---|---|---|---|---|---|---|---|---|---|---|
| CAD | Extra Trees | 0.86 ± 0.05 | 0.92 ± 0.04 | 0.88 ± 0.06 | 0.80 ± 0.10 | 0.90 ± 0.04 | 0.92 ± 0.03 | 0.97 ± 0.01 | 0.11 ± 0.02 | 0.11 ± 0.05 |
| LAD | Random Forest | 0.77 ± 0.06 | 0.80 ± 0.07 | 0.83 ± 0.06 | 0.70 ± 0.13 | 0.81 ± 0.04 | 0.84 ± 0.05 | 0.88 ± 0.04 | 0.17 ± 0.02 | 0.12 ± 0.05 |
| LCX | Random Forest | 0.70 ± 0.07 | 0.63 ± 0.11 | 0.63 ± 0.10 | 0.75 ± 0.10 | 0.63 ± 0.08 | 0.75 ± 0.08 | 0.63 ± 0.08 | 0.21 ± 0.03 | 0.11 ± 0.04 |
| RCA | Logistic Regression | 0.65 ± 0.05 | 0.54 ± 0.06 | 0.55 ± 0.11 | 0.71 ± 0.07 | 0.54 ± 0.07 | 0.72 ± 0.06 | 0.60 ± 0.07 | 0.21 ± 0.02 | 0.12 ± 0.04 |

Values are outer-fold mean ± SD. Repeated-fold pooled confusion counts (TN, FP, FN, TP; two repeat predictions per record) were CAD 140/34/52/380, LAD 175/77/62/292, LCX 277/91/88/150, RCA 269/109/102/126. Results are internal estimates on one small cohort, with class imbalance and fold variability; no external validation or clinical threshold study was performed.

## Explanation and 3D view
The patient-specific SHAP view explains the complete deployed preprocessing-plus-model pipeline. Permutation SHAP uses a fixed 24-row background and six permutations; encoded category contributions are summed back to source inputs. Contributions are in positive-class probability points. The dashboard displays the 10 largest absolute contributions; the API additivity check uses the full feature set, including the undisplayed contributions. Blank inputs are labeled as imputed. For each result, baseline plus all feature contributions matched the prediction in API checks (observed absolute difference 0.0000). Finite permutations and correlated clinical features limit interpretability; contributions are associations, not causes.

The app uses an original, code-generated 3D chamber-and-great-vessel illustration with schematic coronary paths. In the anterior view, LAD follows the anterior interventricular groove toward the apex; LCX follows the left atrioventricular groove (patient-left/viewer-right); RCA follows the right atrioventricular groove (patient-right/viewer-left). These broad courses were checked against NHLBI and NCBI anatomy references. The model is not patient-derived or clinician-reviewed and does not claim segment-level accuracy or anatomical variants. Users can rotate, zoom, and select vessels. Continuous probability bands are illustrative only: [0,33%), [33,67%), and [67,100%]. They do not depict measured lesion location or stenosis percentage.

## Engineering, checks, and limitations
The deployed public app and local stack use Python/FastAPI + scikit-learn/SHAP and plain browser JavaScript + bundled Three.js. Saved artifacts include all preprocessing/model pipelines, feature schema, data audit, experiment metrics, and source workbook. Verified: data/target audit, leakage exclusion, artifact reload equivalence, API health/schema/performance, median/mode demo contract, valid synthetic prediction, all-fields-missing inference, invalid-category HTTP 422, SHAP additivity, browser WebGL view, all four changing predictions and color bands, all four vessel selections and explanation updates, drag rotation, wheel zoom response, and reset. Continuous probability interval boundaries and cache-revalidation headers have automated checks. Eight Python unit tests passed in both the repository environment and a fresh environment created from the unpacked submission archive with pinned dependencies; JavaScript syntax and band tests pass. The clean packaged environment also ran valid four-target inference without retraining. The final UI was smoke-checked at a 390 px viewport and desktop width on one browser/device; this is not broad responsive or accessibility coverage. A local Docker build was not run because Docker is unavailable; Render successfully built and started the deployed service. Two hosted prediction requests took 55.25 and 59.28 seconds; this small sample does not estimate typical latency. Cross-browser rendering, GPU-free performance across devices, broad accessibility coverage, independent clinical validation, and real video recording were not verified. The report is under six pages. The required 3–10 minute YouTube demo script is supplied; recording, upload, and Devpost submission remain entrant actions.

This tool is educational and not for clinical care. Calibration was assessed descriptively with Brier, ECE, and five-bin reliability, but not validated or corrected. There is no external cohort, prospective study, clinician review, or claim of readiness. UCI does not state measurement units in its feature table, so app inputs display source ranges/scale rather than inferred units.

## References and attribution
1. Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). *extention of Z-Alizadeh sani dataset*. UCI Machine Learning Repository. DOI: 10.24432/C5461K. CC BY 4.0. https://archive.ics.uci.edu/dataset/411/extention%2Bof%2Bz%2B
2. National Heart, Lung, and Blood Institute. “How the Heart Works: How Blood Flows through the Heart.” https://www.nhlbi.nih.gov/health/heart/blood-flow
3. StatPearls. “Anatomy, Thorax, Heart Left Anterior Descending (LAD) Artery.” NCBI Bookshelf. https://www.ncbi.nlm.nih.gov/books/NBK482375/
4. Ghadri et al. “Coronary Artery Anomalies: A Computed Tomography Angiography Pictorial Review.” https://pmc.ncbi.nlm.nih.gov/articles/PMC11242126/
5. SHAP documentation. “PermutationExplainer” and explanation additivity. https://shap.readthedocs.io/en/stable/generated/shap.PermutationExplainer.html
6. Three.js 0.180.0, MIT License. https://github.com/mrdoob/three.js
7. Multimodal AI Hackathon 2026 official Devpost rules and event update. https://multimodal-ai-hackathon-2026-7.devpost.com/rules and https://multimodal-ai-hackathon-2026-7.devpost.com/updates
8. Jin, Z. & Li, N. (2022). “Diagnosis of each main coronary artery stenosis based on whale optimization algorithm and stacking model.” *Mathematical Biosciences and Engineering*, 19(5), 4568–4591. DOI: 10.3934/mbe.2022211. Used only as a feature-name glossary, not as model-performance evidence.

AI assistance disclosure: OpenAI Codex assisted with implementation, model workflow, interface, checks, and documentation; the entrant remains responsible for understanding and explaining the submission.

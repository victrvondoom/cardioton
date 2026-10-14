# Final Official Requirements and Submission Matrix

Audit date: 4 October 2026 (Asia/Kolkata); resilience update: 9 October 2026. Status values are **PASS**, **FAIL**, or **UNVERIFIED** only. The Track A source is the participant-provided four-page official problem statement PDF. The event-wide sources are the [Devpost overview](https://multimodal-ai-hackathon-2026-7.devpost.com/), [Devpost rules](https://multimodal-ai-hackathon-2026-7.devpost.com/rules), and [event update](https://multimodal-ai-hackathon-2026-7.devpost.com/updates). No separate common-rules attachment was provided. Limits and requirements below are not inferred beyond those sources.

## Track A mandatory requirements and deliverables

| Requirement | Status | Evidence / remaining action |
|---|---|---|
| Predict overall CAD and LAD, LCX, RCA stenosis labels | PASS | Four fitted pipelines in `artifacts/cardia_models.joblib`; target definitions and encodings are audited below. |
| Use demographic, clinical/exam, ECG, laboratory, and echocardiographic features | PASS | Audited 54-feature schema in `artifacts/features.json` and `artifacts/ui_schema.json`. |
| Exclude all four target labels from every predictor matrix | PASS | `Cath`, `LAD`, `LCX`, and `RCA` absent from saved feature list; training code and regression test check the exclusion. |
| Evaluate accuracy, precision, recall, F1, and ROC-AUC for all targets | PASS | Saved outer-fold metric means and standard deviations in `artifacts/evaluation.json`; also in app and report. Standard deviations are fold spread, not confidence intervals. |
| Fit preprocessing and candidate selection within CV training folds | PASS | Scikit-learn pipelines fit median/mode imputers, one-hot encoder, scaler, and estimator inside inner/outer training folds; untouched outer fold is evaluated only after selection. Threshold fixed at 0.50. |
| Distinguish nested outer-CV estimates from final refit performance | PASS | UI, report, README, and evaluation metadata say outer scores estimate the inner-CV selection procedure. Final family is separately selected via 5-fold ROC-AUC on all 303 rows, refit on all rows, and has no separate performance estimate. |
| Show CAD/vessel results, class labels, thresholds, patient values, and explanations | PASS | Live UI displays four predicted probabilities, classes, model family, fixed 0.50 threshold, vessel detail, and patient-specific explanations. The SHAP chart shows the 10 largest absolute contributions out of 54; additivity uses the complete set. Blank values are marked as imputed. |
| Interactive 3D torso/heart; probability colors; rotate, zoom, select regions | PASS | Original procedural Three.js illustration with torso/chamber/great-vessel forms and LAD/LCX/RCA branches; live interactions tested. Continuous bands are illustrative and exactly cover [0,0.33), [0.33,0.67), [0.67,1]. Text, labels, and numbers supplement color. |
| Anatomical adequacy of the simplified heart and vessel paths | UNVERIFIED | Broad LAD/LCX/RCA courses were compared with cited NHLBI/NCBI references. This is explicitly anatomy-inspired and schematic; no clinician or segment-level validation was performed. No lesion localization is claimed. |
| Safety disclaimer; not substitute for formal diagnostic imaging | PASS | Visible in application and report. README and UI say it is not a diagnosis or clinical risk calculator. |
| Responsive prototype, technical architecture and reproducibility | PASS | Fresh archive install and inference, local API, public deployment, bundled Three.js, setup scripts, trained artifacts, and documented APIs checked. On 9 October, WebGL startup fallback and stale prediction/explanation response guards were added and automated-tested. One 390 px viewport and desktop size checked on one browser/device only; keyboard focus checked for core controls. No broad device/browser, screen-reader, or GPU-free coverage is claimed. |
| Project documentation, preprocessing, architecture, usage, evaluation; max six pages | PASS | Five-page report and editable source, README, setup, evaluation artifacts and references included; every final report page rendered and inspected. |
| 3–10 minute YouTube demonstration video | FAIL | Required by Track A PDF. Five-minute timed script is ready, but video has not been recorded or uploaded. Entrant must record and upload it. |

## Judging criteria and evidence

| Criterion | Weight | Evidence and limits |
|---|---:|---|
| Predictive performance, estimation quality, validation | 30% | Nested repeated stratified 5-fold CV, two repeats; inner 3-fold model selection. Metrics include required classification measures plus PR-AUC, Brier, and descriptive 5-bin ECE/reliability. Small, imbalanced, single-source cohort; no external validation or validated clinical threshold. |
| 3D visualization and spatial mapping | 25% | Original interactive anatomy-inspired schematic with labeled vessel paths and probability bands. Simplified illustration; anatomy adequacy not clinician-validated. |
| Clinical interpretability | 20% | Approximate permutation SHAP of deployed preprocessing+model, patient values, imputation indicators, full-set additivity check. Finite permutations/correlated predictors limit interpretation; no causal claims. |
| System integration | 15% | Input form → API → four results → color-mapped 3D → selected-target explanation. Local and public flows checked. |
| Technical implementation | 10% | Reproducible Python/FastAPI + scikit-learn model pipelines, saved artifacts, tests, static frontend, attribution, and public source/deployment. |

## Dataset and model audit

- UCI Extension of Z-Alizadeh Sani primary sheet: **303 rows × 59 columns**, zero missing cells and exact duplicates, no identifier.
- Target definitions/encodings: `Cath` CAD/Normal; vessel labels Stenotic/Normal. Counts positive/negative: CAD 216/87, LAD 177/126, LCX 119/184, RCA 114/189. 302/303 Cath labels agree with the OR of vessel targets; source `Cath` is preserved including the mismatch.
- 55 non-target columns before removing constant `Exertional CP`; final 54 predictor fields. `Fmale` spelling normalized to `Female`; no source targets are predictors.
- Logistic Regression, Extra Trees, and Random Forest compared. Outer evaluation is repeated stratified 5-fold CV, two repeats; each outer training partition uses inner 3-fold ROC-AUC selection. All preprocessing is inside pipelines fit per training fold. Threshold 0.50 fixed in advance.
- Final deployed families: CAD Extra Trees, LAD Random Forest, LCX Random Forest, RCA Logistic Regression. Selected using a separate five-fold comparison on all 303 records and refit on all records. No independent final-fit estimate.
- Brier and 5-bin calibration diagnostics are descriptive only; not a clinical calibration study. Vessel outcomes are weaker than CAD and vary across folds.
- Approximate permutation SHAP: 24-row fixed background, six permutations, one-hot contributions aggregated to source features. Additivity verified against positive-class probability. Associations are not causes.

## Event-wide rules, eligibility, and limits

| Rule or requirement | Status | Evidence / remaining action |
|---|---|---|
| Devpost submission destination and deadline | PASS | Official pages list Devpost and **15 October 2026, 12:15 AM IST**; no entry has been submitted. Entrant must submit before cutoff. |
| Age/student eligibility | UNVERIFIED | Overview says age 14+ and “Students only”; Rules says age 14+, primarily intended for college students, and all eligible individuals may apply. User's age/student status is unknown; clarify with organizer if applicable. |
| Team of 1–4; one track/team per participant | UNVERIFIED | Rules are verified; actual Devpost team roster/registration was not inspected. Confirm entrant/team meets them. |
| AI coding assistants allowed with disclosure | PASS | OpenAI Codex assistance disclosed in README and report. |
| Devpost “Built With” AI disclosure | FAIL | Must enter OpenAI Codex in the actual submission form. |
| Current form's required fields, file/asset caps, archive rules | UNVERIFIED | Manage-submission page redirects to sign-in/join; form cannot be inspected without entrant access. Public materials did not state these limits. Check form directly; no limit is assumed. |
| Additional common rules document | UNVERIFIED | No separate common-rules document was supplied; official Devpost event rules were reviewed. |

## Publication, package, and remaining actions

- New public source repository: <https://github.com/pavitra-G16/cardia-atlas-multimodal-ai-hackathon-2026>.
- Public application: <https://cardia-atlas.onrender.com>. Free Render service may cold-start; local Docker build was not run, though hosted Docker build/start succeeded. For a live demo, wake the URL using the synthetic demo before presenting and keep the documented local command ready as a transparent backup; this does not remove the hosted cold-start limitation.
- `outputs/Cardia Atlas Complete Submission.zip` includes app/API source, dependency locks, trained model and preprocessing artifacts, source data/attribution, report and editable source, setup, demo script, verification, manifest, and Render configuration. Fresh unpacked environment installed pinned dependencies, passed all eight Python tests, and ran inference without retraining. Two public prediction requests took 55.25 and 59.28 seconds; Render Free may cold-start and latency varies. Archive excludes `.git`, virtual environments, Node modules, caches, work directories, and outputs.
- Entrant actions: confirm eligibility/team; inspect the signed-in Devpost form and its current fields/limits; record the required 3–10 minute video; upload to YouTube; add the video link and Codex disclosure; submit the project by the listed deadline. Neither video upload nor Devpost submission was performed here.

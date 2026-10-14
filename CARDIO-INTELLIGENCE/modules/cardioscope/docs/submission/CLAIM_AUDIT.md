# Final submission claim audit

Scope: root README, six-page report/source, storyboard/rehearsal, Devpost copy and judge Q&A. Authoritative frozen artifacts were preferred over narrative rounding. No model selection, threshold change, recalculation from reserved outcomes, final inference or training was performed. Reading saved aggregate final evidence is authorized for this phase.

## Numerical and methodological sources

| Claim | Inspected source | Finding |
|---|---|---|
| 303 total; 55 predictors; Cath/LAD/LCX/RCA excluded | `config/dataset.json`, `artifacts/data/feature_manifest.json` | Exact contract matches. |
| 242 development / 61 final; same split across targets | `artifacts/data/split.json`, source verifier | Membership counts match; no split regeneration. Target-specific nested folds must not be portrayed as identical across targets. |
| 83 leaves: heart 30 / LAD 18 / LCX 6 / RCA 29 | `assets/anatomy/manifest.json`, `docs/anatomy/VERIFICATION.md`, anatomy verifier | Distinct groups, no overlap; shared assembly transform, unchanged geometry. Initial manifest's review booleans are historical acquisition state; subsequent verification record documents actual browser review. No expert anatomical-certification claim. |
| CAD/LAD balanced L2 logistic C=.1; LCX/RCA unweighted forests depth3/5, leaf10, 100 trees | `config/model_search_v1.json`, saved model metadata, final aggregate `frozen_candidate` | Correct. Numeric scaler applies to logistic; automatic one-hot vocabulary is fitted in training. |
| Inner-only V1 selection; locked 5 outer / 3 inner | `docs/MODELING.md`, locked search and saved selections | 15 existing inner-validation scores select final configs; outer outcomes do not select them. RCA forest is retained under that rule. |
| All nine V1 metrics and four confusion matrices | Saved aggregate final `results.json`, copied into [CLAIMS.json](CLAIMS.json) | Full-precision values match; public tables round to four decimals. Report shows all four targets and all nine metrics. PR-AUC is trapezoidal; AP is separate. |
| Threshold .5; positive CAD / Stenotic; confusion order | Final config, aggregate metrics, `docs/FINAL_EVALUATION.md` | Fixed; rows actual, columns predicted, order [Normal, positive]. |
| 95% ROC-AUC intervals in report and UI evidence | Aggregate `uncertainty` | Endpoints match rounded saved values. Stratified percentile bootstrap, not newly generated; conditional empirical uncertainty omits model-selection/training uncertainty and assumes independence. |
| 100 development-only SHAP reference; all 55 retained | `config/explanations_v1.json`, background metadata, `docs/EXPLANATIONS.md` | CAD/LAD LinearExplainer log-odds; LCX/RCA TreeExplainer probability space. One-hot blocks aggregate to source variables. |
| Reconstruction tolerances 1e-10 / 1e-6 | Same frozen SHAP config | Log-odds / probability respectively; numerical residual tolerances, not clinical confidence. |
| Historical 134 Python / 75 frontend; macOS and Ubuntu ARM64 | `docs/hardening/FINAL_VERIFICATION.json` and linked OS records | Historical evidence only. Current safe documentation-phase rerun is separately reported as 43 core Python and 75 frontend tests. Full synthetic evaluation/fitting tests were intentionally not rerun. |
| Browser/Docker/CI evidence | Hardening browser/Linux records; Dockerfile; workflow | Actual local Chromium, Firefox and Safari verification. Equivalent local Ubuntu checks; hosted GitHub Actions has NOT run. Docker includes inert research files in the current full tree; no current image-size claim. |
| ~78% initial JS reduction | Before/after hardening records and production-build output | 1,216,295 → 266,391 bytes, about 78.098%. Refers to initial JS, not total viewer code; lazy viewer remains about 951 KB. |
| 256 protected files unchanged | Immutable manifest and safe verifier | All byte-identical; initial checks in [VERIFICATION.json](VERIFICATION.json), latest polish checks in [POLISH_VERIFICATION.json](POLISH_VERIFICATION.json). App source/configuration also unchanged from this phase's starting commit. |
| V2 development-only failed joint gate | V2 protocol/results and `docs/V2_LCX_RCA.md` | Internal repeated nested CV only; the reported metrics are unweighted outer-fold means, and rounded LCX/RCA values match. Persisted research candidates are not deployed replacements. |
| V2.1 RCA passed internally; LCX/CAD safeguards failed; no final candidate | V2.1 protocol/results and `docs/V21_MULTITASK.md` | Joint false, candidate status NOT FITTED. Unweighted outer-fold means: LCX 24/25 eligible, RCA 25/25; all-development neural fit was not executed. |
| Real screenshots / public example only | [provenance](SCREENSHOT_PROVENANCE.json), actual browser capture, saved `MACOS_SMOKE.json` | All four displayed probabilities match the existing example. Captures are not independent performance evidence. |

`CLAIMS.json` records the aggregate source path and SHA-256. The editable report checks that hash before rendering, with no scientific execution imports. The report source is not a model experiment. [Report rebuild instructions](REPORT_BUILD.md) keep document tools separate from the frozen product environment.

## Evidence hierarchy and claim boundaries

V1 was frozen and evaluated once on the prespecified 61-record same-source holdout. V2 and V2.1 were motivated after that test, so their internal development evidence is neither external nor independent final-test validation. Neither failed procedure changed the product.

No selected material claims clinical validation, clinician superiority, state of the art, calibrated clinical risk, validated screening cutoffs, causal SHAP, treatment advice, patient reconstruction, exact stenosis percentage or lesion localization. CAD and the vessel outputs are separate classifiers, not a joint distribution or a logical vessel-union rule. Weak LCX/RCA recall is visible beside the stronger results.

Attribution follows UCI CC BY 4.0 and the exact current BodyParts3D archive CC BY 4.0 license; installed dependency metadata/locks are inventoried without replacing upstream notices. MIT is owner-selected for project code. Organizer redistribution permission remains unresolved, so the separate public export omits the seven PDFs and their historical objects. The real public GitHub URL and initial push rejection are documented. No successful hosted CI, recorded video, external cohort or final neural candidate is invented.

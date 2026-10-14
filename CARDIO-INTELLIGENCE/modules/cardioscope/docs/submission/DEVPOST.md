# Devpost-ready project copy

This is prepared copy, not a published submission. Replace repository/video links after explicit approval; add both teammates with their real full names and Devpost accounts.

## Project name
CardioScope

## Tagline
Coronary models, made visible.

## Short description
Explore coronary model outputs in 3D, inspect the factors behind each prediction, and review the supporting evidence. CardioScope connects 55 structured inputs, four separately trained classifiers, interactive coronary reference anatomy and SHAP for educational exploration.

## Inspiration
We wanted one place to explore a named artery, its model output, the entered factors behind it and the evidence supporting it.

## Problem
Clinical tables lack spatial context; polished probability displays can conceal weak evidence. Track A brings prediction, anatomy and explanation together. We make their evidence and limits visible.

## What it does
A user loads the existing public development example or supplies a complete 55-feature source profile. Four separately trained classifiers return CAD, LAD, LCX and RCA outputs at the fixed 0.5 threshold. Selecting a vessel card highlights its BodyParts3D reference group, and clicking geometry selects the same card. Rotation, zoom, isolation and view presets support exploration. Signed SHAP factors show entered values, and Evidence exposes saved metrics, matrices, uncertainty and limitations.

These outputs do not form a joint probability distribution. Reference anatomy is not a patient reconstruction or lesion map. The visible educational disclaimer stays part of the experience.

## How we built it
React, TypeScript and Vite serve the interface. React Three Fiber, Drei and Three.js render verified OBJ leaves. FastAPI validates profiles and orchestrates frozen scikit-learn inference and SHAP. Model/schema/profile fingerprints prevent mismatched outputs; explicit failures preserve verified numerical results when rendering or explanations are unavailable. Bundled artifacts, pinned Python/npm environments, integrity checks and Docker support reproducibility without paid runtime APIs.

## ML methodology
UCI's Extension of Z-Alizadeh Sani contains 303 records. We allow 55 predictors and exclude Cath/LAD/LCX/RCA from inputs. A locked shared split reserves 61 records, with 242 for development. Each target has its own locked five-outer/three-inner nested folds; preprocessing and selection stay inside training folds. CAD/LAD use balanced L2 logistic regression; LCX/RCA use shallow unweighted forests. All four models were frozen before the final holdout was evaluated once.

On that small same-source holdout, CAD ROC-AUC/recall were **0.9134/0.9070**, and LAD **0.8474/0.8485**. LCX and RCA ranking was moderate, with ROC-AUC **0.6723/0.6976**, but recall was weak: **0.2083/0.2857**. This is not external clinical validation or established calibrated risk.

## 3D visualization
The heart plus LAD/LCX/RCA use 83 verified BodyParts3D leaves in one shared coordinate system. Coronary leaves are removed from the heart base, preventing duplicate groups. Continuous whole-vessel coloring follows named model probabilities; selection has a separate highlight. We preserve source geometry and do not animate narrowing or invent blockage positions.

## Explainability
Linear SHAP explains CAD/LAD in positive-class log-odds; TreeSHAP explains LCX/RCA in probability contribution space. The background is a deterministic 100-record development-only reference. Encoded categories aggregate back to all 55 source features, and every accepted explanation is checked against the unrounded model output. SHAP associations do not establish causality, mechanism or treatment.

## Challenges
The hardest scientific boundary was preserving an honest final test while making a usable, interpretable product. Engineering challenges included verifying artery mappings, preserving shared coordinates, reconciling tree-routing precision for SHAP, and reproducing the exact frozen environment on Linux. Limited data and weak LCX/RCA detection remained visible rather than being hidden behind the visualization.

## Accomplishments
We completed the end-to-end workflow with real anatomy, four frozen classifiers, target-linked explanations and a saved-evidence dashboard. The hardened V1 passed 134 Python and 75 frontend tests on macOS ARM64 and clean Ubuntu ARM64. Real desktop Chromium/Firefox/Safari checks and immutable artifact verification support those scoped engineering claims. Lazy loading reduced initial uncompressed JavaScript by about 78%; total renderer assets were not similarly reduced.

The GitHub Actions workflow is prepared and validated through equivalent local Ubuntu checks. Hosted CI has not yet run.

## What we learned
After the once-only test exposed weak vessel sensitivity, we treated the holdout as consumed and froze V1. Two bounded, separately preregistered development-only experiments tested threshold/model changes and a small multi-task neural network. Thresholding recovered sensitivity but lacked the required stability; RCA's mean scores were higher on paired development folds in the multi-task study, while LCX and CAD-preservation conditions failed. Neither joint gate passed. Neither study is independently validated or deployed, and no final neural candidate was fitted.

## Limitations
Only 303 source records, a 61-record same-source holdout, no independent external cohort or verified true patient IDs, uncalibrated probabilities and poor LCX/RCA recall at 0.5. Reference anatomy cannot locate lesions or estimate narrowing geometry. The system is an educational/research prototype without clinical deployment validation.

## Future work
A new, independently collected cohort would be needed to validate a future model. Larger representative data, verified patient grouping, prospective calibration assessment, and domain-expert review could guide later work. Patient-specific anatomy would require an appropriate imaging dataset and a separate validated pipeline. These capabilities require separate validation.

## Built with
Python; scikit-learn; NumPy; pandas; SHAP; FastAPI; uvicorn; React; TypeScript; Vite; Three.js; React Three Fiber; Drei; Vitest; pytest; Docker; prepared GitHub Actions workflow. Data: UCI Extension of Z-Alizadeh Sani. Anatomy: BodyParts3D. XGBoost and PyTorch appear only in isolated research, not the V1 product runtime.

## Submission links and gallery

- Public GitHub repository: [AbhikRao/CardioScope](https://github.com/AbhikRao/CardioScope) — public repository created; initial code push blocked by missing OAuth `workflow` scope. Do not submit this as a working source link until the push and clone/CI checks succeed.
- YouTube demo: **pending recording and upload approval**; 3-10 minutes, English audio/subtitles, public or unlisted.
- Report: `output/pdf/CardioScope-Track-A-Report.pdf` (six pages).
- Gallery order: `product-hero.png`, `anatomy.png`, `explanation-CAD.png`, `explanation-RCA.png`, `evidence.png` from `docs/submission/assets/`.

Dataset: [UCI, CC BY 4.0](https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset), DOI [10.24432/C5461K](https://doi.org/10.24432/C5461K). BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International, from the [current archive](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). Code license remains an owner decision; third-party licenses are retained.

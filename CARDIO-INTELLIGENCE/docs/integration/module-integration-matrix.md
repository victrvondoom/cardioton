# Module integration matrix

Every source project and where it lives in CARDIO INTELLIGENCE.

- **INTEGRATED**: the product core (backend API, frontend, ops), carried over complete.
- **MERGED + RETAINED**: the core already contains code adapted from this project (listed under
  *Core integration points*). The complete original project is also kept under `modules/<slug>/`.
- **RETAINED_AS_VARIANT**: the complete project lives under `modules/<slug>/` and runs with its
  own commands. Duplicate filenames were resolved and every reference to a renamed file was
  rewritten. The core API and UI do not call it yet.

| Module | Original folder | What it is (from its README) | Files | Main languages | Tooling | Disposition |
|---|---|---|---:|---|---|---|
| `core` | `CLINICASE - ONCOTWIN (git-tracked files)` | CARDIOTON | 1660 | Python (644), TypeScript (455), JavaScript (13) | Compose, Docker, Vite, npm, pip, pyproject | INTEGRATED (product core) |
| `aortavision-3d` | `AortaVision-3D-master` | 🫀 AortaVision 3D | 154 | JavaScript (24), Python (7) | Vite, npm, pip | RETAINED_AS_VARIANT |
| `arterylens` | `ArteryLens-Visual-Intelligence-for-Coronary-Risk-main` | CardioRisk 3D  Cardiovascular Risk Visualization & Prediction | 58 | TypeScript (14), Python (4), JavaScript (3) | Vite, npm, pip | RETAINED_AS_VARIANT |
| `axxess` | `Axxess-main` | MedScribe — Federated Clinical Intelligence Platform | 59 | TypeScript (40), JavaScript (2) | Expo, npm | RETAINED_AS_VARIANT |
| `cad-detection-3d-heart` | `CAD_detection_3d_heart-main` | CardioVista | 4 | assets/docs | - | RETAINED_AS_VARIANT |
| `cardia-atlas` | `cardia-atlas-main` | Cardia Atlas | 47 | Python (6), JavaScript (4) | Docker, npm, pip | RETAINED_AS_VARIANT |
| `cardio` | `Cardio-main` | CardioScope | 132 | TypeScript (48), Python (24), Jupyter (1) | Docker, Vite, npm, pip, pyproject | RETAINED_AS_VARIANT |
| `cardio-inspection` | `CardioInspection-main` | - | 15 | Python (8) | - | RETAINED_AS_VARIANT |
| `cardio-risk-3d` | `cardio-risk-3d-main` | Cardiovascular Risk Visualization & Prediction | 19 | Python (5), JavaScript (2) | - | RETAINED_AS_VARIANT |
| `cardio-risk-heart-3d` | `cardio-risk-heart-3d-master` | Track A: CAD and per-vessel stenosis risk (ML pipeline, Steps 1–4) | 101 | Python (17), Jupyter (1) | pip, pyproject | RETAINED_AS_VARIANT |
| `cardiolens-track-a` | `cardiolens-track-a-main` | - | 10 | assets/docs | pip | RETAINED_AS_VARIANT |
| `cardioscope` | `CardioScope-main` | CardioScope | 619 | Python (53), TypeScript (25) | Docker, Vite, npm, pyproject | RETAINED_AS_VARIANT |
| `cardiosight-3d` | `cardiosight-3d-main` | CardioSight 3D 🫀 | 32 | TypeScript (7), Python (3), JavaScript (3) | npm, pip | RETAINED_AS_VARIANT |
| `cardiospatial-3d` | `CardioSpatial-3D-main` | 🫀 CARDIOSPATIAL-3D: Interactive Multi-Vessel Coronary Risk & Anatomical Mapping System | 27 | Python (5), JavaScript (2) | pip | RETAINED_AS_VARIANT |
| `cardiotwin` | `CardioTwin-main` | CardioTwin | 668 | TypeScript (424), Python (108), JavaScript (2) | Compose, Docker, Vite, npm, pip, pyproject | RETAINED_AS_VARIANT |
| `cardiovascular-risk-viz-and-prediction` | `cardiovascular-risk-visualization-and-prediction-main` | Perfusion3D: Spatial Hemodynamic Ischemia & Coronary Twin | 515 | TypeScript (76), Python (65), JavaScript (2) | Compose, Docker, Vite, npm, pip | RETAINED_AS_VARIANT |
| `cardiovision-3d` | `CardioVision-3D-main` | CardioVision AI | 40 | JavaScript (18), Python (2) | Vite, npm, pip | RETAINED_AS_VARIANT |
| `case-twin` | `case-twin-main` | 🩺 CaseTwin | 78 | TypeScript (39), Python (12), JavaScript (3) | Docker, Vite, npm, pip | MERGED + RETAINED |
| `corolens` | `corolens-main` | CoroLens | 54 | JavaScript (9), Python (5) | npm, pip | RETAINED_AS_VARIANT |
| `coronarytwin` | `CoronaryTwin-main` | CoronaryTwin | 307 | TypeScript (67), Python (47), Jupyter (1) | Compose, Docker, Vite, npm, pip | RETAINED_AS_VARIANT |
| `cortwin` | `Cortwin-main` | CorTwin | 390 | TypeScript (242), Python (37) | Vite, npm, pip, pyproject | RETAINED_AS_VARIANT |
| `cv-risk-viz-prediction` | `Cardiovascular-Risk-Visualization-Prediction-main` | CardioVision AI | 72 | Python (21), TypeScript (14) | Vite, npm, pip | RETAINED_AS_VARIANT |
| `epicast` | `Epicast-main` | 🦠 EpiCast — Agentic Disease Surveillance with MedGemma | 172 | JavaScript (28), Python (25), Kotlin (2) | Docker, Expo, npm, pip | MERGED + RETAINED |
| `grok-app` | `grok-app-main` | How it works | 164 | TypeScript (136) | Next.js, npm | RETAINED_AS_VARIANT |
| `hack-ireland-2025` | `hack-ireland-2025-team-9-main` | hack-ireland-2025 | 109 | TypeScript (82), JavaScript (4), Python (3) | Next.js, npm, pip | RETAINED_AS_VARIANT |
| `heartai` | `heartAI-main` | - | 140 | TypeScript (20), Python (13), Jupyter (4) | Docker, Next.js, npm, pip | MERGED + RETAINED |
| `hophacks` | `HopHacks-main` | MedRelay - Medical Billing Automation | 87 | Python (35) | pip | RETAINED_AS_VARIANT |
| `multimodal-ai-hackathon-project` | `Multimodal-AI-Hackathon-Project-main` | CAD Risk 3D — Multimodal AI Hackathon 2026, Track A | 77 | JavaScript (25), Python (24) | Vite, npm, pip | RETAINED_AS_VARIANT |
| `multimodal-hackathon-2026` | `multimodal-hackathon-2026-main` | CardioFusion — Multimodal Cardiovascular Risk Visualization & Prediction | 55 | Python (16), TypeScript (11) | Next.js, npm, pip | RETAINED_AS_VARIANT |
| `multimodal-hackathon-track-a` | `multimodal-hackathon-track-a-main` | Coronary Risk Explorer — Track A: Cardiovascular Risk Visualization & Prediction | 157 | JavaScript (31), Python (19), Jupyter (8) | Docker, npm, pip | RETAINED_AS_VARIANT |
| `safetyconnect` | `SafetyConnect-main` | SafetyConnect | 61 | TypeScript (42) | Next.js, npm | MERGED + RETAINED |
| `slicerheart` | `SlicerHeart-master` | SlicerHeart extension for 3D Slicer | 384 | Python (88), C++ (19), Jupyter (2) | CMake | RETAINED_AS_VARIANT |

## Core integration points

- **case-twin** → `core/backend/app/cardiotwin/api/__init__.py`, `core/backend/app/cardiotwin/api/case_routes.py`, `core/backend/app/cardiotwin/models/cardiac_case.py`, `core/backend/app/cardiotwin/services/__init__.py`, `core/backend/app/cardiotwin/services/vector_search.py`, `core/frontend/src/cardiotwin/evidence/CaseProfileView.tsx`
- **epicast** → `core/backend/app/cardiotwin/api/__init__.py`, `core/backend/app/cardiotwin/api/core__cardiotwin_api__clinical_extraction.py`, `core/backend/app/cardiotwin/services/__init__.py`, `core/backend/app/cardiotwin/services/core__cardiotwin_services__clinical_extraction.py`, `core/frontend/src/cardiotwin/clinical/ClinicalExtractionPanel.tsx`
- **heartai** → `core/backend/app/cardiotwin/api/__init__.py`, `core/backend/app/cardiotwin/api/imaging.py`, `core/backend/app/cardiotwin/models/cardiac_case.py`, `core/backend/app/cardiotwin/services/__init__.py`, `core/backend/app/cardiotwin/services/imaging_embedding.py`, `core/backend/app/cardiotwin/services/vector_search.py`
- **safetyconnect** → `core/backend/app/cardiotwin/api/__init__.py`, `core/backend/app/cardiotwin/api/core__cardiotwin_api__workflow_orchestration.py`, `core/backend/app/cardiotwin/services/__init__.py`, `core/backend/app/cardiotwin/services/core__cardiotwin_services__workflow_orchestration.py`, `core/frontend/src/cardiotwin/workflow/WorkflowOrchestrationPanel.tsx`

## Detected entry points

- **core**: `core/backend/app/cardiotwin/atlas/api.py`, `core/backend/app/cardiotwin/ecg/api.py`, `core/backend/app/cardiotwin/evidence/api.py`, `core/backend/app/cardiotwin/hemodynamics/api.py`
- **aortavision-3d**: `modules/aortavision-3d/backend/aortavision_3d__backend__main.py`
- **arterylens**: `modules/arterylens/arterylens__train.py`, `modules/arterylens/backend/arterylens__backend__main.py`, `modules/arterylens/frontend/src/arterylens__frontend_src__main.tsx`
- **cardia-atlas**: `modules/cardia-atlas/app/cardia_atlas__app__main.py`, `modules/cardia-atlas/scripts/cardia_atlas__scripts__train.py`
- **cardio**: `modules/cardio/backend/app/cardio__backend_app__main.py`, `modules/cardio/frontend/src/cardio__frontend_src__main.tsx`, `modules/cardio/ml/cardioscope_ml/cardio__ml_cardioscope_ml__train.py`
- **cardio-inspection**: `modules/cardio-inspection/ml/cardio_inspection__ml__train.py`
- **cardio-risk-3d**: `modules/cardio-risk-3d/backend/cardio_risk_3d__backend__app.py`
- **cardio-risk-heart-3d**: `modules/cardio-risk-heart-3d/cardio_ml/cardio_risk_heart_3d__cardio_ml__predict.py`
- **cardioscope**: `modules/cardioscope/backend/app.py`, `modules/cardioscope/backend/inference.py`, `modules/cardioscope/frontend/src/main.tsx`, `modules/cardioscope/ml/train.py`
- **cardiosight-3d**: `modules/cardiosight-3d/api/cardiosight_3d__api__app.py`, `modules/cardiosight-3d/api/cardiosight_3d__api__train.py`
- **cardiospatial-3d**: `modules/cardiospatial-3d/backend/cardiospatial_3d__backend__app.py`
- **cardiotwin**: `modules/cardiotwin/backend/app/main.py`, `modules/cardiotwin/backend/app/routers/predict.py`, `modules/cardiotwin/frontend/src/cardiotwin__frontend_src__main.tsx`, `modules/cardiotwin/ml/src/cardiotwin_ml/inference.py`
- **cardiovascular-risk-viz-and-prediction**: `modules/cardiovascular-risk-viz-and-prediction/apps/api/app/cardiovascular_risk_viz_and_prediction__api_app__main.py`, `modules/cardiovascular-risk-viz-and-prediction/apps/api/app/services/cardiovascular_risk_viz_and_prediction__app_services__inference.py`, `modules/cardiovascular-risk-viz-and-prediction/apps/web/src/cardiovascular_risk_viz_and_prediction__web_src__main.tsx`, `modules/cardiovascular-risk-viz-and-prediction/scripts/cardiovascular_risk_viz_and_prediction__scripts__train.py`
- **cardiovision-3d**: `modules/cardiovision-3d/backend/cardiovision_3d__backend__main.py`
- **case-twin**: `modules/case-twin/backend/case_twin__backend__main.py`, `modules/case-twin/src/case_twin__src__main.tsx`
- **corolens**: `modules/corolens/corolens/corolens__corolens__train.py`
- **coronarytwin**: `modules/coronarytwin/app/coronarytwin__app__predict.py`, `modules/coronarytwin/app/main.py`, `modules/coronarytwin/src/coronarytwin__src__inference.py`, `modules/coronarytwin/src/train.py`
- **cortwin**: `modules/cortwin/pipeline/train.py`, `modules/cortwin/web/src/cortwin__web_src__main.tsx`
- **cv-risk-viz-prediction**: `modules/cv-risk-viz-prediction/backend/app/services/cv_risk_viz_prediction__app_services__inference.py`, `modules/cv-risk-viz-prediction/backend/cv_risk_viz_prediction__backend__main.py`, `modules/cv-risk-viz-prediction/backend/ml/cv_risk_viz_prediction__backend_ml__train.py`, `modules/cv-risk-viz-prediction/frontend/src/cv_risk_viz_prediction__frontend_src__main.tsx`
- **epicast**: `modules/epicast/src/api/epicast__src_api__app.py`
- **heartai**: `modules/heartai/api/app/main.py`, `modules/heartai/api2/main.py`, `modules/heartai/src/main.py`
- **hophacks**: `modules/hophacks/hophacks__main.py`, `modules/hophacks/src/app.py`
- **multimodal-ai-hackathon-project**: `modules/multimodal-ai-hackathon-project/backend/multimodal_ai_hackathon_project__backend__main.py`, `modules/multimodal-ai-hackathon-project/ml/multimodal_ai_hackathon_project__ml__inference.py`
- **multimodal-hackathon-2026**: `modules/multimodal-hackathon-2026/backend/app/multimodal_hackathon_2026__backend_app__main.py`, `modules/multimodal-hackathon-2026/backend/app/routers/multimodal_hackathon_2026__app_routers__api.py`
- **multimodal-hackathon-track-a**: `modules/multimodal-hackathon-track-a/backend/app/main.py`, `modules/multimodal-hackathon-track-a/backend/app/multimodal_hackathon_track_a__backend_app__inference.py`

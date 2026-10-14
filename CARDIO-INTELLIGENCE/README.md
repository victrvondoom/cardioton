# CARDIO INTELLIGENCE

One repository for the cardiovascular platform and every project it absorbed:

- risk prediction
- coronary and cardiac digital twins
- 3D heart and aorta viewers
- ECG and imaging pipelines
- clinical case retrieval
- the 3D Slicer SlicerHeart extension

All of it sits around the core CardioTwin/OncoTwin product.

## Layout

```
CARDIO-INTELLIGENCE/
├── core/                 product core: FastAPI backend, React frontend, ops, k8s, docs
├── modules/<slug>/       each absorbed project, complete and runnable on its own
└── docs/integration/     manifest, rename map, duplicate report, validation report
```

6467 files. 984 files were renamed so their names are unique, and every import, path
and command that pointed at them was rewritten. 1490 files (261 names) still share a
name because a tool or loader requires it, such as `package.json`, `__init__.py`, Next.js
`page.tsx`, Slicer module files, or a model file loaded by a computed path. Each one is listed with its
reason in `docs/integration/kept-duplicate-names.csv`.

## Modules

| Module | From | About |
|---|---|---|
| [`core`](core/) | `CLINICASE - ONCOTWIN (git-tracked files)` | CARDIOTON |
| [`aortavision-3d`](modules/aortavision-3d/) | `AortaVision-3D-master` | 🫀 AortaVision 3D |
| [`arterylens`](modules/arterylens/) | `ArteryLens-Visual-Intelligence-for-Coronary-Risk-main` | CardioRisk 3D  Cardiovascular Risk Visualization & Prediction |
| [`axxess`](modules/axxess/) | `Axxess-main` | MedScribe — Federated Clinical Intelligence Platform |
| [`cad-detection-3d-heart`](modules/cad-detection-3d-heart/) | `CAD_detection_3d_heart-main` | CardioVista |
| [`cardia-atlas`](modules/cardia-atlas/) | `cardia-atlas-main` | Cardia Atlas |
| [`cardio`](modules/cardio/) | `Cardio-main` | CardioScope |
| [`cardio-inspection`](modules/cardio-inspection/) | `CardioInspection-main` | - |
| [`cardio-risk-3d`](modules/cardio-risk-3d/) | `cardio-risk-3d-main` | Cardiovascular Risk Visualization & Prediction |
| [`cardio-risk-heart-3d`](modules/cardio-risk-heart-3d/) | `cardio-risk-heart-3d-master` | Track A: CAD and per-vessel stenosis risk (ML pipeline, Steps 1–4) |
| [`cardiolens-track-a`](modules/cardiolens-track-a/) | `cardiolens-track-a-main` | - |
| [`cardioscope`](modules/cardioscope/) | `CardioScope-main` | CardioScope |
| [`cardiosight-3d`](modules/cardiosight-3d/) | `cardiosight-3d-main` | CardioSight 3D 🫀 |
| [`cardiospatial-3d`](modules/cardiospatial-3d/) | `CardioSpatial-3D-main` | 🫀 CARDIOSPATIAL-3D: Interactive Multi-Vessel Coronary Risk & Anatomical Mapping System |
| [`cardiotwin`](modules/cardiotwin/) | `CardioTwin-main` | CardioTwin |
| [`cardiovascular-risk-viz-and-prediction`](modules/cardiovascular-risk-viz-and-prediction/) | `cardiovascular-risk-visualization-and-prediction-main` | Perfusion3D: Spatial Hemodynamic Ischemia & Coronary Twin |
| [`cardiovision-3d`](modules/cardiovision-3d/) | `CardioVision-3D-main` | CardioVision AI |
| [`case-twin`](modules/case-twin/) | `case-twin-main` | 🩺 CaseTwin |
| [`corolens`](modules/corolens/) | `corolens-main` | CoroLens |
| [`coronarytwin`](modules/coronarytwin/) | `CoronaryTwin-main` | CoronaryTwin |
| [`cortwin`](modules/cortwin/) | `Cortwin-main` | CorTwin |
| [`cv-risk-viz-prediction`](modules/cv-risk-viz-prediction/) | `Cardiovascular-Risk-Visualization-Prediction-main` | CardioVision AI |
| [`epicast`](modules/epicast/) | `Epicast-main` | 🦠 EpiCast — Agentic Disease Surveillance with MedGemma |
| [`grok-app`](modules/grok-app/) | `grok-app-main` | How it works |
| [`hack-ireland-2025`](modules/hack-ireland-2025/) | `hack-ireland-2025-team-9-main` | hack-ireland-2025 |
| [`heartai`](modules/heartai/) | `heartAI-main` | - |
| [`hophacks`](modules/hophacks/) | `HopHacks-main` | MedRelay - Medical Billing Automation |
| [`multimodal-ai-hackathon-project`](modules/multimodal-ai-hackathon-project/) | `Multimodal-AI-Hackathon-Project-main` | CAD Risk 3D — Multimodal AI Hackathon 2026, Track A |
| [`multimodal-hackathon-2026`](modules/multimodal-hackathon-2026/) | `multimodal-hackathon-2026-main` | CardioFusion — Multimodal Cardiovascular Risk Visualization & Prediction |
| [`multimodal-hackathon-track-a`](modules/multimodal-hackathon-track-a/) | `multimodal-hackathon-track-a-main` | Coronary Risk Explorer — Track A: Cardiovascular Risk Visualization & Prediction |
| [`safetyconnect`](modules/safetyconnect/) | `SafetyConnect-main` | SafetyConnect |
| [`slicerheart`](modules/slicerheart/) | `SlicerHeart-master` | SlicerHeart extension for 3D Slicer |

## Running

Each part keeps its own build and run commands, run from its own folder. A README that
nothing depends on was renamed in place to `<module>__<folders>__README.md` (for example
`core/core__README.md`); `docs/integration/rename-map.csv` lists every rename. For the core:

```bash
cd core
docker compose up           # or see core/Makefile
# without Docker, install dependencies first (they are not stored in the repository):
cd backend && python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"
cd ../frontend && npm install && npm run dev
```

Each module installs the same way from its own folder (`npm install`, `pip install -r requirements.txt`).

## Intelligence Hub

The core frontend shows every module in one place under **Intelligence Hub** (`/hub`, after sign-in):

| Page | What it shows |
|---|---|
| `/hub` | Every project with its description, tech, screenshots and counts, with search and category filters |
| `/hub/<slug>` | One project: README, features, screenshot gallery, its 3D models, reported metrics, dataset previews, run commands, and its own app |
| `/hub/anatomy` | All 3D heart, vessel and valve models (GLB, glTF, OBJ, PLY, STL) in one viewer |
| `/hub/benchmarks` | Each project's own reported headline metric (ROC-AUC first), with its source file |
| `/hub/apps` | The projects' web apps, running inside the hub |

The catalogue is read from `modules/` at startup by `core/backend/app/hub/module_catalog.py`. Nothing is
copied or retrained, and a metric is shown only if a project's own evaluation file reports it. The API is
`/api/v1/hub/*`. Secrets (`.env`, keys), source code and anything outside the module folder are never served.

The embedded apps are built once with:

```bash
cd core
python scripts/build_hub_apps.py            # or name modules: python scripts/build_hub_apps.py cortwin
```

This installs each app's locked dependencies and builds it into `modules/<slug>/.hub-build/` (git-ignored).
Apps that compute in the browser, such as CorTwin, work fully inside the hub. Apps whose predictions come
from their own Python API show their interface. Their predictions need that API started from the module's
folder (its command is on the project's **Files & Run** tab).

## Records

- `docs/integration/source-manifest.csv`: each file's original path, final path, hashes, and what changed
- `docs/integration/rename-map.csv`: every rename
- `docs/integration/kept-duplicate-names.csv`: every shared name and why it is kept
- `docs/integration/module-integration-matrix.md`: per-module stack, entry points, disposition
- `docs/integration/duplicate-resolution.md`: how names were resolved
- `docs/integration/validation-report.md`: what was checked, what passed, what was not run
- `docs/integration/environment-variables.md`: every module's configuration variables in one index

## Where the originals went

After verification the original project folders were removed, so this folder is the whole product.

- Local secrets (`.env` files, keys) and runtime state were moved next to the code that reads them.
  That includes the core's local databases, outputs and logs. All of it is git-ignored, including local production environment settings. Configure your own services when running the modules.
- The core's original files remain in git history.
- Every module file whose text was rewritten has its pre-rewrite version in
  `docs/integration/originals-of-rewritten-files.zip`.

# Asset and Component Licenses

Licenses for third-party assets and components bundled with or integrated into
CardioTon. Original CardioTon code remains under the repository's own license
(`LICENSE`); nothing below transfers obligations onto it.

## SlicerHeart (BSD 3-Clause)

- **What:** Vendored source snapshot at `SlicerHeart-master/` (GitHub `master`
  branch zip download; no VCS metadata, pinned by content fingerprint).
- **License:** BSD 3-Clause — Copyright (c) 2021, SlicerHeart Contributors
  (https://github.com/SlicerHeart/SlicerHeart). Full text:
  `SlicerHeart-master/LICENSE`.
- **Used as:** attributed adaptations (`backend/app/integrations/slicerheart/annulus_shape.py`,
  `valve_metrics.py`, `catalog.py`) and a runtime bridge
  (`backend/app/integrations/slicerheart/bridge.py`,
  `ops/slicerheart/bridge_worker.py`). Upstream files are never modified.
- **Obligations kept:** copyright notice retained in the vendored tree;
  attribution headers in adapted files; citation recorded (Lasso et al. 2022,
  Frontiers in Cardiovascular Medicine, doi:10.3389/fcvm.2022.886549).
- **Not applied to:** original CardioTon code.

### SlicerHeart device STL assets

Small binary device models inside `SlicerHeart-master/` (e.g.
`ValveClipDeviceSimulator/Resources/Models/G4NT*.stl`, MitraClip clip parts)
inherit the same BSD 3-Clause license. They are **classified but not yet
converted or redistributed separately**; they remain inside the untouched
upstream tree. Mold/clamp STLs (LeafletMoldGenerator, ValveMoldCreator) are
bench-manufacturing hardware and excluded from integration.

## Human heart reference model (CC-BY-4.0)

- **What:** `frontend/public/models/hra-human-heart.glb`.
- **Source:** Human Reference Atlas / HuBMAP CCF 3D Reference Object Library,
  release v1.2 (2022), VH_M_Heart; based on Visible Human Male data.
- **License:** Creative Commons Attribution 4.0 International.
- **Details:** `frontend/public/models/README.md`.

## CardioTwin training dataset

The shipped model artifacts are trained on the Z-Alizadeh Sani dataset
extension; provenance, dataset hash and license are recorded in
`backend/app/cardiotwin/artifacts/evaluation.json` and displayed on
`/cardiotwin/evaluation`.

## Third-party runtime dependencies

Backend (FastAPI stack) and frontend (React/Three.js stack) dependencies are
declared in `backend/pyproject.toml` and `frontend/package.json` with their
license metadata available in the lockfiles. No new native dependency was added
by the SlicerHeart integration: the adapted statistics require only `numpy`,
already a backend dependency.

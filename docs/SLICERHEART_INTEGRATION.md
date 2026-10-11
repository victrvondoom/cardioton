# SlicerHeart Integration

This document records how the open-source **SlicerHeart** extension for 3D Slicer
is integrated into CardioTon: what was inspected, what was integrated, how the
bridge works, what is deliberately not executed in the web stack, and how it was
tested.

## 1. Upstream provenance

| Field | Value |
|---|---|
| Repository | https://github.com/SlicerHeart/SlicerHeart |
| Snapshot in repo | `SlicerHeart-master/` at the repository root (GitHub `master` branch zip download; no VCS metadata was included, so no commit hash is available) |
| License | BSD 3-Clause — SlicerHeart Contributors (`SlicerHeart-master/LICENSE`) |
| Authors | Matthew Jolley (CHOP/UPenn), Andras Lasso (Perk Lab, Queen's), Christian Herz (CHOP), Csaba Pinter (Pixel Medical), Anna Ilina (Perk Lab), Steve Pieper (Isomics), Adam Rankin (Robarts) |
| Citation | Lasso et al. (2022), *SlicerHeart: An open-source computing platform for cardiac image analysis and modeling*, Frontiers in Cardiovascular Medicine 9, doi:10.3389/fcvm.2022.886549 |
| Pinning | The backend computes a deterministic SHA-256 fingerprint over the upstream source inventory (`.py/.txt/.md/.cmake/.json/.html/.xml` files), exposed by `GET /api/v1/integrations/slicerheart/overview` |
| Modification policy | Upstream files are **never modified**. Adaptations live in `backend/app/integrations/slicerheart/` with attribution headers. |

## 2. Inspection findings (what actually runs where)

The vendored snapshot contains 88 Python files across 37 module directories,
plus C++ loadable modules, CMake SuperBuild files and device STL assets.

**67 of the 88 Python modules import `slicer`, `vtk`, `qt` or `ctk`.** They only
execute inside a 3D Slicer runtime and **cannot** be imported into the ordinary
FastAPI process. This was verified by import inspection, not assumed from names.

What is genuinely runtime-independent:

* `ValveBatchExport/HeartValveBatchAnalysis/annulus_shape_analysis.py` — a
  numpy/csv cohort statistics core (contour extraction, landmark ordering,
  per-segment resampling, size normalization factors) behind Slicer-specific
  scene/model code.
* `ValveAnnulusAnalysis/HeartValveLib/Constants.py` — pure reference data
  (valve type presets, echo probe-position RAS transforms).
* `ValveQuantification/ValveQuantificationLib/MeasurementPreset*.py` — metric
  vocabulary (names, landmark labels, semantics) embedded in Slicer-dependent
  classes.

## 3. Integration matrix

The complete, code-verified classification of all upstream module groups is
served by the backend at `GET /api/v1/integrations/slicerheart/catalog` and
rendered in the UI on `/cardiotwin/evaluation` (SlicerHeart panel). Summary:

| Classification | Meaning | Count (module groups) |
|---|---|---|
| REUSE DIRECTLY | Compatible with the existing backend as-is | 0 |
| ADAPT | Ported/wrapped for the FastAPI runtime with attribution | 2 |
| BRIDGE | Executable only in a 3D Slicer runtime via the bridge job contract | 14 |
| CONVERT | Browser-convertible static assets (device STLs) | 1 |
| REFERENCE ONLY | Methodology/terminology value, no direct execution | 5 |
| EXCLUDE | Not applicable or requires the Slicer C++ build toolchain | 5 |

Wired into CardioTon today:

* **Adapted — cohort annulus-shape statistics**
  (`annulus_shape.py`, from `annulus_shape_analysis.py`): contour rows →
  landmark ordering → resampling → optional size normalization → rigid
  alignment (numpy Kabsch replacing `vtkProcrustesAlignmentFilter`, same
  rigid/no-scale semantics) → per-phase cohort mean/std contour and landmark
  positions. Slicer scene/model outputs omitted. Exposed as a research API and
  a UI tool.
* **Adapted — valve metric vocabulary & probe presets** (`valve_metrics.py`):
  metric definitions per valve (annulus circumference/area/diameters, sphericity
  index, height, leaflet tenting, coaptation, papillary displacement…), each
  marked `requires imaging data`; CardioTon serves the terminology only.
* **Reference — RAS/LPS and unit conversion conventions** from
  `ImportExportSimulationModel` are adopted as documented practice for any
  future mesh exchange.

Everything else is either `available_via_bridge` (job contract exists; execution
requires a provisioned Slicer runtime), `documented_only`, or `not_integrated`
(see the catalog endpoint for per-module notes).

## 4. Bridge architecture

```
SlicerHeart / 3D Slicer runtime           ops/slicerheart/bridge_worker.py
                ↑ job JSON files          ↓ results/status files
        bridge job directory (SLICER_HEART_BRIDGE_DIR, default output/slicer-heart-bridge/jobs)
                ↑
CardioTon FastAPI  —  backend/app/integrations/slicerheart/bridge.py
                ↑
CardioTon React frontend / CardioTwin agents
```

* The FastAPI process **never** executes SlicerHeart code. `POST
  /integrations/slicerheart/bridge/jobs` validates the request against the job
  catalogue (job type + allowed output formats: DICOM, NIfTI, NRRD, VTK, GLB,
  JSON, CSV) and writes an explicit job spec.
* With no runtime configured (the default), submissions return **503** with
  `reason: slicer_runtime_unavailable` and setup instructions. No placeholders,
  no fabricated results.
* `ops/slicerheart/bridge_worker.py` runs **inside** a 3D Slicer python
  environment with the SlicerHeart extension installed. It polls the job
  directory and executes jobs through SlicerHeart's own `ValveBatchExport`
  CLI (e.g. `--export_annulus_coordinates`, `--export_quantification_results`).
  Job files record `queued_for_slicer_worker → running → completed/failed`
  honestly, including tracebacks.
* The `annulus_contour_export` job produces exactly the CSV format
  (`Filename, Phase, Valve, AnnulusContourX/Y/Z, AnnulusContourLabel`) that the
  CardioTon research statistics endpoint consumes, closing the loop:
  SlicerHeart export → bridge → CardioTon cohort statistics → 3D/UI.

## 5. API contracts (all auth-gated under `/api/v1/integrations/slicerheart`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/overview` | GET | Provenance, snapshot fingerprint, catalog summary, bridge status |
| `/catalog` | GET | Full integration matrix |
| `/valve-metrics` | GET | Metric vocabulary, valve types, probe presets, no-fabrication notice |
| `/valve-metrics/{metric_id}` | GET | Single metric definition |
| `/research/annulus-shape` | POST | Cohort annulus-shape statistics on an uploaded ValveBatchExport CSV (≤4 MiB, ≤200k rows) |
| `/bridge/status` | GET | Runtime detection + job catalogue + setup instructions |
| `/bridge/jobs` | POST | Submit a bridge job (503 `slicer_runtime_unavailable` when no runtime) |
| `/bridge/jobs/{job_id}` | GET | Worker-maintained job status |

Agent access: deterministic tools in `agent_tools.py` (`explain_metric`,
`integration_catalog`, `imaging_runtime_status`) and a registry entry in the
CardioTwin multi-agent registry. Agents can explain SlicerHeart terminology and
report bridge status; they never produce measurements.

## 6. Frontend integration

* `src/cardiotwin/slicerheart/SlicerHeartPanel.tsx` (mounted on
  `/cardiotwin/evaluation`): provenance, classification matrix, honest bridge
  unavailability notice, valve metric vocabulary, and the cohort annulus-shape
  research tool (upload CSV → mean contour plot + statistics).
* No standalone "SlicerHeart app" was added; the capabilities live inside the
  existing CardioTwin evaluation/research workflow. Existing 3D heart rendering
  (React Three Fiber + Three.js, HRA reference heart) is unchanged and
  extended only by reuse in the new `/iit-mandi` demonstration page.

## 7. Limitations and honesty boundaries

* Computed imaging metrics (valve quantification, segmentation, orifice area,
  EA maps) require a provisioned 3D Slicer runtime; the bridge reports
  unavailability until then. This deployment has **no Slicer runtime
  configured**, so those computations were **not executed** in testing.
* The bridge worker script is **not covered by automated tests** because no
  3D Slicer installation exists in CI. Its job spec and status handling are
  tested; its upstream CLI invocations were written against the actual
  `ValveBatchExport.main()` argument parser in the vendored source.
* Annulus-shape statistics are population research descriptors over
  user-supplied contours — no clinical interpretation, no patient-specific
  diagnosis.
* No upstream assets were converted to GLB yet; device STLs (ValveClip G4
  models) are classified CONVERT and remain candidates for future device
  placement scenes.
* CardioTon's clinical safety semantics are unchanged: CAD probability bands
  are visual groupings, never diagnosed stenosis; the 3D heart is reference
  anatomy, never the individual patient's anatomy.

## 8. Testing results

Backend (`pytest tests/integrations tests/cardiotwin`):

* 18 SlicerHeart integration tests: provenance/fingerprint determinism, catalog
  completeness (every upstream module group classified), valve metric
  vocabulary, adapted statistics (ordering, resampling, scale factors, skip
  behaviour, rejection cases), bridge honesty (unavailable without SLICER_HOME,
  job spec validation, queued job files when configured), API contract (auth,
  happy paths, validation errors, 503 semantics). **All pass.**
* Full CardioTwin suite: **472 passed** (regression-free).

Frontend (`vitest`, `tsc --noEmit`):

* `tests/slicerheart-panel.test.tsx` (5 tests) and
  `tests/iit-mandi-demo.test.tsx` (6 tests): **all pass**.
* `tsc --noEmit`: **0 errors**.

## 9. Attribution requirements

* Keep `SlicerHeart-master/` intact, including `LICENSE` and `README.md`.
* Do not copy SlicerHeart's BSD 3-Clause notice onto original CardioTon code;
  adaptation files carry their own attribution headers referencing the upstream
  file and license.
* If you utilize SlicerHeart, cite the Frontiers in Cardiovascular Medicine
  paper above (recorded in the provenance endpoint).
